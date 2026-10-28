'use strict';

/**
 * WR-AUDIT-018 — Dọn dữ liệu thi đấu sinh bởi test khỏi bề mặt người dùng.
 *
 * Trong DB dev có nhiều season/grand ACTIVE với tên máy sinh
 * ("Sec Season 1792203291661", "Perf Grand Championship ..."), hiển thị như
 * dữ liệu thật trên /arena và /grand. Script này:
 *  - giữ đúng 1 season ACTIVE + 1 grand ACTIVE
 *  - đổi tên bản ghi được giữ thành tên người đọc được
 *  - chuyển các bản ghi test trùng sang ARCHIVED (không xoá dữ liệu)
 *
 * Chạy: node scripts/cleanup-test-competition-data.js [--dry-run]
 * Không chạy tự động trong production; đây là công cụ vận hành dữ liệu.
 */

const sequelize = require('../src/config/database');
const { Season, GrandChampionship } = require('../src/models');

const TEST_NAME = /^(Sec Season|Perf Season|Perf Grand|Grand UAT|Season (Studio|Product|UAT|Typing)|Q4 Production Season|Season Q1)/i;

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  await sequelize.authenticate();

  const seasons = await Season.findAll({ order: [['id', 'ASC']] });
  const grands = await GrandChampionship.findAll({ order: [['id', 'ASC']] });

  const activeSeasons = seasons
    .filter((s) => s.status === 'ACTIVE')
    .sort((a, b) => new Date(a.endAt) - new Date(b.endAt) || a.id - b.id);
  const keepSeason = activeSeasons.at(-1);
  const seasonPlan = seasons.map((season) => {
    if (season.id === keepSeason?.id) {
      return { id: season.id, from: season.name, to: 'Mùa Giải 2026', status: 'ACTIVE' };
    }
    if (season.status === 'ACTIVE' && TEST_NAME.test(season.name)) {
      return { id: season.id, from: season.name, to: season.name, status: 'ARCHIVED' };
    }
    return null;
  }).filter(Boolean);

  const activeGrands = grands.filter((g) => g.status === 'ACTIVE');
  const keepGrand = activeGrands.find((g) => TEST_NAME.test(g.name)) || activeGrands[0];
  const grandPlan = grands.map((grand) => {
    if (grand.id === keepGrand?.id) {
      return { id: grand.id, from: grand.name, to: 'Giải Vô Địch Năm 2026', status: 'ACTIVE' };
    }
    if (grand.status === 'ACTIVE' && TEST_NAME.test(grand.name)) {
      return { id: grand.id, from: grand.name, to: grand.name, status: 'ARCHIVED' };
    }
    return null;
  }).filter(Boolean);

  console.log('SEASON PLAN');
  seasonPlan.forEach((row) => console.log(`  #${row.id} "${row.from}" -> "${row.to}" [${row.status}]`));
  console.log('GRAND PLAN');
  grandPlan.forEach((row) => console.log(`  #${row.id} "${row.from}" -> "${row.to}" [${row.status}]`));

  if (dryRun) {
    console.log('DRY RUN — không ghi DB.');
    return;
  }

  await sequelize.transaction(async (transaction) => {
    for (const row of seasonPlan) {
      await Season.update({ name: row.to, status: row.status }, { where: { id: row.id }, transaction });
    }
    for (const row of grandPlan) {
      await GrandChampionship.update({ name: row.to, status: row.status }, { where: { id: row.id }, transaction });
    }
  });

  console.log('Đã cập nhật. Season ACTIVE còn lại:',
    await Season.count({ where: { status: 'ACTIVE' } }),
    '| Grand ACTIVE còn lại:', await GrandChampionship.count({ where: { status: 'ACTIVE' } }));
}

main()
  .then(() => sequelize.close())
  .catch((error) => { console.error(error); process.exitCode = 1; return sequelize.close(); });
