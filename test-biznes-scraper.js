const axios = require('axios');
const cheerio = require('cheerio');

const TEST_URL = 'https://www.biznes-polska.pl/przetargi/kompleksowa-realizacja-kampanii-promujacej-mape-potencjalu-oze-wraz-z,31534549/';

const COOKIES = 'source_subscription=adw-konwersja; _gcl_aw=GCL.1773407841.CjwKCAjw687NBhB4EiwAQ645dq8ocN8DBp69wVFcUr8q0EsOyI60bvOu60gRaute7rbO8hVcgf8lXBoCHQ4QAvD_BwE; _gcl_gs=2.1.k1$i1773407808$u123207320; __utmc=123207320; __utmz=123207320.1773407841.1.1.utmgclid=CjwKCAjw687NBhB4EiwAQ645dq8ocN8DBp69wVFcUr8q0EsOyI60bvOu60gRaute7rbO8hVcgf8lXBoCHQ4QAvD_BwE|utmccn=(not%20set)|utmcmd=(not%20set)|utmctr=(not%20provided); _gac_UA-12962180-1=1.1773407841.CjwKCAjw687NBhB4EiwAQ645dq8ocN8DBp69wVFcUr8q0EsOyI60bvOu60gRaute7rbO8hVcgf8lXBoCHQ4QAvD_BwE; CookieConsent={stamp:%27-1%27%2Cnecessary:true%2Cpreferences:true%2Cstatistics:true%2Cmarketing:true%2Cmethod:%27implied%27%2Cver:1%2Cutc:1773407841657%2Cregion:%27VN%27}; _ga=GA1.1.265139833.1773407841; _gcl_au=1.1.2041128461.1773407841.2046683477.1773407924.1773407939; przetargi=39c6aadc41621bd47a4bbd93e557f2133229d6e0d76554301b60fda41edee90755fd1a5f; __utma=123207320.1402870305.1773407841.1773461408.1773468740.4; _ga_CZRV7LJQEM=GS2.1.s1773468124$o5$g1$t1773471814$j60$l0$h0';

(async () => {
  console.log('Testing with fresh cookies on:', TEST_URL);
  console.log('---');
  try {
    const res = await axios.get(TEST_URL, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'max-age=0',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
        'Cookie': COOKIES,
        'sec-ch-ua': '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'cross-site',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
        'Referer': 'https://www.biznes-polska.pl/'
      },
      timeout: 30000,
      maxRedirects: 5
    });

    console.log('Status:', res.status);
    console.log('Content length:', res.data.length);

    const $ = cheerio.load(res.data);
    
    console.log('\n=== All table rows (th -> td) ===');
    $('article.offer-sheet table tr').each((_, tr) => {
      const th = $(tr).find('th').text().trim();
      const td = $(tr).find('td').text().trim().substring(0, 200);
      console.log(`[${th}] => [${td}]`);
    });

    console.log('\n=== Now testing via fetchOfferDetail with these cookies ===');
    const { fetchOfferDetail } = require('./server/services/biznesPolskaScraper');
    const detail = await fetchOfferDetail(TEST_URL, COOKIES);
    const { rawPageHtml, detailRawHtml, ...printable } = detail;
    console.log(JSON.stringify(printable, null, 2));
    console.log('---');
    console.log('rawPageHtml length:', rawPageHtml?.length || 0);
    console.log('detailRawHtml length:', detailRawHtml?.length || 0);
    console.log('\ndetailFullText:');
    console.log(detail.detailFullText);
  } catch (err) {
    console.error('ERROR:', err.message);
    if (err.response) {
      console.error('Status:', err.response.status);
    }
  }
})();
