import * as THREE from 'three';
import { PACKS } from './profiles.js';

// ── 尺度：1 世界单位 = 1 mm（《13》3.3 / 4.4 M1）────────────────────────────
export const L = {
  W: 380, H: 182, D: 250,
  SLOT_N: 20, PITCH: 17, SLOT_X0: 22,
  MAG_Z0: 42, MAG_DEPTH: 90,
  TRAY_Y0: 40, TRAY_H: 67, TRAY_L: 90,
  BOARD_Y: 57, BOARD_Z: 80,
  STOW_Z: 87, STATION_Z: 177,
  PUSH_HOME: 30, PUSH_END: 131,
};
L.TRAY_YC = L.TRAY_Y0 + L.TRAY_H / 2;              // 73.5
L.ROW_Y = [L.TRAY_YC + 14.25, L.TRAY_YC - 14.25];  // 2×5 板的两行
export const slotX = i => L.SLOT_X0 + i * L.PITCH;

// ── 材质 ───────────────────────────────────────────────────────────────────
const M = {};
function mats() {
  const std = (c, r, m, extra) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...extra });
  M.body   = std(0xdedad1, 0.56, 0.03);                       // 机身：暖骨白，不是纯白
  M.lid    = std(0xd5d1c8, 0.5, 0.04);                       // 装填盖，略深一档
  M.plinth = std(0x343b40, 0.46, 0.22);                       // 底座：石墨
  M.niche  = std(0x23292d, 0.72, 0.06);                       // 取药龛内衬
  M.trim   = std(0xa8adad, 0.28, 0.9);                        // 铝质饰条
  M.white  = std(0xf0f2f3, 0.62, 0.02);                       // 内部白模结构
  M.frame  = std(0xdfe3e5, 0.70, 0.04);
  M.alu    = std(0xb4bcc1, 0.34, 0.86);
  M.steel  = std(0xcdd4d9, 0.22, 0.92);
  M.dark   = std(0x3f484e, 0.44, 0.28);
  M.ink    = std(0x14181b, 0.55, 0.05);
  M.tray   = std(0xd5dade, 0.88, 0.02);
  M.divid  = new THREE.MeshStandardMaterial({ color: 0xeef2f3, roughness: 0.32, metalness: 0.02, transparent: true, opacity: 0.2, depthWrite: false });
  M.foil   = std(0xb6bec4, 0.14, 1.0);
  M.pvc    = new THREE.MeshStandardMaterial({ color: 0xcfdde4, roughness: 0.08, metalness: 0.0, transparent: true, opacity: 0.46 });
  M.iron   = std(0x8f989e, 0.40, 1.0);
  M.magnet = std(0xc98a2e, 0.38, 0.65);
  M.rubber = std(0x3c4348, 0.86, 0.02);
  M.cup    = new THREE.MeshStandardMaterial({ color: 0xdfe6ea, roughness: 0.12, metalness: 0.0, transparent: true, opacity: 0.5 });
  M.accent = std(0xb8402f, 0.52, 0.04);
  M.pillA  = std(0xf1eade, 0.70, 0.02);
  M.pillB  = std(0xdde3e6, 0.62, 0.02);
  M.pillC  = std(0xc98a2e, 0.50, 0.10);
  M.lamp   = new THREE.MeshStandardMaterial({ color: 0xfff6e6, emissive: 0xffd9a0, emissiveIntensity: 0.9, roughness: 0.4 });
  return M;
}

const B = (x, y, z) => new THREE.BoxGeometry(x, y, z);
const CY = (r, h, s = 20) => new THREE.CylinderGeometry(r, r, h, s);

// 圆角矩形挤出：XY 面画圆角矩形，沿 Z 挤 d。外观件全部用它，方盒子看着太糙
function slab(w, h, d, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  r = Math.min(r, w / 2 - 0.1, h / 2 - 0.1);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: d - 1.2, bevelEnabled: true, bevelSize: 0.6, bevelThickness: 0.6, bevelSegments: 2, curveSegments: 10 });
  g.translate(0, 0, -(d - 1.2) / 2);
  return g;
}

