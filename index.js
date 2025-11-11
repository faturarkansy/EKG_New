const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const WebSocket = require("ws"); // 🧩 Tambah modul WebSocket

let mainWindow;
let socket;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile("index.html");
  mainWindow.webContents.openDevTools(); // opsional, buat debugging

  // 🔌 Hubungkan ke WebSocket server Python
  connectToWebSocket();
}

function connectToWebSocket() {
  const wsUrl = "ws://localhost:8765";
  socket = new WebSocket(wsUrl);

  socket.on("open", () => {
    console.log("✅ Terhubung ke Python WebSocket server:", wsUrl);
    socket.send("FRONTEND"); // info ke server ini client frontend
  });

  socket.on("message", (message) => {
    const data = message.toString();
    console.log("📡 Data diterima:", data);

    // kirim ke frontend (renderer process)
    if (mainWindow) {
      mainWindow.webContents.send("ecg-data-realtime", data);
    }
  });

  socket.on("close", () => {
    console.log("❌ Koneksi WebSocket tertutup. Coba reconnect...");
    // reconnect otomatis setelah 3 detik
    setTimeout(connectToWebSocket, 3000);
  });

  socket.on("error", (err) => {
    console.error("⚠️ WebSocket error:", err.message);
  });
}

app.whenReady().then(createWindow);

// ✅ Bersihkan koneksi saat aplikasi ditutup
app.on("window-all-closed", () => {
  if (socket) socket.close();
  if (process.platform !== "darwin") app.quit();
});
