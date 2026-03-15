const axios = require('axios');
const cheerio = require('cheerio');
const { BIZNES_POLSKA_COOKIES } = require('./server/services/biznesPolskaScraper');

const SEARCH_URL = 'https://www.biznes-polska.pl/wyszukiwarka/k27844422/?s=7';

const buildOpts = (cookies) => ({
  headers: {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'max-age=0',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
    'Referer': 'https://www.biznes-polska.pl/',
    'Cookie': (cookies || BIZNES_POLSKA_COOKIES).trim()
  },
  timeout: 30000,
  maxRedirects: 5,
  validateStatus: (s) => s === 200
});

(async () => {
  console.log('Fetching:', SEARCH_URL);
  console.log('Cookies length:', BIZNES_POLSKA_COOKIES.length);
  console.log('Cookie header present:', !!BIZNES_POLSKA_COOKIES);
  console.log('---');

  const res = await axios.get(SEARCH_URL, buildOpts());
  console.log('Status:', res.status);
  console.log('Content length:', res.data.length);

  const $ = cheerio.load(res.data);

  // Struktura tabel
  console.log('\n=== Tables ===');
  $('table').each((i, el) => {
    const cls = $(el).attr('class') || '';
    const id = $(el).attr('id') || '';
    const rows = $(el).find('tr').length;
    const tbody = $(el).find('tbody tr').length;
    console.log(`Table ${i}: class="${cls}" id="${id}" tr=${rows} tbody.tr=${tbody}`);
  });

  // Szukaj tabel z wynikami (stare: table.std tbody tr)
  const oldSelector = 'table.std tbody tr';
  const oldCount = $(oldSelector).length;
  console.log('\n=== Old selector table.std tbody tr ===');
  console.log('Count:', oldCount);

  if (oldCount > 0) {
    const $first = $(oldSelector).first();
    console.log('First row HTML (abridged):', $first.get(0).tagName, $first.find('td').length, 'cells');
    $first.find('td').each((i, td) => {
      const c = $(td).attr('class') || '';
      const text = $(td).text().trim().slice(0, 60);
      console.log(`  td[${i}] class="${c}" => "${text}"`);
    });
  }

  // Wszystkie tbody tr w jakiejkolwiek tabeli
  console.log('\n=== All tbody tr (any table) ===');
  let found = false;
  $('table tbody tr').each((i, tr) => {
    const $tr = $(tr);
    const tds = $tr.find('td');
    if (tds.length < 2) return;
    const firstText = $tr.find('td').first().text().trim();
    const hasLink = $tr.find('a[href*="/przetargi/"], a[href*="/inwestycje/"]').length > 0;
    if (hasLink || firstText.match(/^\d{6,}$/)) {
      if (!found) {
        console.log('Sample row (with link or numeric id):');
        console.log('  td count:', tds.length);
        tds.each((j, td) => {
          const c = $(td).attr('class') || '';
          const txt = $(td).text().trim().slice(0, 50);
          const href = $(td).find('a').attr('href') || '';
          console.log(`  td[${j}] class="${c}" text="${txt}" href="${href.slice(0, 60)}"`);
        });
        found = true;
      }
    }
  });
  if (!found) {
    console.log('No row with link or numeric id found. Dumping first 3 table rows:');
    $('table tbody tr').slice(0, 3).each((i, tr) => {
      const $tr = $(tr);
      console.log('Row', i, '- td count:', $tr.find('td').length);
      console.log('  html (first 400 chars):', $tr.html().replace(/\s+/g, ' ').slice(0, 400));
    });
  }

  // Linki do ofert
  console.log('\n=== Links to offers (a[href*="/przetargi/"], a[href*="/inwestycje/"]) ===');
  const links = [];
  $('a[href*="/przetargi/"], a[href*="/inwestycje/"]').each((_, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().trim().slice(0, 80);
    if (href && !href.includes('#')) links.push({ href, text });
  });
  console.log('Count:', links.length);
  links.slice(0, 3).forEach((l, i) => console.log(`  ${i}: ${l.href} | ${l.text}`));

  // Id w input selected
  console.log('\n=== input[name="selected"] ===');
  const inputs = $('input[name="selected"]');
  console.log('Count:', inputs.length);
  inputs.slice(0, 3).each((i, el) => console.log('  value:', $(el).attr('value')));

  // Paginacja
  console.log('\n=== Pagination (s=) ===');
  $('a[href*="s="]').each((_, el) => {
    const href = $(el).attr('href');
    if (href) console.log('  ', href.slice(-20));
  });
})().catch((e) => {
  console.error('Error:', e.message);
  if (e.response) console.error('Status:', e.response.status, 'Data length:', e.response.data?.length);
});
