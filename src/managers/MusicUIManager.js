// Lokasi: src/managers/MusicUIManager.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, AttachmentBuilder } = require('discord.js');
const { generateMusicPanelImage } = require('../utils/canvasHelper');
const ui = require('../config/ui'); 

class MusicUIManager {
    static formatDur(ms) {
        if (!ms || ms === 0 || !isFinite(ms)) return '0:00';
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    }

    static buildProgressBar(current, total) {
        if (total === 0 || !isFinite(total)) return `${ui.getEmoji('nowplaying')} **LIVE STREAM**`;
        const totalSegments = 12; 
        let progress = Math.round((current / total) * totalSegments);
        if (progress > totalSegments) progress = totalSegments;
        if (progress < 0) progress = 0;
        
        let bar = '';
        for (let i = 0; i < totalSegments; i++) {
            if (i < progress) bar += ui.getEmoji('progressLineBefore');
            else if (i === progress) bar += ui.getEmoji('progressDot');
            else bar += ui.getEmoji('progressLineAfter');
        }
        return bar;
    }

    static async renderPanel(manager, player, track, recommendedTracks = []) {
        try {
            const channel = manager.client.channels.cache.get(player.textChannel);
            if (!channel) return;

            console.log('\x1b[46m\x1b[30m 🎨 UI ENGINE \x1b[0m \x1b[36mMenggambar Canvas & Merakit Panel untuk:\x1b[0m', track.info.title);

            if (!player.currentFilterName) player.currentFilterName = 'Original Audio';

            const generatePayload = async (currentPos, isUpdate = false) => {
                const pBar = this.buildProgressBar(currentPos, track.info.length);
                const timeStr = track.info.isStream ? 'LIVE' : `${this.formatDur(currentPos)} / ${this.formatDur(track.info.length)}`;
                const requesterText = track.info.requester?.id ? `<@${track.info.requester.id}>` : `\`📻 Autoplay Engine\``;

                // 🟢🔴 DETEKSI PLATFORM CERDAS UNTUK WARNA & EMOJI
                let brandColor = ui.getColor('primary'); 
                let brandEmoji = '🎵';
                
                const source = track.info.originalSource || track.info.sourceName || 'youtube';

                if (source === 'spotify') {
                    brandColor = '#1DB954';
                    brandEmoji = ui.getEmoji('spotify') || '🟢';
                } else if (source === 'youtube') {
                    brandColor = '#FF0000';
                    brandEmoji = ui.getEmoji('youtube') || '🔴';
                } else if (source === 'soundcloud') {
                    brandColor = '#FF5500';
                    brandEmoji = '☁️';
                }

                const panelEmbed = new EmbedBuilder()
                    .setColor(brandColor)
                    .setAuthor({ name: `✦  N A U R A  M U S I C  P A N E L  ✦`, iconURL: manager.client.user.displayAvatarURL() })
                    .setDescription(
                        `### ${brandEmoji} [${track.info.title}](${track.info.uri})\n` +
                        `${ui.getEmoji('musicArtist')} **Artis:** \`${track.info.author}\`\n` +
                        `${ui.getEmoji('musicListener')} **Permintaan:** ${requesterText}\n\n` +
                        `> ${pBar} \`[ ${timeStr} ]\`\n\n` +
                        `**━━━ 𝐒𝐘𝐒𝐓𝐄𝐌 𝐏𝐀𝐑𝐀𝐌𝐄𝐓𝐄𝐑𝐒 ━━━**\n` +
                        `> 🔊 **Volume:** \`${player.volume}%\`\n` +
                        `> ${ui.getEmoji('filter')} **Filter DSP:** \`${player.currentFilterName}\`\n` +
                        `> ${ui.getEmoji('musicLoop')} **Looping:** \`${player.loop}\`\n` +
                        `> ${ui.getEmoji('musicAutoplay')} **Autoplay:** \`${player.isAutoplayMode ? 'Aktif' : 'Nonaktif'}\`\n` +
                        `> ${ui.getEmoji('music247')} **Mode 24/7:** \`${player.is247 ? 'Aktif' : 'Nonaktif'}\``
                    )
                    .setFooter({ text: 'Naura Intelligence • Pembaruan waktu nyata' });

                let payload = { embeds: [panelEmbed], components: [] };

                const uniqueFileName = `naura-panel-${Date.now()}.png`;
                const imageBuffer = await generateMusicPanelImage(track, currentPos, manager.client.user.displayAvatarURL({ extension: 'png' }));
                const attachment = new AttachmentBuilder(imageBuffer, { name: uniqueFileName });
                
                panelEmbed.setImage(`attachment://${uniqueFileName}`);
                payload.files = [attachment];

                if (isUpdate) payload.attachments = [];

                const rowDropdown = recommendedTracks.length > 0 ? new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('music_recommendation')
                        .setPlaceholder('📻 Rekomendasi Trek Audio Berikutnya')
                        .addOptions(recommendedTracks.map(t => ({
                            label: t.info.title.substring(0, 95),
                            description: t.info.author.substring(0, 40),
                            value: t.info.uri.substring(0, 100), 
                            emoji: ui.getEmoji('normal')
                        })))
                ) : null;

                const rowFilter = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('music_filter')
                        .setPlaceholder(`🎛️ DSP Filter: ${player.currentFilterName}`)
                        .addOptions([
                            { label: 'Original Audio', description: 'Frekuensi murni', value: 'clear', emoji: ui.getEmoji('normal') },
                            { label: 'Sub-Bassboost', description: 'Peningkatan nada rendah', value: 'bassboost', emoji: ui.getEmoji('bassboost') },
                            { label: 'Nightcore Shift', description: 'Peningkatan tempo', value: 'nightcore', emoji: ui.getEmoji('nightcore') },
                            { label: 'Vaporwave Reverb', description: 'Gema ruang', value: 'vaporwave', emoji: ui.getEmoji('vaporwave') }
                        ])
                );

                const rowMedia = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('music_pause').setEmoji(ui.getEmoji('musicPlayPause')).setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('music_stop').setEmoji(ui.getEmoji('musicStop')).setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('music_skip').setEmoji(ui.getEmoji('musicSkip')).setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('music_loop').setEmoji(ui.getEmoji('musicLoop')).setStyle(player.loop !== 'NONE' ? ButtonStyle.Primary : ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('music_autoplay').setEmoji(ui.getEmoji('musicAutoplay')).setStyle(player.isAutoplayMode ? ButtonStyle.Primary : ButtonStyle.Secondary)
                );

                const rowUtils = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('music_voldown').setEmoji(ui.getEmoji('musicVolDown')).setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('music_volup').setEmoji(ui.getEmoji('musicVolUp')).setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('music_lyrics').setEmoji(ui.getEmoji('musicLyrics')).setLabel('Lirik').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('music_247').setEmoji(ui.getEmoji('music247')).setStyle(player.is247 ? ButtonStyle.Primary : ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('music_save').setEmoji(ui.getEmoji('favorite')).setStyle(ButtonStyle.Success)
                );

                payload.components = [rowFilter, rowMedia, rowUtils];
                if (rowDropdown) payload.components.unshift(rowDropdown);

                return payload;
            };

            const initialPayload = await generatePayload(0, false);
            const message = await channel.send(initialPayload);

            const oldCache = manager.uiCache.get(player.guildId);
            if (oldCache && oldCache.messageId) {
                channel.messages.fetch(oldCache.messageId).then(m => m.delete().catch(()=>{})).catch(()=>{});
                if (oldCache.interval) clearInterval(oldCache.interval);
            }

            const updateIntervalMs = 15000; 

            const interval = setInterval(async () => {
                if (!player.isPlaying || player.isPaused) return;
                try {
                    const currentMsg = await channel.messages.fetch(message.id).catch(() => null);
                    if (!currentMsg) {
                        clearInterval(interval);
                        return;
                    }
                    const updatePayload = await generatePayload(player.position, true);
                    await currentMsg.edit(updatePayload).catch(()=>{});
                } catch(e) {}
            }, updateIntervalMs);

            manager.uiCache.set(player.guildId, {
                messageId: message.id,
                interval: interval,
                generatePayload: generatePayload 
            });

        } catch (error) {
            console.error('\x1b[41m\x1b[37m ⚠️ UI ERROR \x1b[0m', error);
        }
    }
}

module.exports = MusicUIManager;