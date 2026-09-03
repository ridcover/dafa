# Aturan Chamber

Chamber adalah **protokol**, bukan program. Tidak ada daemon, tidak ada skrip
yang memanggil agen. Semua sinyal dijalankan manusia.

Dipasang lewat `snowline init_chamber --apply`.

---

## 0. Kapan chamber dipakai — dan kapan tidak

Chamber punya ongkos: PM jadi jembatan manual, dan tiap iterasi butuh entri
tertulis. Memakainya untuk segalanya akan membuatnya dilanggar diam-diam, dan
protokol yang dilanggar diam-diam tidak melindungi apa pun.

Penyaringnya satu pertanyaan:

> **Kalau perubahan ini salah, apakah langsung kelihatan?**

```
kelihatan seketika     warna, teks, tata letak, salin-tempel  ->  kerjakan biasa
baru ketahuan nanti    skema data, alur penyimpanan, penilaian,
                       keamanan, migrasi, apa pun yang menyentuh
                       data orang lain                        ->  lewat chamber
```

Bukan "berisiko tinggi" — itu tidak bisa diperiksa dan tiap orang menilainya
berbeda. Yang bisa diperiksa: seberapa lama kesalahan sempat hidup sebelum ada
yang menyadarinya.

Tombol salah warna ketahuan dalam sedetik. Jawaban yang tersimpan ke paket yang
salah baru ketahuan setelah ujian selesai — dan saat itu tidak bisa diulang.

Kalau ragu, pakai chamber. Ongkos memakainya untuk hal kecil cuma waktu;
ongkos tidak memakainya untuk hal besar dibayar orang lain.

## 1. Empat peran, dan siapa boleh memanggil siapa

```
PM        manusia            memvonis terakhir, menjembatani semua sinyal
TL        agen               memutuskan, mendelegasikan, melaporkan
QA        agen kedua         memeriksa dengan menjalankan, bukan membaca
Pekerja   subagent           sekali pakai, mati setelah tugasnya selesai
```

**TL tidak boleh memanggil QA-nya sendiri.** Yang memilih pemeriksa adalah PM.
Alasannya bukan formalitas: agen yang memilih hakimnya sendiri sedang
memberkati pekerjaannya sendiri.

```
PM  <-> TL       dua arah
PM  <-> QA       dua arah
TL   -> pekerja  subagent sekali pakai, hasilnya ditempel mentah
QA   -> pekerja  subagent sekali pakai, hasilnya ditempel mentah
TL   -X- QA      tidak ada jalur langsung
```

Subagent boleh dipanggil siapa saja, karena ia **tidak pernah memvonis**. Ia
menyediakan bukti; yang menyimpulkan tetap peran di atasnya.

**Catatan tentang Kunci Peran (`role.json`):** Berkas kunci tulis berbasis peran (`.here_we_are/role.json` atau `.agents/chamber/role.json`) sengaja diabaikan oleh Git (`.gitignore`). Kunci peran adalah **keadaan lokal per mesin** (*local state*), bukan bagian dari repositori. Hal ini untuk mencegah risiko konflik antar sesi ketika beberapa pengembang bekerja bersamaan.

## 2. Satu saluran

`.agents/chamber/connector.md`. Semua peran menulis dan membaca di situ.

Bukan satu berkas per peran. Itu sudah dicoba dan mati: PM tidak mau memikirkan
"ini masuk kotak yang mana", dan pertukaran QA↔TL sifatnya percakapan, bukan
surat-menyurat.

Laporan TL yang belum divonis adalah penugasan untuk QA. Sesi QA yang menemukan
entri semacam itu di ekor connector tidak perlu menunggu entri penugasan
terpisah — laporan itu sendiri dasarnya. Kalau PM menghendaki pemeriksaan yang
lebih sempit atau lebih luas dari isi laporan, itu ditulis sebagai entri
tersendiri.

## 3. Syarat entri — ditolak sebelum isinya dibaca

