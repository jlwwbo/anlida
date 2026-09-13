import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildMachine, pose, TOTAL } from './machine.js';
import { PHASES } from './parts.js';
import {
  hero, problem, painChapters, manifesto,
  failureModes, forceScale, forceMarks, interfaces, boundaries, closing,
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
const canvas = $('#heroView');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const FOCUS = new THREE.Vector3(190, 84, 130), R = 246;
const camera = new THREE.PerspectiveCamera(28, 1, 1, 5000);
const sun = new THREE.DirectionalLight(0xffffff, 2.0);
sun.position.set(560, 610, 530);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -380, right: 380, top: 380, bottom: -380, near: 10, far: 2200 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 1.2;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xffffff, 0.45);
fill.position.set(-420, 300, -320);
scene.add(fill);

const shadowMat = new THREE.ShadowMaterial({ color: 0x0e1417, opacity: 0.15 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), shadowMat);
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
scene.add(floor);

const { root, rig } = buildMachine();
scene.add(root);

function fit() {
  const r = canvas.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / Math.max(1, r.height);
  camera.updateProjectionMatrix();
  const vf = THREE.MathUtils.degToRad(camera.fov);
  const hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
  dist = R / Math.sin(Math.min(vf, hf) / 2) * 0.92;
}
let dist = 900, az = 0.55, spin = 0, t = 4.2;   // 开画就停在托盘推出、药落下的那一拍
addEventListener('resize', fit);
fit();

const dark = () => {
  const d = document.documentElement.dataset.theme;
  return d === 'dark' || (!d && matchMedia('(prefers-color-scheme: dark)').matches);
};
const syncTheme = () => { shadowMat.opacity = dark() ? 0.3 : 0.15; renderer.toneMappingExposure = dark() ? 0.94 : 1.05; };
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncTheme);
syncTheme();

let live = true;
new IntersectionObserver(es => { live = es[0].isIntersecting; if (live) clock.getDelta(); })
  .observe($('.hero'));

const clock = new THREE.Clock();
const slow = matchMedia('(prefers-reduced-motion: reduce)').matches;
function frame() {
  requestAnimationFrame(frame);
  if (!live) return;
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!slow) { spin += dt; az = 0.55 + Math.sin(spin * 0.16) * 0.34; t = (t + dt * 0.62) % TOTAL; }
  pose(rig, t);
  camera.position.set(
    FOCUS.x + Math.sin(az) * Math.cos(0.42) * dist,
    FOCUS.y + Math.sin(0.42) * dist,
    FOCUS.z + Math.cos(az) * Math.cos(0.42) * dist,
  );
  camera.lookAt(FOCUS);
  renderer.render(scene, camera);
}
frame();
