import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildMachine, pose, TOTAL } from './machine.js';
import { PHASES } from './parts.js';
import {
  hero, problem, painChapters, manifesto,
  failureModes, forceScale, forceMarks, interfaces, boundaries, closing, papers,
} from './landing-content.js';

const $ = s => document.querySelector(s);
const el = (t, cls, html) => { const n = document.createElement(t); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };

// ── 文案注入 ───────────────────────────────────────────────────────────────
$('.hero__pre').textContent = hero.prelude;
$('.hero__glyphs').innerHTML = hero.glyphs.map(g => `<span>${g}</span>`).join('');
$('.hero__foot p').innerHTML = hero.lines.join('<br>');

$('.intro__lead').textContent = problem.lead;
$('.intro__title').innerHTML = problem.title.map(l => `<span>${l}</span>`).join('');
$('.intro__copy').innerHTML = problem.copy.map(p => `<p>${p}</p>`).join('');

$('.pains').innerHTML = painChapters.map(c => `
  <article class="pain" data-r>
    <p class="pain__idx mono"><b>${c.index}</b><i></i>${c.label}</p>
    <h2>${c.title.map(l => `<span>${l}</span>`).join('')}</h2>
    <p class="pain__body">${c.body}</p>
    <div class="pain__metric"><strong class="mono">${c.metric}</strong><span>${c.metricLabel}</span></div>
    <p class="pain__ev"><span class="mono">依据</span>${c.evidence}</p>
  </article>`).join('');

$('.manifesto h2').innerHTML = manifesto.lines.map(l => `<span>${l}</span>`).join('');
$('.manifesto__turn').textContent = manifesto.turn;
$('.manifesto__body').textContent = manifesto.body;

$('.how__steps').innerHTML = PHASES.map((p, i) => `
  <li data-r><span class="mono n">${String(i + 1).padStart(2, '0')}</span>
    <div><h3>${p.k}<span class="mono ref">${p.ref}</span></h3><p>${p.d}</p></div></li>`).join('');

$('.ui__cards').innerHTML = interfaces.map(c => `
  <article class="uic" data-r>
    <p class="uic__side mono">${c.side}</p>
    <h3>${c.title}</h3>
    <p class="uic__body">${c.body}</p>
    <dl>${c.rules.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
    <p class="uic__foot">${c.foot}</p>
  </article>`).join('');

$('.bounds__list').innerHTML = boundaries.map(b => `<li data-r>${b}</li>`).join('');

$('#papers').innerHTML = papers.map(p => `
  <li data-r><a href="${p.file}" target="_blank" rel="noopener">
    <span class="papers__n">${p.nm}<i class="arw"></i></span>
    <span class="papers__m mono">${p.meta}</span>
    <span class="papers__d">${p.d}</span>
  </a></li>`).join('');

$('.end h2').innerHTML = closing.title.map(l => `<span>${l}</span>`).join('');
$('.end__body').textContent = closing.body;
$('.end__foot').textContent = closing.foot;

// ── 四种失效模式：画在同一根 0–70 N 的轴上 ────────────────────────────────
const pct = n => (n / forceScale.max) * 100;
$('#forceChart').innerHTML = `
  <div class="fx__marks" aria-hidden="true">
    ${forceMarks.map(m => `<i class="fx__mark" style="left:${pct(m.at)}%"><b class="mono">${m.label}</b></i>`).join('')}
  </div>
  <div class="fx__grid" aria-hidden="true">
    ${forceMarks.map(m => m.span
      ? `<i class="fx__band" style="left:${pct(m.span[0])}%;width:${pct(m.span[1] - m.span[0])}%"></i>` : '').join('')}
    ${forceMarks.map(m => `<i class="fx__line" style="left:${pct(m.at)}%"></i>`).join('')}
  </div>
  <div class="fx__rows">
    ${failureModes.map((f, i) => `
      <button class="fx" data-i="${i}" ${i === 0 ? 'data-on="1"' : ''}>
        <span class="fx__k mono">${f.k}</span>
        <span class="fx__nm">${f.nm}</span>
        <span class="fx__track"><i style="left:${pct(f.lo)}%;width:${pct(f.hi - f.lo)}%"></i></span>
        <span class="fx__val mono">${f.lo}–${f.hi}<em>N</em></span>
      </button>`).join('')}
  </div>
  <div class="fx__axis mono" aria-hidden="true">${[0, 10, 20, 30, 40, 50, 60, 70].map(v => `<span style="left:${pct(v)}%">${v}</span>`).join('')}</div>`;

const detail = $('#forceDetail');
function showMode(i) {
  const f = failureModes[i];
  document.querySelectorAll('.fx').forEach(b => { if (+b.dataset.i === i) b.dataset.on = '1'; else delete b.dataset.on; });
  detail.innerHTML = `<h3><span class="mono">${f.k}</span>${f.nm}<em class="mono">${f.lo}–${f.hi} N</em></h3>
    <p>${f.mech}</p><p class="fx__note">${f.note}</p>`;
}
$('#forceChart').addEventListener('click', e => {
  const b = e.target.closest('.fx'); if (b) showMode(+b.dataset.i);
});
showMode(0);

