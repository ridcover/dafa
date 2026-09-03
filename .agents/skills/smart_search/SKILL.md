---
name: Smart Code Reference Finder
description: Use this skill when the user asks you to find WHERE a specific function, component, class, or variable is used across a project. This skill uses a Python script to extract the code blocks surrounding the keyword, providing you with full context (e.g. what props are passed, what variables surround it) instead of just single raw lines like standard grep.
---

## Instructions for AI Agent

When analyzing a codebase to find references, standard `grep_search` is often insufficient because it only returns the exact line containing the keyword, omitting critical surrounding logic.

**When to use this skill:**
- The user asks to find where a component/function is used.
- You need to know *how* a specific function is invoked across multiple files (what props/arguments are passed).
- You are refactoring a core module and need to see all its dependent implementations in context.

## Usage

**Human-readable output (default):**
```bash
python .agents/skills/smart_search/code_finder.py "<directory>" "<keyword>"
```

**Machine-readable output (JSON):**
```bash
python .agents/skills/smart_search/code_finder.py "<directory>" "<keyword>" --json
```

**With extension filter:**
```bash
python .agents/skills/smart_search/code_finder.py "<directory>" "<keyword>" --ext ".js,.jsx"
```

## Parameters

| Parameter | Description |
|-----------|-------------|
| `<directory>` | Directory to scan |
| `<keyword>` | Search keyword |
| `--ext` | Comma-separated extensions (e.g., `.js,.jsx`) |
| `--json` | Output as JSON (machine-readable) |

## Output Format

### Human Output
```
🔎 SEARCH RESULTS: 'handleSubmit'
================================================================
[WARN] Found in: src/components/Form.jsx
------------------------------------------------------------
   15 |     const [loading, setLoading] = useState(false);
   16 |     const navigate = useNavigate();
>> 17 |     const handleSubmit = async (data) => {
   18 |       setLoading(true);
   19 |       await api.post('/submit', data);
```

### JSON Output (--json)
```json
{
  "status": "FOUND",
  "keyword": "handleSubmit",
  "stats": {
    "total_matches": 3,
    "files_with_matches": 2,
    "scanned": 150
  },
  "results": [
    {
      "file": "src/components/Form.jsx",
      "absolute_path": "/path/to/src/components/Form.jsx",
      "matches": [
        {"line": 17, "content": "const handleSubmit = async (data) => {", "is_match": true},
        {"line": 18, "content": "setLoading(true);", "is_match": false}
      ]
    }
  ]
}
```
