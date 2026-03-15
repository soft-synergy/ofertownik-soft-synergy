const { fetchSearchPage, fetchOfferDetail, BIZNES_POLSKA_COOKIES, SEARCH_URL } = require('./server/services/biznesPolskaScraper');

(async () => {
  console.log('SEARCH_URL:', SEARCH_URL);
  console.log('Cookies length:', BIZNES_POLSKA_COOKIES.length);
  console.log('---');

  const rows = await fetchSearchPage(undefined, 7);
  console.log('Strona 7 – liczba wierszy:', rows.length);
  if (rows.length > 0) {
    console.log('Pierwszy wiersz:', JSON.stringify(rows[0], null, 2));
    const detailUrl = rows[0].detailUrl;
    console.log('\nPobieranie szczegółów:', detailUrl);
    const detail = await fetchOfferDetail(detailUrl, undefined);
    console.log('Szczegóły – title:', detail.title?.slice(0, 60));
    console.log('Szczegóły – description length:', detail.description?.length ?? 0);
    console.log('Szczegóły – requirements length:', detail.requirements?.length ?? 0);
  }
})().catch((e) => {
  console.error('Error:', e.message);
});
