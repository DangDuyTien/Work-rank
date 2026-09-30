'use strict';

const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class CompetitionState extends Model {}

CompetitionState.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    seasonId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
      field: 'season_id',
    },
    entityId: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      field: 'entity_id',
    },
    entityType: {
      type: DataTypes.ENUM('user', 'team'),
      allowNull: false,
      field: 'entity_type',
    },
    stateKey: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'state_key',
    },
    dataJson: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
      field: 'data_json',
    },
    version: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 1,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'expires_at',
    },
  },
  {
    sequelize,
    modelName: 'CompetitionState',
    tableName: 'competition_states',
    underscored: true,
  },
);

module.exports = CompetitionState;
