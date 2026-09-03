import os
import re
import sys
import json
import subprocess
import argparse
import hashlib
import time

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

exclude_dirs = {'.git', 'node_modules', 'vendor', 'dist', 'build', 'quarantine', '.backup_replace', '.agents', '.history', '.venv', 'scratch', 'tmp', '.dart_tool', '.gradle', '.pub-cache', 'Pods'}
js_py_exts = {'.js', '.jsx', '.ts', '.tsx', '.py'}
test_extensions = ('.test.js', '.test.jsx', '.test.ts', '.test.tsx',
                   '.spec.js', '.spec.jsx', '.spec.ts', '.spec.tsx', '.test.py')
test_dir_names = {'__tests__', 'test', 'tests'}
MAX_FILE_SIZE = 500 * 1024
target_dir = os.getcwd()

# Severity levels
SEVERITY = {
    'CRITICAL': 'CRITICAL',  # Security vulnerabilities, exposed credentials
    'HIGH': 'HIGH',          # Missing .gitignore, broken imports
    'MEDIUM': 'MEDIUM',      # Unused packages, missing env keys
    'LOW': 'LOW',            # Minor issues
    'INFO': 'INFO'           # Informational only
}

def get_dir_signature():
    mtimes = []
    for root, dirs, files in os.walk(target_dir):
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for f in files:
            filepath = os.path.join(root, f)
            try:
                if os.path.getsize(filepath) <= MAX_FILE_SIZE:
                    mtimes.append(str(os.path.getmtime(filepath)))
            except Exception:
                pass
    # Include guardian.py source hash to invalidate cache when the tool itself changes
    try:
        guardian_hash = hashlib.md5(open(__file__, 'rb').read()).hexdigest()
        mtimes.append(guardian_hash)
    except Exception:
        pass
    return hashlib.md5("".join(sorted(mtimes)).encode()).hexdigest()

def scan_secrets():
    """Scan for exposed credentials and secrets."""
    findings = []
    secret_patterns = [
        (r'(?i)(password\s*[:=]\s*[\'"](?!pass123|pass456|[\'"])[^\'"]+[\'"])', 'Hardcoded password'),
        (r'(?i)(api_key\s*[:=]\s*[\'"].+[\'"])', 'Hardcoded API key'),
        (r'(?i)(secret\s*[:=]\s*[\'"].+[\'"])', 'Hardcoded secret'),
        (r'(mongodb\+srv://.+)', 'MongoDB connection string'),
        (r'(mysql://.+)', 'MySQL connection string'),
        (r'(?i)(AIza[0-9A-Za-z_\-]{35})', 'Google API Key'),
        (r'(?i)(AKIA[0-9A-Z]{16})', 'AWS Access Key'),
        (r'(Bearer\s+[A-Za-z0-9\-\._~+/]{20,}=*)', 'Bearer token')
    ]
    compiled = [(re.compile(p), desc) for p, desc in secret_patterns]

    for root, dirs, files in os.walk(target_dir):
        dirs[:] = [d for d in dirs if d not in exclude_dirs and d not in test_dir_names]
        rel_root = os.path.relpath(root, target_dir)
        for file in files:
            if file.startswith('.env'): continue
            if file.endswith('.patch'): continue
            if file.endswith('.md'): continue  # Exclude documentation files to prevent false positives
            if 'mock' in rel_root.lower() or 'fixture' in rel_root.lower() or 'example' in rel_root.lower() or 'test' in rel_root.lower() or 'sample' in rel_root.lower(): continue # Exclude mock data dirs
            if 'mock' in file.lower() or 'fixture' in file.lower() or 'example' in file.lower() or 'sample' in file.lower(): continue # Exclude mock data files
            # Skip project_guardian tool itself (path-based, not just filename)
            if 'project_guardian' in root or 'project_guardian' in file: continue
            if file.endswith(test_extensions): continue
            filepath = os.path.join(root, file)
            if os.path.getsize(filepath) > MAX_FILE_SIZE:
                findings.append({
                    'severity': 'HIGH',
                    'module': 'SECRET_SCANNER',
                    'file': os.path.relpath(filepath, target_dir),
                    'line': 0,
                    'issue': 'tidak dipindai, terlalu besar',
                    'snippet': ''
                })
                continue
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    for line_num, line in enumerate(f, 1):
                        if 'guardian-ignore' in line.lower(): continue
                        for pattern, desc in compiled:
                            if pattern.search(line):
                                rel_path = os.path.relpath(filepath, target_dir)
                                severity = 'CRITICAL'
                                
                                # Entri 28: Kunci Firebase publik jangan diblokir (CRITICAL), turunkan ke HIGH
                                if desc == 'Google API Key':
                                    basename = os.path.basename(filepath)
                                    if basename in ['google-services.json', 'GoogleService-Info.plist', 'firebase_options.dart']:
                                        severity = 'HIGH'
                                        
                                findings.append({
                                    'severity': severity,
                                    'module': 'SECRET_SCANNER',
                                    'file': rel_path,
                                    'line': line_num,
                                    'issue': desc,
                                    'snippet': line.strip()[:100]
                                })
                                break
            except UnicodeDecodeError: pass
    return findings

