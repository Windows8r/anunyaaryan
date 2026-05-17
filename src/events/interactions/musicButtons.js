// Lokasi: src/events/interactions/musicButtons.js
const { EmbedBuilder } = require('discord.js');
const ui = require('../../config/ui');
const UserProfile = require('../../models/UserProfile');
const GuildSettings = require('../../models/GuildSettings');
const LyricsManager = require('../../managers/LyricsManager'); // 👈 Memanggil mesin lirik baru

const DEFAULT_EMOJIS = {
    nowplaying: '<a:DiscSpinner1:1492696912145678488>', 
    favorite: '<a:SpinHeart:1492696848643915796>',
    filter: '<:Filter:1484705994020753529>',
    musicPlayPause: '<:PlayPause:1484705975998091375>', 
    musicSkip: '<:Skip:1484705981152755712>',
    musicStop: '<:Stop:1484705983778525315>',
    musicLoop: '<:Loop:1484705967991034010>',
    musicVolDown: '<:VolumeDown:1484874588524646621>',
    musicVolUp: '<:VolumeUp:1484874537110864034>',
    musicAutoplay: '<:AutoPlay:1484705985980268744>',
    musicLyrics: '<:Lyrics:1484705972919337070>',
    musicShuffle: '<:Shuffle:1484705970469867641>',
    music247: '<a:Moon:1492696850602524682>'
};

const getEmoji = (name) => {
    if (ui && ui.getEmoji) { const e = ui.getEmoji(name); if (e) return e; }
    return DEFAULT_EMOJIS[name] || '🎵';
};

const safeStopTrack = (player) => {
    if (!player) return;
    if (typeof player.stopTrack === 'function') player.stopTrack();
    else if (player.node && player.node.rest) player.node.rest.updatePlayer({ guildId: player.guildId, data: { track: { encoded: null } } }).catch(()=>{});
};

