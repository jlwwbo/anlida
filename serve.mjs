// 本地预览用的静态服务。ES module + importmap 在 file:// 下会被 CORS 拦，所以必须走 HTTP。
// 零依赖，只用 node: 内置模块。  node serve.mjs [端口]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.argv[2]) || 8732;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',        // 不给 pdf 正确的 MIME，浏览器会下载而不是打开
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

// 把 URL 路径解成 ROOT 下的真实路径；越界返回 null（别让 ../ 读到仓库外面）
export function resolvePath(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath.split('?')[0]));
  if (clean.includes('\0')) return null;
  const abs = join(ROOT, clean);
  if (!abs.startsWith(ROOT)) return null;
  return abs.endsWith(sep) || clean === '/' ? join(abs, 'index.html') : abs;
}

const app = createServer(async (req, res) => {
  const file = resolvePath(req.url);
  if (!file) { res.writeHead(403).end('forbidden'); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': MIME[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'no-cache',
    }).end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('not found');
  }
});

// 被 import 时只导出 resolvePath，不占端口
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => console.log(`安粒达 → http://localhost:${PORT}`));
}
