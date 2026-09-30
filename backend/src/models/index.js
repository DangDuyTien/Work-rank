const sequelize = require('../config/database');
const Team = require('./Team');
const User = require('./User');
const UserProfileImage = require('./UserProfileImage');
const UserProfilePreference = require('./UserProfilePreference');
const Friendship = require('./Friendship');
const ProfileLike = require('./ProfileLike');
const ChatMessage = require('./ChatMessage');
const TradingViewCandle = require('./TradingViewCandle');
const TradingViewWebhookAttempt = require('./TradingViewWebhookAttempt');
// Phase 1 — Competition Engine Foundation
const EventOutbox = require('./EventOutbox');
const CompetitionEvent = require('./CompetitionEvent');
// Phase 2 — Core Engine
const ScoreLedger = require('./ScoreLedger');
// Phase 3 — Stateful Competition
const CompetitionState = require('./CompetitionState');
// Phase 4 — Season Framework & Challenges
const RuleSet = require('./RuleSet');
const RuleSetVersion = require('./RuleSetVersion');
const Season = require('./Season');
const SeasonTeam = require('./SeasonTeam');
const SeasonTeamMember = require('./SeasonTeamMember');
const Challenge = require('./Challenge');
const SeasonFrozenResult = require('./SeasonFrozenResult');
const CompetitionAuditLog = require('./CompetitionAuditLog');
// Phase 5 — Grand Championship
const GrandChampionship = require('./GrandChampionship');
const GrandPointsLedger = require('./GrandPointsLedger');
const GrandFrozenResult = require('./GrandFrozenResult');
// Phase 6 — Read Models & Projections
const CompetitionUserSummary = require('./CompetitionUserSummary');
const CompetitionTeamSummary = require('./CompetitionTeamSummary');
const SeasonLeaderboardProjection = require('./SeasonLeaderboardProjection');
const SeasonIndividualLeaderboardProjection = require('./SeasonIndividualLeaderboardProjection');
const GrandLeaderboardProjection = require('./GrandLeaderboardProjection');
const GrandIndividualLeaderboardProjection = require('./GrandIndividualLeaderboardProjection');
const CompetitionActivityProjection = require('./CompetitionActivityProjection');
const ProjectionCheckpoint = require('./ProjectionCheckpoint');
// Capital Board Game V1 Models
const GameRoom = require('./GameRoom');
const GamePlayer = require('./GamePlayer');
const GameProperty = require('./GameProperty');
const GameEvent = require('./GameEvent');
const GameTransaction = require('./GameTransaction');
const GameResult = require('./GameResult');
const GameLeaderboardProfile = require('./GameLeaderboardProfile');
// Quiz Game V1 Models
const QuizRoom = require('./QuizRoom');
const QuizPlayer = require('./QuizPlayer');
const QuizQuestion = require('./QuizQuestion');
const QuizAnswer = require('./QuizAnswer');
const QuizUserStat = require('./QuizUserStat');
// Game 2048 V1 Models
const Game2048Score = require('./Game2048Score');
const Game2048UserStat = require('./Game2048UserStat');

Team.hasMany(User, { foreignKey: 'teamId' });
User.belongsTo(Team, { foreignKey: 'teamId' });
Team.belongsTo(User, { as: 'Owner', foreignKey: 'ownerId' });

User.hasMany(UserProfileImage, { foreignKey: 'userId' });
UserProfileImage.belongsTo(User, { foreignKey: 'userId' });

User.hasOne(UserProfilePreference, { foreignKey: 'userId' });
UserProfilePreference.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(Friendship, { as: 'SentFriendships', foreignKey: 'requesterId' });
User.hasMany(Friendship, { as: 'ReceivedFriendships', foreignKey: 'addresseeId' });
Friendship.belongsTo(User, { as: 'Requester', foreignKey: 'requesterId' });
Friendship.belongsTo(User, { as: 'Addressee', foreignKey: 'addresseeId' });

User.hasMany(ProfileLike, { as: 'GivenProfileLikes', foreignKey: 'likerId' });
User.hasMany(ProfileLike, { as: 'ReceivedProfileLikes', foreignKey: 'targetUserId' });
ProfileLike.belongsTo(User, { as: 'Liker', foreignKey: 'likerId' });
ProfileLike.belongsTo(User, { as: 'TargetUser', foreignKey: 'targetUserId' });

