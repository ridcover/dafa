import os
import sys
import json

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

import json

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
def check_scope_write(write_target):
    """Enforce scope check using the unified scope_guardian module."""
    skills_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if skills_dir not in sys.path:
        sys.path.insert(0, skills_dir)
    try:
        from scope_guardian.scripts.scope_check import check_scope
        return check_scope(write_target)
    except Exception as e:
        print(f"[BLOCKED] Failed to import check_scope from scope_guardian: {e}")
        print("Pastikan skill scope_guardian terpasang di sebelah skill ini.")
        sys.exit(1)

def check_task_state(is_apply=False):
    if is_apply:
        root_dir = os.getcwd()
        paths = [
            os.path.join(root_dir, '.here_we_are', 'role.json'),
            os.path.join(root_dir, '.agents', 'chamber', 'role.json')
        ]
        for p in paths:
            if os.path.exists(p):
                role_data = None
                with open(p, 'rb') as f:
                    raw_bytes = f.read()
                
                err_msg = ""
                for enc in ['utf-8-sig', 'utf-16']:
                    try:
                        role_data = json.loads(raw_bytes.decode(enc))
                        break
                    except Exception as e:
                        err_msg = str(e)
                        
                if role_data is None:
                    print(f"[BLOCKED] Role lock file ada tetapi gagal dibaca (mungkin format rusak atau encoding salah): {err_msg}")
                    sys.exit(1)
                    
                if role_data.get('role') == 'QA':
                    print("[BLOCKED] Akses tulis (--apply) ditolak untuk role QA.")
                    sys.exit(1)

    state_file = os.path.join(os.getcwd(), '.agents', 'task_state.json')
    if not os.path.exists(state_file):
        return
        
    try:
        with open(state_file, 'r', encoding='utf-8') as f:
            state = json.load(f)
    except Exception as e:
        print(f"[BLOCKED] Gagal membaca state file: {e}")
        sys.exit(1)
        
    if state.get('phase') == 'pseudocode_pending':
        print("[BLOCKED] Pseudocode untuk task ini belum disetujui user.")
        print(f"Task: {state.get('task', 'Unknown')}")
        print("Minta user approve pseudocode dulu sebelum --apply bisa dijalankan.")
        sys.exit(1)

REACT_TEMPLATE = """import React, { useState, useEffect } from 'react';

const {name} = () => {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Fetch data logic here
    }, []);

    return (
        <div className="{name.lower()}-container">
            <h2>{name} Component</h2>
            {loading ? <p>Loading...</p> : <p>Content goes here.</p>}
        </div>
    );
};

export default {name};
"""

API_TEMPLATE = """const express = require('express');
const router = express.Router();

// GET endpoint
router.get('/', async (req, res) => {
    try {
        // Logic here
        res.status(200).json({ success: true, data: [] });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// POST endpoint
router.post('/', async (req, res) => {
    try {
        // Logic here
        res.status(201).json({ success: true, message: 'Created' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

module.exports = router;
"""

def generate_scaffold(file_type, name, target_dir, apply_mode):
    print("=== AUTO-SCAFFOLDER ===")
    print("=" * 60)

    if file_type.lower() not in ['react', 'api']:
        print("[FAIL] Invalid type. Choose 'react' or 'api'.")
        return

    if not os.path.exists(target_dir) and apply_mode:
        os.makedirs(target_dir, exist_ok=True)

    if file_type.lower() == 'react':
        filename = f"{name}.jsx"
        content = REACT_TEMPLATE.replace("{name}", name).replace("{name.lower()}", name.lower())
    else:
        filename = f"{name.lower()}.js"
        content = API_TEMPLATE

    filepath = os.path.join(target_dir, filename)

    # Check scope before writing (file-level, not directory)
    check_scope_write(filepath)
    
    if os.path.exists(filepath):
        print(f"[FAIL] File {filename} already exists at {target_dir}!")
        return
        
    if not apply_mode:
        print("[DRY-RUN MODE] Auto-Scaffolder Preview")
        print("=" * 50)
        print(f"Target File: {filepath}")
        print("--- Content Preview ---")
        print(content)
        print("=" * 50)
        print("\nPROMPT UNTUK AI (Copy-Paste ini):")
        print(f'"Pratinjau berhasil. Silakan jalankan ulang perintah dengan tambahan flag --apply untuk membuat file {filename}."')
    else:
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"[OK] Successfully generated {filename} at {target_dir}")
            try:
                from scope_guardian.scripts.scope_check import record_write
                record_write("auto_scaffolder", filepath, True)
            except Exception:
                pass
            print("\n" + "=" * 60)
            print("PROMPT UNTUK AI (Copy-Paste ini):")
            print(f'"Berdasarkan hasil Auto-Scaffolder di atas, tolong gunakan tool replace_file_content untuk mulai mengisi logika yang sesungguhnya di dalam {filename}."')
        except Exception as e:
            print(f"[FAIL] Error generating file: {e}")

def main():
    apply_mode = "--apply" in sys.argv
    check_task_state(is_apply=apply_mode)  # Block if pseudocode not approved
    
    if len(sys.argv) < 3:
        print("Usage: python scaffolder.py <react|api> <ComponentName> [target_dir] [--apply]")
        sys.exit(1)
        
    file_type = sys.argv[1]
    name = sys.argv[2]
    
    args = sys.argv[3:]
    apply_mode = "--apply" in args
    target_dir = args[0] if len(args) > 0 and args[0] != "--apply" else os.getcwd()
    
    generate_scaffold(file_type, name, target_dir, apply_mode)

if __name__ == "__main__":
    main()
