---
name: Context Mapper (Dependency Map)
description: Use this skill when entering a new project or when the user creates significant new architectural folders. It scans the project and generates a DEPENDENCY_MAP.md and COMMON_PATTERNS.md in the .agents/knowledge/ folder to give you instant architectural context without wasting tokens on manual search.
---

## Instructions for AI Agent

**When to use this skill:**
- When you first join a project and need to understand its structure and dependencies.
- When the user asks you to "map the context" or "build the knowledge catalog".
- When you or the user have added a massive new feature (e.g. adding a whole new `admin/` module) and the `DEPENDENCY_MAP.md` needs to be updated.

**Command to run:**
```powershell
python .agents/skills/context_mapper/context_mapper.py
```

**Expected Behavior & Next Steps:**
1. The script will output a success message indicating that the Knowledge Catalog has been built in `.agents/knowledge/`.
2. As a mandatory follow-up, you MUST use the `view_file` tool to read `.agents/knowledge/DEPENDENCY_MAP.md` and `.agents/knowledge/COMMON_PATTERNS.md` to update your mental model of the project.
3. If the user asks you to document a new coding convention, you should use `replace_file_content` to append it to `COMMON_PATTERNS.md`.
