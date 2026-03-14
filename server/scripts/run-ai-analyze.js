const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { runAiAnalysis } = require('../services/aiOrderAnalyzer');

const LIMIT = 20;

async function main() {
  console.log('Łączenie z MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Połączono.\nUruchamiam analizę AI dla', LIMIT, 'pierwszych zleceń (pending)...\n');

  try {
    const stats = await runAiAnalysis({ limit: LIMIT, batchSize: 20 });
    console.log('Wynik:');
    console.log('  – przefiltrowano:', stats.filtered);
    console.log('  – odrzucono (czerwone):', stats.rejected);
    console.log('  – kandydaci (pomarańczowe):', stats.candidates);
    console.log('  – ocenionych (score 1–10):', stats.scored);
    if (stats.errors?.length) {
      console.log('  – błędy:', stats.errors.length);
      stats.errors.forEach((e) => console.log('    ', e));
    }
  } catch (e) {
    console.error('Błąd:', e.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('\nKoniec.');
    process.exit(0);
  }
}

main();
