// Lokasi: src/utils/spotifyHelper.js
const spotify = require('spotify-url-info')(fetch); // Menggunakan native fetch Node.js

class SpotifyHelper {
    /**
     * Mengubah URL Spotify menjadi array query pencarian YouTube Music
     * @param {string} url - Link Spotify (Track, Album, atau Playlist)
     * @returns {Promise<Array<string>|null>} Array string "ytmsearch: artis judul"
     */
    static async resolveToYTM(url) {
        try {
            // Bersihkan URL dari query parameter (?si=...)
            const cleanUrl = url.split('?')[0];

            let tracks = [];

            // 1. Coba ambil tracks langsung
            try {
                const tracksData = await spotify.getTracks(cleanUrl);
                if (tracksData && tracksData.length > 0) tracks = tracksData;
            } catch (e) {}

            // 2. Jika gagal/kosong, coba ambil data mentah (berguna untuk Playlist/Album)
            if (tracks.length === 0) {
                const data = await spotify.getData(cleanUrl);
                if (data) {
                    if (data.type === 'track') tracks = [data];
                    else if (data.trackList) tracks = data.trackList;
                    else if (data.tracks && data.tracks.items) tracks = data.tracks.items.map(i => i.track || i);
                }
            }
            
            if (!tracks || tracks.length === 0) return null;

            // Mengonversi setiap lagu menjadi format pencarian YTM
            const searchQueries = tracks.map(t => {
                const track = t.track || t; // Terkadang lagu dibungkus di dalam properti 'track'
                if (!track || (!track.name && !track.title)) return null;

                const name = track.name || track.title;
                
                // Ambil nama artis
                let artistName = '';
                if (track.artists && track.artists.length > 0) {
                    artistName = track.artists.map(a => a.name).join(' ');
                } else if (track.subtitle) {
                    artistName = track.subtitle;
                } else if (track.artist) {
                    artistName = track.artist;
                }

                // Membersihkan judul dari teks yang tidak perlu agar pencarian YTM lebih akurat
                const cleanTitle = name.replace(/(\(.*\)|\[.*\])/g, '').trim();
                
                return `ytmsearch:${artistName} ${cleanTitle} audio`;
            }).filter(Boolean); // Buang jika ada lagu yang null

            return {
                type: cleanUrl.includes('track') ? 'track' : 'playlist',
                queries: searchQueries
            };

        } catch (error) {
            console.error('\x1b[41m\x1b[37m ⚠️ SPOTIFY HELPER \x1b[0m Gagal memproses link:', error.message);
            return null;
        }
    }
}

module.exports = SpotifyHelper;