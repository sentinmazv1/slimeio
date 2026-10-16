const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const Matter = require('matter-js');

const { GAME_CONFIG } = require('../shared/constants');
const { checkBandCut, segmentCircleIntersect } = require('../shared/geometry');

const { Engine, World, Bodies, Body, Events } = Matter;

const app = express();
const server = http.createServer(app);

// Production-ready Socket.io yapılandırması (CORS + WebSocket öncelikli)
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling'],
  pingInterval: 10000,
  pingTimeout: 8000
});

// Canlı sunucu (Render / Railway / Cloudflare / VPS) sağlık kontrolü (Healthcheck)
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    game: 'Slime.io',
    uptime: Math.floor(process.uptime()),
    playersOnline: players.size
  });
});

app.use(express.static(path.join(__dirname, '../public')));
app.use('/shared', express.static(path.join(__dirname, '../shared')));
app.use('/vendor', express.static(path.join(__dirname, '../node_modules/matter-js/build')));

// --- SUNUCU FİZİK MOTORU KURULUMU ---
const engine = Engine.create();
engine.gravity.x = 0;
engine.gravity.y = 0;

// --- ZENGİN NEON AÇIK DÜNYA HARİTASI (55+ Parçalı Siper, Silindir, Kristal ve Koridor Duvarları) ---
const mapObstacles = [];