- Laporan TL ditulis HANYA ke connector, bukan sekadar lewat chat ke PM. Chat ke PM hanya berisi "selesai — silakan sinyal PM".
- Laporan menyatakan sesuatu selesai tanpa memuat **perintah dan keluarannya**.
- Keluaran diringkas atau dirapikan, bukan ditempel apa adanya.
- Kesimpulan menyatakan hal yang tidak ditunjukkan keluaran itu sendiri —
  termasuk bila perintahnya benar tetapi tidak menyentuh kode yang diklaim.

Kalau tidak ada keluaran untuk ditempel, vonisnya **`TIDAK BISA DIUJI`**. Itu
sah, dan lebih berguna daripada tebakan.

## 4. Connector adalah satu-satunya lebar pita

**Apa yang tidak ada di connector, identitas kedua tidak tahu.**

Ini bukan aturan kehormatan. Ditegakkan dengan memberi subagent **hanya entri
itu** — tanpa riwayat induk, tanpa alasan, tanpa niat. Ia dingin karena
konstruksinya, bukan karena berjanji lupa.

Akibat sampingnya yang paling berharga: laporan yang malas langsung terasa.
Kalau entrinya tidak lengkap, pemeriksanya tidak bisa bekerja, dan itu ketahuan
seketika.

- Batasan yang diberikan PM di luar entri tidak berlaku. Apa pun yang membatasi
  pekerjaan — larangan menyentuh berkas, larangan commit, batas waktu — harus
  tertulis di entri connector. Yang disampaikan lisan atau di luar chamber akan
  menjadi klaim yang tidak bisa diperiksa, dan pemeriksa benar untuk menolaknya.

## 4b. Kunci usulan — TL tidak bisa membangun sebelum mengusulkan

Butir 4 menuntut entri memuat perintah dan keluaran. Butir ini menuntut sesuatu
yang lebih awal: **usulan sebelum kode ditulis.** Bedanya, yang ini tidak
diminta — ia dikunci.

Mekanismenya sudah ada di snowline dan tinggal dipakai:

**Yang diubah di butir 4b, dua versi aturan:**

```
PM   tulis entri  +  buat .agents/task_state.json      ->  pintu terkunci
TL   mengusulkan, kirim ke QA
QA   periksa rencananya, beri catatan
PM   putuskan, hapus berkas itu                        ->  pintu terbuka
```

Isi berkasnya:

```json
{"phase": "pseudocode_pending", "task": "<judul entri>"}
```

Selama berkas itu ada, setiap `--apply` ditolak:

```
[BLOCKED] Pseudocode untuk task ini belum disetujui user.
Task: <judul entri>
Minta user approve pseudocode dulu sebelum --apply bisa dijalankan.
```

Ditegakkan di `smart_replace/replace_text.py:22` (`check_task_state`), dan
sudah diuji: dengan berkas itu `--apply` ditolak, tanpa berkas itu `--apply`
berhasil.

**Kenapa dikunci, bukan diminta.** Selama ini TL mengusulkan lebih dulu hanya
ketika entri PM memintanya. Aturan yang bergantung pada seseorang mengingat
untuk memintanya bukan aturan — itu kebiasaan, dan kebiasaan patah saat
tergesa.

**Batasnya, dan ini harus diketahui sejak awal:** gerbang ini hanya menahan
alat tulis snowline. Kalau agen memakai editor bawaan harness-nya, ia lewat
begitu saja. Untuk menutup itu perlu hook di sisi harness, dan itu di luar
jangkauan berkas ini. Jangan memperlakukan kunci ini sebagai jaminan; ia
menahan jalur yang lewat snowline, tidak lebih.

**Kapan dipakai:** untuk entri yang membangun sesuatu. Untuk perbaikan yang
letaknya sudah jelas dan bukti kerusakannya sudah ditempel PM, mengunci hanya
menambah putaran.

## 5. Siapa yang menutup

QA memvonis PASS / REJECT / TIDAK BISA DIUJI. TL tidak bisa menutup tugas tanpa
vonis itu.

Tetapi **wewenang terakhir tetap pada PM**, dan PM boleh bertanya kapan saja:

> *Perintah mana yang menunjukkan itu?*

Satu pertanyaan itu menangkap sebagian besar klaim yang tidak berdasar, tanpa PM
perlu membaca satu baris kode pun.

## 6. STATE.md — keadaan, bukan riwayat

