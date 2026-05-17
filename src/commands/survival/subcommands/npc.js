// Lokasi: src/commands/survival/subcommands/npc.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const UserProfile = require('../../../models/UserProfile');
const UserNPC = require('../../../models/UserNPC');
const itemsConfig = require('../../../config/items');
const ui = require('../../../config/ui');
const leveling = require('../../../utils/survivalLeveling'); 

module.exports = {
    async execute(interaction, client) {
        const user = interaction.user;
        const lokasi = interaction.options.getString('lokasi');
        const profile = await UserProfile.findOne({ where: { userId: user.id } });
        
        const errEmbed = (msg) => new EmbedBuilder().setColor(ui.getColor('error')).setDescription(`${ui.getEmoji('error')} ${msg}`);
        const successEmbed = (msg) => new EmbedBuilder().setColor(ui.getColor('success')).setDescription(`${ui.getEmoji('success')} ${msg}`);

        const npcsData = {
            lucy: { name: 'Mayor Lucy', fixedLoc: 'kota', type: 'friend', likes: ['diamond', 'apple'], dislikes: ['trash'], emoji: '👩', desc: '"Halo! Selamat datang di kota Naura."' },
            john: { name: 'Blacksmith John', fixedLoc: 'tambang', type: 'friend', likes: ['iron_ore', 'stone', 'wood'], dislikes: ['fiber'], emoji: '⚒️', desc: '"Baja yang bagus butuh api yang panas!"' },
            bob: { name: 'Pemulung Bob', fixedLoc: null, type: 'friend', likes: ['trash', 'mineral_water'], dislikes: ['diamond'], emoji: '🗑️', desc: '"Rongsokan adalah harta karun bagiku!"' },
            anya: { name: 'Anya', fixedLoc: null, locChance: 'hutan', type: 'candidate', likes: ['mystic_herb', 'apple'], dislikes: ['trash', 'iron_ore'], emoji: '🌿', desc: '"Oh, halo... Apakah kamu juga sedang mencari tanaman obat?"' },
            victoria: { name: 'Victoria', fixedLoc: 'kota', type: 'candidate', likes: ['diamond'], dislikes: ['trash', 'wood', 'stone'], emoji: '💎', desc: '"Hmph. Pastikan kau tidak mengotori gaunku dengan tanganmu itu."' },
            marina: { name: 'Marina', fixedLoc: null, locChance: 'laut', type: 'candidate', likes: ['salmon', 'small_fish'], dislikes: ['trash'], emoji: '🌊', desc: '"Hei! Angin laut hari ini sangat sejuk, kan?"' },
            kira: { name: 'Kira', fixedLoc: 'tambang', type: 'candidate', likes: ['iron_ore', 'stone', 'mineral_water'], dislikes: ['fiber', 'mystic_herb'], emoji: '⛏️', desc: '"Ayo! Jangan cuma diam, batu-batu ini nggak akan hancur sendiri!"' }
        };

        let presentNPCs = [];
        for (const [id, npc] of Object.entries(npcsData)) {
            if (npc.fixedLoc === lokasi) { presentNPCs.push(id); } 
            else if (!npc.fixedLoc) {
                if (npc.locChance === lokasi && Math.random() <= 0.60) { presentNPCs.push(id); } 
                else if (Math.random() <= 0.15) { presentNPCs.push(id); }
            }
        }

        if (presentNPCs.length === 0) {
            return interaction.reply({ embeds: [errEmbed(`Kamu melihat sekeliling **${lokasi}**... Sepi sekali. Tidak ada siapa-siapa di sini.`)], ephemeral: true });
        }

        const npcSelect = new StringSelectMenuBuilder()
            .setCustomId('select_npc')
            .setPlaceholder('Siapa yang ingin kamu hampiri?')
            .addOptions(presentNPCs.map(id => new StringSelectMenuOptionBuilder().setLabel(npcsData[id].name).setEmoji(npcsData[id].emoji).setDescription('Berada di dekatmu saat ini.').setValue(id)));

        const searchEmbed = new EmbedBuilder()
            .setColor(ui.getColor('primary'))
            .setDescription(`📍 **Lokasi: ${lokasi.toUpperCase()}**\nKamu melihat beberapa orang di sekitarmu.`);

        const response = await interaction.reply({ embeds: [searchEmbed], components: [new ActionRowBuilder().addComponents(npcSelect)] });
        const collector = response.createMessageComponentCollector({ filter: i => i.user.id === user.id, time: 60000 });
        let currentNpcId = null; 

        collector.on('collect', async i => {
            await i.deferUpdate();
            
            if (i.customId === 'select_npc') {
                currentNpcId = i.values[0];
                const npc = npcsData[currentNpcId];
                const [npcRelation] = await UserNPC.findOrCreate({ where: { userId: user.id, npcId: currentNpcId } });
                const userWife = await UserNPC.findOne({ where: { userId: user.id, isMarried: true } });
                const hasWife = !!userWife;
                let relSymbol = '⭐', maxLvl = 5;
                
                if (npc.type === 'candidate') {
                    if (hasWife && userWife.npcId === currentNpcId) { relSymbol = '❤️'; maxLvl = 7; } 
                    else if (!hasWife) { relSymbol = '❤️'; }
                }

                const currentLvl = Math.min(maxLvl, Math.floor(npcRelation.relationshipLevel / 20));
                const displaySymbol = relSymbol.repeat(currentLvl) + '⬛'.repeat(maxLvl - currentLvl);

                const rowButtons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('npc_talk').setLabel('Ngobrol').setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder().setCustomId('npc_gift').setLabel('Beri Hadiah').setStyle(ButtonStyle.Success)
                );

                if (currentLvl >= 5 && npc.type === 'candidate' && !hasWife) rowButtons.addComponents(new ButtonBuilder().setCustomId('npc_propose').setLabel('Lamar').setStyle(ButtonStyle.Danger).setEmoji('💍'));

                const npcEmbed = new EmbedBuilder()
                    .setTitle(`${npc.emoji} Berbicara dengan ${npc.name}`)
                    .setDescription(`*${npc.desc}*\n\n**Kedekatan:** ${displaySymbol} (${npcRelation.relationshipLevel} Poin)`)
                    .setColor(relSymbol === '❤️' ? ui.getColor('accent') : ui.getColor('primary'));
                
                await i.editReply({ embeds: [npcEmbed], components: [rowButtons] });
            }

            if (i.customId === 'npc_gift') {
                const currentInv = profile.inventory || [];
                const userItems = {};
                currentInv.forEach(item => { if (!userItems[item.id]) userItems[item.id] = { id: item.id, name: item.name, count: 1 }; else userItems[item.id].count += 1; });
                
                const itemKeys = Object.keys(userItems);
                if (itemKeys.length === 0) return i.followUp({ embeds: [errEmbed('Tas kamu kosong!')], ephemeral: true });

                const giftSelect = new StringSelectMenuBuilder().setCustomId('select_gift').setPlaceholder('Pilih barang dari tasmu...')
                    .addOptions(itemKeys.slice(0, 25).map(id => new StringSelectMenuOptionBuilder().setLabel(`${userItems[id].name} (x${userItems[id].count})`).setValue(id)));

                const giftPrompt = new EmbedBuilder().setColor(ui.getColor('accent')).setDescription(`🎁 **Pilih Hadiah untuk ${npcsData[currentNpcId].name}**`);
                await i.editReply({ embeds: [giftPrompt], components: [new ActionRowBuilder().addComponents(giftSelect)] });
            }

            if (i.customId === 'select_gift') {
                const itemId = i.values[0];
                const npc = npcsData[currentNpcId];
                const currentInv = profile.inventory || [];
                const itemData = itemsConfig.find(it => it.id === itemId);

                const itemIndex = currentInv.findIndex(invItem => invItem.id === itemId);
                currentInv.splice(itemIndex, 1);
                await UserProfile.update({ inventory: currentInv }, { where: { userId: user.id } });

                let addedAffection = 2; 
                if (npc.likes?.includes(itemId)) addedAffection = 10;
                if (npc.dislikes?.includes(itemId)) addedAffection = -5; 
                
                const [npcRelation] = await UserNPC.findOrCreate({ where: { userId: user.id, npcId: currentNpcId } });
                const newRel = Math.max(0, Math.min(100, npcRelation.relationshipLevel + addedAffection)); 
                await UserNPC.update({ relationshipLevel: newRel }, { where: { userId: user.id, npcId: currentNpcId } });

                await leveling.addPlayerXP(user.id, 10);

                let responHadiah = `**${npc.name}:** "Oh... sebuah ${itemData.name}. Terima kasih." 🙂\n*(Afeksi +2) | (+10 XP)*`;
                if (addedAffection === 10) responHadiah = `**${npc.name}:** "Wah! ${itemData.name}?! Aku sangat menyukai ini, terima kasih banyak!" 🥰\n*(Afeksi +10) | (+10 XP)*`;
                else if (addedAffection === -5) responHadiah = `**${npc.name}:** "Eww... apa ini? Jauhkan ${itemData.name} itu dariku!" 😠\n*(Afeksi -5) | (+10 XP)*`;

                await i.editReply({ embeds: [successEmbed(responHadiah)], components: [] });
                collector.stop(); 
            }

            if (i.customId === 'npc_talk') {
                const [npcRelation] = await UserNPC.findOrCreate({ where: { userId: user.id, npcId: currentNpcId } });
                const newRel = Math.min(100, npcRelation.relationshipLevel + 1);
                await UserNPC.update({ relationshipLevel: newRel }, { where: { userId: user.id, npcId: currentNpcId } });
                
                await leveling.addPlayerXP(user.id, 2);

                await i.editReply({ embeds: [successEmbed(`**${npcsData[currentNpcId].name}:** "Senang bisa mengobrol denganmu hari ini!"\n*(Afeksi +1) | (+2 XP)*`)], components: [] });
                collector.stop();
            }
        });

        collector.on('end', collected => { 
            if (collected.size === 0) interaction.editReply({ embeds: [new EmbedBuilder().setColor(ui.getColor('dark')).setDescription('Kamu berlalu pergi...')], components: [] }).catch(()=>{}); 
        });
    }
};