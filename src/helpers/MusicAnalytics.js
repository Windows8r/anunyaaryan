// Lokasi: src/helpers/MusicAnalytics.js

const UserProfile = require('../models/UserProfile');

class MusicAnalytics {
    /**
     * Panggil ini saat lagu baru saja dimulai (trackStart)
     */
    static markStart(player) {
        if (!player) return;
        player.analyticsStartTime = Date.now();
    }

    /**
     * Panggil ini saat lagu selesai, di-skip, atau dihentikan (trackEnd)
     * Helper ini akan kebal dari segala jenis error JSON MySQL.
     */
    static async recordEnd(client, player, track) {
        // 1. Validasi Dasar (Mencegah Error)
        if (!client || !player || !track || !track.info) return;
        if (!track.info.requester || track.info.requester.bot) return;

        // 2. Kalkulasi Durasi Asli (Seperti Jockie Music)
        // Menggunakan posisi Lavalink asli, atau fallback ke Stopwatch
        const startTime = player.analyticsStartTime || Date.now();
        let durationMs = player.position || (Date.now() - startTime);

        // Reset waktu agar tidak bocor ke lagu selanjutnya
        player.analyticsStartTime = null;

        // Filter Keamanan:
        // - Abaikan jika kurang dari 5 detik (User cuma numpang skip)
        // - Abaikan jika lebih dari 100 jam (Lagu Live Stream/Radio)
        if (durationMs < 5000 || durationMs > 360000000) return;
        
        // Batasi durasi agar tidak melebihi panjang asli lagunya
        if (durationMs > track.info.length && !track.info.isStream) {
            durationMs = track.info.length;
        }

        try {
            const userId = track.info.requester.id;
            const [profile] = await UserProfile.findOrCreate({ where: { userId } });

            // 3. Update Statistik Dasar
            profile.music_tracksListened = (profile.music_tracksListened || 0) + 1;
            profile.music_totalDurationMs = BigInt(profile.music_totalDurationMs || 0) + BigInt(durationMs);
            profile.music_lastListened = track.info.title.substring(0, 100);

            // 4. Penanganan Super Aman untuk JSON MySQL (Anti-Bug)
            let trackingData = profile.music_trackingData;
            if (typeof trackingData === 'string') {
                try { trackingData = JSON.parse(trackingData); } catch (e) { trackingData = {}; }
            }
            if (!trackingData || typeof trackingData !== 'object') trackingData = {};
            if (!trackingData.tracks) trackingData.tracks = {};
            if (!trackingData.friends) trackingData.friends = {};
            if (!trackingData.servers) trackingData.servers = {};

            // 5. Kumpulkan Data Identitas
            const trackName = track.info.title.substring(0, 50); 
            const guild = client.guilds.cache.get(player.guildId);
            const serverName = guild ? guild.name.substring(0, 30) : 'Unknown Server';

            // Tambahkan durasi ke Lagu dan Server
            trackingData.tracks[trackName] = (trackingData.tracks[trackName] || 0) + durationMs;
            trackingData.servers[serverName] = (trackingData.servers[serverName] || 0) + durationMs;

            // 6. Deteksi Teman Voice Channel (Fitur Utama Jockie Music)
            if (guild && player.voiceChannel) {
                const vc = guild.channels.cache.get(player.voiceChannel);
                if (vc && vc.members) {
                    vc.members.forEach(member => {
                        // Abaikan bot dan diri sendiri
                        if (!member.user.bot && member.id !== userId) {
                            const friendName = member.user.username;
                            trackingData.friends[friendName] = (trackingData.friends[friendName] || 0) + durationMs;
                        }
                    });
                }
            }

            // 7. Algoritma Pencarian Top 1
            const getTop = (obj) => {
                let topName = 'Belum ada data';
                let maxVal = 0;
                for (const [name, val] of Object.entries(obj)) {
                    if (val > maxVal) { maxVal = val; topName = name; }
                }
                return { name: topName, durationMs: maxVal };
            };

            // 8. Injeksi Paksa ke Database (Deep Clone)
            profile.music_trackingData = JSON.parse(JSON.stringify(trackingData));
            profile.music_topTrack = JSON.parse(JSON.stringify(getTop(trackingData.tracks)));
            profile.music_topServer = JSON.parse(JSON.stringify(getTop(trackingData.servers)));
            profile.music_topFriend = JSON.parse(JSON.stringify(getTop(trackingData.friends)));

            // Beri tahu Sequelize bahwa objek JSON ini telah diperbarui
            profile.changed('music_trackingData', true);
            profile.changed('music_topTrack', true);
            profile.changed('music_topServer', true);
            profile.changed('music_topFriend', true);

            await profile.save();
        } catch (error) {
            console.error('[Helper] Gagal merekam analitik musik:', error.message);
        }
    }
}

module.exports = MusicAnalytics;