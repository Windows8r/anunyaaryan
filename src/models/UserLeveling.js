// Lokasi: src/utils/survivalLeveling.js
const UserSurvival = require('../models/UserSurvival');

module.exports = {
    // Menghitung total XP yang dibutuhkan untuk ke level berikutnya (Eksponensial)
    getExpRequirement: function(level) {
        return level * level * 100; 
    },

    // Menghitung batas maksimal status (Strength, Agility, dll) berdasarkan level
    getMaxStatCap: function(level) {
        return level * 5; 
    },

    // Menambah XP dan mengecek apakah player naik level
    addPlayerXP: async function(userId, xpAmount) {
        const [survival] = await UserSurvival.findOrCreate({ where: { userId: userId } });
        
        // ✨ PERBAIKAN 1: Gunakan survival_level sesuai database
        let currentLevel = survival.survival_level || 1; 
        let currentXP = (survival.survival_xp || 0) + xpAmount;
        let reqXP = this.getExpRequirement(currentLevel);
        let hasLeveledUp = false;

        // ✨ PERBAIKAN 2: Kurangi XP dengan reqXP jika level up, agar XP membawa sisa (misal 143-100 = 43)
        while (currentXP >= reqXP) {
            currentXP -= reqXP; // Kurangi XP yang sudah dipakai untuk level up
            currentLevel++;     // Naikkan level
            hasLeveledUp = true;
            reqXP = this.getExpRequirement(currentLevel); // Kalkulasi batas XP level baru
        }

        // Simpan data terbaru ke database
        await UserSurvival.update({ 
            survival_xp: currentXP, 
            survival_level: currentLevel // ✨ UPDATE sesuai nama kolom
        }, { where: { userId: userId } });

        return {
            currentLevel,
            currentXP,
            reqXP,
            hasLeveledUp,
            maxStatCap: this.getMaxStatCap(currentLevel)
        };
    }
};