const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TaskDescription = sequelize.define('TaskDescription', {
  username: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  task1: DataTypes.STRING,
  task2: DataTypes.STRING,
  task3: DataTypes.STRING,
  task4: DataTypes.STRING,
  task5: DataTypes.STRING,
  task6: DataTypes.STRING,
  task7: DataTypes.STRING,
  task8: DataTypes.STRING,
  task9: DataTypes.STRING,
  task10: DataTypes.STRING,
}, {
  tableName: 'task_description',
  timestamps: false,
});

module.exports = TaskDescription;
