const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const PublicOrder = require('../models/PublicOrder');

async function main() {
  console.log('Łączenie z MongoDB...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Połączono.\nUsuwam wszystkie zlecenia publiczne...');

  try {
    const result = await PublicOrder.deleteMany({});
    console.log('Usunięto:', result.deletedCount, 'zleceń.');
  } catch (e) {
    console.error('Błąd:', e.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('Koniec.');
    process.exit(0);
  }
}

main();
