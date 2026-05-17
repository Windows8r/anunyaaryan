// Lokasi: src/commands/survival/survival.js

const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    name: 'survival',
    description: 'Masuki ekosistem Survival Naura secara modular!',
    aliases: ['srv', 'sv'],

    data: new SlashCommandBuilder()
        .setName('survival')
        .setDescription('Masuki ekosistem Survival Naura!')
        
        // ✨ INI ADALAH SUBCOMMAND BARU YANG DITAMBAHKAN
        .addSubcommand(sub => sub.setName('start').setDescription('Klaim Starter Kit untuk memulai petualangan survivalmu!'))
        
        // --- 1. INFO (Telah di-update dengan opsi User target) ---
        .addSubcommand(sub => sub.setName('info').setDescription('Cek status fisik, waktu lokal, dan hubungan.')
            .addUserOption(opt => opt.setName('target').setDescription('Lihat profil pemain lain').setRequired(false))
        )
        .addSubcommand(sub => sub.setName('collect').setDescription('Cari barang di berbagai lokasi.')
            .addStringOption(opt => opt.setName('lokasi').setDescription('Pilih lokasi pencarian').setRequired(true)
                .addChoices({ name: '🌲 Hutan', value: 'hutan' }, { name: '🗑️ Tempat Sampah', value: 'sampah' }, { name: '⛏️ Tambang', value: 'tambang' }, { name: '🎣 Laut', value: 'laut' })
            )
        )
        .addSubcommand(sub => sub.setName('consume').setDescription('Makan/minum untuk memulihkan energi.'))
        .addSubcommand(sub => sub.setName('pet').setDescription('Pantau hewan peliharaan dari alam liar.'))
        .addSubcommand(sub => sub.setName('npc').setDescription('Berinteraksi dengan NPC setempat.')
            .addStringOption(opt => opt.setName('lokasi').setDescription('Lokasi NPC berada').setRequired(true)
                .addChoices({ name: '🏘️ Kota', value: 'kota' }, { name: '🌲 Hutan', value: 'hutan' }, { name: '⛏️ Tambang', value: 'tambang' }, { name: '🎣 Laut', value: 'laut' }, { name: '🗑️ Sampah', value: 'sampah' })
            )
        )
        .addSubcommand(sub => sub.setName('craft').setDescription('Buat peralatan dari materialmu.'))
        .addSubcommand(sub => sub.setName('rest').setDescription('Beristirahat untuk memulihkan energi dan ganti hari.'))
        .addSubcommand(sub => sub.setName('shop').setDescription('Beli makanan, properti, kendaraan, dll.'))
        .addSubcommand(sub => sub.setName('travel').setDescription('Bepergian ke area lain di Naura Universe.')
            .addStringOption(opt => opt.setName('tujuan').setDescription('Pilih destinasi').setRequired(true)
                .addChoices({ name: '🏡 Village', value: 'village' }, { name: '🏙️ City', value: 'city' }, { name: '🏫 Academy', value: 'academy' }, { name: '🎡 Park', value: 'park' })
            )
        )
        .addSubcommand(sub => sub.setName('study').setDescription('Belajar di Academy untuk menaikkan Kepintaran.'))
        .addSubcommand(sub => sub.setName('work').setDescription('Bekerja di Naura City.'))
        .addSubcommand(sub => sub.setName('date').setDescription('Gunakan Tiket Kencan di Amusement Park.'))
        .addSubcommand(sub => sub.setName('farm').setDescription('Kelola lahan pertanian di propertimu.'))
        .addSubcommand(sub => sub.setName('dungeon').setDescription('Masuki gua berbahaya untuk melawan monster!'))
        .addSubcommand(sub => sub.setName('market').setDescription('Kunjungi Pasar Gelap atau cek Leaderboard.'))
        .addSubcommand(sub => sub.setName('bank').setDescription('Akses Naura Bank di City untuk menyimpan uangmu dengan aman.')),

    async execute(interaction, client) {
        const subCommandName = interaction.options.getSubcommand();
        await this.routeToSubcommand(subCommandName, interaction, client);
    },

    async run(message, args, client) {
        const subCommandName = args[0] ? args[0].toLowerCase() : 'info'; 
        let loadingMsg = null;
        
        const mockInteraction = {
            isCommand: () => false,
            user: message.author,
            member: message.member,
            guild: message.guild,
            channel: message.channel,
            client: client,
            deferReply: async () => { loadingMsg = await message.reply('⏳ Memproses permintaanmu...'); },
            reply: async (data) => await message.reply(data), 
            editReply: async (data) => {
                if (loadingMsg) return await loadingMsg.edit(data);
                return await message.reply(data);
            },
            followUp: async (data) => await message.reply(data),
            options: {
                getString: (name) => {
                    if ((subCommandName === 'collect' || subCommandName === 'npc') && name === 'lokasi') return args[1]?.toLowerCase();
                    if (subCommandName === 'travel' && name === 'tujuan') return args[1]?.toLowerCase();
                    return null;
                },
                getUser: (name) => {
                    if (subCommandName === 'info' && name === 'target') return message.mentions.users.first() || null;
                    return null;
                },
                getSubcommand: () => subCommandName
            }
        };

        await this.routeToSubcommand(subCommandName, mockInteraction, client);
    },

    async routeToSubcommand(subName, interaction, client) {
        try {
            const subCommandFile = require(`./subcommands/${subName}.js`);
            await subCommandFile.execute(interaction, client);
        } catch (error) {
            console.error(error);
            const errorMsg = '❌ Terjadi kesalahan fatal saat mengeksekusi sistem ini.';
            if (interaction.deferred || interaction.replied) await interaction.editReply({ content: errorMsg });
            else await interaction.reply({ content: errorMsg, flags: 64 }); // Menggunakan flags: 64 sebagai pengganti ephemeral: true yang deprecated
        }
    }
};