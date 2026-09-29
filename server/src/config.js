import 'dotenv/config';

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable ${name}. Copy .env.example to .env and fill it in.`);
  }
  return value;
}

const isProd = process.env.NODE_ENV === 'production';

export const config = {
  port: Number(process.env.PORT || 5000),
  mongoUri: required('MONGO_URI', 'mongodb://127.0.0.1:27017/placemate'),
  // In production a real secret is mandatory; in development a fixed one keeps you logged in across restarts.
  jwtSecret: required('JWT_SECRET', isProd ? undefined : 'dev-only-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  nlpUrl: (process.env.NLP_URL || 'http://127.0.0.1:5001').replace(/\/$/, ''),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  // Ask PlaceMate (RAG) - local models via Ollama
  ollamaUrl: (process.env.OLLAMA_URL || 'http://127.0.0.1:11434').replace(/\/$/, ''),
  chatModel: process.env.OLLAMA_CHAT_MODEL || 'llama3.2:3b',
  embedModel: process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text',
  isProd,
};
