import sys
import json
import os
import subprocess

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
def main():
    try:
        raw_data = sys.stdin.read()
        if not raw_data.strip():
            print(json.dumps({"decision": "deny", "reason": "[BLOCKED] Payload kosong"}))
            sys.exit(0)
            
        try:
            input_data = json.loads(raw_data)
        except json.JSONDecodeError as e:
            # Ini menangkap kasus BOM+{} atau JSON rusak
            print(json.dumps({"decision": "deny", "reason": f"[BLOCKED] JSON tidak valid atau terdapat karakter tak lazim (BOM): {e}"}))
            sys.exit(0)
            
        tool_call = input_data.get('toolCall')
        if not isinstance(tool_call, dict):
            print(json.dumps({"decision": "deny", "reason": "[BLOCKED] Objek toolCall tidak ditemukan atau bukan dictionary"}))
            sys.exit(0)
            
        # Menangani kedua bentuk (run_command via input_data vs alat native via toolCall.name)
        tool_name = input_data.get('toolName') or tool_call.get('name')
        if not tool_name:
            print(json.dumps({"decision": "deny", "reason": "[BLOCKED] Nama tool (toolName / toolCall.name) tidak ditemukan"}))
            sys.exit(0)
            
        args = tool_call.get('args')
        if not isinstance(args, dict):
            print(json.dumps({"decision": "deny", "reason": "[BLOCKED] Objek args tidak ditemukan di dalam toolCall"}))
            sys.exit(0)
            
        target_file = args.get('TargetFile')
        if not target_file:
            print(json.dumps({"decision": "deny", "reason": "[BLOCKED] Parameter TargetFile tidak ditemukan di dalam toolCall.args"}))
            sys.exit(0)
            
        # Pengecekan scope_lock.json
        scope_script = os.path.join(os.path.dirname(__file__), "..", "skills", "scope_guardian", "scripts", "scope_check.py")
        if not os.path.exists(scope_script):
            print(json.dumps({"decision": "deny", "reason": "[BLOCKED] Skrip scope_check.py tidak ditemukan. Integritas sistem terganggu."}))
            sys.exit(0)
            
        scope_lock_path = os.path.join(os.path.dirname(__file__), "..", "scope_lock.json")
        if not os.path.exists(scope_lock_path):
            if is_light_mode():
                print(json.dumps({"decision": "allow", "reason": "[INFO] Mode ringan aktif: scope_lock.json dilewati."}))
                sys.exit(0)
            print(json.dumps({"decision": "allow", "reason": "[WARN] scope_lock.json tidak ditemukan di .agents/. Menulis tanpa batasan lingkup tugas."}))
            sys.exit(0)
            
        # Menjalankan pengecekan
        result = subprocess.run(
            [sys.executable, scope_script, target_file],
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            print(json.dumps({"decision": "allow"}))
        else:
            print(json.dumps({
                "decision": "deny",
                "reason": f"[BLOCKED] File '{target_file}' is OUT OF SCOPE.\n{result.stdout.strip()}\n{result.stderr.strip()}"
            }))
            
    except Exception as e:
        # Gagal-tertutup mutlak
        print(json.dumps({"decision": "deny", "reason": f"[BLOCKED] Error internal pada gerbang native: {e}"}))
        sys.exit(0)

if __name__ == "__main__":
    main()
