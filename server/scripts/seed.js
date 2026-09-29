/**
 * Demo data: a demo student + the sample drive notices from nlp-service/eval/notices.
 * Each notice goes through the real NLP extraction, exactly like a user adding it.
 *
 *   npm run seed            (NLP service and MongoDB must be running)
 *
 * Deadlines are shifted so the earliest one is 2 days from now - otherwise the
 * sample drives would show as closed once their real dates pass.
 */
import bcrypt from 'bcryptjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { config } from '../src/config.js';
import { Drive } from '../src/models/Drive.js';
import { User } from '../src/models/User.js';
import { nlp } from '../src/services/nlp.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const noticesDir = process.env.SEED_NOTICES_DIR || path.resolve(here, '../../nlp-service/eval/notices');
const DEMO = { name: 'Demo Student', email: 'demo@placemate.dev', password: 'demo12345' };

await mongoose.connect(config.mongoUri);

let user = await User.findOne({ email: DEMO.email });
if (!user) {
  user = await User.create({
    name: DEMO.name,
    email: DEMO.email,
    passwordHash: await bcrypt.hash(DEMO.password, 10),
    profile: { branch: 'CSE', cgpa: 7.8, cgpaScale: 10, tenthPercent: 88, twelfthPercent: 72, activeBacklogs: 0, backlogHistory: false, graduationYear: 2027, gapYears: 0 },
  });
  console.log(`Created demo user ${DEMO.email} / ${DEMO.password}`);
}

const files = (await fs.readdir(noticesDir)).filter((f) => f.endsWith('.txt')).sort();
const drafts = [];
for (const file of files) {
  const text = await fs.readFile(path.join(noticesDir, file), 'utf8');
  drafts.push(await nlp.parseNoticeText(text));
}

const deadlines = drafts.map((d) => d.deadline && new Date(d.deadline).getTime()).filter(Boolean);
const shift = deadlines.length ? Date.now() + 2 * 86400000 - Math.min(...deadlines) : 0;
const shifted = (iso) => (iso ? new Date(new Date(iso).getTime() + shift) : null);

let created = 0;
for (const d of drafts) {
  if (!d.company || (await Drive.exists({ company: d.company }))) continue;
  await Drive.create({
    company: d.company, role: d.role, location: d.location, ctcLpa: d.ctcLpa, ctcMaxLpa: d.ctcMaxLpa,
    stipendPerMonth: d.stipendPerMonth, bond: d.bond, deadline: shifted(d.deadline), driveDate: shifted(d.driveDate),
    criteria: d.criteria, skills: d.skills, rawText: d.rawText, evidence: d.evidence, createdBy: user._id,
  });
  created += 1;
}
console.log(`Added ${created} sample drives (${files.length - created} already existed).`);

// Make the drives searchable by Ask PlaceMate (needs Ollama running; safe to skip)
try {
  const { indexMissing } = await import('../src/services/rag.js');
  const r = await indexMissing();
  console.log(`Ask PlaceMate: indexed ${r.drives} drives (${r.chunks} chunks).`);
} catch (err) {
  console.log(`Ask PlaceMate: skipped indexing (${err.message}). Run \`npm run reindex\` once Ollama is running.`);
}
await mongoose.disconnect();