def check_env_gitignore():
    """Check .gitignore coverage for env files."""
    fails = []
    warns = []

    gitignore_path = os.path.join(target_dir, '.gitignore')
    ignored = set()
    if os.path.exists(gitignore_path):
        with open(gitignore_path, 'r', encoding='utf-8') as f:
            ignored = set(line.strip() for line in f if line.strip() and not line.startswith('#'))

    # Root-level .env check: use git check-ignore for consistency with nested check
    for f in os.listdir(target_dir):
        if f.startswith('.env') and os.path.isfile(os.path.join(target_dir, f)) and f != '.env.example':
            full_path = os.path.join(target_dir, f)
            try:
                result = subprocess.run(
                    ['git', 'check-ignore', '-q', full_path],
                    capture_output=True, text=True, timeout=5
                )
                if result.returncode == 1:
                    fails.append({
                        'severity': 'HIGH',
                        'module': 'ENV_GITIGNORE',
                        'file': f,
                        'issue': f'File {f} is missing from .gitignore'
                    })
                elif result.returncode == 128:
                    fails.append({
                        'severity': 'HIGH',
                        'module': 'ENV_GITIGNORE',
                        'file': f,
                        'issue': f'File {f} is missing from .gitignore (git unavailable)'
                    })
            except (subprocess.TimeoutExpired, FileNotFoundError):
                # git not available — fall back to string-based check
                if f not in ignored and f"/{f}" not in ignored and "*.env" not in ignored and ".env*" not in ignored:
                    fails.append({
                        'severity': 'HIGH',
                        'module': 'ENV_GITIGNORE',
                        'file': f,
                        'issue': f'File {f} is missing from .gitignore'
                    })

    # Also check nested .env files (e.g. backend/.env) using git check-ignore
    # Skip root dir files — already checked by the root-level loop above
    for root, dirs, files in os.walk(target_dir):
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        if root == target_dir:
            continue
        for f in files:
            if f.startswith('.env') and f != '.env.example':
                full_path = os.path.join(root, f)
                rel_path = os.path.relpath(full_path, target_dir)
                try:
                    result = subprocess.run(
                        ['git', 'check-ignore', '-q', full_path],
                        capture_output=True, text=True, timeout=5
                    )
                    if result.returncode == 1:
                        fails.append({
                            'severity': 'HIGH',
                            'module': 'ENV_GITIGNORE',
                            'file': rel_path,
                            'issue': f'File {rel_path} is not in .gitignore'
                        })
                    elif result.returncode == 128:
                        fails.append({
                            'severity': 'HIGH',
                            'module': 'ENV_GITIGNORE',
                            'file': rel_path,
                            'issue': f'File {rel_path} is not in .gitignore (git unavailable)'
                        })
                except (subprocess.TimeoutExpired, FileNotFoundError):
                    fails.append({
                        'severity': 'HIGH',
                        'module': 'ENV_GITIGNORE',
                        'file': rel_path,
                        'issue': f'File {rel_path} is not in .gitignore (git unavailable)'
                    })

    env_ex = os.path.join(target_dir, '.env.example')
    ex_keys = set()
    if os.path.exists(env_ex):
        with open(env_ex, 'r', encoding='utf-8') as f:
            for line in f:
                if '=' in line and not line.startswith('#'):
                    ex_keys.add(line.split('=')[0].strip())

    used_keys = set()
    penv_pattern = re.compile(r'process\.env\.([A-Za-z0-9_]+)')
    for root, dirs, files in os.walk(target_dir):
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for file in files:
            if not any(file.endswith(ext) for ext in js_py_exts): continue
            filepath = os.path.join(root, file)
            if os.path.getsize(filepath) > MAX_FILE_SIZE: continue
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    for line in f:
                        for m in penv_pattern.findall(line): used_keys.add(m)
            except: pass

    for key in used_keys:
        if key not in ex_keys and key != 'NODE_ENV':
            warns.append({
                'severity': 'MEDIUM',
                'module': 'ENV_KEYS',
                'file': '.env.example',
                'issue': f'process.env.{key} is used but missing from .env.example'
            })
    return fails, warns

