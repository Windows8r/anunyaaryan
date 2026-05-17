// Lokasi: src/commands/survival/subcommands/study.js
const { EmbedBuilder } = require('discord.js');
const UserSurvival = require('../../../models/UserSurvival');
const ui = require('../../../config/ui');
const { advanceTime, getTimeState } = require('../../../utils/survivalTime');

module.exports = {
    async execute(interaction, client) {
        const user = interaction.user;
        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });

        if (survival.currentLocation !== 'academy') {
            return interaction.reply({ content: `${ui.getEmoji('error')} Kamu harus pergi ke **Naura Academy** terlebih dahulu menggunakan \`/survival travel\`!`, ephemeral: true });
        }

        if (survival.hunger <= 15 || survival.thirst <= 15) {
            return interaction.reply({ content: `${ui.getEmoji('warning')} Otakmu butuh nutrisi! Kamu terlalu lapar/haus untuk belajar. Makan dulu ya!`, ephemeral: true });
        }

        const studyTime = 3;
        const intGain = Math.floor(Math.random() * 3) + 1;
        
        const newHunger = Math.max(0, survival.hunger - 15);
        const newThirst = Math.max(0, survival.thirst - 20);
        const newInt = (survival.intelligence || 1) + intGain;

        const timeUpdate = await advanceTime(user.id, studyTime);
        const timeState = getTimeState(timeUpdate.hour);

        await UserSurvival.update({ 
            hunger: newHunger, thirst: newThirst, intelligence: newInt 
        }, { where: { userId: user.id } });

        const embed = new EmbedBuilder()
            .setTitle(`🏫 Belajar di Naura Academy`)
            .setColor(ui.getColor('primary'))
            .setDescription(`Kamu membaca buku tebal di perpustakaan kampus selama ${studyTime} jam.\n\n**Hasil Belajar:**\n> ${ui.getEmoji('intelligence')} Kepintaran bertambah **+${intGain}** (Total: ${newInt})\n> ${ui.getEmoji('hunger')} Lapar: -15 | ${ui.getEmoji('thirst')} Haus: -20\n\n**Waktu Saat Ini:**\n> ${timeState.emoji} **Hari ke-${timeUpdate.day}**, jam ${timeUpdate.hour.toString().padStart(2, '0')}:00 (${timeState.label})`)
            .setFooter({ text: 'Semakin pintar dirimu, semakin besar gaji yang kau dapat di Naura City!' });

        return interaction.reply({ embeds: [embed] });
    }
};