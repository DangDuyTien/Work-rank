'use strict';

/**
 * challenge.service.js
 *
 * Challenge domain service.
 */

const { Challenge, Season, Team } = require('../../models');

async function createChallenge(seasonId, data) {
  const { code, title, description, type = 'RACE', targetValue = 10, config, startAt, endAt } = data;

  if (!code || !title) throw new Error('Challenge requires code and title');

  const season = await Season.findByPk(seasonId);
  if (!season) throw new Error(`Season #${seasonId} not found`);

  return Challenge.create({
    seasonId,
    code,
    title,
    description,
    type,
    targetValue,
    config: config ?? null,
    startAt: startAt ? new Date(startAt) : season.startAt,
    endAt: endAt ? new Date(endAt) : season.endAt,
    status: 'ACTIVE',
  });
}

async function listChallengesForSeason(seasonId) {
  return Challenge.findAll({
    where: { seasonId },
    order: [['created_at', 'ASC']],
  });
}

async function updateChallengeStatus(challengeId, status, completedByTeamId = null) {
  const challenge = await Challenge.findByPk(challengeId);
  if (!challenge) throw new Error(`Challenge #${challengeId} not found`);

  challenge.status = status;
  if (completedByTeamId) {
    challenge.completedByTeamId = completedByTeamId;
    challenge.completedAt = new Date();
  }
  await challenge.save();
  return challenge;
}

module.exports = {
  createChallenge,
  listChallengesForSeason,
  updateChallengeStatus,
};
