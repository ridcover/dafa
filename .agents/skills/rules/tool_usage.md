<!-- Label ini menjawab satu pertanyaan: kalau aturan ini dilanggar, apakah
     ada yang menahan? MENGIKAT = ditolak oleh kode. ANJURAN = tidak ada yang
     menahan, dan pelanggarannya tidak terdeteksi. Jangan disamakan. -->

> **ANJURAN** — tidak ada kode yang menahannya. Tidak ada yang memaksa
> `selective_reader` dipanggil sebelum membaca berkas; kalau dilewati, tidak
> ada yang tahu.

## ðŸ“– Mandatory Reading Protocol (Selective Reader)

**Primary Rule**
Before reading the contents of ANY file (especially potentially large files like React components, utils, or files with complex logic), you MUST run the Selective File Reader to get the TOC (Table of Contents) FIRST, WITHOUT EXCEPTION and WITHOUT ASSUMPTION.

This applies even if:
- You feel the file is likely short or simple.
- You feel familiar with the pattern/structure of similar files from previous tasks.
- You are certain the file only contains a single function.

Assumptions like these MUST NOT be used as an excuse to skip Selective Reader. Run it first, then decide your next steps based on the actual TOC output â€” not guesswork.

**The ONLY Permitted Exceptions**
You may skip Selective Reader ONLY if the following conditions are met:
1. **Documented Technical Limitations**: Such as files with monolithic JSX components noted in the "Known Limitations" of the Selective Reader SKILL.md. In this case, you MUST still run Selective Reader first to view the TOC output. 
2. **Proven Small Files via TOC**: If Selective Reader has already been run and the TOC proves the file is indeed short (e.g., under 50 lines), you do not need to run it again for the SAME file in the SAME task.

**Strictly Forbidden (ZERO TOLERANCE FOR MANUAL ANALYSIS)**
- **Skipping TOC:** Skipping Selective Reader because you "can guess" the file contents based on filename, patterns, or past experience.
- **Reading Code Blocks Manually:** Even AFTER running Selective Reader, you are **ABSOLUTELY FORBIDDEN** from using `view_file` (or `cat`) to manually read large chunks of logic (e.g., reading lines 200-300 just to "understand" a function). 
- **The Right Way:** If you need to understand inner logic after seeing the TOC, use `smart_search` to target specific variables/keywords within that block. The AI must NOT rely on manual reading to save tokens. `view_file` is ONLY for tiny config files or when the user explicitly forces it.

**When in Doubt**
If you are unsure whether a situation qualifies as a valid exception, ALWAYS run Selective Reader first. It is cheaper than reading the full file, carrying no significant risk if it turns out unnecessary.



## ðŸ›¡ï¸ Tool Usage Rules for File Modifications (Revised)

**Category 1 â€” Creating/writing configuration files, data, or short text (JSON, small .md, .txt)**
Use native tools (`write_to_file` or equivalent) DIRECTLY. THERE IS NO NEED to write intermediary Python scripts for these cases, regardless of the content (including text with many quotes or special characters) â€” native tools can handle this without escaping issues since it bypasses command-line terminal arguments.
*Examples falling into this category:* `task_state.json`, `scope_lock.json`, `PLAN.md`, `SKILL.md`, and other small config files.

**Category 2 â€” Search and replace text in project source code**
You MUST use `smart_replace/replace_text.py`. If the replacement text is long or contains many special characters, use the `--replacement-file <path>` flag to read the text from a file, DO NOT write a new intermediary Python script.

**Category 3 â€” Complex refactoring that genuinely requires conditional logic**
Valid examples for this category: modifying code AST structures, moving code blocks between files with adjustment logic, multi-level parsing data transformations. ONLY for these cases are you allowed to write single-use Python scripts, and you MUST delete them immediately after execution (do not leave them behind, and do not "forget to delete").

*If in doubt about which category applies: default to Category 1 or 2 (use existing tools), DO NOT create a new Python script unless absolutely certain it is Category 3.*

**Additional: Mandatory Self-Check at the End of Every Task**
Before archiving `PLAN.md`, you MUST run *Clean Sweeper* once to ensure no single-use Python scripts are left behind (residues from Category 3). This is part of the task closure checklist, not something the user needs to request repeatedly.


## ðŸ›¡ï¸ ZERO TOLERANCE FOR NATIVE SEARCH TOOLS
To strictly conserve token quotas, you are **ABSOLUTELY FORBIDDEN** from using the native IDE search tools (like `grep_search`). 
- **For Searching Code:** ALWAYS use the custom python tool `python .agents/skills/smart_search/code_finder.py <dir> <keyword>`.
- The native `grep_search` tool is banned because it often returns unoptimized or poorly formatted output. Rely exclusively on the custom Python tools provided in the Snowline Arsenal.

