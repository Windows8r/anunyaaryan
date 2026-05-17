// Lokasi: src/commands/survival/subcommands/dungeon.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const UserProfile = require('../../../models/UserProfile');
const UserSurvival = require('../../../models/UserSurvival');
const itemsConfig = require('../../../config/items');
const ui = require('../../../config/ui');
const { advanceTime } = require('../../../utils/survivalTime');
const leveling = require('../../../utils/survivalLeveling');

module.exports = {
    async execute(interaction, client) {
        const user = interaction.user;
        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });
        const profile = await UserProfile.findOne({ where: { userId: user.id } });
        const currentInv = profile.inventory || [];

        const errEmbed = (msg) => new EmbedBuilder().setColor(ui.getColor('error')).setDescription(`${ui.getEmoji('error')} ${msg}`);

        if (survival.hunger <= 30 || survival.thirst <= 30) {
            return interaction.reply({ embeds: [errEmbed('Kamu terlalu lemas untuk bertarung! Pulihkan energi minimal 30.')], flags: MessageFlags.Ephemeral });
        }

        // Minimum 20 HP requirement
        if (survival.hp !== undefined && survival.hp < 20) {
            return interaction.reply({ embeds: [errEmbed('Darahmu terlalu rendah (Di bawah 20 HP)! Beli perban/obat di toko untuk memulihkan nyawa.')], flags: MessageFlags.Ephemeral });
        }

        // SISTEM STAT CAP BERDASARKAN LEVEL
        const maxStat = leveling.getMaxStatCap(survival.level || 1);
        const activeAgility = Math.min(survival.agility || 1, maxStat);
        const activeStrength = Math.min(survival.strength || 1, maxStat);

        const level = survival.survival_level || 1;
        const maxPlayerHP = 100 + (Math.floor(level / 5) * 10) + (activeStrength * 10);
        let playerHP = survival.hp !== undefined ? survival.hp : maxPlayerHP;
        
        let playerBaseDmg = activeStrength * 5;
        let weaponMsg = '(Tangan Kosong)';

        // ✨ PENAMBAHAN BARU: Pengecekan jenis pedang yang ada di tas
        const hasDiamondSword = currentInv.some(item => item?.id === 'diamond_sword');
        const hasIronSword = currentInv.some(item => item?.id === 'iron_sword');
        const hasOldSword = currentInv.some(item => item?.id === 'old_sword');

        if (hasDiamondSword) {
            playerBaseDmg += 50;
            weaponMsg = '(+Pedang Berlian)';
        } else if (hasIronSword) {
            playerBaseDmg += 20;
            weaponMsg = '(+Pedang Besi)';
        } else if (hasOldSword) {
            playerBaseDmg += 5;
            weaponMsg = '(+Pedang Tua)';
        }

        const monsters = [
            { name: 'Slime Hijau', emoji: '🟢', hp: 50, dmg: 10, drop: 'slime_gel', dropName: 'Gel Slime', xp: 15 },
            { name: 'Goblin Pencuri', emoji: '👺', hp: 100, dmg: 20, drop: 'goblin_ear', dropName: 'Telinga Goblin', xp: 30 },
            { name: 'Naga Kegelapan', emoji: '🐉', hp: 300, dmg: 40, drop: 'dragon_scale', dropName: 'Sisik Naga', xp: 100 }
        ];
        
        const isBoss = Math.random() < 0.1;
        const enemyTemplate = isBoss ? monsters[2] : monsters[Math.floor(Math.random() * 2)];
        const enemy = Object.assign({}, enemyTemplate); 

        const getBattleEmbed = (msg) => {
            const pBar = ui.createProgressBar(Math.max(0, playerHP), maxPlayerHP, 8);
            const eBar = ui.createProgressBar(Math.max(0, enemy.hp), enemyTemplate.hp, 8);
            return new EmbedBuilder()
                .setTitle(`⚔️ BATTLE: VS ${enemy.name}`)
                .setColor(ui.getColor('battle'))
                .setDescription(`**📜 Log:**\n> ${msg}\n\n**Player (Lv. ${survival.level || 1})**\n${ui.getEmoji('health')} HP: ${playerHP}/${maxPlayerHP}\n${pBar}\n${ui.getEmoji('strength')} DMG: ${playerBaseDmg} ${weaponMsg}\n\n**${enemy.emoji} ${enemy.name}**\n${ui.getEmoji('health')} HP: ${Math.max(0, enemy.hp)}/${enemyTemplate.hp}\n${eBar}`);
        };

        const rowActions = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_attack').setLabel('Serang!').setStyle(ButtonStyle.Danger).setEmoji('⚔️'),
            new ButtonBuilder().setCustomId('btn_flee').setLabel('Kabur').setStyle(ButtonStyle.Secondary).setEmoji('🏃')
        );

        const response = await interaction.reply({ embeds: [getBattleEmbed('Seekor monster melompat ke arahmu! Bersiaplah!')], components: [rowActions] });
        const collector = response.createMessageComponentCollector({ filter: i => i.user.id === user.id, time: 60000 });

        collector.on('collect', async i => {
            if (i.customId === 'btn_flee') {
                await i.deferUpdate();
                await UserSurvival.update({ hunger: Math.max(0, survival.hunger - 10), thirst: Math.max(0, survival.thirst - 10) }, { where: { userId: user.id } });
                const fleeEmbed = new EmbedBuilder().setColor(ui.getColor('warning')).setDescription(`${ui.getEmoji('warning')} Kamu lari terbirit-birit dari Dungeon!`);
                await i.editReply({ embeds: [fleeEmbed], components: [] });
                return collector.stop();
            }

            if (i.customId === 'btn_attack') {
                let logMsg = "";
                const isCritOpportunity = Math.random() < 0.25; 

                const processEnemyTurn = async (pDmg, attackMsg) => {
                    enemy.hp -= pDmg;
                    logMsg += attackMsg;

                    if (enemy.hp <= 0) {
                        currentInv.push({ id: enemy.drop, name: enemy.dropName });
                        await UserProfile.update({ inventory: currentInv }, { where: { userId: user.id } });
                        await UserSurvival.update({ hp: playerHP, hunger: Math.max(0, survival.hunger - 15), thirst: Math.max(0, survival.thirst - 15) }, { where: { userId: user.id } });
                        await advanceTime(user.id, 1);
                        
                        const xpData = await leveling.addPlayerXP(user.id, enemy.xp);
                        
                        let winDesc = `🎉 **VICTORY!** Kamu mengalahkan **${enemy.name}**!\n🎁 Mendapatkan **${enemy.dropName}** & **${enemy.xp} XP**!`;
                        if (xpData.hasLeveledUp) winDesc += `\n\n🌟 **LEVEL UP!** Kamu naik ke **Level ${xpData.currentLevel}**!\nBatas Maksimal Statusmu kini meningkat menjadi **${xpData.maxStatCap} Poin**.`;

                        const winEmbed = new EmbedBuilder().setColor(ui.getColor('success')).setDescription(winDesc);
                        if (interaction.channel) await interaction.channel.send({ content: `<@${user.id}>`, embeds: [winEmbed] });
                        
                        await i.message.edit({ embeds: [getBattleEmbed(logMsg)], components: [] });
                        return collector.stop();
                    }

                    const isDodge = Math.random() < (activeAgility * 0.05);
                    if (isDodge) {
                        logMsg += `💨 Kamu berhasil **MENGHINDAR** dari serangan ${enemy.name}!\n`;
                    } else {
                        let eDmg = enemy.dmg + Math.floor(Math.random() * 5);
                        playerHP -= eDmg;
                        logMsg += `🩸 ${enemy.name} membalas dan memberikanmu ${eDmg} damage!\n`;
                    }

                    if (playerHP <= 0) {
                        let currentBal = profile.economy_wallet || 0; 
                        const penalty = Math.floor(currentBal * 0.1);
                        await UserProfile.update({ economy_wallet: currentBal - penalty }, { where: { userId: user.id } }); 
                        await UserSurvival.update({ hp: 10, hunger: 10, thirst: 10 }, { where: { userId: user.id } });
                        await advanceTime(user.id, 5);
                        
                        const loseEmbed = new EmbedBuilder().setColor(ui.getColor('error')).setDescription(`💀 **DEFEAT!** Pingsan! Tim medis memotong **${penalty.toLocaleString('id-ID')} NC** dari dompetmu untuk perawatan...`);
                        if (interaction.channel) await interaction.channel.send({ content: `<@${user.id}>`, embeds: [loseEmbed] });
                        
                        await i.message.edit({ embeds: [getBattleEmbed(logMsg)], components: [] });
                        return collector.stop();
                    }

                    if (playerHP > 0 && enemy.hp > 0) {
                        await UserSurvival.update({ hp: playerHP }, { where: { userId: user.id } });
                    }
                    await i.message.edit({ embeds: [getBattleEmbed(logMsg)], components: [rowActions] });
                };

                if (isCritOpportunity && interaction.channel) {
                    await i.deferUpdate();
                    const words = ['SERANG', 'BIDIK', 'LOMPAT', 'TEBAS'];
                    const qteWord = words[Math.floor(Math.random() * words.length)];

                    const qtePrompt = new EmbedBuilder().setColor(ui.getColor('warning')).setDescription(`⚡ **MOMEN KRITIS!** Cepat ketik **${qteWord}** di chat untuk Double Damage! (5 Detik)`);
                    await i.editReply({ embeds: [qtePrompt], components: [] });

                    const qteColl = interaction.channel.createMessageCollector({ filter: m => m.author.id === user.id, time: 5000, max: 1 });
                    qteColl.on('collect', async m => {
                        if (m.content.toUpperCase() === qteWord) {
                            let pDmg = (playerBaseDmg + Math.floor(Math.random() * 10)) * 2;
                            await processEnemyTurn(pDmg, `💥 **PERFECT!** Kamu menebas titik lemah musuh dengan **${pDmg} DMG**!\n`);
                        } else {
                            await processEnemyTurn(0, `❌ **MISS!** Jarimu terpeleset dan seranganmu meleset!\n`);
                        }
                    });
                    qteColl.on('end', async collected => {
                        if (collected.size === 0) await processEnemyTurn(0, `⏱️ **LAMBAT!** Serangan dihindari musuh!\n`);
                    });
                } else {
                    await i.deferUpdate();
                    let pDmg = playerBaseDmg + Math.floor(Math.random() * 10);
                    await processEnemyTurn(pDmg, `Kamu menyerang musuh dan memberikan **${pDmg} DMG**.\n`);
                }
            }
        });
    }
};