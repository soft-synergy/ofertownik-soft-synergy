const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:137.0) Gecko/20100101 Firefox/137.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:137.0) Gecko/20100101 Firefox/137.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Safari/605.1.15',
];

const ACCEPT_LANGUAGES = [
  'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
  'pl,en-US;q=0.9,en;q=0.8,de;q=0.5',
  'pl-PL;q=0.9,en;q=0.8,en-US;q=0.7',
];

const REFERERS = [
  'https://www.biznes-polska.pl/',
  'https://www.biznes-polska.pl/wyszukiwarka/k27844422/',
  'https://www.google.com/',
  'https://www.biznes-polska.pl/wyszukiwarka/',
];

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomUserAgent() {
  return pick(USER_AGENTS);
}

function getRandomAcceptLanguage() {
  return pick(ACCEPT_LANGUAGES);
}

function getRandomReferer() {
  return pick(REFERERS);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function delayBetweenPages(page, minMs = 8000, maxMs = 25000) {
  const base = rand(minMs, maxMs);
  const extra = page % 5 === 0 ? rand(15000, 45000) : 0;
  const jitter = rand(-2000, 2000);
  const ms = Math.max(3000, base + extra + jitter);
  return sleep(ms);
}

function delayBetweenDetails(index, minMs = 5000, maxMs = 18000) {
  const base = rand(minMs, maxMs);
  const extra = index % 10 === 0 ? rand(20000, 60000) : 0;
  const jitter = rand(-1500, 1500);
  const ms = Math.max(2000, base + extra + jitter);
  return sleep(ms);
}

function jitteredInterval(baseMs, jitterPercent = 0.15) {
  const jitter = rand(-Math.floor(baseMs * jitterPercent), Math.floor(baseMs * jitterPercent));
  return baseMs + jitter;
}

function jitteredStartDelay(baseMs, minMs = 60000, maxMs = 300000) {
  return rand(minMs, maxMs);
}

async function withRetry(fn, { maxRetries = 3, baseDelayMs = 10000, label = 'request' } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (err.response && (err.response.status === 429 || err.response.status === 503)) {
        const retryAfter = err.response.headers['retry-after'];
        const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.min(baseDelayMs * Math.pow(2, attempt), 120000);
        console.warn(`[Stealth] ${label}: ${err.response.status}, retry ${attempt + 1}/${maxRetries} za ${waitMs}ms`);
        await sleep(waitMs + rand(-2000, 2000));
        continue;
      }
      if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
        const waitMs = Math.min(baseDelayMs * Math.pow(1.5, attempt), 60000);
        console.warn(`[Stealth] ${label}: ${err.code}, retry ${attempt + 1}/${maxRetries} za ${waitMs}ms`);
        await sleep(waitMs + rand(-1000, 1000));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

module.exports = {
  getRandomUserAgent,
  getRandomAcceptLanguage,
  getRandomReferer,
  sleep,
  delayBetweenPages,
  delayBetweenDetails,
  jitteredInterval,
  jitteredStartDelay,
  withRetry,
  rand,
};
