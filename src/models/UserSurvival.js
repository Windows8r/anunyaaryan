// Lokasi: src/models/UserSurvival.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../managers/dbManager');

const UserSurvival = sequelize.define('UserSurvival', {
    userId: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
    },
    hunger: {
        type: DataTypes.INTEGER,
        defaultValue: 100
    },
    thirst: {
        type: DataTypes.INTEGER,
        defaultValue: 100
    },
    // ✨ INI ADALAH KOLOM BARU YANG DIBUTUHKAN UNTUK MEMPERBAIKI ERROR
    hp: {
        type: DataTypes.INTEGER,
        defaultValue: 100
    },
    stamina: {
        type: DataTypes.INTEGER,
        defaultValue: 100
    },
    strength: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    agility: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    intelligence: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    luck: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    survival_xp: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    survival_level: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    inGameDay: {
        type: DataTypes.INTEGER,
        defaultValue: 1
    },
    inGameHour: {
        type: DataTypes.INTEGER,
        defaultValue: 6
    },
    propertyId: {
        type: DataTypes.STRING,
        defaultValue: 'jalanan'
    },
    currentLocation: {
        type: DataTypes.STRING,
        defaultValue: 'jalanan'
    },
    vehicle: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'UserSurvivals',
    timestamps: true
});

module.exports = UserSurvival;