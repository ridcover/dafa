---
name: Native Checker Generator
description: Membantu agen men-scaffold pengujian spesifik-aplikasi (Unit Test Jest) atau validator database (Standalone Node.js) di dalam repositori pengguna. Gunakan ini untuk menemukan bug lewat "native testing" alih-alih "static analysis".
---

# Native Checker Generator (Hybrid)

Alat ini digunakan saat Anda menduga ada bug di logika kompleks atau inkonsistensi state/database yang tidak bisa ditangkap oleh alat analisis statis (seperti ESLint atau Regex). Daripada menebak-nebak, Anda harus menggunakan alat ini untuk membangkitkan skrip tes yang berjalan secara native di dalam proyek aplikasi.

## Kemampuan (Mode)
1. \--mode unit\: Menghasilkan kerangka Unit Test (misal: Jest) untuk sebuah fungsi. Cocok untuk menguji logika murni, komponen UI, atau fungsi utility.
2. \--mode validator\: Menghasilkan skrip Standalone Node.js yang dilengkapi koneksi database. Cocok untuk audit inkonsistensi data, state berantakan, atau one-off fix.

## Cara Menggunakan

1. **Scaffold Unit Test**
   \\\ash
   python .agents/skills/native_checker_gen/generator.py --mode unit --target src/utils/math.js --name MathTest
   \\\
   Outputnya akan berupa file \src/__tests__/MathTest.test.js\ (atau sesuai konvensi lokal) yang sudah disiapkan *import* ke \src/utils/math.js\. Setelah di-generate, isi logikanya lalu jalankan \
pm test\.

2. **Scaffold Standalone Validator**
   \\\ash
   python .agents/skills/native_checker_gen/generator.py --mode validator --name CheckOrphanData
   \\\
   Outputnya akan berupa skrip Node.js (misal \scripts/validators/CheckOrphanData.js\) yang memiliki kerangka try-catch dan koneksi DB (bila template mendeteksi dotenv). Skrip ini juga otomatis didaftarkan di \package.json\ pada bagian \scripts\ jika disetujui. Jalankan dengan \
ode scripts/validators/CheckOrphanData.js\.

## Kapan HARUS menggunakannya?
Sesuai Arah 5: Agen **TIDAK BOLEH** menulis skrip tes sekali pakai (*throwaway scripts*) di direktori \scratch/\ untuk memeriksa kebenaran aplikasi utama. Segala bentuk validasi kode aplikasi harus ditanam sebagai **Unit Test permanen** atau **Validator Script permanen** di dalam repo aplikasi menggunakan alat ini.