```
STATE.md      ditimpa, tidak ditambah      dibaca dalam beberapa detik
connector.md    ditambah, tidak ditimpa      riwayat, untuk menelusuri
```

Siapa pun yang mengubah sesuatu memperbarui `STATE.md` di giliran yang sama.
Kalau aturan ini dilanggar dua-tiga kali, berkas itu jadi bohong dan lebih baik
dihapus daripada dipercaya.

Rotasi: kalau `connector.md` lewat ~100 KB, arsipkan ke
`.agents/chamber/archive/connector_<tanggal>.md` dan mulai berkas baru dengan
kepala yang sama.

## 7. Batas yang perlu diketahui sejak awal

Identitas kedua menangkap klaim yang tidak didukung buktinya. Ia **tidak**
menangkap kesalahan yang lahir dari premis keliru yang ikut tertulis di entri.
Kalau premis salah ditulis dengan yakin, pemeriksa dingin akan memeriksanya di
atas premis yang sama.

Untuk itu tetap perlu PM, sesekali, dengan pertanyaan di butir 5.

## 8. Kalau chamber terasa terlalu berat

Kurangi, jangan tinggalkan diam-diam. Protokol yang lebih berat daripada beban
kerjanya akan mati, dan matinya tidak terlihat sampai ada yang memeriksa.

Urutan yang boleh dilepas lebih dulu: peran Executor terpisah, lalu subagent
dingin. Yang **terakhir** dilepas: syarat entri di butir 3. Itu yang menahan
laporan tanpa bukti, dan itu inti seluruh protokol ini.

## 9. Uji Penolakan (Rejection Tests)

Uji penolakan harus menunjukkan dua hal — bahwa ia menolak, dan bahwa ia menerima saat syaratnya dipenuhi. Gerbang yang selalu tertutup (atau pengujian yang asersinya menerima ketiadaan seperti gagal menulis karena *crash*) tidak bisa dibedakan dari gerbang yang tidak ada.

## 10. Selesai berarti ada di git dan HIJAU DI CI

> **Sebuah entri belum selesai sampai `git log` menunjukkannya dan lulus di *Continuous Integration* (CI). Yang lulus di
> disk lokal belum lulus — clone bersih dari server CI (Linux/macOS) yang menentukan, karena itu yang diterima
> pengguna di sistem lain.**

Ini bukan soal kerapian versi. Dua sprint berturut-turut dinyatakan selesai
dengan hasil uji yang **benar** — `40/40`, dijalankan sungguhan, tidak ada yang
dikarang. Semuanya di mesin sendiri, dan tidak satu pun berkasnya di-commit.

Bedanya halus dan justru karena itu berbahaya. Butir 3 menahan kesimpulan yang
melampaui keluarannya. Butir ini menahan hal lain: keluaran yang benar, tetapi
**tentang sesuatu yang tidak akan diterima orang lain.**

Gejalanya selalu sama, dan ketiganya pernah terjadi:

```
uji lulus di disk, gagal impor dari clone bersih
perbaikan ada di templat, tidak disinkronkan ke target (Rule #12)
berkas baru ada, tidak pernah masuk staging
```

**Cara memenuhinya, satu perintah sebelum melapor:**

```bash
git status --short          # harus kosong
git log --oneline -1        # harus menunjukkan pekerjaan Anda
```

Jalankan Kalibrasi Versi (lihat `ONBOARDING_TL.md` atau `ONBOARDING_QA.md` pada LANGKAH PERTAMA). Kalibrasi tersebut memverifikasi `git log` dan hasil *Continuous Integration* (CI) sekaligus.

Kalau QA meragukan, ia akan menjalankan dari `git clone` — dan yang berlaku
adalah hasil di sana, bukan di mesin Anda.

10. **Riwayat Git Tidak Ditulis Ulang**
    Riwayat git tidak ditulis ulang. Membatalkan sesuatu dilakukan dengan commit
    baru yang membalikkannya, bukan dengan menghapus commit lama atau force-push.
    Butir ini menyandarkan seluruh chamber pada git sebagai catatan; catatan yang
    bisa disunting ulang bukan catatan.
