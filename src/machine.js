import * as THREE from 'three';

// ── 尺度：1 世界单位 = 1 mm（《13》3.3 / 4.4 M1）────────────────────────────
export const L = {
  W: 380, H: 180, D: 250,
  SLOT_N: 20, PITCH: 17, SLOT_X0: 22,
  MAG_Z0: 42, MAG_DEPTH: 90,
  TRAY_Y0: 40, TRAY_H: 67, TRAY_L: 90,
  BOARD_Y: 57, BOARD_Z: 80,
  STOW_Z: 87, STATION_Z: 177,
  PUSH_HOME: 30, PUSH_END: 131,
  ACTIVE: 8,
};
L.TRAY_YC = L.TRAY_Y0 + L.TRAY_H / 2;            // 73.5
L.ROW_Y = [L.TRAY_YC + 14.25, L.TRAY_YC - 14.25];  // 2×5 板的两行（节距 57/2）
export const slotX = i => L.SLOT_X0 + i * L.PITCH;

// ── 材质 ───────────────────────────────────────────────────────────────────
const M = {};
function mats() {
  const std = (c, r, m, extra) => new THREE.MeshStandardMaterial({ color:c, roughness:r, metalness:m, ...extra });
  M.white  = std(0xf0f2f3, 0.62, 0.02);                       // 白模结构
  M.frame  = std(0xdfe3e5, 0.70, 0.04);                       // 机架
  M.alu    = std(0xb4bcc1, 0.34, 0.86);                       // C 形框（铝）
  M.steel  = std(0xcdd4d9, 0.22, 0.92);                       // 钢件
  M.dark   = std(0x2a3136, 0.42, 0.30);                       // 电机 / 相机体
  M.ink    = std(0x14181b, 0.55, 0.05);                       // 定位标记
  M.tray   = std(0xe4e7e8, 0.82, 0.02);                       // 注塑托盘
  M.divid  = new THREE.MeshStandardMaterial({ color:0xe9edee, roughness:0.45, metalness:0.02, transparent:true, opacity:0.62 });
  M.foil   = std(0xa9b1b7, 0.16, 1.0);                        // 铝箔
  M.pvc    = new THREE.MeshStandardMaterial({ color:0xdde6ea, roughness:0.10, metalness:0.0, transparent:true, opacity:0.34 });
  M.iron   = std(0x8f989e, 0.40, 1.0);
  M.magnet = std(0xc98a2e, 0.38, 0.65);
  M.rubber = std(0x3c4348, 0.86, 0.02);
  M.accent = std(0xb8402f, 0.52, 0.04);                       // 药：唯一的饱和色
  M.pillA  = std(0xf1eade, 0.70, 0.02);                       // 素片
  M.pillB  = std(0xdde3e6, 0.62, 0.02);                       // 薄膜衣片
  M.pillC  = std(0xc98a2e, 0.50, 0.10);                       // 软胶囊
  M.lamp   = new THREE.MeshStandardMaterial({ color:0xfff6e6, emissive:0xffd9a0, emissiveIntensity:0.9, roughness:0.4 });
  M.shell  = new THREE.MeshStandardMaterial({ color:0xf7f9fa, roughness:0.3, metalness:0.0, transparent:true, opacity:0.055, side:THREE.DoubleSide, depthWrite:false });
  M.edge   = new THREE.LineBasicMaterial({ color:0x9aa4ab, transparent:true, opacity:0.75 });
  return M;
}

const B = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const CY = (r, h, s = 20) => new THREE.CylinderGeometry(r, r, h, s);

