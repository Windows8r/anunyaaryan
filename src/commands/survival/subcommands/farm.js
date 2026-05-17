// Lokasi: src/commands/survival/subcommands/farm.js
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const UserProfile = require('../../../models/UserProfile');
const UserSurvival = require('../../../models/UserSurvival');
const UserFarm = require('../../../models/UserFarm');
const itemsConfig = require('../../../config/items');
const ui = require('../../../config/ui');
const leveling = require('../../../utils/survivalLeveling');

module.exports = {
    async execute(interaction, client) {
        const user = interaction.user;
        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });
        const prop = survival.propertyId || 'jalanan';

        const errEmbed = (msg) => new EmbedBuilder().setColor(ui.getColor('error')).setDescription(`${ui.getEmoji('error')} ${msg}`);
        const successEmbed = (msg) => new EmbedBuilder().setColor(ui.getColor('success')).setDescription(`${ui.getEmoji('success')} ${msg}`);

        if (prop === 'jalanan') {
            return interaction.reply({ embeds: [errEmbed('Kamu tinggal di pinggir jalan! Beli **Kos-kosan** atau **Rumah** di `/survival shop` dulu untuk punya lahan tani.')], ephemeral: true });
        }

        const maxSlots = prop === 'kos' ? 2 : 5;
        const currentDay = survival.inGameDay || 1;
        let farms = await UserFarm.findAll({ where: { userId: user.id } });

        let farmDisplay = ''; 
        const farmOptions = [];

        for (let i = 1; i <= maxSlots; i++) {
            const slot = farms.find(f => f.slotIndex === i);
            if (!slot) {
                farmDisplay += `**Lahan ${i}:** 🪹 Tanah Kosong\n`;
                farmOptions.push(new StringSelectMenuOptionBuilder().setLabel(`Lahan ${i} (Kosong)`).setValue(`farm_empty_${i}`));
            } else {
                const isReady = currentDay >= slot.readyDay;
                const seedConf = itemsConfig.find(it => it.id === slot.seedId);
                if (isReady) {
                    farmDisplay += `**Lahan ${i}:** 🌾 **${seedConf.name} (Siap Panen!)**\n`;
                    farmOptions.push(new StringSelectMenuOptionBuilder().setLabel(`Panen Lahan ${i}`).setEmoji('🌾').setValue(`farm_harvest_${slot.id}`));
                } else {
                    farmDisplay += `**Lahan ${i}:** 🌱 ${seedConf.name} (Sisa ${slot.readyDay - currentDay} Hari)\n`;
                }
            }
        }

        const embed = new EmbedBuilder()
            .setTitle(`🏡 Kebun di ${prop === 'kos' ? 'Kos-kosan' : 'Halaman Rumah'}`)
            .setColor(ui.getColor('crafting'))
            .setDescription(`Waktu In-Game: **Hari ke-${currentDay}**\n\n${farmDisplay}\n*Pilih lahan kosong untuk menanam, atau lahan siap panen untuk mengambil hasilnya.*`);

        if (farmOptions.length === 0) {
            return interaction.reply({ embeds: [embed, new EmbedBuilder().setColor(ui.getColor('primary')).setDescription('Semua lahanmu sedang ditanami dan belum ada yang siap panen. Sabar ya! Tunggu hari berganti.')] });
        }

        const selectMenu = new StringSelectMenuBuilder().setCustomId('farm_select').setPlaceholder('Kelola Lahan...').addOptions(farmOptions);
        const response = await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(selectMenu)] });
        const collector = response.createMessageComponentCollector({ filter: i => i.user.id === user.id, time: 45000 });

        collector.on('collect', async i => {
            await i.deferUpdate();
            const action = i.values[0];
            const profile = await UserProfile.findOne({ where: { userId: user.id } });
            const currentInv = profile.inventory || [];

            // ==========================================
            // JIKA PANEN
            // ==========================================
            if (action.startsWith('farm_harvest_')) {
                const farmId = action.replace('farm_harvest_', '');
                const slot = await UserFarm.findOne({ where: { id: farmId } });
                
                let harvestId = slot.seedId === 'seed_wheat' ? 'wheat' : slot.seedId === 'seed_potato' ? 'potato' : 'apple';
                const harvestItem = itemsConfig.find(it => it.id === harvestId);
                
                currentInv.push({ id: harvestId, name: harvestItem.name });
                await UserProfile.update({ inventory: currentInv }, { where: { userId: user.id } });
                await UserFarm.destroy({ where: { id: farmId } });

                await leveling.addPlayerXP(user.id, 5);

                await i.editReply({ embeds: [successEmbed(`Yeay! Kamu berhasil memanen **${harvestItem.name}**!\n🌟 *(+5 XP)*`)], components: [] });
                collector.stop();
            }

            // ==========================================
            // JIKA TANAM (PILIH BENIH)
            // ==========================================
            if (action.startsWith('farm_empty_')) {
                const slotIndex = parseInt(action.replace('farm_empty_', ''));
                const seeds = {};
                
                currentInv.forEach(item => {
                    const conf = itemsConfig.find(it => it.id === item.id);
                    if (conf && conf.category === 'seed') seeds[item.id] = (seeds[item.id] || 0) + 1;
                });

                const seedKeys = Object.keys(seeds);
                if (seedKeys.length === 0) return i.followUp({ embeds: [errEmbed('Kamu tidak punya benih satupun di tas! Beli di shop.')], ephemeral: true });

                const seedMenu = new StringSelectMenuBuilder()
                    .setCustomId('farm_plant')
                    .setPlaceholder('Pilih benih untuk ditanam...')
                    // ✨ PERBAIKAN BUG: Menggunakan pemisah '#' agar ID yang memiliki '_' tidak bentrok
                    .addOptions(seedKeys.map(id => new StringSelectMenuOptionBuilder()
                        .setLabel(`${itemsConfig.find(it => it.id === id).name} (x${seeds[id]})`)
                        .setValue(`${id}#${slotIndex}`) 
                    ));

                const promptPlant = new EmbedBuilder().setColor(ui.getColor('crafting')).setDescription(`Pilih benih yang ingin ditanam di **Lahan ${slotIndex}**:`);
                await i.editReply({ embeds: [promptPlant], components: [new ActionRowBuilder().addComponents(seedMenu)] });
            }

            // ==========================================
            // PROSES EKSEKUSI TANAM
            // ==========================================
            if (i.customId === 'farm_plant') {
                // ✨ PERBAIKAN BUG: Split menggunakan karakter '#'
                const [seedId, slotIndexStr] = i.values[0].split('#');
                const slotIndex = parseInt(slotIndexStr);
                let growDays = seedId === 'seed_potato' ? 2 : seedId === 'seed_apple' ? 3 : 1;
                
                const seedIdx = currentInv.findIndex(inv => inv.id === seedId);
                currentInv.splice(seedIdx, 1);
                
                await UserProfile.update({ inventory: currentInv }, { where: { userId: user.id } });
                await UserFarm.create({ userId: user.id, slotIndex, seedId, plantedDay: currentDay, readyDay: currentDay + growDays });

                await leveling.addPlayerXP(user.id, 2); 
                await i.editReply({ embeds: [successEmbed(`🌱 Berhasil menanam! Gunakan \`/survival rest\` untuk memajukan hari.\n🌟 *(+2 XP)*`)], components: [] });
                collector.stop();
            }
        });
        
        collector.on('end', collected => {
            if (collected.size === 0) interaction.editReply({ embeds: [new EmbedBuilder().setColor(ui.getColor('dark')).setDescription('Sesi bertani ditutup.')], components: [] }).catch(()=>{});
        });
    }
};