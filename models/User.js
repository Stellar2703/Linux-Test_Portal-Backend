const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  level: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  register_number: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
}, {
  tableName: 'users',
  timestamps: false, // Assuming no createdAt/updatedAt in the table
});

module.exports = User;
