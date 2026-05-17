// Lokasi: src/config/items.js

const items = [
    // ==========================================
    // 💼 KATEGORI: BOOSTER (Ekonomi & Kerja)
    // ==========================================
    { id: 'basic_shovel', name: 'Sekop Biasa', description: 'Sekop standar biar kerjanya lebih cepet.', price: 500, multiplier: 1.2, category: 'booster', rarity: 'common' },
    { id: 'steel_pickaxe', name: 'Beliung Baja', description: 'Beliung kuat buat nambang koin.', price: 2000, multiplier: 1.5, category: 'booster', rarity: 'uncommon' },
    { id: 'enchanted_gloves', name: 'Sarung Tangan Ajaib', description: 'Bisa nemuin koin nyelip pas lagi kerja.', price: 5000, multiplier: 2.0, category: 'booster', rarity: 'rare' },
    { id: 'lucky_charm', name: 'Jimat Keberuntungan', description: 'Jimat kecil penarik rezeki.', price: 10000, multiplier: 2.5, category: 'booster', rarity: 'rare' },
    { id: 'laptop_gaming', name: 'Laptop Gaming', description: 'Kerja WFH jadi lebih ngebut dan gampang dapet koin!', price: 15000, multiplier: 3.0, category: 'booster', rarity: 'epic' },
    { id: 'vip_card', name: 'Kartu VIP', description: 'Kartu eksklusif buat member sultan.', price: 25000, multiplier: 4.0, category: 'booster', rarity: 'epic' },
    { id: 'golden_ticket', name: 'Tiket Emas', description: 'Tiket misterius yang konon bikin auto kaya.', price: 50000, multiplier: 5.0, category: 'booster', rarity: 'legendary' },

    // ==========================================
    // 🪵 KATEGORI: MATERIALS (Bahan Crafting & Upgrade)
    // ==========================================
    { id: 'wood', name: 'Kayu', description: 'Bahan dasar untuk crafting berbagai benda.', price: 100, sellPrice: 20, category: 'material', rarity: 'common' },
    { id: 'stone', name: 'Batu', description: 'Batu keras, berguna untuk membuat alat yang lebih kuat.', price: 150, sellPrice: 30, category: 'material', rarity: 'common' },
    { id: 'iron_ore', name: 'Bijih Besi', description: 'Besi mentah yang bisa dilebur menjadi senjata/armor.', price: 400, sellPrice: 150, category: 'material', rarity: 'uncommon' },
    { id: 'fiber', name: 'Serat Tumbuhan', description: 'Digunakan untuk membuat tali atau kain.', price: 50, sellPrice: 10, category: 'material', rarity: 'common' },
    { id: 'naura_shard', name: 'Naura Magic Shard', description: 'Batu kristal menyala yang menyimpan kekuatan sihir. Diperlukan untuk Upgrade di Blacksmith!', price: 5000, sellPrice: 1000, category: 'material', rarity: 'mythic' },
    { id: 'silver_ore', name: 'Bijih Perak', description: 'Material berharga untuk membuat perhiasan.', price: 1200, sellPrice: 500, category: 'material', rarity: 'rare' }, // ✨ ITEM BARU 1
    { id: 'mythril_ore', name: 'Bijih Mythril', description: 'Material ajaib yang sangat ringan tapi keras.', price: 4500, sellPrice: 2000, category: 'material', rarity: 'epic' }, // ✨ ITEM BARU 2

    // ==========================================
    // 🍔 KATEGORI: CONSUMABLES (Makanan & Minuman)
    // ==========================================
    { id: 'apple', name: 'Apel Segar', description: 'Buah manis dari hutan. Mengisi +15 Lapar.', price: 150, category: 'consumable', effects: { hunger: 15, stamina: 5 }, rarity: 'common' },
    { id: 'mineral_water', name: 'Air Mineral', description: 'Sangat menyegarkan. Mengisi +25 Haus.', price: 100, category: 'consumable', effects: { thirst: 25, stamina: 5 }, rarity: 'common' },
    { id: 'cooked_meat', name: 'Daging Bakar', description: 'Sangat mengenyangkan! Mengisi +40 Lapar.', price: 500, category: 'consumable', effects: { hunger: 40, stamina: 10 }, rarity: 'uncommon' },
    { id: 'energy_drink', name: 'Minuman Energi', description: 'Menambah stamina dengan drastis. +20 Haus & +40 Stamina.', price: 800, category: 'consumable', effects: { thirst: 20, stamina: 40 }, rarity: 'uncommon' },
    { id: 'potato', name: 'Kentang', description: 'Karbohidrat tinggi.', category: 'consumable', effects: { hunger: 20, stamina: 5 }, rarity: 'common' },
    { id: 'pizza_slice', name: 'Potongan Pizza', description: 'Makanan cepat saji lezat.', price: 1200, category: 'consumable', effects: { hunger: 50, stamina: 20 }, rarity: 'rare' }, // ✨ ITEM BARU 3
    { id: 'elixir_of_life', name: 'Elixir Kehidupan', description: 'Minuman para dewa.', price: 10000, category: 'consumable', effects: { hunger: 100, thirst: 100, stamina: 100, hp: 500 }, rarity: 'mythic' }, // ✨ ITEM BARU 4

    // ==========================================
    // ⚔️ KATEGORI: DUNGEON SUPPLIES (Medkit & Potion)
    // ==========================================
    { id: 'bandage', name: 'Perban Medis', description: 'Mengobati luka ringan di Dungeon. Memulihkan +30 HP.', price: 300, category: 'consumable', effects: { hp: 30 }, rarity: 'common' },
    { id: 'health_potion', name: 'Ramuan Penyembuh (Merah)', description: 'Ramuan ajaib dari alkemis. Memulihkan +100 HP di Dungeon.', price: 1500, category: 'consumable', effects: { hp: 100 }, rarity: 'rare' },
    { id: 'mega_potion', name: 'Ramuan Mega (Emas)', description: 'Ramuan legendaris. Memulihkan +300 HP!', price: 4000, category: 'consumable', effects: { hp: 300 }, rarity: 'epic' }, // ✨ ITEM BARU 5

    // --- BENIH PERTANIAN ---
    { id: 'seed_wheat', name: 'Benih Gandum', description: 'Tumbuh dalam 1 hari in-game.', category: 'seed', rarity: 'common' },
    { id: 'seed_potato', name: 'Benih Kentang', description: 'Tumbuh dalam 2 hari in-game.', category: 'seed', rarity: 'common' },
    { id: 'seed_apple', name: 'Benih Pohon Apel', description: 'Tumbuh dalam 3 hari in-game.', category: 'seed', rarity: 'uncommon' },
    
    // --- HASIL PANEN ---
    { id: 'wheat', name: 'Gandum Segar', description: 'Bisa dijual atau dicrafting menjadi Roti.', category: 'material', rarity: 'common' },

    // ==========================================
    // 🐾 KATEGORI: PET FOOD (Makanan Hewan)
    // ==========================================
    { id: 'bone', name: 'Tulang Segar', description: 'Gunakan ini saat bertemu Serigala/Anjing di hutan.', price: 300, category: 'pet_food', targetPet: 'wolf', rarity: 'common' },
    { id: 'small_fish', name: 'Ikan Kecil', description: 'Bisa dimakan, tapi lebih cocok diberikan ke Kucing liar.', price: 200, category: 'pet_food', targetPet: 'cat', effects: { hunger: 5, stamina: 2 }, rarity: 'common' },
    { id: 'mystic_herb', name: 'Tanaman Mistis', description: 'Sangat disukai oleh hewan-hewan magis.', price: 2500, category: 'pet_food', targetPet: 'rare', rarity: 'rare' },
    { id: 'dragon_meat', name: 'Daging Naga', description: 'Daging langka untuk menjinakkan Naga.', price: 15000, category: 'pet_food', targetPet: 'dragon', rarity: 'mythic' }, // ✨ ITEM BARU 6

    // ==========================================
    // 🐟 KATEGORI: LOOT (Hasil Pancing & Tambang)
    // ==========================================
    { id: 'trash', name: 'Sampah Plastik', description: 'Tidak berguna, tapi bisa dijual ke pengepul.', price: 10, sellPrice: 2, category: 'loot', rarity: 'common' },
    { id: 'salmon', name: 'Ikan Salmon', description: 'Ikan bergizi tinggi. Bisa dimakan (+20 Lapar) atau dijual.', price: 600, sellPrice: 300, category: 'loot', effects: { hunger: 20, stamina: 5 }, rarity: 'uncommon' },
    { id: 'diamond', name: 'Berlian Mentah', description: 'Sangat berharga dan bersinar!', price: 20000, sellPrice: 15000, category: 'material', rarity: 'legendary' },
    { id: 'golden_fish', name: 'Ikan Mas Koki', description: 'Ikan keberuntungan.', price: 5000, sellPrice: 2500, category: 'loot', rarity: 'rare' }, // ✨ ITEM BARU 7

    // ==========================================
    // ⛏️ KATEGORI: TOOLS & WEAPONS (Alat Survival Khusus)
    // ==========================================
    { id: 'fishing_rod', name: 'Alat Pancing (Lv. 1)', description: 'Dibutuhkan untuk memancing ikan di laut.', price: 1500, category: 'tools', upgrade_level: 1, base_efficiency: 10, rarity: 'common' },
    
    // --- KAPAK (GATHERING) ---
    { id: 'wooden_axe', name: 'Kapak Kayu (Lv. 1)', description: 'Dibutuhkan untuk mendapatkan kayu di hutan.', price: 800, category: 'tools', upgrade_level: 1, base_efficiency: 10, rarity: 'common' },
    { id: 'iron_axe', name: 'Kapak Besi (Lv. 1)', description: 'Kapak berat yang mempercepat penebangan pohon.', price: 3000, category: 'tools', upgrade_level: 1, base_efficiency: 30, rarity: 'uncommon' },
    { id: 'diamond_axe', name: 'Kapak Berlian (Lv. 1)', description: 'Kapak tajam tak terkalahkan untuk panen kayu massal.', price: 45000, category: 'tools', upgrade_level: 1, base_efficiency: 100, rarity: 'epic' },

    // --- SENJATA (DUNGEON) ---
    { id: 'iron_sword', name: 'Pedang Besi (Lv. 1)', description: 'Senjata tajam untuk menebas monster di Dungeon.', price: 5000, category: 'tools', upgrade_level: 1, base_damage: 20, rarity: 'uncommon' },
    { id: 'diamond_sword', name: 'Pedang Berlian (Lv. 1)', description: 'Pedang berkilau mematikan. Menghancurkan musuh dalam sekejap!', price: 60000, category: 'tools', upgrade_level: 1, base_damage: 80, rarity: 'legendary' },
    { id: 'flaming_sword', name: 'Pedang Api Neraka', description: 'Pedang legendaris yang membakar musuh.', price: 150000, category: 'tools', upgrade_level: 5, base_damage: 150, rarity: 'mythic' }, // ✨ ITEM BARU 8

    // --- LOOT MONSTER ---
    { id: 'slime_gel', name: 'Gel Slime', description: 'Cairan lengket dari Slime. Laku dijual mahal.', category: 'material', rarity: 'common' },
    { id: 'goblin_ear', name: 'Telinga Goblin', description: 'Bukti kamu telah mengalahkan Goblin.', category: 'material', rarity: 'uncommon' },
    { id: 'dragon_scale', name: 'Sisik Naga', description: 'Harta karun super langka dari dasar Dungeon!', category: 'material', rarity: 'legendary' },
    { id: 'demon_horn', name: 'Tanduk Iblis', description: 'Tanduk kuat dari iblis kuno.', category: 'material', rarity: 'mythic' }, // ✨ ITEM BARU 9

    // ==========================================
    // 💍 KATEGORI: SPECIAL ITEMS
    // ==========================================
    { id: 'marriage_ring', name: 'Cincin Berlian Nikah', description: 'Cincin indah untuk melamar kandidat istri impianmu.', price: 50000, category: 'special', rarity: 'legendary' },
    { id: 'dating_ticket', name: 'Tiket Amusement Park', description: 'Tiket masuk sepasang kekasih untuk kencan romantis di taman hiburan.', price: 5000, category: 'special', rarity: 'rare' },
    { id: 'gacha_ticket', name: 'Tiket Gacha Premium', description: 'Gunakan ini di mesin Gacha untuk item eksklusif.', price: 10000, category: 'special', rarity: 'epic' } // ✨ ITEM BARU 10
];

module.exports = items;