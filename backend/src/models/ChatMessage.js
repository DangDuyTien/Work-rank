const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class ChatMessage extends Model {}

ChatMessage.init(
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    senderId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'sender_id' },
    receiverId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false, field: 'receiver_id' },
    body: { type: DataTypes.TEXT, allowNull: false },
    clientMessageId: { type: DataTypes.STRING(80), allowNull: true, field: 'client_message_id' },
    readAt: { type: DataTypes.DATE, allowNull: true, field: 'read_at' },
  },
  {
    sequelize,
    modelName: 'ChatMessage',
    tableName: 'chat_messages',
  },
);

module.exports = ChatMessage;
