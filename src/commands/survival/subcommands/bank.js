// Lokasi: src/commands/survival/subcommands/bank.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const UserProfile = require('../../../models/UserProfile');
const UserSurvival = require('../../../models/UserSurvival');
const ui = require('../../../config/ui');

module.exports = {
    async execute(interaction, client) {
        const user = interaction.user;
        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });
        
        const errEmbed = (msg) => new EmbedBuilder().setColor(ui.getColor('error')).setDescription(`${ui.getEmoji('error')} ${msg}`);

        if (survival.currentLocation !== 'kota') {
            return interaction.reply({ embeds: [errEmbed('Naura Bank hanya beroperasi di **Kota**. Gunakan `/survival travel` untuk pergi ke kota!')], ephemeral: true });
        }

        const profile = await UserProfile.findOne({ where: { userId: user.id } });
        let wallet = profile.economy_wallet || 0; 
        let bank = profile.economy_bank || 0; 

        const embed = new EmbedBuilder()
            .setTitle(`${ui.getEmoji('bank')} Naura Central Bank`)
            .setColor(ui.getColor('economy'))
            .setDescription(`Selamat datang, **${user.displayName}**.\nSimpan uangmu di sini agar aman dari pencuri!\n\n${ui.getEmoji('wallet')} **Dompet:** ${wallet.toLocaleString('id-ID')} NC\n${ui.getEmoji('bank')} **Saldo Bank:** ${bank.toLocaleString('id-ID')} NC`)
            .setFooter({ text: 'Naura RPG Economy' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bank_dep').setLabel('Setor (Deposit)').setStyle(ButtonStyle.Success).setEmoji('📥'),
            new ButtonBuilder().setCustomId('bank_wd').setLabel('Tarik (Withdraw)').setStyle(ButtonStyle.Danger).setEmoji('📤')
        );

        const response = await interaction.reply({ embeds: [embed], components: [row] });
        const collector = response.createMessageComponentCollector({ filter: i => i.user.id === user.id, time: 60000 });

        collector.on('collect', async i => {
            await i.deferUpdate();
            const action = i.customId === 'bank_dep' ? 'setor' : 'tarik';
            
            const promptEmbed = new EmbedBuilder()
                .setColor(ui.getColor('primary'))
                .setDescription(`${ui.getEmoji('info')} **[INTERAKSI CHAT]**\nKetik jumlah uang yang ingin kamu **${action}** di obrolan sekarang (Ketik \`all\` untuk semua). Waktu 15 detik!`);

            await i.editReply({ embeds: [promptEmbed], components: [] });
            collector.stop();

            if (interaction.channel) {
                const chatFilter = m => m.author.id === user.id;
                const chatCollector = interaction.channel.createMessageCollector({ filter: chatFilter, time: 15000, max: 1 });
                
                chatCollector.on('collect', async m => {
                    let amount = m.content.toLowerCase();
                    let currentWallet = profile.economy_wallet || 0; 
                    let currentBank = profile.economy_bank || 0;

                    if (action === 'setor') {
                        let depoAmount = amount === 'all' ? currentWallet : parseInt(amount);
                        if (isNaN(depoAmount) || depoAmount <= 0) return m.reply({ embeds: [errEmbed('Jumlah tidak valid!')] });
                        if (depoAmount > currentWallet) return m.reply({ embeds: [errEmbed('Uang di dompetmu tidak cukup!')] });
                        
                        currentWallet -= depoAmount;
                        currentBank += depoAmount;
                    } else {
                        let wdAmount = amount === 'all' ? currentBank : parseInt(amount);
                        if (isNaN(wdAmount) || wdAmount <= 0) return m.reply({ embeds: [errEmbed('Jumlah tidak valid!')] });
                        if (wdAmount > currentBank) return m.reply({ embeds: [errEmbed('Saldo bankmu tidak cukup!')] });
                        
                        currentBank -= wdAmount;
                        currentWallet += wdAmount;
                    }

                    await UserProfile.update({ economy_wallet: currentWallet, economy_bank: currentBank }, { where: { userId: user.id } });
                    
                    const successEmbed = new EmbedBuilder()
                        .setColor(ui.getColor('success'))
                        .setDescription(`${ui.getEmoji('success')} Transaksi berhasil!\n\n${ui.getEmoji('wallet')} **Dompet Baru:** ${currentWallet.toLocaleString('id-ID')} NC\n${ui.getEmoji('bank')} **Bank Baru:** ${currentBank.toLocaleString('id-ID')} NC`);
                    
                    await m.reply({ embeds: [successEmbed] });
                });

                chatCollector.on('end', collected => {
                    if (collected.size === 0) interaction.followUp({ embeds: [errEmbed('Waktu habis, transaksi dibatalkan.')], ephemeral: true }).catch(()=>{});
                });
            }
        });
    }
};