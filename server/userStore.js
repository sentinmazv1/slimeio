const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { SLIME_COLORS, BASIC_10_SKINS } = require('../shared/constants');

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ADMIN_SETTINGS_FILE = path.join(DATA_DIR, 'admin_settings.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let usersDb = {};
let adminSettingsDb = {
  initialized: false,
  updatedAt: 0,
  roomBots: null
};

function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, 'utf8');
      usersDb = JSON.parse(raw || '{}');
    }
  } catch (err) {
    console.error('[UserStore] Kullanıcı verisi okunurken hata:', err.message);
    usersDb = {};
  }
}

function saveUsers() {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(usersDb, null, 2), 'utf8');
  } catch (err) {
    console.error('[UserStore] Kullanıcı verisi kaydedilirken hata:', err.message);
  }
}

function loadAdminSettings() {
  try {
    if (fs.existsSync(ADMIN_SETTINGS_FILE)) {
      const raw = fs.readFileSync(ADMIN_SETTINGS_FILE, 'utf8');
      const parsed = JSON.parse(raw || '{}');
      if (parsed && parsed.roomBots) {
        adminSettingsDb = parsed;
      }
    }
  } catch (err) {
    console.error('[UserStore] Admin ayarları okunurken hata:', err.message);
  }
}

function saveAdminSettings(roomBotsMap) {
  try {
    adminSettingsDb = {
      initialized: true,
      updatedAt: Date.now(),
      roomBots: roomBotsMap
    };
    fs.writeFileSync(ADMIN_SETTINGS_FILE, JSON.stringify(adminSettingsDb, null, 2), 'utf8');
  } catch (err) {
    console.error('[UserStore] Admin ayarları kaydedilirken hata:', err.message);
  }
  return adminSettingsDb;
}

function getAdminSettings() {
  return adminSettingsDb;
}

loadUsers();
loadAdminSettings();

function hashPassword(password, salt) {
  const usedSalt = salt || crypto.randomBytes(12).toString('hex');
  const hash = crypto.pbkdf2Sync(String(password), usedSalt, 1000, 32, 'sha256').toString('hex');
  return { salt: usedSalt, hash };
}

function normalizeUsername(u) {
  return String(u || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_ğüşıöç]/gi, '')
    .substring(0, 16);
}

function isValidColor(color) {
  return SLIME_COLORS.some((c) => c.id === color);
}

function isValidSkin(skin) {
  return BASIC_10_SKINS.some((s) => s.id === skin);
}

function registerUser({ fullName, username, password, color, skin }) {
  const cleanUser = normalizeUsername(username);
  const cleanFullName = String(fullName || '').trim().substring(0, 36);
  const rawPass = String(password || '').trim();

  if (!cleanFullName || cleanFullName.length < 2) {
    return { ok: false, error: 'Lütfen geçerli bir İsim Soyisim giriniz (en az 2 karakter).' };
  }
  if (!cleanUser || cleanUser.length < 3) {
    return { ok: false, error: 'Kullanıcı adı en az 3 karakter olmalıdır.' };
  }
  if (rawPass.length < 4) {
    return { ok: false, error: 'Şifre en az 4 karakter olmalıdır.' };
  }
  if (usersDb[cleanUser]) {
    return { ok: false, error: 'Bu kullanıcı adı zaten alınmış! Giriş yapabilir veya başka ad seçebilirsiniz.' };
  }

  const { salt, hash } = hashPassword(rawPass);
  const chosenColor = isValidColor(color) ? color : SLIME_COLORS[0].id;
  const chosenSkin = isValidSkin(skin) ? skin : BASIC_10_SKINS[0].id;

  const newUser = {
    username: cleanUser,
    displayName: String(username).trim().substring(0, 16),
    fullName: cleanFullName,
    salt,
    passwordHash: hash,
    color: chosenColor,
    skin: chosenSkin,
    friends: [],
    stats: {
      totalScore: 0,
      totalCuts: 0,
      totalKills: 0,
      matchesPlayed: 0,
      wins: 0
    },
    createdAt: Date.now()
  };

  usersDb[cleanUser] = newUser;
  saveUsers();

  return { ok: true, user: sanitizeUser(newUser) };
}

function loginUser({ username, password }) {
  const cleanUser = normalizeUsername(username);
  const record = usersDb[cleanUser];
  if (!record) {
    return { ok: false, error: 'Kullanıcı bulunamadı. Lütfen kullanıcı adınızı kontrol edin veya kayıt olun.' };
  }

  const { hash } = hashPassword(String(password || '').trim(), record.salt);
  if (hash !== record.passwordHash) {
    return { ok: false, error: 'Hatalı şifre! Lütfen tekrar deneyin.' };
  }

  return { ok: true, user: sanitizeUser(record) };
}

