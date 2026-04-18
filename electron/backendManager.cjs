/**
 * Kwanza ERP — Backend Manager (Option A, Phases 1–4)
 *
 * Responsibilities:
 *   1. Spawn the Express backend (backend/src/server.js) as a child process
 *      using Electron's bundled Node runtime, with PORT injected dynamically.
 *   2. Detect a free TCP port (3000 → 3010 fallback) so multiple installs /
 *      stale processes don't collide.
 *   3. Pre-flight Docker PostgreSQL check on localhost:5432 (TCP) before
 *      spawning, so we surface a friendly error instead of an instant crash.
 *   4. Server/Client mode awareness: skip spawn entirely when this PC is a
 *      LAN client (Express lives on the server PC, not here).
 *
 * Exposes:
 *   start(opts) → { skipped|started, port, error? }
 *   stop()      → graceful SIGTERM with hard-kill timeout
 *   getPort()   → currently bound port (or null)
 *   getStatus() → { running, port, mode, dockerOk }
 *
 * NOT included yet (phases 5–7, intentionally deferred):
 *   - Health monitoring + auto-restart
 *   - Rotating log files to %APPDATA%/KwanzaERP/logs/
 *   - Code-signing / firewall rule installer
 */

const path = require('path');
const fs = require('fs');
const net = require('net');
const { spawn } = require('child_process');
const { app } = require('electron');

const DEFAULT_PORT = 3000;
const PORT_RANGE = 10;            // try 3000..3009
const DOCKER_HOST = '127.0.0.1';
const DOCKER_PG_PORT = 5432;
const DOCKER_TCP_TIMEOUT = 1500;
const SHUTDOWN_GRACE_MS = 4000;

// Phase 5: health monitor tunables
const HEALTH_INTERVAL_MS = 30000;       // poll cadence
const HEALTH_TIMEOUT_MS = 4000;         // single-probe timeout
const HEALTH_FAILS_BEFORE_RESTART = 3;  // 3 consecutive misses → restart
const RESTART_BACKOFF_MS = 2000;        // wait between restart attempts
const MAX_RESTART_ATTEMPTS = 3;         // give up after this many in a row

let childProc = null;
let boundPort = null;
let lastMode = 'unknown';
let lastDockerOk = false;

// Phase 5 state
let healthTimer = null;
let consecutiveFails = 0;
let restartAttempts = 0;
let isRestarting = false;
let statusListener = null;          // (status) => void  set by main.cjs
let lastHealthState = null;         // dedupe identical 'healthy' emits

function setStatusListener(fn) {
  statusListener = typeof fn === 'function' ? fn : null;
}

function emitStatus(event) {
  // event: { state: 'healthy'|'degraded'|'down'|'restarting'|'restarted'|'failed', detail? }
  const payload = { ...event, port: boundPort, mode: lastMode, ts: Date.now() };
  // Dedupe back-to-back 'healthy' so we don't fire a toast every 30s.
  if (payload.state === 'healthy' && lastHealthState === 'healthy') return;
  lastHealthState = payload.state;
  try { statusListener && statusListener(payload); } catch (_) {}
}

// --------------------------------------------------------------------------
// Path resolution: backend lives next to electron/ in dev, and is shipped via
// extraResources (electron-builder.json) in production at:
//   <resourcesPath>/backend/src/server.js
// --------------------------------------------------------------------------
function resolveBackendEntry() {
  const candidates = [
    path.join(__dirname, '..', 'backend', 'src', 'server.js'),                          // dev
    process.resourcesPath ? path.join(process.resourcesPath, 'backend', 'src', 'server.js') : null,
    process.resourcesPath ? path.join(process.resourcesPath, 'app.asar.unpacked', 'backend', 'src', 'server.js') : null,
  ].filter(Boolean);

  for (const p of candidates) {
    try { if (fs.existsSync(p)) return p; } catch (_) {}
  }
  return null;
}

function resolveBackendCwd(entryPath) {
  // server.js sits at backend/src/server.js → cwd should be backend/
  return path.resolve(path.dirname(entryPath), '..');
}

// --------------------------------------------------------------------------
// 2) Port detection
// --------------------------------------------------------------------------
function isPortFree(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', () => resolve(false))
      .once('listening', () => tester.close(() => resolve(true)))
      .listen(port, '127.0.0.1');
  });
}

async function findFreePort(start = DEFAULT_PORT, range = PORT_RANGE) {
  for (let i = 0; i < range; i++) {
    const candidate = start + i;
    // eslint-disable-next-line no-await-in-loop
    if (await isPortFree(candidate)) return candidate;
  }
  return null;
}

// --------------------------------------------------------------------------
// 3) Docker pre-flight (cheap TCP probe, no pg dependency required)
// --------------------------------------------------------------------------
function probeDockerPostgres(host = DOCKER_HOST, port = DOCKER_PG_PORT, timeoutMs = DOCKER_TCP_TIMEOUT) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;
    const done = (ok) => {
      if (settled) return;
      settled = true;
      try { socket.destroy(); } catch (_) {}
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    try { socket.connect(port, host); } catch (_) { done(false); }
  });
}