// ── 进场：滚到就显 ─────────────────────────────────────────────────────────
const io = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) { e.target.dataset.r = 'in'; io.unobserve(e.target); }
}), { rootMargin: '0px 0px -12% 0px' });
document.querySelectorAll('[data-r]').forEach(n => io.observe(n));

// ── Hero 的 3D：复用结构图那台机器，慢转，滚出视口就停 ─────────────────────
// Hero 是装饰性的，按装饰性的预算来：
//   ① 像素比封到 1.25（原来 1.75 在 retina 上是 2800×1397 ≈ 390 万像素）
//   ② 不做实时阴影 —— 每帧省掉一整遍阴影渲染，改用一张假的接触阴影贴图
//   ③ 30 fps 封顶；滚动时完全停画，滚出视口或切到后台也停
const canvas = $('#heroView');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const FOCUS = new THREE.Vector3(190, 84, 130), R = 246;
const camera = new THREE.PerspectiveCamera(28, 1, 1, 5000);
const sun = new THREE.DirectionalLight(0xffffff, 2.0);
sun.position.set(560, 610, 530);
scene.add(sun);
const fill = new THREE.DirectionalLight(0xffffff, 0.45);
fill.position.set(-420, 300, -320);
scene.add(fill);

// 假的接触阴影：一张径向渐变贴图，成本是一个 quad
function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  rg.addColorStop(0, 'rgba(14,20,23,.42)');
  rg.addColorStop(0.55, 'rgba(14,20,23,.16)');
  rg.addColorStop(1, 'rgba(14,20,23,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const blobMat = new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false });
const blob = new THREE.Mesh(new THREE.PlaneGeometry(640, 440), blobMat);
blob.rotation.x = -Math.PI / 2;
blob.position.set(196, 0.6, 140);
scene.add(blob);

const { root, rig } = buildMachine({ lite: true });
scene.add(root);
// 仓里放六块板：够看出「不同板型插在同一排槽里」，又不至于把 draw call 顶上去
// 放在左半边：右半边被侧板和取药龛挡住，从这个机位看不见
rig.setLoadout([
  { i: 1, pack: 'oblong10', eaten: 3 },
  { i: 3, pack: 'cap7', eaten: 2 },
  { i: 5, pack: 'tab10', eaten: 0 },
  { i: 7, pack: 'alu7', eaten: 4 },
  { i: 9, pack: 'tab14', eaten: 6 },
  { i: 11, pack: 'small12', eaten: 1 },
]);

function fit() {
  const r = canvas.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / Math.max(1, r.height);
  camera.updateProjectionMatrix();
  const vf = THREE.MathUtils.degToRad(camera.fov);
  const hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
  dist = R / Math.sin(Math.min(vf, hf) / 2) * 0.92;
}
let dist = 900, az = 0.34, spin = 0, t = 4.2;   // 开画就停在托盘推出、药落下的那一拍
addEventListener('resize', fit);
fit();

const dark = () => {
  const d = document.documentElement.dataset.theme;
  return d === 'dark' || (!d && matchMedia('(prefers-color-scheme: dark)').matches);
};
const syncTheme = () => { blobMat.opacity = dark() ? 0.72 : 1; renderer.toneMappingExposure = dark() ? 0.94 : 1.05; };
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncTheme);
syncTheme();

let live = true, scrolledAt = -1e9, acc = 0;
new IntersectionObserver(es => { live = es[0].isIntersecting; if (live) clock.getDelta(); })
  .observe($('.hero'));
addEventListener('scroll', () => { scrolledAt = performance.now(); }, { passive: true });
document.addEventListener('visibilitychange', () => { if (!document.hidden) clock.getDelta(); });

const moving = [rig.activeTray, rig.push, rig.ring, rig.punch].filter(Boolean);
const clock = new THREE.Clock();
const slow = matchMedia('(prefers-reduced-motion: reduce)').matches;
const STEP = 1 / 30;
function frame() {
  requestAnimationFrame(frame);
  // 滚动的那几百毫秒里一帧都不画 —— 卡顿是主线程在跟滚动抢时间
  if (!live || document.hidden || performance.now() - scrolledAt < 140) { clock.getDelta(); return; }
  acc += clock.getDelta();
  if (acc < STEP) return;
  const dt = Math.min(acc, 0.1); acc = 0;
  if (!slow) { spin += dt; az = 0.34 + Math.sin(spin * 0.16) * 0.30; t = (t + dt * 0.62) % TOTAL; }
  pose(rig, t);
  // pose() 只写 userData.base（结构图那边靠爆炸视图统一落到 position），这里自己落一下
  for (const g of moving) g.position.copy(g.userData.base);
  camera.position.set(
    FOCUS.x + Math.sin(az) * Math.cos(0.42) * dist,
    FOCUS.y + Math.sin(0.42) * dist,
    FOCUS.z + Math.cos(az) * Math.cos(0.42) * dist,
  );
  camera.lookAt(FOCUS);
  renderer.render(scene, camera);
}
frame();

