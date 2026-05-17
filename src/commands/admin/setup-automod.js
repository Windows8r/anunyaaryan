const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const GuildSettings = require('../../models/GuildSettings');
const ui = require('../../config/ui');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-automod')
        .setDescription('🛡️ [ADMIN] Konfigurasi sistem Automod, Isolasi & Audit Log.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addBooleanOption(opt => opt.setName('aktifkan').setDescription('Aktifkan sistem Automod & Poin Tata Krama?').setRequired(true))
        // 👇 Menambahkan opsi Log Channel untuk Audit Log
        .addChannelOption(opt => opt.setName('log_channel').setDescription('Channel untuk mengirim Laporan Audit Log (Opsional)').addChannelTypes(ChannelType.GuildText).setRequired(false)),

    async execute(interaction) {
        const aktifkan = interaction.options.getBoolean('aktifkan');
        const logChannel = interaction.options.getChannel('log_channel');

        await interaction.deferReply();

        let [settings] = await GuildSettings.findOrCreate({ where: { guildId: interaction.guild.id } });
        let currentSettings = settings.settings || {};
        let automodSettings = currentSettings.automod || {};

        if (!aktifkan) {
            automodSettings.enabled = false;
            currentSettings.automod = automodSettings;
            settings.settings = currentSettings;
            settings.changed('settings', true);
            await settings.save();

            return interaction.editReply({ embeds: [
                new EmbedBuilder().setColor('#FF0000').setDescription('🛑 **Sistem Automod & Audit Log dinonaktifkan.**')
            ]});
        }

        let punishRole = interaction.guild.roles.cache.get(automodSettings.punishRole);
        
        if (!punishRole) {
            try {
                punishRole = await interaction.guild.roles.create({
                    name: 'Anak Nakal (Isolasi)',
                    color: '#010101',
                    reason: 'Automod: Pembuatan role isolasi untuk poin tata krama habis'
                });

                for (const channel of interaction.guild.channels.cache.values()) {
                    if (channel.isTextBased() || channel.isVoiceBased()) {
                        await channel.permissionOverwrites.create(punishRole, {
                            ViewChannel: false,
                            SendMessages: false,
                            Connect: false
                        }).catch(() => {});
                    }
                }
            } catch (error) {
                return interaction.editReply({ embeds: [
                    new EmbedBuilder().setColor(ui.getColor ? ui.getColor('error') : '#FF0000').setDescription('❌ **Gagal membuat Role Anak Nakal!** Pastikan posisi bot berada di paling atas.')
                ]});
            }
        }

        automodSettings.enabled = true;
        automodSettings.punishRole = punishRole.id;
        automodSettings.antiInvite = true;
        automodSettings.antiSpam = true;
        automodSettings.antiCaps = true;
        
        // Simpan ID Log Channel ke database jika admin memilihnya
        if (logChannel) {
            automodSettings.logChannelId = logChannel.id;
        }

        currentSettings.automod = automodSettings;
        settings.settings = currentSettings;
        settings.changed('settings', true);
        await settings.save();

        const embed = new EmbedBuilder()
            .setColor(ui.getColor ? ui.getColor('success') : '#00FF00')
            .setTitle('🛡️ Automod, Poin Tata Krama & Audit Log Aktif!')
            .setDescription(`Semua konfigurasi pengamanan diaktifkan.\n\nSetiap member yang melanggar aturan (Link ilegal, Kasar, Spam, Tag berlebih) akan kehilangan **Poin Tata Krama**.\nJika poin mencapai 0, mereka akan otomatis diberikan role <@&${punishRole.id}> dan terisolasi dari seluruh channel!`)
            .setFooter({ text: 'Gunakan n!setup-automod untuk menonaktifkan atau merubah setting' });

        if (logChannel) {
            embed.addFields({ name: '📁 Audit Log Channel', value: `Semua aktivitas server akan dicatat di <#${logChannel.id}>`});
        }

        await interaction.editReply({ embeds: [embed] });
    }
};