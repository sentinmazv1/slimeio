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

    // Slime (Oyuncu) Fizik Parametreleri (Uzayda akıcı süzülme)
    PLAYER_RADIUS: 24,
    PLAYER_MASS: 5,
    PLAYER_FRICTION_AIR: 0.032,
    PLAYER_RESTITUTION: 0.88,
    BASE_MOVE_FORCE: 0.025,
    MAX_INPUT_DIST: 240,
    WALL_BOUNCE_SPEED: 8.8,

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

    // Online Sunucu Ayarları
    MIN_TOTAL_PLAYERS_WITH_BOTS: 6,
    MAX_PLAYERS_PER_ROOM: 40
  };

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

  // Üyelerin seçebileceği Basic 10 Kostüm (Canvas üzerinde özel çizilir)
  exports.BASIC_10_SKINS = [
    { id: 'crown', name: 'Kral Tacı', icon: '👑', desc: 'Altın imparatorluk tacı' },
    { id: 'ninja', name: 'Gölge Ninja', icon: '🥷', desc: 'Kırmızı ninja alın bandı' },
    { id: 'cyber', name: 'Siber Vizör', icon: '🕶️', desc: 'Neon lazer vizör gözlük' },
    { id: 'pirate', name: 'Korsan Kaptan', icon: '🏴‍☠️', desc: 'Korsan şapkası ve göz bandı' },
    { id: 'devil', name: 'Ateş Boynuzu', icon: '😈', desc: 'Kızıl parlayan şeytan boynuzları' },
    { id: 'angel', name: 'Kutsal Hale', icon: '😇', desc: 'Baş üstünde parlayan altın hale' },
    { id: 'viking', name: 'Viking Miğferi', icon: '⚔️', desc: 'Çift boynuzlu kuzey miğferi' },
    { id: 'wizard', name: 'Büyücü Şapkası', icon: '🧙', desc: 'Yıldızlı mistik büyücü şapkası' },
    { id: 'headset', name: 'Pro Oyuncu', icon: '🎧', desc: 'RGB neon yayıncı kulaklığı' },
    { id: 'fez', name: 'Tosun Paşa Fesi', icon: '🎩', desc: 'Seferoğulları & Tellioğulları özel' }
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
