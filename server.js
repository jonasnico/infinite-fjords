import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/src/main.js', ['src/main.js', 'text/javascript; charset=utf-8']],
  ['/src/landscape.js', ['src/landscape.js', 'text/javascript; charset=utf-8']],
  ['/src/terrain.js', ['src/terrain.js', 'text/javascript; charset=utf-8']],
]);
const port = Number(process.env.PORT || 5173);
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const file = files.get(pathname);
  if (!file) {
    response.writeHead(404).end('Not found');
    return;
  }
  try {
    const contents = await readFile(fileURLToPath(new URL(file[0], import.meta.url)));
    response.writeHead(200, { 'Content-Type': file[1], 'Cache-Control': 'no-cache' });
    response.end(contents);
  } catch (error) {
    console.error('Could not serve file:', error);
    response.writeHead(500).end('Could not load the application.');
  }
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Infinite Fjords is running at http://localhost:${port}`);
});