function generateOpenWorldMap() {
  const halfW = GAME_CONFIG.ARENA_WIDTH / 2;
  const halfH = GAME_CONFIG.ARENA_HEIGHT / 2;
  const t = GAME_CONFIG.WALL_THICKNESS;

  const outerWalls = [
    Bodies.rectangle(0, -halfH - t / 2, GAME_CONFIG.ARENA_WIDTH + t * 2, t, {
      isStatic: true,
      restitution: 0.9,
      label: 'WALL_OUTER_TOP'
    }),
    Bodies.rectangle(0, halfH + t / 2, GAME_CONFIG.ARENA_WIDTH + t * 2, t, {
      isStatic: true,
      restitution: 0.9,
      label: 'WALL_OUTER_BOTTOM'
    }),
    Bodies.rectangle(-halfW - t / 2, 0, t, GAME_CONFIG.ARENA_HEIGHT + t * 2, {
      isStatic: true,
      restitution: 0.9,
      label: 'WALL_OUTER_LEFT'
    }),
    Bodies.rectangle(halfW + t / 2, 0, t, GAME_CONFIG.ARENA_HEIGHT + t * 2, {
      isStatic: true,
      restitution: 0.9,
      label: 'WALL_OUTER_RIGHT'
    })
  ];
  World.add(engine.world, outerWalls);

  // 5 Farklı Neon Bölgesi + Ufak/Orta/Büyük Silindirler, Köşeli Siperler, Üçgen/Beşgen/Altıgen Kristaller
  const layout = [
    // === 1. MERKEZ ENERJİ ÇEKİRDEĞİ (Neon Cyan #00F5D4) ===
    { id: 'c_core', type: 'circle', x: 0, y: 0, radius: 110, color: '#00F5D4' },
    { id: 'c_s1', type: 'rect', x: -340, y: -230, w: 210, h: 36, angle: -0.58, color: '#00BBF9' },
    { id: 'c_s2', type: 'rect', x: 340, y: -230, w: 210, h: 36, angle: 0.58, color: '#00BBF9' },
    { id: 'c_s3', type: 'rect', x: -340, y: 230, w: 210, h: 36, angle: 0.58, color: '#00BBF9' },
    { id: 'c_s4', type: 'rect', x: 340, y: 230, w: 210, h: 36, angle: -0.58, color: '#00BBF9' },
    { id: 'c_p1', type: 'circle', x: -460, y: 0, radius: 38, color: '#00F5D4' },
    { id: 'c_p2', type: 'circle', x: 460, y: 0, radius: 38, color: '#00F5D4' },
    { id: 'c_p3', type: 'circle', x: 0, y: -390, radius: 38, color: '#00F5D4' },
    { id: 'c_p4', type: 'circle', x: 0, y: 390, radius: 38, color: '#00F5D4' },

    // === 2. KUZEY-BATI KRİSTAL LABİRENTİ (Neon Magenta #FF2A85) ===
    { id: 'nw_hex1', type: 'polygon', x: -1150, y: -680, sides: 6, radius: 115, angle: 0.2, color: '#FF2A85' },
    { id: 'nw_pent1', type: 'polygon', x: -1680, y: -920, sides: 5, radius: 90, angle: 0.5, color: '#FF70A6' },
    { id: 'nw_tri1', type: 'polygon', x: -1950, y: -480, sides: 3, radius: 85, angle: 0.3, color: '#FF2A85' },
    { id: 'nw_wall1', type: 'rect', x: -1450, y: -420, w: 260, h: 42, angle: 0.35, color: '#FF2A85' },
    { id: 'nw_wall2', type: 'rect', x: -820, y: -980, w: 280, h: 44, angle: -0.22, color: '#FF70A6' },
    { id: 'nw_cyl1', type: 'circle', x: -1380, y: -1120, radius: 52, color: '#FF2A85' },
    { id: 'nw_cyl2', type: 'circle', x: -740, y: -540, radius: 44, color: '#FF70A6' },
    { id: 'nw_cyl3', type: 'circle', x: -1980, y: -1120, radius: 68, color: '#FF2A85' },

    // === 3. KUZEY-DOĞU SİBER KORİDORLARI (Neon Purple #9B5DE5) ===
    { id: 'ne_hex1', type: 'polygon', x: 1150, y: -680, sides: 6, radius: 115, angle: -0.2, color: '#9B5DE5' },
    { id: 'ne_wall1', type: 'rect', x: 1560, y: -780, w: 320, h: 46, angle: -0.4, color: '#C77DFF' },
    { id: 'ne_wall2', type: 'rect', x: 1620, y: -360, w: 260, h: 44, angle: 0.25, color: '#9B5DE5' },
    { id: 'ne_wall3', type: 'rect', x: 780, y: -1020, w: 290, h: 44, angle: 0.18, color: '#C77DFF' },
    { id: 'ne_tri1', type: 'polygon', x: 2020, y: -1050, sides: 3, radius: 95, angle: -0.4, color: '#9B5DE5' },
    { id: 'ne_pent1', type: 'polygon', x: 1920, y: -560, sides: 5, radius: 78, angle: 0.1, color: '#C77DFF' },
    { id: 'ne_cyl1', type: 'circle', x: 760, y: -480, radius: 48, color: '#9B5DE5' },
    { id: 'ne_cyl2', type: 'circle', x: 1320, y: -1150, radius: 56, color: '#C77DFF' },

    // === 4. GÜNEY-BATI PLAZMA SİLİNDİRLERİ (Neon Emerald #00F59B) ===
    { id: 'sw_big', type: 'circle', x: -1200, y: 660, radius: 125, color: '#00F59B' },
    { id: 'sw_med1', type: 'circle', x: -1720, y: 480, radius: 82, color: '#38E54D' },
    { id: 'sw_med2', type: 'circle', x: -1580, y: 1020, radius: 76, color: '#00F59B' },
    { id: 'sw_sm1', type: 'circle', x: -820, y: 460, radius: 42, color: '#38E54D' },
    { id: 'sw_sm2', type: 'circle', x: -880, y: 960, radius: 48, color: '#00F59B' },
    { id: 'sw_sm3', type: 'circle', x: -2020, y: 840, radius: 55, color: '#38E54D' },
    { id: 'sw_wall1', type: 'rect', x: -1950, y: 260, w: 50, h: 280, angle: 0.2, color: '#00F59B' },
    { id: 'sw_wall2', type: 'rect', x: -1220, y: 1180, w: 280, h: 44, angle: -0.12, color: '#38E54D' },

    // === 5. GÜNEY-DOĞU ALTIN PRİZMA BÖLGESİ (Neon Gold/Orange #FFB800) ===
    { id: 'se_pent1', type: 'polygon', x: 1180, y: 680, sides: 5, radius: 115, angle: 0.35, color: '#FFB800' },
    { id: 'se_tri1', type: 'polygon', x: 1680, y: 460, sides: 3, radius: 92, angle: 0.8, color: '#FF7844' },
    { id: 'se_tri2', type: 'polygon', x: 1640, y: 980, sides: 3, radius: 88, angle: -0.6, color: '#FFB800' },
    { id: 'se_hex1', type: 'polygon', x: 2020, y: 720, sides: 6, radius: 82, angle: 0.2, color: '#FF7844' },
    { id: 'se_wall1', type: 'rect', x: 820, y: 980, w: 290, h: 44, angle: 0.25, color: '#FFB800' },
    { id: 'se_wall2', type: 'rect', x: 1380, y: 280, w: 240, h: 42, angle: -0.35, color: '#FF7844' },
    { id: 'se_cyl1', type: 'circle', x: 760, y: 480, radius: 46, color: '#FFB800' },
    { id: 'se_cyl2', type: 'circle', x: 1960, y: 1160, radius: 58, color: '#FF7844' },

    // === 6. ARA KORİDOR GEÇİŞ ADALARI (Doğu-Batı & Kuzey-Güney Köprüleri) ===
    { id: 'mid_w1', type: 'circle', x: -1020, y: 0, radius: 88, color: '#00BBF9' },
    { id: 'mid_w2', type: 'rect', x: -1580, y: -60, w: 52, h: 260, angle: -0.18, color: '#00F5D4' },
    { id: 'mid_w3', type: 'circle', x: -2050, y: -80, radius: 50, color: '#00BBF9' },

    { id: 'mid_e1', type: 'circle', x: 1020, y: 0, radius: 88, color: '#00BBF9' },
    { id: 'mid_e2', type: 'rect', x: 1580, y: 60, w: 52, h: 260, angle: -0.18, color: '#00F5D4' },
    { id: 'mid_e3', type: 'circle', x: 2050, y: 80, radius: 50, color: '#00BBF9' },

    { id: 'mid_n1', type: 'polygon', x: 0, y: -820, sides: 6, radius: 86, angle: 0.4, color: '#00F5D4' },
    { id: 'mid_n2', type: 'circle', x: -340, y: -1120, radius: 46, color: '#00BBF9' },
    { id: 'mid_n3', type: 'circle', x: 340, y: -1120, radius: 46, color: '#00BBF9' },

    { id: 'mid_s1', type: 'polygon', x: 0, y: 820, sides: 6, radius: 86, angle: -0.4, color: '#00F5D4' },
    { id: 'mid_s2', type: 'circle', x: -340, y: 1120, radius: 46, color: '#00BBF9' },
    { id: 'mid_s3', type: 'circle', x: 340, y: 1120, radius: 46, color: '#00BBF9' }
  ];

  for (const item of layout) {
    let body = null;
    if (item.type === 'circle') {
      body = Bodies.circle(item.x, item.y, item.radius, {
        isStatic: true,
        restitution: 0.9,
        label: `OBSTACLE_${item.id}`
      });
    } else if (item.type === 'rect') {
      body = Bodies.rectangle(item.x, item.y, item.w, item.h, {
        isStatic: true,
        angle: item.angle || 0,
        restitution: 0.9,
        label: `OBSTACLE_${item.id}`
      });
    } else if (item.type === 'polygon') {
      body = Bodies.polygon(item.x, item.y, item.sides, item.radius, {
        isStatic: true,
        angle: item.angle || 0,
        restitution: 0.9,
        label: `OBSTACLE_${item.id}`
      });
    }

    if (body) {
      World.add(engine.world, body);
      const serialized = {
        ...item,
        vertices: body.vertices.map((v) => ({ x: Math.round(v.x * 10) / 10, y: Math.round(v.y * 10) / 10 }))
      };
      mapObstacles.push(serialized);
    }
  }
}
generateOpenWorldMap();

