const { DataTypes } = require('sequelize');
const { sequelize } = require('../managers/dbManager');

const UserNPC = sequelize.define('UserNPC', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    userId: { 
        type: DataTypes.STRING, 
        allowNull: false 
    },
    npcId: { type: DataTypes.STRING, allowNull: false }, // misal: 'blacksmith_john', 'mayor_lucy'
    
    // --- RELATIONSHIP SYSTEM ---
    relationshipLevel: { type: DataTypes.INTEGER, defaultValue: 0 }, // Poin afeksi
    isMarried: { type: DataTypes.BOOLEAN, defaultValue: false },
    
    // --- QUEST SYSTEM ---
    activeQuest: { type: DataTypes.STRING, allowNull: true }, // ID Quest yang sedang dikerjakan
    questProgress: { type: DataTypes.JSON, defaultValue: {} } // JSON fleksibel (misal: { kayu_dikumpulkan: 5 })
});

module.exports = UserNPC;