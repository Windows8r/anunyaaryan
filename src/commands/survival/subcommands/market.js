// Lokasi: src/commands/survival/subcommands/market.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const UserProfile = require('../../../models/UserProfile');
const UserSurvival = require('../../../models/UserSurvival');
const itemsConfig = require('../../../config/items');
const ui = require('../../../config/ui');
const leveling = require('../../../utils/survivalLeveling'); 

module.exports = {
    async execute(interaction, client) {
        const user = interaction.user;
        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });
        
        const errEmbed = (msg) => new EmbedBuilder().setColor(ui.getColor('error')).setDescription(`${ui.getEmoji('error')} ${msg}`);
        const successEmbed = (msg) => new EmbedBuilder().setColor(ui.getColor('success')).setDescription(`${ui.getEmoji('success')} ${msg}`);

        if (survival.currentLocation !== 'kota') {
            return interaction.reply({ embeds: [errEmbed('Pasar Gelap hanya bisa diakses di **Kota**. Gunakan `/survival travel`!')], ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('⚖️ Pusat Perdagangan Naura City')
            .setColor(ui.getColor('dark'))
            .setDescription('Selamat datang di gang sempit Naura City. Di sini kamu bisa menjual item monster langka ke **Tengkulak Misterius** (Tawar-Menawar), atau melihat Papan Peringkat orang terkaya.')
            .setFooter({ text: 'Naura Global Market' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('market_sell').setLabel('Jual Barang').setStyle(ButtonStyle.Danger).setEmoji('💰'),
            new ButtonBuilder().setCustomId('market_leaderboard').setLabel('Leaderboard').setStyle(ButtonStyle.Primary).setEmoji('🏆')
        );

        const response = await interaction.reply({ embeds: [embed], components: [row] });
        const collector = response.createMessageComponentCollector({ filter: i => i.user.id === user.id, time: 60000 });

        collector.on('collect', async i => {
            const profile = await UserProfile.findOne({ where: { userId: user.id } });
            const currentInv = profile.inventory || [];

            if (i.customId === 'market_leaderboard') {
                await i.deferUpdate();
                const topUsers = await UserProfile.findAll({ order: [['economy_wallet', 'DESC']], limit: 10 }); 
                
                let lbText = '';
                for (let index = 0; index < topUsers.length; index++) {
                    const u = topUsers[index];
                    const medali = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🏅';
                    const discordUser = await client.users.fetch(u.userId).catch(() => null);
                    const name = discordUser ? discordUser.username : `User ${u.userId}`;
                    lbText += `${medali} **${name}** - ${(u.economy_wallet || 0).toLocaleString('id-ID')} NC\n`; 
                }

                const lbEmbed = new EmbedBuilder()
                    .setTitle('🏆 Top 10 Penduduk Terkaya')
                    .setColor(ui.getColor('economy'))
                    .setDescription(lbText || 'Belum ada data penduduk.');
                await i.editReply({ embeds: [lbEmbed], components: [] });
                return collector.stop();
            }

            if (i.customId === 'market_sell') {
                await i.deferUpdate();
                const sellableItems = currentInv.filter(item => ['slime_gel', 'goblin_ear', 'dragon_scale', 'wheat', 'potato'].includes(item.id));
                
                if (sellableItems.length === 0) {
                    return i.followUp({ embeds: [errEmbed('Kamu tidak punya barang berharga untuk dijual ke Tengkulak!')], ephemeral: true });
                }

                const itemToSell = sellableItems[0]; 
                let basePrice = 100;
                if (itemToSell.id === 'slime_gel') basePrice = 300;
                if (itemToSell.id === 'goblin_ear') basePrice = 800;
                if (itemToSell.id === 'dragon_scale') basePrice = 10000;

                const maxAcceptable = Math.floor(basePrice * 1.5); 

                const chatPrompt = new EmbedBuilder()
                    .setColor(ui.getColor('warning'))
                    .setDescription(`**Tengkulak:** "Aku bisa membeli **${itemToSell.name}** itu seharga **${basePrice} NC**."\n\n${ui.getEmoji('info')} **[INTERAKSI CHAT]** Ketik tawaran balasmu (berupa angka) di obrolan dalam **15 Detik**!`);

                await i.editReply({ embeds: [chatPrompt], components: [] });
                collector.stop(); 

                if (interaction.channel) {
                    const chatCollector = interaction.channel.createMessageCollector({ filter: m => m.author.id === user.id && !isNaN(m.content), time: 15000, max: 1 });
                    chatCollector.on('collect', async m => {
                        const tawaranPlayer = parseInt(m.content);
                        if (tawaranPlayer <= maxAcceptable) {
                            const newBalance = (profile.economy_wallet || 0) + tawaranPlayer;
                            const itemIdx = currentInv.findIndex(inv => inv.id === itemToSell.id);
                            currentInv.splice(itemIdx, 1);

                            await leveling.addPlayerXP(user.id, 10);

                            await UserProfile.update({ economy_wallet: newBalance, inventory: currentInv }, { where: { userId: user.id } });
                            await m.reply({ embeds: [successEmbed(`🤝 **Tengkulak:** "Deal! Aku ambil seharga **${tawaranPlayer.toLocaleString('id-ID')} NC**!"\n🌟 *(+10 XP)*`)] });
                        } else {
                            await m.reply({ embeds: [errEmbed(`💢 **Tengkulak:** "Kau gila?! Harga segitu terlalu mahal! Tidak jadi!"`)] });
                        }
                    });
                    chatCollector.on('end', collected => {
                        if (collected.size === 0) interaction.followUp({ embeds: [errEmbed('Tengkulak pergi karena kamu terlalu lama diam.')], ephemeral: true }).catch(()=>{});
                    });
                }
            }
        });
    }
};