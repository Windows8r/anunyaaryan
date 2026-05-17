# 🛠️ Action Plan: Optimasi & Perbaikan Naura Hoshino Core

Perlu diingat untuk selalu mengecheck semua hal sebelum mencentang to do list ini. Jika yang ada di list sudah teratasi langsung centang saja.

## 🔴 Prioritas Utama (Critical / Security / Core Features)
- [ ] **Pengaplikasian Redis Cache ke dalam systems**: Sambungkan redis cache yang ada pada Naura ke beberapa system Naura agar bisa memberikan performa terbaiknya.
- [ ] **Perbsikan di system greetings**: Saat selesai mensetup greetings terdapat bug emoji yang muncul ketika ada user masuk atau keluar di channel yang dipilih hanya memunculkan kata seperti {naura} dan lainnya.
- [ ] **Hapus Redundansi Deploy Command**: Hapus fungsi `syncCommandsToDiscord()` secara keseluruhan dari `index.js`.
- [ ] **Pindahkan Pemanggilan Deploy**: Pastikan hanya `CommandHandler.js` yang mengeksekusi `REST.put` ke Discord API.
- [ ] **Fix Silent Catch di Dashboard Loader**: Tambahkan `console.error(err.message)` pada blok `catch` saat memanggil `require('./dashboard.js')(client)` di `index.js`.
- [ ] **Perbaikan Deteksi DM Modmail**: Investigasi `messageCreate.js` atau `interactionCreate.js` beserta pengaturan *Gateway Intents* (`Partials.Channel`, `DirectMessages`, `MessageContent`) pada inisiasi `Client` agar sistem Modmail dapat menangkap dan merespons pesan yang masuk langsung ke DM Naura.
- [ ] **Perbaikan informasi di core commands**: Rubahlah semua informasi yang ada pada core.js menjadi sesuai dengan fitur yang sebenarnya ada di dalam kodingan dan cara mengeksekusi commandnya. Selain itu kaitkan dengan ui.js untuk emoji dan untuk ping bisa ditambahkan seperti Naura Core Systems yang berisi ping dengan discord, websocket dan sejenisnya. Kemudian Naura Memory Systems yang berisi ping dari database Mysql dan redis. Kemudian Naura Music & Audio Systems yang berisi lavalink ping (catatan: buat lavalinknya bisa menggunakan lebih dari 1 node sehingga akan berurutan ke bawah seperti Naura node 1,2 dst.). Terakhir Naura Intelligent Systems yang berisi Gemini Ping dan Verba ping. Semuanya buat dengan nama Naura untuk menonjolkan identitas dari bot ini.
- [ ] **Perombakan dashboard**: Rubahlah dashboard nya agar bisa disesuaikan tampilannya seperti di dalam file DESIGN.md
- [ ] **Penambahan command baru**: tambahkancommand baru seperti sticky message, automod yang di personalisasi lebih lanjut dengan fitur baru seperti poin tata krama agar member dapat menjaga sikap. Kemudian tambahkan autorole yang otomatis akan dipasangkan ketika member masuk ke server dan role yang bisa di setup dengan tombol agar bisa dipilih oleh member.

## 🟡 Prioritas Menengah (Stabilitas Sistem & Integrasi Modul)
- [ ] **Perbaikan Sistem Autoplay Music**: Analisis logika iterasi *queue* dan transisi lagu pada modul musik (terutama integrasi Lavalink atau *player manager*) yang menyebabkan sistem *autoplay* terhenti mendadak atau *error*.
- [ ] **Perbaikan Ekstraksi Spotify**: Evaluasi utilitas Spotify (`spotifyHelper.js`), periksa apakah *client credentials/token* yang digunakan masih valid, dan pastikan *regex* untuk menangkap dan mengurai URL *playlist/track* Spotify berfungsi sesuai struktur API terbaru.
- [ ] **Fix Silent Catch Webhook DM**: Pada `dashboard.js`, tambahkan `console.log()` ke dalam `catch(() => {})` di endpoint `/api/webhook/vote` dan `/api/webhook/saweria` agar tercatat jika bot gagal mengirim bukti transaksi (misal karena user menutup DM-nya).
- [ ] **Indikator DB Terputus**: Tambahkan `console.error` dengan warna peringatan pada blok *catch* fungsi `setInterval` di dalam `dbManager.js` agar developer sadar jika koneksi ke MySQL terputus.
- [ ] **Update Indikator Booting**: Ubah status variabel `sysStatus.cmds` di `index.js` dari `🟡 BACKGROUND` menjadi `🟢 LOADED` tepat setelah fungsi `commandHandler.load()` berhasil dieksekusi.

## 🟢 Prioritas Rendah (Performa & Optimasi)
- [ ] **Optimasi Polling Dashboard**: Ubah interval `setInterval(fetchStats, 5000)` di kode HTML pada `dashboard.js` menjadi setidaknya `30000` (30 detik) untuk menghemat pemakaian CPU server yang tidak perlu.
- [ ] **Struktur Uptime Dashboard**: Pastikan fungsi utilitas `formatUptime()` dapat menangani kondisi bot yang baru menyala (milisekon kecil) agar output yang dihasilkan lebih rapi (misalnya: "Baru saja mulai").
- [ ] **Pertimbangkan Mode `--deploy`**: Pisahkan mekanisme argumen *command line* agar proses pendaftaran *Slash Command* ke Discord API hanya terjadi jika dijalankan dengan perintah khusus (misal: `node index.js --deploy`), bukan dipaksa setiap kali server me-restart bot.
- [ ] **Penanganan Race Condition Premium**: Perketat logika penambahan waktu kedaluwarsa pada *webhook* donasi/vote menggunakan antrean (queue) atau *database transaction* agar data tidak tumpang tindih saat sistem menerima *request* bersamaan.
- [ ] **Update ke node.js versi yang lebih baru**: Jika memungkinkan, upgrade versi dari node.js ke versi yang lebih baru agar dapat menambahkan sesuatu yang baru ke dalam ekosistem Naura