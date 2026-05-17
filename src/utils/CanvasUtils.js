// Lokasi: src/utils/CanvasUtils.js
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');
const axios = require('axios');
const leveling = require('./survivalLeveling');

// ==========================================
// 🔠 PENDAFTARAN FONT LOKAL
// ==========================================
try {
    GlobalFonts.registerFromPath(path.join(__dirname, '../../assets/fonts/Montserrat/Montserrat-Bold.ttf'), 'MontserratBold');
    GlobalFonts.registerFromPath(path.join(__dirname, '../../assets/fonts/Inter/Inter-Regular.ttf'), 'Inter');
    GlobalFonts.registerFromPath(path.join(__dirname, '../../assets/fonts/Inter/Inter-Bold.ttf'), 'InterBold');
    GlobalFonts.registerFromPath(path.join(__dirname, '../../assets/fonts/emoji/NotoColorEmoji.ttf'), 'EmojiFont');
} catch (error) {
    console.log("[CANVAS WARNING] Gagal memuat beberapa font lokal. Cek path file!");
}

const UI_COLORS = {
    background: '#0a0d14', 
    card: '#0c111c',       
    primary: '#00D9FF',    
    secondary: '#1a243d',  
    textMain: '#ffffff',   
    textSub: '#8e98b0',
    gold: '#FFD700' 
};

// ==========================================
// 🛠️ HELPER DASAR (GABUNGAN)
// ==========================================
function drawRoundedRect(ctx, x, y, w, h, r, color, glowColor) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
    if (glowColor) { ctx.shadowColor = glowColor; ctx.shadowBlur = 20; }
    if (color) { ctx.fillStyle = color; ctx.fill(); }
    ctx.shadowBlur = 0;
}

function drawRoundedProgressBar(ctx, x, y, width, height, radius, percentage, gradientColors) {
    drawRoundedRect(ctx, x, y, width, height, radius, 'rgba(0,0,0,0.5)');
    
    // ✨ FIX: Mengamankan nilai persentase agar tidak tembus (maksimal 100, minimal 0)
    const safePercentage = Math.min(Math.max(percentage, 0), 100);
    const progressWidth = Math.max(radius * 2, (safePercentage / 100) * width);
    
    if (safePercentage > 0) {
        ctx.save();
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, progressWidth, height, radius);
        else ctx.rect(x, y, progressWidth, height);
        ctx.clip();
        const grad = ctx.createLinearGradient(x, y, x + width, y);
        grad.addColorStop(0, gradientColors[0]);
        grad.addColorStop(1, gradientColors[1]);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
    }
}

async function drawAvatar(ctx, url, x, y, size, strokeColor) {
    try {
        const avatar = await loadImage(url);
        ctx.save();
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatar, x, y, size, size);
        ctx.restore();
        if (strokeColor) {
            ctx.beginPath();
            ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2, true);
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = 4;
            ctx.stroke();
        }
    } catch (e) { console.error("Gagal meload avatar", e); }
}

const drawCircularImage = (ctx, img, x, y, radius, borderColor) => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = UI_COLORS.card;
    ctx.fill();
    ctx.drawImage(img, x - radius, y - radius, radius * 2, radius * 2);
    if (borderColor) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 2, 0, Math.PI * 2, true);
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 4;
        ctx.stroke();
    }
    ctx.restore();
};

const formatDur = (ms) => {
    if (!ms || isNaN(ms) || ms === 0) return '0 Menit';
    if (ms > 3600000000) return 'Radio / Live Stream'; 
    const totalSeconds = Number(ms) / 1000;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) return `${hours} J ${minutes} M`;
    return `${minutes} Menit`;
};

const drawArcProgressBar = (ctx, x, y, radius, current, total, color, width) => {
    if (!total || total === 0 || total > 3600000000) return; 
    const percentage = Math.min(1, current / total);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 2);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2, false);
    ctx.strokeStyle = UI_COLORS.secondary;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2 * percentage, false);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
};

const wrapText = (ctx, text, x, y, maxWidth, lineHeight, maxLines) => {
    const words = text.toString().split(' ');
    let line = '';
    let currentY = y;
    let lineCount = 1;
    for (let n = 0; n < words.length; n++) {
        let testLine = line + words[n] + ' ';
        let metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && n > 0) {
            if (lineCount === maxLines) {
                ctx.fillText(line.trim() + '...', x, currentY);
                return currentY;
            }
            ctx.fillText(line.trim(), x, currentY);
            line = words[n] + ' ';
            currentY += lineHeight;
            lineCount++;
        } else {
            line = testLine;
        }
    }
    if (lineCount <= maxLines) { ctx.fillText(line.trim(), x, currentY); }
    return currentY; 
};

