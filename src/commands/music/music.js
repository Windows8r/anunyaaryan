// Lokasi: src/commands/music.js
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType, AttachmentBuilder } = require('discord.js');
const ui = require('../../config/ui');
const UserProfile = require('../../models/UserProfile');
const GuildSettings = require('../../models/GuildSettings');
const UserPlaylist = require('../../models/UserPlaylist');
const spotifyHelper = require('../../utils/spotifyHelper');
const { generateMusicProfileImage } = require('../../utils/canvasHelper'); 

const formatDuration = (ms) => {
    if (!ms || isNaN(ms)) return '0:00';
    if (ms >= 8640000000) return '🔴 LIVE'; 
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

// Fungsi bantuan untuk mendapatkan icon platform dari ui.js
const getPlatformIcon = (sourceName) => {
    if (sourceName === 'spotify') return ui.getEmoji('spotify');
    if (sourceName === 'youtube' || sourceName === 'ytmsearch') return ui.getEmoji('youtube');
    if (sourceName === 'soundcloud') return ui.getEmoji('soundcloud');
    if (sourceName === 'apple') return ui.getEmoji('apple');
    return '🎵';
};

async function runMusicLogic(client, user, member, guild, channel, subcommand, args, sendReply, isSlash) {
    const poru = client.musicManager.poru;
    const memberVoice = member?.voice?.channel;
    const eError = ui.getEmoji('error');
    const errorEmbed = new EmbedBuilder().setColor(ui.getColor('error') || '#ff0000');
    const divider = `-# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    if (subcommand === 'profile') {
        let target = user;
        if (isSlash && args.target) target = args.target;
        if (target.bot) return sendReply({ embeds: [errorEmbed.setDescription(`${eError} | Bot tidak memiliki kartu profil musik!`)] });
        try {
            const [profile] = await UserProfile.findOrCreate({ where: { userId: target.id } });
            const parseJSONSafely = (data, defaultObj) => { if (!data) return defaultObj; if (typeof data === 'string') { try { return JSON.parse(data); } catch (e) { return defaultObj; } } return data; };
            // Logika untuk mengambil Top 5
            const calculateTop5 = (jsonString) => {
                if (!jsonString) return [];
                try {
                    let data = JSON.parse(jsonString);
                    if (!data.history) return [];
                    const sorted = Object.entries(data.history).sort((a, b) => b[1] - a[1]);
                    return sorted.slice(0, 5).map(entry => entry[0]);
                } catch (e) { return []; }
            };

            const stats = { 
                tracksListened: profile.music_tracksListened || 0, 
                totalDurationMs: profile.music_totalDurationMs || 0, 
                lastListened: profile.music_lastListened || 'Belum ada data',
                topTracks: calculateTop5(profile.music_topTrack), // Mengirim Array Top 5
                topServers: calculateTop5(profile.music_topServer), // Mengirim Array Top 5
                topFriends: calculateTop5(profile.music_topFriend), // Mengirim Array Top 5
                isPremium: profile.isPremium && profile.premiumUntil > new Date() // Cek Status VIP
            };
            const imageBuffer = await generateMusicProfileImage(target, stats, client.user.displayAvatarURL({ extension: 'png' }));
            return sendReply({ content: null, embeds: [], files: [new AttachmentBuilder(imageBuffer, { name: 'naura-audiophile.png' })] });
        } catch (error) { return sendReply({ embeds: [errorEmbed.setDescription(`${eError} | Gagal merender kartu profil dari server.`)] }, true); }
    }

    if (!memberVoice) return sendReply({ embeds: [errorEmbed.setDescription(`${eError} | Anda harus berada di dalam Voice Channel terlebih dahulu!`)] }, true);

    let player = poru.players.get(guild.id);
    if (player && player.voiceChannel !== memberVoice.id) return sendReply({ embeds: [errorEmbed.setDescription(`${eError} | Naura sedang aktif di Voice Channel lain.`)] }, true);

    // ==========================================
    // 📻 SUBCOMMAND: LOFI & RADIO 
    // ==========================================
    if (subcommand === 'lofi' || subcommand === 'radio') {
        if (!player) player = poru.createConnection({ guildId: guild.id, voiceChannel: memberVoice.id, textChannel: channel.id, deaf: true });
        
        const isLofi = subcommand === 'lofi';
        const searchQuery = isLofi ? 'ytsearch:lofi hip hop radio - beats to relax/study to live' : 'ytsearch:NoCopyrightSounds 24/7 live stream';
        const stColor = isLofi ? '#9b59b6' : '#f1c40f'; 
        const stIcon = isLofi ? '☕' : '📻';

        const actionEmbed = new EmbedBuilder().setColor(stColor).setDescription(`⏳ Memindai frekuensi stasiun **${subcommand.toUpperCase()}**...`);
        await sendReply({ embeds: [actionEmbed] }, false);

        const res = await poru.resolve({ query: searchQuery, requester: user });
        if (res && res.tracks && res.tracks.length > 0) {
            player.queue.clear(); 
            res.tracks[0].info.originalSource = 'youtube'; // Tagging Identitas
            player.queue.add(res.tracks[0]);
            player.is247 = true; 
            
            const [guildData] = await GuildSettings.findOrCreate({ where: { guildId: guild.id } });
            guildData.music = { twentyFourSeven: true, voiceChannel: player.voiceChannel, textChannel: player.textChannel };
            guildData.changed('music', true);
            await guildData.save();

            if (!player.isPlaying && !player.isPaused) player.play();
            return sendReply({ embeds: [new EmbedBuilder().setColor(stColor).setDescription(`### ${stIcon} Stasiun Terhubung\n${divider}\nMode transmisi 24/7 otomatis aktif.`)] });
        }
        return sendReply({ embeds: [errorEmbed.setDescription(`${eError} | Gagal mengunci frekuensi stasiun.`)] }, true);
    }

    // ==========================================
    // 🎵 SUBCOMMAND: PLAY
    // ==========================================
    if (subcommand === 'play') {
        if (!player) {
            player = poru.createConnection({ guildId: guild.id, voiceChannel: memberVoice.id, textChannel: channel.id, deaf: true });
            player.is247 = false; 
        }

        let query = args.query;
        if (!query) return sendReply({ embeds: [errorEmbed.setDescription(`${eError} | Harap masukkan judul lagu atau URL yang ingin diputar.`)] }, true);

        let isSpotifyLink = false;
        let res;

        // 🛑 CARA LAMA: PENCEGAT SPOTIFY (SPOTIFY INTERCEPTOR)
        if (query.match(/^(https?:\/\/)?(open\.)?spotify\.com\/(track|album|playlist)\/[a-zA-Z0-9]+/)) {
            isSpotifyLink = true;
            const actionEmbed2 = new EmbedBuilder().setColor('#1DB954').setDescription(`🔍 Menerjemahkan link Spotify ke ekosistem audio Naura...`);
            await sendReply({ embeds: [actionEmbed2] }, false); 
            
            const spotifyData = await spotifyHelper.resolveToYTM(query);
            if (!spotifyData || !spotifyData.queries || spotifyData.queries.length === 0) {
                return sendReply({ embeds: [errorEmbed.setDescription(`${eError} | Gagal membaca link Spotify tersebut.`)] }, true);
            }

            if (spotifyData.type === 'track') {
                query = spotifyData.queries[0]; 
            } else {
                const playlistEmbed = new EmbedBuilder().setColor('#1DB954').setDescription(`📥 Memuat **${spotifyData.queries.length}** lagu dari Spotify Playlist...`);
                await sendReply({ embeds: [playlistEmbed] }, true);

                let loaded = 0;
                let firstTrack = null;
                (async () => {
                    for (const ytmQuery of spotifyData.queries) {
                        try {
                            const sr = await poru.resolve({ query: ytmQuery, source: 'ytmsearch', requester: user });
                            if (sr && sr.tracks && sr.tracks.length > 0) {
                                sr.tracks[0].info.requester = user;
                                sr.tracks[0].info.originalSource = 'spotify'; // 👈 TAGGING
                                player.queue.add(sr.tracks[0]);
                                loaded++;
                                if (!firstTrack) {
                                    firstTrack = sr.tracks[0];
                                    if (!player.isPlaying && !player.isPaused) player.play();
                                }
                            }
                        } catch (e) {}
                    }
                    if (channel) channel.send({ embeds: [new EmbedBuilder().setColor('#1DB954').setDescription(`✅ **${loaded}** lagu dari Spotify berhasil dimasukkan!`)] }).then(m => setTimeout(() => m.delete().catch(()=>{}), 15000)).catch(()=>{});
                })();
                return; 
            }
        }

        // 🌐 PENCARIAN NORMAL YTM/LAINNYA
        let searchSource = 'ytmsearch';
        if (query.startsWith('scsearch:')) { searchSource = 'scsearch'; query = query.replace('scsearch:', '').trim(); }
        else if (query.startsWith('spsearch:')) { searchSource = 'spsearch'; query = query.replace('spsearch:', '').trim(); }
        else if (query.startsWith('ytsearch:')) { searchSource = 'ytsearch'; query = query.replace('ytsearch:', '').trim(); }
        else if (query.startsWith('ytmsearch:')) { searchSource = 'ytmsearch'; query = query.replace('ytmsearch:', '').trim(); }
        else if (query.startsWith('amsearch:')) { searchSource = 'amsearch'; query = query.replace('amsearch:', '').trim(); }

        if (!isSpotifyLink) {
            const searchActionEmbed = new EmbedBuilder().setColor(ui.getColor('primary')).setDescription(`🔍 Menganalisis gelombang suara untuk: **${query}** melalui \`${searchSource}\`...`);
            await sendReply({ embeds: [searchActionEmbed] }, false);
        }

        if (query.match(/^(https?:\/\/)/)) res = await poru.resolve({ query: query, requester: user });
        else res = await poru.resolve({ query: query, source: searchSource, requester: user });

        if (!res || !res.tracks || res.tracks.length === 0 || res.loadType === 'empty' || res.loadType === 'NO_MATCHES') {
            return sendReply({ embeds: [errorEmbed.setDescription(`${eError} | Frekuensi audio tidak ditemukan.`)] }, true);
        }

        let brandColor = '#FF0000';
        let brandEmoji = ui.getEmoji('youtube');
        
        if (isSpotifyLink || searchSource === 'spsearch') { brandColor = '#1DB954'; brandEmoji = ui.getEmoji('spotify'); }
        else if (searchSource === 'scsearch') { brandColor = '#FF7700'; brandEmoji = ui.getEmoji('soundcloud'); }
        else if (searchSource === 'amsearch') { brandColor = '#FA243C'; brandEmoji = ui.getEmoji('apple'); }

        if (res.loadType === 'playlist' || res.loadType === 'PLAYLIST_LOADED') {
            const trackToPlay = res.tracks[0];
            for (const track of res.tracks) {
                track.info.requester = user; 
                if (isSpotifyLink) track.info.originalSource = 'spotify'; // 👈 TAGGING
                player.queue.add(track);
            }
            const actionEmbed = new EmbedBuilder().setColor(brandColor)
                .setThumbnail(trackToPlay.info.image || client.user.displayAvatarURL())
                .setDescription(`### ${brandEmoji} Playlist Dimuat\n${ui.getEmoji('musicArtist')} **Total:** \`${res.tracks.length} Lagu\`\n⏳ Memasukkan ke antrean.`);
            sendReply({ embeds: [actionEmbed] }, true); 
            if (!player.isPlaying && !player.isPaused) player.play();
            return;
        }

        const track = res.tracks[0];
        track.info.requester = user; 
        if (isSpotifyLink) track.info.originalSource = 'spotify'; // 👈 TAGGING
        player.queue.add(track);
        if (!player.isPlaying && !player.isPaused) player.play();

        const actionEmbed = new EmbedBuilder().setColor(brandColor)
            .setThumbnail(track.info.image || client.user.displayAvatarURL())
            .setDescription(`### ${brandEmoji} [${track.info.title}](${track.info.uri})\n${ui.getEmoji('musicArtist')} **Artis:** \`${track.info.author}\`\n⏳ **Durasi:** \`${formatDuration(track.info.length)}\``);

        return sendReply({ embeds: [actionEmbed] }, true); 
    }

    if (subcommand === 'import') {
        const url = args.url || args.query;
        if (!url || !url.match(/^https?:\/\//)) return sendReply({ embeds: [errorEmbed.setDescription(`${eError} | Harap masukkan URL Playlist yang valid.`)] }, true);

        const actionEmbed = new EmbedBuilder().setColor('#1DB954').setDescription(`⏳ Sedang mengimpor playlist ke database Naura...`);
        await sendReply({ embeds: [actionEmbed] });

        try {
            let playlistName = 'Imported Playlist';
            let tracksToSave = [];

            if (url.match(/^(https?:\/\/)?(open\.)?spotify\.com\/(playlist|album)\/[a-zA-Z0-9]+/)) {
                const spotifyData = await spotifyHelper.resolveToYTM(url);
                if (spotifyData && spotifyData.queries && spotifyData.queries.length > 0) {
                    playlistName = 'Spotify Imported Playlist';
                    tracksToSave = spotifyData.queries; 
                }
            } else {
                const res = await poru.resolve({ query: url, requester: user });
                if (res && (res.loadType === 'PLAYLIST_LOADED' || res.loadType === 'playlist')) {
                    playlistName = res.playlistInfo.name || 'Imported Playlist';
                    tracksToSave = res.tracks.map(t => t.info.uri || t.info.title);
                }
            }

            if (tracksToSave.length === 0) return sendReply({ embeds: [errorEmbed.setDescription(`${eError} | Gagal mengimpor data.`)] }, true);

            await UserPlaylist.create({ userId: user.id, name: playlistName, tracks: tracksToSave, spotifyUrl: url });
            actionEmbed.setDescription(`### ${ui.getEmoji('success')} Berhasil Diimpor\n**Nama:** \`${playlistName}\`\n**Total:** \`${tracksToSave.length} Trek\`\n\nGunakan \`/music playplaylist\` untuk memutar!`);
            return sendReply({ embeds: [actionEmbed] }); 
        } catch (error) { return sendReply({ embeds: [errorEmbed.setDescription(`${eError} | Terjadi kesalahan saat memproses URL.`)] }, true); }
    }

    if (subcommand === 'myplaylist') {
        const playlists = await UserPlaylist.findAll({ where: { userId: user.id } });
        if (playlists.length === 0) return sendReply({ embeds: [errorEmbed.setDescription(`${eError} | Kamu belum memiliki playlist tersimpan.`)] }, true);

        const embed = new EmbedBuilder().setColor(ui.getColor('primary')).setTitle('📁 Daftar Playlist Tersimpan');
        let desc = '';
        playlists.forEach((p, i) => { desc += `**${i + 1}.** ${p.name} (\`${p.tracks.length} Lagu\`)\n*ID Play:* \`${p.id}\`\n\n`; });
        embed.setDescription(desc || 'Kosong');
        return sendReply({ embeds: [embed] }); 
    }

    if (subcommand === 'playplaylist') {
        if (!memberVoice) return sendReply({ embeds: [errorEmbed.setDescription(`${eError} | Anda harus berada di dalam Voice Channel terlebih dahulu!`)] }, true);
        const pid = args.id;
        if (!pid) return sendReply({ embeds: [errorEmbed.setDescription(`${eError} | Harap masukkan ID Playlist.`)] }, true);

        const playlist = await UserPlaylist.findOne({ where: { id: pid, userId: user.id } });
        if (!playlist) return sendReply({ embeds: [errorEmbed.setDescription(`${eError} | Playlist tidak ditemukan.`)] }, true);

        if (!player) {
            player = poru.createConnection({ guildId: guild.id, voiceChannel: memberVoice.id, textChannel: channel.id, deaf: true });
            player.is247 = false; 
        }

        const actionEmbed = new EmbedBuilder().setColor('#1DB954').setDescription(`⏳ Memuat \`${playlist.tracks.length}\` lagu dari **${playlist.name}**...`);
        await sendReply({ embeds: [actionEmbed] }, true);

        let loaded = 0;
        let firstTrack = null;

        (async () => {
            for (const query of playlist.tracks) {
                try {
                    const res = await poru.resolve({ query: query, source: 'ytmsearch', requester: user });
                    if (res && res.tracks && res.tracks.length > 0) {
                        res.tracks[0].info.requester = user;
                        player.queue.add(res.tracks[0]);
                        loaded++;
                        if (!firstTrack) {
                            firstTrack = res.tracks[0];
                            if (!player.isPlaying && !player.isPaused) player.play();
                        }
                    }
                } catch (e) {}
            }
            const doneEmbed = new EmbedBuilder()
                .setColor(ui.getColor('success'))
                .setDescription(`### ${ui.getEmoji('success')} Sinkronisasi Selesai\n**Nama:** \`${playlist.name}\`\n**Berhasil Dimuat:** \`${loaded} / ${playlist.tracks.length} Lagu\``);
            channel.send({ embeds: [doneEmbed] }).then(m => setTimeout(()=> m.delete().catch(()=>{}), 15000)).catch(()=>{});
        })();
        return;
    }

    if (subcommand === 'pause') {
        if (!player || !player.isPlaying) return sendReply({ embeds: [errorEmbed.setDescription(`${eError} | Tidak ada lagu yang sedang diputar.`)] }, true);
        if (player.isPaused) return sendReply({ embeds: [errorEmbed.setDescription(`${eError} | Musik sudah dalam keadaan dijeda.`)] }, true);
        player.pause(true);
        return sendReply({ embeds: [new EmbedBuilder().setColor(ui.getColor('warning')).setDescription(`### ⏸️ Transmisi Dijeda\n${divider}\nSesi audio ditahan sementara.`)] }, true);
    }

    if (subcommand === 'resume') {
        if (!player || !player.isPlaying) return sendReply({ embeds: [errorEmbed.setDescription(`${eError} | Tidak ada lagu yang sedang diputar.`)] }, true);
        if (!player.isPaused) return sendReply({ embeds: [errorEmbed.setDescription(`${eError} | Musik tidak sedang dijeda.`)] }, true);
        player.pause(false);
        return sendReply({ embeds: [new EmbedBuilder().setColor(ui.getColor('success')).setDescription(`### ▶️ Transmisi Dilanjutkan\n${divider}\nMelanjutkan pemutaran audio.`)] }, true);
    }

    if (subcommand === 'nowplaying') {
        if (!player || !player.currentTrack) return sendReply({ embeds: [errorEmbed.setDescription(`${eError} | Tidak ada lagu yang sedang diputar.`)] }, true);
        const track = player.currentTrack.info;
        const sourceIcon = getPlatformIcon(track.originalSource || track.sourceName);
        
        const npEmbed = new EmbedBuilder().setColor(ui.getColor('primary'))
            .setTitle('🎶 Memutar Saat Ini')
            .setDescription(`### ${sourceIcon} [${track.title}](${track.uri})`)
            .addFields(
                { name: 'Artis', value: track.author || 'Tidak diketahui', inline: true },
                { name: 'Durasi', value: formatDuration(player.position) + ' / ' + formatDuration(track.length), inline: true }
            );
        return sendReply({ embeds: [npEmbed] }); 
    }

    if (subcommand === 'queue') {
        if (!player || player.queue.length === 0) return sendReply({ embeds: [errorEmbed.setDescription(`${eError} | Antrean lagu kosong.`)] }, true);
        const q = player.queue.slice(0, 10).map((t, i) => {
            const sourceIcon = getPlatformIcon(t.info.originalSource || t.info.sourceName);
            return `**${i + 1}.** ${sourceIcon} [${t.info.title}](${t.info.uri}) - \`${formatDuration(t.info.length)}\``;
        }).join('\n');
        
        const qEmbed = new EmbedBuilder().setColor(ui.getColor('primary'))
            .setTitle('📜 Antrean Musik')
            .setDescription(q + (player.queue.length > 10 ? `\n\n*...dan ${player.queue.length - 10} lagu lainnya.*` : ''));
        return sendReply({ embeds: [qEmbed] }); 
    }

    if (subcommand === 'loop') {
        if (!player) return sendReply({ embeds: [errorEmbed.setDescription(`${eError} | Tidak ada lagu yang sedang diputar.`)] }, true);
        const mode = args.mode || args.query; 
        if (mode === 'track') { player.setLoop('TRACK'); return sendReply({ embeds: [new EmbedBuilder().setColor(ui.getColor('primary')).setDescription(`🔂 | Mode pengulangan **LAGU SAAT INI** diaktifkan.`)] }, true); }
        if (mode === 'queue') { player.setLoop('QUEUE'); return sendReply({ embeds: [new EmbedBuilder().setColor(ui.getColor('primary')).setDescription(`🔁 | Mode pengulangan **SELURUH ANTREAN** diaktifkan.`)] }, true); }
        player.setLoop('NONE'); return sendReply({ embeds: [new EmbedBuilder().setColor(ui.getColor('primary')).setDescription(`❌ | Mode pengulangan **DIMATIKAN**.`)] }, true);
    }

    if (subcommand === 'shuffle') {
        if (!player || player.queue.length === 0) return sendReply({ embeds: [errorEmbed.setDescription(`${eError} | Antrean lagu kosong.`)] }, true);
        player.queue.shuffle();
        return sendReply({ embeds: [new EmbedBuilder().setColor(ui.getColor('primary')).setDescription(`🔀 | Urutan antrean telah diacak.`)] }, true);
    }

    if (subcommand === 'clear') {
        if (!player || player.queue.length === 0) return sendReply({ embeds: [errorEmbed.setDescription(`${eError} | Antrean lagu kosong.`)] }, true);
        player.queue.clear();
        return sendReply({ embeds: [new EmbedBuilder().setColor(ui.getColor('primary')).setDescription(`🗑️ | Seluruh antrean lagu dibersihkan.`)] }, true);
    }

    if (subcommand === 'stop') {
        if (!player) return sendReply({ embeds: [errorEmbed.setDescription(`${eError} | Tidak ada frekuensi aktif.`)] }, true);
        player.is247 = false; player.destroy();
        return sendReply({ embeds: [new EmbedBuilder().setColor(ui.getColor('error')).setDescription(`### ${ui.getEmoji('musicStop')} Pemutusan Sistem\n${divider}\nSesi audio dihentikan secara paksa.`)] }, true);
    }

    if (subcommand === 'skip') {
        if (!player || !player.currentTrack) return sendReply({ embeds: [errorEmbed.setDescription(`${eError} | Tidak ada musik yang bisa dilewati.`)] }, true);
        if (typeof player.stopTrack === 'function') player.stopTrack();
        else if (player.node && player.node.rest) player.node.rest.updatePlayer({ guildId: player.guildId, data: { track: { encoded: null } } }).catch(()=>{});
        return sendReply({ embeds: [new EmbedBuilder().setColor(ui.getColor('primary')).setDescription(`### ${ui.getEmoji('musicSkip')} Melewati Trek\n${divider}\nMemutar urutan selanjutnya...`)] }, true);
    }

    if (subcommand === 'volume') {
        if (!player) return sendReply({ embeds: [errorEmbed.setDescription(`${eError} | Tidak ada frekuensi aktif.`)] }, true);
        const vol = args.persen;
        if (!vol || isNaN(vol) || vol < 10 || vol > 100) return sendReply({ embeds: [errorEmbed.setDescription(`${eError} | Harap masukkan angka antara 10 - 100.`)] }, true);
        player.setVolume(vol);
        return sendReply({ embeds: [new EmbedBuilder().setColor(ui.getColor('primary')).setDescription(`${vol >= 50 ? ui.getEmoji('musicVolUp') : ui.getEmoji('musicVolDown')} | Volume disetel ke **${vol}%**.`)] }, true);
    }

    if (subcommand === '247') {
        let [profile] = await UserProfile.findOrCreate({ where: { userId: user.id } });
        if (!profile.isPremium || !profile.premiumUntil || profile.premiumUntil <= new Date()) {
            return sendReply({ embeds: [new EmbedBuilder().setColor(ui.getColor('error')).setTitle('💎 Fitur V.I.P Terkunci').setDescription(`${eError} | Akses ditolak! Ini adalah fitur eksklusif Premium.`)] }, true);
        }
        if (!player) return sendReply({ embeds: [errorEmbed.setDescription(`${eError} | Putar lagu terlebih dahulu.`)] }, true);
        player.is247 = !player.is247;
        try {
            const [guildData] = await GuildSettings.findOrCreate({ where: { guildId: guild.id } });
            guildData.music = { twentyFourSeven: player.is247, voiceChannel: player.is247 ? player.voiceChannel : null, textChannel: player.is247 ? player.textChannel : null };
            guildData.changed('music', true);
            await guildData.save();
        } catch (e) {}
        return sendReply({ embeds: [new EmbedBuilder().setColor(player.is247 ? ui.getColor('primary') : '#2b2d31').setDescription(`${ui.getEmoji('music247')} | Mode Siaga 24/7 **${player.is247 ? 'DIAKTIFKAN' : 'DIMATIKAN'}**.`)] }, true);
    }

    return sendReply({ embeds: [errorEmbed.setDescription(`${eError} | Perintah tidak dikenali.`)] }, true);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('music')
        .setDescription('🎵 Sistem Audio Premium Resolusi Tinggi Naura')
        .addSubcommand(sub => sub.setName('play').setDescription('Putar mahakarya musik dari internet.')
            .addStringOption(opt => opt.setName('query').setDescription('Ketik judul lagu atau link Spotify').setRequired(true).setAutocomplete(true)))
        .addSubcommand(sub => sub.setName('lofi').setDescription('☕ Putar saluran Radio Lofi Hip-Hop (24/7 Otomatis)'))
        .addSubcommand(sub => sub.setName('radio').setDescription('📻 Putar stasiun Radio NCS Bebas Hak Cipta (24/7 Otomatis)'))
        .addSubcommand(sub => sub.setName('import').setDescription('Impor dan simpan Playlist Spotify ke database pribadi.')
            .addStringOption(opt => opt.setName('url').setDescription('Masukkan URL Playlist Spotify').setRequired(true)))
        .addSubcommand(sub => sub.setName('myplaylist').setDescription('Lihat daftar playlist Spotify yang sudah kamu impor.'))
        .addSubcommand(sub => sub.setName('playplaylist').setDescription('Putar playlist tersimpan ke dalam antrean.')
            .addIntegerOption(opt => opt.setName('id').setDescription('ID Playlist (Cek di /music myplaylist)').setRequired(true)))
        .addSubcommand(sub => sub.setName('pause').setDescription('⏸️ Jeda musik yang sedang diputar saat ini'))
        .addSubcommand(sub => sub.setName('resume').setDescription('▶️ Lanjutkan musik yang sedang dijeda'))
        .addSubcommand(sub => sub.setName('nowplaying').setDescription('ℹ️ Tampilkan informasi lagu yang sedang diputar'))
        .addSubcommand(sub => sub.setName('queue').setDescription('📜 Tampilkan daftar antrean lagu saat ini'))
        .addSubcommand(sub => sub.setName('loop').setDescription('🔁 Atur mode pengulangan musik')
            .addStringOption(opt => opt.setName('mode').setDescription('Pilih mode pengulangan').setRequired(true).addChoices(
                { name: '❌ Mati', value: 'none' },
                { name: '🔂 Ulangi Lagu (Track)', value: 'track' },
                { name: '🔁 Ulangi Antrean (Queue)', value: 'queue' }
            )))
        .addSubcommand(sub => sub.setName('shuffle').setDescription('🔀 Acak urutan lagu di antrean'))
        .addSubcommand(sub => sub.setName('clear').setDescription('🗑️ Bersihkan seluruh daftar antrean lagu'))
        .addSubcommand(sub => sub.setName('stop').setDescription('Matikan audio dan putuskan koneksi.'))
        .addSubcommand(sub => sub.setName('skip').setDescription('Lewati trek audio saat ini.'))
        .addSubcommand(sub => sub.setName('volume').setDescription('Atur intensitas suara Naura (10-100%).')
            .addIntegerOption(opt => opt.setName('persen').setDescription('Persentase volume').setRequired(true).setMinValue(10).setMaxValue(100)))
        .addSubcommand(sub => sub.setName('247').setDescription('Toggle Mode Radio 24/7 (Menetap di Voice).'))
        .addSubcommand(sub => sub.setName('profile').setDescription('🎵 Lihat Kartu Statistik Musik.')
            .addUserOption(opt => opt.setName('target').setDescription('Pilih pengguna (Opsional)').setRequired(false))),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused();
        if (!focusedValue) return interaction.respond([]).catch(()=>{});

        // Autocomplete sekarang memanggil emoji dari ui.js
        if (focusedValue.toLowerCase().includes('spotify')) {
            const truncated = focusedValue.length > 50 ? `${focusedValue.slice(0, 47)}...` : focusedValue;
            return interaction.respond([{ name: `🟢 Play Spotify: ${truncated}`, value: focusedValue.slice(0, 100) }]).catch(()=>{});
        } else if (focusedValue.toLowerCase().includes('youtube') || focusedValue.toLowerCase().includes('youtu.be')) {
            const truncated = focusedValue.length > 50 ? `${focusedValue.slice(0, 47)}...` : focusedValue;
            return interaction.respond([{ name: `📺 Play YouTube: ${truncated}`, value: focusedValue.slice(0, 100) }]).catch(()=>{});
        } else if (/^https?:\/\//.test(focusedValue)) {
            const truncated = focusedValue.length > 50 ? `${focusedValue.slice(0, 47)}...` : focusedValue;
            return interaction.respond([{ name: `🔗 Play dari URL: ${truncated}`, value: focusedValue.slice(0, 100) }]).catch(()=>{});
        }

        if (focusedValue.trim().length < 2) return interaction.respond([]).catch(()=>{});

        const client = interaction.client;
        if (!client._musicAutocompleteCache) client._musicAutocompleteCache = new Map();
        const searchCache = client._musicAutocompleteCache;

        if (searchCache.has(focusedValue)) {
            return interaction.respond(searchCache.get(focusedValue)).catch(()=>{});
        }

        try {
            const poru = client.musicManager?.poru;
            if (!poru || typeof poru.resolve !== 'function') return interaction.respond([]).catch(()=>{});

            const fetchWithTimeout = (promise) => {
                const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 1800));
                return Promise.race([promise, timeout]).catch(() => null);
            };

            const [spotifyRes, ytRes] = await Promise.all([
                fetchWithTimeout(poru.resolve({ query: focusedValue, source: 'spsearch', requester: interaction.user })),
                fetchWithTimeout(poru.resolve({ query: focusedValue, source: 'ytmsearch', requester: interaction.user }))
            ]);

            let combinedTracks = [];

            if (spotifyRes && spotifyRes.tracks && Array.isArray(spotifyRes.tracks)) {
                combinedTracks.push(...spotifyRes.tracks.slice(0, 3));
            }

            if (ytRes && ytRes.tracks && Array.isArray(ytRes.tracks)) {
                const ytTracks = ytRes.tracks.filter(yt => 
                    !combinedTracks.some(sp => sp.info.title.toLowerCase() === yt.info.title.toLowerCase())
                );
                const slotsLeft = 5 - combinedTracks.length;
                if (slotsLeft > 0) combinedTracks.push(...ytTracks.slice(0, slotsLeft));
            }

            if (combinedTracks.length === 0) return interaction.respond([]).catch(()=>{});

            const choices = combinedTracks.map((track) => {
                const isSpotify = track.info.sourceName === 'spotify' || (track.info.uri && track.info.uri.includes('spotify'));
                
                // Menerapkan emoji UI ke Autocomplete
                const icon = isSpotify ? ui.getEmoji('spotify') : ui.getEmoji('youtube');
                
                const ms = track.info.length;
                const minutes = Math.floor(ms / 60000);
                const seconds = ((ms % 60000) / 1000).toFixed(0);
                const duration = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

                const title = track.info.title.length > 70 ? `${track.info.title.slice(0, 67)}…` : track.info.title;
                const displayName = `${icon} ${title} [${duration}]`;
                const valueStr = track.info.uri || track.info.identifier || track.info.title;

                return {
                    name: displayName.length > 100 ? displayName.slice(0, 100) : displayName,
                    value: valueStr.length > 100 ? valueStr.slice(0, 100) : valueStr,
                };
            });

            searchCache.set(focusedValue, choices);
            setTimeout(() => searchCache.delete(focusedValue), 60000);

            return interaction.respond(choices).catch(()=>{});

        } catch (error) {
            return interaction.respond([]).catch(()=>{});
        }
    },

    async execute(interaction) {
        await interaction.deferReply();
        const subcommand = interaction.options.getSubcommand();
        const args = { query: interaction.options.getString('query'), url: interaction.options.getString('url'), mode: interaction.options.getString('mode'), persen: interaction.options.getInteger('persen'), target: interaction.options.getUser('target'), id: interaction.options.getInteger('id') };
        const sendReply = async (payload, autoDelete = false) => {
            const msg = await interaction.editReply(payload).catch(()=>{});
            if (autoDelete && msg) setTimeout(() => interaction.deleteReply().catch(()=>{}), 15000);
            return msg;
        };
        await runMusicLogic(interaction.client, interaction.user, interaction.member, interaction.guild, interaction.channel, subcommand, args, sendReply, true);
    },

    async executePrefix(message, args, client) {
        if (!args || args.length === 0) return message.reply({ embeds: [new EmbedBuilder().setColor(ui.getColor('error')).setDescription(`❌ Harap masukkan aksi! Contoh: \`n!music play <lagu>\``)] });
        const subcommand = args.shift().toLowerCase();
        const parsedArgs = { query: args.join(' '), url: args[0], persen: parseInt(args[0]), target: message.mentions.users.first(), id: parseInt(args[0]), mode: args[0] };
        const sentMsg = await message.reply({ embeds: [new EmbedBuilder().setColor(ui.getColor('dark')).setDescription(`⏳ | \`Memproses sistem audio...\``)] });
        const sendReply = async (payload, autoDelete = false) => {
            const msg = await sentMsg.edit(payload).catch(()=>{});
            if (autoDelete && msg) setTimeout(() => msg.delete().catch(()=>{}), 15000);
            return msg;
        };
        await runMusicLogic(client, message.author, message.member, message.guild, message.channel, subcommand, parsedArgs, sendReply, false);
    }
};