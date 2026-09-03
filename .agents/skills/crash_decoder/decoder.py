import os
import sys
import re

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')


def decode_crash(file_path):
    print("CRASH DECODER")
    print("=" * 60)

    if not os.path.exists(file_path):
        print(f"[FAIL] File not found: {file_path}")
        return

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Error detection: match Error: or Exception: or error: anywhere in line (case-insensitive).
        # Simple approach: error keywords are rare in clean log lines without : punctuation.
        # Captures: "Error:", "TypeError:", "RuntimeException:", "fatal error:", etc.
        error_re = re.compile(r'Error:|Exception:|error:', re.IGNORECASE)

        error_lines = []
        stack_lines = []

        for line in content.split('\n'):
            line_stripped = line.strip()
            if error_re.search(line_stripped):
                error_lines.append(line_stripped)
            elif line_stripped.startswith('at '):
                # Filter noise: skip node_modules and internal node scripts
                if 'node_modules' not in line_stripped and 'node:internal' not in line_stripped:
                    stack_lines.append(line_stripped)
            elif line_stripped.startswith('File "'):
                if 'site-packages' not in line_stripped and 'Python\\' not in line_stripped:
                    stack_lines.append(line_stripped)

        if not error_lines and not stack_lines:
            print("[WARN] No standard crash signature found in this log.")
            print("[INFO] Make sure you copy-pasted the entire stack trace.")
        else:
            print("[FAIL] CRASH DETECTED:\n")
            for e in error_lines[:3]:
                print(f"  <extracted_log>{e}</extracted_log>")

            if stack_lines:
                print("\n[INFO] RELEVANT SOURCE CODE TRACE (Noise Filtered):")
                for s in stack_lines[:5]:
                    print(f"  <extracted_trace>{s}</extracted_trace>")

            print("\n" + "=" * 60)
            print("PROMPT UNTUK AI:")
            print('"Based on Crash Decoder above, use view_file to check specific lines causing the error.')

    except Exception as e:
        print(f"[FAIL] Could not read log file: {e}")


def main():
    if len(sys.argv) < 2:
        print("Usage: python decoder.py <path_to_error_log.txt>")
        sys.exit(1)

    decode_crash(sys.argv[1])


if __name__ == "__main__":
    main()
