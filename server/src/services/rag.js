import { config } from '../config.js';
import { Drive } from '../models/Drive.js';
import { DriveChunk } from '../models/DriveChunk.js';
import { buildMessages, chunkDrive, citedTags, driveLine, mentionedDrives, topChunks } from '../utils/rag.js';
import { buildDriveViews } from './driveView.js';
import { llm } from './llm.js';

/**
 * Ask PlaceMate: Retrieval-Augmented Generation over the drive notices.
 *
 *   index:   notice -> chunks -> embeddings (Ollama) -> MongoDB (DriveChunk)
 *   ask:     question -> embedding -> top chunks by cosine similarity
 *            + a fact line per drive computed by PlaceMate (eligibility, match, deadline)
 *            -> local LLM -> answer with [D1]-style citations -> sources
 */

export async function indexDrive(drive) {
  const texts = chunkDrive(drive);
  const vectors = await llm.embedDocuments(texts);
  await DriveChunk.deleteMany({ drive: drive._id });
  await DriveChunk.insertMany(texts.map((text, i) => ({ drive: drive._id, chunkIndex: i, text, embedding: vectors[i], model: config.embedModel })));
  return texts.length;
}

/** Fire-and-forget indexing after a drive is saved: the drive is saved even if Ollama is off. */
export function indexDriveInBackground(drive) {
  indexDrive(drive).catch((err) => console.warn(`[ask] couldn't index ${drive.company}: ${err.message}`));
}

export async function removeDrive(driveId) {
  await DriveChunk.deleteMany({ drive: driveId });
}

/** Index drives that have no chunks yet (or were embedded with a different model). */
export async function indexMissing(limit = Infinity) {
  const done = await DriveChunk.distinct('drive', { model: config.embedModel });
  const todo = await Drive.find({ _id: { $nin: done } }).limit(Number.isFinite(limit) ? limit : 0).lean();
  let chunks = 0;
  for (const d of todo) chunks += await indexDrive(d);
  return { drives: todo.length, chunks };
}

export async function status() {
  try {
    const s = await llm.status();
    const indexed = (await DriveChunk.distinct('drive', { model: config.embedModel })).length;
    const drives = await Drive.countDocuments();
    return { ready: s.missing.length === 0, ...s, indexedDrives: indexed, totalDrives: drives };
  } catch (err) {
    return { ready: false, error: err.message, chatModel: config.chatModel, embedModel: config.embedModel };
  }
}

export async function ask(user, question, history = []) {
  const t0 = Date.now();
  await indexMissing(25); // catch drives added while Ollama was off

  // Facts: every drive with this student's eligibility and match, computed by our own code.
  const drives = await Drive.find({}).sort({ deadline: -1 }).limit(200).lean();
  const { views } = await buildDriveViews(user, drives);
  const now = Date.now();
  views.sort((a, b) => Number(a.isClosed) - Number(b.isClosed) || (a.deadline ? new Date(a.deadline) - now : 1e15) - (b.deadline ? new Date(b.deadline) - now : 1e15));

  // Retrieval: the notice passages closest in meaning to the question.
  const queryVector = await llm.embedQuery(question);
  const chunks = await DriveChunk.find({ model: config.embedModel }).select('drive text embedding').lean();
  let retrieved = topChunks(queryVector, chunks, 6, 2);

  // Hybrid touch: if the question names a company, make sure its notice is in the context.
  for (const v of mentionedDrives(question, views)) {
    if (!retrieved.some((c) => String(c.drive) === v.id)) {
      const first = chunks.find((c) => String(c.drive) === v.id);
      if (first) retrieved.push({ ...first, score: 1 });
    }
  }

  // Tag drives D1..Dn: retrieved/mentioned first, then open drives by deadline (max 40 lines).
  const retrievedIds = [...new Set(retrieved.map((c) => String(c.drive)))];
  const ordered = [...retrievedIds.map((id) => views.find((v) => v.id === id)).filter(Boolean),
    ...views.filter((v) => !retrievedIds.includes(v.id) && !v.isClosed)].slice(0, 40);
  const catalog = ordered.map((v, i) => ({ tag: `D${i + 1}`, view: v, line: driveLine(`D${i + 1}`, v) }));
  const tagOf = new Map(catalog.map((c) => [c.view.id, c.tag]));
  retrieved = retrieved.filter((c) => tagOf.has(String(c.drive)));
  const excerpts = retrieved.map((c) => ({ tag: tagOf.get(String(c.drive)), text: c.text }));

  const messages = buildMessages({ question, history, user, catalog, excerpts });
  const answer = await llm.chat(messages);

  const byTag = new Map(catalog.map((c) => [c.tag, c.view]));
  const sources = citedTags(answer).filter((t) => byTag.has(t)).map((tag) => {
    const v = byTag.get(tag);
    return { tag, id: v.id, company: v.company, role: v.role, eligibility: v.eligibility.status };
  });

  return {
    answer,
    sources,
    retrieved: retrieved.map((c) => ({ tag: tagOf.get(String(c.drive)), score: Math.round(c.score * 1000) / 1000 })),
    tags: Object.fromEntries(catalog.map((c) => [c.tag, { id: c.view.id, company: c.view.company }])),
    contextDrives: catalog.length,
    ms: Date.now() - t0,
  };
}
