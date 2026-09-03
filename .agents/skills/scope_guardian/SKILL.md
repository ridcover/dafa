---
name: Scope Guardian (Hybrid Validation)
description: Active validation script to enforce file scope limits and prevent agents from modifying out-of-scope files.
---
# Scope Guardian v2 (Hybrid Validation)

This skill provides an automated, code-enforced mechanism to guarantee that the agent only accesses or modifies files within the explicitly defined scope of the current task. 

## Workflow Requirements
1. **Initialize Task Scope**: Before touching any files, the agent MUST create a `.agents/scope_lock.json` file in the project root.
2. **Mandatory Check**: Before reading (unless for quick read-only dependency checks) or modifying any file, the agent MUST run `python .agents/skills/scope_guardian/scripts/scope_check.py <target_file>`.
3. **Strict Adherence**: If the script returns `[BLOCKED]`, the agent MUST immediately stop, notify the user, and request explicit permission to expand the scope.

## Creating `scope_lock.json`
```json
{
  "task": "Task description here",
  "allowed_files": [
    "path/to/specific/file.js"
  ],
  "allowed_patterns": [],
  "created_at": "YYYY-MM-DDTHH:MM:SS"
}
```

## Running Validation
`python .agents/skills/scope_guardian/scripts/scope_check.py "path/to/file.js"`
