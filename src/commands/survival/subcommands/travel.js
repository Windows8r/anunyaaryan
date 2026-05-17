// Lokasi: src/commands/survival/subcommands/travel.js
const { EmbedBuilder } = require('discord.js');
const UserSurvival = require('../../../models/UserSurvival');
const ui = require('../../../config/ui');
const { advanceTime, getTimeState } = require('../../../utils/survivalTime');

module.exports = {
    async execute(interaction, client) {
        const user = interaction.user;
        const tujuan = interaction.options.getString('tujuan');
        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });
        
        if (survival.currentLocation === tujuan) {
            return interaction.reply({ content: `${ui.getEmoji('warning')} Kamu sudah berada di lokasi tersebut saat ini!`, ephemeral: true });
        }

        const hasNoVehicle = !survival.vehicle || survival.vehicle === 'none';
        if (tujuan !== 'village' && hasNoVehicle) {
            return interaction.reply({ 
                content: `${ui.getEmoji('error')} **Kamu terjebak!** Desa ini terlalu jauh dari kota. Kamu tidak bisa berjalan kaki sejauh itu. Kumpulkan material dan uang untuk membeli **Sepeda/Motor** di \`/survival shop\` agar bisa pergi ke Kota!`, 
                ephemeral: true 
            });
        }

        let travelTime = 4, vehName = 'Jalan Kaki 🚶';
        if (survival.vehicle === 'sepeda') { travelTime = 2; vehName = 'Sepeda Onthel 🚲'; }
        if (survival.vehicle === 'motor') { travelTime = 1; vehName = 'Sepeda Motor 🏍️'; }
        if (survival.vehicle === 'mobil') { travelTime = 0; vehName = 'Mobil Sport 🚗'; } 

        const timeUpdate = await advanceTime(user.id, travelTime);
        await UserSurvival.update({ currentLocation: tujuan }, { where: { userId: user.id } });
        
        const locNames = { 'village': '🏡 Naura Village', 'city': '🏙️ Naura City', 'academy': '🏫 Naura Academy', 'park': '🎡 Amusement Park' };
        const timeState = getTimeState(timeUpdate.hour);
        
        const embed = new EmbedBuilder()
            .setTitle(`${ui.getEmoji('lokasi')} Perjalanan Selesai!`)
            .setColor(ui.getColor('primary'))
            .setDescription(`Kamu melakukan perjalanan menuju **${locNames[tujuan]}** menggunakan **${vehName}**.\n\n${ui.getEmoji('clock')} Waktu tempuh: **${travelTime} Jam**.\n> Saat ini: ${timeState.emoji} **Hari ke-${timeUpdate.day}, Jam ${timeUpdate.hour.toString().padStart(2, '0')}:00** (${timeState.label})`);
            
        return interaction.reply({ embeds: [embed] });
    }
};