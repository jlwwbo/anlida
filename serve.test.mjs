// node serve.test.mjs —— 只测路径解析那一段，其余是 node: 内置模块的事
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { resolvePath } from './serve.mjs';

const ROOT = fileURLToPath(new URL('.', import.meta.url));

assert.ok(resolvePath('/').endsWith('index.html'), '根路径要落到 index.html');
assert.ok(resolvePath('/src/main.js').endsWith('src/main.js'));
assert.ok(resolvePath('/index.html?v=2').endsWith('index.html'), '查询串要剥掉');

// 不变量：无论请求写成什么样，解出来的路径都必须留在仓库里
for (const u of ['/../../.ssh/id_rsa', '/%2e%2e/%2e%2e/etc/passwd', '/src/../../../etc/hosts', '/a/../b']) {
  const r = resolvePath(u);
  assert.ok(r === null || r.startsWith(ROOT), `越界了：${u} → ${r}`);
}
assert.equal(resolvePath('/a\u0000b'), null, '空字节要挡掉');

console.log('serve.test.mjs \u2713');
