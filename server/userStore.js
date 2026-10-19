const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { SLIME_COLORS, BASIC_10_SKINS } = require('../shared/constants');

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ADMIN_SETTINGS_FILE = path.join(DATA_DIR, 'admin_settings.json');

// Supabase Bulut Veritabanı Yapılandırması
const DEFAULT_SB_KEY = Buffer.from('c2Jfc2VjcmV0XzV3NThXR3RVZV9DV0hNcXhJcEk1aWdfWDgtQVJjYWc=', 'base64').toString('utf8');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tbaczgvgeplexrwyvkrf.supabase.co';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || DEFAULT_SB_KEY;
const SUPABASE_BUCKET = 'slimeio-db';
const SUPABASE_STATE_OBJECT = 'state.json';

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let usersDb = {};
let adminSettingsDb = {
  initialized: false,
  updatedAt: 0,
  roomBots: null
};

let supabaseConnected = false;
let lastCloudSyncAt = 0;
let cloudSyncTimer = null;
let cloudSyncInProgress = false;
let pendingCloudSync = false;

async function syncToSupabaseNow() {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) return false;
  if (cloudSyncInProgress) {
    pendingCloudSync = true;
    return false;
  }
  cloudSyncInProgress = true;
  try {
    const payload = {
      updatedAt: Date.now(),
      users: usersDb,
      adminSettings: adminSettingsDb
    };
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${SUPABASE_STATE_OBJECT}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
        'Content-Type': 'application/json',
        'x-upsert': 'true'
      },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      supabaseConnected = true;
      lastCloudSyncAt = Date.now();
    } else {
      console.error('[Supabase] Kayıt hatası:', res.status, await res.text());
    }
  } catch (err) {
    console.error('[Supabase] Bağlantı hatası:', err.message);
  } finally {
    cloudSyncInProgress = false;
    if (pendingCloudSync) {
      pendingCloudSync = false;
      scheduleCloudSync(150);
    }
  }
  return supabaseConnected;
}

function scheduleCloudSync(delayMs = 200) {
  if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(() => {
    cloudSyncTimer = null;
    syncToSupabaseNow();
  }, delayMs);
}

async function initCloudStore() {
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) return null;
  try {
    // 1) Bucket yoksa oluştur
    await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ id: SUPABASE_BUCKET, name: SUPABASE_BUCKET, public: false })
    }).catch(() => {});

    // 2) Buluttaki state.json verisini çek
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${SUPABASE_STATE_OBJECT}?t=${Date.now()}`, {
      headers: {
        apikey: SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
        'Cache-Control': 'no-cache'
      }
    });

    if (res.ok) {
      const cloudData = await res.json();
      supabaseConnected = true;
      lastCloudSyncAt = Date.now();

      if (cloudData && cloudData.users && typeof cloudData.users === 'object') {
        usersDb = { ...usersDb, ...cloudData.users };
        try {
          fs.writeFileSync(USERS_FILE, JSON.stringify(usersDb, null, 2), 'utf8');
        } catch (_e) {}
      }

      if (cloudData && cloudData.adminSettings && cloudData.adminSettings.initialized && cloudData.adminSettings.roomBots) {
        adminSettingsDb = cloudData.adminSettings;
        try {
          fs.writeFileSync(ADMIN_SETTINGS_FILE, JSON.stringify(adminSettingsDb, null, 2), 'utf8');
        } catch (_e) {}
      }

      console.log(`[Supabase] Bulut veritabanı senkronize edildi (${Object.keys(usersDb).length} üye).`);
      return { users: usersDb, adminSettings: adminSettingsDb };
    } else {
      // İlk kez oluşturuluyorsa mevcut veriyi buluta yaz
      await syncToSupabaseNow();
    }
  } catch (err) {
    console.error('[Supabase] Başlangıç yükleme hatası:', err.message);
  }
  return { users: usersDb, adminSettings: adminSettingsDb };
}

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

function saveUsers(immediateCloud = true) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(usersDb, null, 2), 'utf8');
  } catch (err) {
    console.error('[UserStore] Kullanıcı verisi kaydedilirken hata:', err.message);
  }
  if (immediateCloud) {
    syncToSupabaseNow();
  } else {
    scheduleCloudSync(400);
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
  syncToSupabaseNow();
  return adminSettingsDb;
}

function getAdminSettings() {
  return adminSettingsDb;
}

function isCloudConnected() {
  return supabaseConnected;
}

function getLastCloudSyncAt() {
  return lastCloudSyncAt;
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

function sanitizeText(str, maxLen = 24) {
  return String(str || '')
    .replace(/[<>"'`\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, maxLen);
}

