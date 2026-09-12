import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildMachine, pose, TOTAL } from './machine.js';
import { PARTS, PHASES, ST_LABEL } from './parts.js';

const $ = s => document.querySelector(s);
const canvas = $('#view');

// ── 渲染器 ─────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

const camera = new THREE.PerspectiveCamera(30, 1, 1, 5000);
camera.position.set(556, 306, 776);

const sun = new THREE.DirectionalLight(0xffffff, 2.0);
sun.position.set(560, 610, 530);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const c = sun.shadow.camera;
c.left = -380; c.right = 380; c.top = 380; c.bottom = -380; c.near = 10; c.far = 2200;
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 1.2;
scene.add(sun);
const fill = new THREE.DirectionalLight(0xffffff, 0.45);
fill.position.set(-420, 300, -320);
scene.add(fill);

const shadowMat = new THREE.ShadowMaterial({ color: 0x0e1417, opacity: 0.17 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), shadowMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const { root, reg, rig } = buildMachine();
scene.add(root);

const controls = new OrbitControls(camera, canvas);
controls.target.set(190, 74, 150);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 280;
controls.maxDistance = 1800;
controls.minPolarAngle = 0.22;
controls.maxPolarAngle = 1.42;
controls.update();

// ── 主题：画布不画底，底色交给 CSS；只把阴影浓度跟着主题调 ─────────────────
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

// ── 尺寸 ───────────────────────────────────────────────────────────────────
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ── 爆炸视图 ───────────────────────────────────────────────────────────────
let explode = 0;
function applyExplode() {
  for (const p of reg.values()) {
    for (const g of p.groups) {
      g.position.set(
        g.userData.base.x + p.exp.x * explode,
        g.userData.base.y + p.exp.y * explode,
        g.userData.base.z + p.exp.z * explode,
      );
    }
  }
}

// ── 高亮：每个材质只克隆一次，不改共享材质 ─────────────────────────────────
const hiCache = new Map();
function hiMat(m) {
  if (!hiCache.has(m)) {
    const k = m.clone();
    k.emissive = new THREE.Color(0xb8402f);
    k.emissiveIntensity = 0.42;
    if (k.color) k.color.lerp(new THREE.Color(0xc4543f), 0.42);   // 浅色件也要看得出被选中
    if (k.transparent) k.opacity = Math.min(1, k.opacity * 1.9);
    hiCache.set(m, k);
  }
  return hiCache.get(m);
}
let hot = null;
function setHot(id) {
  if (hot === id) return;
  if (hot) reg.get(hot).meshes.forEach(m => { if (m.userData.baseMat) m.material = m.userData.baseMat; });
  hot = id;
  if (hot) reg.get(hot).meshes.forEach(m => {
    m.userData.baseMat = m.userData.baseMat || m.material;
    m.material = hiMat(m.userData.baseMat);
  });
  paintCard(id);
}

// ── 卡片与引线 ─────────────────────────────────────────────────────────────
const byId = Object.fromEntries(PARTS.map(p => [p.id, p]));
const card = $('#card'), leader = $('#leader line'), marker = $('#marker');
function paintCard(id) {
  if (!id) {
    card.dataset.empty = '1'; marker.hidden = true; leader.style.opacity = 0;
    card.innerHTML = `
      <div class="card__top"><span class="mono tag">19 个零件</span><span class="mono grp">悬停查看</span></div>
      <h2 class="ghost">把指针放到任一零件上</h2>
      <ul>
        <li>左下是一次取药的六个动作，可以点进去单看一段。</li>
        <li>底部「拆开」把整机展开成爆炸图；「外壳」收掉壳体。</li>
        <li>点一下零件把它钉住，再点空白处松开。</li>
      </ul>
      <div class="card__st"><i class="dot dot--warn"></i><b>动画是示意</b>
        <span>真实节拍 4.1 s/粒，这里放慢了约两倍；白模不表达表面处理与造型。</span></div>`;
    return;
  }
  const p = byId[id];
  card.dataset.empty = '';
  card.innerHTML = `
    <div class="card__top"><span class="mono tag">${p.id}</span><span class="mono grp">${p.grp}</span></div>
    <h2>${p.nm}</h2>
    <ul>${p.sp.map(s => `<li>${s}</li>`).join('')}</ul>
    <div class="card__st"><i class="dot dot--${p.st}"></i><b>${ST_LABEL[p.st]}</b><span>${p.stx}</span></div>`;
}
const box = new THREE.Box3(), mid = new THREE.Vector3();
function placeLeader() {
  if (!hot) return;
  box.makeEmpty();
  reg.get(hot).meshes.forEach(m => box.expandByObject(m));
  box.getCenter(mid).project(camera);
  const x = (mid.x * 0.5 + 0.5) * innerWidth, y = (-mid.y * 0.5 + 0.5) * innerHeight;
  marker.hidden = false;
  marker.style.transform = `translate(${x}px,${y}px)`;
  const r = card.getBoundingClientRect();
  leader.setAttribute('x1', x); leader.setAttribute('y1', y);
  leader.setAttribute('x2', r.left); leader.setAttribute('y2', r.top + 26);
  leader.style.opacity = 1;
}

// ── 拾取 ───────────────────────────────────────────────────────────────────
const pickable = [];
for (const p of reg.values()) p.meshes.forEach(m => pickable.push(m));
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
let pinned = null;
canvas.addEventListener('pointermove', e => {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(pickable, false).find(h => h.object.visible);
  const id = hit ? hit.object.userData.part : null;
  canvas.style.cursor = id ? 'crosshair' : 'grab';
  if (!pinned) setHot(id);
});
canvas.addEventListener('pointerleave', () => { if (!pinned) setHot(null); });
canvas.addEventListener('click', () => { pinned = pinned ? null : hot; $('#pinned').hidden = !pinned; });

// ── 时序 ───────────────────────────────────────────────────────────────────
let t = 0, playing = true;
const rail = $('#rail'), scrub = $('#scrub'), phaseNote = $('#phaseNote');
PHASES.forEach((p, i) => {
  const li = document.createElement('button');
  li.className = 'rail__i';
  li.innerHTML = `<span class="mono n">${String(i + 1).padStart(2, '0')}</span>
    <span class="rail__k">${p.k}</span><span class="mono rail__r">${p.ref}</span>`;
  li.onclick = () => { t = p.t[0] + 0.01; playing = false; syncPlay(); };
  rail.appendChild(li);
});
const railItems = [...rail.children];
function syncPhase() {
  let act = -1;
  PHASES.forEach((p, i) => { if (t >= p.t[0] && t < p.t[1]) act = i; });
  if (act < 0) act = t >= PHASES[5].t[1] ? 5 : 0;
  railItems.forEach((el, i) => el.dataset.on = i === act ? '1' : '');
  phaseNote.textContent = PHASES[act].d;
  scrub.value = String(Math.round((t / TOTAL) * 1000));
}
function syncPlay() { $('#play').dataset.on = playing ? '1' : ''; $('#play span').textContent = playing ? '暂停' : '播放'; }
$('#play').onclick = () => { playing = !playing; syncPlay(); };
scrub.oninput = () => { t = (scrub.value / 1000) * TOTAL; playing = false; syncPlay(); };
const explIn = $('#expl');
explIn.oninput = () => { $('#explVal').textContent = Math.round(explIn.value / 10) + '%'; };
$('#shell').onclick = e => {
  const on = e.currentTarget.dataset.on = e.currentTarget.dataset.on ? '' : '1';
  rig.shell.visible = !on;
};

// ── 入场：零件从爆炸位归拢 ─────────────────────────────────────────────────
let intro = 0;
requestAnimationFrame(() => document.body.dataset.ready = '1');

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (intro < 1) intro = Math.min(1, intro + dt / 1.5);
  if (playing) { t += dt; if (t > TOTAL) t = 0; }
  pose(rig, t);
  const io = 1 - intro;                       // 入场：零件从爆炸位归拢
  explode = Math.max(+explIn.value / 1000, io * io * 0.9);
  applyExplode();
  controls.update();
  syncPhase();
  placeLeader();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
paintCard(null);
syncPlay();
frame();

// 图例：按组列出零件，点一下高亮
const legend = $('#legend');
const groups = [...new Set(PARTS.map(p => p.grp))];
legend.innerHTML = groups.map(g => `<div class="lg"><h3 class="mono">${g}</h3>${
  PARTS.filter(p => p.grp === g).map(p =>
    `<button class="lg__i" data-id="${p.id}"><i class="dot dot--${p.st}"></i>${p.nm}</button>`).join('')
}</div>`).join('');
legend.addEventListener('pointerover', e => { const b = e.target.closest('.lg__i'); if (b && !pinned) setHot(b.dataset.id); });
legend.addEventListener('click', e => { const b = e.target.closest('.lg__i'); if (b) { pinned = b.dataset.id; setHot(b.dataset.id); $('#pinned').hidden = false; } });

// 调试钩子（只在本地用；不影响渲染）
window.__dbg = () => ({
  carX: +rig.car.position.x.toFixed(1),
  trayZ: +rig.activeTray.position.z.toFixed(1),
  pushZ: +rig.push.position.z.toFixed(1),
  punchX: +rig.punch.position.x.toFixed(1),
  flyVis: rig.fly.visible, flyP: rig.fly.position.toArray().map(v => +v.toFixed(1)),
});
