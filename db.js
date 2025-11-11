const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: 'localhost',     // ganti jika berbeda
  user: 'root',          // sesuaikan dengan user MySQL Anda
  password: '',          // sesuaikan password Anda
  database: 'ekg_app'    // nama database (akan dibuat di langkah berikutnya)
});

connection.connect(err => {
  if (err) {
    console.error('Gagal koneksi ke MySQL:', err.message);
  } else {
    console.log('Berhasil koneksi ke MySQL');
  }
});

module.exports = connection;
