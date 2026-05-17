const { REST, Routes, Collection } = require('discord.js');
const fs = require('fs/promises');
const path = require('path');
const env = require('../config/env');

class CommandHandler {
  constructor(client, commandsPath) {
    this.client = client;
    this.commandsPath = commandsPath;
    if (!client.commands) client.commands = new Collection();
    this.commands = client.commands;
  }

  async load() {
    let commandsArray = [];
    let commandNames = new Set(); 

    try {
      const commandFolders = await fs.readdir(this.commandsPath);

      for (const folder of commandFolders) {
        const folderPath = path.join(this.commandsPath, folder);
        const stat = await fs.stat(folderPath);
        
        if (stat.isDirectory()) {
          const commandFiles = await fs.readdir(folderPath);
          
          for (const file of commandFiles.filter(f => f.endsWith('.js'))) {
            const filePath = path.join(folderPath, file);
            
            delete require.cache[require.resolve(filePath)];
            const command = require(filePath);
            
            // PERBAIKAN: Dukung Slash Commands (`command.data`) DAN Prefix Commands (`command.name`)
            if (('data' in command || 'name' in command) && 'execute' in command) {
              const cmdName = command.data ? command.data.name : command.name;

              if (commandNames.has(cmdName)) {
                console.log(`\x1b[43m\x1b[30m ⚠️ WARNING \x1b[0m \x1b[33mDuplikat command "/${cmdName}" pada file ${file}! File dilewati.\x1b[0m`);
                continue; 
              }

              commandNames.add(cmdName);
              command.category = folder;
              this.commands.set(cmdName, command);
              
              if (command.aliases && Array.isArray(command.aliases)) {
                  command.aliases.forEach(alias => this.commands.set(alias, command));
              }

              // Pastikan command ditaruh di list untuk di Deploy HANYA JIKA ITU SLASH COMMAND
              if (command.data) {
                  commandsArray.push(command.data.toJSON());
              }
            }
          }
        }
      }

      console.log(`\x1b[44m\x1b[37m 📂 COMMANDS \x1b[0m \x1b[34mMemuat ${this.commands.size} command secara lokal.\x1b[0m`);
      
      // Auto-deploy dihapus, sekarang deploy hanya via command n!deploy
    } catch (error) {
      console.error('\x1b[41m\x1b[37m 💥 ERROR \x1b[0m \x1b[31mGagal memuat command:\x1b[0m', error);
    }
  }
}

module.exports = { CommandHandler };
