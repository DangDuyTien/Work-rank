'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { SystemSetting, User, UserProfileImage } = require('../src/models');
const service = require('../src/services/competition/publicSpotlight.service');

test('archives resolve linked portraits and retain historical fields and legacy members', async (t) => {
  const entry = { year: 2025, championTeam: { teamName: 'Old team',
    members: [{ userId: 7 }, { name: 'Legacy member' }] },
  mvp: { userId: 7, jobTitle: 'Historical job', awardTitle: 'MVP 2025', score: 1200, isVerified: false } };
  const setting = { settingValue: [], save: async () => {} };
  t.mock.method(SystemSetting, 'findOne', async () => setting);
  t.mock.method(User, 'findAll', async () => [{ id: 7, name: 'Linked user', jobTitle: 'Current job',
    isVerified: true, UserProfilePreference: { avatarData: '/avatar.png' } }]);
  t.mock.method(UserProfileImage, 'findAll', async () => [
    { userId: 7, slot: 0, imageData: '/gallery-0.png' },
    { userId: 7, slot: 1, imageData: '/gallery-1.png' },
  ]);
  const saved = await service.adminSaveArchiveEntry(entry);
  assert.equal(saved.mvp.name, 'Linked user');
  assert.equal(saved.championTeam.members[0].userId, 7);
  assert.equal(saved.mvp.avatarData, undefined);
  const [publicEntry] = await service.getPublicArchives();
  assert.equal(publicEntry.championTeam.members[0].avatarData, '/avatar.png');
  assert.deepEqual(publicEntry.championTeam.members[1], { name: 'Legacy member' });
  assert.equal(publicEntry.mvp.avatarData, '/avatar.png');
  assert.deepEqual(publicEntry.mvp.galleryImages, ['/gallery-0.png', '/gallery-1.png']);
  assert.equal(publicEntry.mvp.score, 1200);
  assert.equal(publicEntry.mvp.jobTitle, 'Historical job');
  assert.equal(publicEntry.mvp.isVerified, true);
  assert.equal(publicEntry.id, undefined);
  assert.equal(UserProfileImage.findAll.mock.callCount(), 1);
});

test('archives reject nonexistent or invalid linked users before saving', async (t) => {
  const setting = { settingValue: [], save: t.mock.fn() };
  t.mock.method(SystemSetting, 'findOne', async () => setting);
  t.mock.method(User, 'findAll', async () => []);
  for (const userId of [999, -1, 'invalid']) {
    await assert.rejects(service.adminSaveArchiveEntry({ year: 2025, mvp: { userId } }),
      (err) => err.status === 400);
  }
  assert.equal(setting.save.mock.callCount(), 0);
});

test('legacy archives stay readable without querying account profiles', async (t) => {
  const entry = { year: 2024, championTeam: { members: ['Legacy name'] }, mvp: { name: 'Legacy MVP' } };
  t.mock.method(SystemSetting, 'findOne', async () => ({ settingValue: [entry] }));
  t.mock.method(User, 'findAll', async () => { throw new Error('Unexpected profile query'); });
  assert.deepEqual(await service.getPublicArchives(), [entry]);
});