// --- OYUN DURUMU (STATE) ---
const players = new Map();
const arrows = [];
let nextBandId = 1;
let nextArrowId = 1;
let botCounter = 1;
let matchEndTime = Date.now() + GAME_CONFIG.MATCH_DURATION_SEC * 1000;
let isMatchOver = false;

const SLIME_PALETTE = [
  '#00F5D4', '#FF2A85', '#38E54D', '#00BBF9',
  '#FFB800', '#9B5DE5', '#FF6B00', '#00F59B'
];

const BOT_NAMES = [
  'NeonSlime', 'ZıpZıp', 'VantuzKing', 'CyberJöle',
  'KemerAvcısı', 'Plazma', 'Boncuk', 'Elastik'
];

function snapToNearestWallOrObstacle(x, y) {
  const halfW = GAME_CONFIG.ARENA_WIDTH / 2;
  const halfH = GAME_CONFIG.ARENA_HEIGHT / 2;
  const cx = Math.max(-halfW + 40, Math.min(halfW - 40, x || 0));
  const cy = Math.max(-halfH + 40, Math.min(halfH - 40, y || 0));

  let bestPoint = null;
  let bestDist = Infinity;

  for (const obs of mapObstacles) {
    const dx = cx - obs.x;
    const dy = cy - obs.y;
    const distToCenter = Math.hypot(dx, dy) || 1;
    const approxR = obs.radius || Math.max(obs.w || 60, obs.h || 60) * 0.5;
    const surfaceDist = Math.abs(distToCenter - approxR);

    if (surfaceDist < bestDist) {
      bestDist = surfaceDist;
      const nx = dx / distToCenter;
      const ny = dy / distToCenter;
      bestPoint = {
        anchorX: obs.x + nx * approxR,
        anchorY: obs.y + ny * approxR,
        spawnX: obs.x + nx * (approxR + GAME_CONFIG.PLAYER_RADIUS + 18),
        spawnY: obs.y + ny * (approxR + GAME_CONFIG.PLAYER_RADIUS + 18),
        vx: nx * GAME_CONFIG.WALL_BOUNCE_SPEED,
        vy: ny * GAME_CONFIG.WALL_BOUNCE_SPEED
      };
    }
  }

  const dTop = Math.abs(cy - (-halfH));
  const dBottom = Math.abs(cy - halfH);
  const dLeft = Math.abs(cx - (-halfW));
  const dRight = Math.abs(cx - halfW);

  if (dTop < bestDist) {
    bestDist = dTop;
    bestPoint = {
      anchorX: cx,
      anchorY: -halfH,
      spawnX: cx,
      spawnY: -halfH + GAME_CONFIG.PLAYER_RADIUS + 18,
      vx: 0,
      vy: GAME_CONFIG.WALL_BOUNCE_SPEED
    };
  }
  if (dBottom < bestDist) {
    bestDist = dBottom;
    bestPoint = {
      anchorX: cx,
      anchorY: halfH,
      spawnX: cx,
      spawnY: halfH - GAME_CONFIG.PLAYER_RADIUS - 18,
      vx: 0,
      vy: -GAME_CONFIG.WALL_BOUNCE_SPEED
    };
  }
  if (dLeft < bestDist) {
    bestDist = dLeft;
    bestPoint = {
      anchorX: -halfW,
      anchorY: cy,
      spawnX: -halfW + GAME_CONFIG.PLAYER_RADIUS + 18,
      spawnY: cy,
      vx: GAME_CONFIG.WALL_BOUNCE_SPEED,
      vy: 0
    };
  }
  if (dRight < bestDist) {
    bestPoint = {
      anchorX: halfW,
      anchorY: cy,
      spawnX: halfW - GAME_CONFIG.PLAYER_RADIUS - 18,
      spawnY: cy,
      vx: -GAME_CONFIG.WALL_BOUNCE_SPEED,
      vy: 0
    };
  }

  return bestPoint;
}

function clearPlayerPhysics(player) {
  if (!player) return;
  player.bands = [];
  if (player.body) {
    World.remove(engine.world, player.body);
    player.body = null;
  }
}

