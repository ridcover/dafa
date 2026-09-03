---
name: Project Guardian (Security & Health Auditor)
description: Use this skill when the user asks you to audit the project for security leaks, secret credentials, vulnerable dependencies, or environment file (.gitignore) issues.
---

## Instructions for AI Agent

When the user asks you to "audit project", "cek keamanan", or "jalankan project guardian", use this tool to scan the repository.

## Usage

**Basic scan (human-readable):**
```bash
python .agents/skills/project_guardian/guardian.py
```

**Summary only:**
```bash
python .agents/skills/project_guardian/guardian.py --summary
```

**JSON output (machine-readable, for agentic processing):**
```bash
python .agents/skills/project_guardian/guardian.py --json
```

## Modules Scanned

| Module | Checks | Severity |
|--------|--------|----------|
| **SECRET_SCANNER** | Hardcoded passwords, API keys, secrets | CRITICAL |
| **ENV_GITIGNORE** | .env files missing from .gitignore | HIGH |
| **PHYSICAL_IMPORT** | Broken relative imports | HIGH |
| **NPM_AUDIT** | Security vulnerabilities in dependencies | CRITICAL/HIGH |
| **UNUSED_PACKAGES** | Installed but unused packages | LOW |
| **ENV_KEYS** | process.env keys missing from .env.example | MEDIUM |

## Output Format

### Human-readable Output
```
GUARDIAN AUDITOR
--- MODULE 1: SECRET SCANNER ---
[CRITICAL] src/config.js:45 - Hardcoded password

--- MODULE 2: ENV & GITIGNORE ---
[HIGH] .env - File .env is missing from .gitignore
```

### JSON Output (--json flag)
```json
{
  "status": "FAIL",
  "summary": {
    "critical": 1,
    "high": 2,
    "medium": 0,
    "low": 1,
    "total_issues": 4
  },
  "modules": {
    "secret_scanner": [
      {
        "severity": "CRITICAL",
        "module": "SECRET_SCANNER",
        "file": "src/config.js",
        "line": 45,
        "issue": "Hardcoded password",
        "snippet": "password: 'admin123'"
      }
    ],
    "env_gitignore": [...],
    "npm_audit": [...],
    ...
  }
}
```

## Severity Levels

| Level | Meaning | Action Required |
|-------|---------|-----------------|
| **CRITICAL** | Security breach risk | Fix immediately |
| **HIGH** | Significant risk | Fix soon |
| **MEDIUM** | Potential issue | Review when convenient |
| **LOW** | Minor issue | Can ignore |

## CRITICAL BEHAVIORAL RULE

1. Present the findings clearly to the user.
2. Group by severity: Fix CRITICAL > HIGH > MEDIUM > LOW
3. **Do NOT automatically fix or modify files.** Ask the user which items they want you to fix first.
4. When using --json, the agent can programmatically parse findings and suggest fixes.
