import sys
import json
import hashlib
import os

HISTORY_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".history")
MAX_REPEATS = 3

def main():
    try:
        input_data = json.load(sys.stdin)
    except Exception as e:
        print(json.dumps({"decision": "deny", "reason": f"Input tidak valid: {e}"}))
        return

    conv_id = input_data.get("conversationId", "unknown")
    tool_call = input_data.get("toolCall", {})
    
    os.makedirs(HISTORY_DIR, exist_ok=True)
    
    # Buat hash deterministik dari argumen tool
    payload_str = json.dumps(tool_call, sort_keys=True)
    action_hash = hashlib.sha256(payload_str.encode('utf-8')).hexdigest()
    
    history_file = os.path.join(HISTORY_DIR, f"{conv_id}.json")
    
    if os.path.exists(history_file):
        try:
            with open(history_file, "r", encoding='utf-8') as f:
                history = json.load(f)
        except:
            history = []
    else:
        history = []
        
    history.append(action_hash)
    
    with open(history_file, "w", encoding='utf-8') as f:
        json.dump(history, f)
        
    # C4 Check: Apakah 3 eksekusi terakhir identik?
    if len(history) >= MAX_REPEATS:
        recent = history[-MAX_REPEATS:]
        if len(set(recent)) == 1:
            print(json.dumps({
                "decision": "deny",
                "reason": f"[BLOCKED] Loop Detector (C4): Terdeteksi {MAX_REPEATS} eksekusi tool beruntun yang identik! Eksekusi dihentikan paksa untuk mencegah infinite loop."
            }))
            return
            
    # Jika aman, izinkan eksekusi
    print(json.dumps({"decision": "allow"}))

if __name__ == "__main__":
    main()
