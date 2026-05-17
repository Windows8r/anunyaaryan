// Lokasi: src/commands/survival/subcommands/info.js
const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const UserProfile = require('../../../models/UserProfile'); 
const UserSurvival = require('../../../models/UserSurvival');
const UserPet = require('../../../models/UserPet');
const UserNPC = require('../../../models/UserNPC');
const ui = require('../../../config/ui');
const { getTimeState } = require('../../../utils/survivalTime');
const { generateSurvivalProfileImage } = require('../../../utils/CanvasUtils'); 
const leveling = require('../../../utils/survivalLeveling'); 

module.exports = {
    async execute(interaction) {
        const user = interaction.user;
        const client = interaction.client;
        
        await interaction.deferReply();

        const errEmbed = (msg) => new EmbedBuilder().setColor(ui.getColor('error')).setDescription(`${ui.getEmoji('error')} ${msg}`);

        try {
            const [
                [profile], 
                [survival], 
                activePets, 
                marriedNPCs
            ] = await Promise.all([
                UserProfile.findOrCreate({ where: { userId: user.id } }),
                UserSurvival.findOrCreate({ where: { userId: user.id } }),
                UserPet.findAll({ where: { userId: user.id, isActive: true } }),
                UserNPC.findAll({ where: { userId: user.id, isMarried: true } })
            ]);

            // --- DATA LEVELING ---
            let currentLevel = parseInt(survival.survival_level) || 1;
            let currentXP = parseInt(survival.survival_xp) || 0;
            let reqXP = leveling.getExpRequirement(currentLevel);

            // ✨ SISTEM AUTO-HEAL: Jika ada bug XP menumpuk, langsung perbaiki!
            if (currentXP >= reqXP) {
                const fixedStats = await leveling.addPlayerXP(user.id, 0);
                currentLevel = fixedStats.currentLevel;
                currentXP = fixedStats.currentXP;
                reqXP = fixedStats.reqXP;
                
                // Update variabel lokal agar gambar Canvas merender data yang sudah diperbaiki
                survival.survival_level = currentLevel;
                survival.survival_xp = currentXP;
            }

            const maxStat = leveling.getMaxStatCap(currentLevel);
            const xpBar = ui.createProgressBar(currentXP, reqXP, 8);

            const activeStrength = Math.min(survival.strength || 1, maxStat);
            const maxPlayerHP = 100 + (Math.floor(currentLevel / 5) * 10) + (activeStrength * 10);
            const playerHP = survival.hp !== undefined ? survival.hp : maxPlayerHP;

            const hpBar = ui.createProgressBar(playerHP, maxPlayerHP, 8);
            const hungerBar = ui.createProgressBar(survival.hunger || 0, 100, 8);
            const thirstBar = ui.createProgressBar(survival.thirst || 0, 100, 8);
            const staminaBar = ui.createProgressBar(survival.stamina || 0, 100, 8);

            let bonusStrength = 0;
            let bonusLuck = 0;
            let petDisplay = 'Belum punya Pet aktif';
            let petCanvasDisplay = 'Belum punya Pet aktif';

            if (activePets.length > 0) {
                const myPet = activePets[0];
                petCanvasDisplay = myPet.petName || myPet.petType; 
                petDisplay = `${ui.getEmoji('pet')} **${petCanvasDisplay}**`; 
                
                if (myPet.petType === 'wolf') { 
                    bonusStrength += 2; 
                    petDisplay += `\n> *Efek: +2 Strength*`; 
                } else if (myPet.petType === 'cat') { 
                    bonusLuck += 2; 
                    petDisplay += `\n> *Efek: +2 Luck*`; 
                }
            }
                
            const partnerCanvasDisplay = marriedNPCs.length > 0 ? marriedNPCs[0].npcId : 'Single';
            const partnerDisplay = marriedNPCs.length > 0 ? `${ui.getEmoji('npc')} **${partnerCanvasDisplay}**` : 'Single';

            const currentLocation = profile.location || profile.lokasi || 'Belum Terdeteksi'; 
            const properties = { 'jalanan': 'Pinggir Jalan', 'gudang': 'Gudang Tua', 'kos': 'Kos-kosan', 'rumah': 'Rumah Nyaman' };
            const myPropName = properties[survival.propertyId] || 'Pinggir Jalan';

            const timeState = getTimeState(survival.inGameHour || 6);
            const timeString = `${timeState.emoji} **Hari ke-${survival.inGameDay || 1}** | Jam ${(survival.inGameHour || 6).toString().padStart(2, '0')}:00 (${timeState.label})`;

            const imageBuffer = await generateSurvivalProfileImage(user, profile, survival, ui);
            const canvasAttachment = new AttachmentBuilder(imageBuffer, { name: 'naura-survival.png' });

            const infoEmbed = new EmbedBuilder()
                .setAuthor({ name: `Survival Info: ${user.displayName}`, iconURL: user.displayAvatarURL() })
                .setColor(timeState.color)
                .setDescription(
                    `**${ui.getEmoji('clock')} Waktu Lokal:**\n${timeString}\n\n` +
                    `**${ui.getEmoji('lokasi')} Lokasi:** ${currentLocation} | **${ui.getEmoji('property')} Tempat:** ${myPropName}\n\n` +
                    `**${ui.getEmoji('health')} Status Fisik:**\n` +
                    `${ui.getEmoji('health')} **HP:** ${playerHP}/${maxPlayerHP}\n${hpBar}\n` +
                    `${ui.getEmoji('hunger')} **Lapar:** ${survival.hunger || 0}/100\n${hungerBar}\n` +
                    `${ui.getEmoji('thirst')} **Haus:** ${survival.thirst || 0}/100\n${thirstBar}\n` +
                    `⚡ **Stamina:** ${survival.stamina || 0}/100\n${staminaBar}`
                )
                .addFields(
                    { 
                        name: `⭐ Progres Level (Lv. ${currentLevel})`, 
                        value: `> **XP:** ${currentXP} / ${reqXP}\n> ${xpBar}`, 
                        inline: false 
                    },
                    { 
                        name: `${ui.getEmoji('stats')} Stats RPG (Maks: ${maxStat})`, 
                        value: `> ${ui.getEmoji('strength')} STR: **${survival.strength || 1}** (+${bonusStrength})\n> ${ui.getEmoji('agility')} AGI: **${survival.agility || 1}**\n> ${ui.getEmoji('intelligence')} INT: **${survival.intelligence || 1}**\n> ${ui.getEmoji('luck')} LUK: **${survival.luck || 1}** (+${bonusLuck})`, 
                        inline: true 
                    },
                    { 
                        name: `${ui.getEmoji('favorite')} Relasi`, 
                        value: `> **Pet:** ${petDisplay}\n> **Pasangan:** ${partnerDisplay}`, 
                        inline: true 
                    }
                )
                .setImage('attachment://naura-survival.png') 
                .setFooter({ text: 'Naura Survival Systems', iconURL: client.user.displayAvatarURL() });

            return interaction.editReply({ embeds: [infoEmbed], files: [canvasAttachment] });
            
        } catch (error) {
            console.error('[SURVIVAL INFO ERROR]', error);
            return interaction.editReply({ embeds: [errEmbed('Terjadi kesalahan sistem saat memuat profil survival kamu.')] });
        }
    }
};