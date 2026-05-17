// Lokasi: src/commands/survival/subcommands/work.js
const { EmbedBuilder } = require('discord.js');
const UserSurvival = require('../../../models/UserSurvival');
const UserProfile = require('../../../models/UserProfile');
const ui = require('../../../config/ui');
const { advanceTime, getTimeState } = require('../../../utils/survivalTime');

module.exports = {
    async execute(interaction, client) {
        const user = interaction.user;
        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });
        const profile = await UserProfile.findOne({ where: { userId: user.id } });

        if (survival.currentLocation !== 'city') {
            return interaction.reply({ content: `${ui.getEmoji('error')} Pusat perkantoran ada di **Naura City**! Gunakan \`/survival travel\` untuk ke sana.`, ephemeral: true });
        }

        if (survival.hunger <= 25 || survival.thirst <= 25) {
            return interaction.reply({ content: `${ui.getEmoji('warning')} Kamu terlalu lemas untuk bekerja keras. Pulihkan dulu tenagamu!`, ephemeral: true });
        }

        const intStat = survival.intelligence || 1;
        let jobName = '';
        let salary = 0;

        if (intStat < 20) {
            jobName = '👷 Kuli Bangunan';
            salary = Math.floor(Math.random() * 2000) + 1000;
        } else if (intStat >= 20 && intStat < 60) {
            jobName = '👨‍💼 Karyawan Kantoran';
            salary = Math.floor(Math.random() * 4000) + 4000;
        } else if (intStat >= 60 && intStat < 150) {
            jobName = '💻 Senior Programmer';
            salary = Math.floor(Math.random() * 8000) + 12000;
        } else {
            jobName = '🏢 CEO Perusahaan';
            salary = Math.floor(Math.random() * 20000) + 30000;
        }

        const workTime = 4;
        const newHunger = Math.max(0, survival.hunger - 25);
        const newThirst = Math.max(0, survival.thirst - 30);
        
        let currentWallet = profile.economy_wallet || 0; // 👈 PENGGUNAAN economy_wallet
        currentWallet += salary;

        const timeUpdate = await advanceTime(user.id, workTime);
        const timeState = getTimeState(timeUpdate.hour);

        await UserSurvival.update({ hunger: newHunger, thirst: newThirst }, { where: { userId: user.id } });
        await UserProfile.update({ economy_wallet: currentWallet }, { where: { userId: user.id } }); // 👈 UPDATE economy_wallet

        const embed = new EmbedBuilder()
            .setTitle(`🏙️ Bekerja di Naura City`)
            .setColor(ui.getColor('economy'))
            .setDescription(`Berkat tingkat kepintaranmu (**IQ: ${intStat}**), kamu diterima bekerja sebagai **${jobName}** hari ini!\n\n**Slip Gaji:**\n> ${ui.getEmoji('coin')} Mendapatkan **${salary.toLocaleString('id-ID')} Naura Coins**\n> ${ui.getEmoji('wallet')} Total Dompet: ${currentWallet.toLocaleString('id-ID')} NC\n> ${ui.getEmoji('hunger')} Lapar: -25 | ${ui.getEmoji('thirst')} Haus: -30\n\n**Waktu Saat Ini:**\n> ${timeState.emoji} **Hari ke-${timeUpdate.day}**, jam ${timeUpdate.hour.toString().padStart(2, '0')}:00 (${timeState.label})`)
            .setFooter({ text: 'Tingkatkan intelligence di Naura Academy untuk gaji lebih tinggi!' });

        return interaction.reply({ embeds: [embed] });
    }
};