def check_physical_imports():
    """Check for broken relative imports."""
    findings = []
    # Match both single-line and multi-line imports (DOTALL allows . to match newlines)
    import_pattern = re.compile(r'(?:import\s+.*?\s+from\s+|require\()[\'"]([^\'"]+)[\'"]', re.DOTALL)

    for root, dirs, files in os.walk(target_dir):
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for file in files:
            if not any(file.endswith(ext) for ext in js_py_exts): continue
            filepath = os.path.join(root, file)
            if os.path.getsize(filepath) > MAX_FILE_SIZE: continue
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Strip comments but preserve newlines for accurate line numbers
                clean_content = re.sub(r'//.*', lambda m: ' ' * len(m.group(0)), content)
                clean_content = re.sub(r'#.*', lambda m: ' ' * len(m.group(0)), clean_content)
                clean_content = re.sub(r'/\*.*?\*/', lambda m: ''.join('\n' if c == '\n' else ' ' for c in m.group(0)), clean_content, flags=re.DOTALL)
                
                # Strip string literals that contain fake imports to avoid false positives (e.g. inside tests)
                def strip_fake_imports(m):
                    val = m.group(0)
                    if re.search(r'(?:import\s+.*?\s+from\s+|require\()', val):
                        return ''.join('\n' if c == '\n' else ' ' for c in val)
                    return val
                clean_content = re.sub(r'([\'"`])((?:(?!\1)[^\\]|\\.)*)\1', strip_fake_imports, clean_content, flags=re.DOTALL)

                # Find all imports (single or multi-line) with line number
                for match in import_pattern.finditer(clean_content):
                    import_str = match.group(1)
                    if import_str.startswith('.'):
                        dir_path = os.path.dirname(filepath)
                        target_p = os.path.normpath(os.path.join(dir_path, import_str))
                        found = False
                        for suffix in ['', '.js', '.jsx', '.ts', '.tsx', '/index.js', '/index.jsx']:
                            if os.path.exists(target_p + suffix):
                                found = True
                                break
                        if not found:
                            line_num = content[:match.start()].count('\n') + 1
                            line_start = content.rfind('\n', 0, match.start()) + 1
                            line_end = content.find('\n', match.end())
                            if line_end == -1: line_end = len(content)
                            snippet = content[line_start:line_end].strip()
                            rel = os.path.relpath(filepath, target_dir)
                            findings.append({
                                'severity': 'HIGH',
                                'module': 'PHYSICAL_IMPORT',
                                'file': rel,
                                'line': line_num,
                                'issue': f"Import '{import_str}' does not exist",
                                'snippet': snippet[:100]
                            })
            except: pass
    return findings

def check_dependencies():
    """Check for unused packages."""
    warns = []
    fails = []

    pkg_path = os.path.join(target_dir, 'package.json')
    if not os.path.exists(pkg_path): return warns, fails

    try:
        with open(pkg_path, 'r', encoding='utf-8') as f:
            pkg = json.load(f)
    except: return warns, fails

    deps = list(pkg.get('dependencies', {}).keys())
    used = set()
    # DOTALL allows . to match newlines, handling multi-line imports
    import_pattern = re.compile(r'(?:import\s+.*?\s+from\s+|require\()[\'"]([^\'"]+)[\'"]', re.DOTALL)

    for root, dirs, files in os.walk(target_dir):
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for file in files:
            if not any(file.endswith(ext) for ext in js_py_exts): continue
            filepath = os.path.join(root, file)
            if os.path.getsize(filepath) > MAX_FILE_SIZE: continue
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                clean_content = re.sub(r'//.*', lambda m: ' ' * len(m.group(0)), content)
                clean_content = re.sub(r'#.*', lambda m: ' ' * len(m.group(0)), clean_content)
                clean_content = re.sub(r'/\*.*?\*/', lambda m: ''.join('\n' if c == '\n' else ' ' for c in m.group(0)), clean_content, flags=re.DOTALL)

                for match in import_pattern.findall(clean_content):
                    pkg_name = match.split('/')[0]
                    if pkg_name.startswith('@'):
                        parts = match.split('/')
                        if len(parts) > 1: pkg_name = f"{parts[0]}/{parts[1]}"
                    used.add(pkg_name)
            except: pass

    for dep in deps:
        if dep not in used and not dep.startswith('@vite') and not dep.startswith('@babel') and not dep.startswith('react'):
            warns.append({
                'severity': 'LOW',
                'module': 'UNUSED_PACKAGE',
                'file': 'package.json',
                'issue': f"Package '{dep}' is installed but appears unused"
            })
    return warns, fails

