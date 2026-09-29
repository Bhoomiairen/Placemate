/**
 * Pure helpers for Ask PlaceMate (no database, no network) so they are easy to test.
 *
 * The design in one line: CODE decides the facts (eligibility, match %, deadlines),
 * the LLM only turns those facts and the retrieved notice text into a readable answer.
 */

const CHUNK_CHARS = 800;

/** Split a notice into chunks of ~800 characters on paragraph/sentence boundaries. */
export function chunkText(text, maxChars = CHUNK_CHARS) {
  const paragraphs = String(text || '')
    .replace(/\r/g, '')
    .split(/\n\s*\n/)
    .map((p) => p.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean);

  const pieces = [];
  for (const p of paragraphs) {
    if (p.length <= maxChars) {
      pieces.push(p);
      continue;
    }
    // very long paragraph: cut at sentence ends (or line breaks), then hard-cut if still too long
    let buf = '';
    for (const sentence of p.split(/(?<=[.!?])\s+|\n/)) {
      if ((buf + ' ' + sentence).trim().length > maxChars && buf) {
        pieces.push(buf.trim());
        buf = '';
      }
      buf = `${buf} ${sentence}`;
      while (buf.length > maxChars) {
        pieces.push(buf.slice(0, maxChars).trim());
        buf = buf.slice(maxChars);
      }
    }
    if (buf.trim()) pieces.push(buf.trim());
  }

  const chunks = [];
  let current = '';
  for (const piece of pieces) {
    if (current && current.length + piece.length + 2 > maxChars) {
      chunks.push(current);
      current = '';
    }
    current = current ? `${current}\n\n${piece}` : piece;
  }
  if (current) chunks.push(current);
  return chunks;
}

/** Every chunk starts with the company and role so it still makes sense on its own. */
export function chunkDrive(drive) {
  const head = [drive.company, drive.role].filter(Boolean).join(' – ');
  return chunkText(drive.rawText).map((c) => `${head}\n${c}`);
}

export function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

/**
 * Pick the most similar chunks, at most `perDrive` from any one drive so a single
 * long notice can't crowd out the others.
 */
export function topChunks(queryVector, chunks, k = 6, perDrive = 2) {
  const scored = chunks
    .map((c) => ({ ...c, score: cosine(queryVector, c.embedding) }))
    .sort((a, b) => b.score - a.score);
  const out = [];
  const perDriveCount = new Map();
  for (const c of scored) {
    const key = String(c.drive);
    if ((perDriveCount.get(key) || 0) >= perDrive) continue;
    perDriveCount.set(key, (perDriveCount.get(key) || 0) + 1);
    out.push(c);
    if (out.length >= k) break;
  }
  return out;
}

/** Drives whose company name appears in the question (e.g. "what's the bond at Orbit?"). */
export function mentionedDrives(question, views) {
  const q = question.toLowerCase();
  return views.filter((v) => {
    const name = v.company.toLowerCase().replace(/\b(pvt|private|ltd|limited|inc|llp)\b\.?/g, '').trim();
    const firstWord = name.split(/\s+/)[0];
    return (name && q.includes(name)) || (firstWord.length >= 4 && new RegExp(`\\b${firstWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(q));
  });
}

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : 'not stated';

function ctc(v) {
  if (v.ctcLpa == null) return v.stipendPerMonth ? `stipend ₹${v.stipendPerMonth}/month` : 'CTC not stated';
  return `CTC ${v.ctcMaxLpa ? `${v.ctcLpa}-${v.ctcMaxLpa}` : v.ctcLpa} LPA`;
}

function eligibilityText(e) {
  if (e.status === 'eligible') return 'ELIGIBLE';
  if (e.status === 'not_eligible') return `NOT ELIGIBLE (${e.reasons.join('; ')})`;
  return `UNKNOWN - profile missing: ${e.missing.join(', ')}`;
}

/** One line of facts per drive, computed by PlaceMate's own code (not by the LLM). */
export function driveLine(tag, v) {
  const parts = [
    `[${tag}] ${v.company}${v.role ? ` – ${v.role}` : ''}`,
    ctc(v),
    v.isClosed ? `CLOSED (deadline was ${fmtDate(v.deadline)})` : `apply by ${fmtDate(v.deadline)}`,
    v.location ? `location ${v.location}` : null,
    v.bond ? `bond ${v.bond}` : null,
    `eligibility: ${eligibilityText(v.eligibility)}`,
    v.match?.score != null ? `resume match ${v.match.score}%${v.match.missingSkills.length ? ` (missing: ${v.match.missingSkills.join(', ')})` : ''}` : null,
    v.skills?.length ? `skills asked: ${v.skills.join(', ')}` : null,
    v.application ? `student's status: ${v.application.status}` : null,
  ];
  return parts.filter(Boolean).join(' | ');
}

export function profileLine(user) {
  const p = user.profile || {};
  const bits = [
    p.branch ? `branch ${p.branch}` : 'branch not set',
    p.cgpa != null ? `CGPA ${p.cgpa}/${p.cgpaScale || 10}` : 'CGPA not set',
    p.tenthPercent != null ? `10th ${p.tenthPercent}%` : null,
    p.twelfthPercent != null ? `12th ${p.twelfthPercent}%` : null,
    p.diplomaPercent != null ? `diploma ${p.diplomaPercent}%` : null,
    p.graduationYear ? `batch ${p.graduationYear}` : null,
    `active backlogs ${p.activeBacklogs ?? 0}`,
  ];
  return bits.filter(Boolean).join(', ');
}

export const SYSTEM_PROMPT = `You are "Ask PlaceMate", an assistant that answers a student's questions about campus placement drives.

Use ONLY the information in the DRIVES list and NOTICE EXCERPTS. Rules:
1. The eligibility and resume-match facts in the DRIVES list were calculated by PlaceMate from the student's profile. Trust them and repeat them; never work out eligibility yourself.
2. Every time you mention a drive, cite its tag, for example [D2].
3. If the information needed is not provided, say you don't know and suggest checking the notice or asking the placement cell. Never invent companies, dates, salaries, criteria or links.
4. Be brief and practical: a short answer, then bullet points if listing drives. Use Indian number and date formats.`;

/**
 * Build the chat messages. Context goes in the final user message, so earlier turns
 * stay short and the model always sees the freshest facts.
 */
export function buildMessages({ question, history = [], user, catalog, excerpts, today = new Date() }) {
  const context = [
    `TODAY: ${fmtDate(today)}`,
    `STUDENT PROFILE: ${profileLine(user)}`,
    user.resume?.skills?.length ? `RESUME SKILLS: ${user.resume.skills.slice(0, 40).join(', ')}` : 'RESUME: not uploaded (no match scores).',
    '',
    `DRIVES (${catalog.length}, facts computed by PlaceMate):`,
    ...catalog.map((c) => c.line),
    '',
    'NOTICE EXCERPTS (most relevant to the question):',
    ...(excerpts.length ? excerpts.map((e) => `[${e.tag}] """${e.text}"""`) : ['(none)']),
  ].join('\n');

  const turns = history.slice(-6).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 1500) }));
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    ...turns,
    { role: 'user', content: `${context}\n\nQUESTION: ${question}` },
  ];
}

/** Tags cited in the answer, in order of first appearance, e.g. ["D2", "D5"]. */
export function citedTags(answer) {
  const seen = [];
  for (const m of String(answer).matchAll(/\[D(\d+)\]/g)) {
    const tag = `D${m[1]}`;
    if (!seen.includes(tag)) seen.push(tag);
  }
  return seen;
}
