const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://www.biznes-polska.pl';
const SEARCH_PATH = '/wyszukiwarka/beyJjYXRlZ29yeSI6IFsxLCA3LCAyLCA4LCA0LCAzLCA5XSwgImNpdHkiOiAiIiwgInN0ZW1fdGV4dCI6IHRydWUsICJzdWJtaXNzaW9uX2RlYWRsaW5lX3Njb3BlIjogMSwgIm9mZmVyX3R5cGUiOiBbMV0sICJwcm9maWxlX2lkIjogIiIsICJkZXBvc2l0X3R5cGUiOiAxLCAidmFsdWUiOiAiIiwgIm9yZ2FuaXNlciI6ICIiLCAic3VibWlzc2lvbl9kZWFkbGluZV9kYXlzIjogIiIsICJ2YWx1ZV90eXBlIjogMSwgImxvY2F0aW9uIjogIiIsICJicmFuY2giOiBbIjE5NzIsMTk3OCIsICIxOTcyLDE5NzYiLCAiMjM2MCwxMjU0NzYxMSJdLCAiY3B2X2NvZGUiOiAiIiwgImJyYW5jaF9tYWluIjogdHJ1ZSwgImRlcG9zaXQiOiAiIn0%3D/';

/** Cookies z subskrypcji biznes-polska.pl – w kodzie */
const BIZNES_POLSKA_COOKIES = '__utmc=123207320; __utmz=123207320.1773406329.1.1.utmcsr=(direct)|utmccn=(direct)|utmcmd=(none); _gcl_au=1.1.2056477190.1773406329; CookieConsent={stamp:%27-1%27%2Cnecessary:true%2Cpreferences:true%2Cstatistics:true%2Cmarketing:true%2Cmethod:%27implied%27%2Cver:1%2Cutc:1773406331342%2Cregion:%27VN%27}; _ga=GA1.1.425820818.1773406330; timedPopupShowed=true; __utma=123207320.2108299888.1773406329.1773406329.1773455295.2; __utmt=1; __utmb=123207320.2.10.1773455295; _ga_CZRV7LJQEM=GS2.1.s1773455295$o2$g1$t1773455532$j60$l0$h0';

function getCookieHeader(cookies) {
  const s = (cookies != null && typeof cookies === 'string') ? cookies.trim() : BIZNES_POLSKA_COOKIES;
  return s || undefined;
}

function buildRequestOptions(cookies) {
  const headers = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'max-age=0',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
    'Referer': BASE_URL + '/'
  };
  const cookieHeader = getCookieHeader(cookies);
  if (cookieHeader) headers['Cookie'] = cookieHeader;
  return {
    headers,
    timeout: 30000,
    maxRedirects: 5,
    validateStatus: (status) => status === 200
  };
}

/**
 * Pobiera listę ogłoszeń z jednej strony wyszukiwarki.
 * @param {string} [cookies] - opcjonalny ciąg cookies (domyślnie z kodu)
 * @param {number} [page=1] - numer strony (s=1 to domyślna, s=2, s=3...)
 * @returns {{ id, title, detailUrl, region, addedDate, category, submissionDeadline }[]}
 */
async function fetchSearchPage(cookies, page = 1) {
  const url = page <= 1
    ? BASE_URL + SEARCH_PATH
    : BASE_URL + SEARCH_PATH + (SEARCH_PATH.includes('?') ? '&' : '?') + 's=' + page;
  const res = await axios.get(url, buildRequestOptions(cookies));
  const $ = cheerio.load(res.data);
  const rows = [];

  $('table.std tbody tr').each((_, tr) => {
    const $tr = $(tr);
    const $idCell = $tr.find('td.col-id span, td.nowrap.col-id span');
    const id = ($idCell.text().trim() || $tr.find('input[name="selected"]').attr('value') || '').trim();
    if (!id) return;

    const $link = $tr.find('td.name a.title, a.title.show-more-title');
    const href = $link.attr('href') || '';
    const title = $link.text().trim() || '';
    const fullUrl = href.startsWith('http') ? href : BASE_URL + (href.startsWith('/') ? '' : '/') + href;

    const region = $tr.find('td.col-region, td.nowrap.rwd-hidden-phone.col-region').text().trim();
    const dateStr = $tr.find('td.col-added-date span').attr('title') || $tr.find('td.col-added-date').text().trim();
    const category = $idCell.attr('title') || '';

    let submissionDeadline = null;
    const termText = $tr.find('.rwd-offer-info').text() || '';
    const termMatch = termText.match(/termin:\s*(\d{4}-\d{2}-\d{2})/);
    if (termMatch) {
      submissionDeadline = new Date(termMatch[1]);
    }

    let addedDate = null;
    if (dateStr) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) addedDate = d;
    }

    rows.push({
      id: String(id).trim(),
      title,
      detailUrl: fullUrl,
      region,
      addedDate,
      category,
      submissionDeadline
    });
  });

  return rows;
}

