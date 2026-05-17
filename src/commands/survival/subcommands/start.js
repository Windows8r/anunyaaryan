// Lokasi: src/commands/survival/subcommands/start.js
const { EmbedBuilder, MessageFlags } = require('discord.js');
const UserProfile = require('../../../models/UserProfile');
const UserSurvival = require('../../../models/UserSurvival');
const ui = require('../../../config/ui');

module.exports = {
    async execute(interaction, client) {
        const user = interaction.user;
        
        // Panggil atau buat data pemain di database
        const [profile] = await UserProfile.findOrCreate({ where: { userId: user.id } });
        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });

        const currentInv = profile.inventory || [];
        
        // ✨ PERBAIKAN LOGIKA: Cek apakah pemain sudah punya item Starter Kit spesifik
        const hasClaimedStarter = currentInv.some(item => item?.id === 'wooden_axe_old' || item?.id === 'wooden_pickaxe_old');

        if (hasClaimedStarter) {
            const errEmbed = new EmbedBuilder()
                .setColor(ui.getColor('error'))
                .setDescription(`${ui.getEmoji('error')} Kamu sudah mengambil Starter Kit ini sebelumnya!`);
                
            return interaction.reply({ 
                embeds: [errEmbed],
                flags: MessageFlags.Ephemeral
            });
        }

        // Berikan Item Pemula (Starter Kit)
        const starterKit = [
            { id: 'wooden_axe_old', name: 'Kapak Kayu Tua' },
            { id: 'wooden_pickaxe_old', name: 'Beliung Kayu Tua' },
            { id: 'old_sword', name: 'Pedang Tua' },
            { id: 'mineral_water', name: 'Air Mineral' }, 
            { id: 'apple', name: 'Apel Segar' } 
        ];

        // ✨ PERBAIKAN LOGIKA: Gabungkan item starter dengan item yang mungkin sudah mereka miliki
        const newInv = currentInv.concat(starterKit);

        // Simpan inventory baru ke database
        await UserProfile.update({ inventory: newInv }, { where: { userId: user.id } });

        // Tampilkan Pesan Sambutan yang Epik
        const welcomeEmbed = new EmbedBuilder()
            .setTitle('🎒 Starter Kit Survival Naura')
            .setColor(ui.getColor('success'))
            .setDescription(`Selamat datang di petualangan Survival, **${user.displayName}**!\n\nSebagai bantuan dari Mayor Lucy, kamu mendapatkan paket perlengkapan berikut:\n\n🪓 **Kapak Kayu Tua** (Untuk menebang di Hutan)\n⛏️ **Beliung Kayu Tua** (Untuk menambang)\n🗡️ **Pedang Tua** (Senjata dasar di Dungeon)\n🍲 **Ransum Dasar** (Air & Apel)\n\n*Barang-barang ini telah ditambahkan ke dalam tasmu. Gunakan perintah \`/survival collect\` untuk mulai mencari sumber daya!*`)
            .setThumbnail(user.displayAvatarURL())
            .setFooter({ text: 'Petualanganmu baru saja dimulai!' });

        await interaction.reply({ embeds: [welcomeEmbed] });
    }
};