const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LevelMaster = sequelize.define('LevelMaster', {
  level: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  ip: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  tableName: 'levelmaster',
  timestamps: false,
});

module.exports = LevelMaster;