User.hasMany(ChatMessage, { as: 'SentChatMessages', foreignKey: 'senderId' });
User.hasMany(ChatMessage, { as: 'ReceivedChatMessages', foreignKey: 'receiverId' });
ChatMessage.belongsTo(User, { as: 'Sender', foreignKey: 'senderId' });
ChatMessage.belongsTo(User, { as: 'Receiver', foreignKey: 'receiverId' });

// Phase 4 Associations
RuleSet.hasMany(RuleSetVersion, { foreignKey: 'ruleSetId', as: 'versions' });
RuleSetVersion.belongsTo(RuleSet, { foreignKey: 'ruleSetId', as: 'ruleSet' });

Season.belongsTo(RuleSet, { foreignKey: 'activeRuleSetId', as: 'ruleSet' });
Season.belongsTo(RuleSetVersion, { foreignKey: 'activeRuleVersionId', as: 'activeRuleVersion' });

Season.hasMany(SeasonTeam, { foreignKey: 'seasonId', as: 'teams' });
SeasonTeam.belongsTo(Season, { foreignKey: 'seasonId', as: 'season' });
SeasonTeam.belongsTo(Team, { foreignKey: 'teamId', as: 'team' });

Season.hasMany(SeasonTeamMember, { foreignKey: 'seasonId', as: 'members' });
SeasonTeamMember.belongsTo(Season, { foreignKey: 'seasonId', as: 'season' });
SeasonTeamMember.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Season.hasMany(Challenge, { foreignKey: 'seasonId', as: 'challenges' });
Challenge.belongsTo(Season, { foreignKey: 'seasonId', as: 'season' });

Season.hasOne(SeasonFrozenResult, { foreignKey: 'seasonId', as: 'frozenResult' });
SeasonFrozenResult.belongsTo(Season, { foreignKey: 'seasonId', as: 'season' });

// Phase 5 Associations
GrandChampionship.hasMany(Season, { foreignKey: 'grandChampionshipId', as: 'seasons' });
Season.belongsTo(GrandChampionship, { foreignKey: 'grandChampionshipId', as: 'grandChampionship' });

GrandChampionship.hasMany(GrandPointsLedger, { foreignKey: 'grandChampionshipId', as: 'pointsLedger' });
GrandPointsLedger.belongsTo(GrandChampionship, { foreignKey: 'grandChampionshipId', as: 'grandChampionship' });
GrandPointsLedger.belongsTo(Team, { foreignKey: 'teamId', as: 'team' });
GrandPointsLedger.belongsTo(Season, { foreignKey: 'seasonId', as: 'season' });

GrandChampionship.hasOne(GrandFrozenResult, { foreignKey: 'grandChampionshipId', as: 'frozenResult' });
GrandFrozenResult.belongsTo(GrandChampionship, { foreignKey: 'grandChampionshipId', as: 'grandChampionship' });

// Phase 6 Associations
User.hasOne(CompetitionUserSummary, { foreignKey: 'userId', as: 'competitionSummary', constraints: false });
CompetitionUserSummary.belongsTo(User, { foreignKey: 'userId', as: 'user', constraints: false });

Team.hasOne(CompetitionTeamSummary, { foreignKey: 'teamId', as: 'competitionSummary', constraints: false });
CompetitionTeamSummary.belongsTo(Team, { foreignKey: 'teamId', as: 'team', constraints: false });

Season.hasMany(SeasonLeaderboardProjection, { foreignKey: 'seasonId', as: 'leaderboardProjections', constraints: false });
SeasonLeaderboardProjection.belongsTo(Season, { foreignKey: 'seasonId', as: 'season', constraints: false });
SeasonLeaderboardProjection.belongsTo(Team, { foreignKey: 'teamId', as: 'team', constraints: false });

// YouTube & Team Analytics
const YouTubeChannel = require('./YouTubeChannel');
const YouTubeVideo = require('./YouTubeVideo');
const YouTubeChannelMetric = require('./YouTubeChannelMetric');
const YouTubeVideoMetric = require('./YouTubeVideoMetric');
const TeamYouTubeSummary = require('./TeamYouTubeSummary');

