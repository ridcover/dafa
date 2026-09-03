---
name: Auto-Scaffolder (Pattern Generator)
description: Use this skill to automatically generate boilerplate code for new React components or API routes perfectly matching the project's standards.
---

## Instructions for AI Agent

**When to use this skill:**
- When the user asks you to "create a new page", "make a new component", or "add a new API route".
- **NEVER use write_to_file to write a component from scratch manually.** Always generate the boilerplate first using this tool.

**Command to run:**
```powershell
# For React Components
python .agents/skills/auto_scaffolder/scaffolder.py react "MyComponent" "src/view/admin/my_feature"

# For API Routes
python .agents/skills/auto_scaffolder/scaffolder.py api "my_route" "src/backend/routes"
```

**Expected Behavior & Next Steps:**
1. The tool will create the file instantly with proper imports and structure.
2. Once generated, you can then use `replace_file_content` to inject the specific logic requested by the user into the generated boilerplate.
