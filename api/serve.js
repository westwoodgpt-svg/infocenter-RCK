// Vercel Serverless Function replacing the Cloudflare Worker (worker.js).
// Bitrix24 opens the local app with a POST request; static files in dist/
// must be served for any HTTP method (GET and POST alike).
import { readFileSync, existsSync } from 'fs';
import { join, extname, normalize } from 'path';

const DIST = join(process.cwd(), 'dist');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
};

export default function handler(req, res) {
    const host = req.headers.host || 'localhost';
    const url = new URL(req.url, `http://${host}`);
    let pathname = normalize(decodeURIComponent(url.pathname));

  if (pathname === '/' || pathname === '.') pathname = '/index.html';

  let filePath = join(DIST, pathname);

  if (!filePath.startsWith(DIST) || !existsSync(filePath)) {
        filePath = join(DIST, 'index.html');
  }

  const ext = extname(filePath);
    res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
    res.status(200).send(readFileSync(filePath));
}