module.exports = async (interaction, client) => {
    const poru = client.musicManager.poru;
    const player = poru.players.get(interaction.guildId);
    const errorEmbed = new EmbedBuilder().setColor(ui.getColor('error') || '#ff0000');
    
    if (!player) return interaction.reply({ embeds: [errorEmbed.setDescription(`❌ | Sesi transmisi audio telah berakhir.`)], ephemeral: true }).catch(()=>{});

    const memberVoice = interaction.member.voice?.channel;
    if (!memberVoice || memberVoice.id !== player.voiceChannel) {
        return interaction.reply({ embeds: [errorEmbed.setDescription(`❌ | Akses ditolak. Harus berada di Voice Channel yang sama.`)], ephemeral: true }).catch(()=>{});
    }

    // 🛑 PERBAIKAN FATAL: Jangan deferReply jika tombol yang ditekan adalah lirik!
    // LyricsManager akan mengurus defer-nya sendiri agar tidak terjadi error bentrok.
    if (interaction.customId !== 'music_lyrics') {
        try { await interaction.deferReply({ ephemeral: true }); } catch (err) { return; }
    }

    const actionEmbed = new EmbedBuilder().setColor(ui.getColor('primary') || '#00D9FF');

    // Handle Select Menus
    if (interaction.isStringSelectMenu()) {
        switch (interaction.customId) {
            case 'music_recommendation':
                const trackUri = interaction.values[0];
                try {
                    const res = await poru.resolve({ query: trackUri, requester: interaction.user });
                    if (res && res.tracks && res.tracks.length > 0) {
                        player.queue.add(res.tracks[0]);
                        if (!player.isPlaying && !player.isPaused) player.play();
                        return interaction.editReply({ embeds: [actionEmbed.setDescription(`${getEmoji('nowplaying')} | Trek **[${res.tracks[0].info.title}](${res.tracks[0].info.uri})** ditambahkan!`)] }).catch(()=>{});
                    }
                } catch(e) { return interaction.editReply({ embeds: [errorEmbed.setDescription(`❌ | Gagal memuat trek rekomendasi.`)] }).catch(()=>{}); }
                return;

            case 'music_filter':
                const isRequester = player.currentTrack?.info?.requester?.id === interaction.user.id;
                const isDJ = interaction.member.permissions.has('ManageChannels') || interaction.member.roles.cache.some(r => r.name.toLowerCase() === 'dj');
                if (!isRequester && !isDJ) {
                    return interaction.editReply({ embeds: [errorEmbed.setDescription(`🛡️ | Hanya peminta lagu saat ini atau Staff (DJ) yang diizinkan.`)] });
                }

                const filterType = interaction.values[0];
                const applyFilter = (filterPayload, name) => {
                    player.currentFilterName = name;
                    player.node.rest.updatePlayer({ guildId: player.guildId, data: { filters: filterPayload } });
                };

                if (filterType === 'clear') applyFilter({}, 'Original Audio');
                if (filterType === 'bassboost') applyFilter({ equalizer: [{ band: 0, gain: 0.6 }, { band: 1, gain: 0.6 }, { band: 2, gain: 0.4 }] }, 'Sub-Bassboost');
                if (filterType === 'nightcore') applyFilter({ timescale: { speed: 1.2, pitch: 1.2, rate: 1 } }, 'Nightcore Shift');
                if (filterType === 'vaporwave') applyFilter({ timescale: { speed: 0.8, pitch: 0.8, rate: 1 } }, 'Vaporwave Reverb');
                
                client.musicManager.updatePanelEmbed(player);
                return interaction.editReply({ embeds: [actionEmbed.setDescription(`${getEmoji('filter')} | Filter DSP Audio diubah ke: **${player.currentFilterName}**.`)] });
        }
        return;
    }

    // Permissions check for buttons
    const isRequester = player.currentTrack?.info?.requester?.id === interaction.user.id;
    const isDJ = interaction.member.permissions.has('ManageChannels') || interaction.member.roles.cache.some(r => r.name.toLowerCase() === 'dj');
    const requiresDJ = ['music_stop', 'music_skip', 'music_pause', 'music_247', 'music_autoplay', 'music_loop', 'music_shuffle', 'music_lyrics'];

    if (requiresDJ.includes(interaction.customId) && !isRequester && !isDJ) {
        // Khusus music_lyrics, karena belum di-defer, kita gunakan reply() bukan editReply()
        if (interaction.customId === 'music_lyrics') {
            return interaction.reply({ embeds: [errorEmbed.setDescription(`🛡️ | Hanya peminta lagu saat ini atau Staff (DJ) yang diizinkan.`)], ephemeral: true });
        }
        return interaction.editReply({ embeds: [errorEmbed.setDescription(`🛡️ | Hanya peminta lagu saat ini atau Staff (DJ) yang diizinkan.`)] });
    }

    // Handle Buttons using Switch-Case
    switch (interaction.customId) {
        case 'music_save':
            try {
                let [userProfile] = await UserProfile.findOrCreate({ where: { userId: interaction.user.id } });
                if (!player.currentTrack || !player.currentTrack.info) return interaction.editReply({ embeds: [errorEmbed.setDescription(`❌ | Tidak ada data trek valid.`)] });
                
                const savedData = `${player.currentTrack.info.title} | ${player.currentTrack.info.uri}`;
                let playlist = userProfile.music_playlist ? JSON.parse(userProfile.music_playlist) : [];
                
                if (!playlist.includes(savedData)) {
                    playlist.push(savedData);
                    userProfile.music_playlist = JSON.stringify(playlist);
                    await userProfile.save();
                    return interaction.editReply({ embeds: [new EmbedBuilder().setColor('#00ff00').setDescription(`${getEmoji('favorite')} | **${player.currentTrack.info.title}** ditambahkan ke Naura Playlist!`)] });
                } else {
                    return interaction.editReply({ embeds: [errorEmbed.setColor('#ffa500').setDescription(`⚠️ | Lagu ini sudah ada di daftar favorit Anda.`)] });
                }
            } catch (e) { return interaction.editReply({ embeds: [errorEmbed.setDescription(`❌ | Gagal sinkronisasi DB.`)] }); }
            break;

        case 'music_lyrics':
            if (!player.currentTrack || !player.currentTrack.info) {
                return interaction.reply({ embeds: [errorEmbed.setDescription(`❌ | Data metadata lagu kosong.`)], flags: 64 });
            }
            
            const lyricsEngine = new LyricsManager(client);
            // Panggil sendLyrics. Parameter kelima (false) akan membuatnya jadi publik!
            await lyricsEngine.sendLyrics(interaction, client.musicManager, player, player.currentTrack, false);
            break;

        case 'music_autoplay':
            player.isAutoplayMode = !player.isAutoplayMode;
            if (player.isAutoplayMode) player.setLoop('NONE'); 
            client.musicManager.updatePanelEmbed(player);
            return interaction.editReply({ embeds: [actionEmbed.setDescription(`${getEmoji('musicAutoplay')} | Autoplay AI **${player.isAutoplayMode ? 'DIAKTIFKAN' : 'DIMATIKAN'}**.`)] });
            
        case 'music_shuffle':
            player.queue.shuffle();
            client.musicManager.updatePanelEmbed(player);
            return interaction.editReply({ embeds: [actionEmbed.setDescription(`${getEmoji('musicShuffle')} | Antrean berhasil diacak (shuffled)!`)] });
            
        case 'music_loop':
            const modes = { 'NONE': 'TRACK', 'TRACK': 'QUEUE', 'QUEUE': 'NONE' };
            player.setLoop(modes[player.loop] || 'NONE');
            if (player.loop !== 'NONE') player.isAutoplayMode = false; 
            client.musicManager.updatePanelEmbed(player);
            const modeNames = { 'NONE': 'Nonaktif', 'TRACK': 'Ulangi 1 Trek', 'QUEUE': 'Ulangi Seluruh Antrean' };
            return interaction.editReply({ embeds: [actionEmbed.setDescription(`${getEmoji('musicLoop')} | Looping diatur ke: **${modeNames[player.loop]}**.`)] });
            
        case 'music_247':
            player.is247 = !player.is247;
            client.musicManager.updatePanelEmbed(player);
            try {
                const [guildData] = await GuildSettings.findOrCreate({ where: { guildId: interaction.guildId } });
                let musicData = guildData.music || {};
                musicData.twentyFourSeven = player.is247;
                musicData.voiceChannel = player.is247 ? player.voiceChannel : null;
                musicData.textChannel = player.is247 ? player.textChannel : null;
                guildData.music = musicData;
                guildData.changed('music', true);
                await guildData.save();
            } catch (e) {}
            return interaction.editReply({ embeds: [actionEmbed.setDescription(`${getEmoji('music247')} | Mode Siaga 24/7 **${player.is247 ? 'DIAKTIFKAN' : 'DIMATIKAN'}**.`)] });
            
        case 'music_voldown':
            player.setVolume(Math.max(10, player.volume - 10));
            client.musicManager.updatePanelEmbed(player);
            return interaction.editReply({ embeds: [actionEmbed.setDescription(`${getEmoji('musicVolDown')} | Volume diturunkan ke **${player.volume}%**.`)] });
            
        case 'music_volup':
            player.setVolume(Math.min(100, player.volume + 10));
            client.musicManager.updatePanelEmbed(player);
            return interaction.editReply({ embeds: [actionEmbed.setDescription(`${getEmoji('musicVolUp')} | Volume dinaikkan ke **${player.volume}%**.`)] });
            
        case 'music_pause':
            player.pause(!player.isPaused);
            client.musicManager.updatePanelEmbed(player);
            return interaction.editReply({ embeds: [actionEmbed.setDescription(`${getEmoji('musicPlayPause')} | Transmisi audio **${player.isPaused ? 'DIJEDA' : 'DILANJUTKAN'}**.`)] });
            
        case 'music_skip':
            safeStopTrack(player); 
            return interaction.editReply({ embeds: [actionEmbed.setDescription(`${getEmoji('musicSkip')} | Melewati trek saat ini. Bersiap memutar selanjutnya...`)] });
            
        case 'music_stop':
            player.is247 = false; player.destroy();
            return interaction.editReply({ embeds: [errorEmbed.setDescription(`${getEmoji('musicStop')} | Transmisi dihentikan. Naura pamit dari Voice Channel.`)] });
    }
};