const truncateText = (ctx, text, maxWidth) => {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let truncated = text;
    while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
        truncated = truncated.slice(0, -1);
    }
    return truncated + '...';
};

// ==========================================
// 🎮 SURVIVAL RPG PROFILE CANVAS
// ==========================================
async function generateSurvivalProfileImage(user, profile, survival, ui) {
    const canvas = createCanvas(900, 500);
    const ctx = canvas.getContext('2d');

    const currentLevel = parseInt(survival.survival_level) || 1;
    const currentXP = parseInt(survival.survival_xp) || 0;
    const reqXP = leveling.getExpRequirement(currentLevel);
    const maxStatCap = leveling.getMaxStatCap(currentLevel);

    // Background
    drawRoundedRect(ctx, 0, 0, 900, 500, 25, '#1e1f22'); 
    drawRoundedRect(ctx, 20, 20, 860, 460, 15, '#2b2d31'); 

    // Header & Title
    ctx.fillStyle = '#ffffff';
    ctx.font = '30px "MontserratBold", "EmojiFont", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${user.displayName.toUpperCase()}`, 170, 65);
    
    ctx.fillStyle = ui.colors?.economy || '#FFD700';
    ctx.font = '20px "Inter", "EmojiFont", sans-serif';
    ctx.fillText(`Level ${currentLevel} Survivor`, 170, 95);

    ctx.fillStyle = '#8e98b0';
    ctx.font = '14px "InterBold", sans-serif';
    ctx.fillText(`XP: ${currentXP} / ${reqXP}`, 170, 115);
    drawRoundedProgressBar(ctx, 170, 125, 200, 10, 5, (currentXP / reqXP) * 100, ['#00D9FF', '#0055FF']);

    // Avatar
    const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 256 });
    await drawAvatar(ctx, avatarUrl, 40, 30, 100);

    // Naura Coins
    ctx.textAlign = 'right';
    ctx.fillStyle = '#8e98b0';
    ctx.font = '18px "InterBold", sans-serif';
    ctx.fillText('NAURA COINS (NC)', 850, 60);
    
    ctx.fillStyle = ui.colors?.economy || '#FFD700';
    ctx.font = '35px "MontserratBold", sans-serif';
    ctx.fillText(`${(profile.economy_wallet || 0).toLocaleString('id-ID')}`, 850, 100);

    // Garis Pembatas
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(40, 150, 820, 2);

    // Status Fisik
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px "InterBold", sans-serif';
    ctx.fillText('STATUS FISIK', 50, 185); 

    const maxHP = 100 + ((Math.min(survival.strength || 1, maxStatCap)) * 10);
    const hpColor = ['#ff0000', '#ff4d4d']; 
    const hungerColor = ['#ff8c00', '#ffa500']; 
    const thirstColor = ['#00bfff', '#87cefa']; 
    const staminaColor = ['#32cd32', '#98fb98']; 

    ctx.font = '15px "Inter", sans-serif';
    
    ctx.fillText(`Health (HP) - ${maxHP}/${maxHP}`, 50, 220);
    drawRoundedProgressBar(ctx, 50, 230, 350, 15, 7.5, 100, hpColor);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(`Lapar (Hunger) - ${survival.hunger || 0}/100`, 50, 280);
    drawRoundedProgressBar(ctx, 50, 290, 350, 15, 7.5, survival.hunger || 0, hungerColor);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(`Haus (Thirst) - ${survival.thirst || 0}/100`, 50, 340);
    drawRoundedProgressBar(ctx, 50, 350, 350, 15, 7.5, survival.thirst || 0, thirstColor);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(`Stamina (Energy) - ${survival.stamina || 0}/100`, 50, 400);
    drawRoundedProgressBar(ctx, 50, 410, 350, 15, 7.5, survival.stamina || 0, staminaColor);

    // Stats RPG Atribut
    ctx.font = '20px "InterBold", sans-serif'; 
    ctx.fillText('STATS ATRIBUT', 450, 185);
    
    const stats = [
        { name: 'Kekuatan', val: survival.strength || 1, color: '#DC143C' },
        { name: 'Kelincahan', val: survival.agility || 1, color: '#00FA9A' },
        { name: 'Kepintaran', val: survival.intelligence || 1, color: '#9370DB' },
        { name: 'Keberuntungan', val: survival.luck || 1, color: '#FFD700' }
    ];

    let statY = 220;
    stats.forEach(st => {
        drawRoundedRect(ctx, 450, statY, 400, 40, 10, 'rgba(0,0,0,0.3)');
        ctx.fillStyle = st.color;
        ctx.fillRect(450, statY, 10, 40); 
        ctx.fillStyle = '#ffffff';
        ctx.font = '18px "InterBold", sans-serif';
        ctx.fillText(st.name, 480, statY + 26);
        ctx.textAlign = 'right';
        ctx.fillText(`${st.val}/${maxStatCap}`, 830, statY + 26);
        ctx.textAlign = 'left';
        statY += 55;
    });

    return canvas.toBuffer('image/png');
}

