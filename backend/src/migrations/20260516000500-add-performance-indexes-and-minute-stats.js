'use strict';

async function tableExists(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.some((table) => {
    const name = typeof table === 'string' ? table : table.tableName || table.name;
    return name === tableName;
  });
}

async function indexExists(queryInterface, tableName, indexName) {
  if (!(await tableExists(queryInterface, tableName))) return false;
  const indexes = await queryInterface.showIndex(tableName);
  return indexes.some((index) => index.name === indexName);
}

async function addIndexIfMissing(queryInterface, tableName, fields, options) {
  if (await indexExists(queryInterface, tableName, options.name)) return;
  await queryInterface.addIndex(tableName, fields, options);
}

async function removeIndexIfExists(queryInterface, tableName, indexName) {
  if (await indexExists(queryInterface, tableName, indexName)) {
    await queryInterface.removeIndex(tableName, indexName);
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    if (!(await tableExists(queryInterface, 'user_minute_stats'))) {
      await queryInterface.createTable('user_minute_stats', {
        id: { type: Sequelize.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
        user_id: {
          type: Sequelize.BIGINT.UNSIGNED,
          allowNull: false,
          references: { model: 'users', key: 'id' },
          onDelete: 'CASCADE',
        },
        bucket_start_at: { type: Sequelize.DATE, allowNull: false },
        stat_date: { type: Sequelize.DATEONLY, allowNull: false },
        total_seconds: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        active_seconds: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        idle_seconds: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        focus_score: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        keystroke_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        mouse_click_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        mouse_move_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        event_count: { type: Sequelize.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0 },
        created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
        updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.literal('CURRENT_TIMESTAMP') },
      });
    }

    await addIndexIfMissing(queryInterface, 'user_minute_stats', ['user_id', 'bucket_start_at'], {
      unique: true,
      name: 'user_minute_stats_user_bucket_unique',
    });
    await addIndexIfMissing(queryInterface, 'user_minute_stats', ['stat_date', 'user_id'], {
      name: 'user_minute_stats_date_user_idx',
    });
    await addIndexIfMissing(queryInterface, 'user_minute_stats', ['bucket_start_at'], {
      name: 'user_minute_stats_bucket_idx',
    });

    await addIndexIfMissing(queryInterface, 'daily_stats', ['stat_date', 'user_id'], {
      name: 'daily_stats_date_user_idx',
    });
    await addIndexIfMissing(queryInterface, 'daily_stats', ['stat_date', 'rank_position'], {
      name: 'daily_stats_date_rank_idx',
    });
    await addIndexIfMissing(queryInterface, 'activity_events', ['event_time'], {
      name: 'activity_events_time_idx',
    });
    await addIndexIfMissing(queryInterface, 'activity_events', ['event_time', 'user_id'], {
      name: 'activity_events_time_user_idx',
    });
    await addIndexIfMissing(queryInterface, 'activity_events', ['device_id', 'created_at', 'suspicion_score'], {
      name: 'activity_events_device_security_idx',
    });
    await addIndexIfMissing(queryInterface, 'work_sessions', ['user_id', 'status', 'started_at'], {
      name: 'work_sessions_user_status_started_idx',
    });
    await addIndexIfMissing(queryInterface, 'work_sessions', ['user_id', 'started_at'], {
      name: 'work_sessions_user_started_idx',
    });
    await addIndexIfMissing(queryInterface, 'devices', ['user_id', 'last_sync_at'], {
      name: 'devices_user_last_sync_idx',
    });
    await addIndexIfMissing(queryInterface, 'devices', ['last_sync_at'], {
      name: 'devices_last_sync_idx',
    });
    await addIndexIfMissing(queryInterface, 'devices', ['revoked_at'], {
      name: 'devices_revoked_at_idx',
    });
    await addIndexIfMissing(queryInterface, 'users', ['status', 'team_id'], {
      name: 'users_status_team_idx',
    });
    await addIndexIfMissing(queryInterface, 'users', ['team_id', 'status'], {
      name: 'users_team_status_idx',
    });
    await addIndexIfMissing(queryInterface, 'users', ['created_at', 'id'], {
      name: 'users_created_id_idx',
    });
    await addIndexIfMissing(queryInterface, 'teams', ['owner_id'], {
      name: 'teams_owner_idx',
    });
    await addIndexIfMissing(queryInterface, 'activity_events', ['suspicion_score', 'event_time'], {
      name: 'activity_events_suspicion_time_idx',
    });
    await addIndexIfMissing(queryInterface, 'friendships', ['status', 'requester_id', 'updated_at'], {
      name: 'friendships_status_requester_updated_idx',
    });
    await addIndexIfMissing(queryInterface, 'friendships', ['status', 'addressee_id', 'updated_at'], {
      name: 'friendships_status_addressee_updated_idx',
    });
    await addIndexIfMissing(queryInterface, 'friendships', ['status', 'requester_id', 'created_at'], {
      name: 'friendships_status_requester_created_idx',
    });
    await addIndexIfMissing(queryInterface, 'friendships', ['status', 'addressee_id', 'created_at'], {
      name: 'friendships_status_addressee_created_idx',
    });
    await addIndexIfMissing(queryInterface, 'profile_likes', ['target_user_id', 'liked_date'], {
      name: 'profile_likes_target_date_idx',
    });
  },

  async down(queryInterface) {
    await removeIndexIfExists(queryInterface, 'profile_likes', 'profile_likes_target_date_idx');
    await removeIndexIfExists(queryInterface, 'friendships', 'friendships_status_addressee_created_idx');
    await removeIndexIfExists(queryInterface, 'friendships', 'friendships_status_requester_created_idx');
    await removeIndexIfExists(queryInterface, 'friendships', 'friendships_status_addressee_updated_idx');
    await removeIndexIfExists(queryInterface, 'friendships', 'friendships_status_requester_updated_idx');
    await removeIndexIfExists(queryInterface, 'activity_events', 'activity_events_suspicion_time_idx');
    await removeIndexIfExists(queryInterface, 'teams', 'teams_owner_idx');
    await removeIndexIfExists(queryInterface, 'users', 'users_created_id_idx');
    await removeIndexIfExists(queryInterface, 'users', 'users_team_status_idx');
    await removeIndexIfExists(queryInterface, 'users', 'users_status_team_idx');
    await removeIndexIfExists(queryInterface, 'devices', 'devices_revoked_at_idx');
    await removeIndexIfExists(queryInterface, 'devices', 'devices_last_sync_idx');
    await removeIndexIfExists(queryInterface, 'devices', 'devices_user_last_sync_idx');
    await removeIndexIfExists(queryInterface, 'work_sessions', 'work_sessions_user_started_idx');
    await removeIndexIfExists(queryInterface, 'work_sessions', 'work_sessions_user_status_started_idx');
    await removeIndexIfExists(queryInterface, 'activity_events', 'activity_events_device_security_idx');
    await removeIndexIfExists(queryInterface, 'activity_events', 'activity_events_time_user_idx');
    await removeIndexIfExists(queryInterface, 'activity_events', 'activity_events_time_idx');
    await removeIndexIfExists(queryInterface, 'daily_stats', 'daily_stats_date_rank_idx');
    await removeIndexIfExists(queryInterface, 'daily_stats', 'daily_stats_date_user_idx');

    if (await tableExists(queryInterface, 'user_minute_stats')) {
      await queryInterface.dropTable('user_minute_stats');
    }
  },
};
