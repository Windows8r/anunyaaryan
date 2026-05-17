// Lokasi: src/utils/survivalLeveling.js
const UserSurvival = require('../models/UserSurvival');

// Gunakan fungsi murni agar tidak terkena error "this" context
function getExpRequirement(level) {
    // Memastikan input adalah angka (Integer)
    const lvl = parseInt(level) || 1;
    return lvl * lvl * 100; 
}

function getMaxStatCap(level) {
    const lvl = parseInt(level) || 1;
    return lvl * 5; 
}

async function addPlayerXP(userId, xpAmount) {
    const [survival] = await UserSurvival.findOrCreate({ where: { userId: userId } });
    
    // ✨ FIX: Mengunci tipe data menjadi Integer agar tidak tergabung sebagai Teks
    let currentLevel = parseInt(survival.survival_level) || 1;
    let currentXP = parseInt(survival.survival_xp) || 0;
    
    currentXP += parseInt(xpAmount);
    
    let reqXP = getExpRequirement(currentLevel);
    let hasLeveledUp = false;

    // ✨ FIX: Potong XP yang berlebih secara berulang sampai sesuai dengan batas level
    while (currentXP >= reqXP) {
        currentXP -= reqXP; // Sisa XP akan dibawa ke level berikutnya
        currentLevel++;
        hasLeveledUp = true;
        reqXP = getExpRequirement(currentLevel);
    }

    await UserSurvival.update({ 
        survival_xp: currentXP, 
        survival_level: currentLevel 
    }, { where: { userId: userId } });

    return {
        currentLevel,
        currentXP,
        reqXP,
        hasLeveledUp,
        maxStatCap: getMaxStatCap(currentLevel)
    };
}

module.exports = {
    getExpRequirement,
    getMaxStatCap,
    addPlayerXP
};