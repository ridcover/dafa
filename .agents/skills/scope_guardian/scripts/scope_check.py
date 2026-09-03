import sys
import os
import json
import fnmatch
from datetime import datetime

_WARNED_LIGHT_MODE_PATHS = set()

def is_light_mode(start_dir=None):
    """Memeriksa apakah mode ringan aktif via berkas penanda .agents/mode_ringan.json."""
    if start_dir is None:
        start_dir = os.getcwd()
    current_dir = os.path.abspath(start_dir)
    while True:
        agents_dir = os.path.join(current_dir, '.agents')
        if os.path.isdir(agents_dir):
            marker_path = os.path.join(agents_dir, 'mode_ringan.json')
            if os.path.exists(marker_path):
                try:
                    with open(marker_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    if isinstance(data, dict) and data.get('mode_ringan') is True:
                        return True
                    else:
                        print(f"[WARN] Berkas {marker_path} ditemukan tetapi isinya tidak dikenali (diharapkan {{\"mode_ringan\": true}}). Mode ringan dimatikan.")
                        return False
                except Exception as e:
                    if marker_path not in _WARNED_LIGHT_MODE_PATHS:
                        print(f"[WARN] Berkas {marker_path} ditemukan tetapi format JSON tidak valid ({e}). Mode ringan dimatikan.")
                        _WARNED_LIGHT_MODE_PATHS.add(marker_path)
                    return False
            return False
        parent = os.path.dirname(current_dir)
        if parent == current_dir:
            break
        current_dir = parent
    return False
# Umur maksimal scope_lock sebelum dianggap sisa tugas lama. Memperingatkan,
# tidak memblokir: lock yang basi menyesatkan, tetapi memblokir karenanya akan
# mematikan alat ini pada pemakaian pertama.
MAX_UMUR_JAM = 24




def peringatan_kesegaran(scope_data):
    """Kembalikan daftar peringatan bila scope_lock tampak sisa tugas lama."""
    peringatan = []
    created_at = scope_data.get('created_at')

    if not created_at:
        peringatan.append(
            "scope_lock.json tidak punya 'created_at' — umurnya tidak bisa diperiksa."
        )
        return peringatan

    try:
        umur_jam = (datetime.now() - datetime.fromisoformat(created_at)).total_seconds() / 3600
    except (ValueError, TypeError):
        peringatan.append(f"'created_at' tidak terbaca: {created_at!r}")
        return peringatan

    if umur_jam > MAX_UMUR_JAM:
        peringatan.append(
            f"scope_lock.json berumur {umur_jam / 24:.1f} hari (dibuat {created_at}). "
            f"Task: {scope_data.get('task', '?')!r}. Pastikan ini memang tugas yang "
            f"sedang dikerjakan, bukan sisa tugas sebelumnya."
        )

    return peringatan


def is_file_in_scope(filepath, allowed_files, allowed_patterns):
    """Check if filepath is allowed by allowed_files/patterns.

    Uses .lower() for case-insensitive comparison (normcase() was removed —
    it mangled '/' to '\\' on Windows, breaking path-relative matching).
    Both sides already forward-slash-normalized via .replace('\\\\', '/') before calling.
    Shared by scope_check.py and smart_replace/replace_text.py.
    """
    target = filepath.replace('\\', '/').lower()

    for allowed in allowed_files:
        allowed_lc = allowed.lower()
        if '/' not in allowed_lc:
            if os.path.basename(target) == allowed_lc:
                return True
        else:
            if target == allowed_lc or target.endswith('/' + allowed_lc):
                return True

    for pattern in allowed_patterns:
        if fnmatch.fnmatch(filepath, pattern):
            return True

    return False


def check_scope(target_file, light_mode=False):
    # Normalize path separators for comparison
    target_file = target_file.replace('\\', '/')
    current_dir = os.path.abspath(os.getcwd())
    lock_file_path = None
    lock_dir = None
    while True:
        candidate = os.path.join(current_dir, '.agents', 'scope_lock.json')
        if os.path.exists(candidate):
            lock_file_path = candidate
            lock_dir = current_dir
            break
        parent = os.path.dirname(current_dir)
        if parent == current_dir:
            break
        current_dir = parent
    
    if not lock_file_path:
        if light_mode or is_light_mode():
            print("[INFO] Mode ringan aktif: scope_lock.json dilewati.")
            return True, True, ""
        print("[WARN] scope_lock.json tidak ditemukan di .agents/. Menulis tanpa batasan lingkup tugas.")
        return True, True, ""
        
    abs_target = os.path.abspath(target_file).replace('\\', '/')
    abs_lock_dir = lock_dir.replace('\\', '/')
    if abs_target != abs_lock_dir and not abs_target.startswith(abs_lock_dir + '/'):
        print(f"[BLOCKED] File '{target_file}' is OUTSIDE the project boundary ({lock_dir}).")
        sys.exit(1)

    try:
        with open(lock_file_path, 'r', encoding='utf-8-sig') as f:
            scope_data = json.load(f)
    except Exception as e:
        print(f"[BLOCKED] Failed to parse scope_lock.json: {e}")
        print("Skema dan contohnya: .agents/skills/rules/scope_guardian.md")
        sys.exit(1)

    temuan = scope_data.get('temuan', [])
    if isinstance(temuan, list) and len(temuan) > 10:
        print("[BLOCKED] scope_lock.json: 'temuan' melebihi 10 baris. Pindahkan temuan lama ke connector.md untuk menjaga fokus agen.")
        sys.exit(1)

    for pesan in peringatan_kesegaran(scope_data):
        print(f"[WARN] {pesan}")

    task = scope_data.get('task', 'Unknown task')
    allowed_files = [f.replace('\\', '/') for f in scope_data.get('allowed_files', [])]
    allowed_patterns = scope_data.get('allowed_patterns', [])
    
    # Calculate risk
    num_files = len(allowed_files)
    task_lower = task.lower()
    is_cosmetic = any(word in task_lower for word in ['styling', 'kosmetik', 'teks', 'css', 'margin', 'padding'])
    
    if num_files > 5:
        risk_label = "High — multiple files (>5)"
    elif num_files > 1 or not is_cosmetic:
        if num_files > 1:
            risk_label = f"Medium — {num_files} files"
        else:
            risk_label = "Medium — single file, functional/logic scope"
    else:
        risk_label = "Low — single file, cosmetic scope"
    

    # 1. Check exact matches (SECURITY-FIXED: use basename for filename-only, normalized path for path-relative)
    for allowed in allowed_files:
        if '/' in allowed or '\\' in allowed:
            # Path-relative entry: compare normalized paths (already forward-slash from .replace() above).
            # Use .lower() for case-folding ONLY — do NOT use normcase() or normpath() here.
            # normcase() on Windows also converts '/' to '\\', breaking endswith('/'+allowed_norm).
            # .lower() only lowercases, preserving forward-slash separators intact.
            allowed_norm = allowed.lower()
            target_norm = target_file.lower()
            if target_norm == allowed_norm or target_norm.endswith('/' + allowed_norm):
                print(f"[ALLOWED] File '{target_file}' is in allowed_files.")
                print(f"[RISK] {risk_label}")
                return True
        else:
            # Filename-only entry: compare basenames (case-insensitive)
            # Use .lower() not normcase() — normcase() also converts '/' to '\\' on Windows
            allowed_base = allowed.lower()
            target_base = os.path.basename(target_file).lower()
            if target_base == allowed_base:
                print(f"[ALLOWED] File '{target_file}' is in allowed_files.")
                print(f"[RISK] {risk_label}")
                return True, True, task
            
    # 2. Check patterns
    for pattern in allowed_patterns:
        if fnmatch.fnmatch(target_file, pattern):
            print(f"[ALLOWED] File '{target_file}' matches pattern '{pattern}'.")
            print(f"[RISK] {risk_label}")
            return True, True, task
            
    # 3. If no match (Sprint 45: peringatan dan pencatatan, tidak menolak)
    print(f"[WARN] File '{target_file}' is OUT OF SCOPE for the current task.")
    print(f"Task: {task}")
    print(f"Allowed files: {allowed_files}")
    print(f"Allowed patterns: {allowed_patterns}")
    return True, False, task

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python scope_check.py <file_path> [--mode-ringan]")
        sys.exit(1)
    
    light_flag = any(arg in ['--mode-ringan', '--lightweight', '--light'] for arg in sys.argv[2:])
    check_scope(sys.argv[1], light_mode=light_flag)


def record_write(tool_name, filepath, in_scope, task_name=None, root_dir=None):
    """Menuliskan satu baris log ke .agents/write_log.jsonl ketika berkas ditulis."""
    if root_dir is None:
        cur = os.path.abspath(os.getcwd())
        while True:
            candidate = os.path.join(cur, '.agents')
            if os.path.isdir(candidate):
                root_dir = cur
                break
            parent = os.path.dirname(cur)
            if parent == cur:
                break
            cur = parent
        if root_dir is None:
            root_dir = os.path.abspath(os.getcwd())
            
    agents_dir = os.path.join(root_dir, '.agents')
    os.makedirs(agents_dir, exist_ok=True)
    log_file = os.path.join(agents_dir, 'write_log.jsonl')
    
    if task_name is None:
        lock_file = os.path.join(agents_dir, 'scope_lock.json')
        if os.path.exists(lock_file):
            try:
                with open(lock_file, 'r', encoding='utf-8-sig') as f:
                    data = json.load(f)
                task_name = data.get('task', '')
            except Exception:
                task_name = ''
        else:
            task_name = ''
            
    rel_berkas = filepath.replace('\\', '/')
    if os.path.isabs(filepath):
        try:
            rel_berkas = os.path.relpath(filepath, root_dir).replace('\\', '/')
        except Exception:
            rel_berkas = filepath.replace('\\', '/')

    entry = {
        "waktu": datetime.now().isoformat(),
        "alat": tool_name,
        "berkas": rel_berkas,
        "dalam_lingkup": bool(in_scope),
        "tugas": task_name or ""
    }
    
    try:
        with open(log_file, 'a', encoding='utf-8') as f:
            f.write(json.dumps(entry, ensure_ascii=False) + '\n')
    except Exception as e:
        print(f"[WARN] Gagal menulis ke write_log.jsonl: {e}")
