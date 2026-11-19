import http from 'node:http';
import { config } from './config.js';
import { connectDb } from './db.js';
import { createApp } from './app.js';
import { initSocket } from './realtime/socket.js';

async function main() {
  await connectDb(config.mongoUrl);
  const app = createApp();
  const server = http.createServer(app);
  initSocket(server);

  server.listen(config.port, () => {
    console.log(`MeriBaari API running on http://localhost:${config.port}`);
  });

  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('Failed to start', err);
  process.exit(1);
});
