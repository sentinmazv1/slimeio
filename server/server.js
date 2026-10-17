const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const Matter = require('matter-js');

const {
  GAME_CONFIG,
  SLIME_COLORS,
  BASIC_10_SKINS,
  GAME_MODES,
  TEAMS
} = require('../shared/constants');
const { checkBandCut, segmentCircleIntersect } = require('../shared/geometry');
const userStore = require('./userStore');

const { Engine, World, Bodies, Body, Events } = Matter;

const app = express();
app.use(express.json());
const server = http.createServer(app);

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'slimeadmin2026';

// Production-ready Socket.io yapılandırması
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling'],
  pingInterval: 10000,
  pingTimeout: 8000
});

// Admin sayfası yönlendirmesi (/admin)
app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

app.use(express.static(path.join(__dirname, '../public')));
app.use('/shared', express.static(path.join(__dirname, '../shared')));
app.use('/vendor', express.static(path.join(__dirname, '../node_modules/matter-js/build')));

// --- HARİTA DÜZENİ (55+ Parçalı Siper, Silindir, Kristal ve Koridor Duvarları) ---
const MAP_LAYOUT = [
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

  // === 6. ARA KORİDOR GEÇİŞ ADALARI ===
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

let sharedMapObstacles = [];

function buildPhysicsWorldForRoom(engine) {
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

  const obstacles = [];
  for (const item of MAP_LAYOUT) {
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
      obstacles.push({
        ...item,
        vertices: body.vertices.map((v) => ({
          x: Math.round(v.x * 10) / 10,
          y: Math.round(v.y * 10) / 10
        }))
      });
    }
  }
  if (sharedMapObstacles.length === 0) {
    sharedMapObstacles = obstacles;
  }
}

// --- GLOBAL DURUM ---
const rooms = new Map();
const connectedSockets = new Map(); // socketId -> socket
const usernameToSocketId = new Map(); // username -> socketId
const adminSockets = new Set(); // admin yetkili socketId'ler

let nextBandId = 1;
let nextArrowId = 1;
let botCounter = 1;

const BOT_NAMES = [
  'NeonSlime', 'ZıpZıp', 'VantuzKing', 'CyberJöle',
  'KemerAvcısı', 'Plazma', 'Boncuk', 'Elastik',
  'TosunPaşa', 'KüçükEnişte', 'LütfüBey', 'Suphi'
];

// --- ODA OLUŞTURMA ---
function createRoom(modeConfig) {
  const engine = Engine.create();
  engine.gravity.x = 0;
  engine.gravity.y = 0;
  buildPhysicsWorldForRoom(engine);

  const room = {
    id: modeConfig.id,
    name: modeConfig.name,
    shortName: modeConfig.shortName,
    isTeam: Boolean(modeConfig.isTeam),
    teamSize: modeConfig.teamSize || 0,
    maxPlayers: modeConfig.maxPlayers || 40,
    allowGuest: Boolean(modeConfig.allowGuest),
    engine,
    players: new Map(),
    arrows: [],
    status: modeConfig.isTeam ? 'waiting_for_teams' : 'playing', // 'waiting_for_teams' | 'starting_countdown' | 'playing' | 'match_over'
    countdownEndTime: 0,
    matchEndTime: Date.now() + GAME_CONFIG.MATCH_DURATION_SEC * 1000,
    matchStartTime: Date.now(),
    matchRestartTimer: null
  };

  Events.on(engine, 'collisionStart', (event) => {
    if (room.status !== 'playing') return;

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
        const player = room.players.get(playerId);
        if (player && player.alive) {
          handleWallOrObstacleCollision(room, player, wallBody, pair);
        }
      }
    }
  });

  rooms.set(room.id, room);
  return room;
}

for (const mode of GAME_MODES) {
  createRoom(mode);
}

// --- YARDIMCI FİZİK & DUVAR FONKSİYONLARI ---
function snapToNearestWallOrObstacle(x, y) {
  const halfW = GAME_CONFIG.ARENA_WIDTH / 2;
  const halfH = GAME_CONFIG.ARENA_HEIGHT / 2;
  const cx = Math.max(-halfW + 40, Math.min(halfW - 40, x || 0));
  const cy = Math.max(-halfH + 40, Math.min(halfH - 40, y || 0));

  let bestPoint = null;
  let bestDist = Infinity;

  for (const obs of sharedMapObstacles) {
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

function clearPlayerPhysics(room, player) {
  if (!player) return;
  player.bands = [];
  if (player.body && room && room.engine) {
    World.remove(room.engine.world, player.body);
    player.body = null;
  }
}

function spawnPlayerAtWallPoint(room, player, rawX, rawY) {
  if (!room || !player || room.status !== 'playing') return;
  clearPlayerPhysics(room, player);

  const wallInfo = snapToNearestWallOrObstacle(rawX, rawY);
  const body = Bodies.circle(wallInfo.spawnX, wallInfo.spawnY, GAME_CONFIG.PLAYER_RADIUS, {
    mass: GAME_CONFIG.PLAYER_MASS,
    frictionAir: GAME_CONFIG.PLAYER_FRICTION_AIR,
    restitution: GAME_CONFIG.PLAYER_RESTITUTION,
    label: `PLAYER_${player.id}`
  });

  Body.setVelocity(body, { x: wallInfo.vx, y: wallInfo.vy });
  World.add(room.engine.world, body);

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
  player.spectating = false;
  player.lastBandTime = Date.now();

  io.to(room.id).emit('bandAttached', {
    playerId: player.id,
    band: bandData
  });
}

function spawnBotAtRandomWall(room, bot) {
  if (!room || room.status !== 'playing') return;
  let rx = 0;
  let ry = 0;
  if (room.isTeam) {
    // Seferoğulları batı yakasından, Tellioğulları doğu yakasından başlasın
    const sideX = bot.team === 'seferogullari' ? -1400 : 1400;
    rx = sideX + (Math.random() - 0.5) * 600;
    ry = (Math.random() - 0.5) * 1600;
  } else {
    const obs = sharedMapObstacles[Math.floor(Math.random() * sharedMapObstacles.length)];
    const angle = Math.random() * Math.PI * 2;
    rx = obs ? obs.x + Math.cos(angle) * 120 : 0;
    ry = obs ? obs.y + Math.sin(angle) * 120 : 0;
  }
  spawnPlayerAtWallPoint(room, bot, rx, ry);
}

function addScore(room, player, amount, reason, worldX, worldY) {
  if (!player) return;
  player.score += amount;
  io.to(room.id).emit('scorePopup', {
    playerId: player.id,
    amount,
    reason,
    x: Math.round(worldX ?? (player.body ? player.body.position.x : 0)),
    y: Math.round(worldY ?? (player.body ? player.body.position.y : 0))
  });
}

function killPlayer(room, victim, killerId = null) {
  if (!victim.alive) return;
  victim.alive = false;
  victim.waitingForWall = false;
  victim.respawnAt = Date.now() + GAME_CONFIG.RESPAWN_DELAY_MS;

  const deathPos = victim.body
    ? { x: victim.body.position.x, y: victim.body.position.y }
    : { x: 0, y: 0 };

  const killer = killerId ? room.players.get(killerId) : null;
  if (killer && killer.id !== victim.id) {
    killer.kills += 1;
    addScore(room, killer, GAME_CONFIG.SCORE_PER_KILL, 'ELEME!', deathPos.x, deathPos.y);
  }

  victim.score = Math.floor(victim.score * 0.75);
  clearPlayerPhysics(room, victim);

  io.to(room.id).emit('playerDied', {
    victimId: victim.id,
    victimName: victim.name,
    killerId,
    killerName: killer ? killer.name : null,
    x: Math.round(deathPos.x),
    y: Math.round(deathPos.y),
    respawnDelay: GAME_CONFIG.RESPAWN_DELAY_MS
  });
}

function handleWallOrObstacleCollision(room, player, otherBody, pair) {
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

  addScore(room, player, GAME_CONFIG.SCORE_PER_BELT_ATTACH, 'KEMER (+1 OK)!', contactX, contactY);

  io.to(room.id).emit('bandAttached', {
    playerId: player.id,
    band: bandData
  });
}

function shootSlimeArrow(room, player, targetWorldX, targetWorldY) {
  if (!room || room.status !== 'playing' || !player || !player.alive || !player.body) return;

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
    team: player.team || null,
    color: player.color,
    x: spawnX,
    y: spawnY,
    prevX: px,
    prevY: py,
    vx: dirX * GAME_CONFIG.ARROW_SPEED,
    vy: dirY * GAME_CONFIG.ARROW_SPEED,
    createdAt: now
  };

  room.arrows.push(arrow);

  io.to(room.id).emit('arrowShot', {
    arrowId: arrow.id,
    playerId: player.id,
    consumedBandId: consumedBand ? consumedBand.id : null,
    x: Math.round(spawnX),
    y: Math.round(spawnY)
  });
}

function cutOwnBeltInDirection(room, player, targetWorldX, targetWorldY) {
  if (!room || room.status !== 'playing' || !player || !player.alive || !player.body) return;

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

    io.to(room.id).emit('bandSnapped', {
      ownerId: player.id,
      cutterId: player.id,
      bandId: removed.id,
      snapX,
      snapY
    });
  }
}