// --------------------------------------------------------------------------
// 4) Mode detection — defer to caller (it owns IP-file parsing).
//    We accept a mode hint: 'server' | 'client' | 'standalone' | 'unknown'.
//    Only 'server' and 'standalone' should spawn Express here.
// --------------------------------------------------------------------------
function shouldSpawnForMode(mode) {
  return mode === 'server' || mode === 'standalone' || mode === 'unknown';
}

// --------------------------------------------------------------------------
// Spawn
// --------------------------------------------------------------------------
function spawnBackend(entryPath, port) {
  const cwd = resolveBackendCwd(entryPath);

  // Use Electron's own binary as Node.   ELECTRON_RUN_AS_NODE=1 makes it
  // behave as a bare Node process (no Chromium), so users don't need a
  // separate Node install and we get a known-good runtime version.
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    PORT: String(port),
    NODE_ENV: process.env.NODE_ENV || 'production',
  };

  const proc = spawn(process.execPath, [entryPath], {
    cwd,
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  proc.stdout.on('data', (chunk) => {
    process.stdout.write(`[backend] ${chunk}`);
  });
  proc.stderr.on('data', (chunk) => {
    process.stderr.write(`[backend!] ${chunk}`);
  });
  proc.on('exit', (code, signal) => {
    console.log(`[BackendManager] child exited code=${code} signal=${signal}`);
    if (childProc === proc) {
      childProc = null;
      boundPort = null;
    }
  });

  return proc;
}

// Wait until Express answers /api/health (or any 2xx/4xx — anything but ECONNREFUSED).
function waitForBackendReady(port, timeoutMs = 15000) {
  const http = require('http');
  const start = Date.now();
  return new Promise((resolve) => {
    const tryOnce = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/api/health', timeout: 1000 }, (res) => {
        res.resume();
        resolve(true);
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) return resolve(false);
        setTimeout(tryOnce, 400);
      });
      req.on('timeout', () => {
        req.destroy();
        if (Date.now() - start > timeoutMs) return resolve(false);
        setTimeout(tryOnce, 400);
      });
    };
    tryOnce();
  });
}

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------
async function start(opts = {}) {
  const mode = opts.mode || 'unknown';
  lastMode = mode;

  // Phase 4: client PCs MUST NOT spawn a local Express — they use the server's.
  if (!shouldSpawnForMode(mode)) {
    console.log(`[BackendManager] mode="${mode}" → skipping spawn (client uses remote backend)`);
    return { skipped: true, reason: 'client-mode', mode };
  }

  // Already running in this process?
  if (childProc && boundPort) {
    return { started: true, port: boundPort, mode, alreadyRunning: true };
  }

  // Phase 3: Docker pre-flight
  lastDockerOk = await probeDockerPostgres();
  if (!lastDockerOk) {
    const err = `Docker PostgreSQL unreachable at ${DOCKER_HOST}:${DOCKER_PG_PORT}. Is Docker Desktop running?`;
    console.error(`[BackendManager] ${err}`);
    return { error: err, code: 'DOCKER_UNAVAILABLE', mode };
  }

  // Resolve backend entry
  const entry = resolveBackendEntry();
  if (!entry) {
    const err = 'backend/src/server.js not found in dev tree or packaged resources.';
    console.error(`[BackendManager] ${err}`);
    return { error: err, code: 'BACKEND_NOT_FOUND', mode };
  }

  // Phase 2: pick a free port
  const port = await findFreePort(DEFAULT_PORT, PORT_RANGE);
  if (!port) {
    const err = `No free port in range ${DEFAULT_PORT}..${DEFAULT_PORT + PORT_RANGE - 1}.`;
    console.error(`[BackendManager] ${err}`);
    return { error: err, code: 'NO_FREE_PORT', mode };
  }

  console.log(`[BackendManager] spawning backend on port ${port} (mode=${mode}) entry=${entry}`);
  childProc = spawnBackend(entry, port);
  boundPort = port;

  // Don't return until /api/health responds (or we time out).
  const ready = await waitForBackendReady(port, 15000);
  if (!ready) {
    console.error('[BackendManager] backend did not become ready within 15s');
    // We keep the child running — the server may still come up shortly. UI
    // will reconnect via its own polling. But surface the warning.
    return { started: true, port, mode, warning: 'backend-not-ready-in-time' };
  }

  console.log(`[BackendManager] backend ready on http://127.0.0.1:${port}`);
  return { started: true, port, mode };
}

async function stop() {
  if (!childProc) return { stopped: true, alreadyStopped: true };
  const proc = childProc;
  childProc = null;
  const port = boundPort;
  boundPort = null;

  return new Promise((resolve) => {
    let done = false;
    const finish = (how) => {
      if (done) return;
      done = true;
      console.log(`[BackendManager] backend stopped (${how}) port=${port}`);
      resolve({ stopped: true, port });
    };

    proc.once('exit', () => finish('exit'));

    try { proc.kill('SIGTERM'); } catch (_) {}
    setTimeout(() => {
      if (done) return;
      try { proc.kill('SIGKILL'); } catch (_) {}
      finish('sigkill');
    }, SHUTDOWN_GRACE_MS);
  });
}

function getPort() {
  return boundPort;
}

function getStatus() {
  return {
    running: !!childProc,
    port: boundPort,
    mode: lastMode,
    dockerOk: lastDockerOk,
  };
}

module.exports = { start, stop, getPort, getStatus, probeDockerPostgres, findFreePort };