/**
 * Pobiera wszystkie strony wyników (paginator: następna strona).
 * @param {string} [cookies]
 * @param {number} [maxPages=50] - maks. liczba stron
 */
async function fetchAllSearchPages(cookies, maxPages = 50) {
  const all = [];
  const seenIds = new Set();

  for (let page = 1; page <= maxPages; page++) {
    const rows = await fetchSearchPage(cookies, page);
    if (!rows.length) break;
    for (const r of rows) {
      if (!seenIds.has(r.id)) {
        seenIds.add(r.id);
        all.push(r);
      }
    }
    if (rows.length < 20) break;
  }

  return all;
}

/**
 * Pobiera szczegóły pojedynczego ogłoszenia z strony szczegółowej.
 * @param {string} detailUrl - pełny URL (np. https://www.biznes-polska.pl/inwestycje/...,31542799/)
 * @param {string} [cookies]
 */
async function fetchOfferDetail(detailUrl, cookies) {
  const res = await axios.get(detailUrl, buildRequestOptions(cookies));
  const $ = cheerio.load(res.data);

  const normalizeLabel = (t) => String(t).trim().replace(/\s*:\s*$/, '');

  const raw = (label) => {
    const want = normalizeLabel(label);
    let out = '';
    $('article.offer-sheet table tr').each((_, tr) => {
      const $tr = $(tr);
      const thText = normalizeLabel($tr.find('th').text());
      if (thText !== want) return;
      const td = $tr.find('td');
      let text = td.text().trim();
      if (want === 'E-mail') {
        const href = td.find('a.email').attr('href') || td.find('a[href^="mailto:"]').attr('href');
        if (href) text = href.replace('mailto:', '').trim();
      }
      if (want === 'Strona www' && td.find('a[href^="http"]').length) {
        text = td.find('a[href^="http"]').attr('href') || text;
      }
      out = text;
      return false; // break
    });
    return out;
  };

  const idMatch = detailUrl.match(/,(\d+)\/?$/);
  const biznesPolskaId = idMatch ? idMatch[1] : '';

  const branches = [];
  $('.offer-header .popup .inner ul li a').each((_, el) => { branches.push($(el).text().trim()); });

  let originalContentUrl = '';
  $('section.associations a.full-offer.ajax').each((_, el) => {
    const href = $(el).attr('href');
    if (href) originalContentUrl = href.startsWith('http') ? href : BASE_URL + href;
  });

  const dateStr = raw('Data dodania oferty');
  let addedDate = null;
  if (dateStr) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) addedDate = d;
  }

  // Pełna treść strony w jednym tekście (wszystkie pola tabeli) – do oceny AI
  const fullTextLines = [];
  $('article.offer-sheet table tr').each((_, tr) => {
    const $tr = $(tr);
    const th = normalizeLabel($tr.find('th').text());
    let tdText = $tr.find('td').text().trim();
    const $td = $tr.find('td');
    const mailLink = $td.find('a.email').attr('href') || $td.find('a[href^="mailto:"]').attr('href');
    if (mailLink) tdText = mailLink.replace('mailto:', '').trim();
    const wwwLink = $td.find('a[href^="http"]').attr('href');
    if (wwwLink) tdText = wwwLink;
    if (th) fullTextLines.push(th + ': ' + tdText);
  });
  const offerStatus = $('.offer-status').text().trim();
  if (offerStatus) fullTextLines.push('Status: ' + offerStatus);
  if (branches.length) fullTextLines.push('Branże: ' + branches.join(', '));
  $('section.associations ul li a').each((_, el) => {
    const $a = $(el);
    const href = $a.attr('href');
    const text = $a.text().trim();
    if (href) fullTextLines.push('Link: ' + (href.startsWith('http') ? href : BASE_URL + href) + (text ? ' | ' + text : ''));
  });
  let detailFullText = fullTextLines.join('\n');
  if (!detailFullText.trim()) {
    const fallback = $('article.offer-sheet').text() || $('#main').text() || $('body').text();
    detailFullText = (fallback || '').trim().replace(/\s+/g, ' ');
  }

  // Surowy HTML całej sekcji ogłoszenia + powiązania – nic nie pominięte
  let detailRawHtml = ($('article.offer-sheet').html() || '').trim();
  const $assoc = $('section.associations');
  if ($assoc.length) detailRawHtml += '\n\n' + ($assoc.parent().html() || $assoc.html() || '').trim();

  return {
    biznesPolskaId,
    category: raw('Kategoria ogłoszenia'),
    addedDate,
    title: raw('Przedmiot ogłoszenia').replace(/^\s*|\s*$/g, ''),
    detailUrl,
    region: raw('Województwo / powiat').split(',')[0].trim(),
    investor: raw('Inwestor'),
    address: raw('Adres'),
    voivodeshipDistrict: raw('Województwo / powiat'),
    country: raw('Państwo'),
    nip: raw('NIP'),
    phoneFax: raw('Telefon / fax'),
    email: raw('E-mail'),
    website: raw('Strona www'),
    description: raw('Opis'),
    placeAndTerm: raw('Miejsce i termin realizacji'),
    remarks: raw('Uwagi'),
    contact: raw('Kontakt'),
    source: raw('Źródło'),
    branches,
    originalContentUrl: originalContentUrl || undefined,
    offerStatus: offerStatus || undefined,
    detailFullText,
    detailRawHtml
  };
}

