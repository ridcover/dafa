<!-- Label ini menjawab satu pertanyaan: kalau aturan ini dilanggar, apakah
     ada yang menahan? MENGIKAT = ditolak oleh kode. ANJURAN = tidak ada yang
     menahan, dan pelanggarannya tidak terdeteksi. Jangan disamakan. -->

> **MENGIKAT** — ditegakkan di `scope_guardian/scripts/scope_check.py` dan
> `smart_replace/replace_text.py:39` (`check_scope`). Berkas di luar
> `allowed_files` **ditolak**, bukan sekadar diperingatkan. Tanpa
> `scope_lock.json`, penulisan diblokir sama sekali (gagal-tertutup).

## Scope Guardian v2 â€” Hybrid Validation (MANDATORY)

To prevent the agent from accidentally modifying files outside the context of the current task, you MUST follow this strict procedure:

1. **Create `scope_lock.json` at Task Start:**
   Before touching any files for a significant task, create `.agents/scope_lock.json` in the project root:
   ```json
   {
     "task": "Fix shadow on Homepage cards",
     "allowed_files": [
       "src/view/siswa/components/HeroCard.jsx"
     ],
     "allowed_patterns": [],
     "created_at": "YYYY-MM-DDTHH:MM:SS"
   }
   ```
   (Only use `allowed_patterns` if absolutely necessary, keep it strict).

2. **Run `scope_check.py` Validation Before File Modification:**
   Before opening or modifying ANY file (via text replacement, editing, or viewing logic), you MUST run:
   `python .agents/skills/scope_guardian/scripts/scope_check.py "<file_path>"`

3. **Strict Blocking Behavior:**
   - If the script returns `[ALLOWED]`, proceed.
   - If the script returns `[BLOCKED]`, you MUST STOP immediately and ask the user:
     `[SCOPE CHECK] File <filename> is outside the scope of this task (<task>). Do I need to inspect/modify it as well? If yes, I will update scope_lock.json first.`
   - You CANNOT proceed to modify the blocked file without explicit user approval.

4. **Legitimate Exceptions (Read-Only Context):**
   You may READ (but never modify) an out-of-scope file without running the check ONLY if it is a direct dependency required to understand the main file (e.g., viewing an imported component's props). Modifying ANY file always requires a scope check.

5. **Task Completion:**
   When the task is complete, move `scope_lock.json` along with `PLAN.md` into the `plan_archive/` folder, using the format `scope_lock_<date>_<task_name>.json`.

