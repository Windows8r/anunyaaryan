const { GoogleGenerativeAI } = require('@google/generative-ai');
const ui = require('../config/ui');

class AIManager {
    constructor() {
        // Inisialisasi Gemini AI (Tetap digunakan khusus untuk membaca gambar/Vision)
        this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ 
            model: 'gemini-2.5-flash',
            systemInstruction: "Nama kamu adalah Naura Hoshino, asisten Discord virtual yang ceria, ramah, dan sangat pintar. Kamu diciptakan dan dikelola oleh Aryandita. Kamu suka menggunakan emoji dalam setiap kalimat. Gunakan bahasa Indonesia yang santai, gaul, namun tetap sopan dan sangat membantu."
        });

        // Memisahkan ruang memori: satu untuk Gemini (Gambar) dan satu untuk Verba (Teks)
        this.geminiSessions = new Map(); 
        this.verbaSessions = new Map(); 
        
        // TTL Cleanup loop (berjalan setiap 5 menit)
        setInterval(() => this.cleanupSessions(), 5 * 60 * 1000);
    }

    cleanupSessions() {
        const now = Date.now();
        // Bersihkan sesi Gemini
        for (const [userId, sessionData] of this.geminiSessions.entries()) {
            if (now - sessionData.lastAccess > 3600000) {
                this.geminiSessions.delete(userId);
            }
        }
        // Bersihkan sesi Verba
        for (const [userId, sessionData] of this.verbaSessions.entries()) {
            if (now - sessionData.lastAccess > 3600000) {
                this.verbaSessions.delete(userId);
            }
        }
    }

    async handleMessage(message, prompt) {
        const userId = message.author.id;

        try {
            // Indikator bot sedang "mengetik" di Discord
            await message.channel.sendTyping();
            
            // Cek apakah ada attachment gambar
            let attachment = message.attachments.find(a => a.contentType && a.contentType.startsWith('image/'));
            if (!attachment && message.reference) {
                try {
                    const referencedMsg = await message.channel.messages.fetch(message.reference.messageId);
                    attachment = referencedMsg.attachments.find(a => a.contentType && a.contentType.startsWith('image/'));
                } catch(e) { /* ignore error fetch reply */ }
            }
            
            let responseText = "";

            // ==========================================
            // LOGIKA 1: JIKA ADA GAMBAR -> PAKA GEMINI
            // ==========================================
            if (attachment) {
                if (!this.geminiSessions.has(userId)) {
                    const chatSession = this.model.startChat({
                        history: [],
                        generationConfig: { maxOutputTokens: 1500 },
                    });
                    this.geminiSessions.set(userId, { chat: chatSession, lastAccess: Date.now() });
                }

                const sessionData = this.geminiSessions.get(userId);
                sessionData.lastAccess = Date.now();
                const chat = sessionData.chat;

                try {
                    const res = await fetch(attachment.url);
                    const arrayBuffer = await res.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);
                    
                    const messageParts = [
                        prompt || "Tolong jelaskan gambar ini.",
                        {
                            inlineData: {
                                data: buffer.toString('base64'),
                                mimeType: attachment.contentType
                            }
                        }
                    ];
                    
                    const result = await chat.sendMessage(messageParts);
                    responseText = result.response.text();
                } catch (e) {
                    console.error("Gagal memproses gambar untuk Vision:", e);
                    responseText = `${ui.emojis?.error || '❌'} Aduh, Naura gagal melihat gambarnya. Coba kirim ulang ya!`;
                }
            } 
            // ==========================================
            // LOGIKA 2: JIKA MURNI TEKS -> PAKAI VERBA API
            // ==========================================
            else {
                const requestBody = {
                    character: process.env.VERBA_CHARACTER_SLUG || "naura",
                    messages: [{ role: "user", content: prompt }]
                };

                // Ambil memori Verba jika ada
                if (this.verbaSessions.has(userId)) {
                    requestBody.session_id = this.verbaSessions.get(userId).sessionId;
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

                if (!response.ok) {
                    throw new Error(data.error?.message || 'Gagal tersambung ke API Verba');
                }

                // Update memori Verba
                if (data.session_id) {
                    this.verbaSessions.set(userId, { sessionId: data.session_id, lastAccess: Date.now() });
                } else if (this.verbaSessions.has(userId)) {
                    this.verbaSessions.get(userId).lastAccess = Date.now();
                }

                responseText = data.choices[0].message.content;
            }

            // ==========================================
            // PEMECAH PESAN (CHUNKING)
            // ==========================================
            const chunks = [];
            let currentChunk = '';
            const lines = responseText.split('\n');
            
            for (const line of lines) {
                if (currentChunk.length + line.length + 1 > 1950) {
                    chunks.push(currentChunk);
                    currentChunk = line + '\n';
                } else {
                    currentChunk += line + '\n';
                }
            }
            if (currentChunk.trim()) chunks.push(currentChunk);

            // Balas pesan user secara berurutan
            for (let i = 0; i < chunks.length; i++) {
                if (i === 0) {
                    await message.reply(chunks[i]);
                } else {
                    await message.channel.send(chunks[i]);
                }
            }

        } catch (error) {
            console.error('\x1b[31m[AI ERROR]\x1b[0m Gagal merespons:', error);
            await message.reply(`${ui.emojis?.error || '❌'} Aduh, kepala Naura tiba-tiba pusing. Coba tanya lagi nanti ya!`);
        }
    }
}

module.exports = new AIManager();