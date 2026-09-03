<!-- Label ini menjawab satu pertanyaan: kalau aturan ini dilanggar, apakah
     ada yang menahan? MENGIKAT = ditolak oleh kode. ANJURAN = tidak ada yang
     menahan, dan pelanggarannya tidak terdeteksi. Jangan disamakan. -->

> **ANJURAN** — tidak ada kode yang menahannya. Isinya kewaspadaan, bukan
> gerbang: perkakas yang memeriksa dirinya sendiri bisa buta pada cacatnya
> sendiri. Yang menahan risiko itu bukan berkas ini, melainkan uji di `tests/`
> dan pemeriksa kedua di chamber.

# Bootstrapping Safety (Self-Improvement)

## Konteks
Proyek ini unik karena tools yang dibangun di sini (smart_search, project_guardian, scope_guardian, dll) juga dipakai untuk mengaudit dan memperbaiki proyek ini sendiri. Ini disebut **bootstrapping/self-hosting** — tapi punya risiko: kalau sebuah tool punya bug, tool itu bisa gagal mendeteksi masalah pada dirinya sendiri, karena "mata" yang dipakai untuk memeriksa itu sendiri yang rusak.

---

## Aturan Wajib Saat Tool Memeriksa Dirinya Sendiri

### 1. Jangan Validasi dengan Tool yang Sama

Jangan pernah memvalidasi perubahan pada suatu tool **HANYA** dengan tool itu sendiri.

**Contoh:**
- Memperbaiki bug di `smart_search` → jangan cuma jalankan `smart_search` lagi untuk "membuktikan" perbaikannya benar
- Gunakan verifikasi independen: baca kode secara langsung (`view_file`), atau jalankan Python/perintah dasar yang tidak bergantung pada tool yang sedang diperbaiki

### 2. Curigai Bug di Orchestrator / Dispatcher

Kalau menemukan bug di orchestrator/dispatcher (`executor.py`, dll) yang bertugas **MEMANGGIL tool lain**:

- Curigai juga apakah bug yang sama membuat **SEMUA laporan sebelumnya dari orchestrator itu tidak bisa dipercaya**
- Jangan asumsikan "cuma bug ini doang" — audit ulang klaim-klaim sebelumnya yang bergantung pada komponen yang baru ditemukan rusak

### 3. Live-Test di Lingkungan Bersih

Untuk perubahan pada tool inti (bukan fitur baru, tapi **perbaikan bug**):

- Wajib live-test di folder/environment **BARU** yang belum pernah dipakai sebelumnya
- Tujuannya: supaya tidak ada cache atau state lama yang menyamarkan hasil
- Contoh: bug `safe_print` yang sempat lolos karena versi lama masih ter-cache

### 4. Laporkan Keraguan

Kalau ragu apakah suatu perbaikan benar-benar bekerja karena tool yang dipakai untuk verifikasi adalah bagian dari **sistem yang sama** yang sedang diperbaiki:

- **WAJIB** laporkan keraguan itu secara eksplisit ke user
- Jangan klaim "sudah terverifikasi" kalau verifikasinya berasal dari komponen yang blind spot-nya belum bisa ditentukan bersih

---

## Prinsip Inti

> **Sistem tidak bisa 100% memverifikasi dirinya sendiri tanpa pengawasan dari luar.**

Kalau Claude Code sedang memperbaiki tool yang **JUGA** dipakai untuk bekerja di project ini, akui keterbatasan itu ke user, jangan berpura-pura hasil verifikasi internal itu setara dengan pengecekan independen dari luar.

---

*Last Updated: 2026-07-29*