export function buildMachine() {
  mats();
  const root = new THREE.Group();
  const reg = new Map();   // id → { groups:[], meshes:[], exp:Vector3 }
  const rig = {};

  const part = (id, exp) => {
    if (!reg.has(id)) reg.set(id, { groups: [], meshes: [], exp: exp || new THREE.Vector3() });
    return reg.get(id);
  };
  // 新建一个属于 id 的组，放在 pos，并登记爆炸方向
  const grp = (id, pos, exp, parent) => {
    const p = part(id, exp);
    const g = new THREE.Group();
    g.position.copy(pos);
    g.userData.base = pos.clone();
    p.groups.push(g);
    (parent || root).add(g);
    return g;
  };
  // 往组里塞一个网格，登记到 id
  const put = (g, id, geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    m.userData.part = id;
    g.add(m);
    part(id).meshes.push(m);
    return m;
  };

  // ── P01 外壳：细线框 + 极淡的面 ───────────────────────────────────────────
  const shellG = grp('P01', new THREE.Vector3(L.W / 2, L.H / 2, L.D / 2), new THREE.Vector3(0, 70, 0));
  const shellBox = B(L.W, L.H, L.D);
  put(shellG, 'P01', shellBox, M.shell).castShadow = false;
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(shellBox), M.edge);
  shellG.add(edges);
  rig.shell = shellG;

  // ── P19 电池与主板 ───────────────────────────────────────────────────────
  const elecG = grp('P19', new THREE.Vector3(190, 10, 130), new THREE.Vector3(0, -80, 0));
  put(elecG, 'P19', B(320, 16, 140), M.frame);
  put(elecG, 'P19', B(90, 6, 60), M.dark, -90, 11, 0);

  // ── P18 钥匙锁芯 ─────────────────────────────────────────────────────────
  const lockG = grp('P18', new THREE.Vector3(352, 150, 248), new THREE.Vector3(0, 0, 80));
  const lock = put(lockG, 'P18', CY(7, 10, 18), M.magnet);
  lock.rotation.x = Math.PI / 2;

  // ── P15 出药碟（机顶右端的浅碟）──────────────────────────────────────────
  const dishG = grp('P15', new THREE.Vector3(330, 176, 196), new THREE.Vector3(0, 40, 60));
  const dish = put(dishG, 'P15', new THREE.CylinderGeometry(36, 31, 9, 36), M.white);
  put(dishG, 'P15', new THREE.CylinderGeometry(30, 30, 5, 36), M.frame, 0, 3, 0);

  // ── P02 隔板 ×21 ─────────────────────────────────────────────────────────
  for (let i = 0; i <= L.SLOT_N; i++) {
    const g = grp('P02', new THREE.Vector3(slotX(0) - 8.5 + i * L.PITCH, 74, L.STOW_Z), new THREE.Vector3(0, 0, -70));
    put(g, 'P02', B(1, 72, L.MAG_DEPTH), M.divid).castShadow = false;
  }

  // ── P05 弹片卡扣 ×20 ─────────────────────────────────────────────────────
  for (let i = 0; i < L.SLOT_N; i++) {
    const g = grp('P05', new THREE.Vector3(slotX(i) + 6.5, 42, L.MAG_Z0 + 6), new THREE.Vector3(0, -40, -40));
    put(g, 'P05', B(2.4, 5, 11), M.steel);
  }

  // ── P03 托盘 ×20 + P04 药板 ×20 ──────────────────────────────────────────
  // 四种板型并存，正是「不同板都能插进同一个槽」那句话的视觉证据
  const VAR = [
    { rows:2, cols:5, pr:6.4, dh:7,  pill:'tablet', pr2:4.6, th:3.2, mat:'pillA' },
    { rows:1, cols:7, pr:6.0, dh:10, pill:'capsule', pr2:3.4, th:15,  mat:'accent' },
    { rows:3, cols:4, pr:4.2, dh:4,  pill:'tablet', pr2:2.6, th:2.4, mat:'pillB' },
    { rows:2, cols:5, pr:7.2, dh:6,  pill:'oblong', pr2:4.2, th:9,   mat:'pillC' },
  ];
  rig.trays = [];
  for (let i = 0; i < L.SLOT_N; i++) {
    const v = VAR[i % VAR.length];
    const tg = grp('P03', new THREE.Vector3(slotX(i), L.TRAY_YC, L.STOW_Z), new THREE.Vector3(0, 40, 0));
    rig.trays.push(tg);
    // 开框：只夹封边
    put(tg, 'P03', B(6, 5, L.TRAY_L), M.tray, 0,  31, 0);
    put(tg, 'P03', B(6, 5, L.TRAY_L), M.tray, 0, -31, 0);
    put(tg, 'P03', B(6, 57, 5), M.tray, 0, 0,  42.5);
    put(tg, 'P03', B(6, 57, 5), M.tray, 0, 0, -42.5);
    // 四角定位标记 + 基准角 + 背面铁片
    [[28, 39], [28, -39], [-28, 39]].forEach(([y, z]) => put(tg, 'P03', B(0.8, 5, 5), M.ink, 3.4, y, z));
    put(tg, 'P03', B(0.9, 8, 8), M.ink, 3.4, -28, -39);
    put(tg, 'P03', B(6, 18, 1.8), M.iron, 0, 0, -45.6);

    // 药板（子组，便于单独爆炸）
    const bg = grp('P04', new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 56), tg);
    put(bg, 'P04', B(0.9, L.BOARD_Y, L.BOARD_Z), M.foil, -1.6, 0, 0);
    put(bg, 'P04', B(0.5, L.BOARD_Y, L.BOARD_Z), M.pvc, 0.3, 0, 0);
    const used = (i * 3) % (v.rows * v.cols);
    let n = 0;
    for (let r = 0; r < v.rows; r++) for (let c = 0; c < v.cols; c++) {
      const yy = (r - (v.rows - 1) / 2) * (L.BOARD_Y / v.rows);
      const zz = (c - (v.cols - 1) / 2) * (L.BOARD_Z / v.cols);
      const gone = n++ < used;
      const dome = put(bg, 'P04', CY(v.pr, gone ? 1.6 : v.dh, 16), M.pvc, gone ? 1.3 : 0.5 + v.dh / 2, yy, zz);
      dome.rotation.z = Math.PI / 2; dome.castShadow = false;
      if (gone) {                                   // 已服格：铝箔上的放射状撕口
        const tear = put(bg, 'P04', new THREE.CircleGeometry(v.pr * 0.8, 7), M.ink, -2.2, yy, zz);
        tear.rotation.y = -Math.PI / 2; tear.castShadow = false;
      } else {
        const pm = M[v.mat];
        let p;
        if (v.pill === 'capsule') {
          p = put(bg, 'P04', new THREE.CapsuleGeometry(v.pr2, v.th - v.pr2 * 2, 6, 14), pm, 3.2, yy, zz);
        } else if (v.pill === 'oblong') {
          p = put(bg, 'P04', new THREE.CapsuleGeometry(v.pr2, v.th, 4, 12), pm, 3.0, yy, zz);
          p.scale.set(1, 1, 0.55);
        } else {
          p = put(bg, 'P04', CY(v.pr2, v.th, 20), pm, 2.6, yy, zz);
          p.rotation.z = Math.PI / 2;
        }
        if (i === L.ACTIVE && r === 1 && c === 2) { rig.dome = dome; rig.pill = p; }
      }
    }
    if (i === L.ACTIVE) { rig.activeTray = tg; rig.activeBoard = bg; }
  }

  // ── P06 X 滑车（跨过板仓：后端推杆，前端 C 形工位）────────────────────────
  const car = new THREE.Group();
  car.position.set(slotX(L.ACTIVE), 0, 0);
  root.add(car);
  rig.car = car;
  const cg = (id, pos, exp) => grp(id, pos, exp, car);

  const beamG = cg('P06', new THREE.Vector3(0, 27, 112), new THREE.Vector3(0, -55, 0));
  put(beamG, 'P06', B(38, 14, 206), M.frame);
  put(beamG, 'P06', B(14, 76, 26), M.frame, 0, 54, -90);      // 后立柱
  put(beamG, 'P06', B(46, 8, 16), M.dark, 0, 2, 96);          // 皮带轮罩

  // P07 薄推杆 + 磁铁
  const pushG = cg('P07', new THREE.Vector3(0, L.TRAY_YC, L.PUSH_HOME), new THREE.Vector3(0, 0, -90));
  put(pushG, 'P07', B(1.6, 44, 74), M.steel, 0, 0, -37);
  const mag = put(pushG, 'P07', CY(4, 2.6, 18), M.magnet, 0, 0, -1.4);
  mag.rotation.x = Math.PI / 2;
  rig.push = pushG;

  // P08 C 形工位框：60 N 在这里闭合
  const yokeG = cg('P08', new THREE.Vector3(0, 0, L.STATION_Z), new THREE.Vector3(0, 0, 70));
  put(yokeG, 'P08', B(10, 76, 72), M.alu,  26, 72, 0);
  put(yokeG, 'P08', B(10, 76, 72), M.alu, -26, 72, 0);
  put(yokeG, 'P08', B(62, 10, 72), M.alu,   0, 115, 0);
  put(yokeG, 'P08', B(44, 8, 72), M.alu,    0, 30, 0);

  // P16/P17 双侧相机 + 漫射光源（仓口前，拍推出途中的托盘两面）
  rig.lamps = [];
  [1, -1].forEach(s => {
    const camG = cg('P16', new THREE.Vector3(s * 36, 98, 146), new THREE.Vector3(s * 80, 14, 0));
    put(camG, 'P16', B(13, 15, 15), M.dark);
    const lens = put(camG, 'P16', CY(3.4, 5, 16), M.steel, -s * 8, 0, 0);
    lens.rotation.z = Math.PI / 2;
    const lmpG = cg('P17', new THREE.Vector3(s * 31, 84, 152), new THREE.Vector3(s * 80, -16, 0));
    const ring = put(lmpG, 'P17', new THREE.TorusGeometry(9, 1.7, 10, 26), M.lamp);
    ring.rotation.y = Math.PI / 2; ring.castShadow = false;
    rig.lamps.push(ring);
  });

  // P09/P10/P11/P12 取药头 ×2 行（电磁选通，第 0 行是图中工作的那一行）
  rig.rows = [];
  L.ROW_Y.forEach((ry, k) => {
    const ringG = cg('P09', new THREE.Vector3(13, ry, L.STATION_Z), new THREE.Vector3(74, 10, 0));
    const cone = put(ringG, 'P09', new THREE.CylinderGeometry(11.5, 7.8, 8, 26, 1, true),
      new THREE.MeshStandardMaterial({ color:0xcdd4d9, roughness:0.3, metalness:0.9, side:THREE.DoubleSide }));
    cone.rotation.z = -Math.PI / 2;

    const punG = cg('P10', new THREE.Vector3(24, ry, L.STATION_Z), new THREE.Vector3(84, 10, 0));
    const rod = put(punG, 'P10', CY(3.8, 34, 18), M.steel, 10, 0, 0);
    rod.rotation.z = Math.PI / 2;
    put(punG, 'P10', new THREE.SphereGeometry(4.4, 18, 12), M.rubber, -9.5, 0, 0);
    put(punG, 'P10', B(18, 18, 18), M.dark, 34, 0, 0);         // 作动器

    // P12 马蹄支撑座：C 形，缺口朝下
    const hsG = cg('P12', new THREE.Vector3(-11, ry, L.STATION_Z), new THREE.Vector3(-80, 0, 0));
    const arc = put(hsG, 'P12', new THREE.TorusGeometry(7.6, 2.1, 12, 30, Math.PI * 1.45), M.white, 1.4, 0, 0);
    arc.rotation.y = Math.PI / 2;
    arc.geometry.rotateZ(-Math.PI * 0.225);
    put(hsG, 'P12', B(11, 7, 34), M.white, -7,  12, 0);         // 承力托架：上缘
    put(hsG, 'P12', B(11, 30, 7), M.white, -7, -2,  13.5);      // 两侧肋，接到 −X 臂
    put(hsG, 'P12', B(11, 30, 7), M.white, -7, -2, -13.5);      // 底边敞开 —— 药从这走

    rig.rows.push({ ring: ringG, punch: punG });
    if (k === 0) { rig.ring = ringG; rig.punch = punG; }
  });

  // P11 定深针（退回位，停在砧座外侧；只有力超 25 N 时才出来）
  const ndlG = cg('P11', new THREE.Vector3(-32, L.ROW_Y[1], L.STATION_Z), new THREE.Vector3(-86, -18, 0));
  const ndl = put(ndlG, 'P11', CY(0.9, 26, 10), M.magnet, -4, 0, 0);
  ndl.rotation.z = Math.PI / 2;
  const foot = put(ndlG, 'P11', CY(4.8, 4, 16), M.steel, 4, 0, 0);
  foot.rotation.z = Math.PI / 2;

  // P13 软挡板 + 斜底（与马蹄座同一个注塑件）
  const chuteG = cg('P13', new THREE.Vector3(-24, 0, L.STATION_Z), new THREE.Vector3(-86, -26, 0));
  put(chuteG, 'P13', B(2.6, 40, 42), M.rubber, 0, 74, 0);        // 软挡板：近且软
  const floor = put(chuteG, 'P13', B(34, 2.4, 38), M.white, -10, 50, 0);
  floor.rotation.z = 0.30;                                        // 斜底，往集料杯倒
  // 落料动画用的那粒药：跟着滑车走，所以挂在 chute 组里
  const fly = put(chuteG, 'P13', CY(4.6, 3.2, 20), M.pillA, 13, L.ROW_Y[0], 0);
  fly.rotation.z = Math.PI / 2; fly.visible = false;
  rig.fly = fly; rig.chute = chuteG;

  // P14 集料杯
  const cupG = cg('P14', new THREE.Vector3(-40, 40, 188), new THREE.Vector3(-86, -44, 0));
  put(cupG, 'P14', B(26, 2.4, 34), M.white, 0, -10, 0);
  put(cupG, 'P14', B(2, 22, 34), M.white,  12, 1, 0);
  put(cupG, 'P14', B(2, 22, 34), M.white, -12, 1, 0);
  put(cupG, 'P14', B(26, 22, 2), M.white, 0, 1,  16);
  put(cupG, 'P14', B(26, 22, 2), M.white, 0, 1, -16);
  rig.cup = cupG;

  // 投影开销：药板与隔板不投影，只让托盘框和机架投影
  ['P04', 'P02'].forEach(id => reg.get(id).meshes.forEach(m => { m.castShadow = false; }));

  return { root, reg, rig };
}

