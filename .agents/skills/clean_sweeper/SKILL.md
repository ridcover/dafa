---
name: Project Health & Residue Sweeper
description: Use this skill when the user asks you to scan for project health, technical debt, or leftover residue files across a repository. It runs a Python script that deeply scans the project for unused DBs, temporary folders, TODO/FIXME tags, and large commented code blocks.
---

## Instructions for AI Agent

When the user asks you to "bersihkan project", "cari residu", or check the health/tech debt of a project, use this skill to run a sweeping analysis.

## Usage

**Human-readable output:**
```bash
python .agents/skills/clean_sweeper/sweeper.py "<target_directory>"
```

**JSON output (machine-readable):**
```bash
python .agents/skills/clean_sweeper/sweeper.py "<target_directory>" --json
```

## What It Detects

| Type | Description |
|------|-------------|
| `backup_folder` | Suspected temp/backup folders (aa, arsip, temp, backup, old, scratch) |
| `leftover_file` | Files with .bak, .old, .log, .db, .tmp extensions |
| `local_sqlite` | Local SQLite DB in MySQL project |
| `todo_tags` | TODO/FIXME comments count |
| `large_comment_blocks` | 7+ consecutive commented lines |

## Output Format

### Human Output
```
CLEAN SWEEPER REPORT
==================================================
[FAIL] quarantine/old_code.js [Suspected Leftover File]
[WARN] Found 5 TODO/FIXME tags in the code.
[OK] Selesai memindai 150 file.
```

### JSON Output
```json
{
  "status": "NEEDS_CLEANUP",
  "stats": {
    "scanned_files": 150,
    "residue_files": 1,
    "todo_count": 5,
    "large_comment_blocks": 0,
    "total_issues": 2
  },
  "issues": {
    "residue_files": [{"path": "...", "type": "leftover_file", "description": "..."}],
    "todo_tags": 5,
    "large_comment_blocks": []
  }
}
```

## CRITICAL BEHAVIORAL RULE (VETO PROTOCOL)

1. **Never quarantine, move, or delete files automatically.**
2. Read the script output and present a clean summary to the user.
3. Explicitly ask: "Mana saja yang boleh saya hapus?"
4. Wait for user's explicit confirmation BEFORE executing any file modification.
