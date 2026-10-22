// Hem sunucu (Node.js) hem istemci (Tarayıcı) tarafından kullanılan ortak sabitler
(function (exports) {
  exports.GAME_CONFIG = {
    TICK_RATE: 60,                 // Saniyedeki fizik güncelleme sayısı (Hz)
    NETWORK_RATE: 30,              // Saniyedeki ağ paketi gönderim sayısı (Hz)
    MATCH_DURATION_SEC: 180,       // 3 dakikalık maç süresi
    RESPAWN_DELAY_MS: 5000,        // Ölüm sonrası 5 saniye bekleme
    TEAM_START_COUNTDOWN_SEC: 5,   // Takımlar dolduğunda maç başlamadan önceki uyarı süresi (sn)

    // Açık Dünya Neon Savaş Arenası Boyutları
    ARENA_WIDTH: 4800,             // Geniş açık dünya (-2400 .. +2400)
    ARENA_HEIGHT: 3000,            // Yükseklik (-1500 .. +1500)
    WALL_THICKNESS: 100,

    // Slime (Oyuncu) Fizik Parametreleri (Uzayda akıcı ve fareye duyarlı süzülme)
    PLAYER_RADIUS: 24,
    PLAYER_MASS: 5,
    PLAYER_FRICTION_AIR: 0.045,
    PLAYER_RESTITUTION: 0.88,
    BASE_MOVE_FORCE: 0.038,
    MAX_INPUT_DIST: 220,
    WALL_BOUNCE_SPEED: 8.5,

    // Kemer (Uzay Bağı) Parametreleri - Uzama Sınırı Yok & Çok Zayıf Çekim
    MAX_BANDS: 99,
    TETHER_PULL_STRENGTH: 0.0000010,
    MAX_TETHER_FORCE_PER_BAND: 0.00040,
    MIN_ANCHOR_DISTANCE: 80,
    BAND_COOLDOWN_MS: 240,

    // Slime Oku (Sol Tık Saldırı) Parametreleri
    ARROW_SPEED: 23,
    ARROW_RADIUS: 10,
    ARROW_LIFETIME_MS: 2300,
    ARROW_COOLDOWN_MS: 170,

    // Aktif Skor Sistemi Puanları
    SCORE_PER_BELT_ATTACH: 15,
    SCORE_PER_BELT_CUT: 50,
    SCORE_PER_ARROW_HIT: 75,
    SCORE_PER_KILL: 150,
    SCORE_HOLD_PER_BELT_SEC: 2,
    SCORE_PER_POWERUP: 25,

    // 10 Saniyelik Geçici Güçlendirme (Power-Up) Sistemi Ayarları
    POWERUP_DURATION_MS: 10000,         // Tam 10 saniye (10000 ms) aktif kalır
    POWERUP_SPAWN_INTERVAL_MS: 6000,    // Her 6 saniyede bir rastgele koordinatta yeni kutu belirir
    MAX_POWERUPS_PER_ROOM: 5,           // Haritada aynı anda bulunabilecek maksimum kutu sayısı
    POWERUP_RADIUS: 22,                 // Güçlendirme kutusu çarpışma yarıçapı
    POWERUP_SPEED_MULTIPLIER: 1.72,     // Yüksek Hız gücü hareket hızı çarpanı (+%72 hız)
    POWERUP_WIDE_CAM_MULTIPLIER: 0.65,  // Geniş Kamera FOV zoom-out çarpanı
    POWERUP_DOUBLE_SHOT_SPREAD_RAD: 0.16, // İkili Atış V-açısı (radyan)

    // Online Sunucu & AFK Askıya Alma Ayarları
    MIN_TOTAL_PLAYERS_WITH_BOTS: 6,
    MAX_PLAYERS_PER_ROOM: 40,
    AFK_TIMEOUT_MS: 3 * 60 * 1000,      // 3 dakika (180 sn) hareketsiz kalan oyuncuyu askıya al

    // Slime Mağazası & Kariyer Puan/Coin Kazanım Kurgusu (Zorlu & Uzun Vadeli Rekabet Ekonomisi - 1 Saatte Lv.5 Olunamaz)
    STARTER_SLIME_POINTS: 60,           // Yeni oyunculara başlangıç Slime Puanı
    STARTER_SLIME_COINS: 10,            // Yeni oyunculara başlangıç Slime Coin
    REWARD_POINT_PER_CUT: 2,            // Her kemer kesimi (✂️) başına +2 Slime Puan
    REWARD_POINT_PER_KILL: 6,           // Her rakip eleme (💀) başına +6 Slime Puan
    REWARD_POINT_SCORE_RATIO: 0.01,     // Maç skoru üzerinden +%1 Slime Puan
    REWARD_POINT_MATCH_COMPLETE: 5,     // Maç tamamlama ödülü +5 Slime Puan
    REWARD_POINT_MATCH_WIN: 15,         // Maç şampiyonluğu ödülü +15 Slime Puan
    REWARD_COIN_MATCH_WIN: 1,           // Maç şampiyonluğu ödülü +1 Slime Coin
    REWARD_COIN_PER_3_KILLS: 1,         // Eleme serisi başına +1 Slime Coin
    REWARD_COIN_KILL_THRESHOLD: 5       // Her 5 elemede +1 Slime Coin (zorlu coin kazanımı)
  };

  // Rastgele Verilen 3 Geçici Güçlendirme Türü (10 Saniye Süreli)
  exports.POWERUP_TYPES = [
    {
      id: 'wide_cam',
      name: 'Geniş Kamera',
      icon: '🔭',
      color: '#00BBF9',
      desc: '10 Saniye Geniş Görüş Açısı (FOV Zoom-Out)!'
    },
    {
      id: 'double_shot',
      name: 'İkili Atış',
      icon: '🏹',
      color: '#FF2A85',
      desc: '10 Saniye V Şeklinde Çift Ok Fırlatma!'
    },
    {
      id: 'high_speed',
      name: 'Yüksek Hız',
      icon: '⚡',
      color: '#FFE066',
      desc: '10 Saniye Süper Hareket Hızı!'
    }
  ];

  // Üyelerin seçebileceği 10 Neon Slime Rengi
  exports.SLIME_COLORS = [
    { id: '#00F5D4', name: 'Siber Turkuaz' },
    { id: '#FF2A85', name: 'Neon Fuşya' },
    { id: '#38E54D', name: 'Zümrüt Yeşili' },
    { id: '#00BBF9', name: 'Elektrik Mavisi' },
    { id: '#FFB800', name: 'Altın Sarısı' },
    { id: '#9B5DE5', name: 'Galaksi Moru' },
    { id: '#FF6B00', name: 'Plazma Turuncu' },
    { id: '#00F59B', name: 'Nane Yeşili' },
    { id: '#FF0055', name: 'Kızıl Lazer' },
    { id: '#A8FF00', name: 'Asit Limonu' }
  ];

  // Karakter İstatistik Tanımları (1.0 - 10.0 Ölçeği)
  exports.STAT_DEFINITIONS = [
    { key: 'speed', label: 'Hız', icon: '⚡', color: '#00F5D4' },
    { key: 'firepower', label: 'Atış & İsabet', icon: '🎯', color: '#FF2A85' },
    { key: 'agility', label: 'Manevra & Görüş', icon: '🌀', color: '#00BBF9' },
    { key: 'beltPower', label: 'Kemer Gücü', icon: '🔗', color: '#FFB800' },
    { key: 'durability', label: 'Dayanıklılık', icon: '🛡️', color: '#38E54D' }
  ];

  // Karakter Mücadele & Galibiyet Serisi Seviye Kurgusu (Ağırlaştırılmış Uzun Vadeli İlerleme)
  exports.CHARACTER_UPGRADE_CONFIG = {
    START_LEVEL: 1.0,
    LEVEL_STEP: 0.5,
    INTERNAL_BASE_GEAR_CAP: 5.5, // İç denge kuralı: maç puanı ve ücretsiz eşya ile en fazla 5.5'e çıkılır
    MAX_TOTAL_LEVEL: 10.0,       // Üst üste galibiyet serisi (+0.5 Sv) ile 10.0'a ulaşılır (seri bozulursa sıfırlanır)
    STAT_GAIN_PER_STEP: 0.14,
    STAT_GAIN_PER_STREAK_STEP: 0.25,
    STEP_COSTS: {
      '1.0': 950,
      '1.5': 1850,
      '2.0': 3200,
      '2.5': 5000,
      '3.0': 7500,
      '3.5': 11000,
      '4.0': 15500,
      '4.5': 21000,
      '5.0': 28000
    }
  };

  // Üyelerin seçebileceği Basic 10 Karakter & Kostüm (Her biri kendine özgü 5 istatistik ve pasif özelliğe sahiptir)
  exports.BASIC_10_SKINS = [
    {
      id: 'crown',
      name: 'Kral Tacı',
      icon: '👑',
      role: 'Dengeli Lider',
      desc: 'Altın imparatorluk tacı',
      trait: '👑 Dengeli Güç & +%5 Kemer Puanı',
      baseStats: { speed: 3.2, firepower: 3.2, agility: 3.1, beltPower: 3.4, durability: 3.2 },
      mods: { speedMult: 1.02, arrowSpeedMult: 1.02, beltHoldBonus: 0.05, massMult: 1.02 }
    },
    {
      id: 'ninja',
      name: 'Gölge Ninja',
      icon: '🥷',
      role: 'Çevik Suikastçı',
      desc: 'Kırmızı ninja alın bandı',
      trait: '⚡ +%7 Hareket Hızı & -%7 Atış Süresi',
      baseStats: { speed: 3.9, firepower: 3.4, agility: 3.8, beltPower: 2.6, durability: 2.4 },
      mods: { speedMult: 1.07, arrowCooldownMult: 0.93, arrowSpeedMult: 1.04, massMult: 0.94 }
    },
    {
      id: 'cyber',
      name: 'Siber Vizör',
      icon: '🕶️',
      role: 'Keskin Nişancı',
      desc: 'Neon lazer vizör gözlük',
      trait: '🔭 +%6 Geniş Kamera Açısı & +%10 Ok Hızı',
      baseStats: { speed: 3.0, firepower: 3.9, agility: 3.7, beltPower: 2.8, durability: 2.7 },
      mods: { arrowSpeedMult: 1.10, fovMult: 0.94, arrowCooldownMult: 0.95 }
    },
    {
      id: 'pirate',
      name: 'Korsan Kaptan',
      icon: '🏴‍☠️',
      role: 'Ağır Topçu',
      desc: 'Korsan şapkası ve göz bandı',
      trait: '💣 Yavaş ama +%16 İri & Ağır Ok Atışı',
      baseStats: { speed: 2.8, firepower: 3.8, agility: 2.7, beltPower: 3.4, durability: 3.4 },
      mods: { arrowSizeMult: 1.16, arrowSpeedMult: 0.92, arrowCooldownMult: 1.05, massMult: 1.06 }
    },
    {
      id: 'devil',
      name: 'Ateş Boynuzu',
      icon: '😈',
      role: 'Agresif Avcı',
      desc: 'Kızıl parlayan şeytan boynuzları',
      trait: '🔥 -%8 Seri Atış Süresi & +%4 Hız',
      baseStats: { speed: 3.6, firepower: 3.8, agility: 3.2, beltPower: 2.9, durability: 2.6 },
      mods: { speedMult: 1.04, arrowCooldownMult: 0.92, arrowSpeedMult: 1.05 }
    },
    {
      id: 'angel',
      name: 'Kutsal Hale',
      icon: '😇',
      role: 'Koruyucu Destek',
      desc: 'Baş üstünde parlayan altın hale',
      trait: '🛡️ -0.5 sn Hızlı Diriliş & +%3 Manevra',
      baseStats: { speed: 3.4, firepower: 2.8, agility: 3.6, beltPower: 3.3, durability: 3.6 },
      mods: { speedMult: 1.03, respawnReductionMs: 500, fovMult: 0.97, beltCooldownMult: 0.95 }
    },
    {
      id: 'viking',
      name: 'Viking Miğferi',
      icon: '⚔️',
      role: 'Zırhlı Tank',
      desc: 'Çift boynuzlu kuzey miğferi',
      trait: '🛡️ +%15 Gövde Kütlesi & Çarpışma Direnci',
      baseStats: { speed: 2.6, firepower: 3.1, agility: 2.5, beltPower: 3.6, durability: 4.0 },
      mods: { massMult: 1.15, respawnReductionMs: 400, speedMult: 0.97, arrowSizeMult: 1.08 }
    },
    {
      id: 'wizard',
      name: 'Büyücü Şapkası',
      icon: '🧙',
      role: 'Alan Kontrol Ustası',
      desc: 'Yıldızlı mistik büyücü şapkası',
      trait: '🔗 -%10 Kemer Süresi & +%5 Kamera Açısı',
      baseStats: { speed: 3.0, firepower: 3.3, agility: 3.6, beltPower: 3.9, durability: 2.7 },
      mods: { beltCooldownMult: 0.90, fovMult: 0.95, arrowSizeMult: 1.06 }
    },
    {
      id: 'headset',
      name: 'Pro Oyuncu',
      icon: '🎧',
      role: 'E-Spor Taktikçisi',
      desc: 'RGB neon yayıncı kulaklığı',
      trait: '🌀 +%5 Hız, +%5 Görüş Açısı & Hızlı Refleks',
      baseStats: { speed: 3.6, firepower: 3.5, agility: 3.9, beltPower: 3.0, durability: 2.8 },
      mods: { speedMult: 1.05, fovMult: 0.95, arrowSpeedMult: 1.05, arrowCooldownMult: 0.96 }
    },
    {
      id: 'fez',
      name: 'Tosun Paşa Fesi',
      icon: '🎩',
      role: 'Kemer & Meydan Ustası',
      desc: 'Seferoğulları & Tellioğulları özel',
      trait: '🔗 -%12 Kemer Bağlama Süresi & +%8 Kütle',
      baseStats: { speed: 3.1, firepower: 3.1, agility: 3.0, beltPower: 4.0, durability: 3.7 },
      mods: { beltCooldownMult: 0.88, massMult: 1.08, respawnReductionMs: 300 }
    }
  ];

  // 4 Ana Oyun Modu / Odası
  exports.GAME_MODES = [
    {
      id: 'ffa',
      name: 'Herkes Tek (Açık Dünya)',
      shortName: 'Herkes Tek',
      icon: '🌍',
      isTeam: false,
      teamSize: 0,
      maxPlayers: 40,
      allowGuest: true,
      desc: 'Açık dünya neon arenada herkes tek! Yeni gelenler sıradaki tur başında eşit başlar.'
    },
    {
      id: 'team_2v2',
      name: '2v2 Takım Savaşı',
      shortName: '2 vs 2',
      icon: '⚔️',
      isTeam: true,
      teamSize: 2,
      maxPlayers: 4,
      allowGuest: false,
      desc: '2 Seferoğulları vs 2 Tellioğulları! Dost ateşi kapalı, kadro dolunca maç başlar.'
    },
    {
      id: 'team_4v4',
      name: '4v4 Takım Savaşı',
      shortName: '4 vs 4',
      icon: '🛡️',
      isTeam: true,
      teamSize: 4,
      maxPlayers: 8,
      allowGuest: false,
      desc: '4 Seferoğulları vs 4 Tellioğulları! Taktiksel takım mücadelesi.'
    },
    {
      id: 'team_8v8',
      name: '8v8 Meydan Savaşı',
      shortName: '8 vs 8',
      icon: '🔥',
      isTeam: true,
      teamSize: 8,
      maxPlayers: 16,
      allowGuest: false,
      desc: '8 Seferoğulları vs 8 Tellioğulları! Dev klan ve aile meydan savaşı.'
    }
  ];

  // Takım Tanımları
  exports.TEAMS = {
    seferogullari: {
      id: 'seferogullari',
      name: 'Seferoğulları',
      color: '#00F59B',
      icon: '🟢'
    },
    telliogullari: {
      id: 'telliogullari',
      name: 'Tellioğulları',
      color: '#FF2A85',
      icon: '🔴'
    }
  };
})(typeof exports === 'undefined' ? (this.SharedConstants = {}) : exports);
