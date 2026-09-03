<!-- Label ini menjawab satu pertanyaan: kalau aturan ini dilanggar, apakah
     ada yang menahan? MENGIKAT = ditolak oleh kode. ANJURAN = tidak ada yang
     menahan, dan pelanggarannya tidak terdeteksi. Jangan disamakan. -->

> **ANJURAN** — tidak ada kode yang menahannya. END/CONTINUE/KILL bergantung
> sepenuhnya pada kepatuhan agen.

## END, CONTINUE & KILL Command â€” Exit, Resume, and Abort Mechanism

**Purpose:**
Provide a way to stop working instantly without friction (no follow-up questions, no layered confirmations, no long reports), while ensuring the latest work state is fully saved and can be reviewed anytime via the CONTINUE command â€” even if the pause between END and CONTINUE lasts a long time (days or more). Additionally, provide a KILL command to abort and completely clear out a task's plans when it is no longer relevant.

### Behavior of "END" Command
When the user types END (in any message, no specific format needed), the agent MUST:
1. **Stop completely** from any ongoing execution â€” no new tool calls, no code writing/modifying, no follow-up questions of any kind.
2. **Update the state files without asking the user for details:**
   - Update the active `PLAN.md` with a brief closing entry: label the current task status as `PAUSED` (not completed, not cancelled â€” a safe default that assumes nothing).
   - Update `task_state.json` (if there is a task waiting for plan approval) â€” save the exact condition as last seen, and add a `"paused_at": "<timestamp>"` field.
   - DO NOT archive these files into `plan_archive/` â€” leave them in the project root, as the task is not necessarily finished.
   - Log a brief state summary into `PLAN.md`, including:
     - The task currently being worked on
     - The last step that was completed
     - The next planned step (if any)
     - Which files have been touched so far
3. **Reply to the user with EXACTLY ONE short line of confirmation, nothing more:**
   `[PAUSED] Dihentikan. State tersimpan di PLAN.md. Ketik CONTINUE kapan saja untuk melanjutkan.`
   No additional reports, no long summaries, no "are you sure" questions â€” END is executed immediately upon being typed.

### Behavior of "CONTINUE" Command
When the user types CONTINUE in any session (whether the same session or a new chat/session), the agent MUST:
1. **Find and read** `PLAN.md` and `task_state.json` with the `PAUSED` status in the project root â€” do not assume from the memory of previous sessions, always reread from the files, because the time gap could be long and previous chat context might be unavailable.
2. **Display a brief summary to the user before resuming anything:**
   ```text
   [RESUMED] Last task: <task description>
   Last step: <brief summary>
   Next plan: <next step if any>
   
   Lanjutkan dari sini, atau ada perubahan arahan?
   ```
3. **Wait for user confirmation.** Do not immediately execute anything until the user confirms whether to proceed as originally planned or change direction â€” this is critical because the user might need time to recall the context before deciding.
4. **After user confirmation,** update the status in `PLAN.md`/`task_state.json` from `PAUSED` back to the appropriate active status (e.g., `plan_pending`, `approved`, etc. depending on the applicable protocol), and resume work as usual.

### Key Principles
- **END never fails or delays** â€” no matter what is happening, as soon as the user types END, the agent stops immediately. There is no condition that makes the agent "finish this step first before stopping".
- **State is never lost** â€” even if END is called in the middle of a very early process (e.g., just started analysis), the agent still records something to `PLAN.md`, however small the progress, so CONTINUE always has something to read.
- **CONTINUE makes no assumptions** â€” always read the actual state files, do not rely on conversational memory, because PAUSED can persist across sessions/days/weeks.

### Behavior of "KILL" Command
When the user types KILL (in any message, no specific format needed), the agent MUST:
1. **Stop completely** from any ongoing execution.
2. **Delete all state files** related to the current task from the project root (`PLAN.md`, `task_state.json`, `scope_lock.json`, `session_cache.json`, and any implementation artifacts) without archiving them to `plan_archive/`. The task is considered aborted.
3. **Reply to the user with EXACTLY ONE short line of confirmation, nothing more:**
   `[KILLED] Semua plan dan task saat ini telah dihapus. Siap menerima instruksi baru.`



## Task Closure (Mandatory Verification)
Setiap kali agen melaporkan bahwa sebuah tugas utama telah selesai secara keseluruhan (menggunakan tag **🔵 [DONE]** final, bukan laporan progres parsial), agen WAJIB melakukan penutupan status (Task Closure) dalam langkah eksekusi yang sama, dengan aturan:
1. Perbarui file PLAN.md menjadi status [COMPLETED].
2. Pindahkan (arsipkan) PLAN.md ke dalam folder plan_archive/PLAN_<date>_<task_name>.md.
3. Hapus file 	ask_state.json dari direktori *root*.

Sebagai mekanisme pengingat *anti-lupa*, agen **WAJIB** menyertakan *checklist* penutupan ini di akhir laporan [DONE] final tersebut:
- [x] Status PLAN.md diupdate ke completed
- [x] PLAN.md dipindahkan ke plan_archive/
- [x] 	ask_state.json dihapus
