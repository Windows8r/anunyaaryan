const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const GuildSettings = require('../../models/GuildSettings');
const ui = require('../../config/ui');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('soundboard')
        .setDescription('Sistem Efek Suara (Soundboard) Kustom Server')
        .addSubcommand(sub => sub.setName('play')
            .setDescription('Mainkan efek suara tanpa memotong antrean')
            .addStringOption(opt => opt.setName('nama').setDescription('Nama soundboard yang ingin diputar').setRequired(true)))
        .addSubcommand(sub => sub.setName('list')
            .setDescription('Lihat daftar soundboard server ini'))
        .addSubcommand(sub => sub.setName('add')
            .setDescription('Tambahkan soundboard baru (Admin)')
            .addStringOption(opt => opt.setName('nama').setDescription('Nama pendek efek suara (misal: bruh)').setRequired(true))
            .addStringOption(opt => opt.setName('url').setDescription('URL audio (MP3/WAV atau YouTube URL)').setRequired(true)))
        .addSubcommand(sub => sub.setName('hapus')
            .setDescription('Hapus soundboard (Admin)')
            .addStringOption(opt => opt.setName('nama').setDescription('Nama soundboard').setRequired(true))),

    async execute(interaction) {
        await interaction.deferReply();
        
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guildId;
        
        // Ambil Data Guild Settings
        let [settings] = await GuildSettings.findOrCreate({ where: { guildId } });
        let currentSettings = settings.settings || {};
        if (!currentSettings.soundboards) currentSettings.soundboards = {};

        const embed = new EmbedBuilder().setColor(ui.getColor ? ui.getColor('primary') : '#00FFFF');

        if (subcommand === 'add') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.editReply('❌ Kamu harus memiliki izin Manage Server untuk menambah soundboard.');
            }
            
            const nama = interaction.options.getString('nama').toLowerCase();
            const url = interaction.options.getString('url');
            
            if (Object.keys(currentSettings.soundboards).length >= 20) {
                return interaction.editReply('❌ Batas maksimal soundboard adalah 20 per server.');
            }
            
            currentSettings.soundboards[nama] = url;
            settings.settings = currentSettings;
            settings.changed('settings', true);
            await settings.save();
            
            embed.setDescription(`✅ Soundboard **${nama}** berhasil ditambahkan!\nGunakan \`/soundboard play ${nama}\` untuk memutarnya.`);
            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'hapus') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.editReply('❌ Kamu harus memiliki izin Manage Server untuk menghapus soundboard.');
            }
            
            const nama = interaction.options.getString('nama').toLowerCase();
            if (!currentSettings.soundboards[nama]) {
                return interaction.editReply('❌ Soundboard tidak ditemukan.');
            }
            
            delete currentSettings.soundboards[nama];
            settings.settings = currentSettings;
            settings.changed('settings', true);
            await settings.save();
            
            embed.setDescription(`🗑️ Soundboard **${nama}** berhasil dihapus.`);
            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'list') {
            const list = Object.keys(currentSettings.soundboards);
            if (list.length === 0) {
                return interaction.editReply('ℹ️ Belum ada soundboard kustom di server ini.');
            }
            
            embed.setTitle('🎙️ Daftar Soundboard Kustom')
                 .setDescription(list.map(name => `• **${name}**`).join('\n'))
                 .setFooter({ text: 'Gunakan /soundboard play <nama> untuk memutar' });
                 
            return interaction.editReply({ embeds: [embed] });
        }

        if (subcommand === 'play') {
            const voiceChannel = interaction.member.voice.channel;
            if (!voiceChannel) return interaction.editReply('❌ Kamu harus berada di Voice Channel terlebih dahulu.');

            const nama = interaction.options.getString('nama').toLowerCase();
            const url = currentSettings.soundboards[nama];

            if (!url) return interaction.editReply('❌ Soundboard tidak ditemukan di server ini.');

            const poru = interaction.client.musicManager.poru;
            let player = poru.players.get(guildId);
            
            // Jika bot belum konek, bikin koneksi
            if (!player) {
                player = poru.createConnection({
                    guildId,
                    voiceChannel: voiceChannel.id,
                    textChannel: interaction.channel.id,
                    deaf: true
                });
            } else if (player.voiceChannel !== voiceChannel.id) {
                return interaction.editReply('❌ Bot sedang berada di Voice Channel lain.');
            }

            try {
                // Resolve soundboard track
                const res = await poru.resolve({ query: url, requester: interaction.user });
                if (!res || !res.tracks || res.tracks.length === 0) {
                    return interaction.editReply('❌ Gagal memuat efek suara. Pastikan URL valid.');
                }
                
                const sbTrack = res.tracks[0];
                
                // Jika sedang memutar lagu utama, kita jeda sementara
                if (player.isPlaying && player.currentTrack) {
                    const mainTrack = player.currentTrack;
                    
                    // Simpan posisi terakhir dari lagu yang sedang main
                    mainTrack.info.resumePosition = player.position;
                    
                    // Sisipkan track utama tepat di sebelah efek suara (indeks 0 antrean)
                    player.queue.unshift(mainTrack);
                    
                    // Mainkan soundboard sekarang (akan menggeser track utama, dan setelah soundboard selesai, track utama akan otomatis dilanjutkan)
                    await player.play(sbTrack);
                    
                    embed.setDescription(`🎙️ Memutar efek suara **${nama}**... (Lagu utama dijeda sementara)`);
                } else {
                    // Jika tidak sedang memutar apa-apa
                    player.queue.unshift(sbTrack);
                    if (!player.isPlaying && !player.isPaused) player.play();
                    embed.setDescription(`🎙️ Memutar efek suara **${nama}**...`);
                }
                
                return interaction.editReply({ embeds: [embed] });

            } catch (error) {
                console.error('[SOUNDBOARD ERROR]', error);
                return interaction.editReply('❌ Terjadi kesalahan jaringan saat memuat efek suara.');
            }
        }
    }
};
