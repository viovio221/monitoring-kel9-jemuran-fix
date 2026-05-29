# 🌧️ Sistem Monitoring Jemuran Pintar berbasis IoT (Smart Laundry Protector)

Sistem ini adalah solusi Internet of Things (IoT) terintegrasi untuk memantau kondisi cuaca di area jemuran secara real-time. Dilengkapi dengan antarmuka web dashboard premium berbasis glassmorphism, database log riwayat cuaca, alarm suara browser lokal, buzzer fisik lokal, dan fitur fail-safe offline untuk memastikan jemuran Anda tetap aman di bawah segala kondisi cuaca.

---

## 🛠️ Fitur Utama Sistem
1. **Monitoring Real-Time**: Status cuaca diperbarui instan di web dashboard tanpa perlu me-refresh halaman (menggunakan polling berkinerja tinggi).
2. **Indikator Skema Warna Dinamis**:
   - **Merah (Hujan)**: Mengaktifkan alarm visual "Jemuran terkena hujan", memicu sirene audio di browser, mengubah kondisi jemuran menjadi `Segera Angkat Pakaian`, dan membunyikan alarm fisik di lapangan.
   - **Kuning (Gerimis)**: Memberikan info siaga `Jemuran Lembab / Pantau Cuaca` dengan tema keemasan yang menawan.
   - **Hijau (Cerah)**: Status aman `Aman / Sedang Menjemur` dengan pemandangan visual matahari berputar yang menenangkan.
3. **Database Riwayat SQLite**: Menyimpan riwayat perubahan status cuaca secara otomatis lengkap dengan Tanggal, Waktu (WIB), Nilai Sensor, dan Status untuk dianalisis.
4. **Alarm Browser & Buzzer Fisik**: Sistem peringatan ganda (di laptop/HP melalui browser dan di lapangan menggunakan Buzzer fisik yang terhubung ke ESP8266/ESP32).
5. **Pengoperasian Online**: Arduino terhubung nirkabel melalui Wi-Fi langsung ke internet, sehingga **laptop tidak perlu dicolokkan ke Arduino**.
6. **Desain Cerdas & Hemat Penyimpanan**: Server backend hanya menyimpan log ke database jika **status cuaca berubah** (misal dari Cerah ke Gerimis), menghindari pemborosan memori akibat ribuan data duplikat yang sama.

---

## 🔌 Panduan Perakitan Hardware (Pin Mapping)

Gunakan mikrokontroler Wi-Fi murah seperti **ESP8266 NodeMCU** or **ESP32**. Berikut adalah skema koneksi kabel default:

### 1. ESP8266 NodeMCU & Sensor Hujan
| Pin Sensor Hujan | Pin ESP8266 NodeMCU | Deskripsi |
| :--- | :--- | :--- |
| **VCC** | **3V3** (atau 3.3V) | Catu Daya Sensor (3.3 Volt) |
| **GND** | **GND** | Ground bersama |
| **AO** (Analog Out) | **A0** (Analog In) | Membaca tingkat kebasahan secara presisi |
| **DO** (Digital Out) | *Tidak digunakan* | Output digital bawaan sensor tidak dipakai |

### 2. ESP8266 NodeMCU & Buzzer Aktif (Lokal Alarm)
| Pin Buzzer Aktif | Pin ESP8266 NodeMCU | Deskripsi |
| :--- | :--- | :--- |
| **Kaki Positif (+)** (Kabel Merah / Kaki Panjang) | **D5** (GPIO 14) | Sinyal kontrol bunyi dari Arduino |
| **Kaki Negatif (-)** (Kabel Hitam / Kaki Pendek) | **GND** | Ground bersama |

> [!NOTE]
> Jika Anda menggunakan **ESP32**, Anda dapat menghubungkan pin Analog Out sensor ke pin **GPIO 34** (ADC1_CH6) dan kaki Positif Buzzer ke pin **GPIO 18**, lalu sesuaikan nomor pin tersebut di bagian atas sketch Arduino (`jemuran_sensor.ino`).

---

## 💻 Struktur Folder Proyek
```text
1monitoring-jemuran/
├── backend/
│   ├── database.js            # Inisialisasi & Query Database SQLite
│   ├── server.js              # Express API Server & Static Server
│   ├── laundry_monitor.db     # File Database SQLite (dibuat otomatis)
│   └── package.json           # Dependensi Node.js Backend
├── frontend/
│   ├── index.html             # Antarmuka Dashboard Premium
│   ├── style.css              # Styling Modern & Efek Hujan CSS
│   └── app.js                 # Logika Pengambilan Data Real-Time & Alarm Browser
├── arduino/
│   └── jemuran_sensor/
│       └── jemuran_sensor.ino # Sketch Arduino ESP8266/ESP32
└── README.md                  # Dokumentasi Utama Proyek ini
```

---

## 🚀 Langkah Instalasi & Menjalankan Secara Lokal

