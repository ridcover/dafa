---
name: Smart Text Replacer (Pure Python)
description: Use this skill to safely replace strings or regex patterns across multiple files in a project. It uses pure Python for fast matching and provides mandatory dry-run previews and automatic backups before applying changes.
---

## Instructions for AI Agent

When you need to perform multi-file or token-intensive string replacements, use this skill instead of manually replacing content via `replace_file_content`. This is especially useful for refactoring names, updating URLs, or replacing specific terminology globally without reading the whole file into context.

**When to use this skill:**
- The user asks to rename a component, variable, or class globally.
- You need to replace a string across multiple files but want to preview the changes first to avoid false positives.
- The project is large and manual editing would exceed token limits.

**Command to run:**
```powershell
python .agents/skills/smart_replace/replace_text.py "<absolute_target_directory>" "<search_string>" "<replace_string>" [options]
```

**Options:**
- `--ext <ext>`: Comma-separated extensions to include (e.g. `js,jsx`).
- `--regex`: Treat `<search_string>` as a regular expression.
- `--whole-word`: Enforce word-boundary matching. (This is automatically set to `True` if `--regex` is not used).
- `--exclude <dir>`: Additional folders to exclude (node_modules, .git, etc are excluded by default).
- `--apply`: **CRITICAL FLAG**. Without this flag, the script runs in PREVIEW/DRY-RUN mode. 

**Workflow Guardrails:**
1. **ALWAYS** run the command *without* `--apply` first.
2. Review the preview output in your terminal log. Check for false positives.
3. Show the summary of the preview to the USER and ask for explicit confirmation.
4. ONLY after the USER confirms, run the exact same command again but append `--apply` to execute the changes. The script will automatically backup original files to `.backup_replace/`.

**Comparison with other skills:**
- Use `smart_search` to understand *context* (how a function is used).
- Use `smart_replace` to safely *mutate* code (rename, replace) based on patterns.
