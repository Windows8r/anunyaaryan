const { EmbedBuilder, ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const ModMail = require('../models/ModMail');
const GuildSettings = require('../models/GuildSettings');
const ui = require('../config/ui');

async function handleModmailDM(message, client) {
    const activeMail = await ModMail.findOne({ where: { userId: message.author.id, closed: false } });

    if (activeMail) {
        if (!activeMail.guildId) {
            await activeMail.update({ closed: true });
            return await initiateNewTicket(message, client);
        }
        const guild = client.guilds.cache.get(activeMail.guildId);
        const ticketChannel = guild?.channels.cache.get(activeMail.channelId);
        
        if (!guild || !ticketChannel) {
            await activeMail.update({ closed: true });
            return await initiateNewTicket(message, client);
        }
        return await forwardToTicket(message, ticketChannel, client);
    }
    return await initiateNewTicket(message, client);
}

async function forwardToTicket(message, channel, client) {
    try {
        const embed = new EmbedBuilder()
            .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
            .setDescription(message.content || "*Hanya mengirim lampiran*")
            .setColor('#FFB6C1')
            .setTimestamp();

        if (message.attachments.size > 0) embed.setImage(message.attachments.first().url);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('mm_reply').setLabel('Balas').setEmoji(ui.getEmoji('support') !== '💠' ? ui.getEmoji('support') : '💬').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('mm_reply_anon').setLabel('Balas Anonim').setEmoji('🎭').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('mm_close').setLabel('Tutup Tiket').setEmoji(ui.getEmoji('lock') !== '💠' ? ui.getEmoji('lock') : '🔒').setStyle(ButtonStyle.Danger)
        );

        await channel.send({ embeds: [embed], components: [row] });
        await message.react(ui.getEmoji('success') !== '💠' ? ui.getEmoji('success') : '✅').catch(() => {});
    } catch (error) {
        console.error('[MODMAIL ERROR]', error);
        await message.react(ui.getEmoji('error') !== '💠' ? ui.getEmoji('error') : '❌').catch(() => {});
    }
    return true;
}

async function initiateNewTicket(message, client) {
    const guildsWithModmail = [];
    for (const [id, guild] of client.guilds.cache) {
        try {
            const member = await guild.members.fetch(message.author.id).catch(() => null);
            if (!member) continue;
            const settings = await GuildSettings.findOne({ where: { guildId: id } });
            if (settings?.settings?.modmail?.enabled && settings?.settings?.modmail?.categoryId) {
                guildsWithModmail.push({ id: guild.id, name: guild.name, categoryId: settings.settings.modmail.categoryId });
            }
        } catch (e) { continue; }
    }

    if (guildsWithModmail.length === 0) {
        await message.reply(`${ui.getEmoji('error')} Maaf, saya tidak menemukan server yang mengaktifkan layanan Modmail di mana kamu bergabung.`);
        return true;
    }

    if (guildsWithModmail.length === 1) {
        await createTicketChannel(message, guildsWithModmail[0], client);
    } else {
        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('mm_select_server')
            .setPlaceholder('Pilih server tujuan bantuan...')
            .addOptions(guildsWithModmail.map(g => ({ label: g.name.substring(0, 100), value: g.id })));
        const row = new ActionRowBuilder().addComponents(selectMenu);
        await message.reply({ content: "👋 Kamu terhubung dengan beberapa server. Silakan pilih server mana yang ingin kamu hubungi:", components: [row] });
    }
    return true;
}

async function createTicketChannel(message, guildData, client) {
    const guild = client.guilds.cache.get(guildData.id);
    if (!guild) return;

    try {
        const channel = await guild.channels.create({
            name: `mm-${(message.author || message.user).username.substring(0, 20)}`,
            type: ChannelType.GuildText,
            parent: guildData.categoryId,
            permissionOverwrites: [{ id: guild.id, deny: [PermissionFlagsBits.ViewChannel] }],
        });

        const authorId = message.author ? message.author.id : message.user.id;
        await ModMail.create({ userId: authorId, channelId: channel.id, guildId: guild.id, closed: false });

        const settings = await GuildSettings.findOne({ where: { guildId: guild.id } });
        const staffRoleId = settings?.settings?.modmail?.staffRoleId;
        const tagContent = staffRoleId ? `<@&${staffRoleId}>` : '@here';

        const welcomeEmbed = new EmbedBuilder()
            .setColor('#FFB6C1')
            .setTitle('📩 Tiket Modmail Baru')
            .setThumbnail(message.author ? message.author.displayAvatarURL() : message.user.displayAvatarURL())
            .addFields(
                { name: 'Pengguna', value: `<@${authorId}> (${authorId})`, inline: true },
                { name: 'Server', value: guild.name, inline: true }
            )
            .setDescription(`**Pesan Awal:**\n${message.content || "_Hanya Memilih Menu/Gambar_"}`)
            .setTimestamp();

        await channel.send({ content: tagContent, embeds: [welcomeEmbed] });
        
        if (message.reply) {
            await message.reply(`${ui.getEmoji('success')} Tiket telah dibuka di **${guild.name}**. Staf akan segera merespons.`);
        }
        if (message.author) await forwardToTicket(message, channel, client);
    } catch (err) {
        console.error('[MODMAIL ERROR] Channel creation failed:', err);
        if (message.reply) {
            await message.reply(`${ui.getEmoji('error')} Gagal membuat channel tiket. Pastikan bot memiliki izin yang cukup di server, atau kategori tiket masih valid.`).catch(() => {});
        }
    }
}

module.exports = { handleModmailDM, createTicketChannel, initiateNewTicket };