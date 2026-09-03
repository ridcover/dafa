---
name: Error Trace Analyzer (Crash Decoder)
description: Use this skill to parse huge raw error logs (stack traces, npm test failures, backend crashes) and instantly find which specific lines in the source code caused the problem, ignoring node_modules noise.
---

## Instructions for AI Agent

**When to use this skill:**
- When the user pastes a massive terminal error.
- When `npm run test` or `npm run dev` fails with a huge traceback.
- **NEVER read raw tracebacks manually.** Always save the user's terminal output to a temporary `.txt` file in the workspace, then run this tool.

**Command to run:**
```powershell
# 1. Save the error to a temporary file (e.g. error.log)
# 2. Run the decoder:
python .agents/skills/crash_decoder/decoder.py "error.log"
```

**Expected Behavior & Next Steps:**
1. The tool will output the exact `Error` message and the top 5 relevant file paths and line numbers (e.g. `at Object.<anonymous> (src/index.js:42:15)`).
2. After seeing the exact line number, use `view_file` to read that specific line range.
3. Fix the bug.
