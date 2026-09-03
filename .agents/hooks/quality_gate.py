from datetime import datetime
import re

def detect_shell_write(cmd: str):
    """
    Deteksi best-effort perintah shell yang berpotensi menulis berkas.
    CATATAN: Deteksi ini bersifat heuristik/best-effort dan tidak mencakup
    seluruh cara penulisan berkas pada lingkungan shell kompleks.
    
    Mengenali:
    - PowerShell: Set-Content, Out-File, Add-Content, Tee-Object
    - Shell redirections: >, >>, tee
    - Python one-liner: python -c dengan open(..., 'w'/'a')
    """
    cmd_clean = cmd.strip()
    
    # 1. PowerShell cmdlets
    ps_match = re.search(r'\b(Set-Content|Out-File|Add-Content|Tee-Object)\b(?:\s+(?:-Path\s+)?[\'"]?([^\s\'"]+)[\'"]?)?', cmd_clean, re.IGNORECASE)
    if ps_match:
        target = ps_match.group(2) or "shell_output"
        return True, target

    # 2. Python one-liner with write
    if "python" in cmd_clean and "-c" in cmd_clean and re.search(r'open\s*\(\s*[\'"][^\'"]+[\'"]\s*,\s*[\'"][wa]', cmd_clean):
        py_match = re.search(r'open\s*\(\s*[\'"]([^\'"]+)[\'"]', cmd_clean)
        target = py_match.group(1) if py_match else "python_script_target"
        return True, target

    # 3. Redirections (> or >>)
    redir_match = re.search(r'(?<![=\-\d])>{1,2}\s*[\'"]?([a-zA-Z0-9_\-\.\/\\~]+)[\'"]?', cmd_clean)
    if redir_match:
        target = redir_match.group(1)
        return True, target

    # 4. Pipe to tee
    tee_match = re.search(r'\|\s*tee(?:\s+-a)?\s+[\'"]?([^\s\'"]+)[\'"]?', cmd_clean, re.IGNORECASE)
    if tee_match:
        target = tee_match.group(1) or "tee_output"
        return True, target

    return False, ""

def record_shell_write(target_cwd: str, target_file: str, cmd_str: str):
    """Mencatat aktivitas penulisan berkas via shell ke write_log.jsonl."""
    agents_dir = os.path.join(target_cwd, ".agents")
    os.makedirs(agents_dir, exist_ok=True)
    log_file = os.path.join(agents_dir, "write_log.jsonl")
    
    lock_file = os.path.join(agents_dir, "scope_lock.json")
    task_name = ""
    in_scope = False
    if os.path.exists(lock_file):
        try:
            with open(lock_file, "r", encoding="utf-8-sig") as f:
                s_data = json.load(f)
            task_name = s_data.get("task", "")
            allowed_files = [f.replace("\\", "/").lower() for f in s_data.get("allowed_files", [])]
            target_norm = target_file.replace("\\", "/").lower()
            if target_norm in allowed_files or any(target_norm.endswith("/" + a) or os.path.basename(target_norm) == a for a in allowed_files):
                in_scope = True
        except Exception:
            pass
            
    entry = {
        "waktu": datetime.now().isoformat(),
        "alat": "shell",
        "berkas": target_file.replace("\\", "/"),
        "dalam_lingkup": in_scope,
        "tugas": task_name or ""
    }
    
    try:
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception as e:
        pass

import sys
import json
import subprocess
import os
import shlex
import platform

# ---------------------------------------------------------------------------
# SAFE / READ-ONLY TOOLS FAST-PATH (Instant allow, zero latency)
# ---------------------------------------------------------------------------
SAFE_TOOLS = {
    "smart_search": "code_finder.py",
    "selective_reader": "reader.py",
    "smart_tree": "tree_viewer.py",
    "deep_analyzer": "analyzer.py",
    "crash_decoder": "decoder.py",
    "clean_sweeper": "sweeper.py",
    "impact_analyzer": "analyzer.py",
    "db_extractor": "extractor.py",
    "scope_guardian": "scope_check.py"
}

