import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildMachine, pose, poseLoad, resetTrays, TOTAL, L, slotX } from './machine.js';
import { PARTS, PHASES } from './parts.js';
import { PROFILES, PACKS, perBoard, planLoadout } from './profiles.js';

const $ = s => document.querySelector(s);
// data-on="" 仍然命中 [data-on]，所以关掉时必须删属性
const flag = (n, on) => { if (on) n.dataset.on = '1'; else delete n.dataset.on; };
const canvas = $('#view');
const touch = !matchMedia('(hover: hover) and (pointer: fine)').matches;

// ── 渲染器 ─────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, touch ? 1.75 : 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(30, 1, 1, 5000);
camera.position.set(556, 306, 776);
const FOCUS = new THREE.Vector3(190, 84, 138), R = 244;
function fitCamera() {
  const vf = THREE.MathUtils.degToRad(camera.fov);
  const hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
  camera.position.sub(FOCUS).setLength(R / Math.sin(Math.min(vf, hf) / 2) * (touch ? 0.84 : 0.9)).add(FOCUS);
}

const sun = new THREE.DirectionalLight(0xffffff, 2.0);
sun.position.set(560, 610, 530);
sun.castShadow = true;
sun.shadow.mapSize.set(touch ? 1024 : 2048, touch ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -380, right: 380, top: 380, bottom: -380, near: 10, far: 2200 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 1.2;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xffffff, 0.45);
fill.position.set(-420, 300, -320);
scene.add(fill);

const shadowMat = new THREE.ShadowMaterial({ color: 0x0e1417, opacity: 0.17 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), shadowMat);
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
scene.add(floor);

const { root, reg, rig } = buildMachine();
scene.add(root);

const controls = new OrbitControls(camera, canvas);
controls.target.copy(FOCUS);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.enablePan = !touch;
controls.minDistance = 280; controls.maxDistance = 1800;
controls.minPolarAngle = 0.22; controls.maxPolarAngle = 1.42;
controls.update();

const themeDark = () => {
  const t = document.documentElement.dataset.theme;
  return t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches);
};
function syncTheme() {
  const d = themeDark();
  shadowMat.opacity = d ? 0.34 : 0.17;
  shadowMat.color.set(d ? 0x000000 : 0x0e1417);
  sun.intensity = d ? 2.4 : 2.0;
  renderer.toneMappingExposure = d ? 0.94 : 1.05;
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncTheme);
syncTheme();

function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  fitCamera();
  controls.update();
}
addEventListener('resize', resize);
resize();

// ── 爆炸：三档，不做连续滑杆 ───────────────────────────────────────────────
let explodeTarget = 0, explode = 0;
function applyExplode() {
  for (const p of reg.values()) for (const g of p.groups) {
    g.position.set(
      g.userData.base.x + p.exp.x * explode,
      g.userData.base.y + p.exp.y * explode,
      g.userData.base.z + p.exp.z * explode,
    );
  }
}
$('.seg').addEventListener('click', e => {
  const b = e.target.closest('button[data-x]');
  if (!b) return;
  document.querySelectorAll('.seg button').forEach(n => flag(n, n === b));
  explodeTarget = +b.dataset.x;
});

// ── 高亮 ───────────────────────────────────────────────────────────────────
const hiCache = new Map();
function hiMat(m) {
  if (!hiCache.has(m)) {
    const k = m.clone();
    k.emissive = new THREE.Color(0xb8402f);
    k.emissiveIntensity = 0.42;
    if (k.color) k.color.lerp(new THREE.Color(0xc4543f), 0.3);
    if (k.transparent) k.opacity = Math.min(1, k.opacity * 1.9);
    hiCache.set(m, k);
  }
  return hiCache.get(m);
}
let hot = null, pinned = null;
function setHot(id) {
  if (hot === id) return;
  if (hot && reg.has(hot)) reg.get(hot).meshes.forEach(m => { if (m.userData.baseMat) m.material = m.userData.baseMat; });
  hot = id;
  if (hot && reg.has(hot)) reg.get(hot).meshes.forEach(m => {
    m.userData.baseMat = m.userData.baseMat || m.material;
    m.material = hiMat(m.userData.baseMat);
  });
  paintCard(id);
}

const byId = Object.fromEntries(PARTS.map(p => [p.id, p]));
const card = $('#card');
function paintCard(id) {
  const p = byId[id];
  if (!p) {
    card.innerHTML = `<p class="lbl mono">零件</p>
      <p class="card__hint">${touch ? '点' : '把指针放到'}任一零件上看它是什么。</p>`;
    return;
  }
  card.innerHTML = `<div class="card__top"><span class="mono tag">${p.id}</span><span class="mono grp">${p.grp}</span></div>
    <h2>${p.nm}</h2><ul>${p.sp.map(s => `<li>${s}</li>`).join('')}</ul>`;
}

