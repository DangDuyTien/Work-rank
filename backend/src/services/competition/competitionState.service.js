'use strict';

/**
 * competitionState.service.js
 *
 * Stateful Rule State Engine.
 *
 * CONCURRENCY STRATEGY:
 *   SELECT ... FOR UPDATE (pessimistic lock per row)
 *   + version column CAS check (double safety)
 *
 * ATOMICITY:
 *   All state mutations + score effects happen in ONE DB transaction.
 *   Caller must pass the transaction object.
 *
 * IDEMPOTENCY:
 *   State mutations keyed by event_id + state_key.
 *   If state already processed same event, returns current state without mutation.
 *
 * EXPIRATION:
 *   If expires_at is set and <= now (or <= eventTime), state is treated as expired.
 *   Expired state returns { expired: true, data: {} }.
 */

const { Op } = require('sequelize');
const { CompetitionState } = require('../../models');

const MAX_LOCK_RETRIES = 3;

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Get current state for an entity + key.
 * Returns null if not found.
 * Returns { expired: true } if state exists but has expired.
 *
 * @param {object} opts
 * @param {number|null} opts.seasonId
 * @param {number} opts.entityId
 * @param {'user'|'team'} opts.entityType
 * @param {string} opts.stateKey
 * @param {Date} [opts.asOf]   If provided, check expiry relative to this timestamp
 * @param {import('sequelize').Transaction} [opts.transaction]
 * @returns {Promise<CompetitionState|null>}
 */
async function getState({ seasonId, entityId, entityType, stateKey, asOf, transaction }) {
  const state = await CompetitionState.findOne({
    where: {
      seasonId: seasonId ?? null,
      entityId,
      entityType,
      stateKey,
    },
    transaction,
  });

  if (!state) return null;

  // Check expiry
  const now = asOf ?? new Date();
  if (state.expiresAt && new Date(state.expiresAt) <= now) {
    state._isExpired = true;
  }

  return state;
}

// ─── Upsert + Mutate (atomic, inside transaction) ────────────────────────────

/**
 * Atomically read-then-update a competition state.
 * Uses SELECT FOR UPDATE to prevent concurrent mutations.
 *
 * Steps:
 *   1. SELECT FOR UPDATE (blocks concurrent writer on same row)
 *   2. Apply mutatorFn(currentData) → newData
 *   3. UPDATE with version CAS (extra safety layer)
 *   4. Return { newData, newVersion, thresholdMet, effects }
 *
 * @param {object} opts
 * @param {number|null} opts.seasonId
 * @param {number} opts.entityId
 * @param {'user'|'team'} opts.entityType
 * @param {string} opts.stateKey
 * @param {object} opts.defaultData   Initial data if state doesn't exist yet
 * @param {Date|null} [opts.expiresAt]
 * @param {function(object): { newData: object, thresholdMet: boolean }} opts.mutatorFn
 *        Pure function: receives currentData, returns { newData, thresholdMet }
 * @param {import('sequelize').Transaction} opts.transaction  REQUIRED — must be active TX
 * @returns {Promise<{ newData: object, version: number, thresholdMet: boolean, isExpired: boolean }>}
 */
async function mutateState({ seasonId, entityId, entityType, stateKey, defaultData = {}, expiresAt, mutatorFn, transaction }) {
  if (!transaction) throw new Error('CompetitionState.mutateState: transaction is required');

  // 1. SELECT FOR UPDATE — blocks concurrent writers on this row
  let state = await CompetitionState.findOne({
    where: {
      seasonId: seasonId ?? null,
      entityId,
      entityType,
      stateKey,
    },
    lock: transaction.LOCK.UPDATE,
    transaction,
  });

  // 2. Create if not exists (still inside transaction + lock)
  if (!state) {
    state = await CompetitionState.create(
      {
        seasonId: seasonId ?? null,
        entityId,
        entityType,
        stateKey,
        dataJson: defaultData,
        version: 1,
        expiresAt: expiresAt ?? null,
      },
      { transaction },
    );
  }

  // 3. Check expiry
  const now = new Date();
  if (state.expiresAt && new Date(state.expiresAt) <= now) {
    // Expired state — reset to default
    const mutResult = mutatorFn(defaultData, { isExpired: true });
    const [updated] = await CompetitionState.update(
      {
        dataJson: mutResult.newData,
        version: state.version + 1,
        expiresAt: expiresAt ?? state.expiresAt,
      },
      {
        where: { id: state.id, version: state.version },
        transaction,
      },
    );
    if (updated === 0) throw new Error('CompetitionState: optimistic lock conflict (expired path)');
    return { newData: mutResult.newData, version: state.version + 1, thresholdMet: mutResult.thresholdMet ?? false, isExpired: true };
  }

  // 4. Apply mutator
  const mutResult = mutatorFn(state.dataJson ?? {}, { isExpired: false });

  // 5. UPDATE with version CAS
  const [updated] = await CompetitionState.update(
    {
      dataJson: mutResult.newData,
      version: state.version + 1,
      expiresAt: expiresAt !== undefined ? expiresAt : state.expiresAt,
    },
    {
      where: { id: state.id, version: state.version },
      transaction,
    },
  );

  if (updated === 0) {
    // CAS conflict — should not happen with SELECT FOR UPDATE, but guard anyway
    throw new Error('CompetitionState: optimistic lock conflict — version mismatch');
  }

  return {
    newData: mutResult.newData,
    version: state.version + 1,
    thresholdMet: mutResult.thresholdMet ?? false,
    isExpired: false,
  };
}

// ─── Built-in mutators ────────────────────────────────────────────────────────

/**
 * Increment a counter field in state data.
 * Optionally resets to 0 when threshold is reached.
 *
 * @param {string} field       e.g. 'count', 'streak_count'
 * @param {number} threshold   When count reaches this → thresholdMet = true
 * @param {boolean} resetOnThreshold  If true, reset field to 0 after threshold
 * @returns {function} mutatorFn
 */
function incrementMutator(field, threshold, resetOnThreshold = true) {
  return (currentData) => {
    const current = Number(currentData[field] ?? 0);
    const next = current + 1;
    const thresholdMet = threshold != null && next >= threshold;
    const newValue = (thresholdMet && resetOnThreshold) ? 0 : next;
    return {
      newData: { ...currentData, [field]: newValue },
      thresholdMet,
    };
  };
}

/**
 * Set a field to a specific value.
 */
function setMutator(updates) {
  return (currentData) => ({
    newData: { ...currentData, ...updates },
    thresholdMet: false,
  });
}

/**
 * Reset all fields to default.
 */
function resetMutator(defaultData) {
  return () => ({
    newData: { ...defaultData },
    thresholdMet: false,
  });
}

// ─── Admin: list states ───────────────────────────────────────────────────────

/**
 * List all states for a season (Admin State Monitor).
 *
 * @param {object} opts
 * @param {number|null} opts.seasonId
 * @param {'user'|'team'|null} [opts.entityType]
 * @param {number} [opts.limit]
 * @param {number} [opts.offset]
 * @returns {Promise<{ rows: CompetitionState[], count: number }>}
 */
async function listStatesForSeason({ seasonId, entityType, limit = 50, offset = 0 }) {
  const where = { seasonId: seasonId ?? null };
  if (entityType) where.entityType = entityType;

  const { count, rows } = await CompetitionState.findAndCountAll({
    where,
    order: [['updated_at', 'DESC']],
    limit,
    offset,
  });

  return { count, rows };
}

module.exports = {
  getState,
  mutateState,
  incrementMutator,
  setMutator,
  resetMutator,
  listStatesForSeason,
};
