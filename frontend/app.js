/*
  =========================================
  FRONTEND APP LOGIC - JEMURAN PINTAR
  =========================================
*/

// Configuration
const API_URL = 'https://monitoring-kel9-jemuran-fix-production.up.railway.app'; // Relative path, works automatically when served by Express
const POLL_INTERVAL = 2000; // Polling data cuaca (2 detik)
const HISTORY_INTERVAL = 10000; // Polling riwayat cuaca (10 detik)

// State Variables
let currentStatus = 'CERAH';
let alarmLoopInterval = null;
let isMuted = false;
let isOffline = false;
let audioContext = null;

// DOM Elements
const body = document.body;
const connectionBadge = document.getElementById('connection-badge');
const connectionText = document.getElementById('connection-text');
const dangerBanner = document.getElementById('danger-banner');
const lastUpdateTime = document.getElementById('last-update-time');
const weatherIconContainer = document.getElementById('weather-icon-container');
const weatherStatusText = document.getElementById('weather-status');
const laundryConditionText = document.getElementById('laundry-condition');
const rawSensorValText = document.getElementById('raw-sensor-val');
const gaugePercentText = document.getElementById('gauge-percent');
const gaugeFillCircle = document.getElementById('gauge-fill-circle');
const alarmTitle = document.getElementById('alarm-title');
const alarmSubtitle = document.getElementById('alarm-subtitle');
const soundIcon = document.getElementById('sound-icon');
const soundText = document.getElementById('sound-text');
const historyTableBody = document.getElementById('history-table-body');
const rainParticlesContainer = document.getElementById('rain-particles');

// Buttons
const btnTestAlarm = document.getElementById('btn-test-alarm');
const btnToggleSound = document.getElementById('btn-toggle-sound');
const btnClearHistory = document.getElementById('btn-clear-history');
const btnRefreshHistory = document.getElementById('btn-refresh-history');

