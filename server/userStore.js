const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { GAME_CONFIG, SLIME_COLORS, BASIC_10_SKINS, CHARACTER_UPGRADE_CONFIG } = require('../shared/constants');
const STORE_ITEMS = require('../public/storeItems.json');

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

let diskWriteTimer = null;

function flushUsersToDiskAsync() {
  diskWriteTimer = null;
  const serialized = JSON.stringify(usersDb, null, 2);
  fs.promises.writeFile(USERS_FILE, serialized, 'utf8').catch((err) => {
    console.error('[UserStore] Kullanıcı verisi diske yazılırken hata:', err.message);
  });
}

function saveUsers(immediateCloud = true) {
  if (immediateCloud) {
    if (diskWriteTimer) {
      clearTimeout(diskWriteTimer);
      diskWriteTimer = null;
    }
    flushUsersToDiskAsync();
    syncToSupabaseNow();
  } else {
    if (!diskWriteTimer) {
      diskWriteTimer = setTimeout(flushUsersToDiskAsync, 600);
    }
    scheduleCloudSync(1200);
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
  return BASIC_10_SKINS.some((s) => s.id === skin) || STORE_ITEMS.some((it) => it.id === skin && it.type === 'hat');
}

function ensureUserEconomy(u) {
  if (!u) return;
  if (!u.stats || typeof u.stats !== 'object') {
    u.stats = { totalScore: 0, totalCuts: 0, totalKills: 0, matchesPlayed: 0, wins: 0 };
  }
  if (typeof u.slimePoints !== 'number' || !Number.isFinite(u.slimePoints)) {
    const legacyBonus =
      (u.stats.totalCuts || 0) * (GAME_CONFIG.REWARD_POINT_PER_CUT || 25) +
      (u.stats.totalKills || 0) * (GAME_CONFIG.REWARD_POINT_PER_KILL || 75) +
      Math.round((u.stats.totalScore || 0) * (GAME_CONFIG.REWARD_POINT_SCORE_RATIO || 0.15));
    u.slimePoints = (GAME_CONFIG.STARTER_SLIME_POINTS || 500) + legacyBonus;
  }
  if (typeof u.slimeCoins !== 'number' || !Number.isFinite(u.slimeCoins)) {
    const winCoinBonus = (u.stats.wins || 0) * (GAME_CONFIG.REWARD_COIN_MATCH_WIN || 15);
    u.slimeCoins = (GAME_CONFIG.STARTER_SLIME_COINS || 100) + winCoinBonus;
  }
  if (!Array.isArray(u.ownedItems)) {
    u.ownedItems = [];
  }
  if (!u.equipped || typeof u.equipped !== 'object') {
    u.equipped = {
      hat: null,
      skin: null,
      belt: null,
      kill_effect: null,
      title: null
    };
  }
  if (!u.baseCharacter || !BASIC_10_SKINS.some((s) => s.id === u.baseCharacter)) {
    u.baseCharacter = BASIC_10_SKINS.some((s) => s.id === u.skin) ? u.skin : 'crown';
  }
  if (!u.characterLevels || typeof u.characterLevels !== 'object') {
    u.characterLevels = {};
  }
  const maxFree = (CHARACTER_UPGRADE_CONFIG && CHARACTER_UPGRADE_CONFIG.MAX_FREE_LEVEL) || 5.5;
  for (const s of BASIC_10_SKINS) {
    const rawLv = Number(u.characterLevels[s.id]);
    if (!Number.isFinite(rawLv) || rawLv < 1.0) {
      u.characterLevels[s.id] = 1.0;
    } else {
      u.characterLevels[s.id] = Math.min(maxFree, Math.round(rawLv * 2) / 2);
    }
  }
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
  const chosenBaseChar = BASIC_10_SKINS.some((s) => s.id === chosenSkin) ? chosenSkin : 'crown';
  const prevFriends = usersDb[cleanUser] && Array.isArray(usersDb[cleanUser].friends) ? usersDb[cleanUser].friends : [];

  const newUser = {
    username: cleanUser,
    displayName: cleanDisplayName,
    fullName: cleanFullName,
    salt,
    passwordHash: hash,
    color: chosenColor,
    skin: chosenSkin,
    baseCharacter: chosenBaseChar,
    characterLevels: {},
    friends: prevFriends,
    slimePoints: GAME_CONFIG.STARTER_SLIME_POINTS || 500,
    slimeCoins: GAME_CONFIG.STARTER_SLIME_COINS || 100,
    ownedItems: [],
    equipped: {
      hat: null,
      skin: null,
      belt: null,
      kill_effect: null,
      title: null
    },
    stats: {
      totalScore: 0,
      totalCuts: 0,
      totalKills: 0,
      matchesPlayed: 0,
      wins: 0
    },
    createdAt: Date.now()
  };

  ensureUserEconomy(newUser);
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

  ensureUserEconomy(record);
  return { ok: true, user: sanitizeUser(record) };
}

function restoreOrLoginUser({ username, password, fullName, displayName, color, skin, baseCharacter, characterLevels, friends, stats, slimePoints, slimeCoins, ownedItems, equipped }) {
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
    ensureUserEconomy(existing);
    let changed = false;
    if (color && isValidColor(color) && existing.color !== color) {
      existing.color = color;
      changed = true;
    }
    if (skin && isValidSkin(skin) && existing.skin !== skin) {
      existing.skin = skin;
      if (BASIC_10_SKINS.some((s) => s.id === skin)) {
        existing.baseCharacter = skin;
      }
      changed = true;
    }
    if (changed) saveUsers();
    return { ok: true, user: sanitizeUser(existing) };
  }

  // Sunucu yeniden başlatılmışsa (Render redeploy vb.) kullanıcının tarayıcı yedeklerinden hesabını otomatik geri yükle
  const { salt, hash } = hashPassword(rawPass);
  const validSkin = isValidSkin(skin) ? skin : BASIC_10_SKINS[0].id;
  const restored = {
    username: cleanUser,
    displayName: sanitizeText(displayName || username, 16) || cleanUser,
    fullName: sanitizeText(fullName || displayName || username, 36) || cleanUser,
    salt,
    passwordHash: hash,
    color: isValidColor(color) ? color : SLIME_COLORS[0].id,
    skin: validSkin,
    baseCharacter: BASIC_10_SKINS.some((s) => s.id === baseCharacter)
      ? baseCharacter
      : (BASIC_10_SKINS.some((s) => s.id === validSkin) ? validSkin : 'crown'),
    characterLevels: characterLevels && typeof characterLevels === 'object' ? { ...characterLevels } : {},
    friends: Array.isArray(friends) ? friends.map((f) => normalizeUsername(f)).filter(Boolean) : [],
    slimePoints: typeof slimePoints === 'number' ? slimePoints : (GAME_CONFIG.STARTER_SLIME_POINTS || 500),
    slimeCoins: typeof slimeCoins === 'number' ? slimeCoins : (GAME_CONFIG.STARTER_SLIME_COINS || 100),
    ownedItems: Array.isArray(ownedItems) ? ownedItems.filter((id) => typeof id === 'string') : [],
    equipped: equipped && typeof equipped === 'object'
      ? {
          hat: equipped.hat || null,
          skin: equipped.skin || null,
          belt: equipped.belt || null,
          kill_effect: equipped.kill_effect || null,
          title: equipped.title || null
        }
      : { hat: null, skin: null, belt: null, kill_effect: null, title: null },
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

  ensureUserEconomy(restored);
  usersDb[cleanUser] = restored;
  saveUsers();
  return { ok: true, user: sanitizeUser(restored) };
}

function updateUserCustomization(username, { color, skin, equipped, displayName, fullName }) {
  const cleanUser = normalizeUsername(username);
  const record = usersDb[cleanUser];
  if (!record) return { ok: false, error: 'Kullanıcı bulunamadı.' };

  ensureUserEconomy(record);
  if (color && isValidColor(color)) record.color = color;
  if (skin && isValidSkin(skin)) {
    record.skin = skin;
    // Lobiden ücretsiz/temel 10 karakterden biri seçildiyse temel karakteri güncelle ve mağaza şapkası kuşanmasını kaldır
    if (BASIC_10_SKINS.some((s) => s.id === skin)) {
      record.baseCharacter = skin;
      record.equipped.hat = null;
    }
  }
  if (typeof displayName === 'string') {
    const cleanDisp = sanitizeText(displayName, 16);
    if (cleanDisp.length >= 2) {
      record.displayName = cleanDisp;
    }
  }
  if (typeof fullName === 'string') {
    const cleanFull = sanitizeText(fullName, 36);
    if (cleanFull.length >= 2) {
      record.fullName = cleanFull;
    }
  }
  if (equipped && typeof equipped === 'object') {
    for (const slot of ['hat', 'skin', 'belt', 'kill_effect', 'title']) {
      if (slot in equipped) {
        const val = equipped[slot];
        if (!val || val === 'none') {
          record.equipped[slot] = null;
          if (slot === 'hat' && !BASIC_10_SKINS.some((s) => s.id === record.skin)) {
            record.skin = record.baseCharacter || 'crown';
          }
        } else if (record.ownedItems.includes(val)) {
          record.equipped[slot] = val;
          if (slot === 'hat') {
            record.skin = val;
          }
        }
      }
    }
  }
  saveUsers();

  return { ok: true, user: sanitizeUser(record) };
}

function updateUserProfileName(username, newName) {
  const cleanUser = normalizeUsername(username);
  const record = usersDb[cleanUser];
  if (!record) return { ok: false, error: 'Kullanıcı bulunamadı.' };

  const cleanDisp = sanitizeText(newName || '', 16);
  if (!cleanDisp || cleanDisp.length < 2) {
    return { ok: false, error: 'Yeni oyuncu adı en az 2 karakter olmalıdır!' };
  }

  ensureUserEconomy(record);
  record.displayName = cleanDisp;
  saveUsers();
  return { ok: true, user: sanitizeUser(record) };
}

function renameVirtualBotProfile(oldName, newName) {
  const oldKey = normalizeUsername(oldName);
  const cleanDisp = sanitizeText(newName || '', 16);
  if (!cleanDisp) return;
  if (oldKey && usersDb[oldKey] && usersDb[oldKey].isVirtualProfile) {
    usersDb[oldKey].displayName = cleanDisp;
    usersDb[oldKey].fullName = 'Yapay Zeka Slime Botu';
    saveUsers();
  }
}

function purchaseStoreItem(username, { itemId, currency = 'point' }) {
  const cleanUser = normalizeUsername(username);
  const record = usersDb[cleanUser];
  if (!record) return { ok: false, error: 'Satın alma işlemi için kullanıcı bulunamadı.' };

  ensureUserEconomy(record);
  const item = STORE_ITEMS.find((it) => it.id === itemId);
  if (!item) return { ok: false, error: 'Bu mağaza eşyası bulunamadı.' };

  if (record.ownedItems.includes(item.id)) {
    record.equipped[item.type] = item.id;
    if (item.type === 'hat') record.skin = item.id;
    saveUsers();
    return { ok: true, alreadyOwned: true, user: sanitizeUser(record), item };
  }

  if (currency === 'coin' || item.vipOnly || !item.pricePoint) {
    if (record.slimeCoins < item.priceCoin) {
      return {
        ok: false,
        error: `Yetersiz Slime Coin! Bu eşya için ${item.priceCoin} 🪙 gerekli (Mevcut: ${record.slimeCoins} 🪙).`
      };
    }
    record.slimeCoins -= item.priceCoin;
  } else {
    if (record.slimePoints < item.pricePoint) {
      return {
        ok: false,
        error: `Yetersiz Slime Puan! Bu eşya için ${item.pricePoint} 💎 gerekli (Mevcut: ${record.slimePoints} 💎). Oynayarak, kemer keserek ve rakip eleyerek puan kazanabilirsin!`
      };
    }
    record.slimePoints -= item.pricePoint;
  }

  record.ownedItems.push(item.id);
  record.equipped[item.type] = item.id;
  if (item.type === 'hat') {
    record.skin = item.id;
  }
  saveUsers();

  return { ok: true, user: sanitizeUser(record), item };
}

function equipStoreItem(username, { itemId, type, basicFallbackSkin }) {
  const cleanUser = normalizeUsername(username);
  const record = usersDb[cleanUser];
  if (!record) return { ok: false, error: 'Kullanıcı bulunamadı.' };

  ensureUserEconomy(record);
  const foundItem = itemId && itemId !== 'none' ? STORE_ITEMS.find((it) => it.id === itemId) : null;
  const resolvedType = type || (foundItem ? foundItem.type : null);
  const validSlots = ['hat', 'skin', 'belt', 'kill_effect', 'title'];
  if (!validSlots.includes(resolvedType)) {
    return { ok: false, error: 'Geçersiz ekipman kategorisi.' };
  }

  const isAlreadyEquipped = Boolean(itemId && record.equipped[resolvedType] === itemId);

  if (!itemId || itemId === 'none' || isAlreadyEquipped) {
    record.equipped[resolvedType] = null;
    if (resolvedType === 'hat') {
      if (basicFallbackSkin && BASIC_10_SKINS.some((s) => s.id === basicFallbackSkin)) {
        record.skin = basicFallbackSkin;
        record.baseCharacter = basicFallbackSkin;
      } else if (!BASIC_10_SKINS.some((s) => s.id === record.skin)) {
        record.skin = record.baseCharacter || 'crown';
      }
    }
    saveUsers();
    return { ok: true, unequipped: true, type: resolvedType, user: sanitizeUser(record) };
  }

  if (!record.ownedItems.includes(itemId)) {
    return { ok: false, error: 'Bu eşyaya henüz sahip değilsiniz!' };
  }

  record.equipped[resolvedType] = itemId;
  if (resolvedType === 'hat') {
    record.skin = itemId;
  }
  saveUsers();
  return { ok: true, unequipped: false, type: resolvedType, user: sanitizeUser(record) };
}

function upgradeCharacterLevel(username, { skinId }) {
  const cleanUser = normalizeUsername(username);
  const record = usersDb[cleanUser];
  if (!record) return { ok: false, error: 'Geliştirme işlemi için üye girişi yapmalısınız.' };

  ensureUserEconomy(record);
  const targetSkin = BASIC_10_SKINS.some((s) => s.id === skinId)
    ? skinId
    : (record.baseCharacter || 'crown');

  const maxFree = (CHARACTER_UPGRADE_CONFIG && CHARACTER_UPGRADE_CONFIG.MAX_FREE_LEVEL) || 5.5;
  const step = (CHARACTER_UPGRADE_CONFIG && CHARACTER_UPGRADE_CONFIG.LEVEL_STEP) || 0.5;
  const currentLevel = Math.round(Number(record.characterLevels[targetSkin] || 1.0) * 10) / 10;

  if (currentLevel >= maxFree) {
    return {
      ok: false,
      maxFreeReached: true,
      error: '🔒 Seviye 5.5 Ücretsiz Gelişim Sınırına ulaştınız! 5.5 üzeri Elit/VIP seviyeler yakında özel karakter ve ücretli ekipmanlarla açılacak.'
    };
  }

  const costKey = currentLevel.toFixed(1);
  const stepCosts = (CHARACTER_UPGRADE_CONFIG && CHARACTER_UPGRADE_CONFIG.STEP_COSTS) || {};
  const cost = Number(stepCosts[costKey] || 1000);

  if (record.slimePoints < cost) {
    return {
      ok: false,
      error: `Yetersiz Slime Puan! Seviye ${(currentLevel + step).toFixed(1)} geliştirmesi için ${cost} 💎 gerekli (Mevcut: ${record.slimePoints} 💎).`
    };
  }

  record.slimePoints -= cost;
  const nextLevel = Math.min(maxFree, Math.round((currentLevel + step) * 10) / 10);
  record.characterLevels[targetSkin] = nextLevel;
  record.baseCharacter = targetSkin;
  saveUsers();

  const charObj = BASIC_10_SKINS.find((s) => s.id === targetSkin);
  return {
    ok: true,
    skinId: targetSkin,
    charName: charObj ? charObj.name : targetSkin,
    newLevel: nextLevel,
    cost,
    user: sanitizeUser(record)
  };
}

function computePlayerCombatMods({ skin, baseCharacter, equipped, characterLevels }) {
  const resolvedBaseId = BASIC_10_SKINS.some((s) => s.id === baseCharacter)
    ? baseCharacter
    : (BASIC_10_SKINS.some((s) => s.id === skin) ? skin : 'crown');
  const charDef = BASIC_10_SKINS.find((s) => s.id === resolvedBaseId) || BASIC_10_SKINS[0];

  const maxFree = (CHARACTER_UPGRADE_CONFIG && CHARACTER_UPGRADE_CONFIG.MAX_FREE_LEVEL) || 5.5;
  const rawLv = characterLevels && typeof characterLevels === 'object' ? Number(characterLevels[charDef.id]) : 1.0;
  const charLevel = Math.min(maxFree, Math.max(1.0, Number.isFinite(rawLv) ? Math.round(rawLv * 2) / 2 : 1.0));
  const upgradeSteps = Math.max(0, Math.round((charLevel - 1.0) / 0.5)); // 0 .. 9 adım

  // Her +0.5 seviye geliştirmesi karaktere hissedilir ama dengeli bir rekabet gücü katar
  let speedMult = 1 + upgradeSteps * 0.008;
  let arrowSpeedMult = 1 + upgradeSteps * 0.009;
  let arrowSizeMult = 1 + upgradeSteps * 0.007;
  let arrowCooldownMult = 1 - upgradeSteps * 0.007;
  let fovMult = 1 - upgradeSteps * 0.004;
  let beltCooldownMult = 1 - upgradeSteps * 0.008;
  let beltHoldBonus = upgradeSteps * 0.01;
  let respawnReductionMs = upgradeSteps * 40;
  let massMult = 1 + upgradeSteps * 0.01;
  let killPointBonus = 0;
  let cutPointBonus = 0;
  let matchPointBonus = 0;
  let killSpeedBoost = 1;

  const applyModObj = (m) => {
    if (!m || typeof m !== 'object') return;
    if (typeof m.speedMult === 'number') speedMult *= m.speedMult;
    if (typeof m.arrowSpeedMult === 'number') arrowSpeedMult *= m.arrowSpeedMult;
    if (typeof m.arrowSizeMult === 'number') arrowSizeMult *= m.arrowSizeMult;
    if (typeof m.arrowCooldownMult === 'number') arrowCooldownMult *= m.arrowCooldownMult;
    if (typeof m.fovMult === 'number') fovMult *= m.fovMult;
    if (typeof m.beltCooldownMult === 'number') beltCooldownMult *= m.beltCooldownMult;
    if (typeof m.beltHoldBonus === 'number') beltHoldBonus += m.beltHoldBonus;
    if (typeof m.respawnReductionMs === 'number') respawnReductionMs += m.respawnReductionMs;
    if (typeof m.massMult === 'number') massMult *= m.massMult;
    if (typeof m.killPointBonus === 'number') killPointBonus += m.killPointBonus;
    if (typeof m.cutPointBonus === 'number') cutPointBonus += m.cutPointBonus;
    if (typeof m.matchPointBonus === 'number') matchPointBonus += m.matchPointBonus;
    if (typeof m.killSpeedBoost === 'number' && m.killSpeedBoost > killSpeedBoost) {
      killSpeedBoost = m.killSpeedBoost;
    }
  };

  // 1) Karakterin temel arketip gücü
  applyModObj(charDef.mods);

  // 2) Kuşanılan mağaza ekipmanlarının katkısı
  if (equipped && typeof equipped === 'object') {
    for (const slot of ['hat', 'skin', 'belt', 'kill_effect', 'title']) {
      const itemId = equipped[slot];
      if (!itemId) continue;
      const item = STORE_ITEMS.find((it) => it.id === itemId);
      if (item && item.mods) {
        applyModObj(item.mods);
      }
    }
  }

  return {
    charId: charDef.id,
    charLevel,
    speedMult: Math.min(1.24, Math.max(0.88, Number(speedMult.toFixed(3)))),
    arrowSpeedMult: Math.min(1.28, Math.max(0.85, Number(arrowSpeedMult.toFixed(3)))),
    arrowSizeMult: Math.min(1.38, Math.max(0.90, Number(arrowSizeMult.toFixed(3)))),
    arrowCooldownMult: Math.min(1.15, Math.max(0.76, Number(arrowCooldownMult.toFixed(3)))),
    fovMult: Math.min(1.02, Math.max(0.82, Number(fovMult.toFixed(3)))),
    beltCooldownMult: Math.min(1.10, Math.max(0.72, Number(beltCooldownMult.toFixed(3)))),
    beltHoldBonus: Math.min(0.45, Math.max(0, Number(beltHoldBonus.toFixed(3)))),
    respawnReductionMs: Math.min(1800, Math.max(0, Math.round(respawnReductionMs))),
    massMult: Math.min(1.35, Math.max(0.85, Number(massMult.toFixed(3)))),
    killPointBonus: Math.min(0.50, Math.max(0, Number(killPointBonus.toFixed(3)))),
    cutPointBonus: Math.min(0.50, Math.max(0, Number(cutPointBonus.toFixed(3)))),
    matchPointBonus: Math.min(0.50, Math.max(0, Number(matchPointBonus.toFixed(3)))),
    killSpeedBoost: Math.min(1.25, Math.max(1.0, Number(killSpeedBoost.toFixed(3))))
  };
}

function claimCoinPack(username, { coins = 250, points = 500 }) {
  const cleanUser = normalizeUsername(username);
  const record = usersDb[cleanUser];
  if (!record) return { ok: false, error: 'Kullanıcı bulunamadı.' };

  ensureUserEconomy(record);
  const safeCoins = Math.max(0, Math.min(2500, Number(coins) || 0));
  const safePoints = Math.max(0, Math.min(5000, Number(points) || 0));
  record.slimeCoins += safeCoins;
  record.slimePoints += safePoints;
  saveUsers();
  return { ok: true, user: sanitizeUser(record), addedCoins: safeCoins, addedPoints: safePoints };
}

function addLiveCombatRewards(username, { cuts = 0, kills = 0, scoreDelta = 0, earnedPoints = 0, earnedCoins = 0 }) {
  const cleanUser = normalizeUsername(username);
  const record = usersDb[cleanUser];
  if (!record) return null;

  ensureUserEconomy(record);
  record.stats.totalCuts += cuts;
  record.stats.totalKills += kills;
  record.stats.totalScore += scoreDelta;
  record.slimePoints += earnedPoints;
  record.slimeCoins += earnedCoins;
  saveUsers(false); // Debounced cloud sync
  return sanitizeUser(record);
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
    ensureUserEconomy(target);
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
    baseCharacter: BASIC_10_SKINS.some((s) => s.id === fallbackProfile.skin) ? fallbackProfile.skin : 'crown',
    characterLevels: {},
    friends: [],
    slimePoints: 500,
    slimeCoins: 100,
    ownedItems: [],
    equipped: { hat: null, skin: null, belt: null, kill_effect: null, title: null },
    stats: fallbackProfile.stats || {
      totalScore: 0,
      totalCuts: 0,
      totalKills: 0,
      matchesPlayed: 1,
      wins: 0
    },
    createdAt: Date.now()
  };

  ensureUserEconomy(virtualRecord);
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

function recordMatchStats(username, { score = 0, cuts = 0, kills = 0, won = false, earnedPoints = 0, earnedCoins = 0, alreadyCountedCombat = false }) {
  const key = normalizeUsername(username);
  const u = usersDb[key];
  if (!u) return null;
  ensureUserEconomy(u);

  if (!alreadyCountedCombat) {
    u.stats.totalScore += score;
    u.stats.totalCuts += cuts;
    u.stats.totalKills += kills;
  } else {
    u.stats.totalScore += score;
  }
  u.stats.matchesPlayed += 1;
  if (won) u.stats.wins += 1;

  u.slimePoints += earnedPoints;
  u.slimeCoins += earnedCoins;

  saveUsers();
  return sanitizeUser(u);
}

function sanitizeUser(u) {
  if (!u) return null;
  ensureUserEconomy(u);
  const baseChar = u.baseCharacter || (BASIC_10_SKINS.some((s) => s.id === u.skin) ? u.skin : 'crown');
  return {
    username: u.username,
    displayName: u.displayName || u.username,
    fullName: u.fullName,
    color: u.color || SLIME_COLORS[0].id,
    skin: u.skin || BASIC_10_SKINS[0].id,
    baseCharacter: baseChar,
    characterLevels: u.characterLevels || {},
    charLevel: Number((u.characterLevels && u.characterLevels[baseChar]) || 1.0),
    slimePoints: u.slimePoints,
    slimeCoins: u.slimeCoins,
    ownedItems: Array.isArray(u.ownedItems) ? u.ownedItems : [],
    equipped: u.equipped || { hat: null, skin: null, belt: null, kill_effect: null, title: null },
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

function getStoreItems() {
  return STORE_ITEMS;
}

module.exports = {
  normalizeUsername,
  sanitizeText,
  registerUser,
  loginUser,
  restoreOrLoginUser,
  updateUserCustomization,
  updateUserProfileName,
  renameVirtualBotProfile,
  purchaseStoreItem,
  equipStoreItem,
  upgradeCharacterLevel,
  computePlayerCombatMods,
  claimCoinPack,
  addLiveCombatRewards,
  getStoreItems,
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


