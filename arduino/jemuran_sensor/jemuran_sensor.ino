/*
  ========================================================================
  PROGRAM IOT: SISTEM MONITORING JEMURAN PINTAR (WI-FI CLIENT)
  ========================================================================
  Program ini dirancang untuk berjalan pada mikrokontroler berbasis Wi-Fi:
  - ESP8266 (NodeMCU / WeMos D1 Mini)
  - ESP32
  
  Fungsi:
  1. Menghubungkan mikrokontroler ke jaringan Wi-Fi rumah/hotspot.
  2. Membaca nilai analog dari Sensor Hujan (Analog Pin A0).
  3. Mengirimkan data pembacaan sensor ke Server Cloud secara online via HTTP POST.
  4. Menerima respon balik dari server. Jika status cuaca HUJAN, server
     mengembalikan data "alarm_active: true", dan program akan membunyikan
     Buzzer fisik secara otomatis.
  5. Sebagai fitur keamanan (fail-safe), jika Wi-Fi terputus, Buzzer akan
     tetap berbunyi jika sensor membaca air hujan (secara offline).
  ========================================================================
*/

// Mendeteksi otomatis jenis board (ESP8266 vs ESP32) untuk loading library yang tepat
#if defined(ESP8266)
  #include <ESP8266WiFi.h>
  #include <ESP8266HTTPClient.h>
#elif defined(ESP32)
  #include <WiFi.h>
  #include <HTTPClient.h>
#else
  #error "Board tidak didukung! Harap gunakan board berbasis ESP8266 atau ESP32 pada Arduino IDE."
#endif

#include <WiFiClient.h>

// ==========================================
// KONSENTRASI KONFIGURASI PENGGUNA
// ==========================================
// 1. Pengaturan Wi-Fi (Sesuaikan dengan Wi-Fi Anda)
const char* ssid = "NAMA_WIFI_ANDA";
const char* password = "PASSWORD_WIFI_ANDA";

// 2. Pengaturan Server API
// - Jika diuji LOKAL (satu jaringan Wi-Fi): Ganti dengan IP laptop Anda (contoh: http://192.168.1.100:5000/api/weather)
// - Jika sudah DEPLOY ONLINE: Ganti dengan URL server hasil deploy Anda (contoh: http://jemuran-pintar.render.com/api/weather)
const char* serverUrl = "http://ALAMAT_SERVER_DEPLOYYAN_ANDA/api/weather";

// 3. Konfigurasi Pin Hardware
const int RAIN_SENSOR_PIN = A0; // Pin Analog sensor hujan
const int BUZZER_PIN = D5;      // Pin Digital Buzzer (Untuk ESP8266 D5 = GPIO14, untuk ESP32 ubah ke pin digital seperti 18)

// 4. Interval Pengiriman Data (5000 milidetik = 5 detik)
const unsigned long sendInterval = 5000;
unsigned long lastSendTime = 0;

void setup() {
  // Inisialisasi Serial Monitor untuk debugging
  Serial.begin(115200);
  delay(10);
  
  Serial.println("\n=============================================");
  Serial.println("🤖 SISTEM MONITORING JEMURAN PINTAR IoT START");
  Serial.println("=============================================");

  // Inisialisasi Pin Hardware
  pinMode(RAIN_SENSOR_PIN, INPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW); // Matikan buzzer di awal

  // Memulai Koneksi Wi-Fi
  connectWiFi();
}

void loop() {
  // Pastikan Wi-Fi tetap terhubung, jika putus maka re-koneksi otomatis
  if (WiFi.status() != WL_CONNECTED) {
    digitalWrite(BUZZER_PIN, LOW); // Matikan buzzer saat re-koneksi agar tidak mengganggu
    connectWiFi();
  }

  // Mengirim data secara berkala sesuai interval
  unsigned long currentMillis = millis();
  if (currentMillis - lastSendTime >= sendInterval) {
    lastSendTime = currentMillis;

    // 1. Membaca Sensor Hujan Analog (Nilai berkisar antara 0 - 1023)
    // - Nilai 1023 = Kering / Cerah
    // - Semakin basah sensor terkena air, nilainya akan semakin MENDEKATI 0
    int sensorValue = analogRead(RAIN_SENSOR_PIN);
    Serial.print("\n[SENSOR] Pembacaan Sensor Hujan (ADC): ");
    Serial.println(sensorValue);

    // 2. Mengirimkan Data Pembacaan Sensor ke Server API
    sendDataToServer(sensorValue);
  }
}