function spawnPlayerAtWallPoint(player, rawX, rawY) {
  clearPlayerPhysics(player);

  const wallInfo = snapToNearestWallOrObstacle(rawX, rawY);
  const body = Bodies.circle(wallInfo.spawnX, wallInfo.spawnY, GAME_CONFIG.PLAYER_RADIUS, {
    mass: GAME_CONFIG.PLAYER_MASS,
    frictionAir: GAME_CONFIG.PLAYER_FRICTION_AIR,
    restitution: GAME_CONFIG.PLAYER_RESTITUTION,
    label: `PLAYER_${player.id}`
  });

  Body.setVelocity(body, { x: wallInfo.vx, y: wallInfo.vy });
  World.add(engine.world, body);

  const bandData = {
    id: nextBandId++,
    anchorX: Math.round(wallInfo.anchorX),
    anchorY: Math.round(wallInfo.anchorY)
  };

  player.body = body;
  player.prevPos = { x: wallInfo.spawnX, y: wallInfo.spawnY };
  player.bands = [bandData];
  player.hasHadBands = true;
  player.alive = true;
  player.waitingForWall = false;
  player.lastBandTime = Date.now();

  io.emit('bandAttached', {
    playerId: player.id,
    band: bandData
  });
}

function spawnBotAtRandomWall(bot) {
  const obs = mapObstacles[Math.floor(Math.random() * mapObstacles.length)];
  const angle = Math.random() * Math.PI * 2;
  const rx = obs ? obs.x + Math.cos(angle) * 120 : 0;
  const ry = obs ? obs.y + Math.sin(angle) * 120 : 0;
  spawnPlayerAtWallPoint(bot, rx, ry);
}

function addScore(player, amount, reason, worldX, worldY) {
  if (!player) return;
  player.score += amount;
  io.emit('scorePopup', {
    playerId: player.id,
    amount,
    reason,
    x: Math.round(worldX ?? (player.body ? player.body.position.x : 0)),
    y: Math.round(worldY ?? (player.body ? player.body.position.y : 0))
  });
}

function killPlayer(victim, killerId = null) {
  if (!victim.alive) return;
  victim.alive = false;
  victim.waitingForWall = false;
  victim.respawnAt = Date.now() + GAME_CONFIG.RESPAWN_DELAY_MS;

  const deathPos = victim.body
    ? { x: victim.body.position.x, y: victim.body.position.y }
    : { x: 0, y: 0 };

  const killer = killerId ? players.get(killerId) : null;
  if (killer && killer.id !== victim.id) {
    killer.kills += 1;
    addScore(killer, GAME_CONFIG.SCORE_PER_KILL, 'ELEME!', deathPos.x, deathPos.y);
  }

  victim.score = Math.floor(victim.score * 0.75);
  clearPlayerPhysics(victim);

  io.emit('playerDied', {
    victimId: victim.id,
    victimName: victim.name,
    killerId,
    killerName: killer ? killer.name : null,
    x: Math.round(deathPos.x),
    y: Math.round(deathPos.y),
    respawnDelay: GAME_CONFIG.RESPAWN_DELAY_MS
  });
}

function handleWallOrObstacleCollision(player, otherBody, pair) {
  if (!player.body) return;

  const px = player.body.position.x;
  const py = player.body.position.y;

  let contactX = px;
  let contactY = py;

  if (pair && pair.activeContacts && pair.activeContacts.length > 0) {
    const v = pair.activeContacts[0].vertex;
    contactX = v.x;
    contactY = v.y;
  } else {
    contactX = otherBody.position.x;
    contactY = otherBody.position.y;
  }

  const dx = px - contactX;
  const dy = py - contactY;
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len;
  const ny = dy / len;

  Body.setVelocity(player.body, {
    x: nx * GAME_CONFIG.WALL_BOUNCE_SPEED,
    y: ny * GAME_CONFIG.WALL_BOUNCE_SPEED
  });

  if (player.bands.length >= GAME_CONFIG.MAX_BANDS) return;

  const now = Date.now();
  if (now - player.lastBandTime < GAME_CONFIG.BAND_COOLDOWN_MS) return;

  for (const b of player.bands) {
    const bdx = b.anchorX - contactX;
    const bdy = b.anchorY - contactY;
    if (bdx * bdx + bdy * bdy < GAME_CONFIG.MIN_ANCHOR_DISTANCE * GAME_CONFIG.MIN_ANCHOR_DISTANCE) {
      return;
    }
  }

  const bandData = {
    id: nextBandId++,
    anchorX: Math.round(contactX),
    anchorY: Math.round(contactY)
  };

  player.bands.push(bandData);
  player.hasHadBands = true;
  player.lastBandTime = now;

  addScore(player, GAME_CONFIG.SCORE_PER_BELT_ATTACH, 'KEMER (+1 OK)!', contactX, contactY);

  io.emit('bandAttached', {
    playerId: player.id,
    band: bandData
  });
}

function shootSlimeArrow(player, targetWorldX, targetWorldY) {
  if (!player || !player.alive || !player.body) return;

  if (player.bands.length <= 1) {
    io.to(player.id).emit('noSlimeAmmo');
    return;
  }

  const now = Date.now();
  if (now - (player.lastArrowTime || 0) < GAME_CONFIG.ARROW_COOLDOWN_MS) return;
  player.lastArrowTime = now;

  const consumedBand = player.bands.shift();

  const px = player.body.position.x;
  const py = player.body.position.y;
  const dx = targetWorldX - px;
  const dy = targetWorldY - py;
  const len = Math.hypot(dx, dy) || 1;
  const dirX = dx / len;
  const dirY = dy / len;

  const spawnX = px + dirX * (GAME_CONFIG.PLAYER_RADIUS + 10);
  const spawnY = py + dirY * (GAME_CONFIG.PLAYER_RADIUS + 10);

  const arrow = {
    id: nextArrowId++,
    ownerId: player.id,
    color: player.color,
    x: spawnX,
    y: spawnY,
    prevX: px,
    prevY: py,
    vx: dirX * GAME_CONFIG.ARROW_SPEED,
    vy: dirY * GAME_CONFIG.ARROW_SPEED,
    createdAt: now
  };

  arrows.push(arrow);

  io.emit('arrowShot', {
    arrowId: arrow.id,
    playerId: player.id,
    consumedBandId: consumedBand ? consumedBand.id : null,
    x: Math.round(spawnX),
    y: Math.round(spawnY)
  });
}

