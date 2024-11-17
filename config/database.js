const { Sequelize } = require('sequelize');

const sequelize = new Sequelize('linux', 'test', 'test', {
  host: 'localhost',
  dialect: 'mysql',
  port: 3307,
});

sequelize.authenticate()
  .then(() => console.log('Database connected successfully.'))
  .catch((err) => console.error('Unable to connect to the database:', err));

module.exports = sequelize;
