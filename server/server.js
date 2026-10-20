const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const Matter = require('matter-js');

const {
  GAME_CONFIG,
  POWERUP_TYPES,
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

// Sosyal Medya (WhatsApp, Instagram, Telegram, Discord, X) Paylaşım Afişi & Favicon
app.get(['/favicon.ico', '/favicon.svg'], (_req, res) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <rect width="64" height="64" rx="16" fill="#080B12"/>
    <circle cx="32" cy="36" r="20" fill="#00F5D4" stroke="#FFFFFF" stroke-width="2.5"/>
    <path d="M18 18 L22 8 L28 15 L32 6 L36 15 L42 8 L46 18 Z" fill="#FFD700" stroke="#B45309" stroke-width="1.5"/>
    <circle cx="25" cy="33" r="4" fill="#FFFFFF"/><circle cx="26" cy="33" r="2" fill="#080B12"/>
    <circle cx="39" cy="33" r="4" fill="#FFFFFF"/><circle cx="40" cy="33" r="2" fill="#080B12"/>
  </svg>`;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.status(200).send(svg);
});

app.get('/og-banner.svg', (_req, res) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#060911"/>
        <stop offset="50%" stop-color="#0D1528"/>
        <stop offset="100%" stop-color="#130B24"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#bg)"/>
    <rect x="28" y="28" width="1144" height="574" rx="32" fill="none" stroke="#00F5D4" stroke-width="4" stroke-opacity="0.6"/>
    <line x1="160" y1="150" x2="310" y2="310" stroke="#00F59B" stroke-width="8" stroke-dasharray="16 8"/>
    <line x1="1040" y1="160" x2="890" y2="310" stroke="#FF2A85" stroke-width="8" stroke-dasharray="16 8"/>
    <circle cx="310" cy="310" r="78" fill="#00F59B" stroke="#FFFFFF" stroke-width="5"/>
    <circle cx="288" cy="298" r="14" fill="#FFFFFF"/><circle cx="292" cy="298" r="7" fill="#080B12"/>
    <circle cx="334" cy="298" r="14" fill="#FFFFFF"/><circle cx="338" cy="298" r="7" fill="#080B12"/>
    <circle cx="890" cy="310" r="78" fill="#FF2A85" stroke="#FFFFFF" stroke-width="5"/>
    <circle cx="868" cy="298" r="14" fill="#FFFFFF"/><circle cx="864" cy="298" r="7" fill="#080B12"/>
    <circle cx="914" cy="298" r="14" fill="#FFFFFF"/><circle cx="910" cy="298" r="7" fill="#080B12"/>
    <text x="600" y="235" text-anchor="middle" fill="#00F5D4" font-family="Segoe UI, Arial, sans-serif" font-size="88" font-weight="900">SLIME.IO</text>
    <text x="600" y="305" text-anchor="middle" fill="#FFFFFF" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="800">NEON AÇIK DÜNYA &amp; TAKIM SAVAŞ ARENASI</text>
    <text x="600" y="375" text-anchor="middle" fill="#FFE066" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="800">🟢 Seferoğulları vs 🔴 Tellioğulları • 2v2 / 4v4 / 8v8 / Herkes Tek</text>
    <rect x="370" y="435" width="460" height="76" rx="38" fill="#FF2A85"/>
    <text x="600" y="484" text-anchor="middle" fill="#FFFFFF" font-family="Segoe UI, Arial, sans-serif" font-size="32" font-weight="900">🚀 HEMEN ÜCRETSİZ OYNA: SLIMEIO.COM</text>
  </svg>`;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.status(200).send(svg);
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
let nextPowerupId = 1;
let botCounter = 1;

const BOT_NAMES = [
  'NeonSlime', 'ZıpZıp', 'VantuzKing', 'CyberJöle',
  'KemerAvcısı', 'Plazma', 'Boncuk', 'Elastik',
  'TosunPaşa', 'KüçükEnişte', 'LütfüBey', 'Suphi'
];

// Haritada engellerle çakışmayan güvenli rastgele güçlendirme (Power-Up) koordinatı bul
function findSafePowerupPosition(room) {
  const halfW = GAME_CONFIG.ARENA_WIDTH / 2 - 200;
  const halfH = GAME_CONFIG.ARENA_HEIGHT / 2 - 200;

  for (let attempt = 0; attempt < 25; attempt++) {
    const rx = Math.round((Math.random() * 2 - 1) * halfW);
    const ry = Math.round((Math.random() * 2 - 1) * halfH);

    let clearOfObstacles = true;
    for (const obs of sharedMapObstacles) {
      const approxR = (obs.radius || Math.max(obs.w || 80, obs.h || 80) * 0.55) + 75;
      if (Math.hypot(rx - obs.x, ry - obs.y) < approxR) {
        clearOfObstacles = false;
        break;
      }
    }
    if (!clearOfObstacles) continue;

    if (room && Array.isArray(room.powerups)) {
      let clearOfOthers = true;
      for (const existing of room.powerups) {
        if (Math.hypot(rx - existing.x, ry - existing.y) < 240) {
          clearOfOthers = false;
          break;
        }
      }
      if (!clearOfOthers) continue;
    }

    return { x: rx, y: ry };
  }

  return {
    x: Math.round((Math.random() * 2 - 1) * 900),
    y: Math.round((Math.random() * 2 - 1) * 600)
  };
}

function spawnPowerupBox(room) {
  if (!room || !Array.isArray(room.powerups)) return null;
  if (room.powerups.length >= (GAME_CONFIG.MAX_POWERUPS_PER_ROOM || 5)) return null;

  const pos = findSafePowerupPosition(room);
  const box = {
    id: nextPowerupId++,
    x: pos.x,
    y: pos.y,
    createdAt: Date.now()
  };
  room.powerups.push(box);
  room.lastPowerupSpawnAt = Date.now();
  return box;
}

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
    powerups: [],
    lastPowerupSpawnAt: Date.now(),
    status: modeConfig.isTeam ? 'waiting_for_teams' : 'playing', // 'waiting_for_teams' | 'starting_countdown' | 'playing' | 'match_over'
    countdownEndTime: 0,
    matchEndTime: Date.now() + GAME_CONFIG.MATCH_DURATION_SEC * 1000,
    matchStartTime: Date.now(),
    matchRestartTimer: null
  };

  // Başlangıçta haritaya 3 adet rastgele güçlendirme kutusu yerleştir
  for (let i = 0; i < 3; i++) {
    spawnPowerupBox(room);
  }

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
  if (player.powerupTimer) {
    clearTimeout(player.powerupTimer);
    player.powerupTimer = null;
  }
  player.activePowerup = null;
  player.powerupUntil = 0;
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

function grantLiveCombatReward(player, type) {
  if (!player || player.isBot) return;
  const isKill = type === 'kill';
  const earnedPoints = isKill
    ? (GAME_CONFIG.REWARD_POINT_PER_KILL || 75)
    : (GAME_CONFIG.REWARD_POINT_PER_CUT || 25);
  const earnedCoins = isKill && player.kills > 0 && player.kills % 3 === 0
    ? (GAME_CONFIG.REWARD_COIN_PER_3_KILLS || 5)
    : 0;

  let updatedUser = null;
  if (player.username) {
    updatedUser = userStore.addLiveCombatRewards(player.username, {
      cuts: isKill ? 0 : 1,
      kills: isKill ? 1 : 0,
      scoreDelta: 0,
      earnedPoints,
      earnedCoins
    });
    const sock = connectedSockets.get(player.id);
    if (sock && updatedUser) {
      sock.user = updatedUser;
    }
  }

  io.to(player.id).emit('combatReward', {
    type,
    earnedPoints,
    earnedCoins,
    cuts: player.cuts || 0,
    kills: player.kills || 0,
    user: updatedUser
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
    addScore(room, killer, GAME_CONFIG.SCORE_PER_KILL, 'ELEME! (+75 💎)', deathPos.x, deathPos.y);
    grantLiveCombatReward(killer, 'kill');
  }

  victim.score = Math.floor(victim.score * 0.75);
  clearPlayerPhysics(room, victim);

  const activeKillEffect =
    (killer && killer.equipped && killer.equipped.kill_effect) ||
    (victim && victim.equipped && victim.equipped.kill_effect) ||
    'kill_confetti';

  io.to(room.id).emit('playerDied', {
    victimId: victim.id,
    victimName: victim.name,
    victimColor: victim.color || '#00F5D4',
    killerId,
    killerName: killer ? killer.name : null,
    killEffect: activeKillEffect,
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
  const baseAngle = Math.atan2(dy, dx);

  const hasDoubleShot =
    player.activePowerup === 'double_shot' && now < (player.powerupUntil || 0);
  const spread = GAME_CONFIG.POWERUP_DOUBLE_SHOT_SPREAD_RAD || 0.16;
  const angles = hasDoubleShot
    ? [baseAngle - spread, baseAngle + spread]
    : [baseAngle];

  let firstArrow = null;
  for (const ang of angles) {
    const dirX = Math.cos(ang);
    const dirY = Math.sin(ang);
    const spawnX = px + dirX * (GAME_CONFIG.PLAYER_RADIUS + 10);
    const spawnY = py + dirY * (GAME_CONFIG.PLAYER_RADIUS + 10);

    const arrow = {
      id: nextArrowId++,
      ownerId: player.id,
      team: player.team || null,
      color: hasDoubleShot ? '#FF2A85' : player.color,
      x: spawnX,
      y: spawnY,
      prevX: px,
      prevY: py,
      vx: dirX * GAME_CONFIG.ARROW_SPEED,
      vy: dirY * GAME_CONFIG.ARROW_SPEED,
      createdAt: now
    };

    if (!firstArrow) firstArrow = arrow;
    room.arrows.push(arrow);
  }

  if (firstArrow) {
    io.to(room.id).emit('arrowShot', {
      arrowId: firstArrow.id,
      playerId: player.id,
      doubleShot: hasDoubleShot,
      consumedBandId: consumedBand ? consumedBand.id : null,
      x: Math.round(firstArrow.x),
      y: Math.round(firstArrow.y)
    });
  }
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
  let seferHumans = 0;
  let telliHumans = 0;
  let seferBots = 0;
  let telliBots = 0;

  for (const p of room.players.values()) {
    if (p.watchOnly) continue;
    if (p.team === 'seferogullari') {
      seferCount++;
      if (p.isBot) seferBots++;
      else seferHumans++;
    } else if (p.team === 'telliogullari') {
      telliCount++;
      if (p.isBot) telliBots++;
      else telliHumans++;
    }
  }
  return { seferCount, telliCount, seferHumans, telliHumans, seferBots, telliBots };
}

function removeOneBotFromTeam(room, teamId = null) {
  if (!room) return false;
  for (const [id, p] of room.players.entries()) {
    if (p.isBot && (!teamId || p.team === teamId)) {
      clearPlayerPhysics(room, p);
      room.players.delete(id);
      return true;
    }
  }
  return false;
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

  let assignedTeam = null;
  if (room.isTeam) {
    const { seferCount, telliCount } = getTeamCounts(room);
    if (options.team === 'seferogullari' || options.team === 'telliogullari') {
      assignedTeam = options.team;
    } else {
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
  const defaultColor = (assignedTeam && TEAMS[assignedTeam])
    ? TEAMS[assignedTeam].color
    : SLIME_COLORS[room.players.size % SLIME_COLORS.length].id;
  const color = (room.isTeam && assignedTeam && TEAMS[assignedTeam])
    ? TEAMS[assignedTeam].color
    : (options.color || defaultColor);
  const skin = options.skin || BASIC_10_SKINS[botCounter % BASIC_10_SKINS.length].id;
  const cleanCustom = userStore.sanitizeText(options.name || '', 16);

  let customName = cleanCustom;
  if (!customName) {
    const existingNames = new Set();
    for (const p of room.players.values()) {
      existingNames.add(String(p.name || '').toLowerCase());
    }
    let picked = null;
    for (let i = 0; i < BOT_NAMES.length; i++) {
      const candidate = `[BOT] ${BOT_NAMES[(botCounter + i) % BOT_NAMES.length]}`;
      if (!existingNames.has(candidate.toLowerCase())) {
        picked = candidate;
        break;
      }
    }
    customName = picked || `[BOT] ${BOT_NAMES[(botCounter - 2) % BOT_NAMES.length]} #${botCounter}`;
  }

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
  let removedBot = null;
  if (botId && room.players.has(botId)) {
    const b = room.players.get(botId);
    if (b && b.isBot) {
      clearPlayerPhysics(room, b);
      room.players.delete(botId);
      removedBot = b;
    }
  } else {
    for (const [id, p] of room.players.entries()) {
      if (p.isBot) {
        clearPlayerPhysics(room, p);
        room.players.delete(id);
        removedBot = p;
        break;
      }
    }
  }

  if (removedBot && room.isTeam && room.status === 'starting_countdown') {
    const { seferCount, telliCount } = getTeamCounts(room);
    if (seferCount < room.teamSize || telliCount < room.teamSize) {
      room.status = 'waiting_for_teams';
    }
  }
  return Boolean(removedBot);
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
    const arrowPad = GAME_CONFIG.ARROW_RADIUS + 6;
    const aMinX = Math.min(arrow.prevX, arrow.x) - arrowPad;
    const aMaxX = Math.max(arrow.prevX, arrow.x) + arrowPad;
    const aMinY = Math.min(arrow.prevY, arrow.y) - arrowPad;
    const aMaxY = Math.max(arrow.prevY, arrow.y) + arrowPad;

    for (const owner of room.players.values()) {
      if (owner.id === arrow.ownerId || !owner.alive || !owner.body || owner.bands.length === 0) continue;

      // TAKIM OYUNLARINDA DOST ATEŞİ KAPALI! Dostunu vuramaz ve kemerini kesemez.
      if (room.isTeam && arrow.team && owner.team === arrow.team) continue;

      const ox = owner.body.position.x;
      const oy = owner.body.position.y;

      for (let k = owner.bands.length - 1; k >= 0; k--) {
        const band = owner.bands[k];
        // Hızlı AABB kutu elemesi: Ok bu kemerin bölgesinde değilse trigonometrik/vektör hesabı atla
        if (
          Math.max(band.anchorX, ox) < aMinX ||
          Math.min(band.anchorX, ox) > aMaxX ||
          Math.max(band.anchorY, oy) < aMinY ||
          Math.min(band.anchorY, oy) > aMaxY
        ) {
          continue;
        }

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
            addScore(room, shooter, GAME_CONFIG.SCORE_PER_BELT_CUT, 'OKLA KESTİ! (+25 💎)', hit.x, hit.y);
            grantLiveCombatReward(shooter, 'cut');
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
            addScore(room, shooter, GAME_CONFIG.SCORE_PER_ARROW_HIT, 'TAM İSABET! (+25 💎)', bodyHit.x, bodyHit.y);
            grantLiveCombatReward(shooter, 'cut');
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

  const cutPad = GAME_CONFIG.PLAYER_RADIUS + 4;

  for (let i = 0; i < alivePlayers.length; i++) {
    const cutter = alivePlayers[i];
    if (!cutter.alive || !cutter.body) continue;

    const cx = cutter.body.position.x;
    const cy = cutter.body.position.y;
    const prevX = cutter.prevPos.x;
    const prevY = cutter.prevPos.y;
    const cMinX = Math.min(prevX, cx) - cutPad;
    const cMaxX = Math.max(prevX, cx) + cutPad;
    const cMinY = Math.min(prevY, cy) - cutPad;
    const cMaxY = Math.max(prevY, cy) + cutPad;

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
        // Hızlı AABB kutu elemesi: Kesici oyuncu bu kemerin kapsama kutusunda değilse hemen geç
        if (
          Math.max(band.anchorX, ox) < cMinX ||
          Math.min(band.anchorX, ox) > cMaxX ||
          Math.max(band.anchorY, oy) < cMinY ||
          Math.min(band.anchorY, oy) > cMaxY
        ) {
          continue;
        }

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
          addScore(room, cutter, GAME_CONFIG.SCORE_PER_BELT_CUT, 'KESİM! (+25 💎)', hit.x, hit.y);
          grantLiveCombatReward(cutter, 'cut');

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

// --- RASTGELE GÜÇLENDİRME (POWER-UP) KUTULARI SPAWN VE ÇARPIŞMA DÖNGÜSÜ ---
function updateRoomPowerups(room, now) {
  if (!room || room.status !== 'playing') return;

  // Belirli aralıklarla haritanın rastgele koordinatlarında yeni güçlendirme kutusu oluştur
  const spawnInterval = GAME_CONFIG.POWERUP_SPAWN_INTERVAL_MS || 6000;
  const maxBoxes = GAME_CONFIG.MAX_POWERUPS_PER_ROOM || 5;
  if (
    room.powerups.length < maxBoxes &&
    now - (room.lastPowerupSpawnAt || 0) >= spawnInterval
  ) {
    spawnPowerupBox(room);
  }

  if (room.powerups.length === 0) return;

  const pickupDist = (GAME_CONFIG.PLAYER_RADIUS || 24) + (GAME_CONFIG.POWERUP_RADIUS || 22);

  for (const p of room.players.values()) {
    if (!p.alive || !p.body || p.spectating || p.watchOnly) continue;

    const px = p.body.position.x;
    const py = p.body.position.y;

    for (let i = room.powerups.length - 1; i >= 0; i--) {
      const box = room.powerups[i];
      const d = Math.hypot(px - box.x, py - box.y);
      if (d <= pickupDist) {
        // Kutuyu haritadan sil
        room.powerups.splice(i, 1);

        // 3 farklı güçten birini rastgele seç (Geniş Kamera, İkili Atış, Yüksek Hız)
        const pool = Array.isArray(POWERUP_TYPES) && POWERUP_TYPES.length > 0
          ? POWERUP_TYPES
          : [
              { id: 'wide_cam', name: 'Geniş Kamera', icon: '🔭', color: '#00BBF9' },
              { id: 'double_shot', name: 'İkili Atış', icon: '🏹', color: '#FF2A85' },
              { id: 'high_speed', name: 'Yüksek Hız', icon: '⚡', color: '#FFE066' }
            ];
        const chosen = pool[Math.floor(Math.random() * pool.length)];
        const durationMs = GAME_CONFIG.POWERUP_DURATION_MS || 10000;

        // Önceki aktif güç sayacı varsa temizle
        if (p.powerupTimer) {
          clearTimeout(p.powerupTimer);
          p.powerupTimer = null;
        }

        p.activePowerup = chosen.id;
        p.powerupUntil = now + durationMs;

        // Tam 10 saniye sonra gücü ve aurayı sıfırla
        p.powerupTimer = setTimeout(() => {
          p.activePowerup = null;
          p.powerupUntil = 0;
          p.powerupTimer = null;
          io.to(room.id).emit('powerupExpired', {
            playerId: p.id
          });
        }, durationMs);

        addScore(
          room,
          p,
          GAME_CONFIG.SCORE_PER_POWERUP || 25,
          `${chosen.icon} ${chosen.name.toUpperCase()} (10sn)!`,
          box.x,
          box.y
        );

        io.to(room.id).emit('powerupCollected', {
          playerId: p.id,
          playerName: p.name,
          powerupId: chosen.id,
          powerupName: chosen.name,
          powerupIcon: chosen.icon,
          color: chosen.color,
          durationMs,
          x: box.x,
          y: box.y
        });

        break;
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
  room.powerups.length = 0;
  for (let i = 0; i < 3; i++) {
    spawnPowerupBox(room);
  }
  room.status = 'playing';
  room.matchStartTime = Date.now();
  room.matchEndTime = Date.now() + GAME_CONFIG.MATCH_DURATION_SEC * 1000;

  for (const p of room.players.values()) {
    p.score = 0;
    p.cuts = 0;
    p.kills = 0;
    clearPlayerPhysics(room, p);
    if (p.watchOnly) {
      p.spectating = true;
      p.waitingForWall = false;
      p.alive = false;
      p.respawnAt = 0;
      continue;
    }
    p.spectating = false; // Bekleyen tüm oyuncular yeni turda eşit olarak oyuna dahil olur!
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

  const rawStandings = [...room.players.values()]
    .filter((p) => !p.watchOnly)
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
        equipped: p.equipped || null,
        team: p.team || null,
        bandsCount: p.bands.length,
        cuts: p.cuts || 0,
        kills: p.kills || 0,
        score: sc
      };
    })
    .sort((a, b) => b.score - a.score || b.bandsCount - a.bandsCount || b.cuts - a.cuts);

  const winner = rawStandings[0] || { name: 'Kimse', score: 0, bandsCount: 0 };
  let winningTeam = null;
  if (room.isTeam) {
    winningTeam = seferScore >= telliScore ? 'seferogullari' : 'telliogullari';
  }

  const standings = rawStandings.map((row) => {
    const won = room.isTeam ? row.team === winningTeam : winner.id === row.id;
    const cutsPoints = (row.cuts || 0) * (GAME_CONFIG.REWARD_POINT_PER_CUT || 25);
    const killsPoints = (row.kills || 0) * (GAME_CONFIG.REWARD_POINT_PER_KILL || 75);
    const scorePoints = Math.round((row.score || 0) * (GAME_CONFIG.REWARD_POINT_SCORE_RATIO || 0.15));
    const bonusPoints = (GAME_CONFIG.REWARD_POINT_MATCH_COMPLETE || 50) + (won ? (GAME_CONFIG.REWARD_POINT_MATCH_WIN || 150) : 0);
    const totalMatchPoints = cutsPoints + killsPoints + scorePoints + bonusPoints;
    const killCoins = Math.floor((row.kills || 0) / 3) * (GAME_CONFIG.REWARD_COIN_PER_3_KILLS || 5);
    const winCoins = won ? (GAME_CONFIG.REWARD_COIN_MATCH_WIN || 15) : 0;
    const totalMatchCoins = killCoins + winCoins;

    return {
      ...row,
      won,
      earnedPoints: totalMatchPoints,
      earnedCoins: totalMatchCoins,
      endOfMatchBonusPoints: scorePoints + bonusPoints,
      endOfMatchBonusCoins: winCoins
    };
  });

  // Kayıtlı üyelerin ve oyuncuların maç sonu hakedişlerini kaydet & bildir
  for (const row of standings) {
    const p = room.players.get(row.id);
    if (!p || p.isBot || p.watchOnly) continue;

    let updatedUser = null;
    if (p.username) {
      updatedUser = userStore.recordMatchStats(p.username, {
        score: row.score || 0,
        cuts: row.cuts || 0,
        kills: row.kills || 0,
        won: row.won,
        earnedPoints: row.endOfMatchBonusPoints,
        earnedCoins: row.endOfMatchBonusCoins,
        alreadyCountedCombat: true
      });
      const sock = connectedSockets.get(p.id);
      if (sock && updatedUser) {
        sock.user = updatedUser;
      }
    }

    io.to(p.id).emit('matchRewardsEarned', {
      won: row.won,
      score: row.score,
      cuts: row.cuts,
      kills: row.kills,
      totalMatchPoints: row.earnedPoints,
      totalMatchCoins: row.earnedCoins,
      endOfMatchBonusPoints: row.endOfMatchBonusPoints,
      endOfMatchBonusCoins: row.endOfMatchBonusCoins,
      user: updatedUser
    });
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
          const hasHighSpeed = p.activePowerup === 'high_speed' && now < (p.powerupUntil || 0);
          const speedMult = hasHighSpeed ? (GAME_CONFIG.POWERUP_SPEED_MULTIPLIER || 1.72) : 1.0;

          const fx = dirX * GAME_CONFIG.BASE_MOVE_FORCE * speedMult * throttle;
          const fy = dirY * GAME_CONFIG.BASE_MOVE_FORCE * speedMult * throttle;
          Body.applyForce(p.body, p.body.position, { x: fx, y: fy });

          // Fare yönüne anında ve akıcı dönüş desteği (Steering Assist)
          const desiredSpeed = 9.2 * speedMult * throttle;
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
    updateRoomPowerups(room, now);
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
      if (!p.isBot && !p.watchOnly) humanCount++;
      if (!p.watchOnly && p.team === 'seferogullari') {
        seferCount++;
        seferScore += p.score || 0;
      } else if (!p.watchOnly && p.team === 'telliogullari') {
        telliCount++;
        telliScore += p.score || 0;
      }

      const hasActivePower = Boolean(p.activePowerup && now < (p.powerupUntil || 0));

      snapshot.push({
        id: p.id,
        name: p.name,
        username: p.username || null,
        color: p.color,
        skin: p.skin || 'crown',
        equipped: p.equipped || null,
        team: p.team || null,
        isBot: Boolean(p.isBot),
        watchOnly: Boolean(p.watchOnly),
        alive: p.alive,
        waitingForWall: Boolean(p.waitingForWall),
        spectating: Boolean(p.spectating),
        score: p.score,
        cuts: p.cuts,
        kills: p.kills,
        activePowerup: hasActivePower ? p.activePowerup : null,
        powerupRemaining: hasActivePower ? Math.max(0, p.powerupUntil - now) : 0,
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

    const activePowerups = (room.powerups || []).map((box) => ({
      id: box.id,
      x: box.x,
      y: box.y
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
      arrows: activeArrows,
      powerups: activePowerups
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
      else if (!p.watchOnly) humans++;
      if (!p.watchOnly && p.team === 'seferogullari') seferCount++;
      if (!p.watchOnly && p.team === 'telliogullari') telliCount++;
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
      if (!p.watchOnly && p.team === 'seferogullari') seferCount++;
      if (!p.watchOnly && p.team === 'telliogullari') telliCount++;

      playerList.push({
        id: p.id,
        name: p.name,
        username: p.username || null,
        isBot: Boolean(p.isBot),
        watchOnly: Boolean(p.watchOnly),
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
  const now = Date.now();
  const afkLimitMs = GAME_CONFIG.AFK_TIMEOUT_MS || 180000;

  // 3 dakika boyunca hareketsiz kalan oyuncuları askıya al ve odadan lobiye döndür
  for (const room of rooms.values()) {
    for (const [pid, p] of [...room.players.entries()]) {
      if (p.isBot) continue;
      const lastAct = p.lastActivityAt || now;
      if (now - lastAct >= afkLimitMs) {
        const sock = connectedSockets.get(pid);
        io.to(pid).emit('afkSuspended', {
          reason: '⏸️ 3 dakika boyunca hareketsiz kaldığın için oyunun askıya alındı ve lobiye döndürüldün.'
        });
        if (sock) {
          leaveCurrentRoom(sock);
        } else {
          clearPlayerPhysics(room, p);
          room.players.delete(pid);
        }
      }
    }
  }

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

function isValidCoordPair(pt) {
  return Boolean(pt && typeof pt.x === 'number' && typeof pt.y === 'number' && Number.isFinite(pt.x) && Number.isFinite(pt.y));
}

function clampCoord(val, maxAbs = 4000) {
  return Math.max(-maxAbs, Math.min(maxAbs, val));
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
    storeItems: userStore.getStoreItems(),
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
    const data = payload || {};
    if (!socket.user) {
      // Misafir oyuncular için de renk, kostüm, ekipman ve isim senkronizasyonu
      if (data.equipped && typeof data.equipped === 'object') {
        socket.guestEquipped = data.equipped;
      }
      if (data.guestName) {
        const cleanGuest = userStore.sanitizeText(data.guestName, 14);
        if (cleanGuest.length >= 2) {
          socket.guestName = cleanGuest;
        }
      }
      if (socket.currentRoomId) {
        const room = rooms.get(socket.currentRoomId);
        const p = room ? room.players.get(socket.id) : null;
        if (p) {
          if (!room.isTeam && data.color) p.color = data.color;
          if (data.skin) p.skin = data.skin;
          if (socket.guestEquipped) p.equipped = socket.guestEquipped;
          if (socket.guestName) p.name = socket.guestName;
        }
      }
      if (typeof ack === 'function') ack({ ok: true, isGuest: true });
      return;
    }

    const res = userStore.updateUserCustomization(socket.user.username, data);
    if (res.ok) {
      socket.user = res.user;
      // Eğer aktif bir odadaysa ismini, rengini, kostümünü ve ekipmanlarını güncelle
      if (socket.currentRoomId) {
        const room = rooms.get(socket.currentRoomId);
        const p = room ? room.players.get(socket.id) : null;
        if (p) {
          p.name = userStore.sanitizeText(res.user.displayName || res.user.username, 16);
          if (!room.isTeam) p.color = res.user.color;
          p.skin = res.user.skin;
          p.equipped = res.user.equipped || p.equipped;
        }
      }
    }
    if (typeof ack === 'function') ack(res);
  });

  socket.on('changePlayerName', (payload, ack) => {
    const rawName = payload && (payload.newName || payload.name);
    if (socket.user) {
      const res = userStore.updateUserProfileName(socket.user.username, rawName);
      if (!res.ok) {
        if (typeof ack === 'function') ack(res);
        return;
      }
      socket.user = res.user;
      if (socket.currentRoomId) {
        const room = rooms.get(socket.currentRoomId);
        const p = room ? room.players.get(socket.id) : null;
        if (p) {
          p.name = res.user.displayName;
        }
      }
      if (typeof ack === 'function') {
        ack({ ok: true, newName: res.user.displayName, user: res.user });
      }
      return;
    }

    const cleanGuest = userStore.sanitizeText(rawName || '', 14);
    if (!cleanGuest || cleanGuest.length < 2) {
      if (typeof ack === 'function') {
        ack({ ok: false, error: 'Slime adın en az 2 karakter olmalıdır!' });
      }
      return;
    }
    socket.guestName = cleanGuest;
    if (socket.currentRoomId) {
      const room = rooms.get(socket.currentRoomId);
      const p = room ? room.players.get(socket.id) : null;
      if (p) {
        p.name = cleanGuest;
      }
    }
    if (typeof ack === 'function') {
      ack({ ok: true, newName: cleanGuest });
    }
  });

  // 2b) Slime Mağazası (Shop) Satın Alma, Kuşanma ve Coin Paketi İşlemleri
  socket.on('shopBuyItem', (payload, ack) => {
    if (!socket.user) {
      if (typeof ack === 'function') {
        ack({ ok: false, isGuest: true, error: 'Misafir modunda yerel cüzdan kullanılır.' });
      }
      return;
    }
    const res = userStore.purchaseStoreItem(socket.user.username, payload || {});
    if (res.ok) {
      socket.user = res.user;
      if (socket.currentRoomId) {
        const room = rooms.get(socket.currentRoomId);
        const p = room ? room.players.get(socket.id) : null;
        if (p) {
          p.skin = res.user.skin;
          p.equipped = res.user.equipped;
        }
      }
    }
    if (typeof ack === 'function') ack(res);
  });

  socket.on('shopEquipItem', (payload, ack) => {
    if (!socket.user) {
      if (typeof ack === 'function') {
        ack({ ok: false, isGuest: true });
      }
      return;
    }
    const res = userStore.equipStoreItem(socket.user.username, payload || {});
    if (res.ok) {
      socket.user = res.user;
      if (socket.currentRoomId) {
        const room = rooms.get(socket.currentRoomId);
        const p = room ? room.players.get(socket.id) : null;
        if (p) {
          p.skin = res.user.skin;
          p.equipped = res.user.equipped;
        }
      }
    }
    if (typeof ack === 'function') ack(res);
  });

  socket.on('shopClaimCoinPack', (_payload, ack) => {
    if (typeof ack === 'function') {
      ack({
        ok: false,
        error: '🪙 Gerçek Slime Coin satın alma paketleri çok yakında aktif olacak!'
      });
    }
  });

  socket.on('syncGuestLoadout', (payload) => {
    if (!payload || typeof payload !== 'object') return;
    const eqSrc = (payload.equipped && typeof payload.equipped === 'object') ? payload.equipped : payload;
    socket.guestEquipped = {
      hat: typeof eqSrc.hat === 'string' ? eqSrc.hat : null,
      skin: typeof eqSrc.skin === 'string' ? eqSrc.skin : null,
      belt: typeof eqSrc.belt === 'string' ? eqSrc.belt : null,
      kill_effect: typeof eqSrc.kill_effect === 'string' ? eqSrc.kill_effect : null,
      title: typeof eqSrc.title === 'string' ? eqSrc.title : null
    };
    if (typeof payload.color === 'string' && payload.color.startsWith('#')) {
      socket.guestColor = payload.color;
    }
    if (typeof payload.skin === 'string') {
      socket.guestSkin = payload.skin;
    }
    if (payload.guestName) {
      const cleanG = userStore.sanitizeText(payload.guestName, 14);
      if (cleanG.length >= 2) socket.guestName = cleanG;
    }
    if (socket.currentRoomId) {
      const room = rooms.get(socket.currentRoomId);
      const p = room ? room.players.get(socket.id) : null;
      if (p && !socket.user) {
        p.equipped = socket.guestEquipped;
        if (socket.guestEquipped.hat) {
          p.skin = socket.guestEquipped.hat;
        } else if (socket.guestSkin) {
          p.skin = socket.guestSkin;
        }
        if (!room.isTeam && socket.guestColor) {
          p.color = socket.guestColor;
        }
        if (socket.guestName) {
          p.name = socket.guestName;
        }
      }
    }
  });

  // 3) Odaya Katılma veya Maçı Canlı İzleme (Misafir veya Üye)
  socket.on('joinRoom', (payload, ack) => {
    const { roomId = 'ffa', guestName = '', preferredTeam = null, watchOnly = false, guestEquipped = null } = payload || {};
    if (guestEquipped && typeof guestEquipped === 'object') {
      socket.guestEquipped = {
        hat: typeof guestEquipped.hat === 'string' ? guestEquipped.hat : null,
        skin: typeof guestEquipped.skin === 'string' ? guestEquipped.skin : null,
        belt: typeof guestEquipped.belt === 'string' ? guestEquipped.belt : null,
        kill_effect: typeof guestEquipped.kill_effect === 'string' ? guestEquipped.kill_effect : null,
        title: typeof guestEquipped.title === 'string' ? guestEquipped.title : null
      };
    }
    const room = rooms.get(roomId);
    if (!room) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Oda bulunamadı.' });
      return;
    }

    // Sadece "Maça Katıl" (oyuncu olarak giriş) durumunda takım odaları üyelik gerektirir; "Maçı İzle" herkese açıktır!
    if (!watchOnly && room.isTeam && !socket.user) {
      if (typeof ack === 'function') {
        ack({
          ok: false,
          requireAuth: true,
          error: 'Takım kurmak, Seferoğulları / Tellioğulları maçlarına katılmak ve kostüm seçmek için lütfen hızlı üye olun veya giriş yapın! (Üye olmadan izlemek için "👀 İzle" butonunu kullanabilirsiniz.)'
        });
      }
      return;
    }

    // İsim kontrolü ve XSS temizliği
    let displayName = '';
    if (socket.user) {
      displayName = userStore.sanitizeText(socket.user.displayName || socket.user.username, 16);
    } else if (watchOnly) {
      displayName = userStore.sanitizeText(guestName, 14) || 'İzleyici';
    } else {
      displayName = userStore.sanitizeText(guestName, 14);
      if (displayName.length < 2) {
        if (typeof ack === 'function') {
          ack({ ok: false, error: 'Oyuna girmek için lütfen en az 2 harfli bir Slime Adı yazın!' });
        }
        return;
      }
    }

    leaveCurrentRoom(socket);

    // Eğer kullanıcı "👀 Maçı İzle" (watchOnly) seçtiyse:
    if (watchOnly) {
      // Eğer izlenmek istenen takım odasında henüz maç başlamamışsa eksik koltukları botlarla tamamlayıp maçı başlat ki izleyici canlı maç izleyebilsin
      if (room.isTeam && room.status !== 'playing') {
        const counts = getTeamCounts(room);
        const missingSefer = Math.max(0, room.teamSize - counts.seferCount);
        const missingTelli = Math.max(0, room.teamSize - counts.telliCount);
        for (let i = 0; i < missingSefer; i++) {
          createBotInRoom(room, { team: 'seferogullari' });
        }
        for (let i = 0; i < missingTelli; i++) {
          createBotInRoom(room, { team: 'telliogullari' });
        }
        startNewMatch(room);
      } else if (!room.isTeam && room.players.size === 0) {
        for (let i = 0; i < 4; i++) {
          createBotInRoom(room, {});
        }
        startNewMatch(room);
      }

      const watcher = {
        id: socket.id,
        roomId: room.id,
        name: displayName,
        username: socket.user ? socket.user.username : null,
        color: socket.user ? socket.user.color : '#00F5D4',
        skin: socket.user ? socket.user.skin : 'crown',
        equipped: socket.user ? socket.user.equipped : (socket.guestEquipped || null),
        team: null,
        isBot: false,
        isGuest: !socket.user,
        watchOnly: true,
        alive: false,
        waitingForWall: false,
        spectating: true,
        body: null,
        prevPos: { x: 0, y: 0 },
        bands: [],
        hasHadBands: false,
        lastBandTime: 0,
        lastArrowTime: 0,
        lastActivityAt: Date.now(),
        respawnAt: 0,
        score: 0,
        cuts: 0,
        kills: 0,
        input: { targetX: 0, targetY: 0 }
      };

      room.players.set(socket.id, watcher);
      socket.join(room.id);
      socket.currentRoomId = room.id;

      if (typeof ack === 'function') {
        ack({
          ok: true,
          roomId: room.id,
          roomName: room.name,
          isTeam: room.isTeam,
          teamSize: room.teamSize,
          team: null,
          spectating: true,
          watchOnly: true,
          roomStatus: room.status
        });
      }
      return;
    }

    // Takım odasında takım ataması (Gerçek oyuncular her zaman botların koltuğunu devralabilir!)
    let assignedTeam = null;
    if (room.isTeam) {
      const counts = getTeamCounts(room);
      if (counts.seferHumans >= room.teamSize && counts.telliHumans >= room.teamSize) {
        if (typeof ack === 'function') {
          ack({ ok: false, error: 'Bu takım odası şu an gerçek oyuncularla dolu! "👀 İzle" butonuyla maçı canlı izleyebilir veya başka oda seçebilirsiniz.' });
        }
        return;
      }

      if (preferredTeam === 'seferogullari' && counts.seferHumans < room.teamSize) {
        assignedTeam = 'seferogullari';
      } else if (preferredTeam === 'telliogullari' && counts.telliHumans < room.teamSize) {
        assignedTeam = 'telliogullari';
      } else if (counts.seferHumans <= counts.telliHumans && counts.seferHumans < room.teamSize) {
        assignedTeam = 'seferogullari';
      } else {
        assignedTeam = 'telliogullari';
      }

      // Seçilen takımda bot yüzünden koltuk doluysa 1 botu çıkarıp koltuğu gerçek oyuncuya ver
      const currentTeamTotal = assignedTeam === 'seferogullari' ? counts.seferCount : counts.telliCount;
      if (currentTeamTotal >= room.teamSize) {
        removeOneBotFromTeam(room, assignedTeam);
      }
    }

    const playerColor = room.isTeam && assignedTeam
      ? TEAMS[assignedTeam].color
      : socket.user
        ? socket.user.color
        : SLIME_COLORS[room.players.size % SLIME_COLORS.length].id;

    const activeEquipped = socket.user ? socket.user.equipped : (socket.guestEquipped || null);
    const playerSkin = (activeEquipped && activeEquipped.hat)
      ? activeEquipped.hat
      : socket.user
        ? socket.user.skin
        : 'crown';

    // "🚀 Maça Katıl" seçen oyuncu bekletilmeden doğrudan duvar seçimine (waitingForWall = true) alınır!
    let isSpectating = false;
    let isWaitingForWall = false;

    if (!room.isTeam) {
      let activeHumansInRoom = 0;
      for (const existingP of room.players.values()) {
        if (!existingP.isBot && !existingP.spectating && !existingP.watchOnly && existingP.id !== socket.id) {
          activeHumansInRoom++;
        }
      }

      if (room.status === 'playing' && activeHumansInRoom === 0) {
        // Odada sadece botlar varsa tur süresini ve bot skorlarını sıfırla
        room.matchStartTime = Date.now();
        room.matchEndTime = Date.now() + GAME_CONFIG.MATCH_DURATION_SEC * 1000;
        for (const botP of room.players.values()) {
          if (botP.isBot) {
            botP.score = 0;
            botP.cuts = 0;
            botP.kills = 0;
          }
        }
      } else if (room.status !== 'playing') {
        startNewMatch(room);
      }
      isSpectating = false;
      isWaitingForWall = true;
    } else {
      // Takım odasında maç oynanıyorsa doğrudan duvar seçimine geçer, bekleniyorsa kadro ekranı açılır
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
      equipped: activeEquipped,
      team: assignedTeam,
      isBot: false,
      isGuest: !socket.user,
      watchOnly: false,
      alive: false,
      waitingForWall: isWaitingForWall,
      spectating: isSpectating,
      body: null,
      prevPos: { x: 0, y: 0 },
      bands: [],
      hasHadBands: false,
      lastBandTime: 0,
      lastArrowTime: 0,
      lastActivityAt: Date.now(),
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
        watchOnly: false,
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
    player.lastActivityAt = Date.now();

    if (teamId !== 'seferogullari' && teamId !== 'telliogullari') return;
    if (player.team === teamId) {
      if (typeof ack === 'function') ack({ ok: true, team: teamId });
      return;
    }

    const counts = getTeamCounts(room);
    const targetHumanCount = teamId === 'seferogullari' ? counts.seferHumans : counts.telliHumans;
    const targetTotalCount = teamId === 'seferogullari' ? counts.seferCount : counts.telliCount;

    if (targetHumanCount >= room.teamSize) {
      if (typeof ack === 'function') {
        ack({ ok: false, error: `${teamId === 'seferogullari' ? 'Seferoğulları' : 'Tellioğulları'} kadrosu gerçek oyuncularla dolu!` });
      }
      return;
    }

    // Hedef takımda bot yüzünden yer yoksa 1 botu oyuncunun eski takımına kaydır
    if (targetTotalCount >= room.teamSize) {
      for (const p of room.players.values()) {
        if (p.isBot && p.team === teamId) {
          p.team = player.team;
          p.color = TEAMS[player.team].color;
          break;
        }
      }
    }

    player.team = teamId;
    player.color = TEAMS[teamId].color;
    checkTeamRoomReady(room);

    if (typeof ack === 'function') ack({ ok: true, team: teamId });
  });

  // Takım Bekleme Odasında "⚡ Eksik Kadroyu Botlarla Tamamla & Başlat"
  socket.on('fillTeamRoomWithBotsAndStart', (_payload, ack) => {
    const room = socket.currentRoomId ? rooms.get(socket.currentRoomId) : null;
    if (!room || !room.isTeam) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Takım odasında değilsiniz.' });
      return;
    }
    const counts = getTeamCounts(room);
    const missingSefer = Math.max(0, room.teamSize - counts.seferCount);
    const missingTelli = Math.max(0, room.teamSize - counts.telliCount);
    for (let i = 0; i < missingSefer; i++) {
      createBotInRoom(room, { team: 'seferogullari' });
    }
    for (let i = 0; i < missingTelli; i++) {
      createBotInRoom(room, { team: 'telliogullari' });
    }
    if (room.status !== 'playing') {
      startNewMatch(room);
    }
    io.emit('roomsSummary', getLobbyRoomsSummary());
    if (typeof ack === 'function') ack({ ok: true });
  });

  // Takım Bekleme Odasında Tekil Bot Ekle / Çıkar / İsim Değiştir
  socket.on('teamLobbyAddBot', (payload, ack) => {
    const room = socket.currentRoomId ? rooms.get(socket.currentRoomId) : null;
    if (!room || !room.isTeam) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Takım odasında değilsiniz.' });
      return;
    }
    const targetTeam = payload && (payload.team === 'seferogullari' || payload.team === 'telliogullari')
      ? payload.team
      : null;
    const counts = getTeamCounts(room);
    if (targetTeam === 'seferogullari' && counts.seferCount >= room.teamSize) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Seferoğulları kadrosu zaten dolu!' });
      return;
    }
    if (targetTeam === 'telliogullari' && counts.telliCount >= room.teamSize) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Tellioğulları kadrosu zaten dolu!' });
      return;
    }
    const bot = createBotInRoom(room, {
      team: targetTeam,
      name: payload && payload.name ? payload.name : ''
    });
    io.emit('roomsSummary', getLobbyRoomsSummary());
    const snap = buildAdminSnapshot();
    for (const sid of adminSockets) io.to(sid).emit('adminStateUpdate', snap);
    if (typeof ack === 'function') ack({ ok: Boolean(bot), botId: bot ? bot.id : null, botName: bot ? bot.name : null });
  });

  socket.on('teamLobbyRemoveBot', (payload, ack) => {
    const room = socket.currentRoomId ? rooms.get(socket.currentRoomId) : null;
    if (!room || !room.isTeam) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Takım odasında değilsiniz.' });
      return;
    }
    const botId = payload && payload.botId ? payload.botId : null;
    const removed = removeBotFromRoom(room, botId);
    io.emit('roomsSummary', getLobbyRoomsSummary());
    const snap = buildAdminSnapshot();
    for (const sid of adminSockets) io.to(sid).emit('adminStateUpdate', snap);
    if (typeof ack === 'function') ack({ ok: removed });
  });

  socket.on('teamLobbyRenameBot', (payload, ack) => {
    const room = socket.currentRoomId ? rooms.get(socket.currentRoomId) : null;
    if (!room) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Odada değilsiniz.' });
      return;
    }
    const botId = payload && payload.botId;
    const cleanNewName = userStore.sanitizeText((payload && payload.newName) || '', 16);
    const bot = botId ? room.players.get(botId) : null;
    if (!bot || !bot.isBot) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Bot bulunamadı.' });
      return;
    }
    if (!cleanNewName || cleanNewName.length < 2) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Bot adı en az 2 karakter olmalı.' });
      return;
    }
    const oldName = bot.name;
    bot.name = cleanNewName;
    userStore.renameVirtualBotProfile(oldName, cleanNewName);
    const snap = buildAdminSnapshot();
    for (const sid of adminSockets) io.to(sid).emit('adminStateUpdate', snap);
    if (typeof ack === 'function') ack({ ok: true, botId: bot.id, newName: bot.name });
  });

  socket.on('leaveRoom', () => {
    leaveCurrentRoom(socket);
  });

  // 4) Oyun İçi Aksiyonlar (NaN/Infinity Korumalı)
  socket.on('spawnAtWall', (point) => {
    const room = socket.currentRoomId ? rooms.get(socket.currentRoomId) : null;
    if (!room || room.status !== 'playing') return;
    const player = room.players.get(socket.id);
    if (player && !player.spectating && player.waitingForWall && isValidCoordPair(point)) {
      player.lastActivityAt = Date.now();
      spawnPlayerAtWallPoint(room, player, clampCoord(point.x), clampCoord(point.y));
    }
  });

  socket.on('shootArrow', (target) => {
    const room = socket.currentRoomId ? rooms.get(socket.currentRoomId) : null;
    if (!room || room.status !== 'playing') return;
    const player = room.players.get(socket.id);
    if (player && player.alive && isValidCoordPair(target)) {
      player.lastActivityAt = Date.now();
      shootSlimeArrow(room, player, clampCoord(target.x), clampCoord(target.y));
    }
  });

  socket.on('cutOwnBelt', (target) => {
    const room = socket.currentRoomId ? rooms.get(socket.currentRoomId) : null;
    if (!room || room.status !== 'playing') return;
    const player = room.players.get(socket.id);
    if (player && player.alive && isValidCoordPair(target)) {
      player.lastActivityAt = Date.now();
      cutOwnBeltInDirection(room, player, clampCoord(target.x), clampCoord(target.y));
    }
  });

  socket.on('mouseMove', (target) => {
    const room = socket.currentRoomId ? rooms.get(socket.currentRoomId) : null;
    if (!room) return;
    const player = room.players.get(socket.id);
    if (player && isValidCoordPair(target)) {
      const nx = clampCoord(target.x);
      const ny = clampCoord(target.y);
      if (Math.abs(nx - player.input.targetX) > 1.5 || Math.abs(ny - player.input.targetY) > 1.5) {
        player.lastActivityAt = Date.now();
      }
      player.input.targetX = nx;
      player.input.targetY = ny;
    }
  });

  // Yardımcı: Hedef oyuncuyu aktif odalarda (id, username veya görünen isim ile) bul
  function findLivePlayerAcrossRooms(targetId, targetUsername) {
    if (targetId) {
      for (const r of rooms.values()) {
        if (r.players.has(targetId)) {
          return { player: r.players.get(targetId), room: r };
        }
      }
    }
    if (targetUsername) {
      const clean = userStore.normalizeUsername(targetUsername);
      const rawLower = String(targetUsername).trim().toLowerCase();
      for (const r of rooms.values()) {
        for (const p of r.players.values()) {
          if (
            (p.username && userStore.normalizeUsername(p.username) === clean) ||
            (p.name && p.name.toLowerCase() === rawLower) ||
            (clean && p.name && userStore.normalizeUsername(p.name) === clean)
          ) {
            return { player: p, room: r };
          }
        }
      }
    }
    return { player: null, room: null };
  }

  // 5) Sosyal Sistem: Profil İnceleme, Takip Et / Arkadaş Ekleme, Oyuna Davet
  socket.on('inspectProfile', ({ targetId, targetUsername, fallbackSelf } = {}, ack) => {
    if (typeof ack !== 'function') return;

    const { player: livePlayer, room: liveRoom } = findLivePlayerAcrossRooms(targetId, targetUsername);

    let resolvedUser = null;
    if (targetUsername) {
      resolvedUser = userStore.getUserByUsername(targetUsername);
    }
    if (!resolvedUser && livePlayer) {
      resolvedUser = userStore.getUserByUsername(livePlayer.username || livePlayer.name);
    }

    const myFriendsList = socket.user
      ? socket.user.friends || []
      : Array.from(socket.guestFriends || []);

    if (resolvedUser) {
      const targetSocketId = usernameToSocketId.get(resolvedUser.username);
      const targetSocket = targetSocketId ? connectedSockets.get(targetSocketId) : null;
      const activeRoom = liveRoom || (targetSocket && targetSocket.currentRoomId ? rooms.get(targetSocket.currentRoomId) : null);
      const isFriend = myFriendsList.includes(resolvedUser.username);
      const isSelf =
        (targetId && targetId === socket.id) ||
        Boolean(socket.user && socket.user.username === resolvedUser.username);

      const mergedStats = livePlayer && resolvedUser.isVirtualProfile
        ? {
            totalScore: Math.max((resolvedUser.stats && resolvedUser.stats.totalScore) || 0, livePlayer.score || 0),
            totalCuts: Math.max((resolvedUser.stats && resolvedUser.stats.totalCuts) || 0, livePlayer.cuts || 0),
            totalKills: Math.max((resolvedUser.stats && resolvedUser.stats.totalKills) || 0, livePlayer.kills || 0),
            matchesPlayed: (resolvedUser.stats && resolvedUser.stats.matchesPlayed) || 1,
            wins: (resolvedUser.stats && resolvedUser.stats.wins) || 0
          }
        : resolvedUser.stats;

      ack({
        ok: true,
        profile: {
          targetId: livePlayer ? livePlayer.id : (targetSocket ? targetSocket.id : targetId || null),
          isSelf,
          isRegistered: !resolvedUser.isVirtualProfile,
          isBot: Boolean(resolvedUser.isBot || (livePlayer && livePlayer.isBot)),
          username: resolvedUser.username,
          displayName: livePlayer ? livePlayer.name : resolvedUser.displayName,
          fullName: resolvedUser.fullName,
          color: livePlayer ? livePlayer.color : resolvedUser.color,
          skin: (livePlayer && livePlayer.skin) || resolvedUser.skin || 'crown',
          friendCount: Math.max(resolvedUser.friendCount || 0, (livePlayer && livePlayer.followersCount) || 0),
          stats: mergedStats,
          isFriend,
          online: Boolean(targetSocket || livePlayer),
          currentRoomId: activeRoom ? activeRoom.id : null,
          currentRoomName: activeRoom ? activeRoom.shortName : null
        }
      });
      return;
    }

    if (livePlayer) {
      const handleKey = userStore.normalizeUsername(livePlayer.username || livePlayer.name || livePlayer.id);
      const isFriend = Boolean(handleKey && myFriendsList.includes(handleKey));
      const isSelf = livePlayer.id === socket.id;

      ack({
        ok: true,
        profile: {
          targetId: livePlayer.id,
          isSelf,
          isRegistered: false,
          username: handleKey || null,
          displayName: livePlayer.name,
          fullName: livePlayer.isBot ? 'Yapay Zeka (Bot)' : 'Misafir Oyuncu',
          color: livePlayer.color,
          skin: livePlayer.skin || 'crown',
          friendCount: livePlayer.followersCount || 0,
          stats: {
            totalScore: livePlayer.score || 0,
            totalCuts: livePlayer.cuts || 0,
            totalKills: livePlayer.kills || 0,
            matchesPlayed: 1,
            wins: 0
          },
          isFriend,
          online: true,
          isBot: Boolean(livePlayer.isBot),
          currentRoomId: liveRoom ? liveRoom.id : null,
          currentRoomName: liveRoom ? liveRoom.shortName : null
        }
      });
      return;
    }

    // Oyuncu henüz bir odaya girmemişse ve kendi profiline ("👤 Profilim") tıkladıysa
    if (!targetId || targetId === socket.id) {
      const guestName = (fallbackSelf && fallbackSelf.name) || 'Misafir Slime';
      const guestColor = (fallbackSelf && fallbackSelf.color) || '#00F5D4';
      const guestSkin = (fallbackSelf && fallbackSelf.skin) || 'crown';
      ack({
        ok: true,
        profile: {
          targetId: socket.id,
          isSelf: true,
          isRegistered: Boolean(socket.user),
          username: socket.user ? socket.user.username : userStore.normalizeUsername(guestName),
          displayName: socket.user ? socket.user.displayName : guestName,
          fullName: socket.user ? socket.user.fullName : 'Misafir Oyuncu (Lobide)',
          color: socket.user ? socket.user.color : guestColor,
          skin: socket.user ? socket.user.skin : guestSkin,
          friendCount: socket.user ? socket.user.friendCount || 0 : (socket.guestFriends ? socket.guestFriends.size : 0),
          stats: socket.user
            ? socket.user.stats
            : { totalScore: 0, totalCuts: 0, totalKills: 0, matchesPlayed: 0, wins: 0 },
          isFriend: false,
          online: true,
          isBot: false,
          currentRoomId: socket.currentRoomId || null,
          currentRoomName: null
        }
      });
      return;
    }

    ack({ ok: false, error: 'Oyuncu profili bulunamadı.' });
  });

  socket.on('addFriend', ({ targetUsername, targetId } = {}, ack) => {
    const { player: livePlayer } = findLivePlayerAcrossRooms(targetId, targetUsername);

    const fallbackProfile = livePlayer
      ? {
          displayName: livePlayer.name,
          fullName: livePlayer.isBot ? 'Yapay Zeka (Bot)' : 'Arena Oyuncusu',
          color: livePlayer.color,
          skin: livePlayer.skin || 'crown',
          isBot: Boolean(livePlayer.isBot),
          stats: {
            totalScore: livePlayer.score || 0,
            totalCuts: livePlayer.cuts || 0,
            totalKills: livePlayer.kills || 0,
            matchesPlayed: 1,
            wins: 0
          }
        }
      : null;

    const queryKey = targetUsername || (livePlayer ? livePlayer.username || livePlayer.name : '');

    // Üye girişi yapılmışsa kalıcı olarak (Supabase + userStore) takip et / arkadaş ekle
    if (socket.user) {
      const res = userStore.addFriend(socket.user.username, queryKey, fallbackProfile);
      if (res.ok) {
        socket.user = userStore.getUserByUsername(socket.user.username);
        if (livePlayer) {
          livePlayer.username = res.targetUsername;
          livePlayer.followersCount = res.targetFriendCount;
        }
        const targetSid = usernameToSocketId.get(userStore.normalizeUsername(res.targetUsername));
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
      return;
    }

    // Misafir oyuncu ise oturum boyunca takip listesine ekle
    const targetRec = userStore.ensureProfileRecord(queryKey, fallbackProfile);
    if (!targetRec) {
      if (typeof ack === 'function') {
        ack({ ok: false, error: 'Bu kullanıcı adına sahip bir oyuncu bulunamadı.' });
      }
      return;
    }
    if (livePlayer && livePlayer.id === socket.id) {
      if (typeof ack === 'function') {
        ack({ ok: false, error: 'Kendinizi takip edemezsiniz.' });
      }
      return;
    }

    if (!socket.guestFriends) socket.guestFriends = new Set();
    const alreadyHad = socket.guestFriends.has(targetRec.username);
    socket.guestFriends.add(targetRec.username);
    if (!alreadyHad && livePlayer) {
      livePlayer.followersCount = (livePlayer.followersCount || 0) + 1;
    }

    const targetSid = usernameToSocketId.get(targetRec.username);
    if (targetSid && connectedSockets.has(targetSid)) {
      io.to(targetSid).emit('friendAddedNotification', {
        fromUsername: 'misafir_oyuncu',
        fromDisplayName: 'Bir Oyuncu'
      });
    }

    if (typeof ack === 'function') {
      ack({
        ok: true,
        isGuestFollow: true,
        friendCount: socket.guestFriends.size,
        targetUsername: targetRec.username,
        targetDisplayName: targetRec.displayName || targetRec.username,
        friendsList: Array.from(socket.guestFriends)
      });
    }
  });

  socket.on('removeFriend', ({ targetUsername, targetId } = {}, ack) => {
    const { player: livePlayer } = findLivePlayerAcrossRooms(targetId, targetUsername);
    const queryKey = targetUsername || (livePlayer ? livePlayer.username || livePlayer.name : '');
    const cleanKey = userStore.normalizeUsername(queryKey);

    if (socket.user) {
      const res = userStore.removeFriend(socket.user.username, cleanKey);
      socket.user = userStore.getUserByUsername(socket.user.username);
      if (livePlayer && typeof res.targetFriendCount === 'number') {
        livePlayer.followersCount = res.targetFriendCount;
      }
      if (typeof ack === 'function') ack(res);
      return;
    }

    if (socket.guestFriends && socket.guestFriends.has(cleanKey)) {
      socket.guestFriends.delete(cleanKey);
      if (livePlayer && livePlayer.followersCount > 0) {
        livePlayer.followersCount -= 1;
      }
    }
    if (typeof ack === 'function') {
      ack({
        ok: true,
        isGuestFollow: true,
        friendCount: socket.guestFriends ? socket.guestFriends.size : 0,
        friendsList: socket.guestFriends ? Array.from(socket.guestFriends) : []
      });
    }
  });

  socket.on('getFriendsList', (payload, ack) => {
    const callback = typeof payload === 'function' ? payload : ack;
    if (typeof callback !== 'function') return;

    let friendKeys = [];
    if (socket.user) {
      const fresh = userStore.getUserByUsername(socket.user.username);
      socket.user = fresh;
      friendKeys = (fresh && fresh.friends) || [];
    } else {
      if (payload && Array.isArray(payload.guestFriends)) {
        if (!socket.guestFriends) socket.guestFriends = new Set();
        payload.guestFriends.forEach((k) => {
          const clean = userStore.normalizeUsername(k);
          if (clean) socket.guestFriends.add(clean);
        });
      }
      friendKeys = Array.from(socket.guestFriends || []);
    }

    const detailed = friendKeys.map((fUsername) => {
      const fUser = userStore.getUserByUsername(fUsername);
      const sid = usernameToSocketId.get(fUsername);
      const sock = sid ? connectedSockets.get(sid) : null;
      const { player: liveP, room: liveR } = findLivePlayerAcrossRooms(null, fUsername);
      const room = liveR || (sock && sock.currentRoomId ? rooms.get(sock.currentRoomId) : null);

      return {
        targetId: liveP ? liveP.id : (sock ? sock.id : null),
        username: fUsername,
        displayName: liveP ? liveP.name : (fUser ? fUser.displayName : fUsername),
        fullName: fUser ? fUser.fullName : (liveP && liveP.isBot ? 'Yapay Zeka (Bot)' : 'Oyuncu'),
        color: liveP ? liveP.color : (fUser ? fUser.color : '#00F5D4'),
        skin: (liveP && liveP.skin) || (fUser ? fUser.skin : 'crown'),
        friendCount: Math.max(fUser ? fUser.friendCount : 0, (liveP && liveP.followersCount) || 0),
        online: Boolean(sock || liveP),
        isBot: Boolean((fUser && fUser.isBot) || (liveP && liveP.isBot)),
        roomId: room ? room.id : null,
        roomName: room ? room.shortName : null
      };
    });

    callback({ ok: true, friendCount: detailed.length, friends: detailed });
  });

  socket.on('sendGameInvite', ({ targetUsername, targetId, roomId } = {}, ack) => {
    const { player: livePlayer } = findLivePlayerAcrossRooms(targetId, targetUsername);

    if (livePlayer && livePlayer.isBot) {
      if (typeof ack === 'function') {
        ack({ ok: true, isBot: true, message: `🤖 ${livePlayer.name} (Bot) davetinizi aldı ve arenada sizi bekliyor!` });
      }
      return;
    }

    const cleanTarget = userStore.normalizeUsername(targetUsername || (livePlayer && livePlayer.username) || '');
    let targetSid = cleanTarget ? usernameToSocketId.get(cleanTarget) : null;
    if (!targetSid && livePlayer && connectedSockets.has(livePlayer.id)) {
      targetSid = livePlayer.id;
    }

    if (!targetSid || !connectedSockets.has(targetSid)) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Bu oyuncu şu an çevrimiçi değil.' });
      return;
    }

    const useRoomId = roomId || socket.currentRoomId || 'ffa';
    const room = rooms.get(useRoomId);
    const myPlayer = room ? room.players.get(socket.id) : null;
    const senderName = socket.user
      ? socket.user.username
      : (myPlayer ? myPlayer.name : 'Bir Oyuncu');

    io.to(targetSid).emit('gameInviteReceived', {
      fromUsername: senderName,
      fromDisplayName: socket.user ? socket.user.displayName : senderName,
      roomId: useRoomId,
      roomName: room ? room.name : 'Savaş Arenası',
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
    io.emit('roomsSummary', getLobbyRoomsSummary());
    const snap = buildAdminSnapshot();
    for (const sid of adminSockets) io.to(sid).emit('adminStateUpdate', snap);
    if (typeof ack === 'function') {
      ack({
        ok: Boolean(bot),
        botId: bot ? bot.id : null,
        botName: bot ? bot.name : null,
        savedBotConfig: snap.savedBotConfig
      });
    }
  });

  socket.on('adminFillRoomWithBots', ({ roomId }, ack) => {
    if (!adminSockets.has(socket.id)) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Yetkisiz işlem!' });
      return;
    }
    const room = rooms.get(roomId);
    if (!room || !room.isTeam) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Takım odası bulunamadı.' });
      return;
    }
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
    io.emit('roomsSummary', getLobbyRoomsSummary());
    const snap = buildAdminSnapshot();
    for (const sid of adminSockets) io.to(sid).emit('adminStateUpdate', snap);
    if (typeof ack === 'function') ack({ ok: true, added, savedBotConfig: snap.savedBotConfig });
  });

  socket.on('adminRenameBot', ({ roomId, botId, newName }, ack) => {
    if (!adminSockets.has(socket.id)) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Yetkisiz işlem!' });
      return;
    }
    const room = rooms.get(roomId);
    const bot = room ? room.players.get(botId) : null;
    if (!bot || !bot.isBot) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Bot bulunamadı.' });
      return;
    }
    const cleanNewName = userStore.sanitizeText(newName || '', 16);
    if (!cleanNewName || cleanNewName.length < 2) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Yeni bot adı en az 2 karakter olmalıdır!' });
      return;
    }
    const oldName = bot.name;
    bot.name = cleanNewName;
    userStore.renameVirtualBotProfile(oldName, cleanNewName);
    persistCurrentAdminBotSettings();
    const snap = buildAdminSnapshot();
    for (const sid of adminSockets) io.to(sid).emit('adminStateUpdate', snap);
    if (typeof ack === 'function') {
      ack({ ok: true, botId: bot.id, newName: bot.name, savedBotConfig: snap.savedBotConfig });
    }
  });

  socket.on('adminRemoveBot', ({ roomId, botId }, ack) => {
    if (!adminSockets.has(socket.id)) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Yetkisiz işlem!' });
      return;
    }
    const room = rooms.get(roomId || 'ffa');
    const removed = removeBotFromRoom(room, botId);
    persistCurrentAdminBotSettings();
    io.emit('roomsSummary', getLobbyRoomsSummary());
    const snap = buildAdminSnapshot();
    for (const sid of adminSockets) io.to(sid).emit('adminStateUpdate', snap);
    if (typeof ack === 'function') ack({ ok: removed, savedBotConfig: snap.savedBotConfig });
  });

  socket.on('adminClearRoomBots', ({ roomId }, ack) => {
    if (!adminSockets.has(socket.id)) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Yetkisiz işlem!' });
      return;
    }
    const room = rooms.get(roomId || 'ffa');
    let removedCount = 0;
    if (room) {
      for (const [pid, p] of [...room.players.entries()]) {
        if (p.isBot) {
          clearPlayerPhysics(room, p);
          room.players.delete(pid);
          removedCount++;
        }
      }
      if (room.isTeam && room.status === 'starting_countdown') {
        const { seferCount, telliCount } = getTeamCounts(room);
        if (seferCount < room.teamSize || telliCount < room.teamSize) {
          room.status = 'waiting_for_teams';
        }
      }
    }
    persistCurrentAdminBotSettings();
    io.emit('roomsSummary', getLobbyRoomsSummary());
    const snap = buildAdminSnapshot();
    for (const sid of adminSockets) io.to(sid).emit('adminStateUpdate', snap);
    if (typeof ack === 'function') ack({ ok: true, removedCount, savedBotConfig: snap.savedBotConfig });
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

// Sunucu sağlık kontrolü (Render Health Check & Keep-Alive)
app.get('/healthz', (_req, res) => {
  res.status(200).json({ ok: true, uptime: Math.round(process.uptime()), ts: Date.now() });
});

// Beklenmeyen çalışma zamanı hatalarında sunucunun çökmesini (502 Bad Gateway) engelle
process.on('uncaughtException', (err) => {
  console.error('[Sunucu Koruması - uncaughtException]:', err && err.stack ? err.stack : err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Sunucu Koruması - unhandledRejection]:', reason);
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`[Slime.io v2.0] Online Sunucu Aktif: http://${HOST}:${PORT}`);

  // Render.com Free/Starter uyku modunu (15 dk inaktivite sonrası 502 Bad Gateway) önlemek için 8 dakikada bir harici Keep-Alive pingi
  const externalUrl = process.env.RENDER_EXTERNAL_URL || 'https://slimeio.com';
  setInterval(() => {
    fetch(`${externalUrl}/healthz`)
      .then((r) => {
        if (!r.ok) console.warn('[KeepAlive] Durum kodu:', r.status);
      })
      .catch((e) => {
        console.warn('[KeepAlive] Ping hatası:', e.message);
      });
  }, 8 * 60 * 1000);
});

