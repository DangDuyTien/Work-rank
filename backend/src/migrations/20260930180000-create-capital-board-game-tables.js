'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. game_rooms
    const roomsExists = await queryInterface.describeTable('game_rooms').then(() => true).catch(() => false);
    if (!roomsExists) {
      await queryInterface.createTable('game_rooms', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        code: { type: Sequelize.STRING(20), allowNull: false, unique: true },
        title: { type: Sequelize.STRING(120), allowNull: false },
        host_user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
        },
        status: {
          type: Sequelize.ENUM('WAITING', 'PLAYING', 'FINISHED', 'ABANDONED'),
          allowNull: false,
          defaultValue: 'WAITING',
        },
        max_players: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 4 },
        current_turn_player_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        },
        turn_number: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
        turn_deadline: { type: Sequelize.DATE, allowNull: true },
        winner_user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        },
        started_at: { type: Sequelize.DATE, allowNull: true },
        finished_at: { type: Sequelize.DATE, allowNull: true },
        last_dice_result: { type: Sequelize.JSON, allowNull: true },
        turn_state: { type: Sequelize.JSON, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      });
      await queryInterface.addIndex('game_rooms', ['status'], { name: 'idx_game_rooms_status' });
      await queryInterface.addIndex('game_rooms', ['code'], { name: 'idx_game_rooms_code' });
    }

    // 2. game_players
    const playersExists = await queryInterface.describeTable('game_players').then(() => true).catch(() => false);
    if (!playersExists) {
      await queryInterface.createTable('game_players', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        room_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'game_rooms', key: 'id' },
          onDelete: 'CASCADE',
        },
        user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
        },
        seat_index: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
        color: { type: Sequelize.STRING(30), allowNull: false, defaultValue: '#38bdf8' },
        position: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        cash: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1500 },
        status: {
          type: Sequelize.ENUM('WAITING', 'ACTIVE', 'BANKRUPT', 'SURRENDERED', 'DISCONNECTED'),
          allowNull: false,
          defaultValue: 'WAITING',
        },
        joined_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        final_cash: { type: Sequelize.INTEGER, allowNull: true },
        final_property_value: { type: Sequelize.INTEGER, allowNull: true },
        final_net_worth: { type: Sequelize.INTEGER, allowNull: true },
        rank: { type: Sequelize.INTEGER.UNSIGNED, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      });
      await queryInterface.addIndex('game_players', ['room_id', 'user_id'], { unique: true, name: 'unique_room_user' });
      await queryInterface.addIndex('game_players', ['room_id', 'seat_index'], { unique: true, name: 'unique_room_seat' });
      await queryInterface.addIndex('game_players', ['user_id'], { name: 'idx_game_players_user' });
    }

    // 3. game_properties
    const propsExists = await queryInterface.describeTable('game_properties').then(() => true).catch(() => false);
    if (!propsExists) {
      await queryInterface.createTable('game_properties', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        room_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'game_rooms', key: 'id' },
          onDelete: 'CASCADE',
        },
        tile_index: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
        property_key: { type: Sequelize.STRING(50), allowNull: false },
        property_name: { type: Sequelize.STRING(100), allowNull: false },
        price: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
        rent: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
        group_key: { type: Sequelize.STRING(30), allowNull: false },
        group_color: { type: Sequelize.STRING(30), allowNull: false },
        owner_user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      });
      await queryInterface.addIndex('game_properties', ['room_id', 'tile_index'], { unique: true, name: 'unique_room_tile' });
      await queryInterface.addIndex('game_properties', ['room_id', 'property_key'], { unique: true, name: 'unique_room_property_key' });
      await queryInterface.addIndex('game_properties', ['owner_user_id'], { name: 'idx_game_props_owner' });
    }

    // 4. game_events
    const eventsExists = await queryInterface.describeTable('game_events').then(() => true).catch(() => false);
    if (!eventsExists) {
      await queryInterface.createTable('game_events', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        room_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'game_rooms', key: 'id' },
          onDelete: 'CASCADE',
        },
        turn_number: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
        type: { type: Sequelize.STRING(50), allowNull: false },
        actor_user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'SET NULL',
        },
        payload: { type: Sequelize.JSON, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      });
      await queryInterface.addIndex('game_events', ['room_id', 'created_at'], { name: 'idx_game_events_room_created' });
    }

    // 5. game_transactions
    const txExists = await queryInterface.describeTable('game_transactions').then(() => true).catch(() => false);
    if (!txExists) {
      await queryInterface.createTable('game_transactions', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        room_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'game_rooms', key: 'id' },
          onDelete: 'CASCADE',
        },
        user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
        },
        type: { type: Sequelize.STRING(50), allowNull: false },
        amount: { type: Sequelize.INTEGER, allowNull: false },
        balance_before: { type: Sequelize.INTEGER, allowNull: false },
        balance_after: { type: Sequelize.INTEGER, allowNull: false },
        reference_type: { type: Sequelize.STRING(50), allowNull: true },
        reference_id: { type: Sequelize.STRING(50), allowNull: true },
        metadata: { type: Sequelize.JSON, allowNull: true },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      });
      await queryInterface.addIndex('game_transactions', ['room_id', 'created_at'], { name: 'idx_game_tx_room_created' });
      await queryInterface.addIndex('game_transactions', ['user_id', 'created_at'], { name: 'idx_game_tx_user_created' });
    }

    // 6. game_results
    const resultsExists = await queryInterface.describeTable('game_results').then(() => true).catch(() => false);
    if (!resultsExists) {
      await queryInterface.createTable('game_results', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        room_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'game_rooms', key: 'id' },
          onDelete: 'CASCADE',
        },
        user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
        },
        final_cash: { type: Sequelize.INTEGER, allowNull: false },
        final_property_value: { type: Sequelize.INTEGER, allowNull: false },
        final_net_worth: { type: Sequelize.INTEGER, allowNull: false },
        rank: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false },
        reward_amount: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      });
      await queryInterface.addIndex('game_results', ['user_id', 'created_at'], { name: 'idx_game_results_user_created' });
      await queryInterface.addIndex('game_results', ['room_id'], { name: 'idx_game_results_room' });
    }

    // 7. game_leaderboard_profiles
    const lbExists = await queryInterface.describeTable('game_leaderboard_profiles').then(() => true).catch(() => false);
    if (!lbExists) {
      await queryInterface.createTable('game_leaderboard_profiles', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          unique: true,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
        },
        career_money: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },
        games_played: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        games_won: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        total_net_worth: { type: Sequelize.BIGINT.UNSIGNED, allowNull: false, defaultValue: 0 },
        best_rank: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 999 },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      });
      await queryInterface.addIndex('game_leaderboard_profiles', ['career_money'], { name: 'idx_game_leaderboard_career_money' });
      await queryInterface.addIndex('game_leaderboard_profiles', ['games_won'], { name: 'idx_game_leaderboard_games_won' });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable('game_leaderboard_profiles').catch(() => {});
    await queryInterface.dropTable('game_results').catch(() => {});
    await queryInterface.dropTable('game_transactions').catch(() => {});
    await queryInterface.dropTable('game_events').catch(() => {});
    await queryInterface.dropTable('game_properties').catch(() => {});
    await queryInterface.dropTable('game_players').catch(() => {});
    await queryInterface.dropTable('game_rooms').catch(() => {});
  },
};
