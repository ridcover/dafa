import ast, sys, re

JS_PATTERNS = [
    r'(?:export\s+)?(?:async\s+)?function\s+\w+\s*\(',
    r'(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\([^)]*\)\s*=>',
    r'class\s+\w+',
]

def get_ranges(c):
    try:
        t = ast.parse(c)
        r = {}
        for n in ast.walk(t):
            if hasattr(n, "name"):
                r[n.name] = [n.lineno, n.end_lineno]
        return r
    except:
        return {}

def find_js_line(content, keyword):
    """
    Find the line number where a JS function/class with the keyword starts.
    Uses simple state machine to skip strings and comments.
    """
    lines = content.split('\n')
    for i, line in enumerate(lines):
        # Parse line character by character to handle strings/comments
        j = 0
        in_string = None  # None, '"', or "'"
        while j < len(line):
            ch = line[j]
            # Skip escaped characters
            if j > 0 and line[j-1] == '\\':
                j += 1
                continue
            # Handle string delimiters
            if ch == '"' or ch == "'":
                if in_string == ch:
                    in_string = None
                elif in_string is None:
                    in_string = ch
                j += 1
                continue
            # If we're in a string, just continue
            if in_string is not None:
                j += 1
                continue
            # Skip line comments
            if ch == '/' and j + 1 < len(line) and line[j+1] == '/':
                break  # Rest of line is comment
            # Check if keyword is present (before any comment)
            if keyword in line[:j]:
                # We found keyword before any comment, now check for JS pattern
                code_part = line[:j]
                for pat in JS_PATTERNS:
                    if re.search(pat, code_part):
                        return i
            j += 1
    return None

def extract_by_indentation(content, start_idx):
    """
    Fallback extraction using indentation levels.
    Counts leading spaces of the starting line, then finds where the block ends.
    Stops when finding a line whose stripped version starts with '}'
    AND whose indentation level is <= the starting indentation level.
    """
    lines = content.split('\n')
    if start_idx >= len(lines):
        return None

    # Get the indentation level of the starting line
    start_line = lines[start_idx]
    start_indent = len(start_line) - len(start_line.lstrip())

    # Find the end of the block
    end_idx = start_idx
    while end_idx < len(lines):
        line = lines[end_idx]
        stripped = line.strip()

        # Check if this line starts with '}' and is at or below start indent
        if stripped.startswith('}'):
            line_indent = len(line) - len(line.lstrip())
            if line_indent <= start_indent:
                return (start_idx, end_idx)

        end_idx += 1

    return None

def extract_js_body(content, start_idx):
    """
    Extract function/class body using brace-counting state machine.

    BAIL-OUT STRATEGY:
    - Returns None immediately when encountering:
      - Backtick (`) - template literal (can't track ${} interpolation safely)
      - Forward slash (/) in ambiguous context - can't distinguish from regex/division
    - Falls back to line-context behavior in caller.

    PAREN-DEPTH TRACKING:
    - Tracks paren depth ( ) alongside brace depth
    - Only starts counting braces toward function-body depth AFTER
      the parameter list's parentheses have fully closed (paren_depth = 0)
    - This correctly handles destructured params like function({ items }) { }
    """
    lines = content.split('\n')
    depth = 0          # Brace depth (for function body)
    paren_depth = 0    # Paren depth (for parameter list)
    body_started = False  # Set to True after first ')' closes param list
    found = False
    i = start_idx
    while True:
        if i >= len(lines):
            return None  # EOF with depth > 0
        line = lines[i]
        j = 0
        in_string = None  # None, '"', or "'"
        while j < len(line):
            ch = line[j]

            # Handle escape characters INSIDE strings only
            if in_string and j > 0 and line[j-1] == '\\':
                j += 1
                continue

            # Handle string delimiters
            if ch == '"' or ch == "'":
                if in_string == ch:
                    in_string = None
                elif in_string is None:
                    in_string = ch
                j += 1
                continue

            # Skip rest of line if in string
            if in_string is not None:
                j += 1
                continue

            # Handle comments FIRST (before slash bail-out)
            if ch == '/':
                if j + 1 < len(line) and line[j+1] == '/':
                    # Line comment - safe, skip to end of line
                    break
                elif j + 1 < len(line) and line[j+1] == '*':
                    # Block comment - safe, skip the block
                    end = line.find('*/', j+2)
                    if end >= 0:
                        lines[i] = line[:j] + line[end+2:]
                        # After splicing, break to next line to avoid
                        # reprocessing the remaining '/' from '/*'
                        break
                    else:
                        i += 1
                        while i < len(lines):
                            end = lines[i].find('*/')
                            if end >= 0:
                                lines[i] = lines[i][end+2:]
                                break
                            i += 1
                        else:
                            return None
                        # After processing multi-line block comment, move to next line
                        break
                else:
                    # Check for safe JSX slashes
                    if j > 0 and line[j-1] == '<' and j + 1 < len(line) and (line[j+1].isalpha() or line[j+1] == '>'):
                        pass # Safe JSX closing tag (including <></>)
                    elif j + 1 < len(line) and line[j+1] == '>' and j > 0 and line[j-1] not in '<>=-+*':
                        pass # Safe JSX self-closing tag
                    else:
                        # Ambiguous slash - could be regex or division
                        return None  # BAIL-OUT

            # BAIL-OUT: Template literal start
            if ch == '`':
                return None  # Template literal - can't track safely

            # Track parentheses first (before braces)
            if ch == '(':
                paren_depth += 1
            elif ch == ')':
                paren_depth -= 1
                if paren_depth == 0 and not body_started:
                    # First closing paren after opening - param list is done
                    body_started = True

            # Track braces (only after param list is closed)
            if ch == '{':
                if body_started:
                    depth += 1
                    found = True
            elif ch == '}':
                if body_started:
                    depth -= 1
                    if depth < 0:
                        return None  # Excess closing brace
                    if depth == 0 and found:
                        return (start_idx, i)
            j += 1
        i += 1
    return None

def splice(fp, fn):
    try:
        with open(fp, encoding='utf-8') as f:
            c = f.read()
    except Exception as e:
        sys.stderr.write(f"[ERROR] {e}\n")
        return
    lines = c.split("\n")
    if fp.endswith(".py"):
        res = get_ranges(c)
        if fn in res:
            s, e = res[fn]
            for i in range(s - 1, e):
                print(lines[i])
            return
    js_exts = [".js", ".jsx", ".ts", ".tsx"]
    if any(fp.endswith(ext) for ext in js_exts):
        start = find_js_line(c, fn)
        if start is not None:
            # Try primary extraction first
            body = extract_js_body(c, start)
            if body is None:
                # Fallback to indentation-based extraction
                body = extract_by_indentation(c, start)
                if body:
                    sys.stderr.write(f"[FALLBACK: indentation-based, verify manually]\n")
            if body:
                s, e = body
                for i in range(s, e + 1):
                    print(lines[i])
                return
            # Both failed - Plan C: print 50 lines of context
            sys.stderr.write(f"[FALLBACK: line-context, not full-body extraction] Printing 50 lines context.\n")
            for i in range(start, min(start + 50, len(lines))):
                print(lines[i])
            return
    sys.stderr.write(f"[ERROR] {fn} not found\n")

if __name__ == "__main__":
    if len(sys.argv) == 3:
        splice(sys.argv[1], sys.argv[2])
