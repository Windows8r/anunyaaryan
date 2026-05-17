// Lokasi: src/events/poru/queueEnd.js
const { EmbedBuilder } = require('discord.js');
const ui = require('../../config/ui');
const LyricsManager = require('../../managers/LyricsManager');
const { GoogleGenerativeAI } = require('@google/generative-ai');

module.exports = {
    async execute(manager, player) {
        // 1. Bersihkan lirik Karaoke dari panel teks
        if (player.lyricsMessageId) {
            const channel = manager.client.channels.cache.get(player.textChannel);
            if (channel) {
                channel.messages.fetch(player.lyricsMessageId)
                    .then(m => m.delete().catch(() => {}))
                    .catch(() => {});
            }
            player.lyricsMessageId = null;
        }

        try {
            const lyricsEngine = new LyricsManager(manager.client);
            lyricsEngine.clearLyrics(player.guildId);
        } catch (e) {}

        // 2. EKSEKUSI AUTOPLAY
        if (player.isAutoplayMode) {
            if (player.isAutoplayResolving) return;
            player.isAutoplayResolving = true;

            let trackToPlay = player.prefetchedAutoplayTrack;
            player.prefetchedAutoplayTrack = null; 

            // Jika tidak ada lagu yang di-prefetch (misal autoplay dinyalakan di tengah lagu), minta ke Gemini secara langsung
            if (!trackToPlay && process.env.GEMINI_API_KEY && player.previousTrack) {
                console.log(`\x1b[45m\x1b[37m 💿 AUTOPLAY \x1b[0m \x1b[35mMencari lagu rekomendasi AI...\x1b[0m`);
                try {
                    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-latest" });
                    const activeTrack = player.previousTrack;
                    const prompt = `Aku sedang memutar lagu "${activeTrack.info.title}" oleh "${activeTrack.info.author}".
                    Berikan 1 rekomendasi lagu selanjutnya yang memiliki vibe sangat mirip. Balas HANYA dengan format murni: "Judul Lagu - Nama Artis".`;

                    const aiResult = await model.generateContent(prompt);
                    const aiQuery = aiResult.response.text().trim();

                    const searchRes = await manager.poru.resolve({ query: `ytmsearch:${aiQuery} official audio`, source: 'ytmsearch', requester: manager.client.user });
                    if (searchRes && searchRes.tracks && searchRes.tracks.length > 0) {
                        trackToPlay = searchRes.tracks[0];
                        trackToPlay.info.requester = manager.client.user;
                        trackToPlay.info.originalSource = 'youtube';
                    }
                } catch (e) {
                    console.error(`\x1b[41m\x1b[37m ⚠️ GEMINI ERROR \x1b[0m Gagal fetch fallback autoplay: ${e.message}`);
                }
            }

            // Fallback Ekstra ke YouTube Music jika Gemini gagal
            if (!trackToPlay && player.previousTrack) {
                try {
                    const searchRes = await manager.poru.resolve({ query: `ytmsearch:${player.previousTrack.info.author} top tracks`, source: 'ytmsearch', requester: manager.client.user });
                    if (searchRes && searchRes.tracks && searchRes.tracks.length > 0) {
                        trackToPlay = searchRes.tracks.find(t => !player.playedHistory?.has(t.info.identifier)) || searchRes.tracks[0];
                        trackToPlay.info.requester = manager.client.user;
                        trackToPlay.info.originalSource = 'youtube';
                    }
                } catch (e) {}
            }

            if (trackToPlay) {
                console.log(`\x1b[45m\x1b[37m 💿 AUTOPLAY \x1b[0m \x1b[35mMemutar lagu rekomendasi: ${trackToPlay.info.title}\x1b[0m`);
                player.queue.add(trackToPlay);
                player.isAutoplayResolving = false;
                return player.play();
            } else {
                player.isAutoplayResolving = false;
            }
        }

        if (player.is247) return;

        player.destroy();
        const channel = manager.client.channels.cache.get(player.textChannel);
        if (channel) {
            const exitEmbed = new EmbedBuilder()
                .setColor(ui.getColor('error') || '#ff0000')
                .setDescription(`⏹️ | Antrean lagu telah habis. Naura pamit dari Voice Channel!`);
            channel.send({ embeds: [exitEmbed] }).then(m => setTimeout(() => m.delete().catch(()=>{}), 15000)).catch(()=>{});
        }
    }
};