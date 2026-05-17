// Lokasi: src/commands/survival/subcommands/sleep.js
const { EmbedBuilder } = require('discord.js');
const UserSurvival = require('../../../models/UserSurvival');
const ui = require('../../../config/ui');

module.exports = {
    async execute(interaction) {
        const user = interaction.user;
        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });

        const errEmbed = (msg) => new EmbedBuilder().setColor(ui.getColor('error')).setDescription(`${ui.getEmoji('error')} ${msg}`);

        if (survival.inGameHour > 6 && survival.inGameHour < 18) {
            return interaction.reply({ embeds: [errEmbed('Ini masih terlalu pagi/siang untuk tidur! Lakukan aktivitas lain.')], ephemeral: true });
        }

        let newDay = (survival.inGameDay || 1) + 1;
        let newHour = 6; 

        // Pemulihan stamina selalu full
        let staminaRecover = 100;
        
        // Pengurangan Lapar/Haus (Tidur butuh energi)
        let hungerDrain = 20; 
        let thirstDrain = 20;
        
        // Membaca nama properti tempat tidur
        let propName = 'Pinggir Jalan';
        if (survival.propertyId === 'gudang') propName = 'Gudang Tua';
        if (survival.propertyId === 'kos') propName = 'Kos-kosan';
        if (survival.propertyId === 'rumah') propName = 'Rumah Nyaman';

        await UserSurvival.update({ 
            inGameDay: newDay, 
            inGameHour: newHour,
            stamina: staminaRecover,
            hunger: Math.max(0, (survival.hunger || 100) - hungerDrain),
            thirst: Math.max(0, (survival.thirst || 100) - thirstDrain)
        }, { where: { userId: user.id } });

        const sleepEmbed = new EmbedBuilder()
            .setTitle(`${ui.getEmoji('bed')} Zzz... Tidur Nyenyak`)
            .setColor(ui.getColor('primary'))
            .setDescription(`Kamu merebahkan diri di **${propName}** dan terlelap hingga pagi menyapa.\n\n**Pemulihan:**\n> ⚡ Stamina kembali penuh (100/100)!\n> ${ui.getEmoji('hunger')} Lapar: -20 | ${ui.getEmoji('thirst')} Haus: -20\n\n${ui.getEmoji('morning')} **Selamat Pagi!** Sekarang adalah **Hari ke-${newDay}**, Jam 06:00.`)
            .setFooter({ text: 'Pastikan makan sarapan sebelum memulai hari!' });

        return interaction.reply({ embeds: [sleepEmbed] });
    }
};