// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Listener untuk data realtime dari websocket
    onEcgRealtime: (callback) => ipcRenderer.on('ecg-data-realtime', (event, data) => callback(data)),

    // Fungsi lama jika masih dibutuhkan
    requestEcgData: () => ipcRenderer.send('request-ecg-data'),

    saveRecord: (data) => ipcRenderer.invoke('save-to-db', data),
    getSources: () => ipcRenderer.invoke('get-sources'),

    startRecording: () => ipcRenderer.send('start-recording'),
    stopRecording: () => ipcRenderer.send('stop-recording'),

    getRecords: () => ipcRenderer.invoke('get-records'),
    openFileLocation: (path) => ipcRenderer.send('open-file-location', path),
    openEkgModal: (id) => ipcRenderer.invoke("open-ekg-modal", id),

    getRecordDetail: (id) => ipcRenderer.invoke('get-record-detail', id),
    onPassId: (callback) => ipcRenderer.on('pass-record-id', (event, id) => callback(id)),
    saveNote: (data) => ipcRenderer.invoke("save-note", data),

    // Tambahkan di dalam contextBridge.exposeInMainWorld
    deleteRecord: (id) => ipcRenderer.invoke('delete-record', id),
});