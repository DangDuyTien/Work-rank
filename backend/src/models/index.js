const sequelize = require('../config/database');
const ArcadeRoom = require('./ArcadeRoom');
const ArcadePlayer = require('./ArcadePlayer');
const Team = require('./Team');
const User = require('./User');
const GoogleAuthTicket = require('./GoogleAuthTicket');
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
// Typing Competition Models
const TypingChallenge = require('./TypingChallenge');
const TypingRoom = require('./TypingRoom');
const TypingPlayer = require('./TypingPlayer');
const TypingMatchResult = require('./TypingMatchResult');
const TypingUserStat = require('./TypingUserStat');
const TypingPracticeAttempt = require('./TypingPracticeAttempt');
// Creative Corner Drawing Models
const Drawing = require('./Drawing');
const DrawingLike = require('./DrawingLike');

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

ArcadeRoom.hasMany(ArcadePlayer, { foreignKey: 'roomId', as: 'players', onDelete: 'CASCADE' });
ArcadePlayer.belongsTo(ArcadeRoom, { foreignKey: 'roomId' });
ArcadePlayer.belongsTo(User, { foreignKey: 'userId' });

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

// Typing Competition Associations
TypingRoom.belongsTo(User, { as: 'host', foreignKey: 'hostUserId' });
TypingRoom.belongsTo(User, { as: 'winner', foreignKey: 'winnerUserId' });
TypingRoom.belongsTo(TypingChallenge, { as: 'challenge', foreignKey: 'challengeId' });
TypingRoom.hasMany(TypingPlayer, { as: 'players', foreignKey: 'roomId' });
TypingPlayer.belongsTo(TypingRoom, { as: 'room', foreignKey: 'roomId' });
TypingPlayer.belongsTo(User, { as: 'user', foreignKey: 'userId' });

TypingRoom.hasOne(TypingMatchResult, { as: 'result', foreignKey: 'roomId' });
TypingMatchResult.belongsTo(TypingRoom, { as: 'room', foreignKey: 'roomId' });
TypingMatchResult.belongsTo(User, { as: 'winner', foreignKey: 'winnerUserId' });
TypingMatchResult.belongsTo(Season, { as: 'season', foreignKey: 'seasonId' });

User.hasOne(TypingUserStat, { as: 'typingStats', foreignKey: 'userId' });
TypingUserStat.belongsTo(User, { as: 'user', foreignKey: 'userId' });

TypingChallenge.belongsTo(User, { as: 'creator', foreignKey: 'createdBy' });

// Creative Corner Drawing Associations
User.hasMany(Drawing, { as: 'drawings', foreignKey: 'userId' });
Drawing.belongsTo(User, { as: 'author', foreignKey: 'userId' });

Drawing.hasMany(DrawingLike, { as: 'likes', foreignKey: 'drawingId' });
DrawingLike.belongsTo(Drawing, { as: 'drawing', foreignKey: 'drawingId' });
User.hasMany(DrawingLike, { as: 'drawingLikes', foreignKey: 'userId' });
DrawingLike.belongsTo(User, { as: 'user', foreignKey: 'userId' });

module.exports = {
  ArcadeRoom,
  ArcadePlayer,
  sequelize,
  Team,
  User,
  GoogleAuthTicket,
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
  // Typing Competition Models
  TypingChallenge,
  TypingRoom,
  TypingPlayer,
  TypingMatchResult,
  TypingUserStat,
  TypingPracticeAttempt,
  // Creative Corner Drawing Models
  Drawing,
  DrawingLike,
};