export function buildMachine(opts = {}) {
  const lite = !!opts.lite;      // landing 的 hero 用精简档：装饰性的，不需要全部零件
  mats();
  const root = new THREE.Group();
  const reg = new Map();
  const rig = { trays: [], boards: [] };

  const part = (id, exp) => {
    if (!reg.has(id)) reg.set(id, { groups: [], meshes: [], exp: exp || new THREE.Vector3() });
    return reg.get(id);
  };
  const grp = (id, pos, exp, parent) => {
    const p = part(id, exp);
    const g = new THREE.Group();
    g.position.copy(pos);
    g.userData.base = pos.clone();
    p.groups.push(g);
    (parent || root).add(g);
    return g;
  };
  const put = (g, id, geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    m.userData.part = id;
    g.add(m);
    part(id).meshes.push(m);
    return m;
  };

  // ── P01 外壳：底座 + 后板 + 侧板 + 顶盖 + 取药龛。前脸左 2/3 剖开 ──────────
  const shellG = grp('P01', new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 78, 0));
  put(shellG, 'P01', slab(366, 236, 16, 10), M.plinth, 190, 8, 125).rotation.x = -Math.PI / 2;   // 底座，四周内缩 7 → 阴影缝
  put(shellG, 'P01', slab(380, 156, 9, 6), M.body, 190, 94, 4.5);                                 // 后板
  [6, 374].forEach(x => {                                                                          // 左右侧板
    put(shellG, 'P01', slab(250, 156, 9, 6), M.body, x, 94, 125).rotation.y = Math.PI / 2;
  });
  put(shellG, 'P01', slab(386, 256, 11, 12), M.body, 190, 177, 125).rotation.x = -Math.PI / 2;     // 顶盖，悬挑 3
  put(shellG, 'P01', B(380, 1.6, 1.6), M.trim, 190, 170, 248.6);                                   // 前沿铝饰条

  // 取药龛：机器前脸右侧凹进去的一格，像饮水机的接水位
  const nicheG = grp('P15', new THREE.Vector3(306, 0, 0), new THREE.Vector3(0, 0, 92));
  // ⚠️ 龛的内衬必须整体缩进前脸开口里：任何一个面和外壳共面都会 z-fighting，
  //    转视角时那一片就会闪。下面每个尺寸都刻意错开 0.5–1 mm，不要"对齐"。
  put(nicheG, 'P15', B(108, 99, 6), M.niche, 0, 76, 217);         // 龛后壁（留出滑车的 z=200 行程）
  put(nicheG, 'P15', B(106, 6, 30), M.niche, 0, 122, 234);        // 龛顶
  put(nicheG, 'P15', B(5, 94, 30), M.niche, -51.5, 76, 234);      // 龛侧壁
  put(nicheG, 'P15', B(5, 94, 30), M.niche, 51.5, 76, 234);
  put(nicheG, 'P15', CY(7, 12, 20), M.trim, 0, 116, 231);         // 出药口
  put(nicheG, 'P15', B(100, 6, 30), M.trim, 0, 31, 234);          // 接药托（滴水盘）
  for (let i = -4; i <= 4; i++) put(nicheG, 'P15', B(3, 2.4, 24), M.niche, i * 10, 34.6, 234);      // 托上的格栅
  // 浅碟不是杯：药片最小 φ5 mm，手抖的老人从深杯里捏不出来（白皮书 3.1 / 4.1）
  const dishMat = M.cup.clone();
  dishMat.side = THREE.DoubleSide;
  dishMat.depthWrite = false;     // 双面开口薄壁 + 半透明：不关深度写入，自身正反面排序会跳
  const cup = put(nicheG, 'P15', new THREE.CylinderGeometry(23, 19, 11, 30, 1, true), dishMat, 0, 42.5, 234);
  put(nicheG, 'P15', CY(19, 2, 24), M.cup, 0, 37.5, 234);                                           // 碟底
  put(nicheG, 'P15', B(30, 2, 4), M.trim, 0, 38.8, 244);                                            // 前缘低口
  // 集料杯倒到出药口的滑道：贴着龛后壁，滑车够不到的那段由它接手
  put(nicheG, 'P15', B(26, 3, 26), M.trim, 0, 104, 206).rotation.x = -0.3;
  rig.cupProp = cup;
  // 龛四周的前脸
  put(shellG, 'P01', B(118, 46, 8), M.body, 309, 149, 246);
  put(shellG, 'P01', B(118, 14, 8), M.body, 309, 23, 246);
  put(shellG, 'P01', B(8, 96, 8), M.body, 254, 78, 246);
  put(shellG, 'P01', B(10, 96, 8), M.body, 363, 78, 246);
  rig.shell = shellG;

  // ── P20 装填盖：掀开才能插板 ───────────────────────────────────────────────
  const lidHinge = grp('P20', new THREE.Vector3(183, 183, 36), new THREE.Vector3(0, 60, 0));
  put(lidHinge, 'P20', slab(340, 104, 7, 8), M.lid, 0, 0, 54).rotation.x = -Math.PI / 2;
  put(lidHinge, 'P20', B(52, 4, 5), M.trim, 0, 2, 100);          // 指窝
  rig.lid = lidHinge;

  // ── P19 电池与主板 ───────────────────────────────────────────────────────
  const elecG = grp('P19', new THREE.Vector3(190, 22, 130), new THREE.Vector3(0, -80, 0));
  put(elecG, 'P19', B(316, 13, 136), M.frame);
  put(elecG, 'P19', B(86, 4, 56), M.dark, -92, 8.5, 0);
  put(elecG, 'P19', B(120, 9, 62), M.white, 74, 7, 0);

  // ── P18 钥匙锁芯 ─────────────────────────────────────────────────────────
  const lockG = grp('P18', new THREE.Vector3(150, 150, 248), new THREE.Vector3(0, 0, 80));
  put(lockG, 'P18', CY(7, 10, 18), M.trim).rotation.x = Math.PI / 2;

  // ── P02 隔板 ×21 ─────────────────────────────────────────────────────────
  for (let i = 0; i <= L.SLOT_N && !lite; i++) {
    const g = grp('P02', new THREE.Vector3(slotX(0) - 8.5 + i * L.PITCH, 74, L.STOW_Z), new THREE.Vector3(0, 0, -70));
    put(g, 'P02', B(1, 72, L.MAG_DEPTH), M.divid).castShadow = false;
  }

  // ── P05 弹片卡扣 ×20 ─────────────────────────────────────────────────────
  for (let i = 0; i < L.SLOT_N && !lite; i++) {
    const g = grp('P05', new THREE.Vector3(slotX(i) + 6.5, 42, L.MAG_Z0 + 6), new THREE.Vector3(0, -40, -40));
    put(g, 'P05', B(2.4, 5, 11), M.steel);
  }

  // ── P03 托盘 ×20（空仓时不可见，装载时才出现）────────────────────────────
  for (let i = 0; i < L.SLOT_N; i++) {
    const tg = grp('P03', new THREE.Vector3(slotX(i), L.TRAY_YC, L.STOW_Z), new THREE.Vector3(0, 40, 0));
    put(tg, 'P03', B(6, 5, L.TRAY_L), M.tray, 0, 31, 0);
    put(tg, 'P03', B(6, 5, L.TRAY_L), M.tray, 0, -31, 0);
    put(tg, 'P03', B(6, 57, 5), M.tray, 0, 0, 42.5);
    put(tg, 'P03', B(6, 57, 5), M.tray, 0, 0, -42.5);
    [[28, 39], [28, -39], [-28, 39]].forEach(([y, z]) => put(tg, 'P03', B(0.8, 5, 5), M.ink, 3.4, y, z));
    put(tg, 'P03', B(0.9, 8, 8), M.ink, 3.4, -28, -39);
    put(tg, 'P03', B(6, 18, 1.8), M.iron, 0, 0, -45.6);
    tg.visible = false;
    rig.trays.push(tg);
  }

  // ── 药板：装载方案换了就整批重建 ─────────────────────────────────────────
  const boardPart = part('P04', new THREE.Vector3(0, 0, 56));
  function clearBoards() {
    for (const g of rig.boards) { if (g) { g.parent && g.parent.remove(g); g.traverse(o => o.geometry && o.geometry.dispose()); } }
    rig.boards = [];
    boardPart.groups.length = 0;
    boardPart.meshes.length = 0;
  }
  function makeBoard(tg, packKey, eaten) {
    const v = PACKS[packKey];
    const bg = new THREE.Group();
    bg.position.set(0, 0, 0);
    bg.userData.base = new THREE.Vector3();
    boardPart.groups.push(bg);
    tg.add(bg);
    const push = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z); m.userData.part = 'P04';
      m.castShadow = false; m.receiveShadow = true;
      bg.add(m); boardPart.meshes.push(m); return m;
    };
    push(B(0.9, L.BOARD_Y, L.BOARD_Z), M.foil, -1.6, 0, 0);
    push(B(0.5, L.BOARD_Y, L.BOARD_Z), v.opaque ? M.foil : M.pvc, 0.3, 0, 0);
    const out = { dome: null, pill: null };
    let n = 0;
    for (let r = 0; r < v.rows; r++) for (let c = 0; c < v.cols; c++) {
      const yy = (r - (v.rows - 1) / 2) * (L.BOARD_Y / v.rows);
      const zz = (c - (v.cols - 1) / 2) * (L.BOARD_Z / v.cols);
      const gone = n++ < eaten;
      const domeMat = v.opaque ? M.foil : M.pvc;
      const dome = push(CY(v.pr, gone ? 1.6 : v.dh, 14), domeMat, gone ? 1.3 : 0.5 + v.dh / 2, yy, zz);
      dome.rotation.z = Math.PI / 2;
      if (gone) {
        push(new THREE.CircleGeometry(v.pr * 0.8, 7), M.ink, -2.2, yy, zz).rotation.y = -Math.PI / 2;
      } else if (!v.opaque) {
        const pm = M[v.pill];
        let p;
        if (v.kind === 'capsule') p = push(new THREE.CapsuleGeometry(v.pr2, v.th - v.pr2 * 2, 6, 12), pm, 3.2, yy, zz);
        else if (v.kind === 'oblong') { p = push(new THREE.CapsuleGeometry(v.pr2, v.th, 4, 10), pm, 3.0, yy, zz); p.scale.set(1, 1, 0.55); }
        else { p = push(CY(v.pr2, v.th, 16), pm, 2.6, yy, zz); p.rotation.z = Math.PI / 2; }
        if (r === v.rows - 1 && c === Math.floor(v.cols / 2)) { out.dome = dome; out.pill = p; }
      }
      if (gone && r === v.rows - 1 && c === Math.floor(v.cols / 2)) { out.dome = dome; }
    }
    return out;
  }

  // entries: [{ i, pack, eaten }]；不在表里的槽位保持空
  function setLoadout(entries) {
    clearBoards();
    rig.trays.forEach(t => { t.visible = false; });
    rig.dome = rig.pill = null;
    rig.active = -1;
    for (const e of entries) {
      const tg = rig.trays[e.i];
      if (!tg) continue;
      tg.visible = true;
      const o = makeBoard(tg, e.pack, e.eaten || 0);
      rig.boards[e.i] = tg.children[tg.children.length - 1];
      if (rig.active < 0 && o.pill) {
        rig.active = e.i;
        rig.activeTray = tg;
        rig.dome = o.dome; rig.pill = o.pill;
        rig.domeX0 = o.dome.position.x; rig.pillX0 = o.pill.position.x;
      }
    }
    if (rig.active < 0 && entries.length) { rig.active = entries[0].i; rig.activeTray = rig.trays[entries[0].i]; }
    if (rig.active < 0) { rig.active = 8; rig.activeTray = rig.trays[8]; }
    rig.activeTray.userData.base.z = L.STOW_Z;
  }
  rig.setLoadout = setLoadout;

  // ── P06 X 滑车 ───────────────────────────────────────────────────────────
  const car = new THREE.Group();
  car.position.set(slotX(11), 0, 0);
  root.add(car);
  rig.car = car;
  const cg = (id, pos, exp) => grp(id, pos, exp, car);

  const beamG = cg('P06', new THREE.Vector3(0, 30, 108), new THREE.Vector3(0, -55, 0));
  put(beamG, 'P06', B(38, 14, 198), M.frame);
  put(beamG, 'P06', B(12, 74, 20), M.frame, 0, 53, -92);
  put(beamG, 'P06', B(46, 8, 16), M.dark, 0, 2, 96);

  [16, 214].forEach(rz => {
    const g = grp('P06', new THREE.Vector3(L.W / 2, 28, rz), new THREE.Vector3(0, -40, 0));
    put(g, 'P06', CY(3, 358, 14), M.frame).rotation.z = Math.PI / 2;
  });

  const pushG = cg('P07', new THREE.Vector3(0, L.TRAY_YC, L.PUSH_HOME), new THREE.Vector3(0, 0, -90));
  put(pushG, 'P07', B(1.6, 44, 74), M.steel, 0, 0, -37);
  put(pushG, 'P07', CY(4, 2.6, 18), M.magnet, 0, 0, -1.4).rotation.x = Math.PI / 2;
  rig.push = pushG;

  const yokeG = cg('P08', new THREE.Vector3(0, 0, L.STATION_Z), new THREE.Vector3(0, 0, 70));
  put(yokeG, 'P08', B(10, 76, 46), M.alu, 26, 72, 0);
  put(yokeG, 'P08', B(10, 76, 46), M.alu, -26, 72, 0);
  put(yokeG, 'P08', B(62, 10, 46), M.alu, 0, 115, 0);
  put(yokeG, 'P08', B(44, 8, 46), M.alu, 0, 30, 0);

  rig.lamps = [];
  [1, -1].forEach(s => {
    const camG = cg('P16', new THREE.Vector3(s * 36, 98, 146), new THREE.Vector3(s * 80, 14, 0));
    put(camG, 'P16', B(13, 15, 15), M.dark);
    put(camG, 'P16', CY(3.4, 5, 16), M.steel, -s * 8, 0, 0).rotation.z = Math.PI / 2;
    const lmpG = cg('P17', new THREE.Vector3(s * 31, 84, 152), new THREE.Vector3(s * 80, -16, 0));
    const ring = put(lmpG, 'P17', new THREE.TorusGeometry(9, 1.7, 10, 26), M.lamp);
    ring.rotation.y = Math.PI / 2; ring.castShadow = false;
    rig.lamps.push(ring);
  });

  rig.rows = [];
  L.ROW_Y.forEach((ry, k) => {
    const ringG = cg('P09', new THREE.Vector3(13, ry, L.STATION_Z), new THREE.Vector3(74, 10, 0));
    put(ringG, 'P09', new THREE.CylinderGeometry(11.5, 7.8, 8, 26, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xcdd4d9, roughness: 0.3, metalness: 0.9, side: THREE.DoubleSide })
    ).rotation.z = -Math.PI / 2;

    const punG = cg('P10', new THREE.Vector3(24, ry, L.STATION_Z), new THREE.Vector3(84, 10, 0));
    put(punG, 'P10', CY(3.8, 34, 18), M.steel, 10, 0, 0).rotation.z = Math.PI / 2;
    put(punG, 'P10', new THREE.SphereGeometry(4.4, 18, 12), M.rubber, -9.5, 0, 0);
    put(punG, 'P10', B(18, 18, 18), M.dark, 34, 0, 0);

    const hsG = cg('P12', new THREE.Vector3(-11, ry, L.STATION_Z), new THREE.Vector3(-80, 0, 0));
    const arc = put(hsG, 'P12', new THREE.TorusGeometry(7.6, 2.1, 12, 30, Math.PI * 1.45), M.white, 1.4, 0, 0);
    arc.rotation.y = Math.PI / 2;
    arc.geometry.rotateZ(-Math.PI * 0.225);
    put(hsG, 'P12', B(11, 7, 34), M.white, -7, 12, 0);
    put(hsG, 'P12', B(11, 26, 6), M.white, -7, -2, 13);       // 侧肋比上缘窄，且不高于行距 28.5，免得两行互相插
    put(hsG, 'P12', B(11, 26, 6), M.white, -7, -2, -13);

    rig.rows.push({ ring: ringG, punch: punG });
    if (k === 0) { rig.ring = ringG; rig.punch = punG; }
  });

  if (!lite) {
    const ndlG = cg('P11', new THREE.Vector3(-32, L.ROW_Y[1], L.STATION_Z), new THREE.Vector3(-86, -18, 0));
    put(ndlG, 'P11', CY(0.9, 26, 10), M.magnet, -4, 0, 0).rotation.z = Math.PI / 2;
    put(ndlG, 'P11', CY(4.8, 4, 16), M.steel, 4, 0, 0).rotation.z = Math.PI / 2;
  }

  const chuteG = cg('P13', new THREE.Vector3(-24, 0, L.STATION_Z), new THREE.Vector3(-86, -26, 0));
  put(chuteG, 'P13', B(2.6, 40, 42), M.rubber, 0, 74, 0);
  put(chuteG, 'P13', B(34, 2.4, 38), M.white, -10, 50, 0).rotation.z = 0.30;
  const fly = put(chuteG, 'P13', new THREE.CapsuleGeometry(4.2, 9, 4, 12), M.pillC, 13, L.ROW_Y[0], 0);
  fly.scale.set(1, 1, 0.55); fly.visible = false;
  rig.fly = fly;

  const cupG = cg('P14', new THREE.Vector3(-40, 44, 188), new THREE.Vector3(-86, -44, 0));
  put(cupG, 'P14', B(23, 2.4, 27), M.white, 0, -10, 0);     // 杯底比四壁小一圈，端面不齐平
  put(cupG, 'P14', B(2, 22, 30), M.white, 12, 1, 0);          // 前后壁收到 ±15，让开左右壁的 ±17 端面
  put(cupG, 'P14', B(2, 22, 30), M.white, -12, 1, 0);
  put(cupG, 'P14', B(26, 22, 2), M.white, 0, 1, 16);
  put(cupG, 'P14', B(26, 22, 2), M.white, 0, 1, -16);
  rig.cup = cupG;

  ['P04', 'P02'].forEach(id => reg.has(id) && reg.get(id).meshes.forEach(m => { m.castShadow = false; }));
  return { root, reg, rig };
}

