// Lokasi: src/commands/survival/subcommands/collect.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const UserProfile = require('../../../models/UserProfile');
const UserSurvival = require('../../../models/UserSurvival');
const UserPet = require('../../../models/UserPet');
const itemsConfig = require('../../../config/items');
const ui = require('../../../config/ui');
const { advanceTime, getTimeState } = require('../../../utils/survivalTime');
const leveling = require('../../../utils/survivalLeveling');

module.exports = {
    async execute(interaction) {
        const user = interaction.user;
        const lokasi = interaction.options.getString('lokasi');
        
        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });
        const profile = await UserProfile.findOne({ where: { userId: user.id } });

        const errEmbed = (msg) => new EmbedBuilder().setColor(ui.getColor('error')).setDescription(`${ui.getEmoji('error')} ${msg}`);

        if (survival.hunger <= 10 || survival.thirst <= 10 || survival.stamina <= 10) {
            return interaction.reply({ 
                embeds: [errEmbed(`Kamu terlalu lemas untuk pergi ke **${lokasi}**. Makan, minum, atau tidurlah dulu!`)], 
                flags: MessageFlags.Ephemeral 
            });
        }

        const currentInv = profile.inventory || [];
        
        // Pengecekan Alat Pancing di Laut
        if (lokasi === 'laut' && !currentInv.some(item => item && item.id === 'fishing_rod')) {
            return interaction.reply({ 
                embeds: [errEmbed('Kamu butuh **Alat Pancing** untuk memancing di laut! Craft terlebih dahulu.')], 
                flags: MessageFlags.Ephemeral 
            });
        }
        
        // Pengecekan Kapak di Hutan
        if (lokasi === 'hutan' && !currentInv.some(item => item?.id?.includes('axe'))) {
            return interaction.reply({ 
                embeds: [errEmbed('Kamu butuh **Kapak** (seperti Kapak Kayu Tua) untuk menebang pohon di hutan!')], 
                flags: MessageFlags.Ephemeral 
            });
        }

        // ✨ PENAMBAHAN BARU: Pengecekan Beliung di Tambang
        if (lokasi === 'tambang' && !currentInv.some(item => item?.id?.includes('pickaxe'))) {
            return interaction.reply({ 
                embeds: [errEmbed('Kamu butuh **Beliung** (seperti Beliung Kayu Tua) untuk menghancurkan bebatuan di tambang!')], 
                flags: MessageFlags.Ephemeral 
            });
        }

        const timeState = getTimeState(survival.inGameHour || 6);
        const embed = new EmbedBuilder()
            .setTitle(`${ui.getEmoji('lokasi')} Lokasi: ${lokasi.toUpperCase()}`)
            .setDescription(`Kamu tiba di area ${lokasi}. Pilih area mana yang ingin kamu jelajahi!`)
            .setColor(timeState.color);
            
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('collect_1').setLabel('Cari di Sini').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('collect_2').setLabel('Cari di Sana').setStyle(ButtonStyle.Secondary)
        );

        const response = await interaction.reply({ embeds: [embed], components: [row] });
        const collector = response.createMessageComponentCollector({ filter: i => i.user.id === user.id, time: 15000, max: 1 });

        collector.on('collect', async i => {
            await i.deferUpdate();
            
            let dropLapar = 5, dropHaus = 8, dropStamina = 10, rewardId = '';
            const activePets = await UserPet.findAll({ where: { userId: user.id, isActive: true } });
            const isWolf = activePets.some(p => p.petType === 'wolf');
            const isCat = activePets.some(p => p.petType === 'cat');

            let list = [];
            if (lokasi === 'hutan') { 
                list = ['wood', 'wood', 'fiber', 'apple', 'stone']; 
                if (isCat) list.push('apple', 'seed_apple'); 
            } else if (lokasi === 'sampah') { 
                list = ['trash', 'fiber', 'mineral_water']; 
            } else if (lokasi === 'tambang') {
                dropLapar = 10; dropHaus = 15; dropStamina = 20;
                if (isWolf) { dropLapar -= 4; dropHaus -= 5; dropStamina -= 5; }
                list = ['stone', 'stone', 'iron_ore', 'iron_ore', 'diamond', 'naura_shard'];
                if (isCat) list.push('diamond', 'naura_shard'); 
            } else if (lokasi === 'laut') {
                dropLapar = 3; dropHaus = 5; dropStamina = 5;
                list = ['small_fish', 'salmon', 'trash'];
                if (isCat) list.push('salmon', 'mystic_herb'); 
            }

            let isQTE = false;
            let qteButtons = [];

            if (lokasi === 'laut') {
                isQTE = true;
                qteButtons = [
                    new ButtonBuilder().setCustomId('qte_wrong1').setLabel('LEPAS').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('qte_correct').setLabel('TARIK!').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('qte_wrong2').setLabel('DIAM').setStyle(ButtonStyle.Secondary)
                ];
            } else if (lokasi === 'tambang' && Math.random() < 0.4) {
                isQTE = true;
                qteButtons = [
                    new ButtonBuilder().setCustomId('qte_correct').setLabel('HANTAM!').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('qte_wrong1').setLabel('USAP').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('qte_wrong2').setLabel('LARI').setStyle(ButtonStyle.Secondary)
                ];
            } else if (lokasi === 'hutan' && Math.random() < 0.3) {
                isQTE = true;
                qteButtons = [
                    new ButtonBuilder().setCustomId('qte_wrong1').setLabel('CABUT').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('qte_wrong2').setLabel('TENDANG').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('qte_correct').setLabel('TEBANG!').setStyle(ButtonStyle.Primary)
                ];
            }

            const processLoot = async (isSuccess, interactionSource) => {
                if (!isSuccess) {
                    const failEmbed = new EmbedBuilder().setColor(ui.getColor('error')).setDescription(`${ui.getEmoji('error')} Gagal! Kamu salah langkah dan kehilangan target.`);
                    return interactionSource.editReply({ embeds: [failEmbed], components: [] });
                }

                rewardId = list[Math.floor(Math.random() * list.length)];
                const itemReward = itemsConfig.find(it => it.id === rewardId) || { id: rewardId, name: rewardId };

                const newHunger = Math.max(0, survival.hunger - dropLapar);
                const newThirst = Math.max(0, survival.thirst - dropHaus);
                const newStamina = Math.max(0, survival.stamina - dropStamina);
                
                const hoursTaken = lokasi === 'tambang' ? 2 : 1;
                const timeUpdate = await advanceTime(user.id, hoursTaken);
                const newTimeState = getTimeState(timeUpdate.hour);

                await UserSurvival.update({ hunger: newHunger, thirst: newThirst, stamina: newStamina }, { where: { userId: user.id } });
                const updatedInv = profile.inventory || [];
                updatedInv.push({ id: rewardId, name: itemReward.name });
                await UserProfile.update({ inventory: updatedInv }, { where: { userId: user.id } });

                let gainedXP = lokasi === 'tambang' ? 10 : 5;
                await leveling.addPlayerXP(user.id, gainedXP);

                const successEmbed = new EmbedBuilder()
                    .setTitle(`${ui.getEmoji('success')} Eksplorasi Berhasil!`)
                    .setColor(ui.getColor('success'))
                    .setDescription(`Kamu mendapatkan **${itemReward.name}**!\n\n**Pengorbanan:**\n> ${ui.getEmoji('hunger')} Lapar: -${dropLapar} | ${ui.getEmoji('thirst')} Haus: -${dropHaus}\n> ⚡ Stamina: -${dropStamina} | ⏰ Waktu: +${hoursTaken} Jam\n\n🌟 **Mendapatkan +${gainedXP} XP**\n\n**Waktu Saat Ini:**\n> Hari ke-${timeUpdate.day}, Jam ${timeUpdate.hour.toString().padStart(2, '0')}:00 (${newTimeState.label})`);

                await interactionSource.editReply({ embeds: [successEmbed], components: [] });
            };

            if (isQTE) {
                qteButtons.sort(() => Math.random() - 0.5);
                const qteRow = new ActionRowBuilder().addComponents(qteButtons);
                
                let qteMsg = '🎣 **STRIKE!** Umpanmu ditarik kencang!';
                if (lokasi === 'tambang') qteMsg = '💎 **BATU KERAS!** Kamu menemukan urat mineral murni!';
                if (lokasi === 'hutan') qteMsg = '🌳 **POHON RAKSASA!** Ayunkan kapakmu dengan benar!';

                const qteEmbed = new EmbedBuilder().setColor(ui.getColor('warning')).setDescription(`${qteMsg}\n\nTekan tombol yang tepat dalam **5 Detik**!`);

                const qteResponse = await i.editReply({ embeds: [qteEmbed], components: [qteRow] });
                const qteCollector = qteResponse.createMessageComponentCollector({ filter: btnI => btnI.user.id === user.id, time: 5000, max: 1 });

                qteCollector.on('collect', async btnI => {
                    await btnI.deferUpdate();
                    if (btnI.customId === 'qte_correct') await processLoot(true, btnI);
                    else await processLoot(false, btnI);
                });

                qteCollector.on('end', collected => {
                    if (collected.size === 0) i.editReply({ embeds: [errEmbed('⏱️ Waktu Habis! Kamu terlalu lambat bereaksi.')], components: [] }).catch(()=>{});
                });
            } else {
                const waitEmbed = new EmbedBuilder().setColor(ui.getColor('primary')).setDescription('Sedang mengais area ini...');
                await i.editReply({ embeds: [waitEmbed], components: [] });
                setTimeout(async () => { await processLoot(true, i); }, 1500);
            }
        });

        collector.on('end', c => { 
            if (c.size === 0) interaction.editReply({ embeds: [errEmbed('Waktu habis, kamu melamun terlalu lama!')], components: [] }).catch(()=>{}); 
        });
    }
};