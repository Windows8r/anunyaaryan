// Lokasi: src/commands/survival/subcommands/shop.js
const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags } = require('discord.js');
const UserProfile = require('../../../models/UserProfile');
const UserSurvival = require('../../../models/UserSurvival');
const itemsConfig = require('../../../config/items');
const ui = require('../../../config/ui');
const { getSeason } = require('../../../utils/survivalTime');
const leveling = require('../../../utils/survivalLeveling');

// Random generator with seed
function seededRandom(seed) {
    var x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

module.exports = {
    async execute(interaction, client) {
        const user = interaction.user;
        const profile = await UserProfile.findOne({ where: { userId: user.id } });
        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });
        
        const errEmbed = (msg) => new EmbedBuilder().setColor(ui.getColor('error')).setDescription(`${ui.getEmoji('error')} ${msg}`);
        const successEmbed = (msg) => new EmbedBuilder().setColor(ui.getColor('success')).setDescription(`${ui.getEmoji('success')} ${msg}`);

        const currentDay = survival.inGameDay || 1;
        const season = getSeason(currentDay);
        const wallet = profile.economy_wallet || 0; 

        // Seed rotasi setiap 5 menit (300000 ms)
        const rotationSeed = Math.floor(Date.now() / 300000);
        
        // Item Wajib
        const fixedItems = ['apple', 'mineral_water', 'bandage'];
        const shopItems = fixedItems.map(id => itemsConfig.find(i => i.id === id)).filter(Boolean);

        // Filter item acak (memiliki harga dan bukan item wajib)
        const pool = itemsConfig.filter(it => it.price && !fixedItems.includes(it.id));
        
        // Pilih 5 item acak
        let currentSeed = rotationSeed;
        for (let i = 0; i < 5; i++) {
            if (pool.length === 0) break;
            const index = Math.floor(seededRandom(currentSeed++) * pool.length);
            shopItems.push(pool[index]);
            pool.splice(index, 1); // remove to prevent duplicate
        }

        const mainEmbed = new EmbedBuilder()
            .setTitle(`🛒 Naura Shop`)
            .setColor(ui.getColor('economy'))
            .setDescription(
                `Selamat datang di toko Naura! Saat ini adalah **Musim ${season.name}** ${season.emoji}.\n\n` +
                `${ui.getEmoji('wallet')} **Dompetmu:** ${wallet.toLocaleString('id-ID')} **NC**\n\n` +
                `*Peringatan: Toko ini hanya menerima pembelian. Barang akan dirotasi setiap 5 menit!*\n\n` +
                `Pilih barang di bawah ini:`
            )
            .setFooter({ text: 'Naura Survival Shop • Rotasi Acak Terbatas' });

        const buyMenu = new StringSelectMenuBuilder()
            .setCustomId('buy_select')
            .setPlaceholder('Pilih item untuk dibeli...')
            .addOptions(shopItems.map(it => {
                let rarityEmoji = '';
                if (it.rarity) {
                    if (ui.getEmoji(it.rarity) !== '💠') {
                        rarityEmoji = ui.getEmoji(it.rarity) + ' ';
                    } else {
                        rarityEmoji = `[${it.rarity.toUpperCase()}] `;
                    }
                }
                let baseEmoji = '📦';
                if (it.id === 'apple') baseEmoji = ui.getEmoji('apple') !== '💠' ? ui.getEmoji('apple') : '🍎';
                if (it.id === 'mineral_water') baseEmoji = ui.getEmoji('mineral_water') !== '💠' ? ui.getEmoji('mineral_water') : '💧';
                
                return new StringSelectMenuOptionBuilder()
                    .setLabel(`${rarityEmoji}${it.name}`)
                    .setDescription(`Harga: ${it.price.toLocaleString('id-ID')} NC`)
                    .setEmoji(baseEmoji)
                    .setValue(`shop_${it.id}`);
            }));

        const response = await interaction.reply({ embeds: [mainEmbed], components: [new ActionRowBuilder().addComponents(buyMenu)] });
        const collector = response.createMessageComponentCollector({ filter: i => i.user.id === user.id, time: 60000 });

        collector.on('collect', async i => {
            await i.deferUpdate();
            if (i.customId === 'buy_select') {
                const itemId = i.values[0].replace('shop_', '');
                const itemConf = itemsConfig.find(it => it.id === itemId);
                
                if (!itemConf || !itemConf.price) {
                    return i.followUp({ embeds: [errEmbed('Barang tidak ditemukan atau tidak untuk dijual.')], flags: MessageFlags.Ephemeral });
                }

                const cost = itemConf.price;
                const currentProfile = await UserProfile.findOne({ where: { userId: user.id } });
                let currentBal = currentProfile.economy_wallet || 0; 
                
                if (currentBal < cost) {
                    return i.followUp({ embeds: [errEmbed(`Koinmu tidak cukup! Butuh **${cost.toLocaleString('id-ID')} NC**.`)], flags: MessageFlags.Ephemeral });
                }

                currentBal -= cost;
                await UserProfile.update({ economy_wallet: currentBal }, { where: { userId: user.id } }); 

                // Tambah XP karena berbelanja
                await leveling.addPlayerXP(user.id, 5);

                const currentInv = currentProfile.inventory || [];
                currentInv.push({ id: itemConf.id, name: itemConf.name });
                await UserProfile.update({ inventory: currentInv }, { where: { userId: user.id } });
                
                await i.editReply({ embeds: [successEmbed(`Berhasil membeli **${itemConf.name}** seharga ${cost.toLocaleString('id-ID')} NC!\nBarang sudah dimasukkan ke tas.\n\n🌟 *(+5 XP)*`)], components: [] });
                
                collector.stop();
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                const timeoutEmbed = new EmbedBuilder().setColor(ui.getColor('dark')).setDescription('Transaksi dibatalkan karena kehabisan waktu.');
                interaction.editReply({ embeds: [timeoutEmbed], components: [] }).catch(()=>{});
            }
        });
    }
};