function cutOwnBeltInDirection(player, targetWorldX, targetWorldY) {
  if (!player || !player.alive || !player.body) return;

  if (player.bands.length <= 1) {
    io.to(player.id).emit('cannotCutLastBelt');
    return;
  }

  const px = player.body.position.x;
  const py = player.body.position.y;
  const lookAngle = Math.atan2(targetWorldY - py, targetWorldX - px);

  let bestIdx = -1;
  let smallestAngleDiff = Infinity;

  for (let i = 0; i < player.bands.length; i++) {
    const b = player.bands[i];
    const beltAngle = Math.atan2(b.anchorY - py, b.anchorX - px);
    const diff = Math.abs(Math.atan2(Math.sin(lookAngle - beltAngle), Math.cos(lookAngle - beltAngle)));
    if (diff < smallestAngleDiff) {
      smallestAngleDiff = diff;
      bestIdx = i;
    }
  }

  if (bestIdx !== -1 && smallestAngleDiff <= Math.PI * 0.65) {
    const removed = player.bands.splice(bestIdx, 1)[0];
    const snapX = Math.round(px + (removed.anchorX - px) * 0.35);
    const snapY = Math.round(py + (removed.anchorY - py) * 0.35);

    io.emit('bandSnapped', {
      ownerId: player.id,
      cutterId: player.id,
      bandId: removed.id,
      snapX,
      snapY
    });
  }
}

// --- YAPAY ZEKA (BOT) YÖNETİMİ ---
function createBot() {
  const id = `bot_${botCounter++}`;
  const color = SLIME_PALETTE[players.size % SLIME_PALETTE.length];
  const name = `[BOT] ${BOT_NAMES[(botCounter - 2) % BOT_NAMES.length]}`;

  const bot = {
    id,
    name,
    color,
    isBot: true,
    alive: false,
    waitingForWall: false,
    body: null,
    prevPos: { x: 0, y: 0 },
    bands: [],
    hasHadBands: true,
    lastBandTime: 0,
    lastArrowTime: 0,
    respawnAt: 0,
    score: 0,
    cuts: 0,
    kills: 0,
    aiNextDecision: 0,
    input: { targetX: 0, targetY: 0 }
  };

  spawnBotAtRandomWall(bot);
  players.set(id, bot);
  return bot;
}

function removeOneBot() {
  for (const [id, p] of players.entries()) {
    if (p.isBot) {
      clearPlayerPhysics(p);
      players.delete(id);
      return true;
    }
  }
  return false;
}

function updateBotAI(bot, now) {
  if (!bot.alive || !bot.body) return;
  if (now < bot.aiNextDecision) return;

  bot.aiNextDecision = now + 420 + Math.random() * 420;
  const bx = bot.body.position.x;
  const by = bot.body.position.y;

  // Botun 3+ kemeri varsa menzildeki rakiplere Slime Oku atsın
  if (bot.bands.length >= 3 && Math.random() < 0.45) {
    let nearestEnemy = null;
    let minDist = 950;
    for (const other of players.values()) {
      if (other.id === bot.id || !other.alive || !other.body) continue;
      const d = Math.hypot(other.body.position.x - bx, other.body.position.y - by);
      if (d < minDist) {
        minDist = d;
        nearestEnemy = other;
      }
    }
    if (nearestEnemy) {
      shootSlimeArrow(bot, nearestEnemy.body.position.x, nearestEnemy.body.position.y);
    }
  }

  // Yakındaki engellerden kemer/cephane topla
  if (bot.bands.length < 5 || Math.random() < 0.6) {
    let bestObs = null;
    let bestScore = Infinity;
    for (let k = 0; k < 6; k++) {
      const candidate = mapObstacles[Math.floor(Math.random() * mapObstacles.length)];
      if (!candidate) continue;
      const d = Math.hypot(candidate.x - bx, candidate.y - by);
      if (d > 140 && d < bestScore) {
        bestScore = d;
        bestObs = candidate;
      }
    }
    if (bestObs) {
      bot.input.targetX = bestObs.x;
      bot.input.targetY = bestObs.y;
      return;
    }
  }

  for (const other of players.values()) {
    if (other.id === bot.id || !other.alive || !other.body || other.bands.length === 0) continue;
    const band = other.bands[0];
    bot.input.targetX = (band.anchorX + other.body.position.x) * 0.5;
    bot.input.targetY = (band.anchorY + other.body.position.y) * 0.5;
    return;
  }
}

for (let i = 0; i < 5; i++) {
  createBot();
}

Events.on(engine, 'collisionStart', (event) => {
  if (isMatchOver) return;

  for (const pair of event.pairs) {
    let playerBody = null;
    let wallBody = null;

    const labelA = pair.bodyA.label || '';
    const labelB = pair.bodyB.label || '';

    if ((labelA.startsWith('WALL_') || labelA.startsWith('OBSTACLE_')) && labelB.startsWith('PLAYER_')) {
      wallBody = pair.bodyA;
      playerBody = pair.bodyB;
    } else if ((labelB.startsWith('WALL_') || labelB.startsWith('OBSTACLE_')) && labelA.startsWith('PLAYER_')) {
      wallBody = pair.bodyB;
      playerBody = pair.bodyA;
    }

    if (wallBody && playerBody) {
      const playerId = playerBody.label.replace('PLAYER_', '');
      const player = players.get(playerId);
      if (player && player.alive) {
        handleWallOrObstacleCollision(player, wallBody, pair);
      }
    }
  }
});

