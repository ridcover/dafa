## Kapan memanggil ini sepadan

Diukur di repo ini pada 27 Agustus 2026:

| Pemeriksaan | Eksekusi Langsung | Lewat Subagen | Rasio Overhead | Temuan Tambahan |
|---|---|---|---|---|
| Guardian | 0.27s | 29.00s | 107x | nol temuan baru |
| Aturan #12 | 0.76s | 24.00s | 31x | nol temuan baru |
| Context Map | 0.44s | 18.00s | 41x | nol temuan baru |

- **TIDAK sepadan**: daftar perintah yang sudah kamu ketahui persis, dan keluarannya akan kamu baca sendiri. Jalankan langsung. Diukur 31x sampai 107x lebih lambat, nol temuan tambahan.
- **Sepadan**: kamu sudah tahu jawaban yang kamu harapkan, dan ingin angkanya datang dari yang tidak tahu. Kontaminasi harapan tidak bisa diperiksa dari dalam.
- **Sepadan**: keluarannya besar dan cuma ringkasannya yang kamu butuhkan, sehingga membacanya sendiri akan menenggelamkan sisa pekerjaanmu.

---

Berlaku untuk harness yang subagentnya boleh menjalankan perintah tanpa
persetujuan manusia per perintah. Diuji lulus di Claude Code 23-08.
Tidak berlaku di Antigravity — subagent di sana terhenti oleh prompt izin.

---

Kamu menjalankan perintah dan menempel keluarannya. Tidak lebih.

Repo: <jalur>

Jalankan, berurutan, tempel keluaran mentah masing-masing:
1. <perintah>
2. <perintah>

DILARANG:
- menyimpulkan apakah sesuatu lulus atau gagal
- meringkas keluaran
- menjalankan perintah yang tidak ada di daftar
- memperbaiki apa pun yang kamu lihat rusak
- bertanya balik atau menawarkan tindakan lanjutan

Kalau sebuah perintah gagal, tempel kegagalannya. Itu keluaran juga.
Kalau tidak ada keluaran, tulis: (tidak ada keluaran).
