'use strict';

/**
 * ruleSimulator.service.js
 *
 * Runs in-memory simulation of Rule AST against sample Event Payloads.
 *
 * GUARANTEES:
 *   - Pure in-memory execution using Phase 2 ScoreEngine & ConditionEvaluator
 *   - ZERO database mutations (0 writes to ScoreLedger, CompetitionState, GrandPointsLedger, etc.)
 *   - Detailed execution trace with condition matching, action evaluation, and pipelined score effects
 */

const conditionEvaluator = require('./conditionEvaluator.service');
const actionEvaluator = require('./actionEvaluator.service');
const scoreEngine = require('./scoreEngine.service');
const normalizer = require('./ruleBuilderNormalizer.service');
const ruleValidator = require('./ruleValidator.service');

/**
 * Execute simulated evaluation of an event payload against a rule set AST.
 *
 * @param {object} params
 * @param {Array<object>} params.astPayload       Rule definitions AST
 * @param {object} params.eventPayload            Simulated event payload / metadata
 * @param {object} [params.context]               Simulated context (actor, team, season)
 * @returns {object} Simulation report
 */
function simulateRules({ astPayload, eventPayload, context = {} }) {
  if (!eventPayload || typeof eventPayload !== 'object') {
    throw new Error('Simulation requires an eventPayload object');
  }

  // 1. Normalize and validate AST payload
  const normalizedRules = normalizer.normalizeAstPayload(astPayload);

  // 2. Build mock evaluation context
  const occurredAt = eventPayload.occurred_at ? new Date(eventPayload.occurred_at) : new Date();
  const actorId = eventPayload.actor_id ?? context.actor?.id ?? 1;
  const teamId = eventPayload.team_id ?? context.team?.id ?? 1;
  const eventType = eventPayload.event_type || eventPayload.type || 'SIMULATED_EVENT';
  const payloadData = eventPayload.payload || eventPayload;

  const mockContext = {
    event: {
      id: 'sim_event_001',
      event_type: eventType,
      actor_id: actorId,
      team_id: teamId,
      payload: payloadData,
      occurred_at: occurredAt,
      source_module: eventPayload.source_module || 'SIMULATOR',
      aggregate_type: eventPayload.aggregate_type || 'TEST',
      aggregate_id: eventPayload.aggregate_id || 'test_001',
    },
    context: {
      actor: {
        id: actorId,
        name: context.actor?.name || `User #${actorId}`,
        role: context.actor?.role || 'member',
        ...context.actor,
      },
      team: {
        id: teamId,
        name: context.team?.name || `Team #${teamId}`,
        ...context.team,
      },
      season: {
        id: context.season?.id || 1,
        name: context.season?.name || 'Simulation Season',
        status: context.season?.status || 'ACTIVE',
        ...context.season,
      },
    },
  };

  // 3. Evaluate each rule deterministically
  const executionTrace = [];
  const allGeneratedEffects = [];
  let totalUserPoints = 0;
  let totalTeamScore = 0;

  for (let i = 0; i < normalizedRules.length; i++) {
    const rule = normalizedRules[i];
    const ruleSummary = normalizer.generateHumanReadableSummary(rule);

    // Evaluate condition
    let matched = false;
    let conditionError = null;

    try {
      matched = conditionEvaluator.evaluate(rule.condition_ast ?? null, mockContext);
    } catch (err) {
      conditionError = err.message;
      matched = false;
    }

    const traceItem = {
      ruleIndex: i,
      ruleName: rule.name || `Rule #${i + 1}`,
      ruleSummary,
      matched,
      conditionError,
      effects: [],
    };

    if (matched) {
      try {
        const evalResult = scoreEngine.evaluateRule(rule, mockContext);
        traceItem.effects = evalResult.effects;

        for (const eff of evalResult.effects) {
          allGeneratedEffects.push({
            ruleIndex: i,
            ruleName: rule.name || `Rule #${i + 1}`,
            ...eff,
          });

          if (eff.targetType === 'USER') {
            totalUserPoints += eff.delta || 0;
          } else if (eff.targetType === 'TEAM') {
            totalTeamScore += eff.delta || 0;
          }
        }
      } catch (err) {
        traceItem.evaluationError = err.message;
      }
    }

    executionTrace.push(traceItem);
  }

  return {
    success: true,
    rulesEvaluated: normalizedRules.length,
    matchedRulesCount: executionTrace.filter((t) => t.matched).length,
    totalUserPoints,
    totalTeamScore,
    generatedEffects: allGeneratedEffects,
    executionTrace,
    evaluationContext: {
      eventType,
      actorId,
      teamId,
      occurredAt,
    },
  };
}

module.exports = {
  simulateRules,
};
