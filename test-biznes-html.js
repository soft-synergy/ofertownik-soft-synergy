const { fetchOfferDetail } = require('./server/services/biznesPolskaScraper');

const TEST_URL = 'https://www.biznes-polska.pl/inwestycje/inwestycja-planowana-opracowanie-i-wdrozenie-platformy-sieciujacej-zwiazki-zit,31430211/';

(async () => {
  try {
    const detail = await fetchOfferDetail(TEST_URL);
    // Print just the detailRawHtml to see the table structure
    console.log('=== detailRawHtml ===');
    console.log(detail.detailRawHtml);
    console.log('\n=== All table rows (th -> td) ===');
    const cheerio = require('cheerio');
    const $ = cheerio.load(detail.rawPageHtml);
    $('article.offer-sheet table tr').each((_, tr) => {
      const th = $(tr).find('th').text().trim();
      const td = $(tr).find('td').text().trim().substring(0, 120);
      console.log(`[${th}] => [${td}]`);
    });
    console.log('\n=== Branches popup ===');
    $('.offer-header .popup .inner ul li a').each((_, el) => {
      console.log('Branch:', $(el).text().trim());
    });
    console.log('\n=== All th elements on page ===');
    $('th').each((_, el) => {
      console.log('TH:', $(el).text().trim());
    });
    console.log('\n=== Offer header ===');
    console.log($('.offer-header').text().trim().substring(0, 500));
    console.log('\n=== Section associations ===');
    console.log($('section.associations').html()?.substring(0, 1000) || 'NONE');
  } catch (err) {
    console.error('ERROR:', err.message);
  }
})();
