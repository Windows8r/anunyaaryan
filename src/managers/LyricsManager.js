// Lokasi: src/managers/LyricsManager.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Collection } = require('discord.js');
const axios = require('axios'); 
const lyricsFinder = require('lyrics-finder'); 
const ui = require('../config/ui');
const { GoogleGenerativeAI } = require('@google/generative-ai');

class LyricsManager {
    constructor(client) {
        this.client = client;
        this.lyricsCache = new Collection();
    }

    clearLyrics(guildId) {
        const cache = this.lyricsCache.get(guildId);
        if (cache) {
            if (cache.timeout) clearTimeout(cache.timeout);
            this.lyricsCache.delete(guildId);
        }
    }

    async fetchLyricsData(track) {
        const cleanTitle = track.info.title.replace(/(\(.*\)|\[.*\])/g, '').trim();
        const artist = track.info.author;
        
        try {
            // Utama: LRCLIB untuk lirik sinkron (Live Karaoke)
            const lrclibUrl = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(artist)}&track_name=${encodeURIComponent(cleanTitle)}&duration=${Math.round(track.info.length / 1000)}`;
            const response = await axios.get(lrclibUrl, { timeout: 4000 }).catch(() => null);
            
            if (response && response.data) {
                if (response.data.syncedLyrics) return { type: 'synced', data: this.parseLRC(response.data.syncedLyrics) };
                if (response.data.plainLyrics) return { type: 'plain', data: response.data.plainLyrics };
            }
        } catch (error) {}

        // Fallback 1: NPM lyrics-finder
        try {
            const nplLyrics = await lyricsFinder(artist, cleanTitle);
            if (nplLyrics) return { type: 'plain', data: nplLyrics };
        } catch (e) {}

        // Fallback 2: Gemini 2.5 Flash
        if (process.env.GEMINI_API_KEY) {
            try {
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-latest" });
                const prompt = `Tuliskan lirik lagu lengkap untuk "${cleanTitle}" oleh "${artist}". Balas HANYA teks lirik tanpa komentar. Jika tidak tahu, balas "NOT_FOUND".`;
                
                const aiResult = await model.generateContent(prompt);
                const aiText = aiResult.response.text().trim();
                if (aiText && aiText !== "NOT_FOUND") return { type: 'plain', data: aiText };
            } catch (e) {}
        }

        return null;
    }

    parseLRC(lrcContent) {
        const lines = lrcContent.split('\n');
        const timedLyrics = [];
        for (const line of lines) {
            const match = line.match(/\[(\d{2}):(\d{2}\.\d{2,3})\](.*)/);
            if (match) {
                const time = (parseInt(match[1]) * 60 + parseFloat(match[2])) * 1000;
                const text = match[3].trim();
                if (text) timedLyrics.push({ time, text });
            }
        }
        return timedLyrics;
    }

    async sendLyrics(interaction, manager, player, track, isEphemeral = false) {
        if (!interaction.deferred) {
            const options = isEphemeral ? { flags: 64 } : {};
            await interaction.deferReply(options).catch(() => {});
        }
        
        const lyricsObj = await this.fetchLyricsData(track);
        
        if (!lyricsObj) {
            return interaction.editReply({ content: `${ui.getEmoji('error')} Lirik tidak ditemukan di database global maupun memori AI untuk lagu ini.` }).catch(()=>{});
        }

        if (lyricsObj.type === 'synced') {
            return this.startLiveLyrics(interaction, player, track, lyricsObj.data, true);
        } 
        
        return this.sendPagedLyrics(interaction, player, track, lyricsObj.data);
    }

    // Fungsi format waktu (bantuan)
    formatDur(ms) {
        if (!ms || ms === 0 || !isFinite(ms)) return '0:00';
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }

    // ==========================================
    // 📖 MODE PAGED LYRICS (BEAUTIFIED)
    // ==========================================
    async sendPagedLyrics(interaction, player, track, textData) {
        try {
            let plainText = "Lirik tidak dapat diproses.";
            
            if (typeof textData === 'string') plainText = textData;
            else if (textData && typeof textData.data === 'string') plainText = textData.data;
            else if (Array.isArray(textData)) plainText = textData.join('\n'); 
            else if (textData) plainText = String(textData); 

            const lines = plainText.split('\n').filter(l => l.trim() !== '');
            const pages = [];
            
            // Pemotongan baris, 25 baris per halaman agar tidak terlalu penuh
            for (let i = 0; i < lines.length; i += 25) {
                pages.push(lines.slice(i, i + 25).join('\n'));
            }

            if (pages.length === 0) pages.push("Lirik kosong atau tidak terbaca.");

            let current = 0;
            const divider = `-# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

            // Membuat Header Informasi Lagu yang cantik
            const headerInfo = 
                `> ${ui.getEmoji('musicArtist')} **Artis:** \`${track.info.author}\`\n` +
                `> ⏳ **Durasi:** \`${this.formatDur(track.info.length)}\`\n` +
                `> 💿 **Album/Sumber:** \`${track.info.originalSource || 'YouTube'}\`\n${divider}\n\n`;

            const embed = new EmbedBuilder()
                .setColor(ui.getColor('primary') || '#00D9FF')
                .setAuthor({ name: `🎵 Lirik: ${track.info.title}`, iconURL: interaction.client.user.displayAvatarURL() })
                .setThumbnail(track.info.image || interaction.client.user.displayAvatarURL()) // Thumbnail agar tidak sepi
                .setDescription(headerInfo + pages[current].substring(0, 3800)) 
                .setFooter({ text: `Halaman ${current + 1}/${pages.length} • Naura Intelligence` });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('l_prev').setEmoji('⬅️').setStyle(ButtonStyle.Primary).setDisabled(true),
                new ButtonBuilder().setCustomId('l_close').setEmoji('✖️').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('l_next').setEmoji('➡️').setStyle(ButtonStyle.Primary).setDisabled(pages.length <= 1)
            );