function pruneExcessVirtualProfiles() {
  const virtualKeys = Object.keys(usersDb).filter((k) => usersDb[k] && usersDb[k].isVirtualProfile);
  if (virtualKeys.length <= 300) return;
  virtualKeys.sort((a, b) => ((usersDb[a] && usersDb[a].createdAt) || 0) - ((usersDb[b] && usersDb[b].createdAt) || 0));
  const toRemove = virtualKeys.slice(0, virtualKeys.length - 300);
  for (const k of toRemove) {
    delete usersDb[k];
  }
}

function isValidColor(color) {
  return SLIME_COLORS.some((c) => c.id === color);
}

function isValidSkin(skin) {
  return BASIC_10_SKINS.some((s) => s.id === skin);
}

function registerUser({ fullName, username, password, color, skin }) {
  const cleanUser = normalizeUsername(username);
  const cleanFullName = sanitizeText(fullName, 36);
  const cleanDisplayName = sanitizeText(username, 16) || cleanUser;
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
  if (usersDb[cleanUser] && !usersDb[cleanUser].isVirtualProfile) {
    return { ok: false, error: 'Bu kullanıcı adı zaten alınmış! Giriş yapabilir veya başka ad seçebilirsiniz.' };
  }

  const { salt, hash } = hashPassword(rawPass);
  const chosenColor = isValidColor(color) ? color : SLIME_COLORS[0].id;
  const chosenSkin = isValidSkin(skin) ? skin : BASIC_10_SKINS[0].id;
  const prevFriends = usersDb[cleanUser] && Array.isArray(usersDb[cleanUser].friends) ? usersDb[cleanUser].friends : [];

  const newUser = {
    username: cleanUser,
    displayName: cleanDisplayName,
    fullName: cleanFullName,
    salt,
    passwordHash: hash,
    color: chosenColor,
    skin: chosenSkin,
    friends: prevFriends,
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
  if (!record || record.isVirtualProfile) {
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
  if (existing && !existing.isVirtualProfile) {
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
    displayName: sanitizeText(displayName || username, 16) || cleanUser,
    fullName: sanitizeText(fullName || displayName || username, 36) || cleanUser,
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

function findUserRecord(query) {
  if (!query) return null;
  const key = normalizeUsername(query);
  if (key && usersDb[key]) return usersDb[key];
  const rawLower = String(query).trim().toLowerCase();
  for (const u of Object.values(usersDb)) {
    if (
      (u.displayName && u.displayName.toLowerCase() === rawLower) ||
      (u.username && u.username.toLowerCase() === rawLower) ||
      (key && normalizeUsername(u.displayName) === key)
    ) {
      return u;
    }
  }
  return null;
}

function ensureProfileRecord(targetUsernameOrName, fallbackProfile) {
  let target = findUserRecord(targetUsernameOrName);
  if (target) {
    if (fallbackProfile && target.isVirtualProfile) {
      if (fallbackProfile.color) target.color = fallbackProfile.color;
      if (fallbackProfile.skin) target.skin = fallbackProfile.skin;
      if (fallbackProfile.stats) target.stats = fallbackProfile.stats;
    }
    return target;
  }
  if (!fallbackProfile) return null;

  const cleanKey = normalizeUsername(targetUsernameOrName || fallbackProfile.displayName || 'oyuncu');
  if (!cleanKey) return null;

  const virtualRecord = {
    username: cleanKey,
    displayName: sanitizeText(fallbackProfile.displayName || targetUsernameOrName || cleanKey, 16) || cleanKey,
    fullName: sanitizeText(fallbackProfile.fullName || (fallbackProfile.isBot ? 'Yapay Zeka (Bot)' : 'Arena Oyuncusu'), 36),
    salt: '',
    passwordHash: '',
    isVirtualProfile: true,
    isBot: Boolean(fallbackProfile.isBot),
    color: isValidColor(fallbackProfile.color) ? fallbackProfile.color : (fallbackProfile.color || SLIME_COLORS[0].id),
    skin: isValidSkin(fallbackProfile.skin) ? fallbackProfile.skin : 'crown',
    friends: [],
    stats: fallbackProfile.stats || {
      totalScore: 0,
      totalCuts: 0,
      totalKills: 0,
      matchesPlayed: 1,
      wins: 0
    },
    createdAt: Date.now()
  };

  usersDb[cleanKey] = virtualRecord;
  pruneExcessVirtualProfiles();
  return virtualRecord;
}

function addFriend(myUsername, targetUsername, fallbackProfile = null) {
  const meKey = normalizeUsername(myUsername);
  const me = usersDb[meKey];
  if (!me) return { ok: false, error: 'Önce üye girişi yapmalısınız.' };

  const target = ensureProfileRecord(targetUsername, fallbackProfile);
  if (!target) {
    return { ok: false, error: 'Bu kullanıcı adına sahip bir oyuncu bulunamadı.' };
  }

  const targetKey = target.username;
  if (!meKey || !targetKey || meKey === targetKey) {
    return { ok: false, error: 'Kendinizi takip edemez / arkadaş ekleyemezsiniz.' };
  }

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
    targetUsername: target.username,
    targetDisplayName: target.displayName || target.username,
    targetFriendCount: target.friends.length
  };
}

function removeFriend(myUsername, targetUsername) {
  const meKey = normalizeUsername(myUsername);
  const me = usersDb[meKey];
  if (!me) return { ok: false };

  const target = findUserRecord(targetUsername);
  const targetKey = target ? target.username : normalizeUsername(targetUsername);

  me.friends = (me.friends || []).filter((u) => u !== targetKey);
  if (target && Array.isArray(target.friends)) {
    target.friends = target.friends.filter((u) => u !== meKey);
  }
  saveUsers();
  return {
    ok: true,
    friendCount: me.friends.length,
    targetFriendCount: target && Array.isArray(target.friends) ? target.friends.length : 0
  };
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
    isBot: Boolean(u.isBot),
    isVirtualProfile: Boolean(u.isVirtualProfile),
    friendCount: Array.isArray(u.friends) ? u.friends.length : 0,
    friends: Array.isArray(u.friends) ? u.friends : [],
    stats: u.stats || { totalScore: 0, totalCuts: 0, totalKills: 0, matchesPlayed: 0, wins: 0 }
  };
}

function getUserByUsername(username) {
  const rec = findUserRecord(username);
  return sanitizeUser(rec);
}

function getTotalRegisteredCount() {
  return Object.values(usersDb).filter((u) => !u.isVirtualProfile).length;
}

module.exports = {
  normalizeUsername,
  sanitizeText,
  registerUser,
  loginUser,
  restoreOrLoginUser,
  updateUserCustomization,
  ensureProfileRecord,
  addFriend,
  removeFriend,
  recordMatchStats,
  getUserByUsername,
  getTotalRegisteredCount,
  getAdminSettings,
  saveAdminSettings,
  initCloudStore,
  syncToSupabaseNow,
  isCloudConnected,
  getLastCloudSyncAt
};
