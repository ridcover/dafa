---
name: Deep Analyzer (Project Profiler)
description: Use this skill to automatically extract project tech stack, dependencies, test commands, and file statistics without manually reading package.json or config files, saving tokens and time.
---

## Instructions for AI Agent

**When to use this skill:**
- When the user asks you to "analyze the project" or "find potential bugs" and you need to know what test scripts are available.
- When you first enter a new project and need to know the Tech Stack (e.g. React vs Vue, Vite vs Next.js).
- When you want to see what dependencies are installed without wasting 1000+ tokens reading the entire `package.json`.

**Command to run:**
```powershell
python .agents/skills/deep_analyzer/analyzer.py
```

**Expected Behavior & Next Steps:**
1. The script will output the Tech Stack, available NPM/Yarn commands (like `npm run test`), core dependencies, and directory statistics.
2. If a test script like `npm run test` or `npm run lint` is found, you can use `run_command` to execute it to find potential bugs!
3. NEVER read `package.json` manually using `view_file` unless you specifically need to modify a version number. Always use `analyzer.py` to get the overview.
