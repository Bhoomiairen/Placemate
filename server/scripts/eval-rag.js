/**
 * Measure Ask PlaceMate on questions with known answers (eval/rag-questions.json).
 *
 *   npm run eval:rag                     retrieval + full answers (needs both Ollama models)
 *   npm run eval:rag -- --retrieval-only only checks the search step (fast)
 *
 * retrieval hit@6: the right drive's notice was among the passages given to the model
 * cited correctly:  the model's answer cited the right drive
 * Run `npm run seed` first; the questions are about the sample drives.
 */
import fs from 'node:fs/promises';
import mongoose from 'mongoose';
import { config } from '../src/config.js';
import { User } from '../src/models/User.js';
import { ask, indexMissing } from '../src/services/rag.js';
import { llm } from '../src/services/llm.js';

const retrievalOnly = process.argv.includes('--retrieval-only');
const { questions } = JSON.parse(await fs.readFile(new URL('../eval/rag-questions.json', import.meta.url), 'utf8'));

await mongoose.connect(config.mongoUri);
const user = await User.findOne({ email: 'demo@placemate.dev' });
if (!user) {
  console.error('Run `npm run seed` first (the questions are about the sample drives).');
  process.exit(1);
}
await indexMissing();
if (retrievalOnly) llm.chat = async () => ''; // skip generation

let retrievalHits = 0;
let citedHits = 0;
const rows = [];
for (const { q, expect } of questions) {
  const r = await ask(user, q, []);
  const companiesRetrieved = r.retrieved.map((x) => r.tags[x.tag]?.company);
  const same = (company, expected) => (company || '').toLowerCase().includes(expected.toLowerCase());
  const retrievedOk = expect.some((c) => companiesRetrieved.some((got) => same(got, c)));
  const citedOk = expect.some((c) => r.sources.some((src) => same(src.company, c)));
  retrievalHits += retrievedOk;
  citedHits += citedOk;
  rows.push({ question: q.slice(0, 60), retrieved: retrievedOk ? 'yes' : 'NO', ...(retrievalOnly ? {} : { cited: citedOk ? 'yes' : 'NO', seconds: (r.ms / 1000).toFixed(1) }) });
}
console.table(rows);
const n = questions.length;
console.log(`\nRetrieval hit@6: ${retrievalHits}/${n} (${Math.round((100 * retrievalHits) / n)}%)`);
if (!retrievalOnly) console.log(`Answer cited the right drive: ${citedHits}/${n} (${Math.round((100 * citedHits) / n)}%)`);
console.log(`Models: embed=${config.embedModel}${retrievalOnly ? '' : `, chat=${config.chatModel}`}`);
await mongoose.disconnect();
