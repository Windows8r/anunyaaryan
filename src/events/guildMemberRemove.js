const { EmbedBuilder } = require('discord.js');
const GuildSettings = require('../models/GuildSettings');

module.exports = {
  name: 'guildMemberRemove',
  async execute(member, client) {
    // Ambil data leave dari database
    const settings = await GuildSettings.findOne({ where: { guildId: member.guild.id } });
    const leaveData = settings?.settings?.greetings?.leave;

    // Cek apakah fitur diaktifkan dan ada channelnya
    if (!leaveData?.enabled || !leaveData?.channelId) return;

    const channel = member.guild.channels.cache.get(leaveData.channelId);
    if (!channel) return;

    // Parsing Custom Message
    let customText = leaveData.message;
    if (customText) {
        customText = customText
            .replace(/{user}/g, `**${member.user.tag}**`)
            .replace(/{server}/g, `**${member.guild.name}**`)
            .replace(/{count}/g, member.guild.memberCount);

        const ui = require('../config/ui');
        customText = customText.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, p1) => {
            const emoji = ui.getEmoji(p1);
            return emoji && emoji !== '💠' ? emoji : match;
        });
    } else {
        customText = `Selamat tinggal **${member.user.tag}**. Terima kasih sudah meramaikan **${member.guild.name}**. Semoga harimu menyenangkan di luar sana!`;
    }

    const embed = new EmbedBuilder()
        .setTitle('Sampai Jumpa! 👋')
        .setDescription(customText)
        .setThumbnail(member.user.displayAvatarURL())
        .setColor(leaveData.color || '#FF69B4');
        
    channel.send({ embeds: [embed] }).catch(() => {});
  },
};