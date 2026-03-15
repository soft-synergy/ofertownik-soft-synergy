const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://www.biznes-polska.pl';
/** Główny URL wyszukiwarki – lista ogłoszeń (strona 1 bez ?s=, dalsze jako ?s=2, ?s=3...) */
const SEARCH_PATH = '/wyszukiwarka/k27844422/';

/** Cookies z subskrypcji biznes-polska.pl – na sztywno (wymagane do pobrania opisu i wymagań) */
const BIZNES_POLSKA_COOKIES = 'source_subscription=adw-konwersja; _gcl_aw=GCL.1773407841.CjwKCAjw687NBhB4EiwAQ645dq8ocN8DBp69wVFcUr8q0EsOyI60bvOu60gRaute7rbO8hVcgf8lXBoCHQ4QAvD_BwE; _gcl_gs=2.1.k1$i1773407808$u123207320; __utmc=123207320; __utmz=123207320.1773407841.1.1.utmgclid=CjwKCAjw687NBhB4EiwAQ645dq8ocN8DBp69wVFcUr8q0EsOyI60bvOu60gRaute7rbO8hVcgf8lXBoCHQ4QAvD_BwE|utmccn=(not%20set)|utmcmd=(not%20set)|utmctr=(not%20provided); _gac_UA-12962180-1=1.1773407841.CjwKCAjw687NBhB4EiwAQ645dq8ocN8DBp69wVFcUr8q0EsOyI60bvOu60gRaute7rbO8hVcgf8lXBoCHQ4QAvD_BwE; CookieConsent={stamp:%27-1%27%2Cnecessary:true%2Cpreferences:true%2Cstatistics:true%2Cmarketing:true%2Cmethod:%27implied%27%2Cver:1%2Cutc:1773407841657%2Cregion:%27VN%27}; _ga=GA1.1.265139833.1773407841; _gcl_au=1.1.2041128461.1773407841.2046683477.1773407924.1773407939; przetargi=39c6aadc41621bd47a4bbd93e557f2133229d6e0d76554301b60fda41edee90755fd1a5f; __utma=123207320.1402870305.1773407841.1773461408.1773468740.4; _ga_CZRV7LJQEM=GS2.1.s1773468124$o5$g1$t1773471814$j60$l0$h0';

function getCookieHeader(cookies) {
  const s = (cookies != null && typeof cookies === 'string') ? cookies.trim() : BIZNES_POLSKA_COOKIES;
  return s || undefined;
}

/** Te same nagłówki (w tym Cookie) dla wyszukiwarki i stron szczegółów – wymagane, żeby lista i szczegóły działały z subskrypcją. */
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
  const pathWithPage = page <= 1 ? SEARCH_PATH : SEARCH_PATH + '?s=' + page;
  const url = BASE_URL + pathWithPage;
  const res = await axios.get(url, buildRequestOptions(cookies));
  const $ = cheerio.load(res.data);
  const rows = [];

  $('table.std tbody tr').each((_, tr) => {
    const $tr = $(tr);
    const $idCell = $tr.find('td.col-id, td.nowrap.col-id');
    const id = ($idCell.text().trim() || $idCell.find('span').text().trim() || $tr.find('input[name="selected"]').attr('value') || '').trim();
    if (!id) return;

    const $link = $tr.find('td.name a.title, td.name a.show-more-title, td.name a');
    const href = $link.attr('href') || '';
    const title = $link.text().trim() || '';
    const fullUrl = href.startsWith('http') ? href : BASE_URL + (href.startsWith('/') ? '' : '/') + href;

    const region = $tr.find('td.col-region, td.nowrap.rwd-hidden-phone.col-region').text().trim();
    const dateStr = $tr.find('td.col-added-date span').attr('title') || $tr.find('td.col-added-date').text().trim();
    const category = $idCell.attr('title') || '';

    let submissionDeadline = null;
    const deadlineCell = $tr.find('td.col-submission-deadline').text().trim();
    const deadlineMatch = deadlineCell.match(/(\d{4}-\d{2}-\d{2})/);
    if (deadlineMatch) {
      submissionDeadline = new Date(deadlineMatch[1]);
    } else {
      const termText = $tr.find('.rwd-offer-info').text() || '';
      const termMatch = termText.match(/termin:\s*(\d{4}-\d{2}-\d{2})/);
      if (termMatch) submissionDeadline = new Date(termMatch[1]);
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

  /** Pierwsza niepusta wartość dla jednej z etykiet (np. Organizator lub Inwestor). */
  const rawOneOf = (...labels) => {
    for (const label of labels) {
      const v = raw(label);
      if (v && v.trim()) return v.trim();
    }
    return '';
  };

  const idMatch = detailUrl.match(/,(\d+)\/?$/);
  const biznesPolskaId = idMatch ? idMatch[1] : '';

  const branches = [];
  $('.offer-header .popup .inner ul li a').each((_, el) => { branches.push($(el).text().trim()); });
  if (!branches.length) {
    $('article.offer-sheet table tr').each((_, tr) => {
      const thText = normalizeLabel($(tr).find('th').text());
      if (thText === 'Branże') {
        $(tr).find('td ul li').each((_, li) => {
          const t = $(li).text().trim();
          if (t) branches.push(t);
        });
      }
    });
  }

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
  // Zawsze dołącz pełny Opis i Wymagania na końcu – kluczowe dla AI
  const opisFull = raw('Opis');
  const wymaganiaFull = raw('Wymagania');
  if (opisFull && opisFull.trim()) {
    detailFullText += '\n\n--- OPIS (pełny) ---\n' + opisFull.trim();
  }
  if (wymaganiaFull && wymaganiaFull.trim()) {
    detailFullText += '\n\n--- WYMAGANIA (pełne) ---\n' + wymaganiaFull.trim();
  }

  // Surowy HTML całej sekcji ogłoszenia + powiązania – nic nie pominięte
  let detailRawHtml = ($('article.offer-sheet').html() || '').trim();
  const $assoc = $('section.associations');
  if ($assoc.length) detailRawHtml += '\n\n' + ($assoc.parent().html() || $assoc.html() || '').trim();

  /** Pełna odpowiedź HTTP – cały HTML strony (do przekazania do AI) */
  const rawPageHtml = typeof res.data === 'string'
    ? res.data
    : (Buffer.isBuffer(res.data) ? res.data.toString('utf8') : '');

  return {
    rawPageHtml,
    biznesPolskaId,
    category: raw('Kategoria ogłoszenia'),
    addedDate,
    title: raw('Przedmiot ogłoszenia').replace(/^\s*|\s*$/g, ''),
    detailUrl,
    region: (rawOneOf('Województwo / powiat', 'Województwo')).split(',')[0].trim(),
    investor: rawOneOf('Organizator', 'Inwestor'),
    address: raw('Adres'),
    voivodeshipDistrict: raw('Województwo / powiat'),
    country: raw('Państwo'),
    nip: raw('NIP'),
    phoneFax: raw('Telefon / fax'),
    email: raw('E-mail'),
    website: raw('Strona www'),
    description: raw('Opis'),
    requirements: raw('Wymagania'),
    submissionPlaceAndDeadline: rawOneOf('Miejsce i termin składania ofert', 'Termin składania'),
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
        requirements: detail.requirements,
        submissionPlaceAndDeadline: detail.submissionPlaceAndDeadline,
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