### 1. Menjalankan Server Backend dan Web Dashboard
Di terminal komputer Anda (PowerShell / Command Prompt):

1. Masuk ke folder backend:
   ```bash
   cd D:\1monitoring-jemuran\backend
   ```
2. Instal dependensi Node.js:
   ```bash
   npm install
   ```
3. Jalankan server:
   ```bash
   npm start
   ```
4. Server akan aktif di port `5000`. Buka browser Anda dan akses:
   ```text
   http://localhost:5000
   ```
   *Anda akan langsung melihat Dashboard Web Premium dengan data riwayat contoh yang menawan!*

---

## 🧪 Cara Pengujian API Tanpa Hardware (Simulasi)

Anda dapat menguji perubahan dashboard secara langsung tanpa merakit hardware dengan mengirimkan simulasi data sensor hujan menggunakan **PowerShell** di Windows Anda:

1. **Simulasi CUACA CERAH / KERING** (Nilai sensor > 750):
   Buka terminal PowerShell baru dan jalankan:
   ```powershell
   Invoke-RestMethod -Uri http://localhost:5000/api/weather -Method Post -Body '{"rain_value": 980}' -ContentType "application/json"
   ```
2. **Simulasi CUACA GERIMIS** (Nilai sensor 350 - 750):
   ```powershell
   Invoke-RestMethod -Uri http://localhost:5000/api/weather -Method Post -Body '{"rain_value": 550}' -ContentType "application/json"
   ```
3. **Simulasi CUACA HUJAN LEBAT** (Nilai sensor < 350):
   ```powershell
   Invoke-RestMethod -Uri http://localhost:5000/api/weather -Method Post -Body '{"rain_value": 150}' -ContentType "application/json"
   ```

*Perhatikan saat Anda mengirim perintah-perintah di atas:*
- Dashboard web akan langsung berubah warna sesuai tema (Hijau/Kuning/Merah).
- Jika status berubah menjadi **HUJAN**, sirene darurat di browser laptop/HP Anda akan berbunyi seketika dan banner peringatan merah menyala akan berkedip.
- Log riwayat pada tabel bawah akan langsung mencatat baris baru secara otomatis.

---

## ☁️ Panduan Deploy Online Secara Global (Gratis)

Agar sistem ini dapat diakses secara online dari mana saja dan ESP8266/ESP32 dapat mengirim data langsung lewat internet tanpa perlu dicolokkan ke laptop Anda, ikuti langkah berikut:

### Langkah 1: Push Proyek ke GitHub
1. Buat repositori baru di akun GitHub Anda (misal namanya: `laundry-monitoring-iot`).
2. Di dalam folder utama proyek Anda, inisialisasi Git, commit semua file, dan push ke GitHub Anda.

### Langkah 2: Deploy ke Render.com (Layanan Cloud Gratis)
1. Daftarkan akun gratis di [Render.com](https://render.com) (hubungkan dengan GitHub Anda).
2. Di halaman Dashboard Render, klik **New** -> **Web Service**.
3. Pilih repositori GitHub Anda (`laundry-monitoring-iot`).
4. Atur konfigurasi berikut:
   - **Name**: `laundry-protector-iot` (atau nama bebas Anda)
   - **Environment**: `Node`
   - **Region**: Pilih wilayah terdekat (misalnya `Singapore` untuk koneksi cepat dari Indonesia)
   - **Branch**: `main` (atau `master`)
   - **Root Directory**: `backend` *(Sangat penting! Karena file package.json ada di folder backend)*
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan Type**: `Free`
5. Klik **Create Web Service**.
6. Tunggu sekitar 2-4 menit sampai Render selesai mem-build dan menyajikan aplikasi Anda. Setelah selesai, Render akan memberikan URL publik gratis Anda, contoh:
   `https://laundry-protector-iot.onrender.com`

*Selamat! Sekarang Web Dashboard Anda sudah online di internet global! Anda bisa membukanya melalui smartphone atau komputer dari manapun.*

### Langkah 3: Konfigurasi Sketch Arduino Anda
1. Buka sketch `arduino/jemuran_sensor/jemuran_sensor.ino` pada Arduino IDE Anda.
2. Edit baris Wi-Fi dengan memasukkan nama Wi-Fi rumah atau hotspot handphone Anda:
   ```cpp
   const char* ssid = "WIFI_RUMAH_ANDA";
   const char* password = "PASSWORD_WIFI_ANDA";
   ```
3. Edit URL Server dengan memasukkan URL publik yang Anda dapatkan dari Render (pastikan mengarah ke `/api/weather`):
   ```cpp
   const char* serverUrl = "https://laundry-protector-iot.onrender.com/api/weather";
   ```
4. Upload program ke board ESP8266/ESP32 Anda!
5. Pasang baterai atau colokkan adaptor charger HP biasa ke ESP8266/ESP32 Anda dan taruh di area jemuran secara nirkabel. Sekarang alat Anda akan berjalan secara online 24 jam penuh tanpa memerlukan koneksi kabel ke laptop!
