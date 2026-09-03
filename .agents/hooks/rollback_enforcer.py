import sys
import json
import subprocess

def main():
    try:
        input_data = json.load(sys.stdin)
    except Exception:
        print(json.dumps({}))
        return

    reason = input_data.get("terminationReason", "")
    error_msg = input_data.get("error", "")
    
    # Deteksi apakah agen berhenti karena kegagalan atau diputus oleh Loop Detector
    if reason == "error" or error_msg:
        workspace_paths = input_data.get("workspacePaths", [])
        if workspace_paths:
            target_cwd = workspace_paths[0]
            try:
                # Lakukan suksesi aman: Simpan pekerjaan yang gagal ke stash alih-alih menghapusnya
                subprocess.run(["git", "stash", "push", "-u", "-m", "Auto-stash oleh Agent Rollback Enforcer"], cwd=target_cwd, capture_output=True)
            except Exception:
                pass
                
    # Biarkan agen berhenti secara natural
    print(json.dumps({}))

if __name__ == "__main__":
    main()