// ==========================================
// 🎵 MUSIC PROFILE CANVAS
// ==========================================
async function generateMusicProfileImage(user, stats, clientAvatar) {
    const canvas = createCanvas(1000, 650); 
    const ctx = canvas.getContext('2d');
    
    const isVIP = stats.isPremium;
    const themeColor = isVIP ? UI_COLORS.gold : UI_COLORS.primary;

    const bgGradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    bgGradient.addColorStop(0, '#090a0f');
    bgGradient.addColorStop(1, '#111522');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    const blurGlow = ctx.createRadialGradient(200, 200, 50, 200, 200, 400);
    blurGlow.addColorStop(0, isVIP ? 'rgba(255, 215, 0, 0.15)' : 'rgba(0, 217, 255, 0.15)');
    blurGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = blurGlow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    const fillRoundedRect = (x, y, w, h, r, color) => {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
        else ctx.rect(x, y, w, h); 
        ctx.fillStyle = color;
        ctx.fill();
    };
    
    fillRoundedRect(40, 40, 920, 200, 25, 'rgba(255, 255, 255, 0.03)');
    ctx.strokeStyle = isVIP ? 'rgba(255, 215, 0, 0.5)' : 'rgba(0, 217, 255, 0.3)';
    ctx.lineWidth = isVIP ? 2 : 1; 
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(40, 40, 920, 200, 25); ctx.stroke(); }
    
    let userAvatarImg;
    try { userAvatarImg = await loadImage(user.displayAvatarURL({ extension: 'png', size: 256 })); } 
    catch (e) { userAvatarImg = await loadImage(clientAvatar); }
    
    drawCircularImage(ctx, userAvatarImg, 135, 140, 70, themeColor);
    
    ctx.fillStyle = UI_COLORS.textMain;
    ctx.font = 'bold 36px "MontserratBold", "EmojiFont", sans-serif';
    ctx.fillText(user.displayName || user.username, 230, 110);
    
    ctx.fillStyle = themeColor;
    ctx.font = '20px "Inter", sans-serif';
    ctx.fillText(`@${user.username}`, 230, 145);

    ctx.fillStyle = isVIP ? '#FFD700' : UI_COLORS.textSub;
    ctx.font = 'bold 18px "InterBold", "EmojiFont", sans-serif';
    ctx.fillText(isVIP ? '👑 VIP Prestige' : '🔹 Member Profile', 230, 185);

    ctx.fillStyle = UI_COLORS.textSub;
    ctx.font = '16px "Inter", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Total Trek', 550, 90);
    ctx.fillText('Total Durasi', 730, 90);
    
    ctx.fillStyle = UI_COLORS.textMain;
    ctx.font = 'bold 28px "MontserratBold", sans-serif';
    ctx.fillText(`${stats.tracksListened || 0}`, 550, 125);
    ctx.fillText(`${formatDur(stats.totalDurationMs)}`, 730, 125);

    ctx.fillStyle = UI_COLORS.textSub;
    ctx.font = '16px "Inter", sans-serif';
    ctx.fillText('Terakhir Diputar:', 550, 180);
    
    ctx.fillStyle = UI_COLORS.textMain;
    ctx.font = 'bold 20px "InterBold", "EmojiFont", sans-serif';
    const lastListenedText = truncateText(ctx, stats.lastListened, 380); 
    ctx.fillText(lastListenedText, 550, 210);

    const cardY = 270;
    const cardW = 286;
    const cardH = 310;
    const gap = 30;

    const drawList = (items, startX, startY) => {
        if (!items || items.length === 0) {
            ctx.fillStyle = UI_COLORS.textSub;
            ctx.font = 'italic 18px "Inter", sans-serif';
            ctx.fillText('Belum ada data', startX, startY);
            return;
        }

        ctx.font = 'bold 18px "InterBold", "EmojiFont", sans-serif';
        items.forEach((item, i) => {
            ctx.fillStyle = themeColor; 
            ctx.fillText(`${i + 1}.`, startX, startY + (i * 45));
            ctx.fillStyle = UI_COLORS.textMain;
            const itemText = truncateText(ctx, item, cardW - 50);
            ctx.fillText(itemText, startX + 25, startY + (i * 45));
        });
    };

    fillRoundedRect(40, cardY, cardW, cardH, 20, 'rgba(0, 0, 0, 0.4)');
    ctx.fillStyle = themeColor;
    ctx.font = 'bold 22px "MontserratBold", "EmojiFont", sans-serif';
    ctx.fillText('🎵 Top 5 Trek', 60, cardY + 45); 
    drawList(stats.topTracks, 60, cardY + 100);
    
    fillRoundedRect(40 + cardW + gap, cardY, cardW, cardH, 20, 'rgba(0, 0, 0, 0.4)');
    ctx.fillStyle = isVIP ? '#FFA500' : '#FFD700'; 
    ctx.font = 'bold 22px "MontserratBold", "EmojiFont", sans-serif';
    ctx.fillText('🏰 Top 5 Server', 40 + cardW + gap + 20, cardY + 45); 
    drawList(stats.topServers, 40 + cardW + gap + 20, cardY + 100);

    fillRoundedRect(40 + (cardW + gap) * 2, cardY, cardW, cardH, 20, 'rgba(0, 0, 0, 0.4)');
    ctx.fillStyle = '#ff4757'; 
    ctx.font = 'bold 22px "MontserratBold", "EmojiFont", sans-serif';
    ctx.fillText('🤝 Top 5 Relasi', 40 + (cardW + gap) * 2 + 20, cardY + 45); 
    drawList(stats.topFriends, 40 + (cardW + gap) * 2 + 20, cardY + 100);

    try {
        const nauraLogoImg = await loadImage(clientAvatar);
        drawCircularImage(ctx, nauraLogoImg, 930, 615, 20); 
    } catch(e) {}
    
    ctx.fillStyle = UI_COLORS.textSub;
    ctx.font = 'bold 14px "MontserratBold", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Naura Music Intelligence', 890, 620); 
    
    return canvas.toBuffer('image/png');
}

