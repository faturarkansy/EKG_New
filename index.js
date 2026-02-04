const { app, BrowserWindow, ipcMain, desktopCapturer } = require("electron"); // Menambahkan ipcMain
const path = require("path");
const WebSocket = require("ws");
const sqlite3 = require('sqlite3').verbose(); // Import sqlite3
const fs = require('fs'); // Import filesystem

let db;
let mainWindow;
let socket;
let isRecording = false;
let recordedPackets = [];

let ekgModalWindow = null;

ipcMain.handle('get-record-detail', async (event, id) => {
  return new Promise((resolve, reject) => {
    db.get("SELECT * FROM rekaman WHERE id = ?", [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
});

function createEkgModal(recordId) {
  ekgModalWindow = new BrowserWindow({
    width: 1100,
    height: 650,
    parent: mainWindow,   // ⬅️ penting: jadikan modal
    modal: true,
    show: false,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  ekgModalWindow.loadFile("ekg-modal.html");

  ekgModalWindow.once("ready-to-show", () => {
    ekgModalWindow.show();
    // Kirim ID ke jendela modal setelah siap
    ekgModalWindow.webContents.send("pass-record-id", recordId);
  });

  ekgModalWindow.on("closed", () => {
    ekgModalWindow = null;
  });
}

// --- INISIALISASI DATABASE ---
function initDatabase() {
  const dbPath = path.join(app.getPath('userData'), 'ekg_data.db');

  console.log("DB Path:", dbPath);

  // Pastikan folder ada
  if (!fs.existsSync(app.getPath('userData'))) {
    fs.mkdirSync(app.getPath('userData'), { recursive: true });
  }

  db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error("❌ Gagal membuka database:", err.message);
    } else {
      console.log("✅ Database berhasil dibuka");
    }
  });

  db.run(`CREATE TABLE IF NOT EXISTS rekaman (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nama TEXT,
      tanggal_lahir TEXT,
      jenis_kelamin TEXT,
      umur INTEGER,
      tenaga_medis TEXT,
      rekaman_grafik TEXT,
      video_path TEXT,
      note TEXT,
      waktu DATETIME DEFAULT (datetime('now','localtime'))
  )`);
}

// IPC Handler untuk mendapatkan daftar sumber layar (perekaman)
ipcMain.handle('get-sources', async () => {
  const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
  return sources;
});

// --- IPC HANDLER UNTUK DATABASE & FILE ---
ipcMain.handle('save-to-db', async (event, data) => {
  const filePath = path.join(app.getPath('downloads'), data.fileName);
  try {
    fs.writeFileSync(filePath, Buffer.from(data.videoBuffer));
    const rekamanGrafikText = recordedPackets.join("\n");

    // Ambil waktu lokal sekarang dalam format string (YYYY-MM-DD HH:MM:SS)
    const now = new Date();
    const localTime = now.getFullYear() + "-" +
      String(now.getMonth() + 1).padStart(2, '0') + "-" +
      String(now.getDate()).padStart(2, '0') + " " +
      String(now.getHours()).padStart(2, '0') + ":" +
      String(now.getMinutes()).padStart(2, '0') + ":" +
      String(now.getSeconds()).padStart(2, '0');

    return new Promise((resolve, reject) => {
      db.run(
        // Tambahkan kolom 'waktu' di sini secara manual
        `INSERT INTO rekaman 
        (nama, tanggal_lahir, jenis_kelamin, umur, tenaga_medis, rekaman_grafik, video_path, waktu) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.nama,
          data.dob,
          data.gender,
          data.umur,
          data.tenagaMedis,
          rekamanGrafikText,
          filePath,
          localTime
        ],
        function (err) {
          if (err) reject(err);
          else resolve({ success: true });
        }
      );
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.on("start-recording", () => {
  isRecording = true;
  recordedPackets = []; // reset
  console.log("🎥 Mulai merekam data EKG...");
});

ipcMain.on("stop-recording", () => {
  isRecording = false;
  console.log("⏹️ Perekaman EKG dihentikan");
});

// Tambahkan handler ini di bagian IPC HANDLER UNTUK DATABASE & FILE
ipcMain.handle('get-records', async () => {
  return new Promise((resolve, reject) => {
    db.all("SELECT * FROM rekaman ORDER BY waktu DESC", [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
});

// Handler tambahan jika Anda ingin fitur "Unduh" membuka folder file tersebut
ipcMain.on('open-file-location', (event, filePath) => {
  const { shell } = require('electron');
  if (fs.existsSync(filePath)) {
    shell.showItemInFolder(filePath);
  } else {
    console.error("File tidak ditemukan:", filePath);
  }
});

// Tambahkan ini di bagian IPC Handler di index.js
ipcMain.handle('delete-record', async (event, id) => {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM rekaman WHERE id = ?", [id], function (err) {
      if (err) reject(err);
      else resolve({ success: true });
    });
  });
});

ipcMain.handle("open-ekg-modal", (event, recordId) => {
  createEkgModal(recordId);
});

ipcMain.handle("save-note", async (event, { id, note }) => {
  return new Promise((resolve, reject) => {
    db.run(
      "UPDATE rekaman SET note = ? WHERE id = ?",
      [note, id],
      function (err) {
        if (err) reject(err);
        else resolve({ success: true });
      }
    );
  });
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join(__dirname, 'assets/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile("index.html");
  // mainWindow.webContents.openDevTools(); // Diaktifkan jika perlu debug

  connectToWebSocket();
}

function connectToWebSocket() {
  const wsUrl = "ws://192.168.100.231:8765";
  socket = new WebSocket(wsUrl);

  socket.on("open", () => {
    console.log("✅ Terhubung ke Python WebSocket server:", wsUrl);
    socket.send("FRONTEND");
  });

  socket.on("message", (message) => {
    const byteLength = Buffer.byteLength(message);
    const packetSize = 33;
    const packetCount = byteLength / packetSize;

    // Log Ringkasan Utama
    // console.log(`\n=== Received Data: ${byteLength} bytes | Total Paket: ${packetCount} ===`);

    for (let i = 0; i < byteLength; i += packetSize) {
      try {
        if (message.readUInt8(i) === 0xAA && message.readUInt8(i + 1) === 0x55) {

          // 2. Extract Timestamp (4 Byte, Little Endian)
          // Catatan: Karena Python mengirim struct.pack('<f', ...), gunakan readFloatLE
          const timestamp = message.readFloatLE(i + 2);

          // 3. Extract Jumlah Channel (1 Byte)
          const nch = message.readUInt8(i + 6);

          // 4. Extract Data Channel (2 Byte per channel, Signed Little Endian)
          // Di dalam socket.on("message") pada index.js
          const values = [];
          for (let ch = 0; ch < nch; ch++) {
            const offset = i + 7 + (ch * 2);
            if (offset + 1 < byteLength) {
              // Bagi dengan 2048 agar kembali ke format float -1 s/d 1
              const valFloat = message.readInt16LE(offset) / 2048.0;
              values.push(valFloat.toFixed(8));
            }
          }

          const packetText =
            `Paket ke-${(i / packetSize) + 1} | ` +
            `timestamp : ${timestamp.toFixed(4)}, ` +
            `values : array([${values.join(', ')}])`;

          console.log(packetText);

          if (isRecording) {
            recordedPackets.push(packetText);
          }

        }
      } catch (err) {
        console.error("❌ Error parsing packet at offset", i, ":", err.message);
      }
    }

    if (mainWindow) {
      mainWindow.webContents.send("ecg-data-realtime", {
        raw: message,
        bytes: byteLength,
        packets: packetCount,
        timestamp: Date.now()
      });
    }
  });

  socket.on("close", () => {
    console.log("❌ Koneksi WebSocket tertutup. Mencoba reconnect...");
    setTimeout(connectToWebSocket, 3000);
  });

  socket.on("error", (err) => {
    console.error("⚠️ WebSocket error:", err.message);
  });
}

app.whenReady().then(() => {
  initDatabase();
  createWindow();
});

app.on("window-all-closed", () => {
  if (socket) socket.close();
  if (process.platform !== "darwin") app.quit();
});