// Fungsi Koneksi Wi-Fi
void connectWiFi() {
  Serial.print("[WIFI] Menghubungkan ke Wi-Fi: ");
  Serial.println(ssid);
  
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  // Menunggu koneksi tersambung sambil mengedipkan LED internal
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WIFI] Berhasil Terhubung!");
    Serial.print("[WIFI] Alamat IP Local Board Anda: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WIFI] Gagal terhubung ke Wi-Fi. Program tetap berjalan offline.");
    // Fail-safe Offline: Jika sensor hujan mendeteksi air secara offline, bunyikan alarm
    offlineFailSafe();
  }
}

// Fungsi Pengiriman Data via HTTP POST
void sendDataToServer(int sensorVal) {
  WiFiClient client;
  HTTPClient http;

  Serial.print("[HTTP] Menghubungkan ke Server API: ");
  Serial.println(serverUrl);

  // Memulai koneksi HTTP
  if (http.begin(client, serverUrl)) {
    http.addHeader("Content-Type", "application/json");

    // Membuat Payload JSON sederhana: {"rain_value": 1023}
    String jsonPayload = "{\"rain_value\":" + String(sensorVal) + "}";
    
    Serial.print("[HTTP] Mengirim data payload: ");
    Serial.println(jsonPayload);

    // Mengirim HTTP POST
    int httpResponseCode = http.POST(jsonPayload);

    if (httpResponseCode > 0) {
      Serial.print("[HTTP] Sukses! Respon Kode: ");
      Serial.println(httpResponseCode);
      
      String responseBody = http.getString();
      Serial.print("[HTTP] Respon Balik Server: ");
      Serial.println(responseBody);

      // Memeriksa apakah status cuaca adalah HUJAN dari respon server.
      // Untuk menghemat memori mikrokontroler tanpa menginstall library ArduinoJSON tambahan,
      // kita cukup melakukan pencarian string (substring search) pada respon JSON server.
      if (responseBody.indexOf("\"alarm_active\":true") != -1 || responseBody.indexOf("\"status\":\"HUJAN\"") != -1) {
        Serial.println("[ALARM] HUJAN terdeteksi oleh server! Bunyikan alarm buzzer!");
        bunyikanBuzzer(true);
      } else {
        Serial.println("[ALARM] Cuaca aman/gerimis saja. Buzzer mati.");
        bunyikanBuzzer(false);
      }
    } else {
      Serial.print("[HTTP] Gagal mengirim POST. Kode error: ");
      Serial.println(http.errorToString(httpResponseCode).c_str());
      
      // Jika komunikasi server gagal, gunakan logika offline sebagai backup keselamatan
      offlineFailSafe();
    }
    
    http.end(); // Akhiri sesi HTTP
  } else {
    Serial.println("[HTTP] Gagal menginisialisasi HTTP client.");
    offlineFailSafe();
  }
}

// Logika Keamanan Offline (Fail-Safe)
// Berjalan jika Wi-Fi mati atau Server Down
void offlineFailSafe() {
  int sensorValue = analogRead(RAIN_SENSOR_PIN);
  Serial.println("[FAIL-SAFE] Menjalankan mode kontrol lokal offline...");
  
  // Threshold lokal darurat (jika nilai sensor < 350 berarti hujan lebat terdeteksi)
  if (sensorValue < 350) {
    Serial.println("[FAIL-SAFE-ALARM] Hujan terdeteksi secara lokal! Bunyikan buzzer!");
    bunyikanBuzzer(true);
  } else {
    bunyikanBuzzer(false);
  }
}

// Fungsi Mengontrol Buzzer Fisik
void bunyikanBuzzer(bool status) {
  if (status) {
    // Bunyikan buzzer secara intermiten (bip.. bip.. bip..) agar menarik perhatian
    digitalWrite(BUZZER_PIN, HIGH);
    delay(150);
    digitalWrite(BUZZER_PIN, LOW);
    delay(150);
    digitalWrite(BUZZER_PIN, HIGH);
    delay(150);
    digitalWrite(BUZZER_PIN, LOW);
  } else {
    digitalWrite(BUZZER_PIN, LOW);
  }
}
