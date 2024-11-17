const express = require('express');
const router = express.Router();
const User = require('../models/User');
const LevelMaster = require('../models/LevelMaster');
const SystemUser = require('../models/SystemUser');
const TaskDescription = require('../models/TaskDescription');
const sequelize = require('../config/database'); // Sequelize instance

router.post('/login', async (req, res) => {
  const { register_number } = req.body;

  try {
    const user = await User.findOne({ where: { register_number } });
    if (!user) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const { level, username: studentName } = user;

    const levelInfo = await LevelMaster.findOne({ where: { level } });
    if (!levelInfo) {
      return res.status(404).json({ error: 'Level information not found' });
    }

    const { ip } = levelInfo;

    const systemUser = await SystemUser.findOne({
      where: { level },
      order: sequelize.random(),
    });

    if (!systemUser) {
      return res.status(404).json({ error: 'No Ubuntu system user found for this level' });
    }

    const { username: systemUsername, password } = systemUser;

    const tasks = await TaskDescription.findOne({
      where: { username: systemUsername },
    });

    if (!tasks) {
      return res.status(404).json({ error: 'No tasks found for the selected system user' });
    }

    res.json({
      student: {
        name: studentName,
        level,
        register_number,
      },
      system: {
        ip,
        user: {
          username: systemUsername,
          password,
        },
      },
      tasks,
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
