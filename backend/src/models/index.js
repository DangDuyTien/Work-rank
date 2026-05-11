const sequelize = require('../config/database');
const Team = require('./Team');
const User = require('./User');
const Device = require('./Device');
const WorkSession = require('./WorkSession');
const ActivityEvent = require('./ActivityEvent');
const DailyStat = require('./DailyStat');

Team.hasMany(User, { foreignKey: 'teamId' });
User.belongsTo(Team, { foreignKey: 'teamId' });

User.hasMany(Device, { foreignKey: 'userId' });
Device.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(WorkSession, { foreignKey: 'userId' });
Device.hasMany(WorkSession, { foreignKey: 'deviceId' });
WorkSession.belongsTo(User, { foreignKey: 'userId' });
WorkSession.belongsTo(Device, { foreignKey: 'deviceId' });

User.hasMany(ActivityEvent, { foreignKey: 'userId' });
Device.hasMany(ActivityEvent, { foreignKey: 'deviceId' });
WorkSession.hasMany(ActivityEvent, { foreignKey: 'sessionId' });
ActivityEvent.belongsTo(User, { foreignKey: 'userId' });
ActivityEvent.belongsTo(Device, { foreignKey: 'deviceId' });
ActivityEvent.belongsTo(WorkSession, { foreignKey: 'sessionId' });

User.hasMany(DailyStat, { foreignKey: 'userId' });
DailyStat.belongsTo(User, { foreignKey: 'userId' });

module.exports = { sequelize, Team, User, Device, WorkSession, ActivityEvent, DailyStat };
