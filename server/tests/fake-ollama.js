/**
 * A stand-in for Ollama, for testing Ask PlaceMate without downloading models.
 * Same endpoints and JSON shapes as the real server:
 *   GET /api/tags, POST /api/embed, POST /api/chat
 * Embeddings are a simple hashed bag of words (so similar texts get similar vectors);
 * "chat" just lists the drives found in the notice excerpts, citing their tags.
 *
 *   node tests/fake-ollama.js   (listens on 11434)
 */
import http from 'node:http';

const DIM = 256;
function embed(text) {
  const v = new Array(DIM).fill(0);
  const words = text.replace(/^search_(document|query): /, '').toLowerCase().match(/[a-z0-9]+/g) || [];
  for (const w of words) {
    if (w.length < 3) continue;
    let h = 0;
    for (const ch of w) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    v[h % DIM] += 1;
  }
  return v;
}

function answer(messages) {
  const last = messages.at(-1).content;
  const question = last.slice(last.lastIndexOf('QUESTION: ') + 10);
  const excerptTags = [...new Set([...last.split('NOTICE EXCERPTS')[1].matchAll(/^\[(D\d+)\]/gm)].map((m) => m[1]))];
  const drivesPart = last.split('NOTICE EXCERPTS')[0];
  const lines = Object.fromEntries([...drivesPart.matchAll(/^\[(D\d+)\] ([^|\n]+)/gm)].map((m) => [m[1], m[2].trim()]));
  if (!excerptTags.length) return "I don't know based on the drives I can see. Please check with the placement cell.";
  return `For "${question}", these notices look relevant:\n${excerptTags.slice(0, 3).map((t) => `- ${lines[t]} [${t}]`).join('\n')}`;
}

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const json = body ? JSON.parse(body) : {};
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/api/tags') return res.end(JSON.stringify({ models: [{ name: 'llama3.2:3b' }, { name: 'nomic-embed-text:latest' }] }));
    if (req.url === '/api/embed') return res.end(JSON.stringify({ model: json.model, embeddings: json.input.map(embed) }));
    if (req.url === '/api/chat') {
      return res.end(JSON.stringify({ model: json.model, message: { role: 'assistant', content: answer(json.messages) }, done: true }));
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'not found' }));
  });
});
server.listen(Number(process.env.PORT || 11434), () => console.log('fake ollama listening'));