def run_npm_audit(target):
    """Run npm audit for security vulnerabilities."""
    findings = []
    pkg_json = os.path.join(target, 'package.json')
    if not os.path.exists(pkg_json):
        findings.append({
            'severity': 'INFO',
            'module': 'NPM_AUDIT',
            'file': 'package.json',
            'issue': 'package.json not found in root, npm audit skipped'
        })
        return findings

    try:
        result = subprocess.run('npm audit --json', shell=True, capture_output=True, text=True, check=False, cwd=target, timeout=30)
        try:
            audit_data = json.loads(result.stdout)
            vulns = audit_data.get('metadata', {}).get('vulnerabilities', {})
            high = vulns.get('high', 0)
            critical = vulns.get('critical', 0)
            if critical > 0:
                findings.append({
                    'severity': 'CRITICAL',
                    'module': 'NPM_AUDIT',
                    'file': 'package.json',
                    'issue': f'npm audit detected {critical} CRITICAL vulnerabilities'
                })
            if high > 0:
                findings.append({
                    'severity': 'HIGH',
                    'module': 'NPM_AUDIT',
                    'file': 'package.json',
                    'issue': f'npm audit detected {high} HIGH vulnerabilities'
                })
        except: pass
    except: pass
    return findings

def get_npm_audit_signature():
    pkg_lock = os.path.join(target_dir, 'package-lock.json')
    mtime = os.path.getmtime(pkg_lock) if os.path.exists(pkg_lock) else 0
    try:
        guardian_hash = hashlib.md5(open(__file__, 'rb').read()).hexdigest()
    except Exception:
        guardian_hash = "unknown"
    return f"{mtime}_{time.time() // 86400}_{guardian_hash}"

def print_human_output(all_findings, total_fails, total_warns):
    """Print human-readable output."""
    print("\n--- MODULE 1: SECRET SCANNER ---")
    for f in all_findings.get('SECRET_SCANNER', []):
        print(f"[{f['severity']}] {f['file']}:{f['line']} - {f['issue']}")

    print("\n--- MODULE 2: ENV & GITIGNORE ---")
    for f in all_findings.get('ENV_GITIGNORE', []):
        print(f"[HIGH] {f['file']} - {f['issue']}")

    print("\n--- MODULE 3: PHYSICAL IMPORTS ---")
    for f in all_findings.get('PHYSICAL_IMPORT', []):
        print(f"[HIGH] {f['file']}:{f['line']} - {f['issue']}")

    print("\n--- MODULE 4: DEPENDENCIES ---")
    for f in all_findings.get('NPM_AUDIT', []):
        severity_tag = 'CRITICAL' if f['severity'] == 'CRITICAL' else 'HIGH'
        print(f"[{severity_tag}] {f['issue']}")
    for w in all_findings.get('UNUSED_PACKAGE', []):
        print(f"[LOW] {w['issue']}")

    print("\n" + "=" * 60)
    print(f"RINGKASAN: CRITICAL={all_findings.get('CRITICAL_COUNT', 0)} | HIGH={all_findings.get('HIGH_COUNT', 0)} | MEDIUM={all_findings.get('MEDIUM_COUNT', 0)} | LOW={all_findings.get('LOW_COUNT', 0)}")