/* 
  =========================================
  1. PROGRAMMATIC SYNTHESIZER (Web Audio API)
  =========================================
  Membuat suara alarm lokal tanpa memerlukan file mp3 eksternal.
*/
function initAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playBeep(frequency = 880, duration = 0.15, type = 'sine') {
  try {
    initAudio();
    if (isMuted || !audioContext) return;
    
    // Resume context jika dalam keadaan suspended (kebijakan browser)
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = type;
    osc.frequency.value = frequency;

    // Custom gain envelope (fade out halus agar suara profesional)
    gain.gain.setValueAtTime(0.3, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

    osc.connect(gain);
    gain.connect(audioContext.destination);

    osc.start();
    osc.stop(audioContext.currentTime + duration);
  } catch (error) {
    console.error('Gagal membunyikan alarm browser:', error);
  }
}

// Alarm Beep Berulang
function startAlarmSound() {
  if (alarmLoopInterval) return; // Sudah berjalan

  alarmLoopInterval = setInterval(() => {
    // Bunyikan nada sirene ganda (Tee-Too Tee-Too)
    playBeep(980, 0.2, 'triangle');
    setTimeout(() => {
      playBeep(780, 0.2, 'triangle');
    }, 250);
  }, 600);
}

function stopAlarmSound() {
  if (alarmLoopInterval) {
    clearInterval(alarmLoopInterval);
    alarmLoopInterval = null;
  }
}

/* 
  =========================================
  2. DYNAMIC RAIN PARTICLES GENERATOR
  =========================================
  Membuat efek tetesan hujan jatuh pada layar saat cuaca HUJAN.
*/
function setupRainEffect(isActive) {
  rainParticlesContainer.innerHTML = '';
  if (!isActive) return;

  const dropCount = 40;
  for (let i = 0; i < dropCount; i++) {
    const drop = document.createElement('div');
    drop.classList.add('rain-drop');
    
    // Mengacak posisi dan kecepatan jatuh agar natural
    drop.style.left = Math.random() * 100 + 'vw';
    drop.style.animationDuration = 0.5 + Math.random() * 0.8 + 's';
    drop.style.animationDelay = Math.random() * 2 + 's';
    drop.style.opacity = 0.1 + Math.random() * 0.6;
    drop.style.height = 30 + Math.random() * 40 + 'px';
    
    rainParticlesContainer.appendChild(drop);
  }
}

/* 
  =========================================
  3. REAL-TIME DATA BINDING
  =========================================
*/

// Fungsi Memformat Timestamp ke format WIB (Waktu Indonesia Barat)
function formatTimeWIB(isoString) {
  const d = new Date(isoString);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes} WIB`;
}

function formatDate(isoString) {
  const d = new Date(isoString);
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

// Memperbarui UI berdasarkan status cuaca terbaru
function updateDashboardUI(data) {
  const prevStatus = currentStatus;
  currentStatus = data.status;

  // 1. Ubah Theme Body
  body.className = ''; // Hapus kelas tema sebelumnya
  if (currentStatus === 'HUJAN') {
    body.classList.add('theme-rain');
    dangerBanner.classList.remove('hide');
    alarmTitle.textContent = 'ALARM AKTIF!';
    alarmSubtitle.textContent = 'Hujan terdeteksi! Buzzer berbunyi.';
    
    // Mainkan alarm browser
    startAlarmSound();
    
    // Hidupkan animasi rintik hujan jika baru masuk ke status HUJAN
    if (prevStatus !== 'HUJAN') {
      setupRainEffect(true);
    }
  } else if (currentStatus === 'GERIMIS') {
    body.classList.add('theme-drizzle');
    dangerBanner.classList.add('hide');
    alarmTitle.textContent = 'Status Siaga';
    alarmSubtitle.textContent = 'Gerimis kecil, bersiap angkat jemuran.';
    
    stopAlarmSound();
    setupRainEffect(false);
  } else {
    body.classList.add('theme-sunny');
    dangerBanner.classList.add('hide');
    alarmTitle.textContent = 'Sistem Siaga';
    alarmSubtitle.textContent = 'Cuaca cerah. Sensor aktif memantau.';
    
    stopAlarmSound();
    setupRainEffect(false);
  }

  // 2. Update Teks Status & Kondisi
  weatherStatusText.textContent = currentStatus;
  laundryConditionText.textContent = data.laundry_condition;
  lastUpdateTime.textContent = `Terakhir Update: ${formatTimeWIB(data.created_at)}`;

  // 3. Update Ikon Cuaca
  weatherIconContainer.innerHTML = '';
  const icon = document.createElement('i');
  icon.classList.add('fa-solid', 'weather-icon');
  
  if (currentStatus === 'HUJAN') {
    icon.classList.add('fa-cloud-showers-heavy', 'cloud-rain');
  } else if (currentStatus === 'GERIMIS') {
    icon.classList.add('fa-cloud-sun-rain', 'cloud-drizzle');
  } else {
    icon.classList.add('fa-sun', 'sun-glow');
  }
  weatherIconContainer.appendChild(icon);

  // 4. Update Nilai Sensor & Gauge Kebasahan
  const rawVal = data.rain_value;
  rawSensorValText.textContent = rawVal;
  
  // Mengonversi ADC (0-1023) ke tingkat kebasahan (%)
  // 1023 = kering total (0%), 0 = basah kuyup (100%)
  const wetnessPercent = Math.max(0, Math.min(100, Math.round(((1023 - rawVal) / 1023) * 100)));
  gaugePercentText.textContent = `${wetnessPercent}%`;

  // Animate Gauge SVG (stroke-dashoffset: 283 = 0%, 0 = 100%)
  const offset = 283 - (283 * wetnessPercent) / 100;
  gaugeFillCircle.style.strokeDashoffset = offset;
}

// Fetch Status Terkini dari API
async function fetchCurrentStatus() {
  try {
    const response = await fetch(`${API_URL}/api/weather/current`);
    if (!response.ok) throw new Error('API Response Error');
    
    const data = await response.json();
    
    // Perbarui Connection Badge ke Online
    if (isOffline) {
      isOffline = false;
      connectionBadge.querySelector('.pulse-dot').className = 'pulse-dot online';
      connectionText.textContent = 'Terkoneksi';
    }

    updateDashboardUI(data);
  } catch (error) {
    console.error('Error saat mengambil data cuaca:', error);
    // Set Connection Badge ke Offline
    isOffline = true;
    connectionBadge.querySelector('.pulse-dot').className = 'pulse-dot offline';
    connectionText.textContent = 'Terputus';
  }
}

// Fetch Riwayat Cuaca
async function fetchHistory() {
  try {
    const response = await fetch(`${API_URL}/api/weather/history`);
    if (!response.ok) throw new Error('API History Error');

    const historyData = await response.json();
    
    // Kosongkan Tabel
    historyTableBody.innerHTML = '';

    if (historyData.length === 0) {
      historyTableBody.innerHTML = `<tr><td colspan="6" class="text-center">Belum ada riwayat data cuaca.</td></tr>`;
      return;
    }

    historyData.forEach((row) => {
      let badgeClass = 'badge-sunny';
      let conditionText = 'Aman / Sedang Menjemur';

      if (row.status === 'HUJAN') {
        badgeClass = 'badge-rain';
        conditionText = 'Segera Angkat!';
      } else if (row.status === 'GERIMIS') {
        badgeClass = 'badge-drizzle';
        conditionText = 'Siaga / Lembab';
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>#${row.id}</td>
        <td>${formatDate(row.created_at)}</td>
        <td>${formatTimeWIB(row.created_at)}</td>
        <td><span class="badge ${badgeClass}">${row.status}</span></td>
        <td><strong>${row.rain_value}</strong></td>
        <td>${conditionText}</td>
      `;
      historyTableBody.appendChild(tr);
    });
  } catch (error) {
    console.error('Error saat mengambil riwayat cuaca:', error);
    historyTableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Gagal memuat riwayat data.</td></tr>`;
  }
}

/* 
  =========================================
  4. INTERACTIVE ACTIONS (Event Listeners)
  =========================================
*/

// Tombol Tes Alarm Browser
btnTestAlarm.addEventListener('click', () => {
  initAudio();
  // Bunyikan test beep ganda cepat
  playBeep(1200, 0.1, 'sine');
  setTimeout(() => {
    playBeep(1200, 0.1, 'sine');
  }, 120);
  
  // Efek getaran visual tombol
  btnTestAlarm.classList.add('pulse');
  setTimeout(() => btnTestAlarm.classList.remove('pulse'), 500);
});

// Tombol Mute / Unmute
btnToggleSound.addEventListener('click', () => {
  initAudio();
  isMuted = !isMuted;
  if (isMuted) {
    soundIcon.className = 'fa-solid fa-volume-high';
    soundText.textContent = 'Aktifkan Suara';
    btnToggleSound.style.background = 'rgba(239, 68, 68, 0.1)';
    btnToggleSound.style.borderColor = 'rgba(239, 68, 68, 0.2)';
  } else {
    soundIcon.className = 'fa-solid fa-volume-xmark';
    soundText.textContent = 'Mute Suara';
    btnToggleSound.style.background = '';
    btnToggleSound.style.borderColor = '';
  }
});

// Tombol Refresh Riwayat
btnRefreshHistory.addEventListener('click', () => {
  fetchHistory();
  // Animasi berputar tombol refresh
  const icon = btnRefreshHistory.querySelector('i');
  icon.classList.add('fa-spin');
  setTimeout(() => icon.classList.remove('fa-spin'), 650);
});

// Tombol Hapus Riwayat Database
btnClearHistory.addEventListener('click', async () => {
  const confirmClear = confirm('Apakah Anda yakin ingin menghapus semua data riwayat cuaca?');
  if (!confirmClear) return;

  try {
    const response = await fetch(`${API_URL}/api/weather/clear`, {
      method: 'POST'
    });
    const result = await response.json();
    if (result.success) {
      alert('Riwayat berhasil dibersihkan.');
      fetchCurrentStatus();
      fetchHistory();
    } else {
      alert('Gagal membersihkan riwayat: ' + result.message);
    }
  } catch (error) {
    alert('Terjadi kesalahan jaringan saat menghapus riwayat.');
  }
});

// Aktivasi pertama kali di browser agar audio context aktif
document.addEventListener('click', () => {
  initAudio();
}, { once: true });

/* 
  =========================================
  5. INITIALIZATION & TIMERS
  =========================================
*/
fetchCurrentStatus();
fetchHistory();

// Set interval polling
setInterval(fetchCurrentStatus, POLL_INTERVAL);
setInterval(fetchHistory, HISTORY_INTERVAL);
