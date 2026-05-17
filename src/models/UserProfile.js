const { DataTypes } = require('sequelize');
const { sequelize } = require('../managers/dbManager');

const UserProfile = sequelize.define('UserProfile', {
    userId: { 
        type: DataTypes.STRING, 
        allowNull: false, 
        primaryKey: true 
    },
    afk_reason: { type: DataTypes.STRING, allowNull: true },
    afk_timestamp: { type: DataTypes.DATE, allowNull: true },
    
    // --- ECONOMY ---
    economy_wallet: { type: DataTypes.INTEGER, defaultValue: 0 },
    economy_bank: { type: DataTypes.INTEGER, defaultValue: 0 },
    
    // --- DATA FLEKSIBEL ---
    inventory: { type: DataTypes.JSON, defaultValue: [] },
    cooldowns: { type: DataTypes.JSON, defaultValue: {} },
    
    // --- MINIGAMES ---
    minigame_mathScore: { type: DataTypes.INTEGER, defaultValue: 0 },
    minigame_triviaScore: { type: DataTypes.INTEGER, defaultValue: 0 },
    minigame_rpsWin: { type: DataTypes.INTEGER, defaultValue: 0 },
    minigame_tttWin: { type: DataTypes.INTEGER, defaultValue: 0 },
    minigame_wordleWin: { type: DataTypes.INTEGER, defaultValue: 0 },
    minigame_duelScore: { type: DataTypes.INTEGER, defaultValue: 0 },

    isPremium: { type: DataTypes.BOOLEAN, defaultValue: false },
    premiumUntil: { type: DataTypes.DATE, allowNull: true },

    minecraft_ign: { type: DataTypes.STRING, allowNull: true },
    minecraft_playtime: { type: DataTypes.INTEGER, defaultValue: 0 },
    
    // --- MUSIC PROFILE ---
    music_tracksListened: { type: DataTypes.INTEGER, defaultValue: 0 },
    music_totalDurationMs: { type: DataTypes.BIGINT, defaultValue: 0 },
    music_favoriteGenre: { type: DataTypes.STRING, defaultValue: 'Belum Terdeteksi' },
    music_lastListened: { type: DataTypes.STRING, defaultValue: 'Belum ada lagu' },
    music_playlist: { type: DataTypes.JSON, defaultValue: [] },
    
    // ==========================================
    // 📊 DATA ANALITIK CANVAS (YANG SEBELUMNYA HILANG)
    // ==========================================
    music_topTrack: { type: DataTypes.JSON, defaultValue: { name: 'Belum ada data', durationMs: 0 } },
    music_topFriend: { type: DataTypes.JSON, defaultValue: { name: 'Belum mabar', durationMs: 0 } },
    music_topServer: { type: DataTypes.JSON, defaultValue: { name: 'Belum ada server', durationMs: 0 } },
    music_trackingData: { type: DataTypes.JSON, defaultValue: { tracks: {}, friends: {}, servers: {} } },
    
    // --- LEVELING ---
    leveling_xp: { type: DataTypes.INTEGER, defaultValue: 0 },
    leveling_level: { type: DataTypes.INTEGER, defaultValue: 1 },
    leveling_lastXp: { type: DataTypes.DATE, allowNull: true }
}, {
    tableName: 'user_profiles',
    timestamps: false 
});

module.exports = UserProfile;