// Bir noktanın dışbükey çokgen (engel) içinde olup olmadığını kontrol eder
function isPointInPolygon(px, py, vertices) {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const xi = vertices[i].x, yi = vertices[i].y;
    const xj = vertices[j].x, yj = vertices[j].y;
    const intersect = ((yi > py) !== (yj > py)) && (px < ((xj - xi) * (py - yi)) / (yj - yi + 0.00001) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Slime Okunun (prevX, prevY) -> (x, y) hareketi boyunca herhangi bir iç engele (silindir, uzun duvar, çokgen) çarpıp çarpmadığını kesin olarak bulur
function checkArrowHitsAnyObstacle(prevX, prevY, x, y, radius) {
  for (const obs of mapObstacles) {
    if (obs.type === 'circle') {
      const hit = segmentCircleIntersect(prevX, prevY, x, y, obs.x, obs.y, obs.radius + radius);
      if (hit) return hit;
    } else if (obs.vertices && obs.vertices.length >= 3) {
      // Hızlı AABB ön elemesi
      const maxDim = Math.max(obs.w || 0, obs.h || 0, (obs.radius || 100) * 2) * 0.65 + radius + 30;
      const minSegX = Math.min(prevX, x) - maxDim;
      const maxSegX = Math.max(prevX, x) + maxDim;
      const minSegY = Math.min(prevY, y) - maxDim;
      const maxSegY = Math.max(prevY, y) + maxDim;
      if (obs.x < minSegX || obs.x > maxSegX || obs.y < minSegY || obs.y > maxSegY) {
        continue;
      }

      // 1) Çokgenin her bir kenar çizgisi (edge) ile okun süpürülmüş hareket vektörünü kesiştir
      const verts = obs.vertices;
      for (let k = 0; k < verts.length; k++) {
        const v1 = verts[k];
        const v2 = verts[(k + 1) % verts.length];
        const edgeHit = checkBandCut(v1.x, v1.y, v2.x, v2.y, prevX, prevY, x, y, radius);
        if (edgeHit) {
          return edgeHit;
        }
      }

      // 2) Okun yeni konumu doğrudan çokgenin içine girdiyse
      if (isPointInPolygon(x, y, verts)) {
        return { x, y };
      }
    }
  }
  return null;
}

function updateArrows(now) {
  const halfW = GAME_CONFIG.ARENA_WIDTH / 2;
  const halfH = GAME_CONFIG.ARENA_HEIGHT / 2;

  for (let i = arrows.length - 1; i >= 0; i--) {
    const arrow = arrows[i];

    if (now - arrow.createdAt > GAME_CONFIG.ARROW_LIFETIME_MS) {
      arrows.splice(i, 1);
      continue;
    }

    arrow.prevX = arrow.x;
    arrow.prevY = arrow.y;
    arrow.x += arrow.vx;
    arrow.y += arrow.vy;

    // 1) Dış duvarlara çarptı mı?
    if (Math.abs(arrow.x) >= halfW || Math.abs(arrow.y) >= halfH) {
      io.emit('arrowSplat', { x: Math.round(arrow.x), y: Math.round(arrow.y), color: arrow.color });
      arrows.splice(i, 1);
      continue;
    }

    // 2) Haritadaki parça duvarlardan (silindir, dikdörtgen siper, üçgen/beşgen/altıgen kaya) birine çarptı mı?
    // Çarptıysa ok ANINDA patlar ve engelin arkasındaki hiçbir kemeri/oyuncuyu vuramaz!
    const obsHit = checkArrowHitsAnyObstacle(
      arrow.prevX,
      arrow.prevY,
      arrow.x,
      arrow.y,
      GAME_CONFIG.ARROW_RADIUS
    );
    if (obsHit) {
      io.emit('arrowSplat', {
        x: Math.round(obsHit.x),
        y: Math.round(obsHit.y),
        color: arrow.color
      });
      arrows.splice(i, 1);
      continue;
    }

    const shooter = players.get(arrow.ownerId);
    let consumedArrow = false;

    for (const owner of players.values()) {
      if (owner.id === arrow.ownerId || !owner.alive || !owner.body || owner.bands.length === 0) continue;

      const ox = owner.body.position.x;
      const oy = owner.body.position.y;

      for (let k = owner.bands.length - 1; k >= 0; k--) {
        const band = owner.bands[k];
        const hit = checkBandCut(
          band.anchorX,
          band.anchorY,
          ox,
          oy,
          arrow.prevX,
          arrow.prevY,
          arrow.x,
          arrow.y,
          GAME_CONFIG.ARROW_RADIUS + 4
        );

        if (hit) {
          owner.bands.splice(k, 1);
          if (shooter) {
            shooter.cuts += 1;
            addScore(shooter, GAME_CONFIG.SCORE_PER_BELT_CUT, 'OKLA KESTİ!', hit.x, hit.y);
          }

          io.emit('bandSnapped', {
            ownerId: owner.id,
            cutterId: arrow.ownerId,
            bandId: band.id,
            snapX: Math.round(hit.x),
            snapY: Math.round(hit.y)
          });

          if (owner.bands.length === 0) {
            killPlayer(owner, arrow.ownerId);
            break;
          }
        }
      }

      if (owner.alive && owner.body) {
        const bodyHit = segmentCircleIntersect(
          arrow.prevX,
          arrow.prevY,
          arrow.x,
          arrow.y,
          owner.body.position.x,
          owner.body.position.y,
          GAME_CONFIG.PLAYER_RADIUS + GAME_CONFIG.ARROW_RADIUS
        );

        if (bodyHit) {
          Body.setVelocity(owner.body, {
            x: owner.body.velocity.x + arrow.vx * 0.45,
            y: owner.body.velocity.y + arrow.vy * 0.45
          });

          if (owner.bands.length > 0) {
            const popped = owner.bands.pop();
            io.emit('bandSnapped', {
              ownerId: owner.id,
              cutterId: arrow.ownerId,
              bandId: popped.id,
              snapX: Math.round(owner.body.position.x),
              snapY: Math.round(owner.body.position.y)
            });
          }

          if (shooter) {
            shooter.cuts += 1;
            addScore(shooter, GAME_CONFIG.SCORE_PER_ARROW_HIT, 'TAM İSABET!', bodyHit.x, bodyHit.y);
          }

          io.emit('arrowSplat', { x: Math.round(bodyHit.x), y: Math.round(bodyHit.y), color: arrow.color });

          if (owner.bands.length === 0) {
            killPlayer(owner, arrow.ownerId);
          }

          arrows.splice(i, 1);
          consumedArrow = true;
          break;
        }
      }
    }

    if (consumedArrow) continue;
  }
}

function processBandIntersections() {
  const alivePlayers = [];
  for (const p of players.values()) {
    if (p.alive && p.body) alivePlayers.push(p);
  }

  for (let i = 0; i < alivePlayers.length; i++) {
    const cutter = alivePlayers[i];
    if (!cutter.alive || !cutter.body) continue;

    const cx = cutter.body.position.x;
    const cy = cutter.body.position.y;
    const prevX = cutter.prevPos.x;
    const prevY = cutter.prevPos.y;

    for (let j = 0; j < alivePlayers.length; j++) {
      if (i === j) continue;
      const owner = alivePlayers[j];
      if (!owner.alive || !owner.body || owner.bands.length === 0) continue;

      const ox = owner.body.position.x;
      const oy = owner.body.position.y;

      for (let k = owner.bands.length - 1; k >= 0; k--) {
        const band = owner.bands[k];
        const hit = checkBandCut(
          band.anchorX,
          band.anchorY,
          ox,
          oy,
          prevX,
          prevY,
          cx,
          cy,
          GAME_CONFIG.PLAYER_RADIUS
        );

        if (hit) {
          owner.bands.splice(k, 1);

          cutter.cuts += 1;
          addScore(cutter, GAME_CONFIG.SCORE_PER_BELT_CUT, 'KESİM!', hit.x, hit.y);

          io.emit('bandSnapped', {
            ownerId: owner.id,
            cutterId: cutter.id,
            bandId: band.id,
            snapX: Math.round(hit.x),
            snapY: Math.round(hit.y)
          });

          if (owner.bands.length === 0) {
            killPlayer(owner, cutter.id);
            break;
          }
        }
      }
    }
  }
}

setInterval(() => {
  if (isMatchOver) return;
  for (const p of players.values()) {
    if (p.alive && p.bands.length > 0) {
      p.score += p.bands.length * GAME_CONFIG.SCORE_HOLD_PER_BELT_SEC;
    }
  }
}, 1000);

const dt = 1000 / GAME_CONFIG.TICK_RATE;
setInterval(() => {
  const now = Date.now();

  if (!isMatchOver && now >= matchEndTime) {
    triggerMatchEnd();
    return;
  }

  for (const p of players.values()) {
    if (!p.alive) {
      if (!p.waitingForWall && now >= p.respawnAt) {
        if (p.isBot) {
          spawnBotAtRandomWall(p);
          io.emit('playerRespawned', { id: p.id });
        } else {
          p.waitingForWall = true;
        }
      }
      continue;
    }

    if (p.isBot) {
      updateBotAI(p, now);
    }

    if (p.body) {
      p.prevPos.x = p.body.position.x;
      p.prevPos.y = p.body.position.y;

      const dx = p.input.targetX - p.body.position.x;
      const dy = p.input.targetY - p.body.position.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 4) {
        const throttle = Math.min(dist / GAME_CONFIG.MAX_INPUT_DIST, 1.0);
        const fx = (dx / dist) * GAME_CONFIG.BASE_MOVE_FORCE * throttle;
        const fy = (dy / dist) * GAME_CONFIG.BASE_MOVE_FORCE * throttle;
        Body.applyForce(p.body, p.body.position, { x: fx, y: fy });
      }

      for (const b of p.bands) {
        const tx = b.anchorX - p.body.position.x;
        const ty = b.anchorY - p.body.position.y;
        const tDist = Math.hypot(tx, ty) || 1;
        const pullMag = Math.min(
          tDist * GAME_CONFIG.TETHER_PULL_STRENGTH,
          GAME_CONFIG.MAX_TETHER_FORCE_PER_BAND
        );
        Body.applyForce(p.body, p.body.position, {
          x: (tx / tDist) * pullMag,
          y: (ty / tDist) * pullMag
        });
      }
    }
  }

  Engine.update(engine, dt);

  if (!isMatchOver) {
    updateArrows(now);
    processBandIntersections();
  }
}, dt);

let matchRestartTimer = null;

function startNewMatch() {
  if (matchRestartTimer) {
    clearTimeout(matchRestartTimer);
    matchRestartTimer = null;
  }
  arrows.length = 0;
  matchEndTime = Date.now() + GAME_CONFIG.MATCH_DURATION_SEC * 1000;
  isMatchOver = false;
  for (const p of players.values()) {
    p.score = 0;
    p.cuts = 0;
    p.kills = 0;
    clearPlayerPhysics(p);
    if (p.isBot) {
      spawnBotAtRandomWall(p);
    } else {
      p.alive = false;
      p.waitingForWall = true;
      p.respawnAt = 0;
    }
  }
  io.emit('matchRestarted', { matchEndTime });
}

function triggerMatchEnd() {
  if (isMatchOver) return;
  isMatchOver = true;

  const standings = [...players.values()]
    .map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      bandsCount: p.bands.length,
      cuts: p.cuts || 0,
      kills: p.kills || 0,
      score: p.score || 0
    }))
    .sort((a, b) => b.score - a.score || b.bandsCount - a.bandsCount || b.cuts - a.cuts);

  const winner = standings[0] || { name: 'Kimse', score: 0, bandsCount: 0 };
  const nextMatchIn = 10000;

  io.emit('matchEnded', {
    winnerName: winner.name,
    winnerColor: winner.color || '#00F5D4',
    winnerScore: winner.score,
    winnerBands: winner.bandsCount,
    standings,
    nextMatchIn
  });

  matchRestartTimer = setTimeout(() => {
    startNewMatch();
  }, nextMatchIn);
}

