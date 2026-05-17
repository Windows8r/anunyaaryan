const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const GuildSettings = require('../../models/GuildSettings');
const ui = require('../../config/ui');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autorole')
        .setDescription('Mengatur role otomatis saat member baru masuk.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand(sub => sub.setName('set').setDescription('Pasang auto role baru')
            .addRoleOption(opt => opt.setName('role').setDescription('Role yang akan diberikan').setRequired(true)))
        .addSubcommand(sub => sub.setName('remove').setDescription('Matikan fitur auto role')),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        const sub = interaction.options.getSubcommand();
        const settings = await GuildSettings.findOne({ where: { guildId: interaction.guild.id } });
        
        if (sub === 'set') {
            const role = interaction.options.getRole('role');
            settings.settings.autoRole = role.id;
            settings.changed('settings', true);
            await settings.save();
            return interaction.editReply(`${ui.getEmoji('success')} Auto Role berhasil diatur ke ${role}!`);
        } else {
            settings.settings.autoRole = null;
            settings.changed('settings', true);
            await settings.save();
            return interaction.editReply(`${ui.getEmoji('success')} Fitur Auto Role telah dimatikan.`);
        }
    }
};
