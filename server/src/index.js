import mongoose from 'mongoose';
import { createApp } from './app.js';
import { config } from './config.js';

async function main() {
  await mongoose.connect(config.mongoUri);
  console.log('Connected to MongoDB');
  const app = createApp();
  app.listen(config.port, () => console.log(`PlaceMate API running on http://localhost:${config.port}`));
}

main().catch((err) => {
  console.error('Failed to start:', err.message);
  process.exit(1);
});
