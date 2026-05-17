const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const UserProfile = require('../../../models/UserProfile');
const UserPet = require('../../../models/UserPet');
const itemsConfig = require('../../../config/items');
const ui = require('../../../config/ui');

module.exports = {
    async execute(interaction, client) {
        const user = interaction.user;
        const pets = await UserPet.findAll({ where: { userId: user.id } });
        
        if (pets.length === 0) {
            return interaction.reply({ 
                content: `${ui.getEmoji('error')} Kamu belum memiliki hewan. Cari di \`/survival collect hutan/laut\`!`, 
                ephemeral: true 
            });
        }

        const myPet = pets[0]; 
        const profile = await UserProfile.findOne({ where: { userId: user.id } });
        const currentInv = profile.inventory || [];

        // JIKA PET BELUM JINAK
        if (!myPet.isTamed) {
            const petFoodNeeded = myPet.petType === 'wolf' ? 'bone' : 'small_fish';
            const foodItem = itemsConfig.find(it => it.id === petFoodNeeded);
            const hasFood = currentInv.some(item => item.id === petFoodNeeded);
            
            const tamingBar = ui.createProgressBar(myPet.tamingProgress, 100, 10);
            const petEmoji = ui.getEmoji('pet');

            const embed = new EmbedBuilder()
                .setTitle(`${petEmoji} Menjinakkan: ${myPet.petName}`)
                .setDescription(`Hewan liar ini butuh **${foodItem.name}** agar percaya padamu.\n\n**Progress:** ${myPet.tamingProgress}%\n${tamingBar}`)
                .setColor(ui.getColor('primary'));

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('tame_pet')
                    .setLabel(`Beri ${foodItem.name}`)
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(!hasFood)
            );
            
            const response = await interaction.reply({ embeds: [embed], components: [row] });
            const collector = response.createMessageComponentCollector({ filter: i => i.user.id === user.id && i.customId === 'tame_pet', time: 20000, max: 1 });

            collector.on('collect', async i => {
                await i.deferUpdate();
                const foodIndex = currentInv.findIndex(invItem => invItem.id === petFoodNeeded);
                currentInv.splice(foodIndex, 1);
                await UserProfile.update({ inventory: currentInv }, { where: { userId: user.id } });

                const newProgress = myPet.tamingProgress + 25;
                let isNowTamed = false;

                if (newProgress >= 100) {
                    isNowTamed = true;
                    await UserPet.update({ tamingProgress: 100, isTamed: true, isActive: true }, { where: { id: myPet.id } });
                } else {
                    await UserPet.update({ tamingProgress: newProgress }, { where: { id: myPet.id } });
                }

                const updatedBar = ui.createProgressBar(Math.min(100, newProgress), 100, 10);
                const successEmbed = new EmbedBuilder()
                    .setTitle(`${petEmoji} Menjinakkan: ${myPet.petName}`)
                    .setColor(isNowTamed ? ui.getColor('success') : ui.getColor('primary'))
                    .setDescription(isNowTamed ? `${ui.getEmoji('success')} **BERHASIL!** ${myPet.petName} resmi menjadi partnermu!` : `*Nyam nyam...*\n\n**Progress:** ${newProgress}%\n${updatedBar}`);
                
                await i.editReply({ embeds: [successEmbed], components: [] });
            });
        } else {
            // JIKA PET SUDAH JINAK
            const embed = new EmbedBuilder()
                .setTitle(`${ui.getEmoji('pet')} Partner Setia: ${myPet.petName}`)
                .setDescription(`Status partnermu saat ini.`)
                .addFields(
                    { name: `${ui.getEmoji('hunger')} Lapar`, value: `${myPet.hunger}/100`, inline: true }, 
                    { name: `${ui.getEmoji('health')} Afeksi`, value: `${myPet.affection}/100`, inline: true }
                )
                .setColor(ui.getColor('success'));
            return interaction.reply({ embeds: [embed] });
        }
    }
};