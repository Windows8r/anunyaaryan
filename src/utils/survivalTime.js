// Lokasi: src/utils/survivalTime.js
const UserSurvival = require('../models/UserSurvival');
const UserProfile = require('../models/UserProfile'); // Ditambahkan untuk mengakses economy_wallet
const ui = require('../config/ui');

async function advanceTime(userId, hoursAdded) {
    const [survival] = await UserSurvival.findOrCreate({ where: { userId } });
    let newHour = (survival.inGameHour || 6) + hoursAdded;
    let newDay = survival.inGameDay || 1;
    
    let passedOut = false;
    let penaltyAmt = 0;

    // 🛑 CEK APAKAH MELEWATI TENGAH MALAM (BEGADANG)
    if (newHour >= 24) {
        passedOut = true;
        
        while (newHour >= 24) {
            newHour -= 24;
            newDay += 1;
        }
        
        // Pemain pingsan, terbangun jam 8 pagi keesokan harinya
        newHour = 8; 

        // 💸 Eksekusi Denda Pingsan (Memotong 20% Uang di Dompet)
        const profile = await UserProfile.findOne({ where: { userId } });
        if (profile) {
            penaltyAmt = Math.floor((profile.economy_wallet || 0) * 0.2); 
            await UserProfile.update({ 
                economy_wallet: Math.max(0, (profile.economy_wallet || 0) - penaltyAmt) 
            }, { where: { userId } });
        }

        // 🚑 Hukuman Fisik: Terbangun dalam kondisi lemas
        await UserSurvival.update({ 
            inGameHour: newHour, 
            inGameDay: newDay,
            hunger: 20,
            thirst: 20,
            stamina: 10
        }, { where: { userId } });

        return { hour: newHour, day: newDay, passedOut: true, penalty: penaltyAmt };
    }

    // Jika waktu berjalan normal (tidak lewat tengah malam)
    await UserSurvival.update({ inGameHour: newHour, inGameDay: newDay }, { where: { userId } });
    return { hour: newHour, day: newDay, passedOut: false, penalty: 0 };
}

function getTimeState(hour) {
    if (hour >= 6 && hour < 11) return { color: ui.colors?.time_morning || '#FDE047', emoji: ui.emojis?.morning || '🌅', label: 'Pagi Hari' };
    if (hour >= 11 && hour < 16) return { color: ui.colors?.time_day || '#38BDF8', emoji: ui.emojis?.day || '☀️', label: 'Siang Hari' };
    if (hour >= 16 && hour < 19) return { color: ui.colors?.time_afternoon || '#F97316', emoji: ui.emojis?.afternoon || '🌇', label: 'Sore Hari' };
    return { color: ui.colors?.time_night || '#1E1B4B', emoji: ui.emojis?.night || '🌙', label: 'Malam Hari' };
}

function getSeason(day) {
    const dayInCycle = ((day - 1) % 28) + 1; 
    if (dayInCycle <= 7) return { name: 'Semi', emoji: '🌸', multiplier: { seed: 0.8, crop: 1.5, fish: 1.0 } };
    if (dayInCycle <= 14) return { name: 'Panas', emoji: '☀️', multiplier: { seed: 1.2, crop: 1.0, fish: 1.5 } };
    if (dayInCycle <= 21) return { name: 'Gugur', emoji: '🍂', multiplier: { seed: 1.0, crop: 1.2, fish: 1.0 } };
    return { name: 'Dingin', emoji: '❄️', multiplier: { seed: 1.5, crop: 2.0, fish: 0.8 } };
}

module.exports = { advanceTime, getTimeState, getSeason };