// ==========================================
// 🎵 MUSIC PANEL CANVAS
// ==========================================
async function generateMusicPanelImage(track, currentPos, clientAvatar) {
    const canvas = createCanvas(600, 280); 
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = UI_COLORS.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    let trackImageUrl = track.info.image;
    if (!trackImageUrl && track.info.sourceName === 'youtube') {
        trackImageUrl = `https://img.youtube.com/vi/${track.info.identifier}/mqdefault.jpg`;
    }
    if (!trackImageUrl || typeof trackImageUrl !== 'string' || !trackImageUrl.startsWith('http')) {
        trackImageUrl = clientAvatar; 
    }

    let trackThumbImg;
    try {
        const response = await axios.get(trackImageUrl, { responseType: 'arraybuffer', timeout: 5000 });
        trackThumbImg = await loadImage(Buffer.from(response.data));
    } catch (error) {
        trackThumbImg = await loadImage(clientAvatar);
    }

    drawCircularImage(ctx, trackThumbImg, 120, 140, 90, UI_COLORS.primary);
    
    ctx.fillStyle = UI_COLORS.textSub;
    ctx.font = '16px "InterBold", "EmojiFont"';
    ctx.textAlign = 'center';
    ctx.fillText(track.info.author.substring(0, 25), 120, 260); 

    ctx.fillStyle = UI_COLORS.primary;
    ctx.font = '20px "MontserratBold", "EmojiFont"'; 
    ctx.textAlign = 'left';
    wrapText(ctx, track.info.title, 230, 100, 170, 25, 4);
    
    drawArcProgressBar(ctx, 480, 140, 70, currentPos, track.info.length, UI_COLORS.primary, 8);
    
    ctx.fillStyle = UI_COLORS.textSub;
    ctx.font = '18px "InterBold", "EmojiFont"';
    ctx.textAlign = 'center';
    ctx.fillText('Naura', 480, 145);
    
    ctx.fillStyle = UI_COLORS.textSub;
    ctx.font = '14px "Inter", "EmojiFont"';
    ctx.fillText(formatDur(currentPos), 430, 230);
    ctx.fillText(formatDur(track.info.length), 530, 230);
    
    ctx.fillStyle = UI_COLORS.primary;
    ctx.font = '16px "MontserratBold", "EmojiFont"';
    ctx.textAlign = 'left';
    ctx.fillText('Naura Audio System', 20, 30);
    
    return canvas.toBuffer('image/png');
}

