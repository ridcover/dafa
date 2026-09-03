---
name: Database Schema Extractor (db_extractor)
description: Use this skill when you need to understand the database schema of a project (tables, columns, types, relations) without running raw SQL queries manually in the terminal. It parses `.env` to connect to MySQL/MariaDB or falls back to static code analysis for NoSQL (Firebase, MongoDB) and unknown DBs.
---

# Database Schema Extractor

When a task requires you to interact with the database, DO NOT guess table names or run raw `SHOW TABLES` / `DESCRIBE` queries manually via terminal, as this risks formatting issues and consumes too many tokens.

ALWAYS use this `db_extractor` tool first to get a clean Markdown representation of the database schema.

## Usage
Run the script using Python, passing the path to the project root (where the `.env` file and source code reside).

```bash
python .agents/skills/db_extractor/scripts/extractor.py <project_root_dir>
```

### Examples:
Extract schema for the current project:
```bash
python .agents/skills/db_extractor/scripts/extractor.py .
```

Extract schema for a specific backend folder:
```bash
python .agents/skills/db_extractor/scripts/extractor.py src/backend
```

## How It Works
1. **Network Extraction**: It reads the `.env` file (looking for `DB_CONNECTION`). If it's a supported SQL database (like MySQL) and the Python driver is available, it connects and generates a Markdown table of the schema.
2. **Static Analysis Fallback**: If the database is NoSQL (e.g., Firebase, MongoDB), unknown, or the connection fails, the tool automatically switches to **Static Code Analysis Mode**. It scans the project's source code for Prisma files or Model directories (`lib/models`, `app/Models`, etc.) to reconstruct the schema purely from code. This guarantees you will always get structural context!
