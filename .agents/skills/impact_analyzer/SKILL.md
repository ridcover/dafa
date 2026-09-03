---
name: Impact Analyzer (Dependency Graph)
description: Analyzes the impact of modifying or deleting a specific file by tracing its import dependencies across the project.
---

# Impact Analyzer (Dependency Tracker)

**Description:**
This tool builds a reverse-dependency graph to tell you EXACTLY which files will be affected if you modify or delete a specific target file. Instead of manually searching for references, this tool traces imports recursively up to 3 levels deep.

**Usage Requirements:**
- Target file must be an absolute path.
- Project directory must be an absolute path.

**Command:**
```bash
python .agents/skills/impact_analyzer/analyzer.py <target_file_path> <project_root_dir>
```

**Output Format:**
- Level 1 (Direct Dependents): Files that directly import the target.
- Level 2 (Indirect Dependents): Files that import Level 1 files.

**Important Note:**
Always use this tool BEFORE deleting a core component, a utility function, or modifying a React Hook's signature. It prevents cascading errors.
