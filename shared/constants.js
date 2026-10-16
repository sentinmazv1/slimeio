// Hem sunucu (Node.js) hem istemci (Tarayıcı) tarafından kullanılan ortak sabitler
(function (exports) {
  exports.GAME_CONFIG = {
    TICK_RATE: 60,                 // Saniyedeki fizik güncelleme sayısı (Hz)
    NETWORK_RATE: 30,              // Saniyedeki ağ paketi gönderim sayısı (Hz)
    MATCH_DURATION_SEC: 180,       // 3 dakikalık maç süresi
    RESPAWN_DELAY_MS: 5000,        // Ölüm sonrası 5 saniye bekleme

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
    MIN_TOTAL_PLAYERS_WITH_BOTS: 6, // Gerçek oyuncu azsa arenayı canlı tutacak min toplam oyuncu/bot
    MAX_PLAYERS_PER_ROOM: 40
  };
})(typeof exports === 'undefined' ? (this.SharedConstants = {}) : exports);
