---
name: Smart Import Fixer
description: Use this skill to automatically find and fix broken relative imports (e.g. ones reported by Project Guardian).
---

## Instructions for AI Agent

**When to use this skill:**
- When Project Guardian reports `Relative import '../services/api' does not exist physically!`.
- **NEVER use grep to manually hunt for the correct path.** Let this tool compute the exact relative path (`../../`) automatically.

**Command to run:**
```powershell
# 1. Dry Run (Preview the correct path)
python .agents/skills/import_fixer/fixer.py "src/backend/routes/user.js" "../services/api"

# 2. Apply Changes (Actually fixes the file)
python .agents/skills/import_fixer/fixer.py "src/backend/routes/user.js" "../services/api" --apply
```

**Expected Behavior:**
1. The tool will search the entire project for the basename (`api.js` or `api.jsx`).
2. It will compute the exact relative path from the `source_file` to the `target_file`.
3. If `--apply` is used, it safely backs up the file and rewrites the import string.
