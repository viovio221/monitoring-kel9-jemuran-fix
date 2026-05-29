# ☁️ Panduan Deploy Online Sistem Monitoring Jemuran di Railway.app

[Railway](https://railway.app) adalah platform cloud modern yang sangat cepat dan andal untuk mendeploy aplikasi web. Karena aplikasi kita menggunakan **Node.js (Express)** untuk backend dan langsung menyajikan **static files (HTML/CSS/JS)** sebagai frontend, kita hanya memerlukan **satu buah Web Service** saja di Railway!

Panduan ini akan menuntun Anda langkah-demi-langkah untuk mendeploy proyek **Sistem Monitoring Jemuran Pintar** secara online di Railway, lengkap dengan konfigurasi **Volume Persisten** agar database SQLite Anda tidak terhapus saat server melakukan restart otomatis.

---

## 📋 Prasyarat Sebelum Deploy
1. **Akun GitHub**: Pastikan Anda sudah mengunggah seluruh folder proyek `D:\1monitoring-jemuran` ke repositori GitHub Anda (misalnya repositori diberi nama: `monitoring-jemuran-iot`).
2. **Akun Railway**: Buat akun gratis di [Railway.app](https://railway.app/) menggunakan akun GitHub Anda.

---

## 🚀 Langkah-Langkah Deployment

### Langkah 1: Hubungkan Repositori GitHub ke Railway
1. Masuk ke dashboard [Railway.app](https://railway.app/).
2. Klik tombol **"+ New Project"** di pojok kanan atas.
3. Pilih **"Deploy from GitHub repo"**.
4. Cari dan pilih repositori Anda (misalnya: `monitoring-jemuran-iot`).
5. Jika ada pilihan untuk menambahkan variabel lingkungan, Anda bisa melewatinya dahulu dengan mengklik **"Deploy Now"**.

---

### Langkah 2: Konfigurasi Path Folder Backend (Penting!)
Karena kode server Node.js kita berada di dalam subfolder bernama `backend`, kita harus memberi tahu Railway untuk masuk ke folder tersebut saat menjalankan proses build.

1. Pada halaman project canvas Railway Anda, klik pada kotak card aplikasi Anda (layanan web Anda).
2. Panel detail layanan akan terbuka di sisi kanan. Masuk ke tab **"Settings"**.
3. Gulir ke bawah hingga Anda menemukan bagian **"Build"**.
4. Cari kolom bernama **"Root Directory"** dan isi dengan:
   ```text
   backend
   ```
5. Railway akan mendeteksi otomatis berkas `package.json` di dalam folder backend, lalu secara otomatis mengatur:
   - *Build Command*: `npm install`
   - *Start Command*: `npm start`
6. Klik **"Save"** atau biarkan tersimpan otomatis. Railway akan memulai ulang (*re-deploy*) proses build menggunakan root directory baru tersebut.

---

### Langkah 3: Membuat Volume Persisten untuk Database SQLite (Sangat Penting! ⚠️)
Secara bawaan, cloud server seperti Railway bersifat *ephemeral* (sementara). Artinya, jika server melakukan restart otomatis atau Anda memperbarui kode, file database SQLite (`laundry_monitor.db`) akan terhapus dan riwayat cuaca Anda akan hilang.

Untuk mengatasinya, kita harus menambahkan **Volume Penyimpanan Persisten** di Railway:

1. Pada halaman project canvas Railway, klik tombol **"New"** (tombol bulat berwarna ungu di canvas atau kanan atas) -> Pilih **"Volume"**.
2. Berikan nama volume tersebut, misalnya: `laundry-db-volume`.
3. Klik **"Create"**.
4. Sekarang, hubungkan volume tersebut ke layanan backend Anda:
   - Klik pada card volume `laundry-db-volume` yang baru dibuat di canvas, lalu seret/sambungkan ke card layanan backend Anda, ATAU:
   - Klik card layanan backend Anda -> Masuk ke tab **"Settings"** -> Gulir ke bawah ke bagian **"Volumes"**.
   - Klik **"Mount Volume"** dan pilih `laundry-db-volume`.
5. Masukkan **Mount Path** (lokasi folder di server tempat database disimpan). Karena database kita disimpan di dalam folder root backend, isi Mount Path dengan:
   ```text
   /app/backend
   ```
   *(Ini memastikan file database `.db` akan disimpan secara permanen di dalam disk fisik khusus dan aman dari restart server).*

---

### Langkah 4: Membuat Domain Publik Online
Agar web dashboard dapat diakses dari browser HP Anda dan Arduino dapat mengirim data, kita perlu membuat URL publik:

1. Klik card layanan backend Anda.
2. Masuk ke tab **"Settings"**.
3. Cari bagian **"Networking"** -> **"Public Networking"**.
4. Klik tombol **"Generate Domain"**.
5. Railway akan menghasilkan URL publik gratis berakhiran `*.up.railway.app` untuk Anda, contohnya:
   `https://monitoring-jemuran-production.up.railway.app`

*Selamat! Sekarang dashboard jemuran Anda sudah online 24 jam penuh di internet global!*

---

## 🔌 Langkah 5: Hubungkan Arduino (ESP8266/ESP32) Anda

Setelah mendapatkan domain publik dari Railway, saatnya memasukkannya ke dalam mikrokontroler Anda:

1. Buka Arduino IDE pada laptop Anda.
2. Buka berkas program `D:\1monitoring-jemuran\arduino\jemuran_sensor\jemuran_sensor.ino`.
3. Cari baris konfigurasi berikut di bagian atas program:
   ```cpp
   // 1. Pengaturan Wi-Fi (Sesuaikan dengan Wi-Fi Anda)
   const char* ssid = "NAMA_WIFI_ANDA";
   const char* password = "PASSWORD_WIFI_ANDA";

   // 2. Pengaturan Server API
   const char* serverUrl = "https://MONITORING-JEMURAN-ANDA.up.railway.app/api/weather";
   ```
4. Ganti `https://MONITORING-JEMURAN-ANDA.up.railway.app` dengan domain publik asli yang Anda dapatkan dari Railway pada **Langkah 4** di atas. (Pastikan diakhiri dengan `/api/weather`).
5. Sambungkan ESP8266/ESP32 Anda ke laptop, pilih Board & Port yang sesuai, lalu klik **Upload**!
6. Setelah upload selesai, pasang catu daya eksternal (seperti charger HP / powerbank) ke board Arduino Anda dan letakkan di area jemuran.

---

## 🛠️ Tips & Troubleshooting
* **Server Terasa Lambat di Awal**: Pada paket gratis Railway, server akan memasuki mode "tidur" jika tidak ada aktivitas selama beberapa menit. Saat ada request masuk pertama kali (baik dari browser Anda maupun kiriman data perdana dari Arduino), server memerlukan waktu 10-20 detik untuk "terbangun". Setelah bangun, respon akan kembali instan (2 detik).
* **Melihat Log Server**: Anda dapat memantau log aktivitas server secara langsung (seperti logs `[Status Berubah] Cuaca: HUJAN`) dengan mengklik card layanan backend Anda di Railway, lalu masuk ke tab **"Logs"**.
