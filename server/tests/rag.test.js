import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildMessages, chunkDrive, chunkText, citedTags, cosine, driveLine, mentionedDrives, topChunks } from '../src/utils/rag.js';

test('chunkText keeps short notices whole and splits long ones under the limit', () => {
  assert.deepEqual(chunkText('Role: SDE\n\nCTC: 8 LPA'), ['Role: SDE\n\nCTC: 8 LPA']);
  const long = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} about eligibility and skills.`).join(' ');
  const chunks = chunkText(`${long}\n\n${long}`, 300);
  assert.ok(chunks.length > 4);
  assert.ok(chunks.every((c) => c.length <= 300));
  assert.equal(chunks.join(' ').replace(/\s+/g, ' ').includes('Sentence number 39'), true);
});

test('each chunk carries the company and role', () => {
  const [first] = chunkDrive({ company: 'Acme', role: 'SDE', rawText: 'CGPA 7+' });
  assert.equal(first, 'Acme – SDE\nCGPA 7+');
});

test('cosine similarity', () => {
  assert.equal(cosine([1, 0], [1, 0]), 1);
  assert.equal(cosine([1, 0], [0, 1]), 0);
  assert.equal(cosine([0, 0], [1, 1]), 0);
});

test('topChunks ranks by similarity and caps chunks per drive', () => {
  const chunks = [
    { drive: 'a', text: 'a1', embedding: [1, 0] },
    { drive: 'a', text: 'a2', embedding: [0.99, 0.01] },
    { drive: 'a', text: 'a3', embedding: [0.98, 0.02] },
    { drive: 'b', text: 'b1', embedding: [0.7, 0.7] },
  ];
  const top = topChunks([1, 0], chunks, 3, 2);
  assert.deepEqual(top.map((c) => c.text), ['a1', 'a2', 'b1']);
});

test('company names in the question are detected', () => {
  const views = [{ id: '1', company: 'Orbit Systems Pvt. Ltd' }, { id: '2', company: 'Acme' }];
  assert.deepEqual(mentionedDrives('What is the bond at orbit?', views).map((v) => v.id), ['1']);
  assert.deepEqual(mentionedDrives('anything open?', views), []);
});

test('drive facts come from PlaceMate, including the reason for ineligibility', () => {
  const line = driveLine('D3', {
    company: 'Vertex', role: 'ML Engineer', ctcLpa: 18, deadline: '2026-10-06T00:00:00Z', isClosed: false, skills: ['Python'],
    eligibility: { status: 'not_eligible', reasons: ['CGPA: need 8 / 10, you have 7.8 / 10'], missing: [] },
    match: { score: 62, missingSkills: ['PyTorch'] },
  });
  assert.match(line, /^\[D3\] Vertex – ML Engineer \| CTC 18 LPA \| apply by 6 Oct 2026/);
  assert.match(line, /NOT ELIGIBLE \(CGPA: need 8 \/ 10, you have 7.8 \/ 10\)/);
  assert.match(line, /resume match 62% \(missing: PyTorch\)/);
});

test('prompt puts context and question in the last message and keeps history short', () => {
  const history = Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `turn ${i}` }));
  const msgs = buildMessages({
    question: 'Which drives need Java?', history,
    user: { profile: { branch: 'CSE', cgpa: 3.3, cgpaScale: 4 }, resume: { skills: ['Java'] } },
    catalog: [{ line: '[D1] Acme | CTC 8 LPA' }], excerpts: [{ tag: 'D1', text: 'Skills: Java' }],
  });
  assert.equal(msgs[0].role, 'system');
  assert.equal(msgs.length, 1 + 6 + 1);
  const last = msgs.at(-1).content;
  assert.match(last, /CGPA 3.3\/4/);
  assert.match(last, /\[D1\] """Skills: Java"""/);
  assert.match(last, /QUESTION: Which drives need Java\?$/);
});

test('cited tags are read from the answer in order, without duplicates', () => {
  assert.deepEqual(citedTags('Try [D2] and [D1]. Also [D2].'), ['D2', 'D1']);
  assert.deepEqual(citedTags('No idea.'), []);
});