/**
 * Uruchamia pełną synchronizację: pobiera listę z wyszukiwarki, dla każdego ID którego jeszcze nie ma w bazie
 * pobiera szczegóły i zapisuje. Nie nadpisuje istniejących (ID się nie powtarza).
 * @param {string} [cookies] - opcjonalny ciąg cookies (domyślnie z kodu)
 * @param {object} [options] - { maxListPages, skipDetails }
 * @returns {{ added: number, updated: number, errors: string[] }}
 */
async function runSync(cookies, options = {}) {
  const PublicOrder = require('../models/PublicOrder');
  const { maxListPages = 50, skipDetails = false } = options;
  const result = { added: 0, updated: 0, errors: [], addedIds: [] };

  let list;
  try {
    list = await fetchAllSearchPages(cookies, maxListPages);
  } catch (e) {
    result.errors.push('Lista wyszukiwania: ' + (e.message || String(e)));
    return result;
  }

  const existingIds = new Set(
    (await PublicOrder.find({}).select('biznesPolskaId').lean()).map((d) => d.biznesPolskaId)
  );

  for (const row of list) {
    if (existingIds.has(row.id)) continue;

    if (skipDetails) {
      try {
        const doc = await PublicOrder.create({
          biznesPolskaId: row.id,
          category: row.category,
          addedDate: row.addedDate,
          title: row.title,
          detailUrl: row.detailUrl,
          region: row.region,
          submissionDeadline: row.submissionDeadline
        });
        result.added++;
        result.addedIds.push(doc._id);
        existingIds.add(row.id);
      } catch (e) {
        if (e.code === 11000) existingIds.add(row.id);
        else result.errors.push(`ID ${row.id}: ${e.message}`);
      }
      continue;
    }

    let detail;
    try {
      detail = await fetchOfferDetail(row.detailUrl, cookies);
    } catch (e) {
      result.errors.push(`Szczegóły ${row.id}: ${e.message}`);
      continue;
    }

    try {
      const doc = await PublicOrder.create({
        biznesPolskaId: detail.biznesPolskaId || row.id,
        category: detail.category || row.category,
        addedDate: detail.addedDate || row.addedDate,
        title: detail.title || row.title,
        detailUrl: detail.detailUrl || row.detailUrl,
        region: detail.region || row.region,
        submissionDeadline: row.submissionDeadline,
        investor: detail.investor,
        address: detail.address,
        voivodeshipDistrict: detail.voivodeshipDistrict,
        country: detail.country,
        nip: detail.nip,
        phoneFax: detail.phoneFax,
        email: detail.email,
        website: detail.website,
        description: detail.description,
        placeAndTerm: detail.placeAndTerm,
        remarks: detail.remarks,
        contact: detail.contact,
        source: detail.source,
        branches: detail.branches,
        originalContentUrl: detail.originalContentUrl,
        offerStatus: detail.offerStatus,
        detailFullText: detail.detailFullText || '',
        detailRawHtml: detail.detailRawHtml || ''
      });
      result.added++;
      result.addedIds.push(doc._id);
      existingIds.add(row.id);
    } catch (e) {
      if (e.code === 11000) existingIds.add(row.id);
      else result.errors.push(`Zapis ${row.id}: ${e.message}`);
    }
  }

  return result;
}

module.exports = {
  fetchSearchPage,
  fetchAllSearchPages,
  fetchOfferDetail,
  runSync,
  SEARCH_URL: BASE_URL + SEARCH_PATH,
  BIZNES_POLSKA_COOKIES
};