// ── 拾取 ───────────────────────────────────────────────────────────────────
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function hitAt(x, y) {
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const pickable = [];
  for (const p of reg.values()) p.meshes.forEach(m => { if (m.visible && m.parent) pickable.push(m); });
  const h = ray.intersectObjects(pickable, false).find(o => o.object.visible);
  return h ? h.object.userData.part : null;
}
if (!touch) {
  canvas.addEventListener('pointermove', e => {
    const id = hitAt(e.clientX, e.clientY);
    canvas.style.cursor = id ? 'crosshair' : 'grab';
    if (!pinned) setHot(id);
  });
  canvas.addEventListener('click', e => { pinned = pinned ? null : hitAt(e.clientX, e.clientY); if (pinned) setHot(pinned); });
} else {
  let sx = 0, sy = 0, drag = 0;
  canvas.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; drag = 0; });
  canvas.addEventListener('pointermove', e => { drag = Math.max(drag, Math.hypot(e.clientX - sx, e.clientY - sy)); });
  canvas.addEventListener('pointerup', e => {
    if (drag > 8) return;
    const id = hitAt(e.clientX, e.clientY);
    if (id) { pinned = id; setHot(id); document.body.dataset.card = '1'; }
    else { pinned = null; setHot(null); delete document.body.dataset.card; delete document.body.dataset.who; }
  });
}

// ── 用药画像：选一个，药板就装进去 ─────────────────────────────────────────
const chips = $('#chips'), whoCard = $('#whoCard');
chips.innerHTML = PROFILES.map((p, i) =>
  `<button class="chip" data-i="${i}"><b class="mono">${p.id}</b>${p.nm}</button>`).join('');
const VERDICT = { no: ['不是目标用户', 'no'], edge: ['边缘', 'edge'], yes: ['适用', 'yes'], core: ['核心设计段', 'core'], over: ['超出容量', 'no'] };

let plan = null, current = 0;
function pickProfile(i, replay) {
  current = i;
  const p = PROFILES[i];
  plan = planLoadout(p);
  document.querySelectorAll('.chip').forEach((c, k) => flag(c, k === i));
  // 已服的格子：给每板随机但稳定的消耗，让它看起来是用过的
  const entries = plan.entries.map((e, k) => ({ i: e.i, pack: e.pack, med: e.med, spare: e.spare,
    eaten: e.spare ? 0 : (k * 3 + i) % Math.max(1, perBoard(e.pack) - 1) }));
  rig.setLoadout(entries);
  loadEntries = entries;
  const [vl, vc] = VERDICT[p.verdict];
  whoCard.innerHTML = `
    <div class="who__head">
      <h2>${p.nm}<span class="mono">${p.who}</span></h2>
      <span class="verdict verdict--${vc}">${vl}</span>
    </div>
    <p class="who__dx">${p.dx}</p>
    <dl class="who__figs">
      <div><dt class="mono">${plan.n}</dt><dd>种板装药</dd></div>
      <div><dt class="mono">${plan.used}<em>/20</em></dt><dd>槽 · 每种 ${plan.k} 板备份</dd></div>
      <div><dt class="mono ${plan.days < 14 ? 'warn' : ''}">${plan.days}</dt><dd>天换一次板</dd></div>
    </dl>
    <p class="who__drv">消耗最快的是<b>${plan.driver.nm}</b>（${plan.driver.when}），一板 ${perBoard(plan.driver.pack)} 粒。</p>
    <details class="who__list" ${p.meds.length < 6 ? 'open' : ''}>
      <summary class="mono">仓里的 ${plan.n} 种药</summary>
      <ul>${p.meds.map(mm => `<li><b>${mm.nm}</b><span class="mono">${PACKS[mm.pack].nm} · ${perBoard(mm.pack)} 粒</span><i>${mm.when}</i></li>`).join('')}</ul>
    </details>
    ${p.others.length ? `<details class="who__list who__list--out"><summary class="mono">设备管不了的 ${p.others.length} 种</summary>
      <ul>${p.others.map(o => `<li><b>${o.nm}</b><i>${o.why}</i></li>`).join('')}</ul></details>` : ''}
    <p class="who__note">${p.note}</p>`;
  if (touch) { document.body.dataset.who = '1'; delete document.body.dataset.card; }
  if (replay) startLoad();
}

