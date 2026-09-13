import { createServer } from 'node:http';

const port = Number(process.env.BLOG_E2E_ADMIN_PORT ?? 3999);
const adminToken =
  process.env.BLOG_E2E_ADMIN_TOKEN ?? 'playwright-admin-token';

const server = createServer((request, response) => {
  if (request.method !== 'GET' || request.url !== '/admin/auth') {
    response.writeHead(404).end();
    return;
  }

  if (request.headers['x-admin-token'] !== adminToken) {
    response.writeHead(401, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ message: 'unauthorized' }));
    return;
  }

  response.writeHead(200, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify({ ok: true }));
});

server.listen(port, '127.0.0.1');

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
