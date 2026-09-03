<!-- Label ini menjawab satu pertanyaan: kalau aturan ini dilanggar, apakah
     ada yang menahan? MENGIKAT = ditolak oleh kode. ANJURAN = tidak ada yang
     menahan, dan pelanggarannya tidak terdeteksi. Jangan disamakan. -->

> **SEPARUH MENGIKAT.** Kalau `.agents/task_state.json` bertanda
> `phase: pseudocode_pending`, `smart_replace/replace_text.py:22`
> (`check_task_state`) **menolak** `--apply`. Selebihnya — satu tugas dalam
> satu waktu, kontrak sebelum baris pertama — anjuran yang tidak terdeteksi
> kalau dilanggar.

## One-Task-One-Time Protocol (Plan-First)

**Problem Solved:**
The development process often expands mid-way â€” starting from one clear task, but the agent gradually adds other "seemingly useful" things (extra refactors, additional features, unrelated fixes) before the initial task is fully completed. This is different from the problem solved by Scope Guardian (which controls which files can be touched) â€” this protocol controls the number of active tasks at any one time, ensuring a clear contract exists BEFORE the first line of code is written.

**Core Principle:**
One task at a time. Plan first, actual code later.
Before writing real code (JS, Python, etc.), the agent MUST write a plan and obtain explicit user approval, ONLY THEN proceed to actual implementation. No code is written before the plan is approved.

### Mandatory Workflow

**Step 1 â€” Single Task Declaration**
Before starting any work, the agent writes down ONE task to be worked on, in a short format:
`[TASK] <task description, one sentence>`

If the user provides an instruction containing MORE THAN ONE task at once (e.g.: "fix bug X, also tidy up Y, and add feature Z"), the agent MUST split it and ask for priority order:
`[MULTI-TASK DETECTED] I see 3 different tasks: (1) fix bug X, (2) tidy up Y, (3) add feature Z. According to the one-task-one-time principle, I will work on them one by one. Which one should we start with?`
The agent MUST NOT work on more than one task in a single work cycle, even if the user provides them all at once in one message.

**Step 2 â€” Write the Plan (Conversational Narrative), Not Actual Code**
For the agreed task, the agent writes the plan in natural, conversational language.
Do NOT use keywords like GIVEN/WHEN/THEN, FUNCTION/IF/RETURN, or any code-like symbols. Write it as a plain paragraph that can be read in one pass without parsing formal structures.

*Exception for Highly Algorithmic Logic:* For genuinely complex mathematical or multi-step logic (e.g., cognitive profiling scores with many variables), you may insert slight technical notations within the narrative sentence (e.g., "the final score is calculated from the multiple-choice average multiplied by 0.7 plus the essay average multiplied by 0.3"), but it must remain as sentences, not a separate code block.

Example:
```text
[PLAN]
If the teacher data is empty, show an 'empty data' message and don't proceed with printing. If there is data, generate the PDF as a blob (instead of the old datauristring format), then display it in the modal. When the modal is closed, clean up the blob URL so it doesn't pile up in memory.
```

The plan MUST be:
- Concise (ideally under 15 lines for small-medium tasks)
- Focused on logic/behavior, not detailed language syntax
- Explicitly cover relevant edge cases (empty states, errors, etc.)

**Step 3 â€” Wait for Approval Before Actual Code**
After the plan is written, the agent MUST stop and wait for user confirmation:
`Does this plan look good? If yes, I will proceed to write the actual code.`
The agent MUST NOT write the actual code (real implementation) before the user approves the plan. If the user requests changes to the plan, the agent revises the plan first, rather than immediately jumping to code with an unapproved logic revision.

**Step 4 â€” Implementation According to Approved Plan**
Once approved, the agent writes the actual code following the logical structure already present in the plan â€” do not add new steps/logic not present in the plan without reporting it first.

If during implementation the agent realizes there is an additional need not covered in the plan (e.g.: turns out a new import is needed, or an edge case was missed), the agent MUST report it as a minor adjustment before proceeding, rather than silently adding it:
`[ADJUSTMENT] During implementation, I realized I need to add <thing>. This is outside the initial plan. Shall I proceed with this adjustment?`

**Step 5 â€” Task Completed, Close Cycle**
Once the code is applied and verified, the task is considered complete. The agent DOES NOT automatically move on to the next task â€” the agent waits for new instructions from the user for the next task, even if there were multiple tasks initially declared in Step 1 (multi-task detected).

### Relation to Existing Mechanisms
- **Scope Guardian** remains active in Step 4 (implementation) â€” files touched during implementation must still pass `scope_check.py` validation.
- `PLAN.md` logs the approved plan as part of the task log, maintaining a written trail from plan to implementation.
- This protocol applies BEFORE Scope Guardian is technically active â€” plan-first prevents the plan from expanding, Scope Guardian prevents the touched files from expanding. Both complement each other, rather than replacing one another.

### The Micro-Task Exception (Fast Track Protocol)
For very small and unambiguous tasks (Micro Tasks), the agent is **PERMITTED** to bypass the creation of `PLAN.md`, `scope_lock.json`, and plan approval. The agent may execute the changes directly and provide a brief report.

**Specific Criteria for Permitted Micro Tasks:**
1. **Minor Comments/Deletions:** Commenting out or deleting 1-3 lines of code.
2. **Cosmetics & Styling:** Changing colors (CSS/hex), margins, padding, font sizes, or UI styling.
3. **Static Text:** Fixing typos, changing button labels, or input placeholders.
4. **Additional Debugging:** Adding or removing `console.log` for debugging purposes.
5. **Hardcoded Configurations:** Changing simple numbers or boolean values (e.g., timeout `1000` to `3000`).
6. **Non-Critical Config Updates:** Updating `.gitignore` or `.env.example`.
7. **Dead Code Cleanup:** Deleting static files, unused packages, or obsolete functions that are 100% unused.
8. **Small Prop/Parameter Adjustments:** Adding optional props (e.g., `disabled={true}`) without breaking core logic.
9. **File Layout Refactoring:** Moving component files between folders (including updating imports) without changing their contents.
10. **Safe Syntax Modifications:** Changing `==` to `===`, or adding Optional Chaining (`?.`).

**Doubt Mechanism (Self-Correction Rule):**
- If the task clearly falls into the list above, the agent **MUST execute directly** without the long protocol.
- If the agent is **in doubt** whether a task is a Micro Task or not, the agent **MUST ask the user first**.
- If the user confirms it is a Micro Task, the agent **MUST execute the task AND immediately add that task category to the Micro Task list above (in AGENTS.md)** so it becomes a standard in the future.

**File Limits for Micro Tasks:**
Although Micro Tasks are exempt from `PLAN.md`, `scope_lock.json`, and formal plan, the agent **MUST ONLY touch files that are explicitly mentioned or clearly implied** by the user's instruction. If the agent feels the need to inspect/modify OTHER files outside of that (including for reasons like "cleaning up while at it" or "for consistency"), this automatically is **NO LONGER considered a Micro Task** â€” the agent MUST stop and ask the user first, or revert to the full protocol (`PLAN.md` + plan approval) if it turns out to be more complex than initially expected.

