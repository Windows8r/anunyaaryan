const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas'); // Menggunakan mesin baru
const GuildSettings = require('../models/GuildSettings');

module.exports = {
    name: 'guildMemberAdd',
    async execute(member, client) {
        if (member.user.bot) return;

        // Mengambil data Welcome dari pengaturan database
        let welcomeChannelId = null;
        let welcomeData = null;
        try {
            const settings = await GuildSettings.findOne({ where: { guildId: member.guild.id } });
            welcomeData = settings?.settings?.greetings?.welcome;
            
            // Cek apakah fitur diaktifkan dan ada channelnya
            if (welcomeData?.enabled && welcomeData?.channelId) {
                welcomeChannelId = welcomeData.channelId;
            }
        } catch (e) {
            console.error("Gagal mengambil data welcome:", e);
        }

        // ==========================================
        // 🛡️ SISTEM AUTO ROLE
        // ==========================================
        try {
            const autoRole = settings?.settings?.autoRole;
            if (autoRole) {
                const role = member.guild.roles.cache.get(autoRole);
                if (role) await member.roles.add(role);
            }
        } catch (e) {
            console.error("Gagal memberikan auto role:", e);
        }

        if (!welcomeChannelId) return; // Hentikan jika fitur nonaktif/belum disetup
        const channel = member.guild.channels.cache.get(welcomeChannelId);
        if (!channel) return; 

        try {
            // ==========================================
            // 🎨 PEMBUATAN KANVAS (TEMA: PINK PASTEL FUTURISTIK)
            // ==========================================
            const canvas = createCanvas(1024, 450);
            const ctx = canvas.getContext('2d');

            // 1. Background (Gradient Pink Pastel ke Cyberpunk Dark Blue)
            const gradient = ctx.createLinearGradient(0, 0, 1024, 450);
            gradient.addColorStop(0, '#FFB6C1'); // Light Pink Pastel
            gradient.addColorStop(0.5, '#FF69B4'); // Hot Pink
            gradient.addColorStop(1, '#1A1A2E'); // Dark Futuristic Blue/Black
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 2. Pola Garis Futuristik (Neon Grid Tipis)
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 2;
            for (let i = 0; i < 1024; i += 50) {
                ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 450); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(1024, i); ctx.stroke();
            }

            // 3. Efek Glow (Shadow) pada Avatar
            const avatarX = 512;
            const avatarY = 180;
            const avatarRadius = 100;

            ctx.shadowColor = '#FFFFFF';
            ctx.shadowBlur = 20;
            ctx.beginPath();
            ctx.arc(avatarX, avatarY, avatarRadius + 5, 0, Math.PI * 2, true);
            ctx.fillStyle = '#FFFFFF';
            ctx.fill();
            ctx.shadowBlur = 0; // Reset shadow untuk elemen berikutnya

            // 4. Memotong & Memasukkan Avatar User (Bulat)
            ctx.save();
            ctx.beginPath();
            ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();

            const avatar = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 256 }));
            ctx.drawImage(avatar, avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2);
            ctx.restore();

            // 5. Tipografi Modern & Bersih
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            
            ctx.font = 'bold 50px sans-serif'; 
            ctx.fillText(`WELCOME TO THE SERVER`, 512, 350);
            
            // Nama dengan warna aksen menonjol
            ctx.font = 'bold 40px sans-serif';
            ctx.fillStyle = '#FFD700'; // Warna Emas/Kuning
            ctx.fillText(member.user.username.toUpperCase(), 512, 400);

            // Statistik Member
            ctx.font = '25px sans-serif';
            ctx.fillStyle = '#E0E0E0';
            ctx.fillText(`Member #${member.guild.memberCount}`, 512, 435);

            // Bungkus dalam AttachmentBuilder Discord
            const attachment = new AttachmentBuilder(canvas.toBuffer('image/png'), { name: `welcome-${member.user.id}.png` });

            // ==========================================
            // ✉️ PENGIRIMAN PESAN
            // ==========================================
            // Parsing Custom Message dari Dashboard
            let customText = welcomeData?.message;
            if (customText) {
                customText = customText
                    .replace(/{user}/g, `<@${member.user.id}>`)
                    .replace(/{server}/g, member.guild.name)
                    .replace(/{count}/g, member.guild.memberCount);

                const ui = require('../config/ui');
                customText = customText.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, p1) => {
                    const emoji = ui.getEmoji(p1);
                    return emoji && emoji !== '💠' ? emoji : match;
                });
            } else {
                customText = `Selamat datang di **${member.guild.name}**!\nAku Naura Versi 1.0.0, asisten yang dikembangkan oleh Developer Aryan.\n\nJangan lupa baca peraturan server dan selamat bersenang-senang!`;
            }

            const welcomeEmbed = new EmbedBuilder()
                .setColor(welcomeData?.color || '#FFB6C1')
                .setTitle(`Halo, ${member.user.username}! ✨`)
                .setDescription(customText)
                .setFooter({ text: 'Sistem Keamanan & Penyambutan Naura' });

            // Cek apakah admin menyalakan fitur gambar di dashboard
            if (welcomeData?.image !== false) {
                welcomeEmbed.setImage(`attachment://welcome-${member.user.id}.png`);
                await channel.send({ content: `<@${member.user.id}>`, embeds: [welcomeEmbed], files: [attachment] }).catch(() => {});
            } else {
                await channel.send({ content: `<@${member.user.id}>`, embeds: [welcomeEmbed] }).catch(() => {});
            }
            
        } catch (error) {
            console.error('\x1b[31m[GFX ERROR]\x1b[0m Gagal membuat Welcome Image:', error);
        }
    },
};
