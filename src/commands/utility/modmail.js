const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const ModMail = require('../../models/ModMail');
const GuildSettings = require('../../models/GuildSettings');
const ui = require('../../config/ui');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('modmail')
        .setDescription('🛠️ [MOD] Perintah untuk mengelola tiket Modmail.')
        .addSubcommand(sub => 
            sub.setName('reply')
               .setDescription('Membalas pesan pengguna di tiket ini.')
               .addStringOption(opt => opt.setName('pesan').setDescription('Isi pesan balasan').setRequired(true))
        )
        .addSubcommand(sub => 
            sub.setName('close')
               .setDescription('Menutup tiket modmail ini.')
               .addStringOption(opt => opt.setName('alasan').setDescription('Alasan penutupan tiket'))
        ),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        
        // Cari tiket berdasarkan channel ID saat ini
        const ticket = await ModMail.findOne({ 
            where: { channelId: interaction.channel.id, closed: false } 
        });

        if (!ticket) {
            return interaction.reply({ 
                content: '❌ Channel ini bukan merupakan tiket Modmail yang aktif.', 
                ephemeral: true 
            });
        }

        const user = await interaction.client.users.fetch(ticket.userId).catch(() => null);

        if (subcommand === 'reply') {
            const replyText = interaction.options.getString('pesan');

            if (!user) return interaction.reply({ content: '❌ Tidak dapat menemukan pengguna di DM.', ephemeral: true });

            const replyEmbed = new EmbedBuilder()
                .setColor(ui.getColor('primary'))
                .setAuthor({ name: 'Staff Server', iconURL: interaction.guild.iconURL() })
                .setDescription(replyText)
                .setFooter({ text: `Dibalas oleh: ${interaction.user.tag}` })
                .setTimestamp();

            try {
                await user.send({ embeds: [replyEmbed] });
                
                // Tampilkan di channel server agar staff lain tahu
                const logEmbed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
                    .setDescription(`**Balasan terkirim:**\n${replyText}`)
                    .setTimestamp();

                await interaction.reply({ embeds: [logEmbed] });
            } catch (err) {
                interaction.reply({ content: '❌ Gagal mengirim DM ke pengguna. Mungkin DM mereka tertutup.', ephemeral: true });
            }

        } else if (subcommand === 'close') {
            const reason = interaction.options.getString('alasan') || 'Masalah selesai.';

            // Update database
            ticket.closed = true;
            await ticket.save();

            const closeEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setTitle('📩 Tiket Ditutup')
                .setDescription(`Tiketmu telah ditutup oleh staf.\n**Alasan:** ${reason}`)
                .setTimestamp();

            if (user) await user.send({ embeds: [closeEmbed] }).catch(() => {});

            await interaction.reply('✅ Tiket telah ditutup. Channel ini akan dihapus dalam 10 detik.');

            // Log ke channel log (opsional jika setup-modmail menyimpannya)
            const settings = await GuildSettings.findOne({ where: { guildId: interaction.guild.id } });
            const logChannelId = settings?.settings?.modmail?.logChannelId;
            if (logChannelId) {
                const logChannel = interaction.guild.channels.cache.get(logChannelId);
                if (logChannel) {
                    logChannel.send(`📁 **Transkrip Modmail:** Tiket <@${ticket.userId}> ditutup oleh <@${interaction.user.id}>.\n**Alasan:** ${reason}`);
                }
            }

            setTimeout(() => interaction.channel.delete().catch(() => {}), 10000);
        }
    }
};