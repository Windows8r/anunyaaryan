const express = require('express');
const os = require('os');
const path = require('path');
const cors = require('cors');
const { EmbedBuilder } = require('discord.js');
const UserProfile = require('../models/UserProfile');
const GuildSettings = require('../models/GuildSettings');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const basicAuth = require('express-basic-auth');

module.exports = (client) => {
    // ==========================================
    // 1. SERVER WEBHOOK (PORT 3064)
    // ==========================================
    const webhookApp = express();
    webhookApp.use(express.json());
    webhookApp.use(express.urlencoded({ extended: true }));

    webhookApp.post('/api/webhook/vote', async (req, res) => {
        const auth = req.headers.authorization;
        if (process.env.WEBHOOK_AUTH_VOTE && auth !== process.env.WEBHOOK_AUTH_VOTE) return res.status(401).send('Unauthorized');
        const userId = req.body.user;
        if (!userId) return res.status(400).send('Missing user ID');

        try {
            const { sequelize } = require('../managers/dbManager');
            await sequelize.transaction(async (t) => {
                let [profile] = await UserProfile.findOrCreate({ 
                    where: { userId },
                    transaction: t,
                    lock: t.LOCK.UPDATE
                });
                
                const newExpiry = new Date();
                if (profile.isPremium && profile.premiumUntil && profile.premiumUntil > new Date()) {
                    newExpiry.setTime(profile.premiumUntil.getTime() + (12 * 60 * 60 * 1000));
                } else {
                    newExpiry.setTime(newExpiry.getTime() + (12 * 60 * 60 * 1000));
                }
                profile.isPremium = true;
                profile.premiumUntil = newExpiry;
                await profile.save({ transaction: t });

                try {
                    const userObj = await client.users.fetch(userId);
                    const embed = new EmbedBuilder()
                        .setColor('#FFD700')
                        .setTitle('🎉 Terima Kasih Telah Memilih Naura!')
                        .setDescription(`Hai ${userObj.username}! Terima kasih atas VOTE kamu di server list hari ini.\n\nSebagai bentuk apresiasi, Naura telah memberikan fasilitas **TRIAL V.I.P PREMIUM selama 12 Jam** untukmu!\n\n⏳ **Status Aktif Sampai:** <t:${Math.floor(newExpiry.getTime() / 1000)}:R>`)
                        .setFooter({ text: 'Naura Hoshino Auto-Vote System' });
                    await userObj.send({ embeds: [embed] });
                } catch (e) {
                    console.log(`[WEBHOOK VOTE] Gagal DM user ${userId}: DM Tertutup`);
                }
            });
            res.status(200).send('Vote recorded successfully');
        } catch (error) {
            console.error('[WEBHOOK ERROR] Vote:', error);
            res.status(500).send('Internal Server Error');
        }
    });

    webhookApp.post('/api/webhook/saweria', async (req, res) => {
        const token = req.headers['saweria-token'] || req.headers['authorization'];
        if (process.env.WEBHOOK_AUTH_SAWERIA && token !== process.env.WEBHOOK_AUTH_SAWERIA) return res.status(401).send('Unauthorized');

        const amount = req.body.amount || req.body.total_amount || 0;
        const message = req.body.message || '';
        const donator_name = req.body.donator_name || req.body.donator || 'Seseorang';
        if (!amount || !message) return res.status(400).send('Bad Request: Missing Amount or Message');

        const idMatch = message.match(/\b\d{17,19}\b/);
        if (!idMatch) return res.status(200).send('OK: No Discord ID found in message');

        const userId = idMatch[0];
        let daysToAdd = 0; let tierName = '';
        if (amount >= 75000) { daysToAdd = 365; tierName = '👑 Naura Bestie (1 Tahun)'; } 
        else if (amount >= 50000) { daysToAdd = 180; tierName = '💫 Naura Friends (6 Bulan)'; } 
        else if (amount >= 35000) { daysToAdd = 30; tierName = '🌟 Naura Supporter (1 Bulan)'; } 
        else return res.status(200).send('OK: Amount below premium tier');

        try {
            const { sequelize } = require('../managers/dbManager');
            await sequelize.transaction(async (t) => {
                let [profile] = await UserProfile.findOrCreate({ 
                    where: { userId },
                    transaction: t,
                    lock: t.LOCK.UPDATE
                });
                
                const newExpiry = new Date();
                if (profile.isPremium && profile.premiumUntil && profile.premiumUntil > new Date()) {
                    newExpiry.setTime(profile.premiumUntil.getTime() + (daysToAdd * 24 * 60 * 60 * 1000));
                } else {
                    newExpiry.setTime(newExpiry.getTime() + (daysToAdd * 24 * 60 * 60 * 1000));
                }
                profile.isPremium = true;
                profile.premiumUntil = newExpiry;
                await profile.save({ transaction: t });

                try {
                    const userObj = await client.users.fetch(userId);
                    const embed = new EmbedBuilder()
                        .setColor('#FFD700')
                        .setTitle('💖 Pembayaran V.I.P Terkonfirmasi!')
                        .setDescription(`Terima kasih **${donator_name}** atas dukungan donasinya (Rp ${amount.toLocaleString('id-ID')})!\n\nStatus **Premium Naura** kamu telah otomatis diaktifkan oleh sistem.\n\n📦 **Paket Aktif:** ${tierName}\n⏳ **Berlaku Sampai:** <t:${Math.floor(newExpiry.getTime() / 1000)}:F>`);
                    await userObj.send({ embeds: [embed] });
                } catch (e) {
                    console.log(`[WEBHOOK SAWERIA] Gagal DM user ${userId}: DM Tertutup`);
                }
            });
            res.status(200).send('Donation Processed Successfully');
        } catch (error) {
            console.error('[WEBHOOK ERROR] Saweria:', error);
            res.status(500).send('Internal Server Error');
        }
    });

    webhookApp.listen(3064, () => {
        console.log(`\x1b[45m\x1b[37m 💸 WEBHOOK \x1b[0m \x1b[35mServer Webhook berjalan di Port: 3064\x1b[0m`);
    });

    // ==========================================
    // 2. SERVER API & DATABASE (PORT 3053)
    // ==========================================
    const apiApp = express();
    apiApp.use(cors());
    apiApp.use(express.json());

    apiApp.get('/api/stats', (req, res) => {
        const totalRam = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
        const usedRam = ((os.totalmem() - os.freemem()) / 1024 / 1024 / 1024).toFixed(2);
        res.json({
            botName: client.user.username,
            avatar: client.user.displayAvatarURL({ extension: 'png', size: 512 }),
            servers: client.guilds.cache.size,
            users: client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0),
            ping: client.ws.ping,
            uptime: formatUptime(client.uptime)
        });
    });

    apiApp.listen(3053, () => {
        console.log(`\x1b[43m\x1b[30m ⚙️ API DATA \x1b[0m \x1b[33mServer API berjalan di Port: 3053\x1b[0m`);
    });

    // ==========================================
    // 3. SERVER WEB MAIN UI (PORT 3070)
    // ==========================================
    const webApp = express();
    const webPort = process.env.PORT || 3070;
    
    webApp.use(cors());
    webApp.use(express.json());
    webApp.use(express.urlencoded({ extended: true }));
    
    // 🔥 DAFTARKAN FOLDER PUBLIC DAN ASSETS
    webApp.use(express.static(path.join(__dirname, 'public')));
    webApp.use('/assets', express.static(path.join(__dirname, 'assets')));

    const authMiddleware = basicAuth({
        users: { 'admin': process.env.DASHBOARD_PASS || 'naura123' },
        challenge: true,
        realm: 'Naura Hoshino Dashboard'
    });

    webApp.use(session({
        secret: process.env.SESSION_SECRET || 'naura_secret',
        resave: false,
        saveUninitialized: false,
        cookie: { maxAge: 1000 * 60 * 60 * 24 }
    }));
    webApp.use(passport.initialize());
    webApp.use(passport.session());
    passport.serializeUser((user, done) => done(null, user));
    passport.deserializeUser((obj, done) => done(null, obj));

    if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET) {
        console.log('\x1b[33m[⚠️ WARNING]\x1b[0m DISCORD_CLIENT_ID atau SECRET belum diatur di .env! Fitur Login Web UI dinonaktifkan.');
    } else {
        passport.use(new DiscordStrategy({
            clientID: process.env.DISCORD_CLIENT_ID,
            clientSecret: process.env.DISCORD_CLIENT_SECRET,
            callbackURL: process.env.DISCORD_CALLBACK_URL,
            scope: ['identify', 'guilds']
        }, (accessToken, refreshToken, profile, done) => done(null, profile)));

        webApp.get('/auth/discord', passport.authenticate('discord'));
        webApp.get('/auth/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => res.redirect('/'));
    }

    webApp.get('/auth/logout', (req, res) => {
        req.logout(() => res.redirect('/'));
    });

    webApp.get('/api/me', async (req, res) => {
        if (req.isAuthenticated()) {
            try {
                let [profile] = await UserProfile.findOrCreate({ where: { userId: req.user.id } });
                res.json({ loggedIn: true, user: req.user, db: profile });
            } catch (err) {
                console.error('Error fetching user DB for /api/me:', err);
                res.json({ loggedIn: true, user: req.user, db: null });
            }
        } else {
            res.json({ loggedIn: false });
        }
    });

    webApp.get('/', (req, res) => res.sendFile(path.join(__dirname, 'views', 'index.html')));
    webApp.get('/leaderboard', (req, res) => res.sendFile(path.join(__dirname, 'views', 'leaderboard.html')));
    webApp.get('/settings', authMiddleware, (req, res) => res.sendFile(path.join(__dirname, 'views', 'settings.html')));
    webApp.get('/welcomer', authMiddleware, (req, res) => res.sendFile(path.join(__dirname, 'views', 'welcomer.html')));

    webApp.get('/api/leaderboard', async (req, res) => {
        try {
            const redisManager = require('../managers/redisManager');
            let topUsers = null;
            if (redisManager.client && redisManager.client.isReady) {
                topUsers = await redisManager.getCache('leaderboard_top10');
            }
            if (!topUsers) {
                topUsers = await UserProfile.findAll({ order: [['economy_wallet', 'DESC']], limit: 10 });
                if (redisManager.client && redisManager.client.isReady) {
                    await redisManager.setCache('leaderboard_top10', topUsers, 60); // Cache for 60 seconds
                }
            }
            res.json(topUsers);
        } catch (error) {
            res.status(500).json({ error: 'Gagal memuat leaderboard' });
        }
    });

    // ==========================================
    // 👑 OWNER ONLY API (GOD MODE)
    // ==========================================
    const OWNER_ID = '795241173009825853'; // ID Aryan

    const checkOwner = (req, res, next) => {
        if (!req.isAuthenticated()) return res.status(401).json({ error: 'Belum login' });
        if (req.user.id !== OWNER_ID) return res.status(403).json({ error: 'Akses ditolak. Area ini khusus Master Aryandita.' });
        next();
    };

    webApp.post('/api/owner/update_user', checkOwner, async (req, res) => {
        const { targetId, wallet, bank, isPremium } = req.body;
        try {
            let [user] = await UserProfile.findOrCreate({ where: { userId: targetId } });
            user.economy_wallet = wallet !== undefined ? wallet : user.economy_wallet;
            user.economy_bank = bank !== undefined ? bank : user.economy_bank;
            if (isPremium !== undefined) {
                user.isPremium = isPremium;
                if (isPremium) {
                    const expiry = new Date();
                    expiry.setFullYear(expiry.getFullYear() + 100);
                    user.premiumUntil = expiry;
                } else {
                    user.premiumUntil = null;
                }
            }
            await user.save();
            res.json({ success: true, message: `Data ${targetId} berhasil dimanipulasi.` });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    webApp.post('/api/owner/restart', checkOwner, (req, res) => {
        res.json({ success: true, message: 'Sistem sedang dimatikan dan akan di-restart...' });
        setTimeout(() => { process.exit(0); }, 2000);
    });

    const http = require('http');
    const { Server } = require('socket.io');
    const webServer = http.createServer(webApp);
    const io = new Server(webServer, { cors: { origin: '*' } });
    
    // Simpan instance IO ke client agar bisa dipakai dari file luar (seperti naura.js)
    client.dashboardIo = io;

    io.on('connection', (socket) => {
        console.log(`[SOCKET] User connected to Dashboard: ${socket.id}`);

        socket.on('chat_message', async (data) => {
            try {
                const response = await fetch('https://api.verba.ink/v1/response', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${process.env.VERBA_API_KEY}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        character: process.env.VERBA_CHARACTER_SLUG || "naura",
                        messages: [
                            { role: "system", content: "Kamu adalah Naura Hoshino, asisten virtual cerdas yang bisa dihubungi melalui layar chatting dashboard. Bicaralah selayaknya manusia yang ramah, sedikit playful, dan menggunakan bahasa Indonesia yang baik." },
                            { role: "user", content: data.message }
                        ]
                    })
                });

                if (!response.ok) throw new Error('Verba API Error');
                const result = await response.json();
                socket.emit('chat_response', { reply: result.choices[0].message.content });
            } catch (error) {
                console.error("[SOCKET CHAT ERROR]", error);
                socket.emit('chat_response', { reply: 'Maaf, sistem AI Naura sedang gangguan saat ini.' });
            }
        });

        socket.on('disconnect', () => {
            // User disconnected
        });
    });

    webServer.listen(webPort, () => {
        console.log(`\x1b[44m\x1b[37m 🌐 WEB MAIN \x1b[0m \x1b[34mWeb UI berjalan di http://localhost:${webPort}\x1b[0m`);
    });
};

function formatUptime(ms) {
    if (ms < 60000) return 'Baru saja mulai';
    let totalSeconds = (ms / 1000);
    let days = Math.floor(totalSeconds / 86400);
    totalSeconds %= 86400;
    let hours = Math.floor(totalSeconds / 3600);
    totalSeconds %= 3600;
    let minutes = Math.floor(totalSeconds / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}