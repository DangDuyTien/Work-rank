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
const QuizSet = require('./QuizSet');
const QuizRoom = require('./QuizRoom');
const QuizPlayer = require('./QuizPlayer');
const QuizQuestion = require('./QuizQuestion');
const QuizAnswer = require('./QuizAnswer');
const QuizUserStat = require('./QuizUserStat');
// Game 2048 V1 Models
const Game2048Score = require('./Game2048Score');
const Game2048UserStat = require('./Game2048UserStat');
// Sam Game Models
const SamRoom = require('./SamRoom');
const SamPlayer = require('./SamPlayer');
const SamAction = require('./SamAction');
const SamResult = require('./SamResult');
const SamUserStat = require('./SamUserStat');
// KPI Foundation Models
const Department = require('./Department');
const Kpi = require('./Kpi');
const KpiPeriod = require('./KpiPeriod');
const KpiResult = require('./KpiResult');
const KpiEvent = require('./KpiEvent');
// Production KPI Engine Models (Excel Mapping & Runtime Evaluation)
const ProductionKpiRule = require('./ProductionKpiRule');
const ProductionKpiActivation = require('./ProductionKpiActivation');
const ProductionKpiExecutionSnapshot = require('./ProductionKpiExecutionSnapshot');
// System Settings & Game Catalog
const SystemSetting = require('./SystemSetting');
const GameCatalog = require('./GameCatalog');

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
const YouTubeChannelMetric = require('./YouTubeChannelMetric');
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

User.hasMany(YouTubeChannel, { foreignKey: 'assignedUserId', as: 'assignedYouTubeChannels' });
YouTubeChannel.belongsTo(User, { foreignKey: 'assignedUserId', as: 'assignedUser' });

YouTubeChannel.hasMany(YouTubeChannelMetric, { foreignKey: 'channelId', as: 'metrics' });
YouTubeChannelMetric.belongsTo(YouTubeChannel, { foreignKey: 'channelId', as: 'channel' });

Team.hasOne(TeamYouTubeSummary, { foreignKey: 'teamId', as: 'youtubeSummary' });
TeamYouTubeSummary.belongsTo(Team, { foreignKey: 'teamId', as: 'team' });

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

// Quiz Game Associations
QuizSet.hasMany(QuizQuestion, { as: 'questions', foreignKey: 'quizSetId' });
QuizQuestion.belongsTo(QuizSet, { as: 'quizSet', foreignKey: 'quizSetId' });
QuizSet.belongsTo(User, { as: 'creator', foreignKey: 'createdByUserId' });
QuizQuestion.belongsTo(User, { as: 'creator', foreignKey: 'createdByUserId' });

QuizRoom.belongsTo(User, { as: 'host', foreignKey: 'hostUserId' });
QuizRoom.belongsTo(User, { as: 'winner', foreignKey: 'winnerUserId' });
QuizRoom.belongsTo(QuizQuestion, { as: 'currentQuestion', foreignKey: 'currentQuestionId' });
QuizRoom.belongsTo(QuizSet, { as: 'quizSet', foreignKey: 'quizSetId' });

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

// Sam Game Associations
SamRoom.belongsTo(User, { as: 'host', foreignKey: 'hostUserId' });
SamRoom.belongsTo(User, { as: 'winner', foreignKey: 'winnerUserId' });
SamRoom.belongsTo(User, { as: 'currentTurnPlayer', foreignKey: 'currentTurnUserId' });
SamRoom.hasMany(SamPlayer, { as: 'players', foreignKey: 'roomId' });
SamPlayer.belongsTo(SamRoom, { as: 'room', foreignKey: 'roomId' });
SamPlayer.belongsTo(User, { as: 'user', foreignKey: 'userId' });

SamRoom.hasMany(SamAction, { as: 'actions', foreignKey: 'roomId' });
SamAction.belongsTo(SamRoom, { as: 'room', foreignKey: 'roomId' });
SamAction.belongsTo(User, { as: 'user', foreignKey: 'userId' });

SamRoom.hasOne(SamResult, { as: 'result', foreignKey: 'roomId' });
SamResult.belongsTo(SamRoom, { as: 'room', foreignKey: 'roomId' });
SamResult.belongsTo(User, { as: 'winner', foreignKey: 'winnerUserId' });

User.hasOne(SamUserStat, { as: 'samStats', foreignKey: 'userId' });
SamUserStat.belongsTo(User, { as: 'user', foreignKey: 'userId' });

// KPI Foundation Associations
Department.hasMany(Kpi, { foreignKey: 'departmentId', as: 'kpis' });
Kpi.belongsTo(Department, { foreignKey: 'departmentId', as: 'department' });

Department.hasMany(User, { foreignKey: 'departmentId', as: 'users' });
User.belongsTo(Department, { foreignKey: 'departmentId', as: 'departmentRef' });

Department.hasMany(KpiResult, { foreignKey: 'departmentId', as: 'kpiResults' });
KpiResult.belongsTo(Department, { foreignKey: 'departmentId', as: 'department' });

Kpi.hasMany(KpiResult, { foreignKey: 'kpiId', as: 'results' });
KpiResult.belongsTo(Kpi, { foreignKey: 'kpiId', as: 'kpi' });

KpiPeriod.hasMany(KpiResult, { foreignKey: 'periodId', as: 'results' });
KpiResult.belongsTo(KpiPeriod, { foreignKey: 'periodId', as: 'period' });

User.hasMany(KpiResult, { foreignKey: 'userId', as: 'kpiResults' });
KpiResult.belongsTo(User, { foreignKey: 'userId', as: 'user' });

KpiResult.hasMany(KpiEvent, { foreignKey: 'kpiResultId', as: 'events' });
KpiEvent.belongsTo(KpiResult, { foreignKey: 'kpiResultId', as: 'kpiResult' });

// Production KPI Engine Associations
ProductionKpiExecutionSnapshot.belongsTo(User, { foreignKey: 'userId', as: 'user' });
ProductionKpiExecutionSnapshot.belongsTo(Team, { foreignKey: 'teamId', as: 'team' });
ProductionKpiExecutionSnapshot.belongsTo(ProductionKpiRule, { foreignKey: 'ruleId', as: 'rule' });
ProductionKpiExecutionSnapshot.belongsTo(ScoreLedger, { foreignKey: 'ledgerId', as: 'scoreLedger' });
ProductionKpiExecutionSnapshot.belongsTo(CompetitionEvent, { foreignKey: 'eventId', as: 'event' });

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
  YouTubeChannelMetric,
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
  QuizSet,
  QuizRoom,
  QuizPlayer,
  QuizQuestion,
  QuizAnswer,
  QuizUserStat,
  // Game 2048 V1
  Game2048Score,
  Game2048UserStat,
  // Sam Game V1
  SamRoom,
  SamPlayer,
  SamAction,
  SamResult,
  SamUserStat,
  // KPI Foundation Models
  Department,
  Kpi,
  KpiPeriod,
  KpiResult,
  KpiEvent,
  // Production KPI Engine Models
  ProductionKpiRule,
  ProductionKpiActivation,
  ProductionKpiExecutionSnapshot,
  // System Settings & Game Catalog
  SystemSetting,
  GameCatalog,
};


