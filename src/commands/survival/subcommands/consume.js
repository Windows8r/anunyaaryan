// Lokasi: src/commands/survival/subcommands/use.js
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const UserProfile = require('../../../models/UserProfile');
const UserSurvival = require('../../../models/UserSurvival');
const itemsConfig = require('../../../config/items');
const ui = require('../../../config/ui');
const leveling = require('../../../utils/survivalLeveling'); 

module.exports = {
    async execute(interaction) {
        const user = interaction.user;
        const profile = await UserProfile.findOne({ where: { userId: user.id } });
        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });
        
        const errEmbed = (msg) => new EmbedBuilder().setColor(ui.getColor('error')).setDescription(`${ui.getEmoji('error')} ${msg}`);
        
        const currentInv = profile.inventory || [];
        const userConsumables = {};
        
        currentInv.forEach(item => {
            const conf = itemsConfig.find(it => it.id === item.id);
            if (conf && conf.category === 'consumable') {
                if (!userConsumables[item.id]) userConsumables[item.id] = { ...conf, count: 1 };
                else userConsumables[item.id].count += 1;
            }
        });

        const keys = Object.keys(userConsumables);
        if (keys.length === 0) {
            return interaction.reply({ embeds: [errEmbed('Tas perbekalanmu kosong! Pergi mancing, beli di pasar, atau collect di hutan.')], ephemeral: true });
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('consume_item')
            .setPlaceholder('Pilih perbekalan untuk digunakan...')
            .addOptions(keys.map(id => {
                const it = userConsumables[id];
                let emojiOpt = '💠';
                if (id === 'apple') emojiOpt = ui.getEmoji('apple');
                if (id === 'mineral_water') emojiOpt = ui.getEmoji('mineral_water');
                
                return new StringSelectMenuOptionBuilder()
                    .setLabel(`${it.name} (x${it.count})`)
                    .setEmoji(emojiOpt !== '💠' ? emojiOpt : '🍲')
                    .setValue(id);
            }));

        const menuEmbed = new EmbedBuilder()
            .setTitle(`🎒 Bekal Survival`)
            .setColor(ui.getColor('dark'))
            .setDescription(`Pilih makanan, minuman, atau obat yang ingin kamu gunakan dari tasmu.`);

        const response = await interaction.reply({ 
            embeds: [menuEmbed], 
            components: [new ActionRowBuilder().addComponents(selectMenu)], 
            ephemeral: true 
        });
        
        const collector = response.createMessageComponentCollector({ filter: i => i.user.id === user.id, time: 30000, max: 1 });

        collector.on('collect', async i => {
            await i.deferUpdate();
            const selId = i.values[0];
            const itemConf = itemsConfig.find(it => it.id === selId);
            
            const newHunger = Math.min(100, survival.hunger + (itemConf.effects?.hunger || 0));
            const newThirst = Math.min(100, survival.thirst + (itemConf.effects?.thirst || 0));
            const newStamina = Math.min(100, survival.stamina + (itemConf.effects?.stamina || 0));
            
            const level = survival.survival_level || 1;
            const maxStat = leveling.getMaxStatCap(level);
            const activeStrength = Math.min(survival.strength || 1, maxStat);
            const maxPlayerHP = 100 + (Math.floor(level / 5) * 10) + (activeStrength * 10);
            
            let newHP = survival.hp !== undefined ? survival.hp : maxPlayerHP;
            if (itemConf.effects?.hp) {
                newHP = Math.min(maxPlayerHP, newHP + itemConf.effects.hp);
            }

            await UserSurvival.update({ 
                hp: newHP,
                hunger: newHunger, 
                thirst: newThirst,
                stamina: newStamina
            }, { where: { userId: user.id } });
            
            const idx = currentInv.findIndex(inv => inv.id === selId);
            if (idx > -1) { 
                currentInv.splice(idx, 1); 
                await UserProfile.update({ inventory: currentInv }, { where: { userId: user.id } }); 
            }

            await leveling.addPlayerXP(user.id, 1);

            const successEmbed = new EmbedBuilder()
                .setTitle(`${ui.getEmoji('success')} Item Digunakan`)
                .setColor(ui.getColor('success'))
                .setDescription(`Kamu mengonsumsi **${itemConf.name}**!\n\n**Perubahan Status:**\n> ${ui.getEmoji('hunger')} Lapar: ➡️ **${newHunger}**\n> ${ui.getEmoji('thirst')} Haus: ➡️ **${newThirst}**\n> ⚡ Stamina: ➡️ **${newStamina}**${itemConf.effects?.hp ? `\n> ${ui.getEmoji('health')} HP: Pulih +**${itemConf.effects.hp}**` : ''}\n\n🌟 *(+1 XP)*`);

            await i.editReply({ embeds: [successEmbed], components: [] });
        });
        
        collector.on('end', c => {
            if (c.size === 0) interaction.editReply({ embeds: [errEmbed('Batal makan, kamu terlalu lama memilih.')], components: [] }).catch(()=>{});
        });
    }
};