Season.hasMany(SeasonIndividualLeaderboardProjection, { foreignKey: 'seasonId', as: 'individualLeaderboardProjections', constraints: false });
SeasonIndividualLeaderboardProjection.belongsTo(Season, { foreignKey: 'seasonId', as: 'season', constraints: false });
SeasonIndividualLeaderboardProjection.belongsTo(User, { foreignKey: 'userId', as: 'user', constraints: false });
SeasonIndividualLeaderboardProjection.belongsTo(Team, { foreignKey: 'teamId', as: 'team', constraints: false });

GrandChampionship.hasMany(GrandLeaderboardProjection, { foreignKey: 'grandId', as: 'leaderboardProjections', constraints: false });
GrandLeaderboardProjection.belongsTo(GrandChampionship, { foreignKey: 'grandId', as: 'grandChampionship', constraints: false });
GrandLeaderboardProjection.belongsTo(Team, { foreignKey: 'teamId', as: 'team', constraints: false });

GrandChampionship.hasMany(GrandIndividualLeaderboardProjection, { foreignKey: 'grandId', as: 'individualLeaderboardProjections', constraints: false });
GrandIndividualLeaderboardProjection.belongsTo(GrandChampionship, { foreignKey: 'grandId', as: 'grandChampionship', constraints: false });
GrandIndividualLeaderboardProjection.belongsTo(User, { foreignKey: 'userId', as: 'user', constraints: false });
GrandIndividualLeaderboardProjection.belongsTo(Team, { foreignKey: 'teamId', as: 'team', constraints: false });

// YouTube Associations
Team.hasMany(YouTubeChannel, { foreignKey: 'teamId', as: 'youtubeChannels' });
YouTubeChannel.belongsTo(Team, { foreignKey: 'teamId', as: 'team' });

YouTubeChannel.hasMany(YouTubeVideo, { foreignKey: 'channelId', as: 'videos' });
YouTubeVideo.belongsTo(YouTubeChannel, { foreignKey: 'channelId', as: 'channel' });

YouTubeChannel.hasMany(YouTubeChannelMetric, { foreignKey: 'channelId', as: 'metrics' });
YouTubeChannelMetric.belongsTo(YouTubeChannel, { foreignKey: 'channelId', as: 'channel' });

YouTubeVideo.hasMany(YouTubeVideoMetric, { foreignKey: 'videoId', as: 'metrics' });
YouTubeVideoMetric.belongsTo(YouTubeVideo, { foreignKey: 'videoId', as: 'video' });

Team.hasOne(TeamYouTubeSummary, { foreignKey: 'teamId', as: 'youtubeSummary' });
TeamYouTubeSummary.belongsTo(Team, { foreignKey: 'teamId', as: 'team' });
TeamYouTubeSummary.belongsTo(YouTubeVideo, { foreignKey: 'topVideoId', as: 'topVideo', constraints: false });

// Recognition & Badges
const UserRecognition = require('./UserRecognition');

User.hasMany(UserRecognition, { foreignKey: 'userId', as: 'recognitions' });
UserRecognition.belongsTo(User, { foreignKey: 'userId', as: 'user' });
UserRecognition.belongsTo(Season, { foreignKey: 'seasonId', as: 'season', constraints: false });
UserRecognition.belongsTo(GrandChampionship, { foreignKey: 'grandId', as: 'grand', constraints: false });
UserRecognition.belongsTo(User, { foreignKey: 'awardedBy', as: 'awarder', constraints: false });

// Capital Board Game V1 Associations
GameRoom.belongsTo(User, { as: 'Host', foreignKey: 'hostUserId' });
GameRoom.belongsTo(User, { as: 'CurrentTurnPlayer', foreignKey: 'currentTurnPlayerId' });
GameRoom.belongsTo(User, { as: 'Winner', foreignKey: 'winnerUserId' });
GameRoom.hasMany(GamePlayer, { as: 'players', foreignKey: 'roomId' });
GamePlayer.belongsTo(GameRoom, { as: 'room', foreignKey: 'roomId' });
GamePlayer.belongsTo(User, { as: 'user', foreignKey: 'userId' });
GameRoom.hasMany(GameProperty, { as: 'properties', foreignKey: 'roomId' });
GameProperty.belongsTo(GameRoom, { as: 'room', foreignKey: 'roomId' });
GameProperty.belongsTo(User, { as: 'owner', foreignKey: 'ownerUserId' });
GameRoom.hasMany(GameEvent, { as: 'events', foreignKey: 'roomId' });
GameEvent.belongsTo(GameRoom, { as: 'room', foreignKey: 'roomId' });
GameEvent.belongsTo(User, { as: 'actor', foreignKey: 'actorUserId' });
GameRoom.hasMany(GameTransaction, { as: 'transactions', foreignKey: 'roomId' });
GameTransaction.belongsTo(GameRoom, { as: 'room', foreignKey: 'roomId' });
GameTransaction.belongsTo(User, { as: 'user', foreignKey: 'userId' });
GameRoom.hasMany(GameResult, { as: 'results', foreignKey: 'roomId' });
GameResult.belongsTo(GameRoom, { as: 'room', foreignKey: 'roomId' });
GameResult.belongsTo(User, { as: 'user', foreignKey: 'userId' });
User.hasOne(GameLeaderboardProfile, { as: 'gameProfile', foreignKey: 'userId' });
GameLeaderboardProfile.belongsTo(User, { as: 'user', foreignKey: 'userId' });