            const msg = await interaction.editReply({ embeds: [embed], components: [row] });
            
            // Simpan ID pesan agar dihapus otomatis saat lagu berhenti (Sistem Anti-Spam)
            player.lyricsMessageId = msg.id;

            const collector = msg.createMessageComponentCollector({ time: 300000 }); 
            
            collector.on('collect', async (i) => {
                if (i.customId === 'l_prev') current--;
                if (i.customId === 'l_next') current++;
                if (i.customId === 'l_close') {
                    collector.stop();
                    player.lyricsMessageId = null; // Reset ID jika dihapus manual
                    return i.message.delete().catch(() => {});
                }

                embed.setDescription(headerInfo + pages[current].substring(0, 3800))
                     .setFooter({ text: `Halaman ${current + 1}/${pages.length} • Naura Intelligence` });
                
                row.components[0].setDisabled(current === 0);
                row.components[2].setDisabled(current === pages.length - 1);
                
                await i.update({ embeds: [embed], components: [row] }).catch(() => {});
            });

        } catch (error) {
            console.error('\x1b[41m\x1b[37m ⚠️ PAGED LYRICS ERROR \x1b[0m', error);
            interaction.editReply({ content: '❌ Terjadi kesalahan sistem saat memuat halaman lirik.' }).catch(()=>{});
        }
    }

    // ==========================================
    // 🎤 MODE LIVE KARAOKE (BEAUTIFIED)
    // ==========================================
    async startLiveLyrics(interaction, player, track, timedLyrics, isEdit = false) {
        const divider = `-# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
        
        // Header "Menunggu Lirik" yang jauh lebih estetik
        const standbyInfo = 
            `### 🎤 Karaoke: [${track.info.title}](${track.info.uri})\n` +
            `> ${ui.getEmoji('musicArtist')} **Artis:** \`${track.info.author}\`\n` +
            `> 💿 **Sumber:** \`${track.info.originalSource || 'YouTube'}\`\n` +
            `> ⏳ **Total Durasi:** \`${this.formatDur(track.info.length)}\`\n${divider}\n` +
            `*Sedang menyinkronkan data karaoke, mohon tunggu...* ${ui.getEmoji('loading')}`;

        const embed = new EmbedBuilder()
            .setColor(ui.getColor('accent') || '#FF69B4') // Warna pink cerah untuk karaoke
            .setThumbnail(track.info.image || interaction.client.user.displayAvatarURL())
            .setDescription(standbyInfo);

        const msg = isEdit ? await interaction.editReply({ embeds: [embed] }) : await interaction.reply({ embeds: [embed], fetchReply: true });
        
        // 1. Bersihkan sisa timer lama
        this.clearLyrics(player.guildId);

        // 2. Daftarkan ke cache agar mesin bisa berjalan
        this.lyricsCache.set(player.guildId, { timeout: null });
        
        // 3. Simpan ID agar otomatis terhapus saat lagu selesai
        player.lyricsMessageId = msg.id;

        const update = async () => {
            // Cek apakah lirik masih diizinkan berjalan
            if (!this.lyricsCache.has(player.guildId)) return; 
            if (!player.isPlaying || player.isPaused) return;

            const currentPos = player.position;
            const index = timedLyrics.findIndex((l, i) => {
                const next = timedLyrics[i + 1];
                return currentPos >= l.time && (!next || currentPos < next.time);
            });

            if (index !== -1) {
                // Formatting lirik yang sedang berjalan
                const linesText = [];
                
                // 3 baris yang sudah lewat (ditampilkan miring)
                const startIndex = Math.max(0, index - 3);
                for (let i = startIndex; i < index; i++) {
                    if (timedLyrics[i].text.trim() !== '') {
                        linesText.push(`*${timedLyrics[i].text}*`);
                    }
                }
                
                // Baris saat ini (menggunakan dot emoji dan ditebalkan)
                if (timedLyrics[index].text.trim() !== '') {
                    linesText.push(`### ${ui.getEmoji('dot')} **${timedLyrics[index].text}**`);
                } else {
                    linesText.push(`### ${ui.getEmoji('dot')} 🎵`);
                }
                
                // 3 baris yang akan muncul (ditampilkan miring)
                const endIndex = Math.min(timedLyrics.length - 1, index + 3);
                for (let i = index + 1; i <= endIndex; i++) {
                    if (timedLyrics[i].text.trim() !== '') {
                        linesText.push(`*${timedLyrics[i].text}*`);
                    }
                }
                
                embed.setDescription(`### 🎤 Karaoke: [${track.info.title}](${track.info.uri})\n${divider}\n\n${linesText.join('\n')}`);
                await msg.edit({ embeds: [embed] }).catch(() => {});
                
                const nextTime = timedLyrics[index + 1] ? (timedLyrics[index + 1].time - player.position) : 2000;
                
                const timeout = setTimeout(update, Math.max(nextTime, 500));
                this.lyricsCache.set(player.guildId, { timeout });
            } else {
                // Jika lagu belum mencapai lirik pertama, kembalikan standbyInfo
                embed.setDescription(standbyInfo);
                await msg.edit({ embeds: [embed] }).catch(() => {});
                
                const timeout = setTimeout(update, 1000);
                this.lyricsCache.set(player.guildId, { timeout });
            }
        };

        update();
    }
}

module.exports = LyricsManager;