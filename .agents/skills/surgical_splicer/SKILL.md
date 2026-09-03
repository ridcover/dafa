# Surgical Code Splicer

Extract a single function/class body from a file with ZERO context lines.

## When to Use

Use `splicer.py` when:
- You need to read ONE specific function in a massive file (2000+ lines)
- You want to save tokens - no surrounding context, just the function body
- You already know the exact function/class name

## Usage

```bash
python surgical_splicer/splicer.py <file_path> <function_name>
```

## Examples

```bash
# Extract Python function
python surgical_splicer/splicer.py mymodule.py process_data

# Extract JS function
python surgical_splicer/splicer.py utils.js handleClick

# Extract class
python surgical_splicer/splicer.py component.tsx MyComponent
```

## Supported Languages

- Python (.py) - uses AST parsing
- JavaScript/TypeScript/JSX (.js, .jsx, .ts, .tsx) - uses brace-counting

## Limitations

- JS/TS: template literals (`${...}`) and regex literals cause bail-out (falls back to no output)
- JSX: closing tags (`</div>`) cause bail-out
- Python: requires valid Python syntax

## Philosophy

**"Isolation over DRY"** - this tool copies extraction logic from smart_search rather than sharing a module. Prevents version coupling and allows independent evolution.