// --- AĞ SENKRONİZASYONU DÖNGÜSÜ (30 Hz) ---
setInterval(() => {
  const snapshot = [];
  let humanCount = 0;
  for (const p of players.values()) {
    if (!p.isBot) humanCount++;
    snapshot.push({
      id: p.id,
      name: p.name,
      color: p.color,
      alive: p.alive,
      waitingForWall: Boolean(p.waitingForWall),
      score: p.score,
      cuts: p.cuts,
      kills: p.kills,
      respawnRemaining: p.alive || p.waitingForWall ? 0 : Math.max(0, p.respawnAt - Date.now()),
      x: p.body ? Math.round(p.body.position.x * 10) / 10 : 0,
      y: p.body ? Math.round(p.body.position.y * 10) / 10 : 0,
      vx: p.body ? Math.round(p.body.velocity.x * 100) / 100 : 0,
      vy: p.body ? Math.round(p.body.velocity.y * 100) / 100 : 0,
      bands: p.bands.map((b) => ({
        id: b.id,
        anchorX: b.anchorX,
        anchorY: b.anchorY
      }))
    });
  }

  const activeArrows = arrows.map((a) => ({
    id: a.id,
    ownerId: a.ownerId,
    color: a.color,
    x: Math.round(a.x),
    y: Math.round(a.y),
    vx: Math.round(a.vx * 10) / 10,
    vy: Math.round(a.vy * 10) / 10
  }));

  io.emit('stateUpdate', {
    isMatchOver,
    onlineCount: players.size,
    humanCount,
    remainingSec: isMatchOver ? 0 : Math.max(0, Math.ceil((matchEndTime - Date.now()) / 1000)),
    players: snapshot,
    arrows: activeArrows
  });
}, 1000 / GAME_CONFIG.NETWORK_RATE);