// ==========================================
// 👋 GREETING / WELCOME CANVAS (REMASTERED)
// ==========================================
async function generateWelcomeImage(member, type = 'welcome', ui, bgUrl = null) {
    const canvas = createCanvas(1000, 330); // Dibuat lebih lebar agar proporsional
    const ctx = canvas.getContext('2d');

    const isWelcome = type === 'welcome';
    const themeColor = isWelcome ? (ui?.colors?.welcome || '#00FFFF') : (ui?.colors?.leave || '#ff4757');

    // 1. Gambar Background (Kustom atau Default)
    if (bgUrl) {
        try {
            const bgImg = await loadImage(bgUrl);
            ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
        } catch (error) {
            console.log("[CANVAS] Gagal memuat background kustom, menggunakan warna dasar.");
            drawRoundedRect(ctx, 0, 0, canvas.width, canvas.height, 0, '#0a0d14');
        }
    } else {
        // Fallback jika tidak ada gambar background
        drawRoundedRect(ctx, 0, 0, canvas.width, canvas.height, 0, '#0a0d14');
    }

    // 2. Kotak Transparan (Overlay Text) agar teks rapi & terbaca
    // X: 330, Y: 45, Width: 630, Height: 240, Radius: 20
    drawRoundedRect(ctx, 330, 45, 630, 240, 20, 'rgba(0, 0, 0, 0.6)');

    // 3. Avatar User (Di sebelah kiri)
    let userAvatarImg;
    const avatarUrl = member.user.displayAvatarURL({ extension: 'png', size: 512 });
    try { 
        userAvatarImg = await loadImage(avatarUrl); 
    } catch (e) {}
    
    if (userAvatarImg) {
        // Posisi X: 180, Y: 165 (Tengah presisi), Radius: 110, dengan border warna tema
        drawCircularImage(ctx, userAvatarImg, 180, 165, 110, themeColor);
    }

    // 4. Setup Teks
    const textStartX = 370; // Padding kiri untuk teks di dalam kotak

    // ---> A. Teks Judul (Miring & Spasi Lebar seperti gambar)
    ctx.fillStyle = themeColor;
    ctx.font = 'bold 26px "MontserratBold", "EmojiFont", sans-serif';
    const rawTitle = isWelcome ? 'WELCOME TO SERVER' : 'WE WILL MISS YOU';
    // Trik membuat letter-spacing di Canvas (W E L C O M E)
    const spacedTitle = rawTitle.split('').join(' '); 
    ctx.fillText(spacedTitle, textStartX, 105);

    // ---> B. Teks Nama User (Besar & Jelas)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 55px "MontserratBold", "EmojiFont", sans-serif';
    const displayName = truncateText(ctx, member.user.displayName, 550);
    ctx.fillText(displayName, textStartX, 170);

    // ---> C. Teks Tag Username & Member Count
    ctx.fillStyle = '#d1d5db'; // Warna abu-abu terang
    ctx.font = '22px "Inter", "EmojiFont", sans-serif';
    const tag = `@${member.user.username}`;
    const countText = isWelcome ? `Anggota #${member.guild.memberCount}` : `Sisa #${member.guild.memberCount}`;
    ctx.fillText(`${tag}   •   ${countText}`, textStartX, 220);

    // ---> D. Garis Aksen Bawah (Pemanis seperti di gambar)
    ctx.fillStyle = themeColor;
    ctx.fillRect(textStartX, 245, 150, 4); 

    return canvas.toBuffer('image/png');
}

module.exports = {
    drawRoundedRect,
    drawRoundedProgressBar,
    drawAvatar,
    drawCircularImage,
    drawArcProgressBar,
    wrapText,
    truncateText,
    formatDur,
    generateSurvivalProfileImage, 
    generateMusicProfileImage,
    generateMusicPanelImage,
    generateWelcomeImage
};