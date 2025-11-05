const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const Hosting = require('../models/Hosting');
const HostingMonitor = require('../models/HostingMonitor');
const HostingCheck = require('../models/HostingCheck');

function fetchWithTimeout(url, timeoutMs = 10000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const duration = Date.now() - start;
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          statusCode: res.statusCode,
          html: Buffer.concat(chunks).toString('utf8'),
          responseTimeMs: duration,
          error: null
        });
      });
    });
    req.on('error', (err) => {
      const duration = Date.now() - start;
      resolve({ ok: false, statusCode: null, html: null, responseTimeMs: duration, error: err.message });
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('Request timed out'));
    });
  });
}

function ensureUrl(domain) {
  if (!domain) return null;
  if (domain.startsWith('http://') || domain.startsWith('https://')) return domain;
  return `https://${domain}`;
}

async function saveHtmlSnapshot(hostingId, html) {
  try {
    const baseDir = path.join(__dirname, '..', 'uploads', 'monitoring', String(hostingId));
    fs.mkdirSync(baseDir, { recursive: true });
    const fileName = `snapshot-${Date.now()}.html`;
    const fullPath = path.join(baseDir, fileName);
    fs.writeFileSync(fullPath, html || '');
    // store relative path from server root
    return path.relative(path.join(__dirname, '..'), fullPath);
  } catch (e) {
    return null;
  }
}

async function checkOne(hosting) {
  const url = ensureUrl(hosting.domain);
  if (!url) return;

  const monitor = await HostingMonitor.findOneAndUpdate(
    { hosting: hosting._id },
    { hosting: hosting._id, url },
    { new: true, upsert: true }
  );

  const result = await fetchWithTimeout(url, 12000);
  let htmlPath = null;
  if (!result.ok || (result.statusCode && (result.statusCode < 200 || result.statusCode >= 300))) {
    htmlPath = await saveHtmlSnapshot(hosting._id, result.html);
  }

  await HostingCheck.create({
    hosting: hosting._id,
    url,
    ok: !!result.ok,
    statusCode: result.statusCode,
    responseTimeMs: result.responseTimeMs,
    error: result.error,
    htmlPath
  });

  // update monitor status
  const now = new Date();
  const isDownNow = !result.ok;
  const wasDown = monitor.isDown;
  const alarmActive = monitor.alarmActive || isDownNow || wasDown; // persist alarm once triggered

  monitor.isDown = isDownNow;
  monitor.lastCheckedAt = now;
  monitor.lastStatusCode = result.statusCode;
  monitor.lastResponseTimeMs = result.responseTimeMs;
  monitor.lastError = result.error;
  if (htmlPath) monitor.lastHtmlPath = htmlPath;

  if (isDownNow && !wasDown) {
    monitor.downSince = now;
  }

  // trigger alarm if down
  if (isDownNow) {
    monitor.alarmActive = true;
    monitor.acknowledged = false;
    monitor.acknowledgedAt = null;
    monitor.acknowledgedBy = null;
  } else {
    // if recovered, keep alarmActive until admin acknowledges
    monitor.alarmActive = alarmActive;
  }

  await monitor.save();
}

let intervalHandle = null;

async function runOnce() {
  const hostings = await Hosting.find({});
  for (const h of hostings) {
    try {
      // fire and await serially to avoid thundering herd on small servers
      // can be parallelized if needed
      await checkOne(h);
    } catch (e) {
      // swallow per-target errors to keep loop running
    }
  }
}

function start(intervalMs = 5 * 60 * 1000) {
  if (intervalHandle) return;
  // initial delay 5s then run
  setTimeout(runOnce, 5000);
  intervalHandle = setInterval(runOnce, intervalMs);
}

function stop() {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
}

module.exports = { start, stop, runOnce };


