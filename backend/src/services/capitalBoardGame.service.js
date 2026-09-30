'use strict';

const { Op } = require('sequelize');
const {
  sequelize,
  User,
  GameRoom,
  GamePlayer,
  GameProperty,
  GameEvent,
  GameTransaction,
  GameResult,
  GameLeaderboardProfile,
  UserProfilePreference,
} = require('../models');
const {
  STARTING_CASH,
  START_PASS_BONUS,
  TURN_TIMEOUT_SECONDS,
  MAX_TURNS_LIMIT,
  CAREER_REWARDS,
  SEAT_COLORS,
  PREDEFINED_EVENTS,
  BOARD_TILES,
} = require('../config/capitalBoardTemplate');
const gameRealtime = require('./gameRealtime.service');

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'CB-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function sanitizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    jobTitle: user.jobTitle,
    department: user.department,
    isVerified: user.isVerified,
    isDev: user.isDev,
    avatarData: user.UserProfilePreference?.avatarData || null,
  };
}

class CapitalBoardGameService {
  /**
   * List waiting and active rooms for the lobby
   */
  async listRooms({ limit = 30 } = {}) {
    const rooms = await GameRoom.findAll({
      where: {
        status: { [Op.in]: ['WAITING', 'PLAYING'] },
      },
      include: [
        { model: User, as: 'Host', attributes: ['id', 'name', 'email', 'jobTitle', 'isVerified', 'isDev'] },
        {
          model: GamePlayer,
          as: 'players',
          include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'jobTitle', 'isVerified', 'isDev'] }],
        },
      ],
      order: [
        [sequelize.literal("CASE WHEN status = 'WAITING' THEN 1 ELSE 2 END"), 'ASC'],
        ['createdAt', 'DESC'],
      ],
      limit,
    });

    return rooms.map((room) => ({
      id: room.id,
      code: room.code,
      title: room.title,
      host: sanitizeUser(room.Host),
      status: room.status,
      maxPlayers: room.maxPlayers,
      playerCount: room.players.length,
      players: room.players.map((p) => ({
        id: p.id,
        userId: p.userId,
        seatIndex: p.seatIndex,
        color: p.color,
        user: sanitizeUser(p.user),
      })),
      createdAt: room.createdAt,
    }));
  }

  /**
   * Find if current user has an ongoing match or waiting room
   */
  async getActiveRoomForUser(userId) {
    const activePlayer = await GamePlayer.findOne({
      where: {
        userId,
        status: { [Op.in]: ['WAITING', 'ACTIVE'] },
      },
      include: [
        {
          model: GameRoom,
          as: 'room',
          where: { status: { [Op.in]: ['WAITING', 'PLAYING'] } },
        },
      ],
    });

    if (!activePlayer || !activePlayer.room) {
      return null;
    }

    return this.getRoomState(activePlayer.room.id, userId);
  }

  /**
   * Get full authoritative state of a room
   */
  async getRoomState(roomId, currentUserId = null) {
    const room = await GameRoom.findByPk(roomId, {
      include: [
        { model: User, as: 'Host', attributes: ['id', 'name', 'email', 'jobTitle', 'isVerified', 'isDev'] },
        { model: User, as: 'Winner', attributes: ['id', 'name', 'email', 'jobTitle', 'isVerified', 'isDev'] },
        {
          model: GamePlayer,
          as: 'players',
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['id', 'name', 'email', 'jobTitle', 'isVerified', 'isDev'],
              include: [{ model: UserProfilePreference, attributes: ['avatarData'], required: false }],
            },
          ],
        },
        { model: GameProperty, as: 'properties' },
        {
          model: GameEvent,
          as: 'events',
          limit: 30,
          order: [['createdAt', 'DESC']],
        },
      ],
    });

    if (!room) return null;

    // Check if turn timer expired and automatically handle timeout
    if (room.status === 'PLAYING' && room.turnDeadline && new Date() > new Date(room.turnDeadline)) {
      try {
        await this.handleTurnTimeout(room.id);
        return this.getRoomState(roomId, currentUserId);
      } catch (err) {
        console.error('Failed auto-handling turn timeout:', err);
      }
    }

    // Sort players by seat index
    const sortedPlayers = [...room.players].sort((a, b) => a.seatIndex - b.seatIndex);

    // Calculate dynamic net worths for all players
    const playersWithNetWorth = sortedPlayers.map((p) => {
      const ownedProps = room.properties.filter((prop) => Number(prop.ownerUserId) === Number(p.userId));
      const propertyValue = ownedProps.reduce((sum, prop) => sum + Number(prop.price || 0), 0);
      const netWorth = Number(p.cash || 0) + propertyValue;

      return {
        id: p.id,
        userId: p.userId,
        seatIndex: p.seatIndex,
        color: p.color,
        position: p.position,
        cash: p.cash,
        propertyValue,
        netWorth,
        status: p.status,
        rank: p.rank,
        finalCash: p.finalCash,
        finalPropertyValue: p.finalPropertyValue,
        finalNetWorth: p.finalNetWorth,
        user: sanitizeUser(p.user),
        isCurrentTurn: Number(room.currentTurnPlayerId) === Number(p.userId),
      };
    });

    return {
      id: room.id,
      code: room.code,
      title: room.title,
      host: sanitizeUser(room.Host),
      status: room.status,
      maxPlayers: room.maxPlayers,
      currentTurnPlayerId: room.currentTurnPlayerId,
      turnNumber: room.turnNumber,
      turnDeadline: room.turnDeadline,
      winner: sanitizeUser(room.Winner),
      startedAt: room.startedAt,
      finishedAt: room.finishedAt,
      lastDiceResult: room.lastDiceResult,
      turnState: room.turnState || { rolled: false, canBuy: false, currentTileIndex: 0 },
      players: playersWithNetWorth,
      properties: room.properties.map((prop) => ({
        id: prop.id,
        tileIndex: prop.tileIndex,
        propertyKey: prop.propertyKey,
        propertyName: prop.propertyName,
        price: prop.price,
        rent: prop.rent,
        groupKey: prop.groupKey,
        groupColor: prop.groupColor,
        ownerUserId: prop.ownerUserId,
      })),
      events: room.events.map((ev) => ({
        id: ev.id,
        type: ev.type,
        actorUserId: ev.actorUserId,
        payload: ev.payload,
        createdAt: ev.createdAt,
      })),
      boardTiles: BOARD_TILES,
    };
  }

  /**
   * Create a new room
   */
  async createRoom({ hostUserId, title, maxPlayers = 4 }) {
    return await sequelize.transaction(async (t) => {
      // Check if user is already playing in another active match
      const activeMatch = await GamePlayer.findOne({
        where: { userId: hostUserId, status: 'ACTIVE' },
        include: [{ model: GameRoom, as: 'room', where: { status: 'PLAYING' } }],
        transaction: t,
      });
      if (activeMatch) {
        throw new Error('Bạn đang tham gia một trận đấu chưa kết thúc. Vui lòng hoàn thành trận đấu hiện tại.');
      }

      // Generate unique room code
      let code = generateRoomCode();
      while (await GameRoom.findOne({ where: { code }, transaction: t })) {
        code = generateRoomCode();
      }

      const room = await GameRoom.create(
        {
          code,
          title: title?.trim() || `Phòng Cờ Tỷ Phú #${code}`,
          hostUserId,
          status: 'WAITING',
          maxPlayers: Math.min(4, Math.max(2, Number(maxPlayers) || 4)),
        },
        { transaction: t }
      );

      // Create Host as Player 1 (seatIndex 0)
      await GamePlayer.create(
        {
          roomId: room.id,
          userId: hostUserId,
          seatIndex: 0,
          color: SEAT_COLORS[0],
          cash: STARTING_CASH,
          status: 'WAITING',
        },
        { transaction: t }
      );

      await GameEvent.create(
        {
          roomId: room.id,
          turnNumber: 1,
          type: 'ROOM_CREATED',
          actorUserId: hostUserId,
          payload: { title: room.title, code: room.code },
        },
        { transaction: t }
      );

      // Broadcast new room to lobby
      setImmediate(() => {
        gameRealtime.emitToRoom(room.id, 'game:roomUpdated', { roomId: room.id, code: room.code });
      });

      return room;
    });
  }

  /**
   * Join an existing room
   */
  async joinRoom(roomId, userId) {
    return await sequelize.transaction(async (t) => {
      const room = await GameRoom.findByPk(roomId, {
        include: [{ model: GamePlayer, as: 'players' }],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!room) throw new Error('Không tìm thấy phòng game.');
      if (room.status !== 'WAITING') throw new Error('Phòng game đã bắt đầu hoặc đã kết thúc.');

      // Check if already in room (idempotent join)
      const existing = room.players.find((p) => Number(p.userId) === Number(userId));
      if (existing) {
        return room;
      }

      if (room.players.length >= room.maxPlayers) {
        throw new Error('Phòng game đã đủ người chơi.');
      }

      // Check if user is already playing in another active match
      const activeMatch = await GamePlayer.findOne({
        where: { userId, status: 'ACTIVE' },
        include: [{ model: GameRoom, as: 'room', where: { status: 'PLAYING' } }],
        transaction: t,
      });
      if (activeMatch) {
        throw new Error('Bạn đang tham gia một trận đấu khác. Vui lòng hoàn thành trận đấu hiện tại.');
      }

      // Allocate next available seat index
      const takenSeats = new Set(room.players.map((p) => p.seatIndex));
      let seatIndex = 0;
      while (takenSeats.has(seatIndex) && seatIndex < 4) {
        seatIndex++;
      }

      const player = await GamePlayer.create(
        {
          roomId: room.id,
          userId,
          seatIndex,
          color: SEAT_COLORS[seatIndex] || '#38bdf8',
          cash: STARTING_CASH,
          status: 'WAITING',
        },
        { transaction: t }
      );

      const user = await User.findByPk(userId, { transaction: t });

      await GameEvent.create(
        {
          roomId: room.id,
          turnNumber: 1,
          type: 'PLAYER_JOINED',
          actorUserId: userId,
          payload: { name: user?.name, seatIndex },
        },
        { transaction: t }
      );

      setImmediate(() => {
        gameRealtime.emitToRoom(room.id, 'game:playerJoined', { roomId: room.id, userId, seatIndex, name: user?.name });
        gameRealtime.emitToRoom(room.id, 'game:roomUpdated', { roomId: room.id });
      });

      return room;
    });
  }

  /**
   * Leave a room (in lobby or during game)
   */
  async leaveRoom(roomId, userId) {
    return await sequelize.transaction(async (t) => {
      const room = await GameRoom.findByPk(roomId, {
        include: [{ model: GamePlayer, as: 'players' }],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!room) throw new Error('Không tìm thấy phòng game.');

      const player = room.players.find((p) => Number(p.userId) === Number(userId));
      if (!player) return { ok: true };

      if (room.status === 'WAITING') {
        // In lobby: remove player directly
        await player.destroy({ transaction: t });

        const remaining = room.players.filter((p) => Number(p.userId) !== Number(userId));
        if (remaining.length === 0) {
          room.status = 'ABANDONED';
          await room.save({ transaction: t });
        } else if (Number(room.hostUserId) === Number(userId)) {
          // Transfer host to next player
          room.hostUserId = remaining[0].userId;
          await room.save({ transaction: t });
        }

        await GameEvent.create(
          {
            roomId: room.id,
            turnNumber: 1,
            type: 'PLAYER_LEFT',
            actorUserId: userId,
            payload: { userId },
          },
          { transaction: t }
        );

        setImmediate(() => {
          gameRealtime.emitToRoom(room.id, 'game:playerLeft', { roomId: room.id, userId });
          gameRealtime.emitToRoom(room.id, 'game:roomUpdated', { roomId: room.id });
        });

        return { ok: true, roomStatus: room.status };
      }

      if (room.status === 'PLAYING') {
        // In active game: surrender
        player.status = 'SURRENDERED';
        player.finalCash = player.cash;
        await player.save({ transaction: t });

        // Release properties owned by surrendered player
        await GameProperty.update(
          { ownerUserId: null },
          { where: { roomId: room.id, ownerUserId: userId }, transaction: t }
        );

        await GameEvent.create(
          {
            roomId: room.id,
            turnNumber: room.turnNumber,
            type: 'BANKRUPTCY',
            actorUserId: userId,
            payload: { reason: 'Người chơi đã đầu hàng / rời trận đấu.' },
          },
          { transaction: t }
        );

        // Check if only 1 solvent player remains
        const activeSolvent = room.players.filter(
          (p) => Number(p.userId) !== Number(userId) && p.status === 'ACTIVE'
        );

        if (activeSolvent.length <= 1) {
          await this.settleGameFinish(room, t);
        } else if (Number(room.currentTurnPlayerId) === Number(userId)) {
          await this.advanceTurnInternal(room, t);
        }

        setImmediate(() => {
          gameRealtime.emitToRoom(room.id, 'game:bankrupt', { roomId: room.id, userId });
          gameRealtime.emitToRoom(room.id, 'game:roomUpdated', { roomId: room.id });
        });

        return { ok: true, status: 'SURRENDERED' };
      }

      return { ok: true };
    });
  }

  /**
   * Host starts the game
   */
  async startGame(roomId, userId) {
    return await sequelize.transaction(async (t) => {
      const room = await GameRoom.findByPk(roomId, {
        include: [{ model: GamePlayer, as: 'players' }],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!room) throw new Error('Không tìm thấy phòng game.');
      if (Number(room.hostUserId) !== Number(userId)) {
        throw new Error('Chỉ chủ phòng (Host) mới có quyền bắt đầu trận đấu.');
      }
      if (room.status !== 'WAITING') {
        throw new Error('Trận đấu đã bắt đầu hoặc đã kết thúc.');
      }
      if (room.players.length < 2) {
        throw new Error('Cần tối thiểu 2 người chơi để bắt đầu trận đấu.');
      }

      // Seed properties into game_properties
      const propertyTiles = BOARD_TILES.filter((tile) => tile.type === 'PROPERTY');
      for (const prop of propertyTiles) {
        await GameProperty.create(
          {
            roomId: room.id,
            tileIndex: prop.index,
            propertyKey: prop.key,
            propertyName: prop.name,
            price: prop.price,
            rent: prop.rent,
            groupKey: prop.group,
            groupColor: prop.color,
            ownerUserId: null,
          },
          { transaction: t }
        );
      }

      // Set all players to ACTIVE
      for (const player of room.players) {
        player.status = 'ACTIVE';
        player.cash = STARTING_CASH;
        player.position = 0;
        await player.save({ transaction: t });
      }

      // Pick first player by lowest seat index
      const firstPlayer = [...room.players].sort((a, b) => a.seatIndex - b.seatIndex)[0];

      room.status = 'PLAYING';
      room.startedAt = new Date();
      room.currentTurnPlayerId = firstPlayer.userId;
      room.turnNumber = 1;
      room.turnDeadline = new Date(Date.now() + TURN_TIMEOUT_SECONDS * 1000);
      room.turnState = {
        rolled: false,
        dice: null,
        canBuy: false,
        currentTileIndex: 0,
      };

      await room.save({ transaction: t });

      await GameEvent.create(
        {
          roomId: room.id,
          turnNumber: 1,
          type: 'GAME_STARTED',
          actorUserId: userId,
          payload: { firstTurnUserId: firstPlayer.userId },
        },
        { transaction: t }
      );

      setImmediate(() => {
        gameRealtime.emitToRoom(room.id, 'game:started', { roomId: room.id, firstTurnUserId: firstPlayer.userId });
        gameRealtime.emitToRoom(room.id, 'game:roomUpdated', { roomId: room.id });
      });

      return room;
    });
  }

  /**
   * Roll Dice Action (Server-Authoritative)
   */
  async rollDice(roomId, userId) {
    return await sequelize.transaction(async (t) => {
      const room = await GameRoom.findByPk(roomId, {
        include: [
          { model: GamePlayer, as: 'players' },
          { model: GameProperty, as: 'properties' },
        ],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!room) throw new Error('Không tìm thấy phòng game.');
      if (room.status !== 'PLAYING') throw new Error('Trận đấu không ở trạng thái đang diễn ra.');
      if (Number(room.currentTurnPlayerId) !== Number(userId)) {
        throw new Error('Chưa tới lượt đi của bạn.');
      }

      const turnState = room.turnState || {};
      if (turnState.rolled) {
        throw new Error('Bạn đã gieo xúc xắc trong lượt này rồi.');
      }

      const player = room.players.find((p) => Number(p.userId) === Number(userId));
      if (!player || player.status !== 'ACTIVE') {
        throw new Error('Người chơi không ở trạng thái hoạt động.');
      }

      // Server generates authoritative dice (2 dice: 1-6 each)
      const die1 = Math.floor(Math.random() * 6) + 1;
      const die2 = Math.floor(Math.random() * 6) + 1;
      const totalDice = die1 + die2;

      const oldPosition = Number(player.position || 0);
      const newPosition = (oldPosition + totalDice) % 28;
      const passedStart = oldPosition + totalDice >= 28;

      // 1. Handle START pass bonus (+$200)
      if (passedStart) {
        const balanceBefore = player.cash;
        player.cash += START_PASS_BONUS;
        await GameTransaction.create(
          {
            roomId: room.id,
            userId: player.userId,
            type: 'START_BONUS',
            amount: START_PASS_BONUS,
            balanceBefore,
            balanceAfter: player.cash,
          },
          { transaction: t }
        );
        await GameEvent.create(
          {
            roomId: room.id,
            turnNumber: room.turnNumber,
            type: 'START_BONUS',
            actorUserId: player.userId,
            payload: { amount: START_PASS_BONUS },
          },
          { transaction: t }
        );
      }

      player.position = newPosition;

      // 2. Evaluate landed tile
      const tile = BOARD_TILES[newPosition];
      let canBuy = false;
      let landedProperty = null;
      let eventResult = null;

      if (tile.type === 'PROPERTY') {
        landedProperty = room.properties.find((p) => p.tileIndex === newPosition);
        if (landedProperty) {
          if (!landedProperty.ownerUserId) {
            // Unowned: allow player to buy if sufficient cash
            canBuy = player.cash >= landedProperty.price;
          } else if (Number(landedProperty.ownerUserId) !== Number(player.userId)) {
            // Owned by another player: Pay Rent
            const owner = room.players.find((p) => Number(p.userId) === Number(landedProperty.ownerUserId));
            const rentAmount = landedProperty.rent;

            if (owner && owner.status === 'ACTIVE') {
              if (player.cash < rentAmount) {
                // Bankrupt!
                const paidAll = Math.max(0, player.cash);
                owner.cash += paidAll;
                player.cash = 0;
                player.status = 'BANKRUPT';

                await GameTransaction.create(
                  {
                    roomId: room.id,
                    userId: player.userId,
                    type: 'RENT_PAID',
                    amount: -paidAll,
                    balanceBefore: paidAll,
                    balanceAfter: 0,
                    referenceType: 'PROPERTY',
                    referenceId: String(landedProperty.id),
                  },
                  { transaction: t }
                );

                await owner.save({ transaction: t });
                await this.handlePlayerBankruptcy(room, player, t);
              } else {
                // Solvent rent payment
                const payerBefore = player.cash;
                player.cash -= rentAmount;
                const ownerBefore = owner.cash;
                owner.cash += rentAmount;

                await GameTransaction.create(
                  {
                    roomId: room.id,
                    userId: player.userId,
                    type: 'RENT_PAID',
                    amount: -rentAmount,
                    balanceBefore: payerBefore,
                    balanceAfter: player.cash,
                    referenceType: 'PROPERTY',
                    referenceId: String(landedProperty.id),
                  },
                  { transaction: t }
                );

                await GameTransaction.create(
                  {
                    roomId: room.id,
                    userId: owner.userId,
                    type: 'RENT_RECEIVED',
                    amount: rentAmount,
                    balanceBefore: ownerBefore,
                    balanceAfter: owner.cash,
                    referenceType: 'PROPERTY',
                    referenceId: String(landedProperty.id),
                  },
                  { transaction: t }
                );

                await GameEvent.create(
                  {
                    roomId: room.id,
                    turnNumber: room.turnNumber,
                    type: 'RENT_PAID',
                    actorUserId: player.userId,
                    payload: {
                      propertyName: landedProperty.propertyName,
                      rent: rentAmount,
                      ownerUserId: owner.userId,
                    },
                  },
                  { transaction: t }
                );

                await owner.save({ transaction: t });
              }
            }
          }
        }
      } else if (tile.type === 'TAX') {
        const taxAmount = tile.taxAmount || 100;
        if (player.cash < taxAmount) {
          player.cash = 0;
          player.status = 'BANKRUPT';
          await this.handlePlayerBankruptcy(room, player, t);
        } else {
          const before = player.cash;
          player.cash -= taxAmount;
          await GameTransaction.create(
            {
              roomId: room.id,
              userId: player.userId,
              type: 'TAX',
              amount: -taxAmount,
              balanceBefore: before,
              balanceAfter: player.cash,
            },
            { transaction: t }
          );
          await GameEvent.create(
            {
              roomId: room.id,
              turnNumber: room.turnNumber,
              type: 'TAX_PAID',
              actorUserId: player.userId,
              payload: { taxName: tile.name, amount: taxAmount },
            },
            { transaction: t }
          );
        }
      } else if (tile.type === 'BONUS') {
        const bonusAmount = tile.bonus || 150;
        const before = player.cash;
        player.cash += bonusAmount;
        await GameTransaction.create(
          {
            roomId: room.id,
            userId: player.userId,
            type: 'BONUS',
            amount: bonusAmount,
            balanceBefore: before,
            balanceAfter: player.cash,
          },
          { transaction: t }
        );
        await GameEvent.create(
          {
            roomId: room.id,
            turnNumber: room.turnNumber,
            type: 'BONUS_RECEIVED',
            actorUserId: player.userId,
            payload: { bonusName: tile.name, amount: bonusAmount },
          },
          { transaction: t }
        );
      } else if (tile.type === 'EVENT') {
        const randomEvent = PREDEFINED_EVENTS[Math.floor(Math.random() * PREDEFINED_EVENTS.length)];
        eventResult = randomEvent;

        if (randomEvent.effect === 'ADD_CASH') {
          const before = player.cash;
          player.cash += randomEvent.amount;
          await GameTransaction.create(
            {
              roomId: room.id,
              userId: player.userId,
              type: 'EVENT',
              amount: randomEvent.amount,
              balanceBefore: before,
              balanceAfter: player.cash,
              metadata: { eventId: randomEvent.id },
            },
            { transaction: t }
          );
        } else if (randomEvent.effect === 'SUB_CASH') {
          if (player.cash < randomEvent.amount) {
            player.cash = 0;
            player.status = 'BANKRUPT';
            await this.handlePlayerBankruptcy(room, player, t);
          } else {
            const before = player.cash;
            player.cash -= randomEvent.amount;
            await GameTransaction.create(
              {
                roomId: room.id,
                userId: player.userId,
                type: 'EVENT',
                amount: -randomEvent.amount,
                balanceBefore: before,
                balanceAfter: player.cash,
                metadata: { eventId: randomEvent.id },
              },
              { transaction: t }
            );
          }
        }

        await GameEvent.create(
          {
            roomId: room.id,
            turnNumber: room.turnNumber,
            type: 'EVENT_TRIGGERED',
            actorUserId: player.userId,
            payload: { title: randomEvent.title, description: randomEvent.description, amount: randomEvent.amount, effect: randomEvent.effect },
          },
          { transaction: t }
        );
      }

      await player.save({ transaction: t });

      // Update room state
      room.lastDiceResult = { die1, die2, total: totalDice };
      room.turnState = {
        rolled: true,
        dice: [die1, die2],
        total: totalDice,
        currentTileIndex: newPosition,
        canBuy: canBuy && player.status === 'ACTIVE',
        propertyId: landedProperty?.id || null,
        eventResult,
      };

      await room.save({ transaction: t });

      await GameEvent.create(
        {
          roomId: room.id,
          turnNumber: room.turnNumber,
          type: 'DICE_ROLLED',
          actorUserId: player.userId,
          payload: { die1, die2, total: totalDice, position: newPosition, tileName: tile.name },
        },
        { transaction: t }
      );

      // Check if bankruptcy ended game
      if (room.status === 'FINISHED') {
        return room;
      }

      setImmediate(() => {
        gameRealtime.emitToRoom(room.id, 'game:diceRolled', {
          roomId: room.id,
          userId: player.userId,
          die1,
          die2,
          total: totalDice,
          position: newPosition,
          tile,
          canBuy,
        });
        gameRealtime.emitToRoom(room.id, 'game:roomUpdated', { roomId: room.id });
      });

      return room;
    });
  }

  /**
   * Buy Landed Property Action
   */
  async buyProperty(roomId, userId) {
    return await sequelize.transaction(async (t) => {
      const room = await GameRoom.findByPk(roomId, {
        include: [
          { model: GamePlayer, as: 'players' },
          { model: GameProperty, as: 'properties' },
        ],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!room) throw new Error('Không tìm thấy phòng game.');
      if (room.status !== 'PLAYING') throw new Error('Trận đấu chưa bắt đầu hoặc đã kết thúc.');
      if (Number(room.currentTurnPlayerId) !== Number(userId)) {
        throw new Error('Chưa tới lượt của bạn.');
      }

      const turnState = room.turnState || {};
      if (!turnState.rolled) {
        throw new Error('Bạn cần gieo xúc xắc trước khi mua tài sản.');
      }
      if (!turnState.canBuy) {
        throw new Error('Tài sản này không thể mua hoặc bạn không đủ tiền.');
      }

      const player = room.players.find((p) => Number(p.userId) === Number(userId));
      if (!player || player.status !== 'ACTIVE') {
        throw new Error('Người chơi không ở trạng thái hoạt động.');
      }

      const property = room.properties.find((p) => p.tileIndex === turnState.currentTileIndex);
      if (!property) throw new Error('Không tìm thấy tài sản tại ô này.');
      if (property.ownerUserId) throw new Error('Tài sản này đã có người sở hữu.');
      if (player.cash < property.price) throw new Error('Bạn không đủ tiền để mua tài sản này.');

      // Atomic purchase
      const balanceBefore = player.cash;
      player.cash -= property.price;
      property.ownerUserId = player.userId;

      await player.save({ transaction: t });
      await property.save({ transaction: t });

      await GameTransaction.create(
        {
          roomId: room.id,
          userId: player.userId,
          type: 'PROPERTY_BUY',
          amount: -property.price,
          balanceBefore,
          balanceAfter: player.cash,
          referenceType: 'PROPERTY',
          referenceId: String(property.id),
        },
        { transaction: t }
      );

      await GameEvent.create(
        {
          roomId: room.id,
          turnNumber: room.turnNumber,
          type: 'PROPERTY_BOUGHT',
          actorUserId: player.userId,
          payload: {
            propertyName: property.propertyName,
            price: property.price,
            rent: property.rent,
          },
        },
        { transaction: t }
      );

      room.turnState = {
        ...room.turnState,
        canBuy: false,
      };
      await room.save({ transaction: t });

      setImmediate(() => {
        gameRealtime.emitToRoom(room.id, 'game:propertyPurchased', {
          roomId: room.id,
          userId: player.userId,
          propertyId: property.id,
          propertyName: property.propertyName,
          price: property.price,
        });
        gameRealtime.emitToRoom(room.id, 'game:roomUpdated', { roomId: room.id });
      });

      return room;
    });
  }

  /**
   * End Turn Action (Advances turn to next active player)
   */
  async endTurn(roomId, userId) {
    return await sequelize.transaction(async (t) => {
      const room = await GameRoom.findByPk(roomId, {
        include: [{ model: GamePlayer, as: 'players' }],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!room) throw new Error('Không tìm thấy phòng game.');
      if (room.status !== 'PLAYING') throw new Error('Trận đấu chưa bắt đầu hoặc đã kết thúc.');
      if (Number(room.currentTurnPlayerId) !== Number(userId)) {
        throw new Error('Chưa tới lượt của bạn.');
      }

      await this.advanceTurnInternal(room, t);

      setImmediate(() => {
        gameRealtime.emitToRoom(room.id, 'game:turnChanged', {
          roomId: room.id,
          currentTurnPlayerId: room.currentTurnPlayerId,
          turnNumber: room.turnNumber,
        });
        gameRealtime.emitToRoom(room.id, 'game:roomUpdated', { roomId: room.id });
      });

      return room;
    });
  }

  /**
   * Internal turn advancement logic
   */
  async advanceTurnInternal(room, transaction) {
    // Check max turns limit
    if (room.turnNumber >= MAX_TURNS_LIMIT) {
      await this.settleGameFinish(room, transaction);
      return;
    }

    const activePlayers = room.players
      .filter((p) => p.status === 'ACTIVE')
      .sort((a, b) => a.seatIndex - b.seatIndex);

    if (activePlayers.length <= 1) {
      await this.settleGameFinish(room, transaction);
      return;
    }

    const currentIndex = activePlayers.findIndex((p) => Number(p.userId) === Number(room.currentTurnPlayerId));
    const nextIndex = (currentIndex + 1) % activePlayers.length;
    const nextPlayer = activePlayers[nextIndex];

    room.currentTurnPlayerId = nextPlayer.userId;
    room.turnNumber += 1;
    room.turnDeadline = new Date(Date.now() + TURN_TIMEOUT_SECONDS * 1000);
    room.turnState = {
      rolled: false,
      dice: null,
      canBuy: false,
      currentTileIndex: nextPlayer.position,
    };

    await room.save({ transaction });
  }

  /**
   * Handle Turn Timeout
   */
  async handleTurnTimeout(roomId) {
    return await sequelize.transaction(async (t) => {
      const room = await GameRoom.findByPk(roomId, {
        include: [{ model: GamePlayer, as: 'players' }],
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      if (!room || room.status !== 'PLAYING') return;
      if (!room.turnDeadline || new Date() <= new Date(room.turnDeadline)) return;

      // Auto advance turn
      await this.advanceTurnInternal(room, t);

      setImmediate(() => {
        gameRealtime.emitToRoom(room.id, 'game:turnChanged', {
          roomId: room.id,
          currentTurnPlayerId: room.currentTurnPlayerId,
          turnNumber: room.turnNumber,
          reason: 'TIMEOUT',
        });
        gameRealtime.emitToRoom(room.id, 'game:roomUpdated', { roomId: room.id });
      });
    });
  }

  /**
   * Handle Player Bankruptcy
   */
  async handlePlayerBankruptcy(room, player, transaction) {
    player.status = 'BANKRUPT';
    player.finalCash = 0;
    await player.save({ transaction });

    // Release all properties back to bank
    await GameProperty.update(
      { ownerUserId: null },
      { where: { roomId: room.id, ownerUserId: player.userId }, transaction }
    );

    await GameEvent.create(
      {
        roomId: room.id,
        turnNumber: room.turnNumber,
        type: 'BANKRUPTCY',
        actorUserId: player.userId,
        payload: { reason: 'Không đủ tiền chi trả các nghĩa vụ tài chính.' },
      },
      { transaction }
    );

    const activeSolvent = room.players.filter(
      (p) => Number(p.userId) !== Number(player.userId) && p.status === 'ACTIVE'
    );

    if (activeSolvent.length <= 1) {
      await this.settleGameFinish(room, transaction);
    }
  }

  /**
   * Settle match finish, ranks and career rewards
   */
  async settleGameFinish(room, transaction) {
    room.status = 'FINISHED';
    room.finishedAt = new Date();

    const properties = await GameProperty.findAll({
      where: { roomId: room.id },
      transaction,
    });

    // Compute player scores & rankings
    const scoredPlayers = room.players.map((p) => {
      const ownedProps = properties.filter((prop) => Number(prop.ownerUserId) === Number(p.userId));
      const propertyValue = ownedProps.reduce((sum, prop) => sum + Number(prop.price || 0), 0);
      const cash = Number(p.cash || 0);
      const netWorth = p.status === 'BANKRUPT' ? 0 : cash + propertyValue;

      return {
        player: p,
        cash,
        propertyValue,
        netWorth,
        status: p.status,
      };
    });

    // Sort: Active first, then by net worth DESC, then by cash DESC
    scoredPlayers.sort((a, b) => {
      if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
      if (b.status === 'ACTIVE' && a.status !== 'ACTIVE') return 1;
      if (b.netWorth !== a.netWorth) return b.netWorth - a.netWorth;
      return b.cash - a.cash;
    });

    const totalCount = room.players.length;
    const rewardTable =
      totalCount === 2
        ? CAREER_REWARDS.TWO_PLAYERS
        : totalCount === 3
          ? CAREER_REWARDS.THREE_PLAYERS
          : CAREER_REWARDS.FOUR_PLAYERS;

    const winnerUserId = scoredPlayers[0]?.player.userId || null;
    room.winnerUserId = winnerUserId;
    await room.save({ transaction });

    for (let i = 0; i < scoredPlayers.length; i++) {
      const rank = i + 1;
      const sp = scoredPlayers[i];
      const p = sp.player;
      const reward = rewardTable[rank] || 100;

      p.rank = rank;
      p.finalCash = sp.cash;
      p.finalPropertyValue = sp.propertyValue;
      p.finalNetWorth = sp.netWorth;
      await p.save({ transaction });

      // Record GameResult
      await GameResult.create(
        {
          roomId: room.id,
          userId: p.userId,
          finalCash: sp.cash,
          finalPropertyValue: sp.propertyValue,
          finalNetWorth: sp.netWorth,
          rank,
          rewardAmount: reward,
        },
        { transaction }
      );

      // Update Career Profile
      let profile = await GameLeaderboardProfile.findOne({
        where: { userId: p.userId },
        transaction,
      });

      if (!profile) {
        profile = await GameLeaderboardProfile.create(
          {
            userId: p.userId,
            careerMoney: reward,
            gamesPlayed: 1,
            gamesWon: rank === 1 ? 1 : 0,
            totalNetWorth: sp.netWorth,
            bestRank: rank,
          },
          { transaction }
        );
      } else {
        profile.careerMoney = Number(profile.careerMoney || 0) + reward;
        profile.gamesPlayed = Number(profile.gamesPlayed || 0) + 1;
        profile.gamesWon = Number(profile.gamesWon || 0) + (rank === 1 ? 1 : 0);
        profile.totalNetWorth = Number(profile.totalNetWorth || 0) + sp.netWorth;
        profile.bestRank = Math.min(Number(profile.bestRank || 999), rank);
        await profile.save({ transaction });
      }
    }

    await GameEvent.create(
      {
        roomId: room.id,
        turnNumber: room.turnNumber,
        type: 'GAME_FINISHED',
        actorUserId: winnerUserId,
        payload: { winnerUserId },
      },
      { transaction }
    );

    setImmediate(() => {
      gameRealtime.emitToRoom(room.id, 'game:finished', { roomId: room.id, winnerUserId });
      gameRealtime.emitToRoom(room.id, 'game:roomUpdated', { roomId: room.id });
    });
  }

  /**
   * Game Leaderboard Query
   */
  async getLeaderboard({ limit = 50, page = 1, currentUserId = null } = {}) {
    const offset = (Math.max(1, Number(page)) - 1) * limit;

    const { count, rows } = await GameLeaderboardProfile.findAndCountAll({
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email', 'jobTitle', 'department', 'isVerified', 'isDev'],
          include: [{ model: UserProfilePreference, attributes: ['avatarData'], required: false }],
        },
      ],
      order: [
        ['careerMoney', 'DESC'],
        ['gamesWon', 'DESC'],
        ['totalNetWorth', 'DESC'],
      ],
      limit,
      offset,
    });

    let myProfile = null;
    let myRank = null;

    if (currentUserId) {
      const myRow = await GameLeaderboardProfile.findOne({
        where: { userId: currentUserId },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'email', 'jobTitle', 'department', 'isVerified', 'isDev'],
            include: [{ model: UserProfilePreference, attributes: ['avatarData'], required: false }],
          },
        ],
      });

      if (myRow) {
        // Count how many players have higher career money
        const higherCount = await GameLeaderboardProfile.count({
          where: {
            [Op.or]: [
              { careerMoney: { [Op.gt]: myRow.careerMoney } },
              {
                careerMoney: myRow.careerMoney,
                gamesWon: { [Op.gt]: myRow.gamesWon },
              },
            ],
          },
        });
        myRank = higherCount + 1;
        myProfile = {
          rank: myRank,
          userId: myRow.userId,
          careerMoney: Number(myRow.careerMoney || 0),
          gamesPlayed: myRow.gamesPlayed,
          gamesWon: myRow.gamesWon,
          totalNetWorth: Number(myRow.totalNetWorth || 0),
          bestRank: myRow.bestRank,
          user: sanitizeUser(myRow.user),
        };
      }
    }

    const items = rows.map((row, index) => ({
      rank: offset + index + 1,
      userId: row.userId,
      careerMoney: Number(row.careerMoney || 0),
      gamesPlayed: row.gamesPlayed,
      gamesWon: row.gamesWon,
      totalNetWorth: Number(row.totalNetWorth || 0),
      bestRank: row.bestRank,
      user: sanitizeUser(row.user),
    }));

    return {
      items,
      total: count,
      page: Number(page),
      myProfile,
    };
  }

  /**
   * User Match History
   */
  async getUserHistory(userId, { limit = 20 } = {}) {
    const results = await GameResult.findAll({
      where: { userId },
      include: [
        {
          model: GameRoom,
          as: 'room',
          attributes: ['id', 'code', 'title', 'finishedAt'],
          include: [{ model: User, as: 'Winner', attributes: ['id', 'name'] }],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit,
    });

    return results.map((r) => ({
      id: r.id,
      roomId: r.roomId,
      roomCode: r.room?.code,
      roomTitle: r.room?.title,
      rank: r.rank,
      rewardAmount: r.rewardAmount,
      finalCash: r.finalCash,
      finalPropertyValue: r.finalPropertyValue,
      finalNetWorth: r.finalNetWorth,
      winner: r.room?.Winner ? { id: r.room.Winner.id, name: r.room.Winner.name } : null,
      playedAt: r.createdAt,
    }));
  }
}

module.exports = new CapitalBoardGameService();
