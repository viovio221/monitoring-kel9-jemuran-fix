const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'laundry_monitor.db');
let db;

// Inisialisasi Database
function initDb() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Gagal menghubungkan ke database SQLite:', err.message);
        return reject(err);
      }
      console.log('Terhubung ke database SQLite:', dbPath);
      createTables()
        .then(() => seedDummyData())
        .then(resolve)
        .catch(reject);
    });
  });
}

// Membuat tabel jika belum ada
function createTables() {
  return new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS weather_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        status TEXT NOT NULL,
        rain_value INTEGER NOT NULL,
        created_at TEXT NOT NULL
      )
    `, (err) => {
      if (err) {
        console.error('Gagal membuat tabel weather_history:', err.message);
        return reject(err);
      }
      resolve();
    });
  });
}

// Menambahkan data awal (seed) agar web terlihat cantik di awal
function seedDummyData() {
  return new Promise((resolve, reject) => {
    db.get('SELECT COUNT(*) as count FROM weather_history', (err, row) => {
      if (err) return reject(err);

      if (row.count === 0) {
        console.log('Database kosong. Mengisi data riwayat cuaca awal...');
        const stmt = db.prepare('INSERT INTO weather_history (status, rain_value, created_at) VALUES (?, ?, ?)');
        
        const now = new Date();
        const dummyData = [
          { status: 'CERAH', rain_value: 1023, offsetMinutes: 120 },
          { status: 'CERAH', rain_value: 1010, offsetMinutes: 105 },
          { status: 'GERIMIS', rain_value: 650, offsetMinutes: 90 },
          { status: 'HUJAN', rain_value: 280, offsetMinutes: 75 },
          { status: 'HUJAN', rain_value: 150, offsetMinutes: 60 },
          { status: 'GERIMIS', rain_value: 580, offsetMinutes: 45 },
          { status: 'CERAH', rain_value: 980, offsetMinutes: 30 },
          { status: 'CERAH', rain_value: 1015, offsetMinutes: 15 }
        ];

        dummyData.forEach((data) => {
          const time = new Date(now.getTime() - data.offsetMinutes * 60 * 1000);
          stmt.run(data.status, data.rain_value, time.toISOString());
        });

        stmt.finalize((err) => {
          if (err) {
            console.error('Gagal mengisi data seed:', err.message);
            return reject(err);
          }
          console.log('Berhasil mengisi data riwayat cuaca awal.');
          resolve();
        });
      } else {
        resolve();
      }
    });
  });
}

// Menambah riwayat cuaca baru
function addHistory(status, rainValue) {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString();
    const query = 'INSERT INTO weather_history (status, rain_value, created_at) VALUES (?, ?, ?)';
    db.run(query, [status, rainValue, timestamp], function(err) {
      if (err) {
        console.error('Gagal menyimpan riwayat cuaca:', err.message);
        return reject(err);
      }
      resolve({ id: this.lastID, status, rain_value: rainValue, created_at: timestamp });
    });
  });
}

// Mendapatkan status cuaca terakhir
function getCurrentStatus() {
  return new Promise((resolve, reject) => {
    const query = 'SELECT * FROM weather_history ORDER BY id DESC LIMIT 1';
    db.get(query, [], (err, row) => {
      if (err) return reject(err);
      
      if (!row) {
        // Fallback jika database benar-benar kosong
        return resolve({
          status: 'CERAH',
          rain_value: 1023,
          created_at: new Date().toISOString()
        });
      }
      resolve(row);
    });
  });
}

// Mendapatkan seluruh riwayat cuaca (limit default 50)
function getHistory(limit = 50) {
  return new Promise((resolve, reject) => {
    const query = 'SELECT * FROM weather_history ORDER BY id DESC LIMIT ?';
    db.all(query, [limit], (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

// Menghapus semua riwayat cuaca
function clearHistory() {
  return new Promise((resolve, reject) => {
    db.run('DELETE FROM weather_history', (err) => {
      if (err) return reject(err);
      // Tambahkan kembali satu data status cerah sebagai status default
      const timestamp = new Date().toISOString();
      db.run('INSERT INTO weather_history (status, rain_value, created_at) VALUES (?, ?, ?)', ['CERAH', 1023, timestamp], (err2) => {
        if (err2) return reject(err2);
        resolve();
      });
    });
  });
}

module.exports = {
  initDb,
  addHistory,
  getCurrentStatus,
  getHistory,
  clearHistory
};
