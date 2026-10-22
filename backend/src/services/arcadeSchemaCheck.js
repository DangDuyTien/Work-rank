'use strict';
const { DataTypes } = require('sequelize');
const { ArcadeRoom, ArcadePlayer } = require('../models');
async function ensureArcadeSchema(sequelize) {
  await ArcadeRoom.sync();
  await ArcadePlayer.sync();
  await require('../migrations/20261021140000-arcade-ux-rules-and-rematch').up(sequelize.getQueryInterface(), DataTypes);
}
module.exports = { ensureArcadeSchema };
