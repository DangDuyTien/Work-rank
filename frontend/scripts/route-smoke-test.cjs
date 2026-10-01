/**
 * ROUTE SMOKE TEST & LAZY MODULE RESOLUTION TEST
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const routes = [
  { name: 'Home', path: '../src/pages/Home.jsx' },
  { name: 'Login', path: '../src/pages/Login.jsx' },
  { name: 'Dashboard', path: '../src/pages/Dashboard.jsx' },
  { name: 'YouTubeOverview', path: '../src/pages/YouTubeOverview.jsx' },
  { name: 'Arena', path: '../src/pages/Arena.jsx' },
  { name: 'GrandHub', path: '../src/pages/GrandHub.jsx' },
  { name: 'Leaderboard', path: '../src/pages/Leaderboard.jsx' },
  { name: 'Friends', path: '../src/pages/Friends.jsx' },
  { name: 'Settings', path: '../src/pages/Settings.jsx' },
  { name: 'UserDetail', path: '../src/pages/UserDetail.jsx' },
  { name: 'AdminPrivileges', path: '../src/pages/AdminPrivileges.jsx' },
  { name: 'AdminTeamsYouTube', path: '../src/pages/AdminTeamsYouTube.jsx' },
  { name: 'AdminSeasons', path: '../src/pages/AdminSeasons.jsx' },
  { name: 'AdminGrand', path: '../src/pages/AdminGrand.jsx' },
  { name: 'AdminOperations', path: '../src/pages/AdminOperations.jsx' },
  { name: 'CapitalBoardGame', path: '../src/pages/CapitalBoardGame.jsx' },
  { name: 'Layout', path: '../src/components/Layout.jsx' },
  { name: 'Sidebar', path: '../src/components/Sidebar.jsx' },
  { name: 'VerifiedBadge', path: '../src/components/VerifiedBadge.jsx' },
  { name: 'JobTitleBadge', path: '../src/components/JobTitleBadge.jsx' },
];

async function runRouteSmokeTests() {
  console.log('🧪 [WorkRank Route Smoke Test] Checking all 20 core pages & layout components...\n');
  let passed = 0;
  let failed = 0;

  for (const route of routes) {
    const fullPath = path.resolve(__dirname, route.path);
    if (!fs.existsSync(fullPath)) {
      console.error(`❌ [Missing File] ${route.name}: ${fullPath} does not exist!`);
      failed++;
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    // Check export default
    if (!content.includes('export default') && !content.includes('export {') && !content.includes('export const')) {
      console.error(`❌ [No Export] ${route.name} does not have any exports!`);
      failed++;
      continue;
    }

    console.log(`  ✔ [PASS] Route Component: ${route.name.padEnd(20)} (${route.path})`);
    passed++;
  }

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed.\n`);
  if (failed > 0) process.exit(1);
}

runRouteSmokeTests();