// ── 装填演示：掀盖，托盘从上方逐个落进槽位 ─────────────────────────────────
let loadEntries = [], loadT = -1, loadDur = 0;
function startLoad() {
  loadT = 0;
  loadDur = poseLoad(rig, 0, loadEntries);
  playing = false; syncPlay();
}
$('#load').onclick = () => startLoad();

// ── 时序 ───────────────────────────────────────────────────────────────────
let t = 0, playing = true;
const rail = $('#rail'), scrub = $('#scrub'), phaseNote = $('#phaseNote');
PHASES.forEach((p, i) => {
  const li = document.createElement('button');
  li.className = 'rail__i';
  li.innerHTML = `<span class="mono n">${String(i + 1).padStart(2, '0')}</span><span class="rail__k">${p.k}</span>`;
  li.onclick = () => { loadT = -1; resetTrays(rig, loadEntries); t = p.t[0] + 0.01; playing = false; syncPlay(); };
  rail.appendChild(li);
});
const railItems = [...rail.children];
function syncPhase() {
  let act = -1;
  PHASES.forEach((p, i) => { if (t >= p.t[0] && t < p.t[1]) act = i; });
  if (act < 0) act = t >= PHASES[5].t[1] ? 5 : 0;
  railItems.forEach((el, i) => flag(el, i === act));
  phaseNote.textContent = PHASES[act].d;
  scrub.value = String(Math.round((t / TOTAL) * 1000));
}
function syncPlay() { flag($('#play'), playing); $('#play span').textContent = playing ? '暂停' : '播放'; }
$('#play').onclick = () => { playing = !playing; if (playing) { loadT = -1; resetTrays(rig, loadEntries); } syncPlay(); };
scrub.oninput = () => { loadT = -1; resetTrays(rig, loadEntries); t = (scrub.value / 1000) * TOTAL; playing = false; syncPlay(); };
$('#shell').onclick = e => {
  const hide = !e.currentTarget.dataset.on;
  flag(e.currentTarget, hide);
  rig.shell.visible = !hide;
  rig.lid.visible = !hide;
};

// ── 零件清单 ───────────────────────────────────────────────────────────────
const legend = $('#legend'), sheet = $('#sheet');
const groups = [...new Set(PARTS.map(p => p.grp))];
legend.innerHTML = groups.map(g => `<div class="lg"><h3 class="mono">${g}</h3>${
  PARTS.filter(p => p.grp === g).map(p => `<button class="lg__i" data-id="${p.id}">${p.nm}</button>`).join('')}</div>`).join('');
legend.addEventListener('pointerover', e => { const b = e.target.closest('.lg__i'); if (b && !pinned) setHot(b.dataset.id); });
legend.addEventListener('click', e => {
  const b = e.target.closest('.lg__i');
  if (b) { pinned = b.dataset.id; setHot(b.dataset.id); document.body.dataset.card = '1'; }
});
$('#parts').onclick = e => { const on = sheet.hidden; sheet.hidden = !on; flag(e.currentTarget, on); };
$('#sheetClose').onclick = () => { sheet.hidden = true; flag($('#parts'), false); };

// ── 主循环 ─────────────────────────────────────────────────────────────────
let intro = 0;
requestAnimationFrame(() => document.body.dataset.ready = '1');
const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (intro < 1) intro = Math.min(1, intro + dt / 1.5);

  if (loadT >= 0) {
    loadT += dt;
    poseLoad(rig, loadT, loadEntries);
    if (loadT > loadDur) { loadT = -1; resetTrays(rig, loadEntries); playing = true; t = 0; syncPlay(); }
  } else {
    if (playing) { t += dt; if (t > TOTAL) t = 0; }
    pose(rig, t);
  }

  explode += (explodeTarget - explode) * Math.min(1, dt * 6);
  const io = 1 - intro;
  applyExplodeWith(Math.max(explode, io * io * 0.9));
  controls.update();
  syncPhase();
  renderer.render(scene, camera);
}
function applyExplodeWith(v) { const p = explode; explode = v; applyExplode(); explode = p; }
paintCard(null);
syncPlay();
pickProfile(4, false);          // 默认 P5 老赵 —— 白皮书里「平均 9.1 种」的化身
chips.addEventListener('click', e => {
  const b = e.target.closest('.chip');
  if (!b) return;
  const same = +b.dataset.i === current;
  if (touch && same && document.body.dataset.who) { delete document.body.dataset.who; return; }
  pickProfile(+b.dataset.i, !same);
});
frame();
