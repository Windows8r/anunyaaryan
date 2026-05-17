const { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, Collection, AuditLogEvent } = require('discord.js');
const UserLeveling = require('../models/UserLeveling');
const GuildSettings = require('../models/GuildSettings');
const ui = require('../config/ui');

const voiceSessions = new Collection(); 

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState, client) {
        const { member, guild } = newState;
        if (!member || member.user.bot) return;

        const userId = member.id;
        const guildId = guild.id;

        // ==========================================
        // 🛡️ SISTEM AUDIT LOG (KELUAR MASUK VOICE)
        // ==========================================
        try {
            const settings = await GuildSettings.findOne({ where: { guildId: guild.id } });
            const logChannelId = settings?.settings?.automod?.logChannelId;
            
            if (logChannelId) {
                const logChannel = guild.channels.cache.get(logChannelId);
                if (logChannel) {
                    
                    if (!oldState.channelId && newState.channelId) {
                        // 🟢 JOIN VOICE 
                        const embed = new EmbedBuilder()
                            .setColor(ui.getColor('success'))
                            .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
                            .setTitle(`${ui.getEmoji('online') || '🔊'} Terhubung ke Voice`)
                            .setDescription(`>>> <@${member.id}> telah bergabung ke dalam saluran suara.`)
                            .addFields(
                                { name: `${ui.getEmoji('lokasi')} Saluran Suara`, value: `<#${newState.channelId}>`, inline: true }
                            )
                            .setFooter({ text: `User ID: ${member.id}` })
                            .setTimestamp();
                        await logChannel.send({ embeds: [embed] }).catch(()=>{});
                        
                    } else if (oldState.channelId && !newState.channelId) {
                        // 🔴 LEAVE / DISCONNECT VOICE
                        const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberDisconnect }).catch(() => null);
                        const disconnectLog = fetchedLogs ? fetchedLogs.entries.first() : null;
                        
                        let executorTag = `Keluar Sendiri`;
                        if (disconnectLog && (Date.now() - disconnectLog.createdTimestamp < 5000)) {
                            executorTag = `Diputus oleh: ${disconnectLog.executor.globalName || disconnectLog.executor.username}`;
                        }

                        const embed = new EmbedBuilder()
                            .setColor(ui.getColor('error'))
                            .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
                            .setTitle(`${ui.getEmoji('offline') || '🔇'} Keluar dari Voice`)
                            .setDescription(`>>> <@${member.id}> telah meninggalkan saluran suara.`)
                            .addFields(
                                { name: `${ui.getEmoji('lokasi')} Channel Terakhir`, value: `<#${oldState.channelId}>`, inline: true },
                                { name: `${ui.getEmoji('info')} Keterangan`, value: `\`${executorTag}\``, inline: true }
                            )
                            .setFooter({ text: `User ID: ${member.id}` })
                            .setTimestamp();
                        await logChannel.send({ embeds: [embed] }).catch(()=>{});

                    } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
                        // 🔄 MOVE VOICE (Pindah Channel)
                        const fetchedLogs = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberMove }).catch(() => null);
                        const moveLog = fetchedLogs ? fetchedLogs.entries.first() : null;
                        
                        let executorTag = `Pindah Sendiri`;
                        if (moveLog && (Date.now() - moveLog.createdTimestamp < 5000)) {
                            executorTag = `Dipindah oleh: ${moveLog.executor.globalName || moveLog.executor.username}`;
                        }

                        const embed = new EmbedBuilder()
                            .setColor(ui.getColor('primary'))
                            .setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
                            .setTitle(`${ui.getEmoji('move') || '🔄'} Pindah Channel Voice`)
                            .setDescription(`>>> <@${member.id}> berpindah saluran suara.`)
                            .addFields(
                                { name: `${ui.getEmoji('lokasi')} Dari`, value: `<#${oldState.channelId}>`, inline: true },
                                { name: `${ui.getEmoji('lokasi')} Ke`, value: `<#${newState.channelId}>`, inline: true },
                                { name: `${ui.getEmoji('info')} Keterangan`, value: `\`${executorTag}\``, inline: false }
                            )
                            .setFooter({ text: `User ID: ${member.id}` })
                            .setTimestamp();
                        await logChannel.send({ embeds: [embed] }).catch(()=>{});
                    }
                }
            }
        } catch (error) {
            console.error('[VOICE LOG ERROR]', error);
        }

        // ==========================================
        // 📈 SISTEM VOICE XP TRACKING
        // ==========================================
        if (!oldState.channelId && newState.channelId) {
            voiceSessions.set(`${guildId}-${userId}`, Date.now());
        }

        if (oldState.channelId && !newState.channelId) {
            const joinTime = voiceSessions.get(`${guildId}-${userId}`);
            if (joinTime) {
                const durationMinutes = Math.floor((Date.now() - joinTime) / 60000);
                if (durationMinutes >= 1) {
                    try {
                        const [profile] = await UserLeveling.findOrCreate({ where: { userId, guildId } });
                        profile.xp += (durationMinutes * 10);
                        profile.voiceMinutes += durationMinutes;
                        await profile.save();
                    } catch (err) {}
                }
                voiceSessions.delete(`${guildId}-${userId}`);
            }
        }

        // ==========================================
        // 🎛️ SISTEM TEMP VOICE (PRIVATE ROOM)
        // ==========================================
        let tempConfig = null;
        try {
            const settings = await GuildSettings.findOne({ where: { guildId } });
            if (settings && settings.settings) {
                tempConfig = settings.settings.tempVoice || settings.settings.tempvoice;
            }
        } catch (error) {}

        if (!tempConfig || !tempConfig.enabled || !tempConfig.triggerChannelId) return;

        // LOGIKA A: PEMBUATAN RUANGAN BARU
        if (newState.channelId === tempConfig.triggerChannelId) {
            try {
                const triggerChannel = newState.channel;
                const tempChannel = await guild.channels.create({
                    name: `💠 ${member.user.username}'s Room`,
                    type: ChannelType.GuildVoice,
                    parent: tempConfig.categoryId || triggerChannel.parentId,
                    permissionOverwrites: [
                        {
                            id: guild.id,
                            allow: [PermissionFlagsBits.Connect],
                        },
                        {
                            id: userId,
                            allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MuteMembers, PermissionFlagsBits.DeafenMembers, PermissionFlagsBits.MoveMembers],
                        },
                        {
                            id: client.user.id,
                            allow: [PermissionFlagsBits.Connect],
                        }
                    ],
                });

                await member.voice.setChannel(tempChannel);

            } catch (error) {
                console.error('\x1b[31m[VOICE ERROR]\x1b[0m Gagal memproses TempVoice:', error);
            }
        }

        // LOGIKA B: PENGHAPUSAN RUANGAN KOSONG
        if (oldState.channelId) {
            const oldChannel = oldState.channel;
            
            if (oldChannel && oldChannel.parentId === tempConfig.categoryId && oldChannel.id !== tempConfig.triggerChannelId) {
                if (oldChannel.members.size === 0) {
                    const waitingRoomName = `⏳ Wait - ${oldChannel.name.replace('💠 ', '').replace("'s Room", "")}`;
                    const waitingRoom = oldChannel.guild.channels.cache.find(c => c.name === waitingRoomName && c.parentId === tempConfig.categoryId);
                    
                    await oldChannel.delete().catch(() => {});
                    
                    if (waitingRoom && waitingRoom.members.size === 0) {
                        await waitingRoom.delete().catch(() => {});
                    }
                }
            }
        }
    }
};