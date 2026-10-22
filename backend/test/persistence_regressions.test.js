'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {User,ArcadePlayer,ArcadeRoom,ScoreLedger,Drawing}=require('../src/models');
const arcade=require('../src/services/arcade.service');
const drawing=require('../src/services/drawing.service');
const {setDrawingStorageForTests,resetDrawingStorage}=require('../src/services/storage/drawingStorage.service');
test('MySQL reordered JSON keys retain immutable event contents',async()=>{
 const {sameArcadeEvent}=await import('../../shared/arcade/engine.mjs');
 assert.ok(sameArcadeEvent({index:0,at:200,value:'HI',errors:0},{at:200,errors:0,index:0,value:'HI'}));
 assert.ok(!sameArcadeEvent({index:0,at:200,value:'HI',errors:0},{at:200,errors:1,index:0,value:'HI'}));
 assert.ok(!sameArcadeEvent({index:0,at:200,direction:'UP'},{at:201,index:0,direction:'UP'}));
 assert.ok(sameArcadeEvent({index:0,at:2400,cells:[1,2]},{cells:[1,2],at:2400,index:0}));
});
test('result TRIO migration extends both room and immutable result enum, idempotently',async()=>{
 const migration=require('../src/migrations/20261022090000-typing-result-trio-mode'),{DataTypes}=require('sequelize');const types={typing_rooms:"ENUM('SOLO','1V1','2V2','3V3')",typing_match_results:"ENUM('SOLO','1V1','2V2','3V3')"};let calls=0;
 const q={sequelize:{getDialect:()=> 'mysql'},describeTable:async table=>({mode:{type:types[table]}}),changeColumn:async(table,col,d)=>{assert.ok(d.type.values.includes('TRIO'));types[table]="ENUM('SOLO','1V1','TRIO','2V2','3V3')";calls++;}};
 await migration.up(q,DataTypes);await migration.up(q,DataTypes);assert.equal(calls,2);
});
test('Drawing upload intents preserve bytes across DB activation failure and retries; delete intents retry',async()=>{
 const crypto=require('node:crypto');const user=await User.create({name:'Persistence user',email:`persist-${Date.now()}@test`,passwordHash:'x',status:'active'});
 const objects=new Map();let uploads=0;const storage={provider:'s3',persistent:true,getPublicUrl:key=>'https://images.test/'+key,upload:async({key,buffer})=>{uploads++;objects.set(key,buffer);},delete:async({key})=>objects.delete(key),exists:async({key})=>objects.has(key)};setDrawingStorageForTests(storage);
 const id=crypto.randomUUID();const payload={userId:user.id,title:'Durable intent',imageUrl:storage.getPublicUrl(id),storageKey:id,storageProvider:'s3',publicationId:id,checksum:'correct-hash',buffer:Buffer.from('test bytes'),mimeType:'image/png',sizeBytes:10,storage};
 const original=Drawing.prototype.save;Drawing.prototype.save=async function(...args){if(this.status==='ACTIVE'&&this.metadata?.publicationId===id)throw new Error('activation DB failure');return original.apply(this,args);};
 try{await assert.rejects(drawing.createDrawing(payload),/activation DB failure/);}finally{Drawing.prototype.save=original;}
 let row=await Drawing.findOne({where:{userId:user.id,'metadata.publicationId':id}});assert.equal(row.status,'HIDDEN');assert.ok(objects.has(id));assert.equal(row.metadata.uploadState,'PENDING');
 const result=await drawing.createDrawing(payload);assert.equal(result.id,row.id);assert.equal((await Drawing.findByPk(row.id)).status,'ACTIVE');
 const before=uploads;assert.equal((await drawing.createDrawing(payload)).id,row.id);assert.equal(uploads,before);assert.equal(objects.size,1);
 const originalDelete=storage.delete;storage.delete=async()=>{throw new Error('storage unavailable');};
 await assert.rejects(drawing.deleteDrawing({drawingId:row.id,userId:user.id}),{code:'STORAGE_DELETE_FAILED'});row=await Drawing.findByPk(row.id);assert.equal(row.status,'HIDDEN');assert.equal(row.metadata.deletionPending,true);assert.ok(objects.has(id));
 storage.delete=originalDelete;assert.ok((await drawing.retryPendingDeletes()).includes(row.id));assert.equal(objects.has(id),false);assert.equal((await Drawing.findByPk(row.id)).status,'DELETED');assert.equal((await drawing.deleteDrawing({drawingId:row.id,userId:user.id})).alreadyDeleted,true);
 resetDrawingStorage();
});