def main():
    parser = argparse.ArgumentParser(description="Project Guardian - Security & Health Auditor")
    parser.add_argument("--summary", action="store_true", help="Only show final score")
    parser.add_argument("--json", action="store_true", help="Output as JSON (machine-readable)")
    args = parser.parse_args()

    global target_dir
    target_dir = os.path.abspath(os.getcwd())
    cache_file = os.path.join(target_dir, '.agents', 'session_cache.json')
    dir_sig = get_dir_signature()
    cache_key = f"guardian_{hashlib.md5(target_dir.encode()).hexdigest()}"
    audit_sig = get_npm_audit_signature()

    cache_data = {}
    if os.path.exists(cache_file):
        try:
            with open(cache_file, 'r', encoding='utf-8') as f: cache_data = json.load(f)
        except: pass

    cached_data = cache_data.get(cache_key, {})

    # Run scans
    if cached_data.get('signature') == dir_sig:
        sec_findings = cached_data.get('sec_findings', [])
        env_fails, env_warns = cached_data.get('env_fails', []), cached_data.get('env_warns', [])
        imp_findings = cached_data.get('imp_findings', [])
        dep_warns, dep_fails = cached_data.get('dep_warns', []), cached_data.get('dep_fails', [])
    else:
        sec_findings = scan_secrets()
        env_fails, env_warns = check_env_gitignore()
        imp_findings = check_physical_imports()
        dep_warns, dep_fails = check_dependencies()
        cached_data.update({
            'signature': dir_sig,
            'sec_findings': sec_findings, 'env_fails': env_fails, 'env_warns': env_warns,
            'imp_findings': imp_findings, 'dep_warns': dep_warns, 'dep_fails': dep_fails
        })

    if cached_data.get('audit_signature') == audit_sig:
        audit_findings = cached_data.get('audit_findings', [])
    else:
        if not args.summary and not args.json: print("\nRunning npm audit (this may take a while)...")
        audit_findings = run_npm_audit(target_dir)
        cached_data.update({'audit_signature': audit_sig, 'audit_findings': audit_findings})

    cache_data[cache_key] = cached_data
    try:
        os.makedirs(os.path.dirname(cache_file), exist_ok=True)
        with open(cache_file, 'w', encoding='utf-8') as f: json.dump(cache_data, f, indent=2)
    except: pass

    # Build all findings with counts
    all_findings = {
        'SECRET_SCANNER': sec_findings,
        'ENV_GITIGNORE': env_fails,
        'ENV_KEYS': env_warns,
        'PHYSICAL_IMPORT': imp_findings,
        'NPM_AUDIT': audit_findings,
        'UNUSED_PACKAGE': dep_warns,
        'DEP_INSTALL': dep_fails,
        'CRITICAL_COUNT': len([f for f in sec_findings if f.get('severity') == 'CRITICAL']) + len([f for f in audit_findings if f.get('severity') == 'CRITICAL']),
        'HIGH_COUNT': len([f for f in sec_findings if f.get('severity') == 'HIGH']) + len(env_fails) + len(imp_findings) + len([f for f in audit_findings if f.get('severity') == 'HIGH']),
        'MEDIUM_COUNT': len(env_warns),
        'LOW_COUNT': len(dep_warns),
    }

    total_fails = all_findings['CRITICAL_COUNT'] + all_findings['HIGH_COUNT']
    total_warns = all_findings['MEDIUM_COUNT'] + all_findings['LOW_COUNT']

    if args.json:
        # JSON output (machine-readable)
        result = {
            'status': 'FAIL' if all_findings['CRITICAL_COUNT'] > 0 else 'PASS',
            'summary': {
                'critical': all_findings['CRITICAL_COUNT'],
                'high': all_findings['HIGH_COUNT'],
                'medium': all_findings['MEDIUM_COUNT'],
                'low': all_findings['LOW_COUNT'],
                'total_issues': total_fails + total_warns
            },
            'modules': {
                'secret_scanner': sec_findings,
                'env_gitignore': env_fails,
                'env_keys': env_warns,
                'physical_import': imp_findings,
                'npm_audit': audit_findings,
                'unused_packages': dep_warns
            }
        }
        print(json.dumps(result, indent=2))
    elif args.summary:
        print(f"GUARDIAN SUMMARY: CRITICAL={all_findings['CRITICAL_COUNT']} | HIGH={all_findings['HIGH_COUNT']} | MEDIUM={all_findings['MEDIUM_COUNT']} | LOW={all_findings['LOW_COUNT']}")
    else:
        print("GUARDIAN AUDITOR")
        print_human_output(all_findings, total_fails, total_warns)
        print("\n💡 PROMPT:")
        print('"Fix all CRITICAL and HIGH severity issues first."')

if __name__ == '__main__':
    main()
