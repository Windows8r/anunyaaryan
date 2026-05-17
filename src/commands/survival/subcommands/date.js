// Lokasi: src/commands/survival/subcommands/date.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const UserProfile = require('../../../models/UserProfile');
const UserSurvival = require('../../../models/UserSurvival');
const UserNPC = require('../../../models/UserNPC');
const ui = require('../../../config/ui');
const { advanceTime, getTimeState } = require('../../../utils/survivalTime');
const leveling = require('../../../utils/survivalLeveling'); 

module.exports = {
    async execute(interaction, client) {
        const user = interaction.user;
        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });
        const profile = await UserProfile.findOne({ where: { userId: user.id } });
        
        const errEmbed = (msg) => new EmbedBuilder().setColor(ui.getColor('error')).setDescription(`${ui.getEmoji('error')} ${msg}`);

        if (survival.currentLocation !== 'park') {
            return interaction.reply({ embeds: [errEmbed('Kamu harus pergi ke **Amusement Park** untuk kencan! Gunakan `/survival travel`.')], ephemeral: true });
        }

        const currentInv = profile.inventory || [];
        const ticketIndex = currentInv.findIndex(item => item.id === 'dating_ticket');
        
        if (ticketIndex === -1) {
            return interaction.reply({ embeds: [errEmbed('Kamu butuh **🎟️ Tiket Kencan** untuk masuk ke wahana! Beli dulu di `/survival shop`.')], ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('🎡 Kencan di Taman Hiburan')
            .setColor(ui.getColor('accent'))
            .setDescription('Kamu menyerahkan **Tiket Kencan** kepada penjaga gerbang. Sekarang, siapa yang ingin kamu ajak naik Bianglala (Ferris Wheel)?');

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('date_select_npc')
            .setPlaceholder('Pilih pasangan kencanmu...')
            .addOptions([
                new StringSelectMenuOptionBuilder().setLabel('Anya (Gadis Hutan)').setEmoji('🌿').setValue('anya'),
                new StringSelectMenuOptionBuilder().setLabel('Victoria (Bangsawan)').setEmoji('💎').setValue('victoria'),
                new StringSelectMenuOptionBuilder().setLabel('Marina (Gadis Pesisir)').setEmoji('🌊').setValue('marina'),
                new StringSelectMenuOptionBuilder().setLabel('Kira (Pekerja Tambang)').setEmoji('⛏️').setValue('kira')
            ]);

        const response = await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(selectMenu)] });
        const collector = response.createMessageComponentCollector({ filter: i => i.user.id === user.id, time: 60000 });

        collector.on('collect', async i => {
            await i.deferUpdate();
            
            if (i.customId === 'date_select_npc') {
                const npcId = i.values[0];
                const npcNames = { anya: 'Anya', victoria: 'Victoria', marina: 'Marina', kira: 'Kira' };
                
                const dialogEmbed = new EmbedBuilder()
                    .setTitle(`🎡 Di Atas Bianglala Bersama ${npcNames[npcId]}`)
                    .setColor(ui.getColor('accent'))
                    .setDescription(`Kalian sedang menikmati pemandangan malam dari atas bianglala yang berputar perlahan. Tiba-tiba **${npcNames[npcId]}** menatapmu dan bertanya:\n\n*"Pemandangannya indah sekali ya... Menurutmu, apa yang paling berharga di dunia ini?"*\n\n**Pilih jawaban terbaikmu:**`);

                const rowButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`date_ans_1_${npcId}`).setLabel('Kekayaan & Harta').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`date_ans_2_${npcId}`).setLabel('Kedamaian Alam').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`date_ans_3_${npcId}`).setLabel('Kamu (Gombal)').setStyle(ButtonStyle.Danger)
                );

                await i.editReply({ embeds: [dialogEmbed], components: [rowButtons] });
            }

            if (i.customId.startsWith('date_ans_')) {
                const parts = i.customId.split('_');
                const ans = parts[2]; 
                const npcId = parts[3];

                let isPerfect = false;
                if (npcId === 'victoria' && ans === '1') isPerfect = true;
                else if (npcId === 'anya' && ans === '2') isPerfect = true;
                else if ((npcId === 'marina' || npcId === 'kira') && ans === '3') isPerfect = true;
                
                let addedAffection = isPerfect ? 30 : 5;
                let responNpc = isPerfect 
                    ? `*"Ah... kamu benar-benar mengerti jalan pikiranku!"* (Wajahnya memerah) 🥰\n\n**Kencan Sangat Sukses! (+30 Afeksi)**` 
                    : `*"Oh... begitu ya... Menarik."* (Dia tersenyum canggung) 🙂\n\n**Kencan Berjalan Biasa Saja (+5 Afeksi)**`;

                currentInv.splice(ticketIndex, 1);
                await UserProfile.update({ inventory: currentInv }, { where: { userId: user.id } });

                const [npcRelation] = await UserNPC.findOrCreate({ where: { userId: user.id, npcId: npcId } });
                const maxLimit = npcRelation.isMarried ? 140 : 100;
                const finalRel = Math.min(maxLimit, (npcRelation.relationshipLevel || 0) + addedAffection);
                
                await UserNPC.update({ relationshipLevel: finalRel }, { where: { userId: user.id, npcId: npcId } });

                const timeUpdate = await advanceTime(user.id, 3);
                const timeState = getTimeState(timeUpdate.hour);

                await leveling.addPlayerXP(user.id, 20);

                const finalEmbed = new EmbedBuilder()
                    .setTitle(`🎡 Kencan Selesai`)
                    .setColor(ui.getColor('accent'))
                    .setDescription(`Kamu menjawab pertanyaannya.\n\n${responNpc}\n\n🌟 **Mendapat +20 XP Sosial**\n\n⏰ Waktu berlalu 3 Jam...\n> Saat ini: ${timeState.emoji} **Hari ke-${timeUpdate.day}, Jam ${timeUpdate.hour.toString().padStart(2, '0')}:00** (${timeState.label})`)
                    .setFooter({ text: 'Naura Romance System' });

                await i.editReply({ embeds: [finalEmbed], components: [] });
                collector.stop();
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.editReply({ embeds: [errEmbed('Kamu terlalu lama melamun, tiketmu hangus tertiup angin!')], components: [] }).catch(()=>{});
            }
        });
    }
};