# Tools requiring approval (High Risk)
APPROVAL_REQUIRED_TOOLS = {
    "replace_text.py": {
        "tool_name": "smart_replace",
        "min_args": 3,  # <target_dir> <search_string> <replace_string>
        "usage": "python .agents/skills/smart_replace/replace_text.py <dir> <old_text> <new_text> [--apply]"
    },
    "scaffolder.py": {
        "tool_name": "auto_scaffolder",
        "min_args": 2,  # <react|api> <ComponentName>
        "usage": "python .agents/skills/auto_scaffolder/scaffolder.py <react|api> <ComponentName> [target_dir] [--apply]"
    },
    "fixer.py": {
        "tool_name": "import_fixer",
        "min_args": 2,  # <source_file> <broken_import>
        "usage": "python .agents/skills/import_fixer/fixer.py <source_file> <broken_import_string> [--apply]"
    },
    "context_mapper.py": {
        "tool_name": "context_mapper",
        "min_args": 0,
        "usage": "python .agents/skills/context_mapper/context_mapper.py [--apply]"
    }
}


def clean_target_cwd(workspace_paths):
    """Normalize workspace path cross-platform."""
    if not workspace_paths:
        return os.getcwd()
    target_cwd = workspace_paths[0]
    if target_cwd.startswith("file:///"):
        target_cwd = target_cwd[8:]
        if platform.system() != "Windows":
            target_cwd = "/" + target_cwd
        else:
            target_cwd = target_cwd.replace("%3A", ":").replace("/", "\\")
    return target_cwd


def validate_tool_intent(script_name: str, config: dict, args_list: list, cmd_str: str, target_cwd: str):
    """
    Run tool argument completeness and arity checks.
    Returns (is_valid: bool, error_reason: str).
    """
    tool_name = config["tool_name"]
    
    # Filter out flags like --apply, --regex, --whole-word to count positional args
    positional_args = [a for a in args_list if not a.startswith("--")]

    # 1. Parameter Completeness Check
    if len(positional_args) < config["min_args"]:
        return False, (
            f"[Quality Gate] Parameter kritis tidak lengkap untuk '{tool_name}'. "
            f"Diperlukan minimal {config['min_args']} argumen posisi, tetapi menerima {len(positional_args)}.\n"
            f"Format yang benar: {config['usage']}"
        )

    # Specific parameter checks
    if tool_name == "auto_scaffolder":
        scaffold_type = positional_args[0].lower() if positional_args else ""
        if scaffold_type not in ("react", "api"):
            return False, (
                f"[Quality Gate] Tipe scaffold '{scaffold_type}' tidak valid. "
                f"Pilihan yang didukung: 'react' atau 'api'.\n"
                f"Contoh: python .agents/skills/auto_scaffolder/scaffolder.py react UserProfile"
            )

    if tool_name == "smart_replace":
        if len(positional_args) >= 3:
            old_str = positional_args[1].strip('"').strip("'")
            if len(old_str.strip()) == 0:
                return False, "[Quality Gate] Target string pencarian (old_text) tidak boleh kosong."

    return True, ""


