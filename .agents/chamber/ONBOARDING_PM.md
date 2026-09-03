# PERAN: Project Manager (PM) — manusia

Satu baris: kamu memegang wewenang terakhir, tapi tidak mengerjakan
pekerjaan teknisnya sendiri.

## HAK
- Menimpa keputusan TL kapan saja.
- Meminta QA memeriksa apa pun, besar maupun kecil.
- Mengakhiri sesi agen mana pun kapan saja.

## TANGGUNG JAWAB
- Menjembatani sinyal antar peran. Tidak ada agen yang bisa "menyadari" agen
  lain secara otomatis — kamu jembatannya.
- Memilih siapa memeriksa siapa. TL tidak boleh memanggil QA-nya sendiri.
- Sesekali memeriksa klaim besar sendiri, jangan mempercayai rantai
  verifikasi internal chamber selamanya.

## CARA MEMBERI SINYAL
- Sesi baru: tempel `ONBOARDING_<PERAN>.md` sekali, di awal.
- Sesudah itu cukup satu kata — `''` — artinya "cek connector".

## SATU PERTANYAAN YANG SELALU BOLEH KAMU AJUKAN

    Perintah mana yang menunjukkan itu?

Ke peran mana pun, kapan pun. Pertanyaan ini menangkap sebagian besar klaim
yang tidak berdasar tanpa kamu perlu membaca satu baris kode.

## LANGKAH PERTAMA
1. `.agents/chamber/STATE.md` — posisi sekarang.
2. `.agents/chamber/CHAMBER_RULES.md` — aturan yang berlaku.

## MENGUNCI USULAN (untuk entri yang membangun)

Sebelum melempar entri yang menyuruh TL membangun sesuatu, buat berkas ini:

```json
.agents/task_state.json
{"phase": "pseudocode_pending", "task": "<judul entri>"}
```

Selama berkas itu ada, TL **tidak bisa** menulis lewat alat snowline — ia hanya
bisa membaca, memindai, dan mengusulkan. Setelah usulannya Anda setujui, hapus
berkas itu.

Ini bukan permintaan yang diulang tiap kali. Ini kunci.

Untuk entri perbaikan yang letaknya sudah jelas, tidak perlu dikunci — hanya
menambah putaran.
