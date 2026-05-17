// Lokasi: src/commands/survival/subcommands/craft.js
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const UserProfile = require('../../../models/UserProfile');
const UserSurvival = require('../../../models/UserSurvival');
const itemsConfig = require('../../../config/items');
const ui = require('../../../config/ui');
const { advanceTime } = require('../../../utils/survivalTime');
const leveling = require('../../../utils/survivalLeveling'); 

module.exports = {
    async execute(interaction, client) {
        const user = interaction.user;
        const profile = await UserProfile.findOne({ where: { userId: user.id } });
        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });
        const currentInv = profile.inventory || [];
        
        const errEmbed = (msg) => new EmbedBuilder().setColor(ui.getColor('error')).setDescription(`${ui.getEmoji('error')} ${msg}`);

        if (survival.stamina <= 10) {
            return interaction.reply({ embeds: [errEmbed('Kamu terlalu lelah untuk merakit barang! Tidur atau konsumsi *energy drink* dulu.')], ephemeral: true });
        }
        
        const recipes = {
            'wooden_axe': { name: 'Kapak Kayu (Lv. 1)', emoji: ui.getEmoji('tools') !== '💠' ? ui.getEmoji('tools') : '🪓', reqs: { wood: 5, fiber: 2 } },
            'iron_axe': { name: 'Kapak Besi (Lv. 1)', emoji: ui.getEmoji('tools') !== '💠' ? ui.getEmoji('tools') : '⚒️', reqs: { iron_ore: 15, wood: 5 } },
            'diamond_axe': { name: 'Kapak Berlian (Lv. 1)', emoji: ui.getEmoji('diamond') !== '💠' ? ui.getEmoji('diamond') : '💎', reqs: { diamond: 5, wood: 10 } },
            'fishing_rod': { name: 'Alat Pancing (Lv. 1)', emoji: ui.getEmoji('fishing_rod') !== '💠' ? ui.getEmoji('fishing_rod') : '🎣', reqs: { wood: 5, fiber: 5 } },
            'iron_sword': { name: 'Pedang Besi (Lv. 1)', emoji: '🗡️', reqs: { iron_ore: 20, wood: 5 } },
            'diamond_sword': { name: 'Pedang Berlian (Lv. 1)', emoji: '⚔️', reqs: { diamond: 10, iron_ore: 5 } },
            'bandage': { name: 'Perban Medis', emoji: '🩹', reqs: { fiber: 5 } },
            'marriage_ring': { name: 'Cincin Berlian Nikah', emoji: '💍', reqs: { diamond: 5, iron_ore: 10 } }
        };

        const userItems = {};
        currentInv.forEach(item => { userItems[item.id] = (userItems[item.id] || 0) + 1; });

        const craftOptions = Object.keys(recipes).map(craftId => {
            const rec = recipes[craftId];
            let reqText = [];
            for (const [reqId, qty] of Object.entries(rec.reqs)) {
                const itemName = itemsConfig.find(it => it.id === reqId)?.name || reqId;
                reqText.push(`${qty}x ${itemName}`);
            }
            return new StringSelectMenuOptionBuilder()
                .setLabel(`Rakit: ${rec.name}`)
                .setDescription(`Butuh: ${reqText.join(', ')}`)
                .setValue(craftId)
                .setEmoji(rec.emoji);
        });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_craft')
            .setPlaceholder('Pilih cetak biru barang untuk dirakit...')
            .addOptions(craftOptions);

        const embed = new EmbedBuilder()
            .setTitle(`🔨 Meja Perakitan Naura`)
            .setColor(ui.getColor('crafting') || '#228B22')
            .setDescription(`"Satukan material mentah menjadi barang yang berguna!"\n\nPilih cetak biru yang ingin kamu rakit dari daftar di bawah. Proses ini akan memakan waktu **1 Jam** dan menguras **10 Stamina**.`);

        const response = await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(selectMenu)] });
        const collector = response.createMessageComponentCollector({ filter: i => i.user.id === user.id, time: 60000, max: 1 });

        collector.on('collect', async i => {
            await i.deferUpdate();
            const craftId = i.values[0];
            const rec = recipes[craftId];
            
            let canCraft = true; 
            let missingText = [];
            
            for (const [reqId, qty] of Object.entries(rec.reqs)) {
                const owned = userItems[reqId] || 0;
                if (owned < qty) { 
                    canCraft = false; 
                    missingText.push(`**${qty - owned}x ${itemsConfig.find(it => it.id === reqId)?.name || reqId}**`); 
                }
            }

            if (!canCraft) {
                return i.followUp({ embeds: [errEmbed(`Material tidak cukup untuk merakit **${rec.name}**!\n\n> ❌ Kekurangan: ${missingText.join(', ')}`)], ephemeral: true });
            }

            const newInv = []; 
            const removedCount = {};
            for (const item of currentInv) {
                const reqQty = rec.reqs[item.id];
                if (reqQty && (removedCount[item.id] || 0) < reqQty) {
                    removedCount[item.id] = (removedCount[item.id] || 0) + 1;
                } else {
                    newInv.push(item);
                }
            }

            let craftedConf = itemsConfig.find(it => it.id === craftId) || { id: craftId, name: rec.name }; 
            newInv.push({ id: craftedConf.id, name: craftedConf.name });
            
            const newStamina = Math.max(0, survival.stamina - 10);
            await advanceTime(user.id, 1);

            await leveling.addPlayerXP(user.id, 15);

            await UserProfile.update({ inventory: newInv }, { where: { userId: user.id } });
            await UserSurvival.update({ stamina: newStamina }, { where: { userId: user.id } });

            const successEmbed = new EmbedBuilder()
                .setTitle(`✨ Perakitan Berhasil!`)
                .setColor(ui.getColor('success'))
                .setDescription(`Kamu menghabiskan 1 jam memukul dan merangkai material...\n\nKamu berhasil mendapatkan ${rec.emoji} **${craftedConf.name}**!\nBarang sudah dimasukkan ke dalam tasmu.\n\n> ⚡ Stamina: -10\n> 🌟 XP: +15`);

            await i.editReply({ embeds: [successEmbed], components: [] });
        });
    }
};