// ── 时序（《13》五）：一个连续时间轴，单位秒 ────────────────────────────────
const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
const seg = (t, a, b) => ease((t - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;

export function pose(rig, t) {
  // 0.0–1.7 选槽
  const park = slotX(L.SLOT_N - 1) + 6;
  rig.car.position.x = lerp(park, slotX(L.ACTIVE), seg(t, 0.15, 1.65));

  // 1.7–3.1 推出（推出行程本身就是列对位行程）
  const back = seg(t, 5.9, 7.1);
  const pz = lerp(lerp(L.PUSH_HOME, L.PUSH_END, seg(t, 1.75, 3.05)), L.PUSH_HOME, back);
  rig.push.userData.base.z = pz;
  const trayZ = L.STOW_Z + Math.max(0, pz - 41);
  rig.activeTray.userData.base.z = trayZ;

  // 2.3–2.8 频闪
  const flash = t > 2.3 && t < 2.8 ? (Math.sin((t - 2.3) * 62) * 0.5 + 0.5) : 0;
  rig.lamps.forEach(l => { l.material.emissiveIntensity = 0.55 + flash * 6.5; });

  // 3.1–4.7 压环落 + 顶杆加载；顶杆只走最后 4 mm，慢速
  const down = seg(t, 3.15, 3.6), load = seg(t, 3.7, 4.6), up = seg(t, 5.85, 6.5);
  const k = Math.max(0, down * (1 - up));
  const kl = Math.max(0, load * (1 - up));
  rig.ring.userData.base.x = lerp(13, 9.6, k);
  rig.punch.userData.base.x = lerp(24, 19.2, k) - kl * 5.2;
  // 泡窝塌陷：不可逆形变，所以归位时不恢复
  const collapse = seg(t, 3.8, 4.65);
  if (rig.dome) {
    rig.dome.scale.x = lerp(1, 0.18, collapse);
    rig.dome.position.x = lerp(0.5 + 7 / 2, 1.3, collapse);
  }
  if (rig.pill) {
    rig.pill.position.x = lerp(2.6, -1.4, collapse);
    rig.pill.visible = t < 4.68;
  }

  // 4.7–5.8 落料：撞软挡板 → 沿斜底滑进集料杯
  // 出膛（撞软挡板）→ 落到斜底 → 滑进集料杯
  const f = rig.fly;
  f.visible = t >= 4.66 && t < 7.2;
  if (f.visible) {
    const a = seg(t, 4.66, 4.88), b = seg(t, 4.88, 5.32), c = seg(t, 5.32, 5.82);
    const y0 = L.ROW_Y[0];
    f.position.x = c > 0 ? lerp(-2, -16, c) : lerp(lerp(13, 2.5, a), -2, b);
    f.position.y = c > 0 ? lerp(55, 34, c) : lerp(lerp(y0, y0 - 3, a), 55, b);
    f.rotation.x = b * 5 + c * 3;
  }
}
export const TOTAL = 8.2;
