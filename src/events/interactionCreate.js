const { EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionFlagsBits, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const GuildSettings = require('../models/GuildSettings');
const ModMail = require('../models/ModMail');
const env = require('../config/env');
const ui = require('../config/ui');
const redisManager = require('../managers/redisManager');

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        
        if (client.maintenanceMode && !env.OWNER_IDS.includes(interaction.user.id)) {
            return interaction.reply({ content: `${ui.getEmoji('error')} **Maintenance Mode Aktif:** Naura sedang diperbaiki.`, ephemeral: true });
        }

        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            
            if (process.env.REDIS_URL && redisManager.client.isReady) {
                const cooldownKey = `cooldown:${interaction.user.id}`;
                const onCooldown = await redisManager.getCache(cooldownKey);
                if (onCooldown && (!env.OWNER_IDS || !env.OWNER_IDS.includes(interaction.user.id))) {
                    return interaction.reply({ content: `${ui.getEmoji('clock')} **Cooldown:** Tunggu beberapa detik.`, ephemeral: true });
                }
                await redisManager.setCache(cooldownKey, { active: true }, 3);
            }
            try { await command.execute(interaction); } 
            catch (error) {
                const errEmbed = new EmbedBuilder().setColor(ui.getColor('error')).setDescription(`${ui.getEmoji('error')} Terjadi kesalahan internal!`);
                if (interaction.replied || interaction.deferred) await interaction.followUp({ embeds: [errEmbed], ephemeral: true }).catch(() => {});
                else await interaction.reply({ embeds: [errEmbed], ephemeral: true }).catch(() => {});
            }
            return;
        }

        if ((interaction.isButton() || interaction.isStringSelectMenu()) && interaction.customId.startsWith('music_')) {
            const handleMusicButtons = require('./interactions/musicButtons');
            return handleMusicButtons(interaction, client);
        }

        if (interaction.isButton()) {
            // ==========================================
            // 📩 MODMAIL: LOGIKA TOMBOL BALAS & TUTUP
            // ==========================================
            if (interaction.customId === 'mm_reply' || interaction.customId === 'mm_reply_anon') {
                const modal = new ModalBuilder()
                    .setCustomId(interaction.customId === 'mm_reply' ? 'mm_modal_reply' : 'mm_modal_anon')
                    .setTitle(interaction.customId === 'mm_reply' ? 'Balas Pesan User' : 'Balas Pesan (Anonim)');
                const input = new TextInputBuilder().setCustomId('mm_text_input').setLabel('Tulis balasanmu di sini:').setStyle(TextInputStyle.Paragraph).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(input));
                return await interaction.showModal(modal);
            }

            if (interaction.customId === 'mm_close') {
                const ticket = await ModMail.findOne({ where: { channelId: interaction.channelId, closed: false } });
                if (!ticket) return interaction.reply({ content: `${ui.getEmoji('error')} Tiket tidak ditemukan atau sudah ditutup.`, ephemeral: true });

                ticket.closed = true;
                await ticket.save();
                
                await interaction.reply(`${ui.getEmoji('loading')} Mengumpulkan transcript pesan...`);
                
                const messages = await interaction.channel.messages.fetch({ limit: 100 });
                const transcript = messages.reverse().map(m => `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.embeds.length > 0 ? '(Embed/Attachment)' : m.content}`).join('\n');
                
                const { AttachmentBuilder } = require('discord.js');
                const buffer = Buffer.from(transcript, 'utf-8');
                const attachment = new AttachmentBuilder(buffer, { name: `transcript-${interaction.channel.name}.txt` });

                const user = await client.users.fetch(ticket.userId).catch(() => null);
                if (user) await user.send({ embeds: [new EmbedBuilder().setColor('#FFB6C1').setTitle(`${ui.getEmoji('lock')} Sesi Berakhir`).setDescription(`Percakapanmu dengan Staf server **${interaction.guild.name}** telah ditutup.`)] }).catch(()=>{});

                const guildData = await GuildSettings.findOne({ where: { guildId: interaction.guild.id } });
                if (guildData && guildData.settings?.modmail?.categoryId) {
                    const logEmbed = new EmbedBuilder().setColor('#FFB6C1').setTitle('📄 Modmail Transcript Log').setDescription(`Tiket dari <@${ticket.userId}> ditutup oleh <@${interaction.user.id}>.`);
                    const catChannel = interaction.guild.channels.cache.get(guildData.settings.modmail.categoryId);
                    if (catChannel) {
                        await interaction.channel.send({ content: `Mengirim log ke kategori...`, files: [attachment] });
                        // Coba cari channel "modmail-logs" atau kirim ke kategori jika channel tidak ditemukan
                        const logChannel = interaction.guild.channels.cache.find(c => c.name.includes('log') && c.parentId === catChannel.id);
                        if (logChannel) await logChannel.send({ embeds: [logEmbed], files: [attachment] }).catch(()=>{});
                    }
                }

                await interaction.editReply(`${ui.getEmoji('success')} Tiket ditutup dan transcript disimpan! Merapikan channel dalam 5 detik...`);
                setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
                return;
            }

            // (Fitur Button Roles, Ticket & TempVoice tetap sama utuh di bawah ini)
            if (interaction.customId.startsWith('role_assign_')) {
                const roleId = interaction.customId.replace('role_assign_', '');
                const role = interaction.guild.roles.cache.get(roleId);
                if (!role) return interaction.reply({ content: '❌ Role tidak ditemukan.', ephemeral: true });
                try {
                    if (interaction.member.roles.cache.has(roleId)) {
                        await interaction.member.roles.remove(roleId);
                        return interaction.reply({ content: `✅ Berhasil **mencopot** <@&${roleId}>.`, ephemeral: true });
                    } else {
                        await interaction.member.roles.add(roleId);
                        return interaction.reply({ content: `✅ Berhasil **mengambil** <@&${roleId}>!`, ephemeral: true });
                    }
                } catch (error) { return interaction.reply({ content: '❌ Gagal memberikan role.', ephemeral: true }); }
            }

            if (interaction.customId === 'ticket_create') {
                const guildData = await GuildSettings.findOne({ where: { guildId: interaction.guild.id } });
                if (!guildData || !guildData.settings?.ticket?.categoryId) return interaction.reply({ content: '❌ Sistem tiket belum dikonfigurasi.', ephemeral: true });
                const existingTicket = interaction.guild.channels.cache.find(c => c.name === `ticket-${interaction.user.username.toLowerCase()}`);
                if (existingTicket) return interaction.reply({ content: `❌ Tiket sudah aktif di <#${existingTicket.id}>!`, ephemeral: true });

                const supportRoleId = guildData.settings.ticket.supportRoleId;
                const ticketChannel = await interaction.guild.channels.create({
                    name: `ticket-${interaction.user.username}`, type: ChannelType.GuildText, parent: guildData.settings.ticket.categoryId,
                    permissionOverwrites: [
                        { id: interaction.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                        { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                        { id: supportRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                        { id: interaction.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
                    ]
                });
                const embedTicket = new EmbedBuilder().setColor(ui.getColor('primary')).setTitle('🎫 Tiket Bantuan').setDescription(`Halo <@${interaction.user.id}>!\nTim Support (<@&${supportRoleId}>) akan merespons.`);
                const actionRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket_close_confirm').setLabel('Tutup Tiket').setEmoji(ui.getEmoji('lock')).setStyle(ButtonStyle.Danger));
                await ticketChannel.send({ content: `<@${interaction.user.id}> | <@&${supportRoleId}>`, embeds: [embedTicket], components: [actionRow] });
                return interaction.reply({ content: `✅ Tiket dibuat! Buka <#${ticketChannel.id}>`, ephemeral: true });
            }

            if (interaction.customId === 'ticket_close_confirm') {
                const embed = new EmbedBuilder().setColor(ui.getColor('error')).setDescription('Yakin ingin menutup tiket ini?');
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('ticket_close_execute').setLabel('Ya, Hapus').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('ticket_close_cancel').setLabel('Batal').setStyle(ButtonStyle.Secondary)
                );
                return interaction.reply({ embeds: [embed], components: [row] });
            }

            if (interaction.customId === 'ticket_close_execute') {
                await interaction.reply('🔒 *Menghapus tiket...*');
                setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
            }

            if (interaction.customId === 'ticket_close_cancel') await interaction.message.delete().catch(() => {});

            if (interaction.customId.startsWith('tvc_')) {
                const memberVoice = interaction.member.voice.channel;
                if (!memberVoice) return interaction.reply({ content: '❌ Harus di Voice Channel!', ephemeral: true });
                if (!memberVoice.permissionsFor(interaction.member).has(PermissionFlagsBits.ManageChannels) && !interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: '❌ Akses Ditolak.', ephemeral: true });
                try {
                    if (interaction.customId === 'tvc_lock') { await memberVoice.permissionOverwrites.edit(interaction.guild.id, { [PermissionFlagsBits.Connect]: false }); return interaction.reply({ content: '🔒 Ruangan dikunci.', ephemeral: true }); }
                    if (interaction.customId === 'tvc_unlock') { await memberVoice.permissionOverwrites.edit(interaction.guild.id, { [PermissionFlagsBits.Connect]: null }); return interaction.reply({ content: '🔓 Ruangan dibuka.', ephemeral: true }); }
                    if (interaction.customId === 'tvc_hide') { await memberVoice.permissionOverwrites.edit(interaction.guild.id, { [PermissionFlagsBits.ViewChannel]: false }); return interaction.reply({ content: '👻 Ruangan disembunyikan.', ephemeral: true }); }
                    if (interaction.customId === 'tvc_unhide') { await memberVoice.permissionOverwrites.edit(interaction.guild.id, { [PermissionFlagsBits.ViewChannel]: null }); return interaction.reply({ content: '👁️ Ruangan terlihat.', ephemeral: true }); }
                    if (interaction.customId === 'tvc_stage') {
                        const isMuted = memberVoice.permissionOverwrites.cache.get(interaction.guild.id)?.deny.has(PermissionFlagsBits.Speak);
                        if (isMuted) { await memberVoice.permissionOverwrites.edit(interaction.guild.id, { Speak: null }); return interaction.reply({ content: '🎤 Stage Mode OFF.', ephemeral: true }); } 
                        else { await memberVoice.permissionOverwrites.edit(interaction.guild.id, { Speak: false }); await memberVoice.permissionOverwrites.edit(interaction.user.id, { Speak: true }); return interaction.reply({ content: '🤫 Stage Mode ON.', ephemeral: true }); }
                    }
                    if (interaction.customId === 'tvc_waiting') {
                        const waitingName = `⏳ Wait - ${interaction.user.username}`;
                        const existingWaiting = interaction.guild.channels.cache.find(c => c.name === waitingName && c.parentId === memberVoice.parentId);
                        if (existingWaiting) { await existingWaiting.delete().catch(()=>{}); return interaction.reply({ content: '🗑️ Waiting Room dihapus.', ephemeral: true }); } 
                        else {
                            await interaction.guild.channels.create({ name: waitingName, type: ChannelType.GuildVoice, parent: memberVoice.parentId, permissionOverwrites: [{ id: interaction.guild.id, allow: [PermissionFlagsBits.Connect], deny: [PermissionFlagsBits.Speak] }, { id: interaction.user.id, allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] }]});
                            return interaction.reply({ content: '⏳ Waiting Room dibuat.', ephemeral: true });
                        }
                    }
                    if (interaction.customId === 'tvc_move') {
                        const waitingName = `⏳ Wait - ${interaction.user.username}`;
                        const waitingRoom = interaction.guild.channels.cache.find(c => c.name === waitingName && c.parentId === memberVoice.parentId);
                        if (!waitingRoom || waitingRoom.members.size === 0) return interaction.reply({ content: '👀 Kosong.', ephemeral: true });
                        const selectMenu = new StringSelectMenuBuilder().setCustomId('tvc_move_select').setPlaceholder('Pilih user...').addOptions(waitingRoom.members.map(m => ({ label: m.user.username, value: m.id })));
                        return interaction.reply({ components: [new ActionRowBuilder().addComponents(selectMenu)], ephemeral: true });
                    }
                    if (interaction.customId === 'tvc_rename') {
                        const modal = new ModalBuilder().setCustomId('modal_tvc_rename').setTitle('✏️ Ubah Nama');
                        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('input_name').setLabel('Nama baru:').setStyle(TextInputStyle.Short).setRequired(true)));
                        return interaction.showModal(modal);
                    }
                    if (interaction.customId === 'tvc_limit') {
                        const modal = new ModalBuilder().setCustomId('modal_tvc_limit').setTitle('👥 Batas Pengguna');
                        modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('input_limit').setLabel('Batas (0 Bebas):').setStyle(TextInputStyle.Short).setRequired(true)));
                        return interaction.showModal(modal);
                    }
                } catch (error) { return interaction.reply({ content: '❌ Gagal.', ephemeral: true }); }
            }
        }

        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'mm_select_server' || interaction.customId === 'modmail_select_guild') {
                const { createTicketChannel } = require('../utils/modmailHelper');
                const targetGuildId = interaction.values[0];
                const guildData = await GuildSettings.findOne({ where: { guildId: targetGuildId } });
                if (!guildData || !guildData.settings?.modmail?.categoryId) return interaction.reply({ content: '❌ Konfigurasi server rusak.', ephemeral: true });

                await interaction.update({ content: `${ui.getEmoji('loading')} Sedang menghubungi server...`, embeds: [], components: [] });
                const fetchedMessages = await interaction.channel.messages.fetch({ limit: 5 }).catch(() => null);
                const originalMessage = fetchedMessages ? fetchedMessages.find(m => m.author.id === interaction.user.id) : null;
                try { await createTicketChannel(originalMessage || interaction, { id: targetGuildId, categoryId: guildData.settings.modmail.categoryId }, client); } 
                catch (error) { await interaction.editReply({ content: '❌ Terjadi kesalahan.', components: [] }).catch(()=>{}); }
                return;
            }

            if (interaction.customId === 'tvc_move_select') {
                const targetId = interaction.values[0];
                const targetMember = await interaction.guild.members.fetch(targetId).catch(()=>null);
                const ownerVoice = interaction.member.voice.channel;
                if (!targetMember || !targetMember.voice.channel || !ownerVoice) return interaction.reply({ content: '❌ Gagal memindahkan.', ephemeral: true });
                try {
                    await ownerVoice.permissionOverwrites.edit(targetId, { Connect: true, Speak: true });
                    await targetMember.voice.setChannel(ownerVoice);
                    return interaction.reply({ content: `✅ Berhasil.`, ephemeral: true });
                } catch (error) { return interaction.reply({ content: '❌ Gagal memindahkan.', ephemeral: true }); }
            }
        }

        // ==========================================
        // 4. 📝 MODALS ROUTER (SUBMIT FORMULIR MODMAIL)
        // ==========================================
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'mm_modal_reply' || interaction.customId === 'mm_modal_anon') {
                const replyText = interaction.fields.getTextInputValue('mm_text_input');
                const isAnon = interaction.customId === 'mm_modal_anon';
                const ticket = await ModMail.findOne({ where: { channelId: interaction.channelId, closed: false } });
                
                if (!ticket) return interaction.reply({ content: `${ui.getEmoji('error')} Gagal: Tiket sudah ditutup.`, ephemeral: true });
                const user = await client.users.fetch(ticket.userId).catch(() => null);
                if (!user) return interaction.reply({ content: `${ui.getEmoji('error')} Gagal: User sudah meninggalkan Discord.`, ephemeral: true });

                const replyEmbed = new EmbedBuilder()
                    .setAuthor({ name: isAnon ? `Staf ${interaction.guild.name}` : `Balasan dari ${interaction.member.displayName}`, iconURL: interaction.guild.iconURL() })
                    .setDescription(replyText)
                    .setColor('#FFB6C1')
                    .setTimestamp();

                try {
                    await user.send({ embeds: [replyEmbed] });
                    await interaction.reply({ content: `${ui.getEmoji('success')} Pesan ${isAnon ? '(Anonim)' : ''} berhasil dikirim.`, ephemeral: true });
                    
                    const logEmbed = new EmbedBuilder()
                        .setColor(ui.getColor('success'))
                        .setAuthor({ name: isAnon ? `[ANONIM] ${interaction.user.tag}` : interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
                        .setDescription(`**Membalas:** ${replyText}`);
                    await interaction.channel.send({ embeds: [logEmbed] });
                } catch (e) {
                    await interaction.reply({ content: `${ui.getEmoji('error')} Gagal mengirim DM (User mematikan DM).`, ephemeral: true });
                }
                return;
            }

            if (interaction.customId.startsWith('modal_tvc_')) {
                const memberVoice = interaction.member.voice.channel;
                if (!memberVoice) return interaction.reply({ content: '❌ Kamu sudah keluar dari Voice Channel!', ephemeral: true });
                try {
                    if (interaction.customId === 'modal_tvc_rename') {
                        const newName = interaction.fields.getTextInputValue('input_name');
                        await memberVoice.setName(newName);
                        return interaction.reply({ content: `✅ Nama diubah!`, ephemeral: true });
                    }
                    if (interaction.customId === 'modal_tvc_limit') {
                        let limit = parseInt(interaction.fields.getTextInputValue('input_limit'));
                        if (isNaN(limit) || limit < 0 || limit > 99) limit = 0;
                        await memberVoice.setUserLimit(limit);
                        return interaction.reply({ content: `✅ Kapasitas diubah.`, ephemeral: true });
                    }
                } catch (error) { return interaction.reply({ content: `⚠️ Rate Limit Discord: Terlalu cepat mengubah.`, ephemeral: true }); }
            }
        }
    }
};