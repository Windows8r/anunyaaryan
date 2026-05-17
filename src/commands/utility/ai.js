const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const translate = require('@iamtraction/google-translate');
const google = require('googlethis');
const ui = require('../../config/ui');
const UserProfile = require('../../models/UserProfile');

// ==========================================
// 🧠 INISIALISASI GEMINI (Dipertahankan)
// ==========================================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash',
    systemInstruction: "Kamu adalah Naura Hoshino..." // Sesuaikan dengan prompt aslimu
});

// Memori percakapan murni untuk Verba API
const verbaSessions = new Map();

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ai')
        .setDescription('🤖 Asisten Pintar Naura: Chat, Gambar, Translate, dan Search')
        .addSubcommand(sub => sub.setName('chat')
            .setDescription('Ngobrol santai atau tanya apa saja ke AI Naura.')
            .addStringOption(opt => opt.setName('pesan').setDescription('Pesan untuk Naura').setRequired(true)))
        .addSubcommand(sub => sub.setName('imagine')
            .setDescription('Buat gambar berkualitas tinggi.')
            .addStringOption(opt => opt.setName('prompt').setDescription('Deskripsi gambar').setRequired(true)))
        .addSubcommand(sub => sub.setName('translate')
            .setDescription('Terjemahkan teks ke bahasa lain.')
            .addStringOption(opt => opt.setName('teks').setDescription('Teksnya').setRequired(true))
            .addStringOption(opt => opt.setName('ke_bahasa').setDescription('Kode bahasa (id, en, ja)').setRequired(true)))
        .addSubcommand(sub => sub.setName('search')
            .setDescription('Cari informasi di Google.')
            .addStringOption(opt => opt.setName('kueri').setDescription('Kata kunci').setRequired(true))),

    async execute(interaction) {
        await interaction.deferReply();
        const subcommand = interaction.options.getSubcommand();
        const pinkColor = '#FFB6C1'; 

        try {
            if (subcommand === 'chat') {
                const prompt = interaction.options.getString('pesan');
                const userId = interaction.user.id;
                const username = interaction.user.username;
                const displayName = interaction.member?.displayName || username;

                // --- MENGGUNAKAN VERBA API ---
                const isOwner = process.env.OWNER_IDS && process.env.OWNER_IDS.includes(userId);
                const isAdmin = interaction.member && (interaction.member.permissions.has('Administrator') || interaction.member.permissions.has('ManageGuild'));

                let persona = '';
                if (isOwner) {
                    persona = `Namamu adalah Naura Hoshino. Saat ini kamu sedang berinteraksi dengan penciptamu tercinta, yaitu Aryandita (Aryan) (Owner). Bersikaplah sangat penyayang, penuh perhatian, manis, dan selalu murah senyum kepadanya. Tunjukkan rasa pedulimu seolah kamu adalah pendamping setianya yang selalu siap sedia merawat dan membantunya. Gunakan gaya bahasa yang akrab ("aku-kamu"), jangan kaku, dan hiasi pesanmu dengan emoji hangat (seperti 🥰, ❤️, ✨). Jawablah pertanyaannya dengan penuh kasih sayang.`;
                } else if (isAdmin) {
                    persona = `Namamu adalah Naura Hoshino, asisten virtual cerdas. Saat ini kamu berinteraksi dengan ${username}, yang merupakan salah satu Admin atau pengurus di server Discord ini. Bersikaplah hormat, profesional, tanggap, dan sangat membantu untuk mempermudah urusannya. Gunakan bahasa Indonesia yang ramah namun berwibawa, serta sertakan emoji untuk menjaga suasana tetap positif.`;
                } else {
                    persona = `Namamu adalah Naura Hoshino, asisten virtual AI yang cerdas dan elegan di server Discord ini. Saat ini kamu berinteraksi dengan pengguna biasa bernama ${username}. Bersikaplah ramah, anggun, santai, dan sangat profesional. Berikan jawaban yang terstruktur rapi, informatif, akurat, dan sopan. Gunakan bahasa Indonesia yang baik, ramah, serta gunakan emoji secukupnya.`;
                }

                const contextPrompt = `${persona}\n\n[Pesan dari User: ${displayName}]: ${prompt}`;
                
                let responseText = "";
                let usedEngine = "Verba API";

                try {
                    const requestBody = {
                        character: process.env.VERBA_CHARACTER_SLUG || "naura",
                        messages: [{ role: "user", content: contextPrompt }]
                    };

                    if (verbaSessions.has(userId)) {
                        requestBody.session_id = verbaSessions.get(userId);
                    }

                    const response = await fetch('https://api.verba.ink/v1/response', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${process.env.VERBA_API_KEY}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(requestBody)
                    });

                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error?.message || 'Gagal tersambung ke API Verba');
                    if (data.session_id) verbaSessions.set(userId, data.session_id);
                    responseText = data.choices[0].message.content;
                } catch (verbaError) {
                    console.error(`\x1b[33m[VERBA API ERROR] ${verbaError.message} - Beralih ke Gemini (Fallback)\x1b[0m`);
                    usedEngine = "Gemini AI (Fallback)";
                    const geminiResponse = await model.generateContent(contextPrompt);
                    responseText = geminiResponse.response.text();
                }

                const embeds = [];
                let remainingText = responseText;
                
                while (remainingText.length > 0) {
                    let chunk = remainingText.substring(0, 3900);
                    remainingText = remainingText.substring(3900);
                    
                    const aiEmbed = new EmbedBuilder()
                        .setColor(ui.getColor('accent') || '#FF69B4')
                        .setDescription(chunk);
                        
                    if (embeds.length === 0) {
                        aiEmbed.setAuthor({ name: '✨ Naura Hoshino Intelligence', iconURL: interaction.client.user.displayAvatarURL() });
                    }
                    if (remainingText.length === 0) {
                        aiEmbed.setFooter({ text: `Powered by ${usedEngine} • Diminta oleh ${displayName}`, iconURL: interaction.user.displayAvatarURL() }).setTimestamp();
                    }
                    embeds.push(aiEmbed);
                }

                return interaction.editReply({ embeds: embeds });
            }

            else if (subcommand === 'imagine') {
                // ... (Kodingan asli imagine milikmu tidak diubah sama sekali)
                const userId = interaction.user.id;
                let [profile] = await UserProfile.findOrCreate({ where: { userId } });
                if (!profile.isPremium || !profile.premiumUntil || profile.premiumUntil <= new Date()) {
                    return interaction.editReply({ 
                        embeds: [
                            new EmbedBuilder()
                                .setColor(ui.getColor('error') || '#FF0000')
                                .setTitle('💎 Fitur V.I.P Terkunci')
                                .setDescription(`❌ | Akses ditolak! Pembuatan gambar resolusi tinggi memakan daya pemrosesan server yang besar. Ini adalah fitur eksklusif untuk member **Premium**.`)
                        ] 
                    });
                }
                const prompt = interaction.options.getString('prompt');
                let imageUrl = "";
                let imageSource = "Verba Image API";

                try {
                    const response = await fetch('https://api.verba.ink/v1/image', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${process.env.VERBA_API_KEY}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ prompt: prompt })
                    });
                    
                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error?.message || "Gagal ke Verba Image");
                    
                    // Mencari URL pada berbagai format response standar OpenAI / Verba
                    imageUrl = data.url || data.image || (data.data && data.data[0] && data.data[0].url) || (data.choices && data.choices[0] && data.choices[0].url) || data.imageUrl || data.image_url;
                    
                    if (!imageUrl) throw new Error("Format JSON API Gambar Verba tidak dikenali.");
                } catch (e) {
                    console.error("Verba Imagine Error:", e);
                    imageSource = "Pollinations AI (Fallback)";
                    imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&enhance=true`;
                }

                const embed = new EmbedBuilder()
                    .setColor(pinkColor)
                    .setAuthor({ name: '🎨 Naura Art Studio', iconURL: interaction.client.user.displayAvatarURL() })
                    .setDescription(`Kanvas telah selesai dilukis oleh AI!\n\n> 🖌️ **Prompt:** *${prompt}*`)
                    .setImage(imageUrl)
                    .setFooter({ text: `Rendered with High Definition AI • ${imageSource}` });

                return interaction.editReply({ embeds: [embed] });
            }

            else if (subcommand === 'translate') {
                // ... (Kodingan asli translate milikmu tidak diubah sama sekali)
                const teks = interaction.options.getString('teks');
                const targetLang = interaction.options.getString('ke_bahasa').toLowerCase();
                const hasil = await translate(teks, { to: targetLang });

                const embed = new EmbedBuilder()
                    .setColor(pinkColor)
                    .setAuthor({ name: '🌐 Naura Global Translator', iconURL: interaction.client.user.displayAvatarURL() })
                    .setDescription(`Teks berhasil diterjemahkan ke **${targetLang.toUpperCase()}**! ✨`)
                    .addFields(
                        { name: `📝 Teks Asli`, value: `\`\`\`${teks}\`\`\`` },
                        { name: `✅ Hasil Terjemahan`, value: `\`\`\`${hasil.text}\`\`\`` }
                    )
                    .setFooter({ text: 'Powered by Advanced Neural Translation' });

                return interaction.editReply({ embeds: [embed] });
            }

            else if (subcommand === 'search') {
                // ... (Kodingan asli search milikmu tidak diubah sama sekali)
                const query = interaction.options.getString('kueri');
                const hasilSearch = await google.search(query, { safe: false });

                const embed = new EmbedBuilder()
                    .setColor(pinkColor)
                    .setAuthor({ name: `🔍 Intelijen Pencarian Web: ${query}`, iconURL: interaction.client.user.displayAvatarURL() });

                let deskripsi = `Naura telah menjelajahi internet dan menemukan data berikut:\n\n`;
                
                if (hasilSearch.results && hasilSearch.results.length > 0) {
                    hasilSearch.results.slice(0, 3).forEach((res, index) => {
                        deskripsi += `**${index + 1}. [${res.title}](${res.url})**\n> ${res.description}\n\n`;
                    });
                } else {
                    deskripsi = "> ❌ *Aduh, Naura tidak menemukan kecocokan data apapun di database internet global...*";
                }

                embed.setDescription(deskripsi)
                     .setFooter({ text: 'Naura Search Protocol' });
                return interaction.editReply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('AI Error:', error);
            return interaction.editReply(`❌ Aduh, Naura pusing! Ada error: \`${error.message}\``);
        }
    }
};