// src/managers/dbManager.js
const { Sequelize } = require('sequelize');
const env = require('../config/env');

// ==========================================
// 1. INISIALISASI KONEKSI DATABASE
// ==========================================
const sequelize = new Sequelize(
    env.DB_NAME, 
    env.DB_USER, 
    env.DB_PASS, 
    {
        host: env.DB_HOST,
        port: env.DB_PORT,
        dialect: 'mysql',
        logging: false, // Menjaga terminal tetap bersih dari spam query
        pool: { 
            max: 10,       // Ditingkatkan agar mendukung banyak user bersamaan
            min: 0, 
            acquire: 60000, // Diperpanjang menjadi 60 detik agar toleran terhadap server lambat
            idle: 10000 
        }
    }
);

// ==========================================
// 2. EKSPOR SEQUELIZE TERLEBIH DAHULU (SANGAT KRUSIAL)
// ==========================================
// PENTING: Ini harus diletakkan sebelum import model untuk mencegah error "Circular Dependency"
module.exports = { sequelize };


// ==========================================
// 3. IMPORT MODEL
// ==========================================
const UserProfile = require('../models/UserProfile');
const UserSurvival = require('../models/UserSurvival');
const UserPet = require('../models/UserPet');
const UserNPC = require('../models/UserNPC');
const UserChild = require('../models/UserChild'); // Model Anak dari fitur pernikahan
const GuildSettings = require('../models/GuildSettings');
const ModMail = require('../models/ModMail');
const UserFarm = require('../models/UserFarm');


// ==========================================
// 4. SETUP RELASI (ASSOCIATIONS)
// ==========================================
// 1 to 1: UserProfile -> UserSurvival
UserProfile.hasOne(UserSurvival, { foreignKey: 'userId', as: 'survival' });
UserSurvival.belongsTo(UserProfile, { foreignKey: 'userId' });

// 1 to Many: UserProfile -> UserPet (User bisa punya banyak pet)
UserProfile.hasMany(UserPet, { foreignKey: 'userId', as: 'pets' });
UserPet.belongsTo(UserProfile, { foreignKey: 'userId' });

// 1 to Many: UserProfile -> UserNPC (Interaksi NPC)
UserProfile.hasMany(UserNPC, { foreignKey: 'userId', as: 'npc_relations' });
UserNPC.belongsTo(UserProfile, { foreignKey: 'userId' });

// 1 to Many: UserProfile -> UserChild (Sistem Anak)
UserProfile.hasMany(UserChild, { foreignKey: 'userId', as: 'children' });
UserChild.belongsTo(UserProfile, { foreignKey: 'userId' });


UserProfile.hasMany(UserFarm, { foreignKey: 'userId', as: 'farms' });
UserFarm.belongsTo(UserProfile, { foreignKey: 'userId' });


// ==========================================
// 5. FUNGSI KONEKSI DAN SINKRONISASI TABEL
// ==========================================
const connectToDatabase = async () => {
    try {
        // Tahap 1: Verifikasi Autentikasi
        await sequelize.authenticate();
        
        // Tahap 2: Sinkronisasi Tabel (Ubah ke true JIKA hanya ingin sinkronisasi paksa saat tambah kolom baru)
        await sequelize.sync({ alter: false }); 
        
        // Migrasi manual untuk mannersPoint agar tidak merusak data lama
        try { await sequelize.query('ALTER TABLE UserLevelings ADD COLUMN mannersPoint INT DEFAULT 100;'); } catch (e) { /* Abaikan jika sudah ada */ }
        
        return true; 
    } catch (error) {
        console.error('\n\x1b[41m\x1b[37m 💥 DATABASE ERROR \x1b[0m \x1b[31mKoneksi MySQL ditolak atau terputus:\x1b[0m');
        console.error(error.message);
        console.error('\x1b[33mBot akan terus berjalan dan mencoba reconnect secara berkala.\x1b[0m');
        return false;
    }
};

// Tambahkan fungsi connectToDatabase ke dalam module.exports yang sudah ada
module.exports.connectToDatabase = connectToDatabase;


// ==========================================
// 6. ANTI-SLEEP & AUTO-RECONNECT MECHANISM
// ==========================================
setInterval(async () => {
    try {
        await sequelize.query('SELECT 1');
    } catch (err) {
        console.error('\x1b[33m[DB MONITOR]\x1b[0m Koneksi terputus! Mencoba reconnect...');
        try {
            await sequelize.authenticate();
            console.log('\x1b[42m\x1b[30m ✨ DB RECONNECT \x1b[0m \x1b[32mBerhasil terhubung kembali ke MySQL.\x1b[0m');
        } catch (reconnectErr) {
            console.error('\x1b[41m\x1b[37m 💥 DATABASE OFFLINE \x1b[0m \x1b[31mKoneksi MySQL terputus total: ' + reconnectErr.message + '\x1b[0m');
        }
    }
}, 60000 * 15); // Ping setiap 15 menit