def check_arah6_guardian(target_cwd: str):
    """ARAH 6 Quality Gate: Validate git commits against Project Guardian."""
    guardian_script = os.path.join(target_cwd, ".agents", "skills", "project_guardian", "guardian.py")
    if not os.path.exists(guardian_script):
        return False, "[JEDA PAKSA - ARAH 6] project_guardian/guardian.py tidak ditemukan di workspace ini. Eksekusi ditolak karena audit tidak bisa dilakukan."

    try:
        result = subprocess.run(
            ["python", guardian_script, "--json"],
            cwd=target_cwd,
            capture_output=True,
            text=True
        )
        if result.stdout:
            try:
                guardian_out = json.loads(result.stdout)
                critical_count = guardian_out.get("summary", {}).get("critical", 0)
                if critical_count > 0:
                    return False, (
                        f"[JEDA PAKSA - ARAH 6] project_guardian menemukan {critical_count} isu CRITICAL! "
                        f"Anda dilarang melakukan commit sebelum memperbaikinya atau menyertakan penanda abaikan (// guardian-ignore)."
                    )
            except json.JSONDecodeError:
                return False, "[JEDA PAKSA - ARAH 6] Output guardian tidak valid (JSON error)."
        else:
            return False, f"[JEDA PAKSA - ARAH 6] project_guardian tidak menghasilkan output (returncode={result.returncode}, stderr={result.stderr})."
    except Exception as e:
        return False, f"[JEDA PAKSA - ARAH 6] Gagal memvalidasi repositori dengan project_guardian (Exception: {str(e)}). Eksekusi ditolak untuk mencegah commit tanpa audit."

    return True, ""


def main():
    try:
        input_data = json.load(sys.stdin)
    except Exception as e:
        print(json.dumps({"decision": "deny", "reason": f"Input tidak valid (gagal parse JSON): {e}"}))
        return

    tool_name = input_data.get("toolName", "")
    tool_call = input_data.get("toolCall", {})
    workspace_paths = input_data.get("workspacePaths", [])
    
    # Deteksi eksekusi shell command
    if tool_name == "run_command" or "CommandLine" in tool_call:
        cmd = tool_call.get("CommandLine", "").strip()
        
        # 1. Check ARAH 6 for git commit
        if "git commit" in cmd:
            if not workspace_paths:
                print(json.dumps({
                    "decision": "deny",
                    "reason": "[JEDA PAKSA - ARAH 6] Parameter workspacePaths tidak ditemukan dalam konteks hook. Eksekusi ditolak karena lingkungan gagal diverifikasi."
                }))
                return
                
            target_cwd = clean_target_cwd(workspace_paths)
            ok, reason = check_arah6_guardian(target_cwd)
            if not ok:
                print(json.dumps({"decision": "deny", "reason": reason}))
                return
            print(json.dumps({"decision": "allow"}))
            return

        # 2. Check Approval-Required Skills
        for script_name, config in APPROVAL_REQUIRED_TOOLS.items():
            if script_name in cmd:
                target_cwd = clean_target_cwd(workspace_paths) if workspace_paths else os.getcwd()
                try:
                    tokens = shlex.split(cmd, posix=(platform.system() != "Windows"))
                except Exception:
                    tokens = cmd.split()

                script_idx = -1
                for idx, tok in enumerate(tokens):
                    if script_name in tok:
                        script_idx = idx
                        break

                tool_args = tokens[script_idx + 1:] if script_idx != -1 else []
                is_valid, err_reason = validate_tool_intent(script_name, config, tool_args, cmd, target_cwd)
                
                if not is_valid:
                    print(json.dumps({"decision": "deny", "reason": err_reason}))
                    return
                # If valid, allow it
                print(json.dumps({"decision": "allow"}))
                return

        # 3. Fast-Path: Allow safe/read tools instantly
        for safe_tool, safe_script in SAFE_TOOLS.items():
            if safe_script in cmd:
                print(json.dumps({"decision": "allow"}))
                return

    # Catat jika terdeteksi penulisan berkas via shell (A3 - best effort, tidak memblokir)
    if tool_name == "run_command" or "CommandLine" in tool_call:
        cmd = tool_call.get("CommandLine", "").strip()
        target_cwd = clean_target_cwd(workspace_paths) if workspace_paths else os.getcwd()
        is_write, target_file = detect_shell_write(cmd)
        if is_write:
            record_shell_write(target_cwd, target_file, cmd)

    # Jika aman atau bukan shell command berisiko, izinkan eksekusi
    print(json.dumps({"decision": "allow"}))

if __name__ == "__main__":
    main()
