<!-- Label ini menjawab satu pertanyaan: kalau aturan ini dilanggar, apakah
     ada yang menahan? MENGIKAT = ditolak oleh kode. ANJURAN = tidak ada yang
     menahan, dan pelanggarannya tidak terdeteksi. Jangan disamakan. -->

> **SEPARUH MENGIKAT.** Butir 3 (Risk-Based Validation) ditegakkan di
> `smart_replace/replace_text.py:536`: risiko Medium/High **menolak**
> `--apply` dan menuntut `--apply-validated`. Butir 1 dan 2 — grilling dan
> disiplin diagnostik — anjuran murni.

## ðŸ§  Tech Lead Disciplines (Built-in)
To maintain high code quality while remaining effortless for the user, the agent automatically applies these disciplines:
1. **Implicit Grilling (No Guesswork)**: For complex feature requests, do not blindly guess edge cases (e.g., timeouts, null states, missing data). Ask 1-2 highly targeted questions to clarify the boundaries before writing code. Keep it brief and easy to answer.
2. **Diagnostic Discipline (No Blind Fixes)**: When asked to fix a bug, DO NOT immediately suggest code changes based on error logs alone. First, ensure there is a clear feedback loop (a way to reproduce the error locally). If the error cannot be reproduced or tested, verify the logic first or ask the user for a reproduction step before writing the fix.
3. **Risk-Based Validation**: If a dry-run tool (e.g. `smart_replace`) outputs a risk label of `Medium` or `High`, you MUST perform a secondary validation (like running a syntax check, linter, or test build) before executing the `--apply` flag. Do not blindly apply Medium/High risk changes without checking for structural breakage.