// Quiz Game V1 Associations
QuizRoom.belongsTo(User, { as: 'host', foreignKey: 'hostUserId' });
QuizRoom.belongsTo(User, { as: 'winner', foreignKey: 'winnerUserId' });
QuizRoom.belongsTo(QuizQuestion, { as: 'currentQuestion', foreignKey: 'currentQuestionId' });

QuizRoom.hasMany(QuizPlayer, { as: 'players', foreignKey: 'roomId' });
QuizPlayer.belongsTo(QuizRoom, { as: 'room', foreignKey: 'roomId' });
QuizPlayer.belongsTo(User, { as: 'user', foreignKey: 'userId' });

QuizRoom.hasMany(QuizAnswer, { as: 'answers', foreignKey: 'roomId' });
QuizAnswer.belongsTo(QuizRoom, { as: 'room', foreignKey: 'roomId' });
QuizAnswer.belongsTo(QuizQuestion, { as: 'question', foreignKey: 'questionId' });
QuizAnswer.belongsTo(User, { as: 'user', foreignKey: 'userId' });

User.hasOne(QuizUserStat, { as: 'quizStats', foreignKey: 'userId' });
QuizUserStat.belongsTo(User, { as: 'user', foreignKey: 'userId' });

// Game 2048 V1 Associations
User.hasMany(Game2048Score, { as: 'game2048Scores', foreignKey: 'userId' });
Game2048Score.belongsTo(User, { as: 'user', foreignKey: 'userId' });

User.hasOne(Game2048UserStat, { as: 'game2048Stats', foreignKey: 'userId' });
Game2048UserStat.belongsTo(User, { as: 'user', foreignKey: 'userId' });

module.exports = {
  sequelize,
  Team,
  User,
  UserProfileImage,
  UserProfilePreference,
  Friendship,
  ProfileLike,
  ChatMessage,
  TradingViewCandle,
  TradingViewWebhookAttempt,
  UserRecognition,
  // Phase 1 — Competition Engine Foundation
  EventOutbox,
  CompetitionEvent,
  // Phase 2 — Core Engine
  ScoreLedger,
  // Phase 3 — Stateful Competition
  CompetitionState,
  // Phase 4 — Season Framework & Challenges
  RuleSet,
  RuleSetVersion,
  Season,
  SeasonTeam,
  SeasonTeamMember,
  Challenge,
  SeasonFrozenResult,
  CompetitionAuditLog,
  // Phase 5 — Grand Championship
  GrandChampionship,
  GrandPointsLedger,
  GrandFrozenResult,
  // Phase 6 — Read Models & Projections
  CompetitionUserSummary,
  CompetitionTeamSummary,
  SeasonLeaderboardProjection,
  SeasonIndividualLeaderboardProjection,
  GrandLeaderboardProjection,
  GrandIndividualLeaderboardProjection,
  CompetitionActivityProjection,
  ProjectionCheckpoint,
  // YouTube & Team Analytics
  YouTubeChannel,
  YouTubeVideo,
  YouTubeChannelMetric,
  YouTubeVideoMetric,
  TeamYouTubeSummary,
  // Capital Board Game V1
  GameRoom,
  GamePlayer,
  GameProperty,
  GameEvent,
  GameTransaction,
  GameResult,
  GameLeaderboardProfile,
  // Quiz Game V1
  QuizRoom,
  QuizPlayer,
  QuizQuestion,
  QuizAnswer,
  QuizUserStat,
  // Game 2048 V1
  Game2048Score,
  Game2048UserStat,
};


