const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Menyajikan folder frontend sebagai static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Variabel status in-memory untuk menyimpan kondisi terupdate secara instan
let currentMemoryStatus = {
  status: 'CERAH',
  rain_value: 1023,
  created_at: new Date().toISOString(),
  laundry_condition: 'Aman / Sedang Menjemur',
  alarm_active: false
};

// Helper untuk memetakan nilai sensor hujan ke status cuaca dan kondisi jemuran
function mapSensorData(rainValue) {
  let status = 'CERAH';
  let laundryCondition = 'Aman / Sedang Menjemur';
  let alarmActive = false;

  // Kalibrasi standar sensor hujan analog (0 - 1023)
  // Semakin kecil nilainya, semakin banyak air/basah
  if (rainValue < 350) {
    status = 'HUJAN';
    laundryCondition = 'Segera Angkat Pakaian!';
    alarmActive = true;
  } else if (rainValue < 750) {
    status = 'GERIMIS';
    laundryCondition = 'Jemuran Lembab / Pantau Cuaca';
    alarmActive = false;
  } else {
    status = 'CERAH';
    laundryCondition = 'Aman / Sedang Menjemur';
    alarmActive = false;
  }

  return { status, laundryCondition, alarmActive };
}

// 1. GET: Ambil status cuaca saat ini
app.get('/api/weather/current', async (req, res) => {
  try {
    // Selalu sinkronkan dengan database jika memori belum terisi
    if (!currentMemoryStatus.created_at) {
      const lastRow = await db.getCurrentStatus();
      const mapped = mapSensorData(lastRow.rain_value);
      currentMemoryStatus = {
        status: lastRow.status,
        rain_value: lastRow.rain_value,
        created_at: lastRow.created_at,
        laundry_condition: mapped.laundryCondition,
        alarm_active: mapped.alarmActive
      };
    }
    res.json(currentMemoryStatus);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 2. GET: Ambil riwayat kondisi cuaca
app.get('/api/weather/history', async (req, res) => {
  try {
    const history = await db.getHistory(50);
    res.json(history);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// 3. POST: Endpoint untuk ESP8266 / ESP32 atau simulasi
// Menerima POST request dengan body JSON: { "rain_value": 450 } atau query string
app.post('/api/weather', async (req, res) => {
  try {
    let rainValue = req.body.rain_value;

    // Fallback jika dikirim lewat query string (berguna untuk beberapa client mikrokontroler sederhana)
    if (rainValue === undefined && req.query.rain_value !== undefined) {
      rainValue = parseInt(req.query.rain_value);
    }

    if (rainValue === undefined || isNaN(rainValue)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nilai rain_value tidak valid atau tidak disertakan.' 
      });
    }

    const numericRainValue = parseInt(rainValue);
    const { status, laundryCondition, alarmActive } = mapSensorData(numericRainValue);

    // Ambil data status terakhir dari database untuk membandingkan perubahan status
    const lastEntry = await db.getCurrentStatus();
    
    let isStatusChanged = lastEntry.status !== status;
    let savedEntry = null;

    // Optimasi Cerdas: Hanya simpan ke database jika ada PERUBAHAN status cuaca
    // Ini mencegah database bengkak oleh pembacaan konstan dari Arduino
    if (isStatusChanged) {
      savedEntry = await db.addHistory(status, numericRainValue);
      console.log(`[Status Berubah] Cuaca: ${status} | Nilai Sensor: ${numericRainValue} (Disimpan ke DB)`);
    } else {
      console.log(`[Update Berkala] Cuaca tetap: ${status} | Nilai Sensor: ${numericRainValue}`);
    }

    // Selalu perbarui memory status saat ini untuk respons dashboard yang real-time
    currentMemoryStatus = {
      status: status,
      rain_value: numericRainValue,
      created_at: new Date().toISOString(),
      laundry_condition: laundryCondition,
      alarm_active: alarmActive
    };

    res.json({
      success: true,
      status_changed: isStatusChanged,
      current: currentMemoryStatus,
      message: isStatusChanged ? 'Status cuaca berubah & disimpan.' : 'Status stabil.'
    });

  } catch (error) {
    console.error('Error saat memproses data cuaca:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 4. POST: Hapus semua riwayat cuaca
app.post('/api/weather/clear', async (req, res) => {
  try {
    await db.clearHistory();
    const timestamp = new Date().toISOString();
    currentMemoryStatus = {
      status: 'CERAH',
      rain_value: 1023,
      created_at: timestamp,
      laundry_condition: 'Aman / Sedang Menjemur',
      alarm_active: false
    };
    console.log('Riwayat database telah dibersihkan.');
    res.json({ success: true, message: 'Riwayat berhasil dibersihkan.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Menginisialisasi Database & Menjalankan Server
db.initDb()
  .then(() => {
    // Sinkronkan status memori awal dari database
    return db.getCurrentStatus();
  })
  .then((lastRow) => {
    const mapped = mapSensorData(lastRow.rain_value);
    currentMemoryStatus = {
      status: lastRow.status,
      rain_value: lastRow.rain_value,
      created_at: lastRow.created_at,
      laundry_condition: mapped.laundryCondition,
      alarm_active: mapped.alarmActive
    };
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`\n======================================================`);
      console.log(`🚀 Server Sistem Monitoring Jemuran Pintar IoT aktif!`);
      console.log(`📂 URL Lokal: http://localhost:${PORT}`);
      console.log(`🌐 Dapat diakses di jaringan lokal oleh Arduino.`);
      console.log(`======================================================\n`);
    });
  })
  .catch((err) => {
    console.error('Gagal mengaktifkan server karena masalah database:', err);
    process.exit(1);
  });
