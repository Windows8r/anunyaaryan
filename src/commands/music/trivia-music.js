const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const UserLeveling = require('../../models/UserLeveling');

const PLAYLISTS = [
    'https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M', // Today's Top Hits
    'https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd', // RapCaviar
    'https://open.spotify.com/playlist/37i9dQZF1DX4JAvHpjipBk', // New Music Friday
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('trivia-music')
        .setDescription('Tebak lagu! Dengarkan 10 detik pertama dan tebak judulnya.'),

    async execute(interaction) {
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) return interaction.reply({ content: '❌ Kamu harus berada di Voice Channel!', ephemeral: true });

        await interaction.deferReply();
        const guildId = interaction.guildId;
        const poru = interaction.client.musicManager.poru;
        
        let player = poru.players.get(guildId);
        if (player && player.isPlaying) {
            return interaction.editReply('❌ Naura sedang memutar musik. Hentikan musik terlebih dahulu untuk bermain Trivia.');
        }

        if (!player) {
            player = poru.createConnection({
                guildId,
                voiceChannel: voiceChannel.id,
                textChannel: interaction.channel.id,
                deaf: true
            });
        }

        const playlistUrl = PLAYLISTS[Math.floor(Math.random() * PLAYLISTS.length)];
        const res = await poru.resolve({ query: playlistUrl, requester: interaction.user });
        
        if (!res || !res.tracks || res.tracks.length === 0) {
            return interaction.editReply('❌ Gagal memuat playlist untuk Trivia.');
        }

        // Ambil lagu acak
        const track = res.tracks[Math.floor(Math.random() * res.tracks.length)];
        
        // Tandai player sedang dalam mode trivia agar panel musicManager.js bisa di-bypass (opsional)
        player.isTrivia = true; 
        
        // Mainkan lagu
        await player.play(track);
        
        const embed = new EmbedBuilder()
            .setColor('#ff1493')
            .setTitle('🎵 Music Trivia!')
            .setDescription('Dengarkan cuplikan lagu ini dan ketik **judul lagunya** di chat secepat mungkin!\nKamu punya waktu **15 detik**.');

        await interaction.editReply({ embeds: [embed] });

        // Tunggu 15 detik untuk jawaban
        const filter = m => !m.author.bot;
        const collector = interaction.channel.createMessageCollector({ filter, time: 15000 });

        const correctAnswer = track.info.title.toLowerCase().replace(/[^a-z0-9 ]/g, '');
        // Ambil kata pertama atau kedua jika terlalu panjang agar tebakan lebih toleran
        const acceptableAnswer = correctAnswer.split(' ').slice(0, 2).join(' ');

        let winner = null;

        collector.on('collect', m => {
            const guess = m.content.toLowerCase().replace(/[^a-z0-9 ]/g, '');
            if (guess.includes(acceptableAnswer)) {
                winner = m.author;
                collector.stop('answered');
            }
        });

        collector.on('end', async (collected, reason) => {
            player.stop(); // Hentikan lagu
            player.isTrivia = false;

            const endEmbed = new EmbedBuilder().setColor(winner ? '#00ff00' : '#ff0000');
            
            if (winner) {
                // Beri hadiah
                let [userLevel] = await UserLeveling.findOrCreate({ where: { userId: winner.id, guildId } });
                userLevel.mannersPoint += 100;
                await userLevel.save();

                endEmbed.setTitle('🎉 Ada Pemenang!')
                    .setDescription(`Selamat <@${winner.id}>! Kamu berhasil menebak dengan benar.\nJudul asli: **${track.info.title}**\nArtis: **${track.info.author}**\n\n*Hadiah: +100 Manners Point*`);
            } else {
                endEmbed.setTitle('⏰ Waktu Habis!')
                    .setDescription(`Tidak ada yang berhasil menebak.\nJudul asli: **${track.info.title}**\nArtis: **${track.info.author}**`);
            }

            await interaction.followUp({ embeds: [endEmbed] });
        });
    }
};
