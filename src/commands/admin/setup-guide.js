const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const ui = require('../../config/ui');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-guide')
        .setDescription('Unggah file .txt berisi Buku Panduan/FAQ server untuk dibaca AI.')
        .addAttachmentOption(opt => 
            opt.setName('dokumen')
                .setDescription('File panduan (.txt)')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        await interaction.deferReply();
        const file = interaction.options.getAttachment('dokumen');
        
        if (!file.name.endsWith('.txt')) {
            return interaction.editReply('❌ Saat ini AI hanya mendukung format teks murni (.txt).');
        }

        try {
            const response = await fetch(file.url);
            const textContent = await response.text();
            
            if (textContent.length > 50000) {
                return interaction.editReply('❌ File terlalu besar! Maksimal 50,000 karakter agar AI tidak kelebihan beban memori.');
            }

            const guideDir = path.join(__dirname, '../../../data/guides');
            if (!fs.existsSync(guideDir)) {
                fs.mkdirSync(guideDir, { recursive: true });
            }

            const filePath = path.join(guideDir, `${interaction.guildId}.txt`);
            fs.writeFileSync(filePath, textContent, 'utf-8');

            const embed = new EmbedBuilder()
                .setColor(ui.getColor ? ui.getColor('primary') : '#00FFFF')
                .setTitle('📚 Buku Panduan Server Terpasang')
                .setDescription(`Sistem RAG (Retrieval-Augmented Generation) berhasil mengonsumsi file **${file.name}**.\n\nSekarang Naura akan menggunakan pengetahuan dari dokumen ini saat menjawab pertanyaan member di channel AI.`);

            return interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('[SETUP GUIDE]', error);
            return interaction.editReply('❌ Terjadi kesalahan saat membaca file dokumen.');
        }
    }
};
