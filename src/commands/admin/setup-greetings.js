const { 
    SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, ChannelSelectMenuBuilder, 
    ChannelType, ModalBuilder, TextInputBuilder, TextInputStyle, 
    AttachmentBuilder, MessageFlags 
} = require('discord.js');
const GuildSettings = require('../../models/GuildSettings');
const ui = require('../../config/ui'); 
const { generateWelcomeImage } = require('../../utils/CanvasUtils'); 

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-greetings')
        .setDescription('⚙️ [ADMIN] Dashboard Interaktif untuk Welcome, Leave, & Boost Message.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        // Tunda balasan jika database butuh waktu lebih dari 3 detik
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        let [settings] = await GuildSettings.findOrCreate({ where: { guildId: interaction.guild.id } });
        
        // 🛡️ ANTI-CRASH: Amankan data dari database
        let currentSettings;
        try {
            currentSettings = typeof settings.settings === 'string' ? JSON.parse(settings.settings) : (settings.settings || {});
        } catch (e) {
            currentSettings = {};
        }
        
        // ==========================================
        // 1. STRUKTUR DEFAULT (DEEP MERGE)
        // ==========================================
        if (!currentSettings.greetings) currentSettings.greetings = {};
        const g = currentSettings.greetings; // Alias untuk mempersingkat

        // Pengecekan mendalam memastikan tidak ada variabel yang 'undefined'
        if (!g.welcome) g.welcome = { enabled: false, channelId: null, message: null, image: true, background: null, color: ui.getColor('welcome') };
        if (!g.leave) g.leave = { enabled: false, channelId: null, message: null, image: false, background: null, color: ui.getColor('leave') };
        if (!g.boost) g.boost = { enabled: false, channelId: null, message: null, background: null, color: ui.getColor('boost') };

        // ==========================================
        // 🛠️ FUNGSI RENDER UI
        // ==========================================
        const generateMainMenu = () => {
            const embed = new EmbedBuilder()
                .setColor(ui.getColor('primary'))
                .setTitle(`${ui.getEmoji('success')} Dashboard Setup Greetings`)
                .setDescription('Silakan pilih modul yang ingin kamu konfigurasi melalui menu di bawah ini.')
                .addFields(
                    { name: '👋 Welcome', value: g.welcome.enabled ? '✅ Aktif' : '❌ Nonaktif', inline: true },
                    { name: '🚪 Leave', value: g.leave.enabled ? '✅ Aktif' : '❌ Nonaktif', inline: true },
                    { name: `${ui.getEmoji('booster')} Boost`, value: g.boost.enabled ? '✅ Aktif' : '❌ Nonaktif', inline: true }
                );

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select_module')
                    .setPlaceholder('Pilih modul untuk diedit...')
                    .addOptions([
                        { label: 'Welcome Message', description: 'Atur pesan selamat datang', value: 'welcome', emoji: '👋' },
                        { label: 'Leave Message', description: 'Atur pesan perpisahan', value: 'leave', emoji: '🚪' },
                        { label: 'Boost Message', description: 'Atur pesan terima kasih booster', value: 'boost', emoji: '💎' }
                    ])
            );

            return { embeds: [embed], components: [row] };
        };

        const generateModulePanel = (moduleName) => {
            const data = currentSettings.greetings[moduleName];
            const titleMap = { welcome: '👋 Welcome', leave: '🚪 Leave', boost: '💎 Booster' };
            const colorMap = { welcome: 'welcome', leave: 'leave', boost: 'boost' };

            const embed = new EmbedBuilder()
                .setColor(data.color || ui.getColor(colorMap[moduleName]))
                .setTitle(`⚙️ Panel Konfigurasi: ${titleMap[moduleName]}`)
                .setDescription(`Atur sistem **${moduleName}** agar servermu lebih menarik!`)
                .addFields(
                    { name: 'Status', value: data.enabled ? '🟢 **AKTIF**' : '🔴 **NONAKTIF**', inline: true },
                    { name: 'Channel', value: data.channelId ? `<#${data.channelId}>` : '*Belum diatur*', inline: true },
                    { name: 'Tampilkan Gambar?', value: data.image ? '✅ Ya' : '❌ Tidak', inline: true },
                    { name: 'Background Custom', value: data.background ? '[Terpasang (Klik)](' + data.background + ')' : '*Gunakan Latar Lokal*', inline: true },
                    { name: 'Pesan Kustom', value: data.message ? `\`\`\`${data.message}\`\`\`` : '*Default Naura*' }
                )
                .setFooter({ text: 'Variabel: {user}, {server}, {count}, {naura}, {dot}, {success}' });

            // Menggunakan Boolean() untuk memastikan nilai disabilitas diterima API Discord dengan baik
            const buttonRow1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`toggle_${moduleName}`).setLabel(data.enabled ? 'Matikan Fitur' : 'Aktifkan Fitur').setStyle(data.enabled ? ButtonStyle.Danger : ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`msg_${moduleName}`).setLabel('Edit Pesan').setEmoji('📝').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`bg_${moduleName}`).setLabel('Set Background').setEmoji('🖼️').setStyle(ButtonStyle.Primary).setDisabled(Boolean(!data.image && moduleName !== 'boost'))
            );

            const buttonRow2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`img_${moduleName}`).setLabel('Toggle Gambar').setEmoji('🖼️').setStyle(ButtonStyle.Secondary).setDisabled(moduleName === 'boost'),
                new ButtonBuilder().setCustomId(`test_${moduleName}`).setLabel('Preview').setEmoji('👁️').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('back_home').setLabel('Kembali').setEmoji('🔙').setStyle(ButtonStyle.Secondary)
            );

            const channelSelectRow = new ActionRowBuilder().addComponents(
                new ChannelSelectMenuBuilder().setCustomId(`channel_${moduleName}`).setPlaceholder('Pilih Channel Pengumuman...').addChannelTypes(ChannelType.GuildText)
            );

            return { embeds: [embed], components: [channelSelectRow, buttonRow1, buttonRow2] };
        };

        // ==========================================
        // 🚀 INISIALISASI PESAN
        // ==========================================
        const response = await interaction.editReply({ 
            ...generateMainMenu()
        });

        // ==========================================
        // 🎧 COLLECTOR INTERAKSI (ANTI-CRASH)
        // ==========================================
        const collector = response.createMessageComponentCollector({ time: 15 * 60 * 1000 }); 
        let currentMenu = 'home';

        collector.on('collect', async i => {
            try {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: '❌ Ini bukan menu kamu!', flags: MessageFlags.Ephemeral });
                }

                if (i.customId === 'back_home') {
                    currentMenu = 'home';
                    await i.update(generateMainMenu());
                    return;
                }

                if (i.customId === 'select_module') {
                    currentMenu = i.values[0];
                    await i.update(generateModulePanel(currentMenu));
                    return;
                }

                if (i.customId.startsWith('channel_')) {
                    const moduleName = i.customId.split('_')[1];
                    currentSettings.greetings[moduleName].channelId = i.values[0];
                    
                    settings.settings = currentSettings;
                    settings.changed('settings', true);
                    await settings.save();
                    await i.update(generateModulePanel(moduleName));
                    return;
                }

                if (i.customId.startsWith('toggle_') || i.customId.startsWith('img_')) {
                    const action = i.customId.split('_')[0]; 
                    const moduleName = i.customId.split('_')[1];

                    if (action === 'toggle') currentSettings.greetings[moduleName].enabled = !currentSettings.greetings[moduleName].enabled;
                    if (action === 'img') currentSettings.greetings[moduleName].image = !currentSettings.greetings[moduleName].image;

                    settings.settings = currentSettings;
                    settings.changed('settings', true);
                    await settings.save();
                    await i.update(generateModulePanel(moduleName));
                    return;
                }

                // --- PREVIEW PESAN & CANVAS ---
                if (i.customId.startsWith('test_')) {
                    await i.deferReply({ flags: MessageFlags.Ephemeral }); 
                    
                    const moduleName = i.customId.split('_')[1];
                    const data = currentSettings.greetings[moduleName];
                    const dummyMember = i.member;
                    
                    const rawMessage = data.message || `Halo {user}, selamat datang di {server}!`;
                    
                    const parsedMessage = rawMessage
                        .replace(/{user}/g, `<@${dummyMember.id}>`)
                        .replace(/{server}/g, i.guild.name)
                        .replace(/{count}/g, i.guild.memberCount)
                        .replace(/{naura}/g, ui.getEmoji('naura'))
                        .replace(/{dot}/g, ui.getEmoji('dot'))
                        .replace(/{info}/g, ui.getEmoji('info'))
                        .replace(/{success}/g, ui.getEmoji('success'))
                        .replace(/{booster}/g, ui.getEmoji('booster'))
                        .replace(/{vip}/g, ui.getEmoji('vip'))
                        .replace(/{reward}/g, ui.getEmoji('reward'));

                    const embeds = [];
                    const files = [];

                    const previewEmbed = new EmbedBuilder()
                        .setColor(data.color || ui.getColor(moduleName))
                        .setDescription(parsedMessage);

                    if (data.image) {
                        try {
                            let bgUrl = data.background; 

                            if (!bgUrl && ui.backgrounds) {
                                if (moduleName === 'welcome') bgUrl = ui.backgrounds.welcome;
                                else if (moduleName === 'leave') bgUrl = ui.backgrounds.leave;
                            }

                            const imageBuffer = await generateWelcomeImage(dummyMember, moduleName, ui, bgUrl);
                            const attachment = new AttachmentBuilder(imageBuffer, { name: 'greeting-preview.png' });
                            
                            previewEmbed.setImage('attachment://greeting-preview.png');
                            files.push(attachment);
                        } catch (error) {
                            console.error('Canvas Error:', error);
                            previewEmbed.setFooter({ text: '⚠️ Gagal me-render gambar canvas.' });
                        }
                    }

                    embeds.push(previewEmbed);
                    await i.editReply({ content: `**[PREVIEW ${moduleName.toUpperCase()}]**`, embeds, files });
                    return;
                }

                // --- EDIT PESAN TEKS (MODAL) ---
                if (i.customId.startsWith('msg_')) {
                    const moduleName = i.customId.split('_')[1];
                    const modal = new ModalBuilder().setCustomId(`modal_msg_${moduleName}`).setTitle(`Edit Pesan ${moduleName.toUpperCase()}`);
                    const textInput = new TextInputBuilder()
                        .setCustomId('input_value')
                        .setLabel("Masukkan Pesan Kustom:")
                        .setStyle(TextInputStyle.Paragraph)
                        .setValue(currentSettings.greetings[moduleName].message || '')
                        .setMaxLength(2000).setRequired(false); 

                    modal.addComponents(new ActionRowBuilder().addComponents(textInput));
                    await i.showModal(modal);

                    const submitted = await i.awaitModalSubmit({ time: 300000, filter: m => m.user.id === interaction.user.id });
                    const newValue = submitted.fields.getTextInputValue('input_value');

                    currentSettings.greetings[moduleName].message = newValue !== '' ? newValue : null;
                    
                    settings.settings = currentSettings;
                    settings.changed('settings', true);
                    await settings.save();
                    await submitted.update(generateModulePanel(moduleName));
                }

                // --- EDIT BACKGROUND URL (MODAL) ---
                if (i.customId.startsWith('bg_')) {
                    const moduleName = i.customId.split('_')[1];
                    const modal = new ModalBuilder().setCustomId(`modal_bg_${moduleName}`).setTitle(`Set Background ${moduleName.toUpperCase()}`);
                    const textInput = new TextInputBuilder()
                        .setCustomId('input_value')
                        .setLabel("Link URL Gambar (Kosongkan = Default):")
                        .setPlaceholder("https://i.imgur.com/contoh.png")
                        .setStyle(TextInputStyle.Short)
                        .setValue(currentSettings.greetings[moduleName].background || '')
                        .setRequired(false); 

                    modal.addComponents(new ActionRowBuilder().addComponents(textInput));
                    await i.showModal(modal);

                    const submitted = await i.awaitModalSubmit({ time: 300000, filter: m => m.user.id === interaction.user.id });
                    const newValue = submitted.fields.getTextInputValue('input_value');

                    currentSettings.greetings[moduleName].background = newValue !== '' ? newValue : null;
                    
                    settings.settings = currentSettings;
                    settings.changed('settings', true);
                    await settings.save();
                    await submitted.update(generateModulePanel(moduleName));
                }

            } catch (error) {
                // Tangkap error diam-diam dari API Discord, jangan sampai timeout!
                if (error.code !== 'InteractionCollectorError') {
                    console.error("UI Update Error:", error);
                    // Beri tahu admin jika ada kesalahan teknis saat mengklik tombol
                    if (!i.replied && !i.deferred) {
                        await i.reply({ content: `⚠️ **Terjadi Kesalahan Internal:** \`${error.message}\`\nCoba jalankan ulang command.`, flags: MessageFlags.Ephemeral });
                    }
                }
            }
        });

        collector.on('end', () => {
            interaction.editReply({ components: [] }).catch(() => {}); 
        });
    }
};