// ── 时序（《13》五）───────────────────────────────────────────────────────
const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
const seg = (t, a, b) => ease((t - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;

export function pose(rig, t) {
  if (!rig.activeTray) return;
  const park = slotX(L.SLOT_N - 1) + 6;
  rig.car.position.x = lerp(park, slotX(rig.active), seg(t, 0.15, 1.65));

  const back = seg(t, 5.9, 7.1);
  const pz = lerp(lerp(L.PUSH_HOME, L.PUSH_END, seg(t, 1.75, 3.05)), L.PUSH_HOME, back);
  rig.push.userData.base.z = pz;
  rig.activeTray.userData.base.z = L.STOW_Z + Math.max(0, pz - 41);

  const flash = t > 2.3 && t < 2.8 ? (Math.sin((t - 2.3) * 62) * 0.5 + 0.5) : 0;
  rig.lamps.forEach(l => { l.material.emissiveIntensity = 0.55 + flash * 6.5; });

  const down = seg(t, 3.15, 3.6), load = seg(t, 3.7, 4.6), up = seg(t, 5.85, 6.5);
  const k = Math.max(0, down * (1 - up)), kl = Math.max(0, load * (1 - up));
  rig.ring.userData.base.x = lerp(13, 9.6, k);
  rig.punch.userData.base.x = lerp(24, 19.2, k) - kl * 5.2;

  const collapse = seg(t, 3.8, 4.65);
  if (rig.dome) {
    rig.dome.scale.x = lerp(1, 0.18, collapse);
    rig.dome.position.x = lerp(rig.domeX0, 1.3, collapse);
  }
  if (rig.pill) {
    rig.pill.position.x = lerp(rig.pillX0, rig.pillX0 - 4.4, collapse);
    rig.pill.visible = t < 4.68;
  }

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

// ── 装填演示：掀盖 → 托盘从上方逐个落进槽位 ────────────────────────────────
export function poseLoad(rig, t, entries) {
  const open = Math.min(1, seg(t, 0, 0.5) + 0) * (1 - seg(t, 3.4, 4.0));
  rig.lid.rotation.x = -open * 1.15;
  const per = 0.16, span = 0.5;
  entries.forEach((e, k) => {
    const tg = rig.trays[e.i];
    if (!tg) return;
    const a = seg(t, 0.6 + k * per, 0.6 + k * per + span);
    tg.visible = a > 0;
    tg.userData.base.y = lerp(L.TRAY_YC + 92, L.TRAY_YC, a);
    tg.userData.base.z = L.STOW_Z;
  });
  return 0.6 + entries.length * per + span + 0.6;
}
export function resetTrays(rig, entries) {
  rig.lid.rotation.x = 0;
  entries.forEach(e => {
    const tg = rig.trays[e.i];
    if (tg) { tg.userData.base.y = L.TRAY_YC; tg.userData.base.z = L.STOW_Z; tg.visible = true; }
  });
}
