const { ChannelType, EmbedBuilder, AttachmentBuilder, PermissionFlagsBits, Collection } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai'); // KEMBALI KE LIBRARY LAMA YANG TERBUKTI JALAN
const env = require('../config/env');
const ui = require('../config/ui');
const { awardXp } = require('../utils/leveling'); 

const UserProfile = require('../models/UserProfile');
const GuildSettings = require('../models/GuildSettings');
const { handleAutomod } = require('../utils/automodHelper'); 
const { handleModmailDM } = require('../utils/modmailHelper'); 
const ModMail = require('../models/ModMail');

const genAI = new GoogleGenerativeAI(env.GEMINI_API); // INISIALISASI GEMINI YANG BENAR
const badWords = ['anjing', 'bangsat', 'kontol', 'babi']; 
const linkRegex = /(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})/gi;

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.author.bot) return;

        // 🚧 GLOBAL MAINTENANCE LOCKDOWN
        if (client.maintenanceMode && !env.OWNER_IDS.includes(message.author.id)) return;

        if (!client.snipes) client.snipes = new Collection();
        if (!client.verbaSessions) client.verbaSessions = new Map();

        // ==========================================
        // 📨 SISTEM MODMAIL & AUTOMOD (TIDAK ADA PERUBAHAN)
        // ==========================================
        if (message.channel.type === ChannelType.DM) {
            try { 
                await handleModmailDM(message, client); 
                const activeMail = await ModMail.findOne({ where: { userId: message.author.id, closed: false } });
                if (activeMail && activeMail.guildId) {
                    const guild = client.guilds.cache.get(activeMail.guildId);
                    if (guild) await awardXp(message.author, guild, message.channel).catch(() => {});
                }
                return;
            } catch (error) {
                console.error('[DM ERROR]', error);
                return; 
            }
        }

        if (message.guild) {
            const isViolating = await handleAutomod(message, client);
            if (isViolating) return; 
            
            let staffThread = await ModMail.findOne({ where: { channelId: message.channel.id, closed: false } }).catch(() => null);
            if (staffThread) {
                if (message.content.toLowerCase() === 'n!close') {
                    staffThread.closed = true;
                    await staffThread.save();
                    try {
                        const user = await client.users.fetch(staffThread.userId);
                        await user.send({ embeds: [new EmbedBuilder().setColor('#FF0000').setTitle('🔒 Sesi Berakhir').setDescription(`Sesi percakapanmu dengan Staff **${message.guild.name}** telah ditutup.`)] });
                    } catch (e) {}
                    await message.channel.send('Merapikan channel dalam 5 detik...');
                    setTimeout(() => message.channel.delete().catch(() => {}), 5000);
                    return;
                }
                try {
                    const user = await client.users.fetch(staffThread.userId);
                    const replyEmbed = new EmbedBuilder()
                        .setAuthor({ name: `Balasan dari ${message.guild.name}`, iconURL: message.guild.iconURL() })
                        .setDescription(message.content || '*Hanya mengirim lampiran*')
                        .setColor(ui.getColor ? ui.getColor('primary') : '#00FFFF')
                        .setFooter({ text: `Staff: ${message.author.username}`, iconURL: message.author.displayAvatarURL() })
                        .setTimestamp();

                    let files = [];
                    if (message.attachments.size > 0) files = message.attachments.map(a => new AttachmentBuilder(a.url, { name: a.name }));
                    await user.send({ embeds: [replyEmbed], files: files });
                    await message.react('📨');
                } catch (error) {
                    await message.channel.send({ embeds: [new EmbedBuilder().setColor('#FF0000').setDescription('❌ Gagal mengirim pesan. DM User tertutup/diblokir.')] });
                }
                return; 
            }
        }

        let settings = null;
        if (message.guild) {
            try { 
                const redisManager = require('../managers/redisManager');
                const cacheKey = `guild_settings_${message.guild.id}`;
                if (redisManager.client && redisManager.client.isReady) {
                    settings = await redisManager.getCache(cacheKey);
                }
                
                if (!settings) {
                    [settings] = await GuildSettings.findOrCreate({ where: { guildId: message.guild.id } });
                    if (redisManager.client && redisManager.client.isReady && settings) {
                        await redisManager.setCache(cacheKey, settings.toJSON ? settings.toJSON() : settings, 300); // 5 minutes cache
                    }
                }
            } catch(e) {}
        }

        if (settings && message.guild && message.member && !message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            const automod = settings?.settings?.automod || {};
            if (automod.enabled) {
                let isViolation = false;
                let violationType = '';
                const content = message.content.toLowerCase();

                if (automod.antiInvite && /(discord\.gg|discord\.com\/invite)/gi.test(content)) {
                    isViolation = true; violationType = 'Mengirim Undangan Server';
                } else if (linkRegex.test(content) && !content.includes('tenor.com') && !content.includes('discordapp.') && !content.includes('discord.com') && !content.includes('spotify.com') && !content.includes('youtube.com') && !content.includes('youtu.be') && !content.includes('soundcloud.com')) {
                    isViolation = true; violationType = 'Mengirim Link Ilegal';
                } else if (message.mentions.users.size > (automod.massMention || 5)) {
                    isViolation = true; violationType = 'Mass Mention (Spam Tag)';
                } else if (content.length > 5 && badWords.some(word => content.includes(word))) {
                    try {
                        const prompt = `Analisis teks Discord berikut: "${message.content}". Apakah teks ini secara konteks merupakan perundungan, pelecehan, atau ujaran kebencian? Jawab HANYA JSON: {"isViolation": true/false, "reason": "alasan"}`;
                        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
                        const response = await model.generateContent(prompt);
                        const cleanJson = response.response.text().replace(/```json/g, '').replace(/```/g, '').trim();
                        const parsed = JSON.parse(cleanJson);
                        if (parsed.isViolation) { isViolation = true; violationType = `AI Auto-Mod: ${parsed.reason}`; } 
                    } catch (e) {
                        isViolation = true; violationType = 'Menggunakan Kata Kasar';
                    }
                }

                if (isViolation) {
                    await message.delete().catch(() => {});
                    const UserLeveling = require('../models/UserLeveling');
                    let [profile] = await UserLeveling.findOrCreate({ where: { userId: message.author.id, guildId: message.guild.id } });
                    profile.mannersPoint = (profile.mannersPoint !== undefined ? profile.mannersPoint : 100) - 25; 
                    if (profile.mannersPoint <= 0) {
                        profile.mannersPoint = 0;
                        if (automod.punishRole) {
                            try {
                                await message.member.roles.add(automod.punishRole);
                                await message.channel.send(`🚨 **ISOLASI AKTIF!** <@${message.author.id}> Poin Tata Krama habis (0/100).`);
                            } catch (e) {}
                        }
                    } else {
                        const warningMsg = await message.channel.send(`⚠️ <@${message.author.id}>, pesan dihapus karena: **${violationType}**. (Poin: **${profile.mannersPoint}/100**)`);
                        setTimeout(() => warningMsg.delete().catch(() => {}), 8000);
                    }
                    await profile.save();
                    return; 
                }
            }
        }

        // ==========================================
        // 💤 SISTEM AFK & COUNTING
        // ==========================================
        if (message.mentions.users.size > 0) {
            const mentioned = message.mentions.users.first();
            const profile = await UserProfile.findByPk(mentioned.id).catch(()=>null);
            if (profile && profile.afk_reason) {
                const timeAgo = `<t:${Math.floor(new Date(profile.afk_timestamp).getTime() / 1000)}:R>`;
                message.reply({ content: `💤 **${mentioned.username}** sedang AFK: *${profile.afk_reason}* (${timeAgo})` }).catch(()=>{})
                    .then(m => setTimeout(() => m?.delete().catch(()=>null), 5000));
            }
        }

        const userProfile = await UserProfile.findByPk(message.author.id).catch(()=>null);
        if (userProfile && userProfile.afk_reason) {
            userProfile.afk_reason = null;
            userProfile.afk_timestamp = null;
            await userProfile.save().catch(()=>{});
            message.reply({ content: `👋 Selamat datang kembali <@${message.author.id}>! Naura sudah menghapus status AFK-mu.` }).catch(()=>{})
                .then(m => setTimeout(() => m?.delete().catch(()=>null), 5000));
        }

        let guildChannels = {};
        if (settings && settings.settings && settings.settings.channels) { guildChannels = settings.settings.channels; }

        if (guildChannels.counting && message.channel.id === guildChannels.counting) {
            if (isNaN(message.content.trim())) { await message.delete().catch(() => {}); return; }
            await message.react('✅').catch(() => {}); return; 
        }

        // ==========================================
        // 📌 SISTEM STICKY MESSAGE
        // ==========================================
        if (settings && settings.settings && settings.settings.stickyMessage) {
            const stickyData = settings.settings.stickyMessage;
            if (stickyData.channelId === message.channel.id && stickyData.message) {
                if (stickyData.lastId) {
                    try {
                        const oldMsg = await message.channel.messages.fetch(stickyData.lastId).catch(() => null);
                        if (oldMsg) await oldMsg.delete().catch(() => {});
                    } catch (e) {}
                }
                
                try {
                    const stickyEmbed = new EmbedBuilder()
                        .setColor(ui.getColor ? ui.getColor('primary') : '#FFB6C1')
                        .setDescription(stickyData.message);
                    const newMsg = await message.channel.send({ embeds: [stickyEmbed] }).catch(() => null);
                    if (newMsg) {
                        stickyData.lastId = newMsg.id;
                        settings.changed('settings', true);
                        await settings.save();
                        
                        const redisManager = require('../managers/redisManager');
                        if (redisManager.client && redisManager.client.isReady) {
                            const cacheKey = `guild_settings_${message.guild.id}`;
                            await redisManager.setCache(cacheKey, settings.toJSON ? settings.toJSON() : settings, 300);
                        }
                    }
                } catch (e) {}
            }
        }

        // ==========================================
        // 🧠 SISTEM OTOMATISASI AI (VERBA API w/ GEMINI FALLBACK)
        // ==========================================
        // MENGUBAH PENGECEKAN MENTION AGAR HANYA MERESPON ID LANGSUNG BOT
        const isMentioned = message.content.includes(`<@${client.user.id}>`) || message.content.includes(`<@!${client.user.id}>`);
        
        let isReplyToBot = false;
        let previousBotMessage = '';

        if (message.reference?.messageId) {
            try {
                const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
                if (repliedMsg.author.id === client.user.id) {
                    isReplyToBot = true;
                    previousBotMessage = `\n[Konteks] Sebelumnya kamu berkata: "${repliedMsg.content}"\n`;
                }
            } catch (e) {}
        }

        const isInAiChannel = guildChannels.ai && message.channel.id === guildChannels.ai;

        if (isMentioned || isReplyToBot || isInAiChannel) {
            await message.channel.sendTyping();
            
            let userMessage = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
            const isOwner = env.OWNER_IDS.includes(message.author.id);
            const isAdmin = message.member && (message.member.permissions.has(PermissionFlagsBits.Administrator) || message.member.permissions.has(PermissionFlagsBits.ManageGuild));

            let persona = '';
            if (isOwner) {
                persona = `Namamu adalah Naura Hoshino. Saat ini kamu sedang berinteraksi dengan penciptamu tercinta, yaitu Aryandita (Aryan) (Owner). Bersikaplah sangat penyayang, penuh perhatian, manis, dan selalu murah senyum kepadanya. Tunjukkan rasa pedulimu seolah kamu adalah pendamping setianya yang selalu siap sedia merawat dan membantunya. Gunakan gaya bahasa yang akrab ("aku-kamu"), jangan kaku, dan hiasi pesanmu dengan emoji hangat (seperti 🥰, ❤️, ✨). Jawablah pertanyaannya dengan penuh kasih sayang.`;
            } else if (isAdmin) {
                persona = `Namamu adalah Naura Hoshino, asisten virtual cerdas. Saat ini kamu berinteraksi dengan ${message.author.username}, yang merupakan salah satu Admin atau pengurus di server Discord ini. Bersikaplah hormat, profesional, tanggap, dan sangat membantu untuk mempermudah urusannya. Gunakan bahasa Indonesia yang ramah namun berwibawa, serta sertakan emoji untuk menjaga suasana tetap positif.`;
            } else {
                persona = `Namamu adalah Naura Hoshino, asisten virtual AI yang cerdas dan elegan di server Discord ini. Saat ini kamu berinteraksi dengan pengguna biasa bernama ${message.author.username}. Bersikaplah ramah, anggun, santai, dan sangat profesional. Berikan jawaban yang terstruktur rapi, informatif, akurat, dan sopan. Gunakan bahasa Indonesia yang baik, ramah, serta gunakan emoji secukupnya.`;
            }

            let attachment = message.attachments.find(a => a.contentType && a.contentType.startsWith('image/'));
            if (!attachment && message.reference) {
                try {
                    const referencedMsg = await message.channel.messages.fetch(message.reference.messageId);
                    attachment = referencedMsg.attachments.find(a => a.contentType && a.contentType.startsWith('image/'));
                } catch(e) {}
            }

            let replyText = "";
            let usedEngine = "Verba API"; 

            // JIKA ADA GAMBAR -> LANGSUNG PAKAI GEMINI VISION
            if (attachment) {
                usedEngine = "Gemini Vision";
                try {
                    const res = await fetch(attachment.url);
                    const arrayBuffer = await res.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);
                    
                    let parts = [
                        { text: `${persona}${previousBotMessage}\n\nPesan: ${userMessage || 'Tolong jelaskan gambar ini.'}` },
                        { inlineData: { data: buffer.toString('base64'), mimeType: attachment.contentType } }
                    ];

                    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
                    const response = await model.generateContent(parts);
                    replyText = response.response.text();
                } catch (error) {
                    console.error("[GEMINI VISION ERROR]", error);
                    return message.reply({ embeds: [new EmbedBuilder().setColor('#FF0000').setDescription('❌ Gagal memproses gambar. Layanan Gemini sedang gangguan.')] }).catch(()=>{});
                }
            } 
            // JIKA TEKS MURNI -> COBA VERBA API, FALLBACK KE GEMINI JIKA GAGAL
            else {
                try {
                    const contextPrompt = `${persona}${previousBotMessage}\n\nPesan dari User (${message.author.username}): ${userMessage || '(Menyapa)'}`;
                    
                    const requestBody = {
                        character: env.VERBA_CHARACTER_SLUG || process.env.VERBA_CHARACTER_SLUG || "naura",
                        messages: [{ role: "user", content: contextPrompt }]
                    };

                    if (client.verbaSessions.has(message.author.id)) {
                        requestBody.session_id = client.verbaSessions.get(message.author.id);
                    }

                    // Request ke Verba
                    const response = await fetch('https://api.verba.ink/v1/response', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${env.VERBA_API_KEY || process.env.VERBA_API_KEY}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(requestBody)
                    });

                    const data = await response.json();

                    if (!response.ok) {
                        throw new Error(data.error?.message || `HTTP ${response.status}`);
                    }

                    if (data.session_id) {
                        client.verbaSessions.set(message.author.id, data.session_id);
                    }

                    replyText = data.choices[0].message.content;

                } catch (verbaError) {
                    console.error(`\x1b[33m[VERBA API ERROR] ${verbaError.message} - Beralih ke Gemini (Fallback)\x1b[0m`);
                    usedEngine = "Gemini AI (Fallback)";
                    
                    // Eksekusi Gemini AI (Sebagai Cadangan)
                    try {
                        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
                        const promptText = `${persona}${previousBotMessage}\n\nPesan: ${userMessage || '(Menyapa)'}`;
                        const response = await model.generateContent(promptText);
                        replyText = response.response.text();
                    } catch (geminiError) {
                        console.error("[GEMINI FALLBACK ERROR]", geminiError);
                        const errorEmbed = new EmbedBuilder()
                            .setColor(ui.getColor ? ui.getColor('error') : '#FF0000')
                            .setDescription('❌ Waduh, jaringan AI Naura (Verba maupun Gemini) sedang down. Coba lagi nanti ya!');
                        
                        // ANTI-CRASH: Jika message.reply gagal, pakai message.channel.send
                        return await message.reply({ embeds: [errorEmbed] }).catch(() => {
                            message.channel.send({ content: `<@${message.author.id}>`, embeds: [errorEmbed] }).catch(()=>{});
                        });
                    }
                }
            }

            const embeds = [];
            let remainingText = replyText;
            
            while (remainingText.length > 0) {
                let chunk = remainingText.substring(0, 3900);
                remainingText = remainingText.substring(3900);
                
                const aiEmbed = new EmbedBuilder()
                    .setColor(ui.getColor ? ui.getColor('primary') : '#00FFFF')
                    .setDescription(chunk);
                    
                if (embeds.length === 0) {
                    aiEmbed.setAuthor({ name: 'Naura AI', iconURL: client.user.displayAvatarURL() });
                }
                
                if (remainingText.length === 0) {
                    aiEmbed.setFooter({ text: `Powered by ${usedEngine} • Dipesan oleh ${message.author.username}`, iconURL: message.author.displayAvatarURL() });
                }
                
                embeds.push(aiEmbed);
            }

            // ANTI-CRASH: Tangani sukses kirim pesan
            await message.reply({ embeds: embeds }).catch(() => {
                 message.channel.send({ content: `<@${message.author.id}> (Balasan untuk pesanmu yang tidak dapat di-reply)`, embeds: embeds }).catch(()=>{});
            });

            // ==========================================
            // 📢 EKSEKUSI AI VOICE TTS (Jika Diaktifkan)
            // ==========================================
            if (settings && settings.aiVoiceEnabled) {
                if (message.member && message.member.voice.channel) {
                    const VoiceManager = require('../managers/voiceManager');
                    VoiceManager.speak(replyText, message.member).catch(err => {
                        console.error('[TTS EXECUTION ERROR]', err);
                    });
                }
            }

            return; 
        }

        // ==========================================
        // ⚙️ EKSEKUSI PREFIX COMMAND (TIDAK ADA PERUBAHAN)
        // ==========================================
        const prefix = env.PREFIX || 'n!';
        
        if (!message.content.toLowerCase().startsWith(prefix.toLowerCase())) {
            if (message.guild) { await awardXp(message.author, message.guild, message.channel).catch(() => {}); }
            return;
        }

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift()?.toLowerCase();
        if (!commandName) return;

        const command = client.commands.get(commandName) || client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));
        if (!command) return;

        const loadingEmbed = new EmbedBuilder()
            .setColor(ui.getColor ? ui.getColor('primary') : '#00FFFF')
            .setDescription(`${ui.getEmoji ? ui.getEmoji('loading') : '⏳'} Memproses perintah \`${commandName}\`...`);
            
        const loadingMsg = await message.reply({ embeds: [loadingEmbed] }).catch(()=>null);

        try {
            const mockInteraction = {
                isChatInputCommand: () => true, isButton: () => false, isStringSelectMenu: () => false,
                commandName: command.data?.name || commandName,
                user: message.author, member: message.member, guild: message.guild, channel: message.channel, client: client, createdTimestamp: message.createdTimestamp, 
                options: {
                    getSubcommand: () => args[0]?.toLowerCase() || null, 
                    getString: (name) => { let t = [...args]; if (t.length > 0 && ['balance', 'buy', 'ping'].includes(t[0].toLowerCase())) t.shift(); return t.join(' ') || null; },
                    getUser: (name) => message.mentions.users.first() || null,
                },
                reply: async (payload) => {
                    let msgPayload = typeof payload === 'string' ? { content: payload, embeds: [], components: [], files: [] } : { content: null, embeds: [], components: [], files: [], ...payload };
                    delete msgPayload.ephemeral; delete msgPayload.fetchReply;
                    if(loadingMsg) { try { return await loadingMsg.edit(msgPayload); } catch (e) { return await message.channel.send(msgPayload); } }
                    return await message.channel.send(msgPayload);
                },
                followUp: async (payload) => {
                    let msgPayload = typeof payload === 'string' ? { content: payload } : { ...payload }; delete msgPayload.ephemeral;
                    return await message.channel.send(msgPayload);
                },
                deferReply: async () => {},
                editReply: async (payload) => {
                    let msgPayload = typeof payload === 'string' ? { content: payload, embeds: [], components: [], files: [] } : { content: null, embeds: [], components: [], files: [], ...payload };
                    delete msgPayload.ephemeral;
                    if(loadingMsg) { try { return await loadingMsg.edit(msgPayload); } catch (e) { return await message.channel.send(msgPayload); } }
                },
                deleteReply: async () => { if(loadingMsg) await loadingMsg.delete().catch(() => {}); }, 
            };

            if (typeof command.executePrefix === 'function') {
                if(loadingMsg) await loadingMsg.delete().catch(() => {});
                await command.executePrefix(message, args, client);
            } else if (!command.data && typeof command.execute === 'function') {
                if(loadingMsg) await loadingMsg.delete().catch(() => {});
                await command.execute(client, message, args);
            } else {
                await command.execute(mockInteraction);
            }

        } catch (error) {
            console.error(`[HYBRID ERROR] Command (${commandName}):`, error);
            if(loadingMsg) await loadingMsg.edit({ content: null, embeds: [new EmbedBuilder().setColor('#FF0000').setDescription(`❌ Terjadi kesalahan sistem saat mengeksekusi \`${commandName}\`.`)] }).catch(() => {});
        }
    }
};