// --- SOCKET.IO BAĞLANTI YÖNETİMİ ---
io.on('connection', (socket) => {
  const color = SLIME_PALETTE[players.size % SLIME_PALETTE.length];

  const player = {
    id: socket.id,
    name: `Slime_${socket.id.substring(0, 4)}`,
    color,
    isBot: false,
    alive: false,
    waitingForWall: true,
    body: null,
    prevPos: { x: 0, y: 0 },
    bands: [],
    hasHadBands: false,
    lastBandTime: 0,
    lastArrowTime: 0,
    respawnAt: 0,
    score: 0,
    cuts: 0,
    kills: 0,
    input: { targetX: 0, targetY: 0 }
  };

  players.set(socket.id, player);

  socket.emit('init', {
    selfId: socket.id,
    config: GAME_CONFIG,
    obstacles: mapObstacles
  });

  // Canlı gecikme (Ping) ölçümü
  socket.on('pingCheck', (clientTime, ack) => {
    if (typeof ack === 'function') ack(clientTime);
  });

  socket.on('spawnAtWall', (point) => {
    if (player.waitingForWall && point && typeof point.x === 'number' && typeof point.y === 'number') {
      spawnPlayerAtWallPoint(player, point.x, point.y);
    }
  });

  socket.on('shootArrow', (target) => {
    if (target && typeof target.x === 'number' && typeof target.y === 'number') {
      shootSlimeArrow(player, target.x, target.y);
    }
  });

  socket.on('setName', (name) => {
    if (typeof name === 'string' && name.trim().length > 0) {
      player.name = name.trim().substring(0, 14);
    }
  });

  socket.on('addBot', () => {
    if (players.size < 18) createBot();
  });

  socket.on('removeBot', () => {
    removeOneBot();
  });

  socket.on('endMatchNow', () => {
    triggerMatchEnd();
  });

  socket.on('restartMatchNow', () => {
    startNewMatch();
  });

  socket.on('cutOwnBelt', (target) => {
    if (target && typeof target.x === 'number' && typeof target.y === 'number') {
      cutOwnBeltInDirection(player, target.x, target.y);
    }
  });

  socket.on('mouseMove', (target) => {
    if (target && typeof target.x === 'number' && typeof target.y === 'number') {
      player.input.targetX = target.x;
      player.input.targetY = target.y;
    }
  });

  socket.on('disconnect', () => {
    clearPlayerPhysics(player);
    players.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`[Slime.io] Online Sunucu Aktif: http://${HOST}:${PORT}`);
});