// --- TAKIM ODASI KONTROLÜ (Seferoğulları vs Tellioğulları) ---
function getTeamCounts(room) {
  let seferCount = 0;
  let telliCount = 0;
  for (const p of room.players.values()) {
    if (p.team === 'seferogullari') seferCount++;
    else if (p.team === 'telliogullari') telliCount++;
  }
  return { seferCount, telliCount };
}

function checkTeamRoomReady(room) {
  if (!room || !room.isTeam) return;
  if (room.status !== 'waiting_for_teams') return;

  const { seferCount, telliCount } = getTeamCounts(room);
  if (seferCount >= room.teamSize && telliCount >= room.teamSize) {
    room.status = 'starting_countdown';
    room.countdownEndTime = Date.now() + GAME_CONFIG.TEAM_START_COUNTDOWN_SEC * 1000;
    io.to(room.id).emit('teamMatchCountdown', {
      seconds: GAME_CONFIG.TEAM_START_COUNTDOWN_SEC,
      message: `⚔️ TAKIMLAR DOLDU! Seferoğulları (${seferCount}) vs Tellioğulları (${telliCount}) Savaşı Başlıyor!`
    });
  }
}

// --- YAPAY ZEKA (BOT) YÖNETİMİ ---
function createBotInRoom(room, options = {}) {
  if (!room) return null;

  let assignedTeam = options.team || null;
  if (room.isTeam) {
    const { seferCount, telliCount } = getTeamCounts(room);
    if (assignedTeam !== 'seferogullari' && assignedTeam !== 'telliogullari') {
      if (seferCount < room.teamSize && seferCount <= telliCount) {
        assignedTeam = 'seferogullari';
      } else if (telliCount < room.teamSize) {
        assignedTeam = 'telliogullari';
      } else {
        assignedTeam = seferCount <= telliCount ? 'seferogullari' : 'telliogullari';
      }
    }
  }

  const id = `bot_${botCounter++}`;
  const defaultColor = assignedTeam
    ? TEAMS[assignedTeam].color
    : SLIME_COLORS[room.players.size % SLIME_COLORS.length].id;
  const color = options.color || defaultColor;
  const skin = options.skin || BASIC_10_SKINS[botCounter % BASIC_10_SKINS.length].id;
  const customName = options.name && String(options.name).trim()
    ? String(options.name).trim().substring(0, 16)
    : `[BOT] ${BOT_NAMES[(botCounter - 2) % BOT_NAMES.length]}`;

  const bot = {
    id,
    roomId: room.id,
    name: customName,
    username: null,
    color,
    skin,
    team: assignedTeam,
    isBot: true,
    isGuest: false,
    alive: false,
    waitingForWall: false,
    spectating: false,
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

  room.players.set(id, bot);

  if (room.status === 'playing') {
    spawnBotAtRandomWall(room, bot);
  } else if (room.isTeam && room.status === 'waiting_for_teams') {
    checkTeamRoomReady(room);
  }

  return bot;
}

function removeBotFromRoom(room, botId = null) {
  if (!room) return false;
  if (botId && room.players.has(botId)) {
    const b = room.players.get(botId);
    if (b && b.isBot) {
      clearPlayerPhysics(room, b);
      room.players.delete(botId);
      return true;
    }
  }
  for (const [id, p] of room.players.entries()) {
    if (p.isBot) {
      clearPlayerPhysics(room, p);
      room.players.delete(id);
      return true;
    }
  }
  return false;
}

function updateBotAI(room, bot, now) {
  if (!bot.alive || !bot.body) return;
  if (now < bot.aiNextDecision) return;

  bot.aiNextDecision = now + 420 + Math.random() * 420;
  const bx = bot.body.position.x;
  const by = bot.body.position.y;

  // Botun 3+ kemeri varsa menzildeki DÜŞMANLARA Slime Oku atsın (Takım arkadaşını vurmaz!)
  if (bot.bands.length >= 3 && Math.random() < 0.45) {
    let nearestEnemy = null;
    let minDist = 950;
    for (const other of room.players.values()) {
      if (other.id === bot.id || !other.alive || !other.body) continue;
      if (room.isTeam && bot.team && other.team === bot.team) continue; // Dost ateşi kapalı!
      const d = Math.hypot(other.body.position.x - bx, other.body.position.y - by);
      if (d < minDist) {
        minDist = d;
        nearestEnemy = other;
      }
    }
    if (nearestEnemy) {
      shootSlimeArrow(room, bot, nearestEnemy.body.position.x, nearestEnemy.body.position.y);
    }
  }

  // Yakındaki engellerden kemer/cephane topla
  if (bot.bands.length < 5 || Math.random() < 0.6) {
    let bestObs = null;
    let bestScore = Infinity;
    for (let k = 0; k < 6; k++) {
      const candidate = sharedMapObstacles[Math.floor(Math.random() * sharedMapObstacles.length)];
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

  for (const other of room.players.values()) {
    if (other.id === bot.id || !other.alive || !other.body || other.bands.length === 0) continue;
    if (room.isTeam && bot.team && other.team === bot.team) continue; // Dost kemerini kesmeye gitmez!
    const band = other.bands[0];
    bot.input.targetX = (band.anchorX + other.body.position.x) * 0.5;
    bot.input.targetY = (band.anchorY + other.body.position.y) * 0.5;
    return;
  }
}

function exportAllRoomsBotConfig() {
  const result = {};
  for (const [roomId, room] of rooms.entries()) {
    const bots = [];
    for (const p of room.players.values()) {
      if (p.isBot) {
        bots.push({
          name: p.name,
          team: p.team || null,
          color: p.color,
          skin: p.skin || 'crown'
        });
      }
    }
    result[roomId] = bots;
  }
  return result;
}

function persistCurrentAdminBotSettings() {
  return userStore.saveAdminSettings(exportAllRoomsBotConfig());
}

function applySavedBotConfigToRooms(roomBotsMap) {
  if (!roomBotsMap || typeof roomBotsMap !== 'object') return;
  for (const [roomId, room] of rooms.entries()) {
    // Mevcut botları temizle
    for (const [pid, p] of [...room.players.entries()]) {
      if (p.isBot) {
        clearPlayerPhysics(room, p);
        room.players.delete(pid);
      }
    }
    const desiredBots = Array.isArray(roomBotsMap[roomId]) ? roomBotsMap[roomId] : [];
    for (const bConf of desiredBots) {
      createBotInRoom(room, {
        name: bConf.name,
        team: bConf.team,
        color: bConf.color,
        skin: bConf.skin
      });
    }
  }
}

// Sunucu açılışında kaydedilmiş admin bot ayarları varsa yükle, yoksa FFA'ya varsayılan 5 bot ekle
const initialAdminSettings = userStore.getAdminSettings();
if (initialAdminSettings && initialAdminSettings.initialized && initialAdminSettings.roomBots) {
  applySavedBotConfigToRooms(initialAdminSettings.roomBots);
} else {
  const ffaRoom = rooms.get('ffa');
  for (let i = 0; i < 5; i++) {
    createBotInRoom(ffaRoom);
  }
}

// Supabase Bulut Veritabanından üyeleri ve bot/oda ayarlarını senkronize et
userStore.initCloudStore().then((cloudState) => {
  if (cloudState && cloudState.adminSettings && cloudState.adminSettings.initialized && cloudState.adminSettings.roomBots) {
    applySavedBotConfigToRooms(cloudState.adminSettings.roomBots);
  } else {
    persistCurrentAdminBotSettings();
  }
}).catch((err) => {
  console.error('[Server] Supabase başlangıç senkronizasyonu hatası:', err.message);
});

// --- ENGEL & OK ÇARPIŞMASI ---
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

function checkArrowHitsAnyObstacle(prevX, prevY, x, y, radius) {
  for (const obs of sharedMapObstacles) {
    if (obs.type === 'circle') {
      const hit = segmentCircleIntersect(prevX, prevY, x, y, obs.x, obs.y, obs.radius + radius);
      if (hit) return hit;
    } else if (obs.vertices && obs.vertices.length >= 3) {
      const maxDim = Math.max(obs.w || 0, obs.h || 0, (obs.radius || 100) * 2) * 0.65 + radius + 30;
      const minSegX = Math.min(prevX, x) - maxDim;
      const maxSegX = Math.max(prevX, x) + maxDim;
      const minSegY = Math.min(prevY, y) - maxDim;
      const maxSegY = Math.max(prevY, y) + maxDim;
      if (obs.x < minSegX || obs.x > maxSegX || obs.y < minSegY || obs.y > maxSegY) {
        continue;
      }

      const verts = obs.vertices;
      for (let k = 0; k < verts.length; k++) {
        const v1 = verts[k];
        const v2 = verts[(k + 1) % verts.length];
        const edgeHit = checkBandCut(v1.x, v1.y, v2.x, v2.y, prevX, prevY, x, y, radius);
        if (edgeHit) return edgeHit;
      }

      if (isPointInPolygon(x, y, verts)) {
        return { x, y };
      }
    }
  }
  return null;
}

function updateRoomArrows(room, now) {
  const halfW = GAME_CONFIG.ARENA_WIDTH / 2;
  const halfH = GAME_CONFIG.ARENA_HEIGHT / 2;
  const arrows = room.arrows;

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

    if (Math.abs(arrow.x) >= halfW || Math.abs(arrow.y) >= halfH) {
      io.to(room.id).emit('arrowSplat', { x: Math.round(arrow.x), y: Math.round(arrow.y), color: arrow.color });
      arrows.splice(i, 1);
      continue;
    }

    const obsHit = checkArrowHitsAnyObstacle(
      arrow.prevX,
      arrow.prevY,
      arrow.x,
      arrow.y,
      GAME_CONFIG.ARROW_RADIUS
    );
    if (obsHit) {
      io.to(room.id).emit('arrowSplat', {
        x: Math.round(obsHit.x),
        y: Math.round(obsHit.y),
        color: arrow.color
      });
      arrows.splice(i, 1);
      continue;
    }

    const shooter = room.players.get(arrow.ownerId);
    let consumedArrow = false;

    for (const owner of room.players.values()) {
      if (owner.id === arrow.ownerId || !owner.alive || !owner.body || owner.bands.length === 0) continue;

      // TAKIM OYUNLARINDA DOST ATEŞİ KAPALI! Dostunu vuramaz ve kemerini kesemez.
      if (room.isTeam && arrow.team && owner.team === arrow.team) continue;

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
            addScore(room, shooter, GAME_CONFIG.SCORE_PER_BELT_CUT, 'OKLA KESTİ!', hit.x, hit.y);
          }

          io.to(room.id).emit('bandSnapped', {
            ownerId: owner.id,
            cutterId: arrow.ownerId,
            bandId: band.id,
            snapX: Math.round(hit.x),
            snapY: Math.round(hit.y)
          });

          if (owner.bands.length === 0) {
            killPlayer(room, owner, arrow.ownerId);
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
            io.to(room.id).emit('bandSnapped', {
              ownerId: owner.id,
              cutterId: arrow.ownerId,
              bandId: popped.id,
              snapX: Math.round(owner.body.position.x),
              snapY: Math.round(owner.body.position.y)
            });
          }

          if (shooter) {
            shooter.cuts += 1;
            addScore(room, shooter, GAME_CONFIG.SCORE_PER_ARROW_HIT, 'TAM İSABET!', bodyHit.x, bodyHit.y);
          }

          io.to(room.id).emit('arrowSplat', { x: Math.round(bodyHit.x), y: Math.round(bodyHit.y), color: arrow.color });

          if (owner.bands.length === 0) {
            killPlayer(room, owner, arrow.ownerId);
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

function processRoomBandIntersections(room) {
  const alivePlayers = [];
  for (const p of room.players.values()) {
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

      // TAKIM OYUNLARINDA DOST ATEŞİ KAPALI! Takım arkadaşının kemerini kesemez.
      if (room.isTeam && cutter.team && owner.team === cutter.team) continue;

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
          addScore(room, cutter, GAME_CONFIG.SCORE_PER_BELT_CUT, 'KESİM!', hit.x, hit.y);

          io.to(room.id).emit('bandSnapped', {
            ownerId: owner.id,
            cutterId: cutter.id,
            bandId: band.id,
            snapX: Math.round(hit.x),
            snapY: Math.round(hit.y)
          });

          if (owner.bands.length === 0) {
            killPlayer(room, owner, cutter.id);
            break;
          }
        }
      }
    }
  }
}

// --- MAÇ BAŞLATMA VE BİTİRME ---
function startNewMatch(room) {
  if (!room) return;
  if (room.matchRestartTimer) {
    clearTimeout(room.matchRestartTimer);
    room.matchRestartTimer = null;
  }

  room.arrows.length = 0;
  room.status = 'playing';
  room.matchStartTime = Date.now();
  room.matchEndTime = Date.now() + GAME_CONFIG.MATCH_DURATION_SEC * 1000;

  for (const p of room.players.values()) {
    p.score = 0;
    p.cuts = 0;
    p.kills = 0;
    p.spectating = false; // Bekleyen tüm oyuncular yeni turda eşit olarak oyuna dahil olur!
    clearPlayerPhysics(room, p);
    if (p.isBot) {
      spawnBotAtRandomWall(room, p);
    } else {
      p.alive = false;
      p.waitingForWall = true;
      p.respawnAt = 0;
    }
  }

  io.to(room.id).emit('matchRestarted', {
    matchEndTime: room.matchEndTime,
    roomStatus: room.status
  });
}

function triggerMatchEnd(room) {
  if (!room || room.status === 'match_over') return;
  room.status = 'match_over';

  let seferScore = 0;
  let telliScore = 0;

  const standings = [...room.players.values()]
    .map((p) => {
      const sc = p.score || 0;
      if (p.team === 'seferogullari') seferScore += sc;
      if (p.team === 'telliogullari') telliScore += sc;
      return {
        id: p.id,
        name: p.name,
        username: p.username || null,
        color: p.color,
        skin: p.skin,
        team: p.team || null,
        bandsCount: p.bands.length,
        cuts: p.cuts || 0,
        kills: p.kills || 0,
        score: sc
      };
    })
    .sort((a, b) => b.score - a.score || b.bandsCount - a.bandsCount || b.cuts - a.cuts);

  const winner = standings[0] || { name: 'Kimse', score: 0, bandsCount: 0 };
  let winningTeam = null;
  if (room.isTeam) {
    winningTeam = seferScore >= telliScore ? 'seferogullari' : 'telliogullari';
  }

  // Kayıtlı üyelerin istatistiklerini kaydet
  for (const p of room.players.values()) {
    if (!p.isBot && p.username) {
      const won = room.isTeam ? p.team === winningTeam : winner.id === p.id;
      userStore.recordMatchStats(p.username, {
        score: p.score || 0,
        cuts: p.cuts || 0,
        kills: p.kills || 0,
        won
      });
    }
  }

  const nextMatchIn = 10000;

  io.to(room.id).emit('matchEnded', {
    isTeam: room.isTeam,
    winningTeam,
    seferScore,
    telliScore,
    winnerName: room.isTeam
      ? winningTeam === 'seferogullari'
        ? '🟢 SEFEROĞULLARI AİLESİ'
        : '🔴 TELLİOĞULLARI AİLESİ'
      : winner.name,
    winnerColor: winner.color || '#00F5D4',
    winnerScore: room.isTeam ? Math.max(seferScore, telliScore) : winner.score,
    winnerBands: winner.bandsCount,
    standings,
    nextMatchIn
  });

  room.matchRestartTimer = setTimeout(() => {
    if (room.isTeam) {
      const { seferCount, telliCount } = getTeamCounts(room);
      if (seferCount >= room.teamSize && telliCount >= room.teamSize) {
        startNewMatch(room);
      } else {
        room.status = 'waiting_for_teams';
        for (const p of room.players.values()) {
          clearPlayerPhysics(room, p);
          p.alive = false;
          p.waitingForWall = false;
        }
        io.to(room.id).emit('returnedToTeamLobby');
      }
    } else {
      startNewMatch(room);
    }
  }, nextMatchIn);
}

// Kemer tutma pasif puan döngüsü (1 sn)
setInterval(() => {
  for (const room of rooms.values()) {
    if (room.status !== 'playing') continue;
    for (const p of room.players.values()) {
      if (p.alive && p.bands.length > 0) {
        p.score += p.bands.length * GAME_CONFIG.SCORE_HOLD_PER_BELT_SEC;
      }
    }
  }
}, 1000);

// Fizik döngüsü (60 Hz)
const dt = 1000 / GAME_CONFIG.TICK_RATE;
setInterval(() => {
  const now = Date.now();

  for (const room of rooms.values()) {
    if (room.status === 'starting_countdown') {
      if (now >= room.countdownEndTime) {
        startNewMatch(room);
      }
      continue;
    }

    if (room.status !== 'playing') continue;

    if (now >= room.matchEndTime) {
      triggerMatchEnd(room);
      continue;
    }

    for (const p of room.players.values()) {
      if (p.spectating) continue; // İzleyici modundakiler turun bitmesini bekler

      if (!p.alive) {
        if (!p.waitingForWall && now >= p.respawnAt) {
          if (p.isBot) {
            spawnBotAtRandomWall(room, p);
            io.to(room.id).emit('playerRespawned', { id: p.id });
          } else {
            p.waitingForWall = true;
            io.to(p.id).emit('readyForWallSelect');
          }
        }
        continue;
      }

      if (p.isBot) {
        updateBotAI(room, p, now);
      }

      if (p.body) {
        p.prevPos.x = p.body.position.x;
        p.prevPos.y = p.body.position.y;

        const dx = p.input.targetX - p.body.position.x;
        const dy = p.input.targetY - p.body.position.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 4) {
          const throttle = Math.min(dist / GAME_CONFIG.MAX_INPUT_DIST, 1.0);
          const dirX = dx / dist;
          const dirY = dy / dist;
          const fx = dirX * GAME_CONFIG.BASE_MOVE_FORCE * throttle;
          const fy = dirY * GAME_CONFIG.BASE_MOVE_FORCE * throttle;
          Body.applyForce(p.body, p.body.position, { x: fx, y: fy });

          // Fare yönüne anında ve akıcı dönüş desteği (Steering Assist)
          const desiredSpeed = 9.2 * throttle;
          const nextVx = p.body.velocity.x * 0.90 + dirX * desiredSpeed * 0.10;
          const nextVy = p.body.velocity.y * 0.90 + dirY * desiredSpeed * 0.10;
          Body.setVelocity(p.body, { x: nextVx, y: nextVy });
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

    Engine.update(room.engine, dt);
    updateRoomArrows(room, now);
    processRoomBandIntersections(room);
  }
}, dt);

// Ağ Senkronizasyonu Döngüsü (30 Hz)
setInterval(() => {
  const now = Date.now();
  let totalGlobalOnline = 0;
  for (const r of rooms.values()) {
    totalGlobalOnline += r.players.size;
  }

  for (const room of rooms.values()) {
    const snapshot = [];
    let humanCount = 0;
    let seferScore = 0;
    let telliScore = 0;
    let seferCount = 0;
    let telliCount = 0;

    for (const p of room.players.values()) {
      if (!p.isBot) humanCount++;
      if (p.team === 'seferogullari') {
        seferCount++;
        seferScore += p.score || 0;
      } else if (p.team === 'telliogullari') {
        telliCount++;
        telliScore += p.score || 0;
      }

      snapshot.push({
        id: p.id,
        name: p.name,
        username: p.username || null,
        color: p.color,
        skin: p.skin || 'crown',
        team: p.team || null,
        isBot: Boolean(p.isBot),
        alive: p.alive,
        waitingForWall: Boolean(p.waitingForWall),
        spectating: Boolean(p.spectating),
        score: p.score,
        cuts: p.cuts,
        kills: p.kills,
        respawnRemaining: p.alive || p.waitingForWall || p.spectating ? 0 : Math.max(0, p.respawnAt - now),
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

    const activeArrows = room.arrows.map((a) => ({
      id: a.id,
      ownerId: a.ownerId,
      color: a.color,
      x: Math.round(a.x),
      y: Math.round(a.y),
      vx: Math.round(a.vx * 10) / 10,
      vy: Math.round(a.vy * 10) / 10
    }));

    const remainingSec =
      room.status === 'playing'
        ? Math.max(0, Math.ceil((room.matchEndTime - now) / 1000))
        : room.status === 'starting_countdown'
          ? Math.max(0, Math.ceil((room.countdownEndTime - now) / 1000))
          : 0;

    io.to(room.id).emit('stateUpdate', {
      roomId: room.id,
      roomName: room.name,
      roomStatus: room.status,
      isTeam: room.isTeam,
      teamSize: room.teamSize,
      seferCount,
      telliCount,
      seferScore,
      telliScore,
      isMatchOver: room.status === 'match_over',
      onlineCount: room.players.size,
      globalOnlineCount: totalGlobalOnline,
      humanCount,
      remainingSec,
      players: snapshot,
      arrows: activeArrows
    });
  }
}, 1000 / GAME_CONFIG.NETWORK_RATE);

// Admin Paneli ve Lobi Oda Sayıları Canlı Yayın Döngüsü (1 Hz)
function getLobbyRoomsSummary() {
  const list = [];
  for (const room of rooms.values()) {
    let humans = 0;
    let bots = 0;
    let seferCount = 0;
    let telliCount = 0;
    for (const p of room.players.values()) {
      if (p.isBot) bots++;
      else humans++;
      if (p.team === 'seferogullari') seferCount++;
      if (p.team === 'telliogullari') telliCount++;
    }
    list.push({
      id: room.id,
      name: room.name,
      shortName: room.shortName,
      isTeam: room.isTeam,
      teamSize: room.teamSize,
      maxPlayers: room.maxPlayers,
      status: room.status,
      humans,
      bots,
      total: room.players.size,
      seferCount,
      telliCount,
      remainingSec: room.status === 'playing' ? Math.max(0, Math.ceil((room.matchEndTime - Date.now()) / 1000)) : 0
    });
  }
  return list;
}

function buildAdminSnapshot() {
  let totalHumansInRooms = 0;
  let totalBotsInRooms = 0;
  const detailedRooms = [];

  for (const room of rooms.values()) {
    const playerList = [];
    let roomHumans = 0;
    let roomBots = 0;
    let seferCount = 0;
    let telliCount = 0;

    for (const p of room.players.values()) {
      if (p.isBot) {
        roomBots++;
        totalBotsInRooms++;
      } else {
        roomHumans++;
        totalHumansInRooms++;
      }
      if (p.team === 'seferogullari') seferCount++;
      if (p.team === 'telliogullari') telliCount++;

      playerList.push({
        id: p.id,
        name: p.name,
        username: p.username || null,
        isBot: Boolean(p.isBot),
        team: p.team || null,
        color: p.color,
        skin: p.skin,
        score: p.score || 0,
        bandsCount: p.bands.length,
        alive: p.alive,
        spectating: Boolean(p.spectating)
      });
    }

    detailedRooms.push({
      id: room.id,
      name: room.name,
      isTeam: room.isTeam,
      teamSize: room.teamSize,
      status: room.status,
      humans: roomHumans,
      bots: roomBots,
      seferCount,
      telliCount,
      remainingSec: room.status === 'playing' ? Math.max(0, Math.ceil((room.matchEndTime - Date.now()) / 1000)) : 0,
      players: playerList
    });
  }

  const adminSettings = userStore.getAdminSettings();
  return {
    connectedClients: connectedSockets.size,
    totalHumansInRooms,
    totalBotsInRooms,
    registeredUsersCount: userStore.getTotalRegisteredCount(),
    supabaseConnected: userStore.isCloudConnected(),
    lastCloudSyncAt: userStore.getLastCloudSyncAt(),
    settingsUpdatedAt: adminSettings ? adminSettings.updatedAt || 0 : 0,
    savedBotConfig: exportAllRoomsBotConfig(),
    rooms: detailedRooms
  };
}

setInterval(() => {
  io.emit('roomsSummary', getLobbyRoomsSummary());
  if (adminSockets.size > 0) {
    const snap = buildAdminSnapshot();
    for (const sid of adminSockets) {
      io.to(sid).emit('adminStateUpdate', snap);
    }
  }
}, 1000);

// Sağlık kontrolü (Healthcheck)
app.get('/health', (_req, res) => {
  const snap = buildAdminSnapshot();
  res.status(200).json({
    status: 'ok',
    game: 'Slime.io',
    uptime: Math.floor(process.uptime()),
    connectedClients: snap.connectedClients,
    playersInRooms: snap.totalHumansInRooms + snap.totalBotsInRooms
  });
});

// Oyuncuyu mevcut odasından güvenli şekilde çıkar
function leaveCurrentRoom(socket) {
  const roomId = socket.currentRoomId;
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (room) {
    const p = room.players.get(socket.id);
    if (p) {
      clearPlayerPhysics(room, p);
      room.players.delete(socket.id);
    }
    socket.leave(roomId);
  }
  socket.currentRoomId = null;
}

// --- SOCKET.IO BAĞLANTI YÖNETİMİ ---
io.on('connection', (socket) => {
  connectedSockets.set(socket.id, socket);
  socket.user = null; // Üye girişi yapılırsa { username, displayName, fullName, color, skin, ... }
  socket.currentRoomId = null;

  socket.emit('init', {
    selfId: socket.id,
    config: GAME_CONFIG,
    colors: SLIME_COLORS,
    skins: BASIC_10_SKINS,
    modes: GAME_MODES,
    teams: TEAMS,
    obstacles: sharedMapObstacles,
    roomsSummary: getLobbyRoomsSummary()
  });

  // 1) Ping Ölçümü
  socket.on('pingCheck', (clientTime, ack) => {
    if (typeof ack === 'function') ack(clientTime);
  });

  // 2) Üyelik Kayıt, Giriş & Otomatik Oturum Geri Yükleme
  socket.on('authRegister', (payload, ack) => {
    const res = userStore.registerUser(payload || {});
    if (res.ok) {
      socket.user = res.user;
      usernameToSocketId.set(res.user.username, socket.id);
    }
    if (typeof ack === 'function') ack(res);
  });

  socket.on('authLogin', (payload, ack) => {
    const res = payload && payload.autoRestore
      ? userStore.restoreOrLoginUser(payload)
      : userStore.loginUser(payload || {});
    if (res.ok) {
      socket.user = res.user;
      usernameToSocketId.set(res.user.username, socket.id);
    }
    if (typeof ack === 'function') ack(res);
  });

  socket.on('authRestoreSession', (payload, ack) => {
    const res = userStore.restoreOrLoginUser(payload || {});
    if (res.ok) {
      socket.user = res.user;
      usernameToSocketId.set(res.user.username, socket.id);
    }
    if (typeof ack === 'function') ack(res);
  });

  socket.on('updateCustomization', (payload, ack) => {
    if (!socket.user) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Kostüm ve renk seçimi için üye girişi yapmalısınız.' });
      return;
    }
    const res = userStore.updateUserCustomization(socket.user.username, payload || {});
    if (res.ok) {
      socket.user = res.user;
      // Eğer aktif bir odadaysa rengini ve kostümünü güncelle
      if (socket.currentRoomId) {
        const room = rooms.get(socket.currentRoomId);
        const p = room ? room.players.get(socket.id) : null;
        if (p) {
          if (!room.isTeam) p.color = res.user.color;
          p.skin = res.user.skin;
        }
      }
    }
    if (typeof ack === 'function') ack(res);
  });

  // 3) Odaya Katılma (Misafir veya Üye)
  socket.on('joinRoom', (payload, ack) => {
    const { roomId = 'ffa', guestName = '', preferredTeam = null } = payload || {};
    const room = rooms.get(roomId);
    if (!room) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Oda bulunamadı.' });
      return;
    }

    // Takım odaları sadece üyelere açıktır
    if (room.isTeam && !socket.user) {
      if (typeof ack === 'function') {
        ack({
          ok: false,
          requireAuth: true,
          error: 'Takım kurmak, Seferoğulları / Tellioğulları maçlarına girmek ve kostüm seçmek için lütfen hızlı üye olun veya giriş yapın!'
        });
      }
      return;
    }

    // İsim kontrolü
    let displayName = '';
    if (socket.user) {
      displayName = socket.user.displayName || socket.user.username;
    } else {
      displayName = String(guestName || '').trim().substring(0, 14);
      if (displayName.length < 2) {
        if (typeof ack === 'function') {
          ack({ ok: false, error: 'Oyuna girmek için lütfen en az 2 harfli bir Slime Adı yazın!' });
        }
        return;
      }
    }

    leaveCurrentRoom(socket);

    // Takım odasında takım ataması
    let assignedTeam = null;
    if (room.isTeam) {
      const { seferCount, telliCount } = getTeamCounts(room);
      if (seferCount >= room.teamSize && telliCount >= room.teamSize && room.status === 'playing') {
        if (typeof ack === 'function') {
          ack({ ok: false, error: 'Bu takım odası şu an dolu! Başka bir oda seçebilir veya turun bitmesini bekleyebilirsiniz.' });
        }
        return;
      }
      if (preferredTeam === 'seferogullari' && seferCount < room.teamSize) {
        assignedTeam = 'seferogullari';
      } else if (preferredTeam === 'telliogullari' && telliCount < room.teamSize) {
        assignedTeam = 'telliogullari';
      } else if (seferCount <= telliCount && seferCount < room.teamSize) {
        assignedTeam = 'seferogullari';
      } else {
        assignedTeam = 'telliogullari';
      }
    }

    const playerColor = room.isTeam && assignedTeam
      ? TEAMS[assignedTeam].color
      : socket.user
        ? socket.user.color
        : SLIME_COLORS[room.players.size % SLIME_COLORS.length].id;

    const playerSkin = socket.user ? socket.user.skin : 'crown';

    // ADİL BAŞLANGIÇ KURALI:
    // Odada başka aktif gerçek oyuncu varsa (ve tur yeni başlamadıysa) yeni gelen kişi turun bitmesini bekler (spectating = true).
    // Ancak odada sadece botlar varsa bekletmeden turu sıfırlar ve hemen Duvar Seçimi (waitingForWall = true) açılır!
    let isSpectating = false;
    let isWaitingForWall = false;

    if (!room.isTeam) {
      let activeHumansInRoom = 0;
      for (const existingP of room.players.values()) {
        if (!existingP.isBot && !existingP.spectating && existingP.id !== socket.id) {
          activeHumansInRoom++;
        }
      }

      if (room.status === 'playing' && activeHumansInRoom === 0) {
        // Odada sadece botlar var: tur süresini sıfırla ve oyuncuyu hemen duvar seçimine al!
        room.matchStartTime = Date.now();
        room.matchEndTime = Date.now() + GAME_CONFIG.MATCH_DURATION_SEC * 1000;
        for (const botP of room.players.values()) {
          if (botP.isBot) {
            botP.score = 0;
            botP.cuts = 0;
            botP.kills = 0;
          }
        }
        isSpectating = false;
        isWaitingForWall = true;
      } else if (room.status === 'playing' && activeHumansInRoom > 0) {
        isSpectating = true;
        isWaitingForWall = false;
      } else {
        isSpectating = false;
        isWaitingForWall = true;
      }
    } else {
      // Takım odasında kadro dolana kadar beklenir, oynanıyorsa duvar seçimine geçer
      isSpectating = false;
      isWaitingForWall = room.status === 'playing';
    }

    const player = {
      id: socket.id,
      roomId: room.id,
      name: displayName,
      username: socket.user ? socket.user.username : null,
      color: playerColor,
      skin: playerSkin,
      team: assignedTeam,
      isBot: false,
      isGuest: !socket.user,
      alive: false,
      waitingForWall: isWaitingForWall,
      spectating: isSpectating,
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

    room.players.set(socket.id, player);
    socket.join(room.id);
    socket.currentRoomId = room.id;

    if (room.isTeam && room.status === 'waiting_for_teams') {
      checkTeamRoomReady(room);
    }

    if (typeof ack === 'function') {
      ack({
        ok: true,
        roomId: room.id,
        roomName: room.name,
        isTeam: room.isTeam,
        teamSize: room.teamSize,
        team: assignedTeam,
        spectating: isSpectating,
        roomStatus: room.status
      });
    }
  });

  // Takım Odasında Taraf Değiştirme (Seferoğulları <-> Tellioğulları)
  socket.on('selectTeam', (teamId, ack) => {
    const room = socket.currentRoomId ? rooms.get(socket.currentRoomId) : null;
    if (!room || !room.isTeam) return;
    const player = room.players.get(socket.id);
    if (!player || room.status !== 'waiting_for_teams') return;

    if (teamId !== 'seferogullari' && teamId !== 'telliogullari') return;
    if (player.team === teamId) {
      if (typeof ack === 'function') ack({ ok: true, team: teamId });
      return;
    }

    const { seferCount, telliCount } = getTeamCounts(room);
    if (teamId === 'seferogullari' && seferCount >= room.teamSize) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Seferoğulları kadrosu dolu!' });
      return;
    }
    if (teamId === 'telliogullari' && telliCount >= room.teamSize) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Tellioğulları kadrosu dolu!' });
      return;
    }

    player.team = teamId;
    player.color = TEAMS[teamId].color;
    checkTeamRoomReady(room);

    if (typeof ack === 'function') ack({ ok: true, team: teamId });
  });

  socket.on('leaveRoom', () => {
    leaveCurrentRoom(socket);
  });

  // 4) Oyun İçi Aksiyonlar
  socket.on('spawnAtWall', (point) => {
    const room = socket.currentRoomId ? rooms.get(socket.currentRoomId) : null;
    if (!room || room.status !== 'playing') return;
    const player = room.players.get(socket.id);
    if (player && !player.spectating && player.waitingForWall && point && typeof point.x === 'number' && typeof point.y === 'number') {
      spawnPlayerAtWallPoint(room, player, point.x, point.y);
    }
  });

  socket.on('shootArrow', (target) => {
    const room = socket.currentRoomId ? rooms.get(socket.currentRoomId) : null;
    if (!room || room.status !== 'playing') return;
    const player = room.players.get(socket.id);
    if (player && player.alive && target && typeof target.x === 'number' && typeof target.y === 'number') {
      shootSlimeArrow(room, player, target.x, target.y);
    }
  });

  socket.on('cutOwnBelt', (target) => {
    const room = socket.currentRoomId ? rooms.get(socket.currentRoomId) : null;
    if (!room || room.status !== 'playing') return;
    const player = room.players.get(socket.id);
    if (player && player.alive && target && typeof target.x === 'number' && typeof target.y === 'number') {
      cutOwnBeltInDirection(room, player, target.x, target.y);
    }
  });

  socket.on('mouseMove', (target) => {
    const room = socket.currentRoomId ? rooms.get(socket.currentRoomId) : null;
    if (!room) return;
    const player = room.players.get(socket.id);
    if (player && target && typeof target.x === 'number' && typeof target.y === 'number') {
      player.input.targetX = target.x;
      player.input.targetY = target.y;
    }
  });

  // 5) Sosyal Sistem: Profil İnceleme, Arkadaş Ekleme, Oyuna Davet
  socket.on('inspectProfile', ({ targetId, targetUsername }, ack) => {
    if (typeof ack !== 'function') return;

    let resolvedUser = null;
    if (targetUsername) {
      resolvedUser = userStore.getUserByUsername(targetUsername);
    }

    let livePlayer = null;
    if (targetId) {
      for (const r of rooms.values()) {
        if (r.players.has(targetId)) {
          livePlayer = r.players.get(targetId);
          break;
        }
      }
    }
    if (!resolvedUser && livePlayer && livePlayer.username) {
      resolvedUser = userStore.getUserByUsername(livePlayer.username);
    }

    if (resolvedUser) {
      const targetSocketId = usernameToSocketId.get(resolvedUser.username);
      const targetSocket = targetSocketId ? connectedSockets.get(targetSocketId) : null;
      const isFriend = Boolean(socket.user && (socket.user.friends || []).includes(resolvedUser.username));

      ack({
        ok: true,
        profile: {
          isRegistered: true,
          username: resolvedUser.username,
          displayName: resolvedUser.displayName,
          fullName: resolvedUser.fullName,
          color: resolvedUser.color,
          skin: resolvedUser.skin,
          friendCount: resolvedUser.friendCount,
          stats: resolvedUser.stats,
          isFriend,
          online: Boolean(targetSocket),
          currentRoomId: targetSocket ? targetSocket.currentRoomId : null
        }
      });
      return;
    }

    if (livePlayer) {
      ack({
        ok: true,
        profile: {
          isRegistered: false,
          username: null,
          displayName: livePlayer.name,
          fullName: livePlayer.isBot ? 'Yapay Zeka (Bot)' : 'Misafir Oyuncu',
          color: livePlayer.color,
          skin: livePlayer.skin || 'crown',
          friendCount: 0,
          stats: {
            totalScore: livePlayer.score || 0,
            totalCuts: livePlayer.cuts || 0,
            totalKills: livePlayer.kills || 0,
            matchesPlayed: 1,
            wins: 0
          },
          isFriend: false,
          online: true,
          isBot: Boolean(livePlayer.isBot)
        }
      });
      return;
    }

    ack({ ok: false, error: 'Oyuncu profili bulunamadı.' });
  });

  socket.on('addFriend', ({ targetUsername }, ack) => {
    if (!socket.user) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Arkadaş eklemek için lütfen üye girişi yapın!' });
      return;
    }
    const res = userStore.addFriend(socket.user.username, targetUsername);
    if (res.ok) {
      socket.user = userStore.getUserByUsername(socket.user.username);
      const targetSid = usernameToSocketId.get(userStore.normalizeUsername(targetUsername));
      if (targetSid && connectedSockets.has(targetSid)) {
        const targetSock = connectedSockets.get(targetSid);
        if (targetSock.user) {
          targetSock.user = userStore.getUserByUsername(targetSock.user.username);
        }
        io.to(targetSid).emit('friendAddedNotification', {
          fromUsername: socket.user.username,
          fromDisplayName: socket.user.displayName
        });
      }
    }
    if (typeof ack === 'function') ack(res);
  });

  socket.on('getFriendsList', (ack) => {
    if (typeof ack !== 'function') return;
    if (!socket.user) {
      ack({ ok: false, friends: [], friendCount: 0 });
      return;
    }
    const fresh = userStore.getUserByUsername(socket.user.username);
    socket.user = fresh;
    const detailed = (fresh.friends || []).map((fUsername) => {
      const fUser = userStore.getUserByUsername(fUsername);
      const sid = usernameToSocketId.get(fUsername);
      const sock = sid ? connectedSockets.get(sid) : null;
      const room = sock && sock.currentRoomId ? rooms.get(sock.currentRoomId) : null;
      return {
        username: fUsername,
        displayName: fUser ? fUser.displayName : fUsername,
        fullName: fUser ? fUser.fullName : '',
        color: fUser ? fUser.color : '#00F5D4',
        skin: fUser ? fUser.skin : 'crown',
        friendCount: fUser ? fUser.friendCount : 0,
        online: Boolean(sock),
        roomId: room ? room.id : null,
        roomName: room ? room.shortName : null
      };
    });
    ack({ ok: true, friendCount: detailed.length, friends: detailed });
  });

  socket.on('sendGameInvite', ({ targetUsername, roomId }, ack) => {
    if (!socket.user) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Davet göndermek için üye girişi yapmalısınız.' });
      return;
    }
    const cleanTarget = userStore.normalizeUsername(targetUsername);
    const targetSid = usernameToSocketId.get(cleanTarget);
    if (!targetSid || !connectedSockets.has(targetSid)) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Bu oyuncu şu an çevrimiçi değil.' });
      return;
    }

    const useRoomId = roomId || socket.currentRoomId || 'team_2v2';
    const room = rooms.get(useRoomId);
    const myPlayer = room ? room.players.get(socket.id) : null;

    io.to(targetSid).emit('gameInviteReceived', {
      fromUsername: socket.user.username,
      fromDisplayName: socket.user.displayName,
      roomId: useRoomId,
      roomName: room ? room.name : 'Takım Savaşı',
      preferredTeam: myPlayer ? myPlayer.team : 'seferogullari'
    });

    if (typeof ack === 'function') ack({ ok: true });
  });

  // --- 6) ADMİN KONTROL PANELİ OLAYLARI ---
  socket.on('adminAuth', ({ password, clientSavedBotConfig }, ack) => {
    if (String(password || '').trim() === ADMIN_PASSWORD) {
      adminSockets.add(socket.id);

      // Sunucu konteyneri yeniden başlamışsa ve admin tarayıcısında kayıtlı bot ayarları varsa geri yükle
      const currentSettings = userStore.getAdminSettings();
      if ((!currentSettings || !currentSettings.initialized) && clientSavedBotConfig && typeof clientSavedBotConfig === 'object') {
        applySavedBotConfigToRooms(clientSavedBotConfig);
        persistCurrentAdminBotSettings();
      }

      if (typeof ack === 'function') {
        ack({ ok: true, snapshot: buildAdminSnapshot() });
      }
    } else {
      if (typeof ack === 'function') {
        ack({ ok: false, error: 'Hatalı Admin Şifresi!' });
      }
    }
  });

  socket.on('adminAddBot', ({ roomId, name, team, color, skin }, ack) => {
    if (!adminSockets.has(socket.id)) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Yetkisiz işlem!' });
      return;
    }
    const room = rooms.get(roomId || 'ffa');
    if (!room) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Oda bulunamadı.' });
      return;
    }
    const bot = createBotInRoom(room, { name, team, color, skin });
    persistCurrentAdminBotSettings();
    const snap = buildAdminSnapshot();
    for (const sid of adminSockets) io.to(sid).emit('adminStateUpdate', snap);
    if (typeof ack === 'function') ack({ ok: true, botId: bot ? bot.id : null, savedBotConfig: snap.savedBotConfig });
  });

  socket.on('adminFillRoomWithBots', ({ roomId }, ack) => {
    if (!adminSockets.has(socket.id)) return;
    const room = rooms.get(roomId);
    if (!room || !room.isTeam) return;
    let added = 0;
    while (true) {
      const { seferCount, telliCount } = getTeamCounts(room);
      if (seferCount >= room.teamSize && telliCount >= room.teamSize) break;
      if (seferCount < room.teamSize) {
        createBotInRoom(room, { team: 'seferogullari' });
        added++;
      } else if (telliCount < room.teamSize) {
        createBotInRoom(room, { team: 'telliogullari' });
        added++;
      }
      if (added > 20) break;
    }
    persistCurrentAdminBotSettings();
    const snap = buildAdminSnapshot();
    for (const sid of adminSockets) io.to(sid).emit('adminStateUpdate', snap);
    if (typeof ack === 'function') ack({ ok: true, added, savedBotConfig: snap.savedBotConfig });
  });

  socket.on('adminRenameBot', ({ roomId, botId, newName }, ack) => {
    if (!adminSockets.has(socket.id)) return;
    const room = rooms.get(roomId);
    const bot = room ? room.players.get(botId) : null;
    if (bot && bot.isBot && newName && String(newName).trim()) {
      bot.name = String(newName).trim().substring(0, 16);
    }
    persistCurrentAdminBotSettings();
    const snap = buildAdminSnapshot();
    for (const sid of adminSockets) io.to(sid).emit('adminStateUpdate', snap);
    if (typeof ack === 'function') ack({ ok: true, savedBotConfig: snap.savedBotConfig });
  });

  socket.on('adminRemoveBot', ({ roomId, botId }, ack) => {
    if (!adminSockets.has(socket.id)) return;
    const room = rooms.get(roomId || 'ffa');
    const removed = removeBotFromRoom(room, botId);
    persistCurrentAdminBotSettings();
    const snap = buildAdminSnapshot();
    for (const sid of adminSockets) io.to(sid).emit('adminStateUpdate', snap);
    if (typeof ack === 'function') ack({ ok: removed, savedBotConfig: snap.savedBotConfig });
  });

  socket.on('adminClearRoomBots', ({ roomId }, ack) => {
    if (!adminSockets.has(socket.id)) return;
    const room = rooms.get(roomId || 'ffa');
    if (room) {
      for (const [pid, p] of [...room.players.entries()]) {
        if (p.isBot) {
          clearPlayerPhysics(room, p);
          room.players.delete(pid);
        }
      }
    }
    persistCurrentAdminBotSettings();
    const snap = buildAdminSnapshot();
    for (const sid of adminSockets) io.to(sid).emit('adminStateUpdate', snap);
    if (typeof ack === 'function') ack({ ok: true, savedBotConfig: snap.savedBotConfig });
  });

  socket.on('adminSaveSettings', (_payload, ack) => {
    if (!adminSockets.has(socket.id)) return;
    persistCurrentAdminBotSettings();
    const snap = buildAdminSnapshot();
    for (const sid of adminSockets) io.to(sid).emit('adminStateUpdate', snap);
    if (typeof ack === 'function') ack({ ok: true, savedBotConfig: snap.savedBotConfig });
  });

  socket.on('adminForceStartMatch', ({ roomId }, ack) => {
    if (!adminSockets.has(socket.id)) return;
    const room = rooms.get(roomId || 'ffa');
    if (room) startNewMatch(room);
    const snap = buildAdminSnapshot();
    for (const sid of adminSockets) io.to(sid).emit('adminStateUpdate', snap);
    if (typeof ack === 'function') ack({ ok: true });
  });

  socket.on('adminForceEndMatch', ({ roomId }, ack) => {
    if (!adminSockets.has(socket.id)) return;
    const room = rooms.get(roomId || 'ffa');
    if (room) triggerMatchEnd(room);
    const snap = buildAdminSnapshot();
    for (const sid of adminSockets) io.to(sid).emit('adminStateUpdate', snap);
    if (typeof ack === 'function') ack({ ok: true });
  });

  socket.on('disconnect', () => {
    leaveCurrentRoom(socket);
    if (socket.user && usernameToSocketId.get(socket.user.username) === socket.id) {
      usernameToSocketId.delete(socket.user.username);
    }
    adminSockets.delete(socket.id);
    connectedSockets.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`[Slime.io v2.0] Online Sunucu Aktif: http://${HOST}:${PORT}`);
});
