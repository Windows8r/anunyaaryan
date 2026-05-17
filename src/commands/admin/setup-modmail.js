const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const GuildSettings = require('../../models/GuildSettings');
const ui = require('../../config/ui');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-modmail')
        .setDescription('📩 [ADMIN] Mengaktifkan penerimaan Modmail di server ini.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addChannelOption(opt => opt.setName('category').setDescription('Kategori untuk tiket').addChannelTypes(ChannelType.GuildCategory).setRequired(true))
        .addChannelOption(opt => opt.setName('log_channel').setDescription('Channel log transkrip').addChannelTypes(ChannelType.GuildText).setRequired(true))
        .addRoleOption(opt => opt.setName('staff_role').setDescription('Role yang di-tag saat tiket masuk').setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();
        const category = interaction.options.getChannel('category');
        const logChannel = interaction.options.getChannel('log_channel');
        const staffRole = interaction.options.getRole('staff_role');

        let [settings] = await GuildSettings.findOrCreate({ where: { guildId: interaction.guild.id } });
        let currentSettings = settings.settings || {};
        
        currentSettings.modmail = {
            enabled: true,
            categoryId: category.id,
            logChannelId: logChannel.id,
            staffRoleId: staffRole.id 
        };
        
        settings.settings = currentSettings;
        settings.changed('settings', true);
        await settings.save();

        const embed = new EmbedBuilder()
            .setColor(ui.getColor('success'))
            .setDescription(`${ui.getEmoji('success')} **Sistem Modmail Profesional Aktif!**\n🎫 Kategori: <#${category.id}>\n🛡️ Role Staff: <@&${staffRole.id}>`);

        await interaction.editReply({ embeds: [embed] });
    }
};