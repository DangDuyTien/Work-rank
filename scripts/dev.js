#!/usr/bin/env node

const { execFileSync, spawn } = require('node:child_process');
const path = require('node:path');

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const colorsEnabled = !process.env.NO_COLOR;
const reset = colorsEnabled ? '\x1b[0m' : '';
const projectRoot = path.resolve(process.cwd());
const requiredPorts = [5001, 5173];
const portsToRelease = [5001, 5173, 5174];

const services = [
  {
    name: 'backend',
    color: colorsEnabled ? '\x1b[36m' : '',
    args: ['--prefix', 'backend', 'run', 'dev'],
  },
  {
    name: 'frontend',
    color: colorsEnabled ? '\x1b[35m' : '',
    args: ['--prefix', 'frontend', 'run', 'dev', '--', '--host', '0.0.0.0'],
  },
];

const children = new Set();
let shuttingDown = false;

function runText(command, args) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function listenerPids(port) {
  return runText('lsof', [`-tiTCP:${port}`, '-sTCP:LISTEN'])
    .split(/\s+/)
    .map((pid) => Number(pid))
    .filter(Boolean);
}

function processCommand(pid) {
  return runText('ps', ['-p', String(pid), '-o', 'command=']);
}

function processCwd(pid) {
  const output = runText('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn']);
  const cwdLine = output.split(/\r?\n/).find((line) => line.startsWith('n'));
  return cwdLine ? path.resolve(cwdLine.slice(1)) : '';
}

function belongsToThisProject(pid) {
  const command = processCommand(pid);
  const cwd = processCwd(pid);
  return cwd.startsWith(projectRoot) || command.includes(projectRoot);
}

function oldDevPids() {
  return runText('ps', ['-axo', 'pid=,command='])
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*(\d+)\s+(.+)$/))
    .filter(Boolean)
    .map((match) => ({ pid: Number(match[1]), command: match[2] }))
    .filter(({ pid, command }) => {
      if (!pid || pid === process.pid) return false;
      if (command.includes(`${projectRoot}/backend/node_modules/.bin/nodemon`)) return true;
      if (command.includes(`${projectRoot}/frontend/node_modules/.bin/vite`)) return true;
      if (/(^|\s)node\s+src\/server\.js(\s|$)/.test(command)) return processCwd(pid).startsWith(path.join(projectRoot, 'backend'));
      return false;
    })
    .map(({ pid }) => pid);
}

function stopPid(pid, label, signal = 'SIGTERM') {
  try {
    process.kill(pid, signal);
    process.stdout.write(`[dev] stopped old WorkRank ${label} process ${pid}\n`);
    return true;
  } catch {
    return false;
  }
}

function releaseOldDevPorts() {
  const blocked = [];

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const signal = attempt === 2 ? 'SIGKILL' : 'SIGTERM';
    const signaledThisAttempt = new Set();
    let stoppedAny = false;

    for (const pid of oldDevPids()) {
      if (signaledThisAttempt.has(pid)) continue;
      if (stopPid(pid, 'dev', signal)) {
        signaledThisAttempt.add(pid);
        stoppedAny = true;
      }
    }

    for (const port of portsToRelease) {
      for (const pid of listenerPids(port)) {
        if (pid === process.pid || signaledThisAttempt.has(pid)) continue;

        if (!belongsToThisProject(pid)) {
          if (attempt === 0 && requiredPorts.includes(port)) {
            blocked.push({ port, pid, command: processCommand(pid) || 'unknown process' });
          }
          continue;
        }

        if (stopPid(pid, `process on port ${port}`, signal)) {
          signaledThisAttempt.add(pid);
          stoppedAny = true;
        }
      }
    }

    if (!stoppedAny) break;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, attempt === 2 ? 900 : 650);
  }

  const stillBlocked = [];
  for (const port of requiredPorts) {
    for (const pid of listenerPids(port)) {
      if (belongsToThisProject(pid)) {
        stillBlocked.push({ port, pid, command: processCommand(pid) || 'old WorkRank process' });
      }
    }
  }

  const finalBlocked = [...blocked, ...stillBlocked];
  if (finalBlocked.length > 0) {
    process.stderr.write('[dev] Cannot start because these ports are still busy:\n');
    for (const item of finalBlocked) {
      process.stderr.write(`[dev] - port ${item.port}: pid ${item.pid} (${item.command})\n`);
    }
    process.stderr.write('[dev] Stop those processes, then run `npm run dev` again.\n');
    process.exit(1);
  }
}

function writePrefixed(stream, service, chunk) {
  const lines = chunk.toString().split(/\r?\n/);
  for (const line of lines) {
    if (!line) continue;
    stream.write(`${service.color}[${service.name}]${reset} ${line}\n`);
  }
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }

  const timer = setTimeout(() => process.exit(exitCode), 1000);
  timer.unref();
}

releaseOldDevPorts();

for (const service of services) {
  const child = spawn(npmCommand, service.args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  children.add(child);
  child.stdout.on('data', (chunk) => writePrefixed(process.stdout, service, chunk));
  child.stderr.on('data', (chunk) => writePrefixed(process.stderr, service, chunk));

  child.on('close', (code, signal) => {
    children.delete(child);
    if (shuttingDown) {
      if (children.size === 0) process.exit(code || 0);
      return;
    }

    const reason = signal ? `signal ${signal}` : `code ${code}`;
    process.stderr.write(`[dev] ${service.name} stopped with ${reason}; stopping remaining services.\n`);
    shutdown(code || 1);
  });
}

process.on('SIGINT', () => shutdown(130));
process.on('SIGTERM', () => shutdown(143));
