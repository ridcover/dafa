---
name: Selective File Reader (TOC Generator)
description: Use this skill when you need to inspect a large file but don't want to waste tokens reading the entire file. This script parses the file using regex heuristics and returns a Table of Contents with exact line numbers for all functions, components, and classes.
---

## Instructions for AI Agent

Reading massive files (800+ lines) blindly wastes context limits and degrades performance.

**When to use this skill:**
Before reading any JS/React/Py file that you suspect is large, or when the user asks you to "inspect" or "modify" a specific function within a file, use this skill to generate a "Table of Contents" (TOC) of that file first.

## Usage

**Human-readable output (default):**
```bash
python .agents/skills/selective_reader/reader.py "<filepath>"
```

**Machine-readable output (JSON):**
```bash
python .agents/skills/selective_reader/reader.py "<filepath>" --json
```

## Output Format

### Human Output
```
📄 TABLE OF CONTENTS: MyComponent.jsx
--------------------------------------------------
Line 12   : Class: MyComponent
Line 25   : Function: render
Line 48   : Arrow Function: handleClick
Line 89   : Arrow Function: useEffect
--------------------------------------------------

💡 PROMPT:
"Based on the TOC above, please use view_file tool..."
```

### JSON Output (--json)
```json
{
  "file": "MyComponent.jsx",
  "absolute_path": "/path/to/MyComponent.jsx",
  "stats": {
    "total_items": 4,
    "classes": 1,
    "functions": 1,
    "arrow_functions": 2
  },
  "toc": [
    {"line": 12, "type": "Class", "name": "MyComponent"},
    {"line": 25, "type": "Function", "name": "render"},
    {"line": 48, "type": "Arrow Function", "name": "handleClick"},
    {"line": 89, "type": "Arrow Function", "name": "useEffect"}
  ]
}
```

## Known Limitations

**Monolithic JSX Components**: The regex currently only detects function and class declarations. If a file contains a single massive React component returning a huge block of JSX, the TOC will only show the top-level function.

## Usage Example

1. Run TOC generator: `python reader.py src/App.jsx`
2. Review TOC output
3. Read specific section: `view_file` from line X to Y