function restoreOrLoginUser({ username, password, fullName, displayName, color, skin, friends, stats }) {
  const cleanUser = normalizeUsername(username);
  const rawPass = String(password || '').trim();
  if (!cleanUser || cleanUser.length < 3 || rawPass.length < 4) {
    return { ok: false, error: 'Geçersiz oturum bilgisi.' };
  }

  const existing = usersDb[cleanUser];
  if (existing) {
    const { hash } = hashPassword(rawPass, existing.salt);
    if (hash !== existing.passwordHash) {
      return { ok: false, error: 'Hatalı şifre!' };
    }
    let changed = false;
    if (color && isValidColor(color) && existing.color !== color) {
      existing.color = color;
      changed = true;
    }
    if (skin && isValidSkin(skin) && existing.skin !== skin) {
      existing.skin = skin;
      changed = true;
    }
    if (changed) saveUsers();
    return { ok: true, user: sanitizeUser(existing) };
  }

  // Sunucu yeniden başlatılmışsa (Render redeploy vb.) kullanıcının tarayıcı yedeklerinden hesabını otomatik geri yükle
  const { salt, hash } = hashPassword(rawPass);
  const restored = {
    username: cleanUser,
    displayName: String(displayName || username).trim().substring(0, 16),
    fullName: String(fullName || displayName || username).trim().substring(0, 36),
    salt,
    passwordHash: hash,
    color: isValidColor(color) ? color : SLIME_COLORS[0].id,
    skin: isValidSkin(skin) ? skin : BASIC_10_SKINS[0].id,
    friends: Array.isArray(friends) ? friends.map((f) => normalizeUsername(f)).filter(Boolean) : [],
    stats: stats && typeof stats === 'object'
      ? {
          totalScore: Number(stats.totalScore) || 0,
          totalCuts: Number(stats.totalCuts) || 0,
          totalKills: Number(stats.totalKills) || 0,
          matchesPlayed: Number(stats.matchesPlayed) || 0,
          wins: Number(stats.wins) || 0
        }
      : { totalScore: 0, totalCuts: 0, totalKills: 0, matchesPlayed: 0, wins: 0 },
    createdAt: Date.now()
  };

  usersDb[cleanUser] = restored;
  saveUsers();
  return { ok: true, user: sanitizeUser(restored) };
}

function updateUserCustomization(username, { color, skin }) {
  const cleanUser = normalizeUsername(username);
  const record = usersDb[cleanUser];
  if (!record) return { ok: false, error: 'Kullanıcı bulunamadı.' };

  if (color && isValidColor(color)) record.color = color;
  if (skin && isValidSkin(skin)) record.skin = skin;
  saveUsers();

  return { ok: true, user: sanitizeUser(record) };
}

function addFriend(myUsername, targetUsername) {
  const meKey = normalizeUsername(myUsername);
  const targetKey = normalizeUsername(targetUsername);

  if (!meKey || !targetKey || meKey === targetKey) {
    return { ok: false, error: 'Kendinizi arkadaş olarak ekleyemezsiniz.' };
  }

  const me = usersDb[meKey];
  const target = usersDb[targetKey];
  if (!me) return { ok: false, error: 'Önce üye girişi yapmalısınız.' };
  if (!target) return { ok: false, error: 'Bu kullanıcı adına sahip bir üye bulunamadı.' };

  if (!Array.isArray(me.friends)) me.friends = [];
  if (!Array.isArray(target.friends)) target.friends = [];

  if (!me.friends.includes(targetKey)) {
    me.friends.push(targetKey);
  }
  if (!target.friends.includes(meKey)) {
    target.friends.push(meKey);
  }
  saveUsers();

  return {
    ok: true,
    friendCount: me.friends.length,
    targetDisplayName: target.displayName || target.username
  };
}

function removeFriend(myUsername, targetUsername) {
  const meKey = normalizeUsername(myUsername);
  const targetKey = normalizeUsername(targetUsername);
  const me = usersDb[meKey];
  const target = usersDb[targetKey];
  if (!me) return { ok: false };

  me.friends = (me.friends || []).filter((u) => u !== targetKey);
  if (target && Array.isArray(target.friends)) {
    target.friends = target.friends.filter((u) => u !== meKey);
  }
  saveUsers();
  return { ok: true, friendCount: me.friends.length };
}

function recordMatchStats(username, { score = 0, cuts = 0, kills = 0, won = false }) {
  const key = normalizeUsername(username);
  const u = usersDb[key];
  if (!u) return;
  if (!u.stats) {
    u.stats = { totalScore: 0, totalCuts: 0, totalKills: 0, matchesPlayed: 0, wins: 0 };
  }
  u.stats.totalScore += score;
  u.stats.totalCuts += cuts;
  u.stats.totalKills += kills;
  u.stats.matchesPlayed += 1;
  if (won) u.stats.wins += 1;
  saveUsers();
}

function sanitizeUser(u) {
  if (!u) return null;
  return {
    username: u.username,
    displayName: u.displayName || u.username,
    fullName: u.fullName,
    color: u.color || SLIME_COLORS[0].id,
    skin: u.skin || BASIC_10_SKINS[0].id,
    friendCount: Array.isArray(u.friends) ? u.friends.length : 0,
    friends: Array.isArray(u.friends) ? u.friends : [],
    stats: u.stats || { totalScore: 0, totalCuts: 0, totalKills: 0, matchesPlayed: 0, wins: 0 }
  };
}

function getUserByUsername(username) {
  const key = normalizeUsername(username);
  return sanitizeUser(usersDb[key]);
}

function getTotalRegisteredCount() {
  return Object.keys(usersDb).length;
}

module.exports = {
  normalizeUsername,
  registerUser,
  loginUser,
  restoreOrLoginUser,
  updateUserCustomization,
  addFriend,
  removeFriend,
  recordMatchStats,
  getUserByUsername,
  getTotalRegisteredCount,
  getAdminSettings,
  saveAdminSettings
};
