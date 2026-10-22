'use strict';
// Full-stack persistence QA: dedicated disk MySQL database + independent S3 service.
if (process.env.NODE_ENV !== 'test' || process.env.DB_DIALECT !== 'mysql' || process.env.DB_NAME_TEST !== 'workrank_persistence_20261022_audit') throw new Error('Persistence fixture requires the explicit dedicated MySQL audit database');
const env=require('../../src/config/env');
if(env.db.name!=='workrank_persistence_20261022_audit')throw new Error('Unsafe persistence fixture DB');
const http=require('node:http'),bcrypt=require('bcryptjs');const {Server}=require('socket.io');
const models=require('../../src/models');const {sequelize,User,Season,TypingChallenge,ArcadeRoom,ArcadePlayer,TypingMatchResult,TypingUserStat,TypingPracticeAttempt,Drawing,ScoreLedger}=models;
const app=require('../../src/app'),fixture=require('express')();
fixture.get('/api/__persistence-audit',async(req,res)=>{
 const [arcade,typing,practice,drawings,ledger,stats]=await Promise.all([
  ArcadePlayer.findAll({attributes:['id','roomId','userId','finishedAt','result','revision']}),
  TypingMatchResult.findAll(),TypingPracticeAttempt.findAll({attributes:['id','userId','status','result']}),
  Drawing.findAll({attributes:['id','userId','status','storageKey','storageProvider','imageUrl','metadata']}),
  ScoreLedger.findAll({attributes:['id','userId','idempotencyKey','pointsDelta']}),TypingUserStat.findAll(),
 ]);
 res.json({database:env.db.name,arcade,typing,practice,drawings,ledger,stats});
});
fixture.use(app);
(async()=>{
 await sequelize.authenticate();await sequelize.sync();
 await require('../../src/services/typingSchemaCheck').ensureTypingSchema(sequelize);
 await require('../../src/services/arcadeSchemaCheck').ensureArcadeSchema(sequelize);
 await require('../../src/services/drawingSchemaCheck').ensureDrawingSchema(sequelize);
 const hash=await bcrypt.hash('PersistenceAuditTest123!',4);
 for(const suffix of ['a','b','c','d','e','f','g','h','i','native'])await User.findOrCreate({where:{email:`persistence-${suffix}@audit.test`},defaults:{name:({a:'Lan',b:'Minh',c:'Huy',d:'An',e:'Bình',f:'Chi',g:'Đạt',h:'Giang',i:'Hà',native:'QA Vẽ'})[suffix],passwordHash:hash,status:'active',role:'user'}});
 await Season.findOrCreate({where:{slug:'persistence-audit'},defaults:{name:'Persistent QA',status:'ACTIVE',startAt:new Date(Date.now()-86400000),endAt:new Date(Date.now()+86400000)}});
 await TypingChallenge.findOrCreate({where:{title:'Persistence QA paragraph'},defaults:{language:'VI',difficulty:'MEDIUM',isActive:true,content:'cùng nhau học hỏi từng ngày giữ nhịp thật đều nhìn rõ từng chữ sửa lỗi rồi tiếp tục cuộc đua '.repeat(50)}});
 await require('../../src/services/gameCatalog.service').getCatalog();
 const server=http.createServer(fixture),io=new Server(server,require('../../src/config/socket'));app.set('io',io);require('../../src/sockets')(io);
 await require('../../src/services/drawing.service').retryPendingDeletes();
 server.listen(env.port,'127.0.0.1',()=>console.log('Persistent MySQL + S3 audit ready',env.port));
 let closing=false;const close=()=>{if(closing)return;closing=true;require('../../src/services/arcade.service').stop();io.close();server.close();sequelize.close().finally(()=>process.exit(0));};process.on('SIGTERM',close);process.on('SIGINT',close);
})().catch(e=>{console.error(e);process.exit(1);});
