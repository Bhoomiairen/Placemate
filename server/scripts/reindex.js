/**
 * Rebuild Ask PlaceMate's search index: chunk every drive notice and embed it with Ollama.
 *   npm run reindex            index drives that aren't indexed yet
 *   npm run reindex -- --all   rebuild everything (e.g. after changing the embedding model)
 */
import mongoose from 'mongoose';
import { config } from '../src/config.js';
import { Drive } from '../src/models/Drive.js';
import { DriveChunk } from '../src/models/DriveChunk.js';
import { indexMissing, status } from '../src/services/rag.js';

await mongoose.connect(config.mongoUri);
const s = await status();
if (s.error || s.missing?.includes(config.embedModel)) {
  console.error(s.error || `Embedding model missing. Run: ollama pull ${config.embedModel}`);
  process.exit(1);
}
if (process.argv.includes('--all')) await DriveChunk.deleteMany({});
const t0 = Date.now();
const r = await indexMissing();
console.log(`Indexed ${r.drives} drives into ${r.chunks} chunks with ${config.embedModel} in ${((Date.now() - t0) / 1000).toFixed(1)}s.`);
console.log(`${await DriveChunk.distinct('drive').then((d) => d.length)} of ${await Drive.countDocuments()} drives are searchable.`);
await mongoose.disconnect();
