// Lokasi: src/events/poru/trackStart.js
const UserProfile = require('../../models/UserProfile');
const GuildSettings = require('../../models/GuildSettings'); 
const MusicUIManager = require('../../managers/MusicUIManager'); 
const VoiceManager = require('../../managers/voiceManager'); 
const { GoogleGenerativeAI } = require('@google/generative-ai');

module.exports = {
    async execute(manager, player, track) {
        try {
            const activeTrack = track || player.currentTrack;
            if (!activeTrack || !activeTrack.info || !activeTrack.info.title) {
                if (typeof player.stopTrack === 'function') player.stopTrack();
                return;
            }

            player.previousTrack = activeTrack;
            player.isAutoplayResolving = false;

            console.log(`\x1b[44m\x1b[37m 🔊 PLAYING \x1b[0m \x1b[36m${activeTrack.info.title} \x1b[0m\x1b[90mdi ${manager.client.guilds.cache.get(player.guildId)?.name}\x1b[0m`);

            if (!player.playedHistory) player.playedHistory = new Set();
            player.playedHistory.add(activeTrack.info.identifier);

            // Update Statistik User
            if (activeTrack.info.requester && activeTrack.info.length > 0) {
                UserProfile.findOrCreate({ where: { userId: activeTrack.info.requester.id } }).then(async ([userProfile]) => {
                    userProfile.music_tracksListened = (userProfile.music_tracksListened || 0) + 1;
                    userProfile.music_totalDurationMs = Number(userProfile.music_totalDurationMs || 0) + Number(activeTrack.info.length);
                    userProfile.music_lastListened = activeTrack.info.title.substring(0, 100);

                    const calculateTop = (jsonString, currentItem) => {
                        let data = { history: {}, name: currentItem };
                        try { if (jsonString) data = JSON.parse(jsonString); if (!data.history) data.history = {}; } catch(e) {}
                        data.history[currentItem] = (data.history[currentItem] || 0) + 1;
                        let max = 0; let top = data.name;
                        for (const [key, val] of Object.entries(data.history)) { if (val > max) { max = val; top = key; } }
                        data.name = top;
                        return JSON.stringify(data);
                    };

                    userProfile.music_topTrack = calculateTop(userProfile.music_topTrack, activeTrack.info.title.substring(0, 50));

                    const guild = manager.client.guilds.cache.get(player.guildId);
                    if (guild) {
                        userProfile.music_topServer = calculateTop(userProfile.music_topServer, guild.name);
                        let voiceChannel = guild.channels.cache.get(player.voiceChannel);
                        if (voiceChannel) {
                            try {
                                if (voiceChannel.members.size <= 1) await guild.members.fetch(); 
                                const friends = voiceChannel.members.filter(m => !m.user.bot && m.user.id !== activeTrack.info.requester.id).map(m => m.user.displayName);
                                if (friends.length > 0) {
                                    const randomFriend = friends[Math.floor(Math.random() * friends.length)];
                                    userProfile.music_topFriend = calculateTop(userProfile.music_topFriend, randomFriend);
                                }
                            } catch (e) {}
                        }
                    }
                    userProfile.save().catch(()=>{});
                }).catch(()=>{});
            }

            // ==========================================
            // 🎧 FITUR AI DJ (RADIO ANNOUNCER)
            // ==========================================
            let isDjActive = false;
            try {
                const [guildData] = await GuildSettings.findOrCreate({ where: { guildId: player.guildId } });
                
                const isAutoplayRequest = activeTrack.info.requester?.id === manager.client.user.id;

                if (guildData.aiVoiceEnabled && activeTrack.info.requester && !isAutoplayRequest) {
                    isDjActive = true;
                    player.pause(true); 

                    const requesterName = activeTrack.info.requester.displayName || activeTrack.info.requester.username || 'Seseorang';
                    const trackTitle = activeTrack.info.title.substring(0, 30);
                    const trackAuthor = activeTrack.info.author.substring(0, 20);

                    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-latest" }); 
                    
                    const prompt = `Sebagai Naura, penyiar radio virtual yang ceria, buat 1 kalimat pembuka untuk mengumumkan bahwa lagu "${trackTitle}" dari "${trackAuthor}" yang di-request oleh "${requesterName}" akan diputar. Gunakan bahasa gaul. TANPA EMOJI, TANPA SIMBOL.`;
                    
                    let djText = `Lagu selanjutnya, ${trackTitle} dari ${trackAuthor}, spesial request dari ${requesterName}. Selamat mendengarkan!`;
                    
                    try {
                        const aiResult = await model.generateContent(prompt);
                        djText = aiResult.response.text().replace(/[^\w\s.,?!'a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ-]/g, '').trim();
                    } catch(e) {}

                    console.log(`\x1b[45m\x1b[37m 🎤 AI DJ \x1b[0m \x1b[35m${djText}\x1b[0m`);

                    const guild = manager.client.guilds.cache.get(player.guildId);
                    const member = await guild.members.fetch(activeTrack.info.requester.id).catch(() => null);
                    
                    if (member && member.voice.channel) {
                        const durationMs = (djText.split(' ').length * 400) + 2000; 
                        
                        player.disconnect(); 
                        
                        VoiceManager.speak(djText, member).catch(()=>{});
                        
                        setTimeout(() => {
                            try {
                                manager.poru.createConnection({ 
                                    guildId: player.guildId, 
                                    voiceChannel: player.voiceChannel, 
                                    textChannel: player.textChannel, 
                                    deaf: true 
                                });
                                player.pause(false);
                            } catch (e) {
                                console.log("\x1b[31m[DJ ERROR]\x1b[0m Gagal menyambung ulang Lavalink setelah DJ.");
                            }
                        }, durationMs);
                    } else {
                        player.pause(false); 
                    }
                }
            } catch(e) {
                console.error('\x1b[41m\x1b[37m ⚠️ AI DJ FATAL ERROR \x1b[0m', e);
                player.pause(false);
            }

            if (!isDjActive) player.pause(false);

            // ==========================================

            let recommendedTracks = await this.handleAutoplayPrefetch(manager, player, activeTrack);
            MusicUIManager.renderPanel(manager, player, activeTrack, recommendedTracks);

        } catch (error) { console.error('\x1b[41m\x1b[37m ⚠️ EVENT ERROR \x1b[0m', error); }
    },

    async handleAutoplayPrefetch(manager, player, activeTrack) {
        let recommendedTracks = [];
        
        // 1. TAHAP GEMINI AI: Menentukan 1 Lagu Terbaik untuk di-Autoplay
        if (player.isAutoplayMode && process.env.GEMINI_API_KEY) {
            try {
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-latest" });
                const prompt = `Aku sedang memutar lagu "${activeTrack.info.title}" oleh "${activeTrack.info.author}".
                Berikan 1 rekomendasi lagu selanjutnya yang memiliki vibe sangat mirip. Balas HANYA dengan format murni: "Judul Lagu - Nama Artis".`;

                const aiResult = await model.generateContent(prompt);
                const aiQuery = aiResult.response.text().trim();

                const searchRes = await manager.poru.resolve({ query: `ytmsearch:${aiQuery} official audio`, source: 'ytmsearch', requester: manager.client.user });
                if (searchRes && searchRes.tracks && searchRes.tracks.length > 0) {
                    player.prefetchedAutoplayTrack = searchRes.tracks[0];
                    player.prefetchedAutoplayTrack.info.requester = manager.client.user; 
                    
                    // 🛑 PENAMBAHAN TAG: Mengamankan identitas YouTube Music
                    player.prefetchedAutoplayTrack.info.originalSource = 'youtube'; 
                }
            } catch (e) {
                console.error(`\x1b[41m\x1b[37m ⚠️ GEMINI ERROR \x1b[0m Alasan: \x1b[33m${e.message || 'Tidak diketahui'}\x1b[0m. Menggunakan fallback...`);
            }
        }

        // 2. TAHAP YOUTUBE MUSIC: Mencari 5 Lagu untuk Mengisi Dropdown Rekomendasi
        try {
            const dropdownRes = await manager.poru.resolve({ 
                query: `ytmsearch:${activeTrack.info.author} ${activeTrack.info.title} mix`, 
                source: 'ytmsearch', 
                requester: manager.client.user 
            });

            if (dropdownRes && dropdownRes.tracks) {
                recommendedTracks = dropdownRes.tracks.filter(t => 
                    t.info.identifier !== activeTrack.info.identifier && 
                    !player.playedHistory.has(t.info.identifier)
                ).slice(0, 5);
                
                // 🛑 PENAMBAHAN TAG: Menandai seluruh isi dropdown agar emoji panel sesuai
                recommendedTracks.forEach(t => t.info.originalSource = 'youtube');
            }
        } catch (e) {}

        // Fallback Autoplay jika Gemini Gagal
        if (player.isAutoplayMode && !player.prefetchedAutoplayTrack) {
            if (recommendedTracks.length > 0) {
                player.prefetchedAutoplayTrack = recommendedTracks[0];
                player.prefetchedAutoplayTrack.info.requester = manager.client.user; 
                player.prefetchedAutoplayTrack.info.originalSource = 'youtube'; 
            } else {
                // Ekstra Fallback jika dropdown juga kosong
                try {
                    const extraFallback = await manager.poru.resolve({ 
                        query: `ytmsearch:${activeTrack.info.author} top tracks`, 
                        source: 'ytmsearch', 
                        requester: manager.client.user 
                    });
                    if (extraFallback && extraFallback.tracks && extraFallback.tracks.length > 0) {
                        const newTrack = extraFallback.tracks.find(t => !player.playedHistory.has(t.info.identifier));
                        if (newTrack) {
                            player.prefetchedAutoplayTrack = newTrack;
                            player.prefetchedAutoplayTrack.info.requester = manager.client.user; 
                            player.prefetchedAutoplayTrack.info.originalSource = 'youtube';
                        }
                    }
                } catch(e) {}
            }
        }

        if (!player.isAutoplayMode) player.prefetchedAutoplayTrack = null;
        
        return recommendedTracks;
    }
}