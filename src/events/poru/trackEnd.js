// Lokasi: src/events/poru/trackEnd.js
const LyricsManager = require('../../managers/LyricsManager');

module.exports = {
    async execute(manager, player) {
        // Hapus sisa-sisa lirik dari memori saat lagu berakhir
        try {
            const lyricsEngine = new LyricsManager(manager.client);
            lyricsEngine.clearLyrics(player.guildId);
        } catch (e) {
            // Abaikan jika terjadi error kecil saat pembersihan
        }
    }
};