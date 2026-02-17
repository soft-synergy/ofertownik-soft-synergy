/**
 * One-time migration: drop old unique index on tasks (source.kind, source.refId)
 * that caused E11000 when many tasks have source null.
 * Run: node server/scripts/drop-tasks-source-unique-index.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const Task = require('../models/Task');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const indexes = await Task.collection.indexes();
    const oldIdx = indexes.find((i) => i.key && i.key['source.kind'] !== undefined && i.unique === true);
    if (oldIdx && oldIdx.name) {
      await Task.collection.dropIndex(oldIdx.name);
      console.log('Dropped index:', oldIdx.name);
    } else {
      console.log('No unique source index found.');
    }
  } catch (e) {
    if (e.code === 27 || e.codeName === 'IndexNotFound') console.log('Index not found (OK).');
    else {
      console.error(e);
      process.exit(1);
    }
  } finally {
    await mongoose.disconnect();
  }
}

run();
