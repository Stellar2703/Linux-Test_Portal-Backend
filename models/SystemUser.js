const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SystemUser = sequelize.define('SystemUser', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  level: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  tableName: 'system_user',
  timestamps: false,
});

module.exports = SystemUser;
