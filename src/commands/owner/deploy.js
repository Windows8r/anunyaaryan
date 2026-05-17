const { EmbedBuilder, REST, Routes } = require('discord.js');
const env = require('../../config/env');
const ui = require('../../config/ui');
const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'deploy',
    aliases: ['sync'],
    description: 'Manual deploy slash commands ke server atau global (Owner Only).',
    category: 'owner',
    
    async executePrefix(message, args, client) {
        if (!env.OWNER_IDS.includes(message.author.id)) {
            return message.reply(`${ui.getEmoji('error')} Perintah ini hanya untuk Owner bot!`);
        }

        const msg = await message.reply(`${ui.getEmoji('loading')} Memindai folder command...`);
        const commandsData = [];
        const loadedNames = [];
        const foldersPath = path.join(__dirname, '..'); // Folder commands
        
        if (fs.existsSync(foldersPath)) {
            for (const folder of fs.readdirSync(foldersPath)) {
                const commandsPath = path.join(foldersPath, folder);
                if (!fs.statSync(commandsPath).isDirectory()) continue;
                
                for (const file of fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'))) {
                    const commandPath = path.join(commandsPath, file);
                    delete require.cache[require.resolve(commandPath)];
                    const command = require(commandPath);
                    if ('data' in command && 'execute' in command) {
                        commandsData.push(command.data.toJSON());
                        loadedNames.push(command.data.name);
                    }
                }
            }
        }

        if (commandsData.length === 0) {
            return msg.edit(`${ui.getEmoji('warning')} Tidak ada slash command valid yang ditemukan.`);
        }

        const rest = new REST({ version: '10' }).setToken(env.TOKEN);
        const clientId = env.CLIENT_ID;
        const guildId = args[0] === 'global' ? null : (env.GUILD_ID || message.guild.id);

        try {
            await msg.edit(`${ui.getEmoji('loading')} Mendaftarkan ${commandsData.length} slash commands...`);
            
            if (guildId) {
                await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commandsData });
                await msg.edit(`${ui.getEmoji('success')} Berhasil registrasi **${commandsData.length}** commands ke Server (${guildId}).\nGunakan \`n!deploy global\` untuk sinkronisasi semua server (bisa memakan waktu 1 jam).`);
            } else {
                await rest.put(Routes.applicationCommands(clientId), { body: commandsData });
                await msg.edit(`${ui.getEmoji('success')} Berhasil registrasi **${commandsData.length}** commands secara GLOBAL.\nPerubahan mungkin membutuhkan waktu hingga 1 jam untuk sinkronisasi.`);
            }
        } catch (error) {
            console.error('[DEPLOY ERROR]', error);
            await msg.edit(`${ui.getEmoji('error')} Gagal deploy command. Periksa log console.`);
        }
    }
};
