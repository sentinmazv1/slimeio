// Slime.io v2.0 - Lobi, Üyelik, Basic 10 Kostüm, Seferoğulları vs Tellioğulları Takım Odaları, Sosyal & Mobil İstemci
(() => {
  // Eski mobil tarayıcılar (iOS/Android WebView) için roundRect polyfill
  if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      const radius = Math.min(Number(r) || 0, w / 2, h / 2);
      this.moveTo(x + radius, y);
      this.arcTo(x + w, y, x + w, y + h, radius);
      this.arcTo(x + w, y + h, x, y + h, radius);
      this.arcTo(x, y + h, x, y, radius);
      this.arcTo(x, y, x + w, y, radius);
      this.closePath();
      return this;
    };
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  const socket = io({
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 500
  });
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const skinPreviewCanvas = document.getElementById('skinPreviewCanvas');
  const previewCtx = skinPreviewCanvas ? skinPreviewCanvas.getContext('2d') : null;

  // HUD & Oyun İçi Elementler
  const timerEl = document.getElementById('timer');
  const teamHudScoresEl = document.getElementById('team-hud-scores');
  const hudSeferScoreEl = document.getElementById('hud-sefer-score');
  const hudTelliScoreEl = document.getElementById('hud-telli-score');
  const myScoreEl = document.getElementById('my-score');
  const myBandsEl = document.getElementById('my-bands');
  const netStatusEl = document.getElementById('net-status');
  const spectatorBannerEl = document.getElementById('spectator-banner');
  const leaderboardHeaderEl = document.getElementById('leaderboard-header');
  const leaderboardListEl = document.getElementById('leaderboard-list');
  const overlayEl = document.getElementById('overlay-msg');
  const overlayTitleEl = document.getElementById('overlay-title');
  const overlaySubEl = document.getElementById('overlay-sub');

  // Alt Menü & Paylaşım Butonları
  const openLobbyBtn = document.getElementById('open-lobby-btn');
  const openFriendsBtn = document.getElementById('open-friends-btn');
  const myFriendCountBadge = document.getElementById('my-friend-count-badge');
  const openMyProfileBtn = document.getElementById('open-my-profile-btn');
  const shareGameBtn = document.getElementById('share-game-btn');
  const shareBottomBtn = document.getElementById('share-bottom-btn');
  const muteBtn = document.getElementById('mute-btn');

  // Mobil Butonlar
  const mobileActionBtns = document.getElementById('mobile-action-btns');
  const mobShootBtn = document.getElementById('mob-shoot-btn');
  const mobCutBtn = document.getElementById('mob-cut-btn');

  // Lobi & Üyelik Elementleri
  const lobbyModal = document.getElementById('lobby-modal');
  const authGuestOrMemberBox = document.getElementById('auth-guest-or-member-box');
  const loggedInUserBox = document.getElementById('logged-in-user-box');
  const authTabs = document.querySelectorAll('.auth-tab');
  const tabGuest = document.getElementById('tab-guest');
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const authFeedback = document.getElementById('auth-feedback');

  const guestNameInput = document.getElementById('guest-name-input');
  const loginUsernameInput = document.getElementById('login-username');
  const loginPasswordInput = document.getElementById('login-password');
  const doLoginBtn = document.getElementById('do-login-btn');

  const regFullnameInput = document.getElementById('reg-fullname');
  const regUsernameInput = document.getElementById('reg-username');
  const regPasswordInput = document.getElementById('reg-password');
  const doRegisterBtn = document.getElementById('do-register-btn');

  const memberDisplayNameEl = document.getElementById('member-display-name');
  const memberFullnameEl = document.getElementById('member-fullname');
  const memberFriendsStatEl = document.getElementById('member-friends-stat');
  const memberWinsStatEl = document.getElementById('member-wins-stat');
  const logoutBtn = document.getElementById('logout-btn');

  const skinLockBadge = document.getElementById('skin-lock-badge');
  const colorPaletteContainer = document.getElementById('color-palette-container');
  const skinsGridContainer = document.getElementById('skins-grid-container');
  const modesListContainer = document.getElementById('modes-list-container');
  const joinGameBtn = document.getElementById('join-game-btn');
  const watchGameBtn = document.getElementById('watch-game-btn');

  // İzleyici (Spectator) Kontrol Çubuğu
  const spectatorControlsBarEl = document.getElementById('spectator-controls-bar');
  const specPrevBtn = document.getElementById('spec-prev-btn');
  const specOverviewBtn = document.getElementById('spec-overview-btn');
  const specNextBtn = document.getElementById('spec-next-btn');
  const specJoinPlayBtn = document.getElementById('spec-join-play-btn');

  // Takım Bekleme Odası Elementleri
  const teamWaitingModal = document.getElementById('team-waiting-modal');
  const teamLobbyTitleEl = document.getElementById('team-lobby-title');
  const teamLobbyStatusEl = document.getElementById('team-lobby-status');
  const seferCountBadgeEl = document.getElementById('sefer-count-badge');
  const telliCountBadgeEl = document.getElementById('telli-count-badge');
  const seferSlotsListEl = document.getElementById('sefer-slots-list');
  const telliSlotsListEl = document.getElementById('telli-slots-list');
  const joinSeferBtn = document.getElementById('join-sefer-btn');
  const joinTelliBtn = document.getElementById('join-telli-btn');
  const teamLobbyBackBtn = document.getElementById('team-lobby-back-btn');
  const teamLobbyFillBotsBtn = document.getElementById('team-lobby-fill-bots-btn');
  const teamLobbyInviteBtn = document.getElementById('team-lobby-invite-btn');

  // Profil & Arkadaş Modalları + Kamera Takip Barı
  const cameraFollowBannerEl = document.getElementById('camera-follow-banner');
  const cameraFollowTextEl = document.getElementById('camera-follow-text');
  const cameraUnfollowBtn = document.getElementById('camera-unfollow-btn');

  const profileModal = document.getElementById('profile-modal');
  const profileContent = document.getElementById('profile-content');
  const profileFeedbackMsg = document.getElementById('profile-feedback-msg');
  const profileAddFriendBtn = document.getElementById('profile-add-friend-btn');
  const profileWatchBtn = document.getElementById('profile-watch-btn');
  const profileInviteBtn = document.getElementById('profile-invite-btn');
  const profileCloseBtn = document.getElementById('profile-close-btn');

  const friendsModal = document.getElementById('friends-modal');
  const friendsCountTitle = document.getElementById('friends-count-title');
  const addFriendInput = document.getElementById('add-friend-input');
  const addFriendSubmitBtn = document.getElementById('add-friend-submit-btn');
  const friendActionMsg = document.getElementById('friend-action-msg');
  const friendsListBox = document.getElementById('friends-list-box');
  const friendsCloseBtn = document.getElementById('friends-close-btn');

  // Davet Toast
  const inviteToast = document.getElementById('invite-toast');
  const inviteToastText = document.getElementById('invite-toast-text');
  const inviteAcceptBtn = document.getElementById('invite-accept-btn');
  const inviteDeclineBtn = document.getElementById('invite-decline-btn');

  // Maç Sonu Modalı
  const matchEndModal = document.getElementById('match-end-modal');
  const winnerTitleEl = document.getElementById('winner-title');
  const winnerSubtitleEl = document.getElementById('winner-subtitle');
  const matchRewardSummaryEl = document.getElementById('match-reward-summary');
  const finalStandingsBody = document.getElementById('final-standings-body');
  const nextMatchCountdownEl = document.getElementById('next-match-countdown');
  const backToLobbyFromEndBtn = document.getElementById('back-to-lobby-from-end-btn');
  const openShopFromEndBtn = document.getElementById('open-shop-from-end-btn');

  // Mağaza (Shop) & Lobi Cüzdan / Kariyer Elementleri
  const shopModal = document.getElementById('shop-modal');
  const shopCloseBtn = document.getElementById('shop-close-btn');
  const shopPreviewCanvas = document.getElementById('shopPreviewCanvas');
  const shopPreviewCtx = shopPreviewCanvas ? shopPreviewCanvas.getContext('2d') : null;
  const shopWalletPointsEl = document.getElementById('shop-wallet-points');
  const shopWalletCoinsEl = document.getElementById('shop-wallet-coins');
  const shopItemsContainer = document.getElementById('shop-items-container');
  const shopFeedbackMsg = document.getElementById('shop-feedback-msg') || document.getElementById('shop-feedback-banner');
  const shopClaimPackBtn = document.getElementById('shop-claim-pack-btn');
  const shopEquippedBadgesEl = document.getElementById('shop-equipped-badges');
  const shopPreviewStatusEl = document.getElementById('shop-preview-status');
  const shopResetPreviewBtn = document.getElementById('shop-reset-preview-btn');
  const shopTabBtns = document.querySelectorAll('.shop-tab-btn');

  const lobbyWalletPointsEl = document.getElementById('lobby-wallet-points');
  const lobbyWalletCoinsEl = document.getElementById('lobby-wallet-coins');
  const lobbyStatCutsEl = document.getElementById('lobby-stat-cuts');
  const lobbyStatKillsEl = document.getElementById('lobby-stat-kills');
  const lobbyStatScoreEl = document.getElementById('lobby-stat-score');
  const lobbyEquippedTitleBadgeEl = document.getElementById('lobby-equipped-title-badge');

  const openShopBtn = document.getElementById('open-shop-btn');
  const openShopTopBtn = document.getElementById('open-shop-top-btn');
  const openShopBottomBtn = document.getElementById('open-shop-bottom-btn');

  // Durum Değişkenleri
  let selfId = null;
  let config = window.SharedConstants.GAME_CONFIG;
  let availableColors = window.SharedConstants.SLIME_COLORS || [];
  let availableSkins = window.SharedConstants.BASIC_10_SKINS || [];
  let availableModes = window.SharedConstants.GAME_MODES || [];
  let mapObstacles = [];
  let roomsSummary = [];
  let storeItems = [];
  let currentShopTab = 'hat';
  let shopPreviewLoadout = { hat: null, skin: null, belt: null, kill_effect: null, title: null };
  let shopPreviewActiveItemId = null;
  let shopPreviewKillStartMs = 0;

  let currentUser = null; // Giriş yapmış üye bilgisi
  let guestFriends = []; // Misafir oturumda takip edilen oyuncular
  let guestEconomy = {
    slimePoints: (window.SharedConstants && window.SharedConstants.GAME_CONFIG && window.SharedConstants.GAME_CONFIG.STARTER_SLIME_POINTS) || 500,
    slimeCoins: (window.SharedConstants && window.SharedConstants.GAME_CONFIG && window.SharedConstants.GAME_CONFIG.STARTER_SLIME_COINS) || 100,
    ownedItems: [],
    equipped: { hat: null, skin: null, belt: null, kill_effect: null, title: null },
    stats: { totalScore: 0, totalCuts: 0, totalKills: 0, matchesPlayed: 0, wins: 0 }
  };
  let selectedColor = availableColors[0] ? availableColors[0].id : '#00F5D4';
  let selectedSkin = availableSkins[0] ? availableSkins[0].id : 'crown';
  let selectedModeId = 'ffa';
  let currentRoomId = null;
  let pendingInviteData = null;

  let followedPlayerId = null;
  let followedPlayerName = '';
  let lastLeaderboardRenderAt = 0;
  let lastTeamSlotsSignature = '';

  let countdownInterval = null;
  let currentPingMs = 1;
  let totalOnline = 1;

  // Mobil / Dokunmatik Durumu
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (isTouchDevice) {
    mobileActionBtns.style.display = 'flex';
  }

  const joystick = {
    active: false,
    touchId: null,
    startX: 0,
    startY: 0,
    currX: 0,
    currY: 0,
    maxRadius: 60,
    aimAngle: 0
  };

  function setCameraFollowPlayer(targetId, targetName) {
    if (!targetId || targetId === selfId) {
      followedPlayerId = null;
      followedPlayerName = '';
      if (cameraFollowBannerEl) cameraFollowBannerEl.style.display = 'none';
      return;
    }
    followedPlayerId = targetId;
    followedPlayerName = targetName || 'Oyuncu';
    if (cameraFollowTextEl) {
      cameraFollowTextEl.textContent = `🎥 Kamera Takibi: ${followedPlayerName}`;
    }
    if (cameraFollowBannerEl) {
      cameraFollowBannerEl.style.display = 'flex';
    }
  }

  if (cameraUnfollowBtn) {
    cameraUnfollowBtn.addEventListener('click', () => {
      setCameraFollowPlayer(null, '');
    });
  }

  leaderboardHeaderEl.addEventListener('click', (e) => {
    const isHidden = leaderboardListEl.style.display === 'none';
    if (isHidden) {
      leaderboardListEl.style.display = 'flex';
      return;
    }
    if (e.target && e.target.tagName === 'SPAN') {
      const firstRow = leaderboardListEl.querySelector('.lb-row');
      if (firstRow && typeof window.inspectPlayerProfile === 'function') {
        window.inspectPlayerProfile(firstRow.dataset.playerId || null, firstRow.dataset.username || '');
        return;
      }
    }
    leaderboardListEl.style.display = 'none';
  });

  // Skor tablosu, takım koltukları ve maç sonu tablosu için anında (pointerdown) profil tıklama delegasyonu
  leaderboardListEl.addEventListener('pointerdown', (e) => {
    const row = e.target.closest('.lb-row');
    if (!row) return;
    e.preventDefault();
    e.stopPropagation();
    if (typeof window.inspectPlayerProfile === 'function') {
      window.inspectPlayerProfile(row.dataset.playerId || null, row.dataset.username || '');
    }
  });

  [seferSlotsListEl, telliSlotsListEl].forEach((slotContainer) => {
    if (!slotContainer) return;
    slotContainer.addEventListener('pointerdown', (e) => {
      const slot = e.target.closest('[data-player-id]');
      if (!slot) return;
      e.preventDefault();
      e.stopPropagation();
      if (typeof window.inspectPlayerProfile === 'function') {
        window.inspectPlayerProfile(slot.dataset.playerId || null, slot.dataset.username || '');
      }
    });
  });

  finalStandingsBody.addEventListener('pointerdown', (e) => {
    const tr = e.target.closest('tr[data-player-id]');
    if (!tr) return;
    e.preventDefault();
    e.stopPropagation();
    if (typeof window.inspectPlayerProfile === 'function') {
      window.inspectPlayerProfile(tr.dataset.playerId || null, tr.dataset.username || '');
    }
  });

  const renderPlayers = new Map();
  let renderArrows = [];
  let renderPowerups = [];
  const snapEffects = [];
  const splatEffects = [];
  const floatingTexts = [];
  const killAnimations = [];
  let screenCrackUntil = 0;

  const POWERUP_META = {
    wide_cam: { id: 'wide_cam', name: 'GENİŞ KAMERA', icon: '🔭', color: '#00BBF9' },
    double_shot: { id: 'double_shot', name: 'İKİLİ ATIŞ', icon: '🏹', color: '#FF2A85' },
    high_speed: { id: 'high_speed', name: 'YÜKSEK HIZ', icon: '⚡', color: '#FFE066' }
  };

  const TITLE_META = {
    title_clan_badge: { id: 'title_clan_badge', label: '🛡️ KLAN ŞAMPİYONU', color: '#00BBF9', bg: 'rgba(0,187,249,0.22)' },
    title_belt_master: { id: 'title_belt_master', label: '✂️ KEMER USTASI', color: '#00F5D4', bg: 'rgba(0,245,212,0.22)' },
    title_chaos_envoy: { id: 'title_chaos_envoy', label: '🔥 KAOS ELÇİSİ', color: '#FF2A85', bg: 'rgba(255,42,133,0.24)' },
    title_gladiator_crown: { id: 'title_gladiator_crown', label: '🏆 ARENA GLADYATÖRÜ', color: '#C084FC', bg: 'rgba(192,132,252,0.26)' },
    title_vip_gold_frame: { id: 'title_vip_gold_frame', label: '🌟 VIP ALTIN EFSANE', color: '#FFE066', bg: 'rgba(255,224,102,0.28)', isGoldFrame: true }
  };

  const stars = Array.from({ length: 140 }, () => ({
    x: (Math.random() * 2 - 1) * 2800,
    y: (Math.random() * 2 - 1) * 1900,
    r: 1 + Math.random() * 2.2,
    alpha: 0.25 + Math.random() * 0.65,
    color: ['#00F5D4', '#FF2A85', '#00BBF9', '#FFE066', '#FFFFFF'][Math.floor(Math.random() * 5)]
  }));

  // --- LOBİ, ÜYELİK, EKONOMİ & MAĞAZA (SHOP) ARAYÜZÜ ---
  function switchAuthTab(tabName) {
    authTabs.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    tabGuest.style.display = tabName === 'guest' ? 'flex' : 'none';
    tabLogin.style.display = tabName === 'login' ? 'flex' : 'none';
    tabRegister.style.display = tabName === 'register' ? 'flex' : 'none';
    authFeedback.textContent = '';
  }

  authTabs.forEach((btn) => {
    btn.addEventListener('click', () => switchAuthTab(btn.dataset.tab));
  });

  function saveUserSessionToStorage(userObj, rawPassword) {
    if (!userObj || !userObj.username) return;
    try {
      const prevRaw = localStorage.getItem('slimeio_creds');
      const prev = prevRaw ? JSON.parse(prevRaw) : {};
      const passwordToKeep = rawPassword || prev.password || '';
      localStorage.setItem('slimeio_creds', JSON.stringify({
        username: userObj.username,
        displayName: userObj.displayName || userObj.username,
        fullName: userObj.fullName || userObj.username,
        password: passwordToKeep,
        color: userObj.color || selectedColor,
        skin: userObj.skin || selectedSkin,
        friendCount: userObj.friendCount || 0,
        friends: userObj.friends || [],
        slimePoints: Number.isFinite(Number(userObj.slimePoints)) ? Number(userObj.slimePoints) : 500,
        slimeCoins: Number.isFinite(Number(userObj.slimeCoins)) ? Number(userObj.slimeCoins) : 100,
        ownedItems: Array.isArray(userObj.ownedItems) ? userObj.ownedItems : [],
        equipped: userObj.equipped || { hat: null, skin: null, belt: null, kill_effect: null, title: null },
        stats: userObj.stats || { totalScore: 0, totalCuts: 0, totalKills: 0, matchesPlayed: 0, wins: 0 }
      }));
    } catch (_e) {}
  }

  function saveGuestFriendsToStorage() {
    try {
      localStorage.setItem('slimeio_guest_friends', JSON.stringify(guestFriends));
    } catch (_e) {}
  }

  function saveGuestEconomyToStorage() {
    try {
      localStorage.setItem('slimeio_guest_economy', JSON.stringify({
        color: selectedColor,
        skin: selectedSkin,
        slimePoints: guestEconomy.slimePoints,
        slimeCoins: guestEconomy.slimeCoins,
        ownedItems: guestEconomy.ownedItems,
        equipped: guestEconomy.equipped,
        stats: guestEconomy.stats
      }));
    } catch (_e) {}
  }

  function syncGuestLoadoutToServer() {
    if (currentUser || !socket || !socket.connected) return;
    socket.emit('syncGuestLoadout', {
      color: selectedColor,
      skin: selectedSkin,
      equipped: guestEconomy.equipped
    });
  }

  function restoreLocalUserSessionImmediately() {
    try {
      const savedGuest = localStorage.getItem('slimeio_guest_name');
      if (savedGuest && guestNameInput) guestNameInput.value = savedGuest;

      const savedMode = localStorage.getItem('slimeio_selected_mode');
      if (savedMode) selectedModeId = savedMode;

      const savedGuestFriendsRaw = localStorage.getItem('slimeio_guest_friends');
      if (savedGuestFriendsRaw) {
        const parsedGF = JSON.parse(savedGuestFriendsRaw);
        if (Array.isArray(parsedGF)) guestFriends = parsedGF;
      }

      const savedGuestEcoRaw = localStorage.getItem('slimeio_guest_economy');
      if (savedGuestEcoRaw) {
        const parsedEco = JSON.parse(savedGuestEcoRaw);
        if (parsedEco && typeof parsedEco === 'object') {
          if (Number.isFinite(Number(parsedEco.slimePoints))) guestEconomy.slimePoints = Number(parsedEco.slimePoints);
          if (Number.isFinite(Number(parsedEco.slimeCoins))) guestEconomy.slimeCoins = Number(parsedEco.slimeCoins);
          if (Array.isArray(parsedEco.ownedItems)) guestEconomy.ownedItems = parsedEco.ownedItems;
          if (parsedEco.equipped && typeof parsedEco.equipped === 'object') {
            guestEconomy.equipped = {
              hat: parsedEco.equipped.hat || null,
              skin: parsedEco.equipped.skin || null,
              belt: parsedEco.equipped.belt || null,
              kill_effect: parsedEco.equipped.kill_effect || null,
              title: parsedEco.equipped.title || null
            };
          }
          if (parsedEco.stats && typeof parsedEco.stats === 'object') {
            guestEconomy.stats = {
              totalScore: Number(parsedEco.stats.totalScore) || 0,
              totalCuts: Number(parsedEco.stats.totalCuts) || 0,
              totalKills: Number(parsedEco.stats.totalKills) || 0,
              matchesPlayed: Number(parsedEco.stats.matchesPlayed) || 0,
              wins: Number(parsedEco.stats.wins) || 0
            };
          }
          if (parsedEco.color) selectedColor = parsedEco.color;
          if (parsedEco.skin) selectedSkin = parsedEco.skin;
        }
      }

      const savedCredsRaw = localStorage.getItem('slimeio_creds');
      if (savedCredsRaw) {
        const creds = JSON.parse(savedCredsRaw);
        if (creds && creds.username && creds.password) {
          currentUser = {
            username: creds.username,
            displayName: creds.displayName || creds.username,
            fullName: creds.fullName || creds.username,
            color: creds.color || selectedColor,
            skin: creds.skin || selectedSkin,
            friendCount: creds.friendCount || 0,
            friends: creds.friends || [],
            slimePoints: Number.isFinite(Number(creds.slimePoints)) ? Number(creds.slimePoints) : 500,
            slimeCoins: Number.isFinite(Number(creds.slimeCoins)) ? Number(creds.slimeCoins) : 100,
            ownedItems: Array.isArray(creds.ownedItems) ? creds.ownedItems : [],
            equipped: creds.equipped || { hat: null, skin: null, belt: null, kill_effect: null, title: null },
            stats: creds.stats || { totalScore: 0, totalCuts: 0, totalKills: 0, matchesPlayed: 0, wins: 0 }
          };
          selectedColor = currentUser.color;
          selectedSkin = currentUser.skin;
        }
      }
    } catch (_e) {}
  }

  function getActiveEconomy() {
    if (currentUser) {
      if (!Number.isFinite(Number(currentUser.slimePoints))) currentUser.slimePoints = 500;
      if (!Number.isFinite(Number(currentUser.slimeCoins))) currentUser.slimeCoins = 100;
      if (!Array.isArray(currentUser.ownedItems)) currentUser.ownedItems = [];
      if (!currentUser.equipped || typeof currentUser.equipped !== 'object') {
        currentUser.equipped = { hat: null, skin: null, belt: null, kill_effect: null, title: null };
      }
      if (!currentUser.stats) {
        currentUser.stats = { totalScore: 0, totalCuts: 0, totalKills: 0, matchesPlayed: 0, wins: 0 };
      }
      return currentUser;
    }
    return guestEconomy;
  }

  function syncStoreItemsOwnership() {
    const eco = getActiveEconomy();
    const ownedSet = new Set(eco.ownedItems || []);
    storeItems.forEach((item) => {
      item.isOwned = ownedSet.has(item.id);
    });
  }

  function updateCareerAndShopUI() {
    const eco = getActiveEconomy();
    syncStoreItemsOwnership();

    const pts = Math.max(0, Math.floor(Number(eco.slimePoints) || 0));
    const coins = Math.max(0, Math.floor(Number(eco.slimeCoins) || 0));
    const cuts = (eco.stats && eco.stats.totalCuts) || 0;
    const kills = (eco.stats && eco.stats.totalKills) || 0;
    const score = (eco.stats && eco.stats.totalScore) || 0;

    if (lobbyWalletPointsEl) lobbyWalletPointsEl.textContent = pts.toLocaleString('tr-TR');
    if (lobbyWalletCoinsEl) lobbyWalletCoinsEl.textContent = coins.toLocaleString('tr-TR');
    if (shopWalletPointsEl) shopWalletPointsEl.textContent = pts.toLocaleString('tr-TR');
    if (shopWalletCoinsEl) shopWalletCoinsEl.textContent = coins.toLocaleString('tr-TR');

    if (lobbyStatCutsEl) lobbyStatCutsEl.textContent = `✂️ ${cuts.toLocaleString('tr-TR')}`;
    if (lobbyStatKillsEl) lobbyStatKillsEl.textContent = `💀 ${kills.toLocaleString('tr-TR')}`;
    if (lobbyStatScoreEl) lobbyStatScoreEl.textContent = `⭐ ${score.toLocaleString('tr-TR')}`;

    const eq = eco.equipped || {};
    const titleObj = eq.title ? TITLE_META[eq.title] : null;
    if (lobbyEquippedTitleBadgeEl) {
      if (titleObj) {
        lobbyEquippedTitleBadgeEl.textContent = titleObj.label;
        lobbyEquippedTitleBadgeEl.style.color = titleObj.color;
        lobbyEquippedTitleBadgeEl.style.borderColor = titleObj.color;
        lobbyEquippedTitleBadgeEl.style.background = titleObj.bg;
      } else {
        lobbyEquippedTitleBadgeEl.textContent = '✨ Unvan: Çaylak Slime';
        lobbyEquippedTitleBadgeEl.style.color = '#FFE066';
        lobbyEquippedTitleBadgeEl.style.borderColor = 'rgba(255,224,102,0.4)';
        lobbyEquippedTitleBadgeEl.style.background = 'rgba(255,224,102,0.12)';
      }
    }

    if (shopEquippedBadgesEl) {
      const slots = [
        { key: 'hat', label: 'Şapka', fallback: '👑 Klasik' },
        { key: 'skin', label: 'Kaplama', fallback: '💧 Jöle' },
        { key: 'belt', label: 'Kemer', fallback: '🔗 Neon' },
        { key: 'kill_effect', label: 'Ölüm', fallback: '🎉 Standart' },
        { key: 'title', label: 'Unvan', fallback: '✨ Çaylak' }
      ];
      shopEquippedBadgesEl.innerHTML = slots.map((s) => {
        const eqId = eq[s.key];
        const found = eqId ? storeItems.find((it) => it.id === eqId) : null;
        const text = found ? `${found.icon || '✨'} ${escapeHtml(found.name)}` : s.fallback;
        return `<span style="font-size:10.5px; font-weight:800; padding:3px 8px; border-radius:999px; background:${found ? 'rgba(0,245,155,0.16)' : 'rgba(255,255,255,0.06)'}; border:1px solid ${found ? '#00F59B' : 'rgba(255,255,255,0.12)'}; color:${found ? '#00F59B' : '#94A3B8'};">${s.label}: ${text}</span>`;
      }).join('');
    }

    if (shopModal && shopModal.style.display !== 'none') {
      renderShopModal();
    }
  }

  function previewShopItem(itemId) {
    const item = storeItems.find((it) => it.id === itemId);
    if (!item) return;
    window.soundManager.init();
    window.soundManager.playUiPop();

    shopPreviewActiveItemId = item.id;
    shopPreviewLoadout[item.type] = item.id;
    if (item.type === 'kill_effect') {
      shopPreviewKillStartMs = performance.now();
    }

    if (shopPreviewStatusEl) {
      shopPreviewStatusEl.style.color = '#FFE066';
      shopPreviewStatusEl.style.borderColor = 'rgba(255,224,102,0.55)';
      shopPreviewStatusEl.style.background = 'rgba(255,224,102,0.14)';
      shopPreviewStatusEl.innerHTML = `👁️ Önizleniyor: <b>${escapeHtml(item.icon || '✨')} ${escapeHtml(item.name)}</b>`;
    }
    if (shopResetPreviewBtn) {
      shopResetPreviewBtn.style.display = 'inline-block';
    }
    renderShopModal();
  }

  function resetShopPreview() {
    shopPreviewLoadout = { hat: null, skin: null, belt: null, kill_effect: null, title: null };
    shopPreviewActiveItemId = null;
    if (shopPreviewStatusEl) {
      shopPreviewStatusEl.style.color = '#00F5D4';
      shopPreviewStatusEl.style.borderColor = 'rgba(0,245,212,0.3)';
      shopPreviewStatusEl.style.background = 'rgba(0,245,212,0.1)';
      shopPreviewStatusEl.textContent = '👁️ Herhangi bir eşyaya tıklayarak 3D önizle!';
    }
    if (shopResetPreviewBtn) {
      shopResetPreviewBtn.style.display = 'none';
    }
    renderShopModal();
  }

  if (shopResetPreviewBtn) {
    shopResetPreviewBtn.addEventListener('click', () => {
      window.soundManager.init();
      window.soundManager.playUiPop();
      resetShopPreview();
    });
  }

  function renderShopModal() {
    if (!shopItemsContainer) return;
    const eco = getActiveEconomy();
    syncStoreItemsOwnership();

    const filtered = storeItems
      .filter((it) => it.type === currentShopTab)
      .sort((a, b) => {
        const pa = a.pricePoint > 0 ? a.pricePoint : a.priceCoin * 20;
        const pb = b.pricePoint > 0 ? b.pricePoint : b.priceCoin * 20;
        return pa - pb;
      });

    if (filtered.length === 0) {
      shopItemsContainer.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:32px; color:#94A3B8;">Mağaza verileri yükleniyor...</div>`;
      return;
    }

    const eq = eco.equipped || {};

    shopItemsContainer.innerHTML = filtered.map((item) => {
      const isOwned = Boolean(item.isOwned);
      const isEquipped = eq[item.type] === item.id;
      const isPreviewing = shopPreviewLoadout[item.type] === item.id;
      const isVipOnly = item.pricePoint === 0 && item.priceCoin > 0;
      const canAffordPoint = item.pricePoint > 0 && eco.slimePoints >= item.pricePoint;
      const canAffordCoin = item.priceCoin > 0 && eco.slimeCoins >= item.priceCoin;

      const cardClasses = [
        'shop-item-card',
        isOwned ? 'owned' : '',
        isEquipped ? 'equipped' : '',
        isPreviewing ? 'previewing' : '',
        isVipOnly ? 'vip-only' : ''
      ].filter(Boolean).join(' ');

      const badgeHtml = isEquipped
        ? `<span class="shop-badge equipped">✨ KUŞANILDI</span>`
        : isPreviewing
          ? `<span class="shop-badge preview">👁️ ÖNİZLEMEDE</span>`
          : isOwned
            ? `<span class="shop-badge owned">✓ SAHİPSİN</span>`
            : isVipOnly
              ? `<span class="shop-badge vip">👑 VIP ÖZEL</span>`
              : `<span class="shop-badge category">${escapeHtml(item.category || item.type)}</span>`;

      const priceRowHtml = `
        <div class="shop-price-row">
          ${item.pricePoint > 0
            ? `<span class="shop-price-tag point">💎 ${item.pricePoint.toLocaleString('tr-TR')} Puan</span>`
            : `<span class="shop-price-tag vip-lock">🔒 Sadece Coin</span>`}
          ${item.priceCoin > 0
            ? `<span class="shop-price-tag coin">🪙 ${item.priceCoin.toLocaleString('tr-TR')} Coin</span>`
            : ''}
        </div>
      `;

      const previewBtnHtml = `
        <button type="button" class="shop-btn btn-preview-item ${isPreviewing ? 'active' : ''}" data-action="preview" data-id="${escapeHtml(item.id)}" title="Satın almadan önce karakterin üzerinde canlı 3D gör!">
          ${isPreviewing ? '👁️ Önizleniyor ✓' : '👁️ 3D Önizle'}
        </button>
      `;

      let actionsHtml = '';
      if (isOwned) {
        actionsHtml = `
          <div class="shop-buy-actions">
            ${previewBtnHtml}
            <button type="button" class="shop-btn ${isEquipped ? 'btn-equipped' : 'btn-equip'}" data-action="equip" data-id="${escapeHtml(item.id)}">
              ${isEquipped ? '✓ Kuşanıldı (Çıkar)' : '✨ Hemen Kuşan'}
            </button>
          </div>
        `;
      } else {
        actionsHtml = `
          <div class="shop-buy-actions">
            ${previewBtnHtml}
            ${item.pricePoint > 0 ? `
              <button type="button" class="shop-btn btn-buy-point" data-action="buy-point" data-id="${escapeHtml(item.id)}" ${canAffordPoint ? '' : 'disabled'} title="${canAffordPoint ? 'Slime Puan ile Satın Al' : 'Yeterli Slime Puanın yok (Kesme ve öldürme yaparak kazanabilirsin!)'}">
                💎 ${item.pricePoint.toLocaleString('tr-TR')} Al
              </button>
            ` : ''}
            ${item.priceCoin > 0 ? `
              <button type="button" class="shop-btn btn-buy-coin" data-action="buy-coin" data-id="${escapeHtml(item.id)}" ${canAffordCoin ? '' : 'disabled'} title="${canAffordCoin ? 'Slime Coin ile Satın Al' : 'Yeterli Slime Coinin yok'}">
                🪙 ${item.priceCoin.toLocaleString('tr-TR')} Al
              </button>
            ` : ''}
          </div>
        `;
      }

      return `
        <div class="${cardClasses}" data-card-item-id="${escapeHtml(item.id)}" style="cursor:pointer;">
          <div class="shop-item-top">
            <div class="shop-item-icon">${item.icon || '✨'}</div>
            ${badgeHtml}
          </div>
          <div class="shop-item-name">${escapeHtml(item.name)}</div>
          <div class="shop-item-desc">${escapeHtml(item.description || '')}</div>
          ${priceRowHtml}
          ${actionsHtml}
        </div>
      `;
    }).join('');

    // Karta tıklandığında (satın alma butonu hariç) doğrudan canlı 3D önizlemeye al
    shopItemsContainer.querySelectorAll('.shop-item-card[data-card-item-id]').forEach((cardEl) => {
      cardEl.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (btn && btn.dataset.action !== 'preview') return;
        const itemId = cardEl.dataset.cardItemId;
        if (itemId) previewShopItem(itemId);
      });
    });

    shopItemsContainer.querySelectorAll('button[data-action]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const itemId = btn.dataset.id;
        if (action === 'preview') {
          previewShopItem(itemId);
        } else if (action === 'buy-point') {
          previewShopItem(itemId);
          handleBuyShopItem(itemId, 'point');
        } else if (action === 'buy-coin') {
          previewShopItem(itemId);
          handleBuyShopItem(itemId, 'coin');
        } else if (action === 'equip') {
          previewShopItem(itemId);
          handleEquipShopItem(itemId);
        }
      });
    });
  }

  function showShopFeedback(msg, isError = false) {
    if (!shopFeedbackMsg) return;
    shopFeedbackMsg.style.display = msg ? 'block' : 'none';
    shopFeedbackMsg.style.color = isError ? '#FF2A85' : '#00F59B';
    shopFeedbackMsg.style.borderColor = isError ? '#FF2A85' : '#00F59B';
    shopFeedbackMsg.style.background = isError ? 'rgba(255,42,133,0.14)' : 'rgba(0,245,155,0.16)';
    shopFeedbackMsg.textContent = msg;
  }

  function handleBuyShopItem(itemId, currency) {
    window.soundManager.init();
    const item = storeItems.find((it) => it.id === itemId);
    if (!item) return;

    if (currentUser) {
      socket.emit('shopBuyItem', { itemId, currency }, (res) => {
        if (res && res.ok && res.user) {
          currentUser = res.user;
          if (currentUser.skin) selectedSkin = currentUser.skin;
          saveUserSessionToStorage(currentUser);
          window.soundManager.playPowerupPickup();
          showShopFeedback(`🎉 "${item.name}" satın alındı ve kuşanıldı!`, false);
          updateCareerAndShopUI();
        } else {
          window.soundManager.playUiPop();
          showShopFeedback((res && res.error) || 'Satın alma başarısız.', true);
        }
      });
      return;
    }

    // Misafir (Guest) yerel ekonomi satın alma işlemi
    if (guestEconomy.ownedItems.includes(itemId)) {
      handleEquipShopItem(itemId);
      return;
    }

    if (currency === 'point') {
      if (!item.pricePoint || item.pricePoint <= 0) {
        showShopFeedback('Bu özel eşya sadece Slime Coin ile satın alınabilir!', true);
        return;
      }
      if (guestEconomy.slimePoints < item.pricePoint) {
        showShopFeedback(`Yetersiz Slime Puan! (${item.pricePoint - guestEconomy.slimePoints} 💎 daha gerekli)`, true);
        return;
      }
      guestEconomy.slimePoints -= item.pricePoint;
    } else {
      if (!item.priceCoin || item.priceCoin <= 0) {
        showShopFeedback('Bu eşya Slime Coin ile satılmıyor.', true);
        return;
      }
      if (guestEconomy.slimeCoins < item.priceCoin) {
        showShopFeedback(`Yetersiz Slime Coin! (${item.priceCoin - guestEconomy.slimeCoins} 🪙 daha gerekli)`, true);
        return;
      }
      guestEconomy.slimeCoins -= item.priceCoin;
    }

    guestEconomy.ownedItems.push(itemId);
    guestEconomy.equipped[item.type] = item.id;
    if (item.type === 'hat') {
      selectedSkin = item.id;
    }
    saveGuestEconomyToStorage();
    syncGuestLoadoutToServer();
    window.soundManager.playPowerupPickup();
    showShopFeedback(`🎉 "${item.name}" satın alındı ve kuşanıldı!`, false);
    updateCareerAndShopUI();
  }

  function handleEquipShopItem(itemId) {
    window.soundManager.init();
    const item = storeItems.find((it) => it.id === itemId);
    if (!item) return;

    if (currentUser) {
      socket.emit('shopEquipItem', { itemId }, (res) => {
        if (res && res.ok && res.user) {
          currentUser = res.user;
          if (currentUser.skin) selectedSkin = currentUser.skin;
          saveUserSessionToStorage(currentUser);
          window.soundManager.playUiPop();
          const isNowEq = currentUser.equipped && currentUser.equipped[item.type] === item.id;
          showShopFeedback(isNowEq ? `✨ "${item.name}" kuşanıldı!` : `↺ "${item.name}" çıkarıldı.`, false);
          updateCareerAndShopUI();
        } else {
          showShopFeedback((res && res.error) || 'İşlem başarısız.', true);
        }
      });
      return;
    }

    if (!guestEconomy.ownedItems.includes(itemId)) return;
    if (guestEconomy.equipped[item.type] === itemId) {
      guestEconomy.equipped[item.type] = null;
      if (item.type === 'hat') selectedSkin = 'crown';
      showShopFeedback(`↺ "${item.name}" çıkarıldı.`, false);
    } else {
      guestEconomy.equipped[item.type] = itemId;
      if (item.type === 'hat') selectedSkin = itemId;
      showShopFeedback(`✨ "${item.name}" kuşanıldı!`, false);
    }
    window.soundManager.playUiPop();
    saveGuestEconomyToStorage();
    syncGuestLoadoutToServer();
    updateCareerAndShopUI();
  }

  function setActiveShopCategoryTab(tabName) {
    currentShopTab = tabName || 'hat';
    document.querySelectorAll('.shop-tab-btn').forEach((b) => {
      const cat = b.dataset.shopCat || b.dataset.shopTab;
      b.classList.toggle('active', cat === currentShopTab);
    });
    renderShopModal();
  }

  function openShopModal(tab = null) {
    window.soundManager.init();
    window.soundManager.playUiPop();
    if (tab && typeof tab === 'string') {
      setActiveShopCategoryTab(tab);
    } else {
      setActiveShopCategoryTab(currentShopTab || 'hat');
    }
    showShopFeedback('', false);
    updateCareerAndShopUI();
    if (shopModal) shopModal.style.display = 'flex';
  }

  if (openShopBtn) openShopBtn.addEventListener('click', () => openShopModal());
  if (openShopTopBtn) openShopTopBtn.addEventListener('click', () => openShopModal());
  if (openShopBottomBtn) openShopBottomBtn.addEventListener('click', () => openShopModal());
  if (openShopFromEndBtn) {
    openShopFromEndBtn.addEventListener('click', () => {
      matchEndModal.style.display = 'none';
      openShopModal();
    });
  }
  if (shopCloseBtn) {
    shopCloseBtn.addEventListener('click', () => {
      shopModal.style.display = 'none';
    });
  }

  document.querySelectorAll('.shop-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      window.soundManager.init();
      window.soundManager.playUiPop();
      const targetTab = btn.dataset.shopCat || btn.dataset.shopTab || 'hat';
      setActiveShopCategoryTab(targetTab);
    });
  });

  if (shopClaimPackBtn) {
    shopClaimPackBtn.addEventListener('click', () => {
      window.soundManager.init();
      window.soundManager.playUiPop();
      showShopFeedback('🪙 Gerçek Slime Coin satın alma paketleri çok yakında aktif olacak! Şimdilik maçlarda kemer keserek ve rakip eleyerek 💎 Slime Puan kazanabilirsin.', false);
    });
  }

  // storeItems.json dosyasını doğrudan da yükle (anında mağaza erişimi için)
  fetch('/storeItems.json')
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (Array.isArray(data) && data.length > 0 && storeItems.length === 0) {
        storeItems = data;
        updateCareerAndShopUI();
      }
    })
    .catch(() => {});

  function updateAuthUI() {
    if (currentUser) {
      authGuestOrMemberBox.style.display = 'none';
      loggedInUserBox.style.display = 'flex';
      memberDisplayNameEl.textContent = `@${currentUser.username}`;
      memberFullnameEl.textContent = currentUser.fullName;
      memberFriendsStatEl.textContent = `👥 ${currentUser.friendCount || 0} Arkadaş`;
      memberWinsStatEl.textContent = `🏆 ${(currentUser.stats && currentUser.stats.wins) || 0} Galibiyet`;
      myFriendCountBadge.textContent = String(currentUser.friendCount || 0);
      skinLockBadge.textContent = '✓ Üye & Mağaza Açık';
      skinLockBadge.style.color = '#00F59B';
      selectedColor = currentUser.color || selectedColor;
      selectedSkin = currentUser.skin || selectedSkin;
    } else {
      authGuestOrMemberBox.style.display = 'block';
      loggedInUserBox.style.display = 'none';
      myFriendCountBadge.textContent = String(guestFriends.length || 0);
      skinLockBadge.textContent = '🛒 Mağaza & Renkler Açık';
      skinLockBadge.style.color = '#00F5D4';
      if (selectedModeId !== 'ffa') selectedModeId = 'ffa';
    }
    renderColorAndSkinSelectors();
    renderModesList();
    updateCareerAndShopUI();
  }

  function renderColorAndSkinSelectors() {
    colorPaletteContainer.innerHTML = availableColors.map((c) => {
      const isSel = c.id === selectedColor ? 'color-swatch selected' : 'color-swatch';
      return `<div class="${isSel}" style="background:${c.id}; color:${c.id};" title="${c.name}" data-color="${c.id}"></div>`;
    }).join('');

    colorPaletteContainer.querySelectorAll('.color-swatch').forEach((el) => {
      el.addEventListener('click', () => {
        selectedColor = el.dataset.color;
        if (currentUser) {
          currentUser.color = selectedColor;
          saveUserSessionToStorage(currentUser);
          socket.emit('updateCustomization', { color: selectedColor, skin: selectedSkin }, (res) => {
            if (res && res.ok && res.user) {
              currentUser = res.user;
              saveUserSessionToStorage(currentUser);
            }
          });
        } else {
          saveGuestEconomyToStorage();
          syncGuestLoadoutToServer();
        }
        renderColorAndSkinSelectors();
      });
    });

    skinsGridContainer.innerHTML = availableSkins.map((s) => {
      const isSel = s.id === selectedSkin ? 'skin-item selected' : 'skin-item';
      return `<div class="${isSel}" data-skin="${s.id}">
        <span style="font-size:18px;">${s.icon}</span>
        <span>${s.name}</span>
      </div>`;
    }).join('');

    skinsGridContainer.querySelectorAll('.skin-item').forEach((el) => {
      el.addEventListener('click', () => {
        if (!currentUser) {
          switchAuthTab('register');
          authFeedback.style.color = '#FFB800';
          authFeedback.textContent = '👑 Basic 10 üye kostümünü seçmek için hızlı üye ol veya 🛒 Mağaza\'dan puanla yeni şapkalar al!';
          return;
        }
        selectedSkin = el.dataset.skin;
        currentUser.skin = selectedSkin;
        if (currentUser.equipped) currentUser.equipped.hat = null;
        saveUserSessionToStorage(currentUser);
        renderColorAndSkinSelectors();
        socket.emit('updateCustomization', { color: selectedColor, skin: selectedSkin }, (res) => {
          if (res && res.ok && res.user) {
            currentUser = res.user;
            saveUserSessionToStorage(currentUser);
            updateCareerAndShopUI();
          }
        });
      });
    });
  }

  function renderModesList() {
    modesListContainer.innerHTML = availableModes.map((m) => {
      const summary = roomsSummary.find((r) => r.id === m.id);
      const isSel = m.id === selectedModeId ? 'mode-card selected' : 'mode-card';
      let badgeText = '';
      if (summary) {
        if (m.isTeam) {
          badgeText = `🟢 ${summary.seferCount}/${m.teamSize} vs 🔴 ${summary.telliCount}/${m.teamSize}`;
        } else {
          badgeText = `🌐 ${summary.total} Aktif`;
        }
      }
      const lockIcon = m.isTeam && !currentUser ? '🔒 ' : '';
      return `<div class="${isSel}" data-mode="${m.id}">
        <div class="mode-card-top">
          <span>${lockIcon}${m.icon} ${m.name}</span>
          <span style="font-size:11px; color:#00F5D4;">${badgeText}</span>
        </div>
        <div class="mode-card-desc">${m.desc}</div>
        <div style="display:flex; gap:6px; margin-top:7px;">
          <button type="button" class="mode-quick-join-btn" data-mode="${m.id}" style="flex:1; background:rgba(255,42,133,0.22); color:#FF70A6; border:1px solid #FF2A85; border-radius:7px; padding:4px 8px; font-size:11px; font-weight:800; cursor:pointer;">🚀 Maça Katıl</button>
          <button type="button" class="mode-quick-watch-btn" data-mode="${m.id}" style="flex:1; background:rgba(139,92,246,0.24); color:#C4B5FD; border:1px solid #8B5CF6; border-radius:7px; padding:4px 8px; font-size:11px; font-weight:800; cursor:pointer;">👀 Maçı İzle</button>
        </div>
      </div>`;
    }).join('');

    modesListContainer.querySelectorAll('.mode-card').forEach((el) => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const modeId = el.dataset.mode;
        selectedModeId = modeId;
        try {
          localStorage.setItem('slimeio_selected_mode', selectedModeId);
        } catch (_e) {}
        renderModesList();
      });
    });

    modesListContainer.querySelectorAll('.mode-quick-join-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const modeId = btn.dataset.mode;
        selectedModeId = modeId;
        renderModesList();
        enterRoom(modeId, null, false);
      });
    });

    modesListContainer.querySelectorAll('.mode-quick-watch-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const modeId = btn.dataset.mode;
        selectedModeId = modeId;
        renderModesList();
        enterRoom(modeId, null, true);
      });
    });
  }

  // Sayfa yüklenir yüklenmez kayıtlı oturumu ve kostümü anında yükle
  restoreLocalUserSessionImmediately();
  updateAuthUI();

  // Üye Giriş / Kayıt İşlemleri
  doLoginBtn.addEventListener('click', () => {
    const username = loginUsernameInput.value.trim();
    const password = loginPasswordInput.value.trim();
    socket.emit('authLogin', { username, password }, (res) => {
      if (res && res.ok) {
        currentUser = res.user;
        saveUserSessionToStorage(currentUser, password);
        updateAuthUI();
      } else {
        authFeedback.style.color = '#FF2A85';
        authFeedback.textContent = (res && res.error) || 'Giriş yapılamadı.';
      }
    });
  });

  doRegisterBtn.addEventListener('click', () => {
    const fullName = regFullnameInput.value.trim();
    const username = regUsernameInput.value.trim();
    const password = regPasswordInput.value.trim();
    socket.emit('authRegister', {
      fullName,
      username,
      password,
      color: selectedColor,
      skin: selectedSkin
    }, (res) => {
      if (res && res.ok) {
        currentUser = res.user;
        saveUserSessionToStorage(currentUser, password);
        updateAuthUI();
      } else {
        authFeedback.style.color = '#FF2A85';
        authFeedback.textContent = (res && res.error) || 'Kayıt oluşturulamadı.';
      }
    });
  });

  logoutBtn.addEventListener('click', () => {
    currentUser = null;
    localStorage.removeItem('slimeio_creds');
    localStorage.setItem('slimeio_selected_mode', 'ffa');
    selectedModeId = 'ffa';
    updateAuthUI();
  });

  // Odaya Katılma veya Maçı Canlı İzleme
  function enterRoom(roomId, preferredTeam = null, watchOnly = false) {
    window.soundManager.init();
    window.soundManager.playUiPop();
    const guestName = guestNameInput.value.trim();
    if (!currentUser && guestName) {
      localStorage.setItem('slimeio_guest_name', guestName);
    }

    socket.emit('joinRoom', {
      roomId,
      guestName,
      preferredTeam,
      watchOnly: Boolean(watchOnly)
    }, (res) => {
      if (!res || !res.ok) {
        if (res && res.requireAuth) {
          lobbyModal.style.display = 'flex';
          switchAuthTab('register');
        }
        authFeedback.style.color = '#FF2A85';
        authFeedback.textContent = (res && res.error) || 'Odaya girilemedi!';
        return;
      }

      currentRoomId = res.roomId;
      lobbyModal.style.display = 'none';
      matchEndModal.style.display = 'none';
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
      window.focus();

      if (res.watchOnly) {
        teamWaitingModal.style.display = 'none';
        setTimeout(() => {
          if (!followedPlayerId) {
            cycleSpectatedPlayer(1);
          }
        }, 320);
      } else if (res.isTeam && res.roomStatus === 'waiting_for_teams') {
        teamWaitingModal.style.display = 'flex';
      } else {
        teamWaitingModal.style.display = 'none';
      }
    });
  }

  function cycleSpectatedPlayer(direction = 1) {
    const aliveList = [...renderPlayers.values()].filter((p) => p.alive && !p.watchOnly && p.id !== selfId);
    if (aliveList.length === 0) {
      setCameraFollowPlayer(null, '');
      return;
    }
    const currIdx = aliveList.findIndex((p) => p.id === followedPlayerId);
    const nextIdx = (currIdx + direction + aliveList.length) % aliveList.length;
    const chosen = aliveList[nextIdx];
    if (chosen) {
      setCameraFollowPlayer(chosen.id, chosen.name);
      window.soundManager.playUiPop();
    }
  }

  if (specPrevBtn) {
    specPrevBtn.addEventListener('click', () => cycleSpectatedPlayer(-1));
  }
  if (specNextBtn) {
    specNextBtn.addEventListener('click', () => cycleSpectatedPlayer(1));
  }
  if (specOverviewBtn) {
    specOverviewBtn.addEventListener('click', () => {
      setCameraFollowPlayer(null, '');
      window.soundManager.playUiPop();
    });
  }
  if (specJoinPlayBtn) {
    specJoinPlayBtn.addEventListener('click', () => {
      setCameraFollowPlayer(null, '');
      enterRoom(currentRoomId || selectedModeId, null, false);
    });
  }

  joinGameBtn.addEventListener('click', () => {
    enterRoom(selectedModeId, null, false);
  });

  if (watchGameBtn) {
    watchGameBtn.addEventListener('click', () => {
      enterRoom(selectedModeId, null, true);
    });
  }

  guestNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') enterRoom(selectedModeId, null, false);
  });

  // Takım Bekleme Odası Butonları
  joinSeferBtn.addEventListener('click', () => {
    socket.emit('selectTeam', 'seferogullari', (res) => {
      if (res && !res.ok && res.error) alert(res.error);
    });
  });

  joinTelliBtn.addEventListener('click', () => {
    socket.emit('selectTeam', 'telliogullari', (res) => {
      if (res && !res.ok && res.error) alert(res.error);
    });
  });

  if (teamLobbyFillBotsBtn) {
    teamLobbyFillBotsBtn.addEventListener('click', () => {
      window.soundManager.init();
      window.soundManager.playUiPop();
      socket.emit('fillTeamRoomWithBotsAndStart', {}, (res) => {
        if (res && !res.ok && res.error) {
          alert(res.error);
        }
      });
    });
  }

  teamLobbyBackBtn.addEventListener('click', () => {
    socket.emit('leaveRoom');
    teamWaitingModal.style.display = 'none';
    lobbyModal.style.display = 'flex';
  });

  teamLobbyInviteBtn.addEventListener('click', () => {
    openFriendsModal();
  });

  openLobbyBtn.addEventListener('click', () => {
    lobbyModal.style.display = 'flex';
  });

  backToLobbyFromEndBtn.addEventListener('click', () => {
    matchEndModal.style.display = 'none';
    lobbyModal.style.display = 'flex';
  });

  function shareGameLink(btnEl) {
    window.soundManager.init();
    window.soundManager.playUiPop();
    const shareUrl = window.location.origin || 'https://slimeio.com';
    const shareText = 'Slime.io v2.0 — Gel arenada kemerleri koparalım! Seferoğulları vs Tellioğulları ve Açık Dünya seni bekliyor!';
    if (navigator.share && isTouchDevice) {
      navigator.share({
        title: 'Slime.io v2.0 — Online Multiplayer',
        text: shareText,
        url: shareUrl
      }).catch(() => {});
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(`${shareText} ${shareUrl}`).then(() => {
        if (btnEl) {
          const orig = btnEl.textContent;
          btnEl.textContent = '✓ Link Kopyalandı!';
          setTimeout(() => {
            btnEl.textContent = orig;
          }, 2000);
        }
      }).catch(() => {});
    }
  }

  if (shareGameBtn) {
    shareGameBtn.addEventListener('click', () => shareGameLink(shareGameBtn));
  }
  if (shareBottomBtn) {
    shareBottomBtn.addEventListener('click', () => shareGameLink(shareBottomBtn));
  }

  muteBtn.addEventListener('click', () => {
    const isMuted = window.soundManager.toggleMute();
    muteBtn.textContent = isMuted ? '🔇 Ses' : '🔊 Ses';
  });

  // --- PROFİL İNCELEME, TAKİP ET (ARKADAŞ EKLE) & KAMERA İZLEME SİSTEMİ ---
  window.inspectPlayerProfile = (targetId, targetUsername, statusFeedback = '') => {
    const fallbackSelf = {
      name: (guestNameInput && guestNameInput.value.trim()) || 'Misafir Slime',
      color: selectedColor,
      skin: selectedSkin
    };

    socket.emit('inspectProfile', { targetId, targetUsername, fallbackSelf }, (res) => {
      if (!res || !res.ok || !res.profile) return;
      const pf = res.profile;
      const resolvedId = pf.targetId || targetId || null;
      const skinObj = availableSkins.find((s) => s.id === pf.skin) || { icon: '👑', name: 'Klasik' };
      const isSelf = Boolean(
        pf.isSelf ||
        (resolvedId && resolvedId === selfId) ||
        (currentUser && pf.username && pf.username === currentUser.username)
      );

      const badgeRole = pf.isBot
        ? `<span style="background:rgba(139,92,246,0.22); color:#C4B5FD; padding:2px 8px; border-radius:999px; font-size:10px; font-weight:800;">🤖 BOT</span>`
        : pf.isRegistered
          ? `<span style="background:rgba(0,245,155,0.2); color:#00F59B; padding:2px 8px; border-radius:999px; font-size:10px; font-weight:800;">✓ ÜYE</span>`
          : `<span style="background:rgba(255,184,0,0.2); color:#FFE066; padding:2px 8px; border-radius:999px; font-size:10px; font-weight:800;">⚡ MİSAFİR</span>`;

      const onlineText = pf.online
        ? `<span style="color:#00F59B; font-weight:800;">● Çevrimiçi${pf.currentRoomName ? ' (' + escapeHtml(pf.currentRoomName) + ')' : ''}</span>`
        : `<span style="color:#64748B;">○ Çevrimdışı</span>`;

      profileContent.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:flex-start; gap:14px; background:rgba(255,255,255,0.04); padding:14px; border-radius:16px; border:1px solid rgba(255,255,255,0.08);">
          <div style="width:58px; height:58px; border-radius:50%; background:${escapeHtml(pf.color)}; display:flex; align-items:center; justify-content:center; font-size:30px; box-shadow:0 0 18px ${escapeHtml(pf.color)}; border:2.5px solid #FFF; flex-shrink:0;">
            ${skinObj.icon}
          </div>
          <div style="text-align:left; flex:1; overflow:hidden;">
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
              <span style="font-size:18px; font-weight:900; color:#FFF;">${escapeHtml(pf.displayName)}</span>
              ${badgeRole}
            </div>
            <div style="font-size:12px; color:#94A3B8; margin-top:2px;">${escapeHtml(pf.fullName)} ${pf.username ? '(@' + escapeHtml(pf.username) + ')' : ''}</div>
            <div style="font-size:11px; margin-top:4px; display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
              <span style="color:#00F5D4;">Kostüm: ${skinObj.icon} ${escapeHtml(skinObj.name)}</span>
              <span>•</span>
              ${onlineText}
            </div>
          </div>
        </div>
        <div style="background:rgba(0,245,155,0.12); border:1.5px solid #00F59B; border-radius:12px; padding:10px; font-size:15px; font-weight:900; color:#00F59B; display:flex; justify-content:center; align-items:center; gap:8px;">
          <span>👥 Takipçi / Arkadaş Sayısı: ${pf.friendCount || 0}</span>
          ${pf.isFriend ? '<span style="background:#00F59B; color:#080B12; font-size:10.5px; padding:2px 8px; border-radius:999px;">✓ Takip Ediliyor</span>' : ''}
        </div>
        <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:8px; font-size:12px;">
          <div style="background:rgba(255,255,255,0.04); padding:8px; border-radius:10px;">
            <div style="color:#94A3B8;">Toplam Puan</div>
            <div style="font-size:15px; font-weight:900; color:#FFE066;">${(pf.stats && pf.stats.totalScore) || 0}</div>
          </div>
          <div style="background:rgba(255,255,255,0.04); padding:8px; border-radius:10px;">
            <div style="color:#94A3B8;">Kesim / Eleme</div>
            <div style="font-size:15px; font-weight:900; color:#FF70A6;">✂️${(pf.stats && pf.stats.totalCuts) || 0} / 💀${(pf.stats && pf.stats.totalKills) || 0}</div>
          </div>
          <div style="background:rgba(255,255,255,0.04); padding:8px; border-radius:10px;">
            <div style="color:#94A3B8;">Galibiyet</div>
            <div style="font-size:15px; font-weight:900; color:#00BBF9;">🏆 ${(pf.stats && pf.stats.wins) || 0}</div>
          </div>
        </div>
      `;

      if (profileFeedbackMsg) {
        profileFeedbackMsg.style.color = '#00F59B';
        profileFeedbackMsg.textContent = statusFeedback || '';
      }

      if (isSelf) {
        profileAddFriendBtn.style.display = 'inline-block';
        profileAddFriendBtn.style.background = 'linear-gradient(135deg,#00F5D4,#00BBF9)';
        profileAddFriendBtn.textContent = '🎨 Kostüm & Profil Düzenle';
        profileAddFriendBtn.onclick = () => {
          profileModal.style.display = 'none';
          lobbyModal.style.display = 'flex';
        };
        if (profileWatchBtn) profileWatchBtn.style.display = 'none';
        profileInviteBtn.style.display = 'none';
      } else {
        // 1) Takip Et / Arkadaş Ekle veya Takibi Bırak butonu (Tüm oyuncular ve botlar için aktif)
        profileAddFriendBtn.style.display = 'inline-block';
        if (pf.isFriend) {
          profileAddFriendBtn.style.background = 'rgba(255,42,133,0.22)';
          profileAddFriendBtn.style.color = '#FF70A6';
          profileAddFriendBtn.style.border = '1px solid #FF2A85';
          profileAddFriendBtn.textContent = '✓ Takip Ediliyor (Bırak)';
          profileAddFriendBtn.onclick = () => {
            socket.emit('removeFriend', { targetUsername: pf.username || pf.displayName, targetId: resolvedId }, (rRes) => {
              if (rRes && rRes.ok) {
                if (currentUser) {
                  currentUser.friendCount = rRes.friendCount;
                  currentUser.friends = (currentUser.friends || []).filter((u) => u !== pf.username);
                  saveUserSessionToStorage(currentUser);
                } else if (Array.isArray(rRes.friendsList)) {
                  guestFriends = rRes.friendsList;
                  saveGuestFriendsToStorage();
                }
                updateAuthUI();
                window.inspectPlayerProfile(resolvedId, pf.username || pf.displayName, 'Takip bırakıldı.');
              }
            });
          };
        } else {
          profileAddFriendBtn.style.background = 'linear-gradient(135deg,#00F5D4,#00BBF9)';
          profileAddFriendBtn.style.color = '#080B12';
          profileAddFriendBtn.style.border = 'none';
          profileAddFriendBtn.textContent = '➕ Takip Et / Arkadaş Ekle';
          profileAddFriendBtn.onclick = () => {
            socket.emit('addFriend', { targetUsername: pf.username || pf.displayName, targetId: resolvedId }, (fRes) => {
              if (fRes && fRes.ok) {
                if (currentUser) {
                  currentUser.friendCount = fRes.friendCount;
                  if (fRes.targetUsername && !(currentUser.friends || []).includes(fRes.targetUsername)) {
                    currentUser.friends = [...(currentUser.friends || []), fRes.targetUsername];
                  }
                  saveUserSessionToStorage(currentUser);
                } else if (Array.isArray(fRes.friendsList)) {
                  guestFriends = fRes.friendsList;
                  saveGuestFriendsToStorage();
                }
                updateAuthUI();
                window.inspectPlayerProfile(
                  resolvedId,
                  fRes.targetUsername || pf.username || pf.displayName,
                  `✓ ${pf.displayName} takip listene ve arkadaşlarına eklendi!`
                );
              } else if (profileFeedbackMsg) {
                profileFeedbackMsg.style.color = '#FF2A85';
                profileFeedbackMsg.textContent = (fRes && fRes.error) || 'Takip edilemedi.';
              }
            });
          };
        }

        // 2) Kamerayla Takip Et (İzle) butonu
        if (profileWatchBtn) {
          const canWatchInArena = Boolean((resolvedId && renderPlayers.has(resolvedId)) || pf.currentRoomId);
          profileWatchBtn.style.display = canWatchInArena ? 'inline-block' : 'none';
          const isCurrentlyWatching = Boolean(resolvedId && followedPlayerId === resolvedId);
          profileWatchBtn.textContent = isCurrentlyWatching ? '🎥 Takibi Bırak' : '🎥 Kamerayla Takip Et';
          profileWatchBtn.onclick = () => {
            if (isCurrentlyWatching) {
              setCameraFollowPlayer(null, '');
              profileModal.style.display = 'none';
              return;
            }
            if (pf.currentRoomId && pf.currentRoomId !== currentRoomId) {
              enterRoom(pf.currentRoomId);
            }
            if (resolvedId) {
              setCameraFollowPlayer(resolvedId, pf.displayName);
            }
            profileModal.style.display = 'none';
          };
        }

        // 3) Oyuna Davet Et butonu
        profileInviteBtn.style.display = pf.online ? 'inline-block' : 'none';
        profileInviteBtn.textContent = '📩 Oyuna Davet Et';
        profileInviteBtn.onclick = () => {
          socket.emit(
            'sendGameInvite',
            { targetUsername: pf.username || pf.displayName, targetId: resolvedId, roomId: currentRoomId || selectedModeId },
            (invRes) => {
              if (invRes && invRes.ok) {
                profileInviteBtn.textContent = '✓ Davet Gönderildi!';
                if (profileFeedbackMsg) {
                  profileFeedbackMsg.style.color = '#00F59B';
                  profileFeedbackMsg.textContent = invRes.message || `✓ ${pf.displayName} oyuncusuna oyun daveti gönderildi!`;
                }
              } else if (profileFeedbackMsg) {
                profileFeedbackMsg.style.color = '#FF2A85';
                profileFeedbackMsg.textContent = (invRes && invRes.error) || 'Davet gönderilemedi.';
              }
            }
          );
        };
      }

      profileModal.style.display = 'flex';
    });
  };

  profileCloseBtn.addEventListener('click', () => {
    profileModal.style.display = 'none';
  });

  openMyProfileBtn.addEventListener('click', () => {
    if (currentUser) {
      window.inspectPlayerProfile(selfId, currentUser.username);
    } else {
      window.inspectPlayerProfile(selfId, null);
    }
  });

  function openFriendsModal() {
    friendActionMsg.style.color = '#00F59B';
    friendActionMsg.textContent = currentUser
      ? ''
      : '💡 Misafir modundasın: Takip ettiğin oyuncular bu cihazda kaydedilir. Tüm cihazlardan erişmek için üye olabilirsin!';
    friendsModal.style.display = 'flex';
    refreshFriendsList();
  }

  function refreshFriendsList() {
    socket.emit('getFriendsList', { guestFriends }, (res) => {
      if (!res || !res.ok) return;
      friendsCountTitle.textContent = `Toplam ${res.friendCount || 0} Takip Edilen / Arkadaş`;
      myFriendCountBadge.textContent = String(res.friendCount || 0);
      if (currentUser) {
        currentUser.friendCount = res.friendCount || 0;
        saveUserSessionToStorage(currentUser);
      }

      if (!res.friends || res.friends.length === 0) {
        friendsListBox.innerHTML = `<div style="text-align:center; color:#64748B; padding:18px; font-size:13px;">Henüz takip ettiğin bir oyuncu yok. Yukarıdan oyuncu adı yazarak veya sağ üstteki Skor Tablosunda herhangi bir oyuncuya tıklayıp <strong>➕ Takip Et</strong> diyerek ekleyebilirsin!</div>`;
        return;
      }

      friendsListBox.innerHTML = res.friends.map((f) => {
        const skinObj = availableSkins.find((s) => s.id === f.skin) || { icon: '👑', name: 'Klasik' };
        const safeUsername = escapeHtml(f.username || '');
        const safeDisplayName = escapeHtml(f.displayName || f.username || '');
        const safeTargetId = escapeHtml(f.targetId || '');
        const safeRoomId = escapeHtml(f.roomId || '');
        const statusDot = f.online
          ? `<span style="color:#00F59B; font-size:11px; font-weight:800;">● Çevrimiçi ${f.roomName ? '(' + escapeHtml(f.roomName) + ')' : ''}</span>`
          : `<span style="color:#64748B; font-size:11px;">○ Çevrimdışı</span>`;

        const watchBtnHtml = f.online && f.targetId
          ? `<button class="btn-primary" style="padding:5px 9px; font-size:11px; background:linear-gradient(135deg,#8B5CF6,#EC4899); color:#FFF;" onclick="watchFriendFromList('${safeTargetId}', '${safeDisplayName}', '${safeRoomId}')">🎥 İzle</button>`
          : '';

        const inviteBtnHtml = f.online
          ? `<button class="btn-primary" style="padding:5px 9px; font-size:11px;" onclick="inviteFriendByUsername('${safeUsername}', '${safeTargetId}')">📩 Davet</button>`
          : '';

        return `<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:10px; border:1px solid rgba(255,255,255,0.06);">
          <div style="display:flex; align-items:center; gap:10px; cursor:pointer; flex:1; overflow:hidden;" onclick="inspectPlayerProfile('${safeTargetId}', '${safeUsername}')">
            <div style="width:34px; height:34px; border-radius:50%; background:${escapeHtml(f.color || '#00F5D4')}; display:flex; align-items:center; justify-content:center; font-size:17px; border:1.5px solid #FFF; flex-shrink:0;">
              ${skinObj.icon}
            </div>
            <div style="overflow:hidden;">
              <div style="font-weight:900; font-size:13px; color:#FFF; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${safeDisplayName} <span style="color:#94A3B8; font-weight:600; font-size:11px;">(@${safeUsername})</span></div>
              <div>${statusDot} • <span style="font-size:11px; color:#00BBF9;">👥 ${f.friendCount || 0} Takipçi</span></div>
            </div>
          </div>
          <div style="display:flex; gap:5px; flex-shrink:0;">
            ${watchBtnHtml}
            ${inviteBtnHtml}
          </div>
        </div>`;
      }).join('');
    });
  }

  window.watchFriendFromList = (targetId, displayName, roomId) => {
    friendsModal.style.display = 'none';
    if (roomId && roomId !== currentRoomId) {
      enterRoom(roomId);
    }
    if (targetId) {
      setCameraFollowPlayer(targetId, displayName);
    }
  };

  window.inviteFriendByUsername = (username, targetId = null) => {
    socket.emit('sendGameInvite', { targetUsername: username, targetId, roomId: currentRoomId || selectedModeId }, (res) => {
      if (res && res.ok) {
        friendActionMsg.style.color = '#00F59B';
        friendActionMsg.textContent = res.message || `✓ @${username} oyuncusuna davet gönderildi!`;
      } else {
        friendActionMsg.style.color = '#FF2A85';
        friendActionMsg.textContent = (res && res.error) || 'Davet gönderilemedi.';
      }
    });
  };

  openFriendsBtn.addEventListener('click', openFriendsModal);
  friendsCloseBtn.addEventListener('click', () => {
    friendsModal.style.display = 'none';
  });

  function submitAddFriendByInput() {
    const val = addFriendInput.value.trim().replace(/^@/, '');
    if (!val) return;
    socket.emit('addFriend', { targetUsername: val }, (res) => {
      if (res && res.ok) {
        addFriendInput.value = '';
        if (currentUser) {
          currentUser.friendCount = res.friendCount;
          if (res.targetUsername && !(currentUser.friends || []).includes(res.targetUsername)) {
            currentUser.friends = [...(currentUser.friends || []), res.targetUsername];
          }
          saveUserSessionToStorage(currentUser);
        } else if (Array.isArray(res.friendsList)) {
          guestFriends = res.friendsList;
          saveGuestFriendsToStorage();
        }
        friendActionMsg.style.color = '#00F59B';
        friendActionMsg.textContent = `✓ ${res.targetDisplayName} takip listene eklendi!`;
        refreshFriendsList();
        updateAuthUI();
      } else {
        friendActionMsg.style.color = '#FF2A85';
        friendActionMsg.textContent = (res && res.error) || 'Oyuncu bulunamadı.';
      }
    });
  }

  addFriendSubmitBtn.addEventListener('click', submitAddFriendByInput);
  addFriendInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitAddFriendByInput();
  });

  // Gelen Oyun Daveti (Toast)
  socket.on('gameInviteReceived', (data) => {
    pendingInviteData = data;
    inviteToastText.textContent = `@${data.fromUsername} seni [${data.roomName}] odasına davet ediyor!`;
    inviteToast.style.display = 'block';
    window.soundManager.playUiPop();
  });

  inviteAcceptBtn.addEventListener('click', () => {
    inviteToast.style.display = 'none';
    if (pendingInviteData) {
      enterRoom(pendingInviteData.roomId, pendingInviteData.preferredTeam);
      pendingInviteData = null;
    }
  });

  inviteDeclineBtn.addEventListener('click', () => {
    inviteToast.style.display = 'none';
    pendingInviteData = null;
  });

  socket.on('friendAddedNotification', ({ fromUsername }) => {
    floatingTexts.push({
      text: `👥 @${fromUsername} seni arkadaş ekledi!`,
      x: camera.x,
      y: camera.y - 60,
      color: '#00F59B',
      alpha: 1.0,
      vy: -0.9
    });
  });

  // Ping Ölçümü
  setInterval(() => {
    if (socket.connected) {
      const start = performance.now();
      socket.emit('pingCheck', start, () => {
        currentPingMs = Math.max(1, Math.round(performance.now() - start));
        netStatusEl.textContent = `🌐 ${totalOnline} Oyuncu | ⚡ ${currentPingMs} ms`;
      });
    }
  }, 2500);

  const camera = { x: 0, y: 0, zoom: 0.85, targetGameplayZoom: 0.85 };
  const mouseScreen = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const mouseWorld = { x: 0, y: 0 };

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const scaleFactor = Math.min(canvas.width / 1280, canvas.height / 760);
    camera.targetGameplayZoom = Math.max(0.42, Math.min(0.92, scaleFactor * 0.88));
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Klavye (WASD / Yön Tuşları + Space Ok Atma + E/Shift Kemer Koparma) Durumu
  const keyboard = {
    up: false,
    down: false,
    left: false,
    right: false,
    mode: 'mouse', // 'mouse' | 'keyboard'
    aimAngle: 0
  };

  function isKeyboardMoving() {
    return keyboard.up || keyboard.down || keyboard.left || keyboard.right;
  }

  function getKeyboardVector() {
    let kx = 0;
    let ky = 0;
    if (keyboard.left) kx -= 1;
    if (keyboard.right) kx += 1;
    if (keyboard.up) ky -= 1;
    if (keyboard.down) ky += 1;
    return { kx, ky };
  }

  function isElementVisible(el) {
    if (!el) return false;
    return window.getComputedStyle(el).display !== 'none';
  }

  function isTypingInInput(target) {
    if (!target) return false;
    if (target.offsetParent === null) return false;
    const tag = (target.tagName || '').toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }

  function updateMouseWorld() {
    const me = renderPlayers.get(selfId);

    // 1) Mobil sanal joystick aktifse
    if (joystick.active && me && me.alive) {
      const dx = joystick.currX - joystick.startX;
      const dy = joystick.currY - joystick.startY;
      const dist = Math.hypot(dx, dy);
      if (dist > 4) {
        joystick.aimAngle = Math.atan2(dy, dx);
        const ratio = Math.min(dist / joystick.maxRadius, 1.0);
        const worldDist = ratio * config.MAX_INPUT_DIST;
        mouseWorld.x = me.renderX + Math.cos(joystick.aimAngle) * worldDist;
        mouseWorld.y = me.renderY + Math.sin(joystick.aimAngle) * worldDist;
      } else {
        mouseWorld.x = me.renderX;
        mouseWorld.y = me.renderY;
      }
      return;
    }

    // 2) PC Klavye (WASD / Yön Tuşları) kontrolü
    const { kx, ky } = getKeyboardVector();
    if (kx !== 0 || ky !== 0) {
      keyboard.mode = 'keyboard';
      const len = Math.hypot(kx, ky) || 1;
      const nx = kx / len;
      const ny = ky / len;
      keyboard.aimAngle = Math.atan2(ny, nx);

      if (me && me.waitingForWall && !me.spectating) {
        // Duvar seçimi ekranında klavye yön tuşları imleci arenada gezdirir
        mouseScreen.x = Math.max(20, Math.min(canvas.width - 20, mouseScreen.x + nx * 16));
        mouseScreen.y = Math.max(20, Math.min(canvas.height - 20, mouseScreen.y + ny * 16));
        mouseWorld.x = (mouseScreen.x - canvas.width / 2) / camera.zoom + camera.x;
        mouseWorld.y = (mouseScreen.y - canvas.height / 2) / camera.zoom + camera.y;
        return;
      }

      if (me && me.alive) {
        mouseWorld.x = me.renderX + nx * config.MAX_INPUT_DIST;
        mouseWorld.y = me.renderY + ny * config.MAX_INPUT_DIST;
        return;
      }
    } else if (keyboard.mode === 'keyboard' && me && me.alive) {
      // Sadece klavye ile oynarken tuşlar bırakıldığında karakter fareye çekilmesin, olduğu yönde süzülsün
      mouseWorld.x = me.renderX;
      mouseWorld.y = me.renderY;
      return;
    }

    // 3) Standart Fare (Mouse) kontrolü
    mouseWorld.x = (mouseScreen.x - canvas.width / 2) / camera.zoom + camera.x;
    mouseWorld.y = (mouseScreen.y - canvas.height / 2) / camera.zoom + camera.y;
  }

  function getNearestWallPreview(wx, wy) {
    const halfW = config.ARENA_WIDTH / 2;
    const halfH = config.ARENA_HEIGHT / 2;
    const cx = Math.max(-halfW + 40, Math.min(halfW - 40, wx || 0));
    const cy = Math.max(-halfH + 40, Math.min(halfH - 40, wy || 0));

    let best = null;
    let bestDist = Infinity;

    for (const obs of mapObstacles) {
      const dx = cx - obs.x;
      const dy = cy - obs.y;
      const dist = Math.hypot(dx, dy) || 1;
      const approxR = obs.radius || Math.max(obs.w || 60, obs.h || 60) * 0.5;
      const sDist = Math.abs(dist - approxR);
      if (sDist < bestDist) {
        bestDist = sDist;
        const nx = dx / dist;
        const ny = dy / dist;
        best = {
          anchorX: obs.x + nx * approxR,
          anchorY: obs.y + ny * approxR,
          spawnX: obs.x + nx * (approxR + config.PLAYER_RADIUS + 18),
          spawnY: obs.y + ny * (approxR + config.PLAYER_RADIUS + 18)
        };
      }
    }

    const dTop = Math.abs(cy - (-halfH));
    const dBottom = Math.abs(cy - halfH);
    const dLeft = Math.abs(cx - (-halfW));
    const dRight = Math.abs(cx - halfW);

    if (dTop < bestDist) {
      bestDist = dTop;
      best = { anchorX: cx, anchorY: -halfH, spawnX: cx, spawnY: -halfH + config.PLAYER_RADIUS + 18 };
    }
    if (dBottom < bestDist) {
      bestDist = dBottom;
      best = { anchorX: cx, anchorY: halfH, spawnX: cx, spawnY: halfH - config.PLAYER_RADIUS - 18 };
    }
    if (dLeft < bestDist) {
      bestDist = dLeft;
      best = { anchorX: -halfW, anchorY: cy, spawnX: -halfW + config.PLAYER_RADIUS + 18, spawnY: cy };
    }
    if (dRight < bestDist) {
      best = { anchorX: halfW, anchorY: cy, spawnX: halfW - config.PLAYER_RADIUS - 18, spawnY: cy };
    }

    return best || { anchorX: 0, anchorY: -halfH, spawnX: 0, spawnY: -halfH + 40 };
  }

  // --- FARE, KLAVYE VE DOKUNMATİK KONTROLLERİ ---
  let lastMouseEmitTime = 0;

  window.addEventListener('mousemove', (e) => {
    joystick.active = false;
    joystick.touchId = null;
    const movedDist = Math.hypot(e.clientX - mouseScreen.x, e.clientY - mouseScreen.y);
    mouseScreen.x = e.clientX;
    mouseScreen.y = e.clientY;
    if (!isKeyboardMoving() && movedDist > 4) {
      keyboard.mode = 'mouse';
    }
    updateMouseWorld();
    sendMouseTarget();
  });

  window.addEventListener('keydown', (e) => {
    if (isTypingInInput(e.target)) return;
    if (
      isElementVisible(lobbyModal) ||
      isElementVisible(shopModal) ||
      isElementVisible(profileModal) ||
      isElementVisible(friendsModal)
    ) {
      return;
    }

    const code = e.code;
    const key = (e.key || '').toLowerCase();

    let handledMove = false;
    if (code === 'KeyW' || code === 'ArrowUp' || key === 'w') {
      keyboard.up = true;
      handledMove = true;
    }
    if (code === 'KeyS' || code === 'ArrowDown' || key === 's') {
      keyboard.down = true;
      handledMove = true;
    }
    if (code === 'KeyA' || code === 'ArrowLeft' || key === 'a') {
      keyboard.left = true;
      handledMove = true;
    }
    if (code === 'KeyD' || code === 'ArrowRight' || key === 'd') {
      keyboard.right = true;
      handledMove = true;
    }

    if (handledMove) {
      e.preventDefault();
      window.soundManager.init();
      joystick.active = false;
      joystick.touchId = null;
      keyboard.mode = 'keyboard';
      updateMouseWorld();
      sendMouseTarget(true);
      return;
    }

    const me = renderPlayers.get(selfId);
    if (!me || me.spectating) return;

    // Boşluk (Space), Enter, J veya Z -> Duvar Seçiminde Doğma / Oyunda Slime Oku Fırlatma
    if (code === 'Space' || code === 'Enter' || code === 'KeyJ' || code === 'KeyZ') {
      e.preventDefault();
      window.soundManager.init();
      if (me.waitingForWall) {
        updateMouseWorld();
        socket.emit('spawnAtWall', { x: mouseWorld.x, y: mouseWorld.y });
      } else if (me.alive) {
        const aimAngle = keyboard.mode === 'keyboard'
          ? keyboard.aimAngle
          : Math.atan2(mouseWorld.y - me.renderY, mouseWorld.x - me.renderX);
        const tx = me.renderX + Math.cos(aimAngle) * 400;
        const ty = me.renderY + Math.sin(aimAngle) * 400;
        socket.emit('shootArrow', { x: tx, y: ty });
      }
      return;
    }

    // E, Shift, Q, K veya X -> Kendi Kemerini Koparma
    if (
      code === 'KeyE' ||
      code === 'ShiftLeft' ||
      code === 'ShiftRight' ||
      code === 'KeyQ' ||
      code === 'KeyK' ||
      code === 'KeyX'
    ) {
      e.preventDefault();
      window.soundManager.init();
      if (me.alive) {
        const aimAngle = keyboard.mode === 'keyboard'
          ? keyboard.aimAngle
          : Math.atan2(mouseWorld.y - me.renderY, mouseWorld.x - me.renderX);
        const tx = me.renderX + Math.cos(aimAngle) * 400;
        const ty = me.renderY + Math.sin(aimAngle) * 400;
        socket.emit('cutOwnBelt', { x: tx, y: ty });
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    const code = e.code;
    const key = (e.key || '').toLowerCase();
    let changed = false;

    if (code === 'KeyW' || code === 'ArrowUp' || key === 'w') {
      keyboard.up = false;
      changed = true;
    }
    if (code === 'KeyS' || code === 'ArrowDown' || key === 's') {
      keyboard.down = false;
      changed = true;
    }
    if (code === 'KeyA' || code === 'ArrowLeft' || key === 'a') {
      keyboard.left = false;
      changed = true;
    }
    if (code === 'KeyD' || code === 'ArrowRight' || key === 'd') {
      keyboard.right = false;
      changed = true;
    }

    if (changed) {
      updateMouseWorld();
      sendMouseTarget(true);
    }
  });

  window.addEventListener('blur', () => {
    keyboard.up = false;
    keyboard.down = false;
    keyboard.left = false;
    keyboard.right = false;
  });

  window.addEventListener('contextmenu', (e) => e.preventDefault());

  function findPlayerAtWorldPoint(wx, wy) {
    let closest = null;
    let bestDist = (config.PLAYER_RADIUS || 24) * 2.4;
    for (const p of renderPlayers.values()) {
      if (!p.alive) continue;
      const d = Math.hypot((p.renderX || p.x) - wx, (p.renderY || p.y) - wy);
      if (d <= bestDist) {
        bestDist = d;
        closest = p;
      }
    }
    return closest;
  }

  window.addEventListener('mousedown', (e) => {
    if (
      e.target.closest('button') ||
      e.target.closest('input') ||
      e.target.closest('.modal-backdrop') ||
      e.target.closest('#leaderboard') ||
      e.target.closest('#camera-follow-banner') ||
      e.target.closest('#invite-toast')
    ) {
      return;
    }
    if (isTouchDevice && e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;

    window.soundManager.init();
    joystick.active = false;
    joystick.touchId = null;
    mouseScreen.x = e.clientX;
    mouseScreen.y = e.clientY;
    const clickWorldX = (mouseScreen.x - canvas.width / 2) / camera.zoom + camera.x;
    const clickWorldY = (mouseScreen.y - canvas.height / 2) / camera.zoom + camera.y;
    if (!isKeyboardMoving()) {
      keyboard.mode = 'mouse';
    }
    updateMouseWorld();

    const me = renderPlayers.get(selfId);

    // İzleyici modunda, yeniden doğuş beklerken veya Alt+Tık / Orta Tuş ile arenadaki bir Slime'a tıklanırsa profilini aç
    if (!me || me.spectating || (!me.alive && !me.waitingForWall) || e.altKey || e.button === 1) {
      const clickedPlayer = findPlayerAtWorldPoint(clickWorldX, clickWorldY);
      if (clickedPlayer) {
        window.inspectPlayerProfile(clickedPlayer.id, clickedPlayer.username || clickedPlayer.name);
        return;
      }
    }

    if (!me || me.spectating) return;

    if (e.button === 0) {
      if (me.waitingForWall) {
        socket.emit('spawnAtWall', { x: clickWorldX, y: clickWorldY });
      } else if (me.alive) {
        socket.emit('shootArrow', { x: clickWorldX, y: clickWorldY });
      }
      return;
    }

    if (e.button === 2 && me.alive) {
      socket.emit('cutOwnBelt', { x: clickWorldX, y: clickWorldY });
    }
  });

  canvas.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      window.soundManager.init();
      mobileActionBtns.style.display = 'flex';

      const me = renderPlayers.get(selfId);
      const touch = e.changedTouches[0];
      if (!touch) return;

      const tapWorldX = (touch.clientX - canvas.width / 2) / camera.zoom + camera.x;
      const tapWorldY = (touch.clientY - canvas.height / 2) / camera.zoom + camera.y;

      if (!me || me.spectating || (!me.alive && !me.waitingForWall)) {
        const tappedPlayer = findPlayerAtWorldPoint(tapWorldX, tapWorldY);
        if (tappedPlayer) {
          window.inspectPlayerProfile(tappedPlayer.id, tappedPlayer.username || tappedPlayer.name);
        }
        return;
      }

      if (me.waitingForWall) {
        joystick.active = false;
        joystick.touchId = null;
        mouseScreen.x = touch.clientX;
        mouseScreen.y = touch.clientY;
        updateMouseWorld();
        socket.emit('spawnAtWall', { x: mouseWorld.x, y: mouseWorld.y });
        return;
      }

      if (!joystick.active) {
        joystick.active = true;
        joystick.touchId = touch.identifier;
        joystick.startX = touch.clientX;
        joystick.startY = touch.clientY;
        joystick.currX = touch.clientX;
        joystick.currY = touch.clientY;
        sendMouseTarget(true);
      } else if (me.alive) {
        socket.emit('shootArrow', { x: tapWorldX, y: tapWorldY });
      }
    },
    { passive: false }
  );

  canvas.addEventListener(
    'touchmove',
    (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const t = e.changedTouches[i];
        if (joystick.active && t.identifier === joystick.touchId) {
          joystick.currX = t.clientX;
          joystick.currY = t.clientY;
          sendMouseTarget();
        }
      }
    },
    { passive: false }
  );

  function handleTouchEnd(e) {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (joystick.active && t.identifier === joystick.touchId) {
        joystick.active = false;
        joystick.touchId = null;
      }
    }
  }
  window.addEventListener('touchend', handleTouchEnd, { passive: false });
  window.addEventListener('touchcancel', handleTouchEnd, { passive: false });

  function triggerMobileShoot(e) {
    e.preventDefault();
    e.stopPropagation();
    window.soundManager.init();
    const me = renderPlayers.get(selfId);
    if (!me || !me.alive) return;
    const tx = me.renderX + Math.cos(joystick.aimAngle) * 400;
    const ty = me.renderY + Math.sin(joystick.aimAngle) * 400;
    socket.emit('shootArrow', { x: tx, y: ty });
  }
  mobShootBtn.addEventListener('touchstart', triggerMobileShoot, { passive: false });
  mobShootBtn.addEventListener('click', triggerMobileShoot);

  function triggerMobileCut(e) {
    e.preventDefault();
    e.stopPropagation();
    window.soundManager.init();
    const me = renderPlayers.get(selfId);
    if (!me || !me.alive) return;
    const tx = me.renderX + Math.cos(joystick.aimAngle) * 400;
    const ty = me.renderY + Math.sin(joystick.aimAngle) * 400;
    socket.emit('cutOwnBelt', { x: tx, y: ty });
  }
  mobCutBtn.addEventListener('touchstart', triggerMobileCut, { passive: false });
  mobCutBtn.addEventListener('click', triggerMobileCut);

  function sendMouseTarget(force = false) {
    updateMouseWorld();
    const now = performance.now();
    if (!force && now - lastMouseEmitTime < 28) return;
    lastMouseEmitTime = now;
    socket.emit('mouseMove', { x: mouseWorld.x, y: mouseWorld.y });
  }

  function getTargetedOwnBeltId(player) {
    if (!player || !player.alive || player.bands.length <= 1) return null;
    const lookAngle = joystick.active
      ? joystick.aimAngle
      : keyboard.mode === 'keyboard'
        ? keyboard.aimAngle
        : Math.atan2(mouseWorld.y - player.renderY, mouseWorld.x - player.renderX);
    let bestId = null;
    let smallestDiff = Infinity;

    for (const b of player.bands) {
      const beltAngle = Math.atan2(b.anchorY - player.renderY, b.anchorX - player.renderX);
      const diff = Math.abs(Math.atan2(Math.sin(lookAngle - beltAngle), Math.cos(lookAngle - beltAngle)));
      if (diff < smallestDiff) {
        smallestDiff = diff;
        bestId = b.id;
      }
    }
    return smallestDiff <= Math.PI * 0.65 ? bestId : null;
  }

  // --- SOCKET.IO OLAYLARI ---
  socket.on('init', (data) => {
    selfId = data.selfId;
    config = data.config || config;
    availableColors = data.colors || availableColors;
    availableSkins = data.skins || availableSkins;
    availableModes = data.modes || availableModes;
    mapObstacles = data.obstacles || [];
    roomsSummary = data.roomsSummary || [];
    if (Array.isArray(data.storeItems) && data.storeItems.length > 0) {
      storeItems = data.storeItems;
    }

    resizeCanvas();
    restoreLocalUserSessionImmediately();
    updateAuthUI();

    const savedCredsRaw = localStorage.getItem('slimeio_creds');
    if (savedCredsRaw) {
      try {
        const creds = JSON.parse(savedCredsRaw);
        if (creds && creds.username && creds.password) {
          socket.emit('authRestoreSession', { ...creds, autoRestore: true }, (res) => {
            if (res && res.ok && res.user) {
              currentUser = res.user;
              saveUserSessionToStorage(currentUser, creds.password);
            }
            updateAuthUI();
          });
          return;
        }
      } catch (_e) {}
    }

    syncGuestLoadoutToServer();
  });

  socket.on('roomsSummary', (list) => {
    roomsSummary = list || [];
    if (lobbyModal.style.display !== 'none') {
      renderModesList();
    }
  });

  socket.on('teamMatchCountdown', ({ seconds, message }) => {
    window.soundManager.playUiPop();
    teamLobbyStatusEl.style.color = '#00F59B';
    teamLobbyStatusEl.textContent = `${message} (${seconds} sn)`;
  });

  socket.on('returnedToTeamLobby', () => {
    matchEndModal.style.display = 'none';
    const me = renderPlayers.get(selfId);
    if (me && me.watchOnly) {
      teamWaitingModal.style.display = 'none';
    } else {
      teamWaitingModal.style.display = 'flex';
    }
  });

  socket.on('bandAttached', ({ playerId }) => {
    const p = renderPlayers.get(playerId);
    if (playerId === selfId) {
      window.soundManager.playWallAttachScream();
      if (p) p.impactPulse = 1.0;
    } else if (p && followedPlayerId === playerId) {
      window.soundManager.playWallAttachScream(p.renderX, p.renderY, camera.x, camera.y);
      p.impactPulse = 1.0;
    }
  });

  socket.on('arrowShot', ({ playerId }) => {
    const p = renderPlayers.get(playerId);
    if (playerId === selfId) {
      window.soundManager.playArrowShoot();
    } else if (p) {
      window.soundManager.playArrowShoot(p.renderX, p.renderY, camera.x, camera.y);
    }
  });

  socket.on('arrowSplat', ({ x, y, color }) => {
    window.soundManager.playSlimeSplat(x, y, camera.x, camera.y);
    splatEffects.push({ x, y, color: color || '#00F5D4', radius: 7, alpha: 1.0 });
  });

  socket.on('bandSnapped', ({ snapX, snapY }) => {
    window.soundManager.playBandSnap(snapX, snapY, camera.x, camera.y);
    snapEffects.push({ x: snapX, y: snapY, radius: 8, alpha: 1.0 });
  });

  socket.on('noSlimeAmmo', () => {
    const me = renderPlayers.get(selfId);
    if (me) {
      floatingTexts.push({
        text: '🏹 Ok İçin En Az 2 Kemer Gerekli! Engellere Çarp!',
        x: me.renderX,
        y: me.renderY - 38,
        color: '#FFE066',
        alpha: 1.0,
        vy: -1.1
      });
    }
  });

  socket.on('cannotCutLastBelt', () => {
    const me = renderPlayers.get(selfId);
    if (me) {
      floatingTexts.push({
        text: 'Son Kemer Koparılamaz! Önce Başka Engele Bağlan!',
        x: me.renderX,
        y: me.renderY - 35,
        color: '#FF2A85',
        alpha: 1.0,
        vy: -1.1
      });
    }
  });

  socket.on('scorePopup', ({ playerId, amount, reason, x, y }) => {
    const p = renderPlayers.get(playerId);
    floatingTexts.push({
      text: `+${amount} ${reason}`,
      x,
      y,
      color: p ? p.color : '#00F5D4',
      alpha: 1.0,
      vy: -1.4
    });
  });

  // Canlı Kesim ve Eleme (Öldürme) Slime Puan / Coin Ödülü Bildirimi
  socket.on('combatReward', ({ points, coins, reason, slimePoints, slimeCoins, totalCuts, totalKills }) => {
    const addPts = Number(points) || 0;
    const addCoins = Number(coins) || 0;

    if (currentUser) {
      if (Number.isFinite(Number(slimePoints))) currentUser.slimePoints = Number(slimePoints);
      else currentUser.slimePoints = (currentUser.slimePoints || 0) + addPts;

      if (Number.isFinite(Number(slimeCoins))) currentUser.slimeCoins = Number(slimeCoins);
      else currentUser.slimeCoins = (currentUser.slimeCoins || 0) + addCoins;

      if (!currentUser.stats) currentUser.stats = { totalScore: 0, totalCuts: 0, totalKills: 0, matchesPlayed: 0, wins: 0 };
      if (Number.isFinite(Number(totalCuts))) currentUser.stats.totalCuts = Number(totalCuts);
      if (Number.isFinite(Number(totalKills))) currentUser.stats.totalKills = Number(totalKills);
      saveUserSessionToStorage(currentUser);
    } else {
      guestEconomy.slimePoints += addPts;
      guestEconomy.slimeCoins += addCoins;
      if (reason === 'Kemer Kesimi') guestEconomy.stats.totalCuts += 1;
      if (reason === 'Rakip Eleme') {
        guestEconomy.stats.totalKills += 1;
        guestEconomy.stats.totalScore += 50;
      } else {
        guestEconomy.stats.totalScore += 20;
      }
      saveGuestEconomyToStorage();
    }

    updateCareerAndShopUI();

    const me = renderPlayers.get(selfId);
    if (me && addPts > 0) {
      const coinStr = addCoins > 0 ? ` +${addCoins} 🪙` : '';
      floatingTexts.push({
        text: `+${addPts} 💎 Slime Puan${coinStr}`,
        x: me.renderX,
        y: me.renderY - 52,
        color: '#00F5D4',
        alpha: 1.0,
        vy: -1.6
      });
    }
  });

  socket.on('powerupCollected', ({ playerId, powerupId, x, y }) => {
    const meta = POWERUP_META[powerupId] || POWERUP_META.high_speed;
    const p = renderPlayers.get(playerId);
    if (p) {
      p.activePowerup = powerupId;
      p.powerupRemaining = config.POWERUP_DURATION_MS || 10000;
      p.impactPulse = 1.2;
    }
    if (playerId === selfId) {
      window.soundManager.playPowerupPickup();
    } else {
      window.soundManager.playPowerupPickup(x, y, camera.x, camera.y);
    }
    splatEffects.push({ x, y, color: meta.color, radius: 14, alpha: 1.0 });
    snapEffects.push({ x, y, radius: 12, alpha: 1.0, color: meta.color });
  });

  socket.on('powerupExpired', ({ playerId }) => {
    const p = renderPlayers.get(playerId);
    if (p) {
      p.activePowerup = null;
      p.powerupRemaining = 0;
    }
  });

  function spawnKillAnimation(x, y, effectId, victimColor) {
    const type = effectId || 'kill_confetti';
    const particles = [];
    const count = type === 'kill_pixel' ? 22 : 18;
    const palette = ['#00F5D4', '#FF2A85', '#FFE066', '#00BBF9', '#9B5DE5', '#00F59B', victimColor || '#FF2A85'];
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      const spd = 2.2 + Math.random() * 5.2;
      particles.push({
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - (type === 'kill_confetti' ? 1.5 : 0),
        size: 4 + Math.random() * 5,
        color: palette[i % palette.length],
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.25
      });
    }
    killAnimations.push({
      x: Number(x) || 0,
      y: Number(y) || 0,
      type,
      color: victimColor || '#FF2A85',
      startTime: performance.now(),
      duration: 1450,
      particles
    });
  }

  socket.on('playerDied', ({ victimId, killerId, x, y, killEffect, victimColor }) => {
    const victim = renderPlayers.get(victimId);
    const fxX = Number.isFinite(Number(x)) ? Number(x) : victim ? victim.renderX : 0;
    const fxY = Number.isFinite(Number(y)) ? Number(y) : victim ? victim.renderY : 0;
    spawnKillAnimation(fxX, fxY, killEffect || 'kill_confetti', victimColor || (victim && victim.color) || '#FF2A85');

    if (killEffect === 'kill_screen_crack' && (victimId === selfId || killerId === selfId)) {
      screenCrackUntil = performance.now() + 550;
    }

    if (victimId === selfId) {
      joystick.active = false;
      joystick.touchId = null;
      window.soundManager.playDeathPop();
    } else if (followedPlayerId === victimId) {
      window.soundManager.playDeathPop();
    }
  });

  socket.on('readyForWallSelect', () => {
    joystick.active = false;
    joystick.touchId = null;
    const me = renderPlayers.get(selfId);
    if (me) {
      me.waitingForWall = true;
      me.alive = false;
    }
    overlayEl.style.display = 'none';
    myBandsEl.textContent = '🎯 Doğmak İçin Bir Kayaya/Duvara Dokun!';
    updateMouseWorld();
  });

  socket.on('matchRewardsEarned', (reward) => {
    if (!reward) return;
    const earnedPoints = Number(reward.earnedPoints) || 0;
    const earnedCoins = Number(reward.earnedCoins) || 0;

    if (currentUser) {
      if (Number.isFinite(Number(reward.totalSlimePoints))) {
        currentUser.slimePoints = Number(reward.totalSlimePoints);
      } else {
        currentUser.slimePoints = (currentUser.slimePoints || 0) + earnedPoints;
      }
      if (Number.isFinite(Number(reward.totalSlimeCoins))) {
        currentUser.slimeCoins = Number(reward.totalSlimeCoins);
      } else {
        currentUser.slimeCoins = (currentUser.slimeCoins || 0) + earnedCoins;
      }
      if (reward.stats) {
        currentUser.stats = reward.stats;
      }
      saveUserSessionToStorage(currentUser);
    } else {
      guestEconomy.slimePoints += earnedPoints;
      guestEconomy.slimeCoins += earnedCoins;
      guestEconomy.stats.matchesPlayed = (guestEconomy.stats.matchesPlayed || 0) + 1;
      guestEconomy.stats.totalScore = (guestEconomy.stats.totalScore || 0) + (Number(reward.score) || 0);
      if (reward.won) guestEconomy.stats.wins = (guestEconomy.stats.wins || 0) + 1;
      saveGuestEconomyToStorage();
    }

    updateAuthUI();
    updateCareerAndShopUI();

    const eco = getActiveEconomy();
    if (matchRewardSummaryEl) {
      matchRewardSummaryEl.style.display = 'flex';
      matchRewardSummaryEl.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:2px;">
          <span style="font-size:11px; font-weight:900; color:#00F5D4; text-transform:uppercase;">🎁 Maç Sonu Kazancın (Kemer Kesme & Eleme Ödülü)</span>
          <span style="font-size:12px; color:#E2E8F0;">✂️ ${reward.cuts || 0} Kesim  •  💀 ${reward.kills || 0} Eleme  •  ⭐ ${reward.score || 0} Skor ${reward.won ? ' • 🏆 ŞAMPİYONLUK BONUSLU!' : ''}</span>
        </div>
        <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
          <span style="background:rgba(0,245,212,0.18); border:1.5px solid #00F5D4; color:#00F5D4; padding:5px 12px; border-radius:10px; font-weight:900; font-size:14px;">+${earnedPoints.toLocaleString('tr-TR')} 💎 Slime Puan</span>
          ${earnedCoins > 0 ? `<span style="background:rgba(255,224,102,0.18); border:1.5px solid #FFE066; color:#FFE066; padding:5px 12px; border-radius:10px; font-weight:900; font-size:14px;">+${earnedCoins.toLocaleString('tr-TR')} 🪙 Slime Coin</span>` : ''}
          <span style="font-size:11.5px; color:#94A3B8; font-weight:800;">Toplam Cüzdan: <strong style="color:#00F5D4;">${(eco.slimePoints || 0).toLocaleString('tr-TR')} 💎</strong> | <strong style="color:#FFE066;">${(eco.slimeCoins || 0).toLocaleString('tr-TR')} 🪙</strong></span>
        </div>
      `;
    }
  });

  socket.on('matchEnded', ({ isTeam, seferScore, telliScore, winnerName, winnerScore, winnerBands, standings, nextMatchIn }) => {
    overlayEl.style.display = 'none';
    spectatorBannerEl.style.display = 'none';
    matchEndModal.style.display = 'flex';
    window.soundManager.playUiPop();

    winnerTitleEl.textContent = `👑 Şampiyon: ${winnerName}`;
    winnerSubtitleEl.textContent = isTeam
      ? `🟢 Seferoğulları: ${seferScore} Puan  •  🔴 Tellioğulları: ${telliScore} Puan`
      : `${winnerScore} Toplam Puan • ${winnerBands} Aktif Kemer`;

    finalStandingsBody.innerHTML = (standings || [])
      .slice(0, 10)
      .map((p, idx) => {
        const medal = idx === 0 ? '🥇 1.' : idx === 1 ? '🥈 2.' : idx === 2 ? '🥉 3.' : `${idx + 1}.`;
        const rowClass = p.id === selfId ? 'me-row' : '';
        const teamLabel = p.team === 'seferogullari' ? '🟢 ' : p.team === 'telliogullari' ? '🔴 ' : '';
        const safeId = escapeHtml(p.id || '');
        const safeUser = escapeHtml(p.username || '');
        const safeName = escapeHtml(p.name || 'Slime');
        const safeColor = escapeHtml(p.color || '#00F5D4');
        const earnedBadge = p.earnedPoints ? ` <span style="color:#00F5D4; font-size:11px;">(+${p.earnedPoints}💎)</span>` : '';
        return `<tr class="${rowClass}" data-player-id="${safeId}" data-username="${safeUser}" style="cursor:pointer;" onclick="inspectPlayerProfile('${safeId}', '${safeUser}')">
          <td>${medal}</td>
          <td style="text-align:left;">
            <span class="lb-dot" style="background:${safeColor}; color:${safeColor}; margin-right:6px;"></span>${teamLabel}${safeName}
          </td>
          <td>${p.bandsCount}</td>
          <td>✂️ ${p.cuts}</td>
          <td>💀 ${p.kills}</td>
          <td style="text-align:right; font-weight:900; color:#FFE066;">${p.score} Puan${earnedBadge}</td>
        </tr>`;
      })
      .join('');

    let remSec = Math.ceil((nextMatchIn || 10000) / 1000);
    nextMatchCountdownEl.textContent = `Yeni tur ${remSec} sn içinde başlıyor...`;
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
      remSec = Math.max(0, remSec - 1);
      nextMatchCountdownEl.textContent = `Yeni tur ${remSec} sn içinde başlıyor...`;
    }, 1000);
  });

  socket.on('matchRestarted', () => {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    matchEndModal.style.display = 'none';
    teamWaitingModal.style.display = 'none';
    spectatorBannerEl.style.display = 'none';
    overlayEl.style.display = 'none';
  });

  function updateTeamWaitingRoomUI(state) {
    const meInState = (state.players || []).find((p) => p.id === selfId);
    if (!state.isTeam || (meInState && meInState.watchOnly)) {
      teamWaitingModal.style.display = 'none';
      return;
    }

    if (state.roomStatus === 'waiting_for_teams' || state.roomStatus === 'starting_countdown') {
      if (lobbyModal.style.display === 'none') {
        teamWaitingModal.style.display = 'flex';
      }
      teamLobbyTitleEl.textContent = `⚔️ ${state.roomName.toUpperCase()} LOBİSİ`;
      if (state.roomStatus === 'starting_countdown') {
        teamLobbyStatusEl.style.color = '#00F59B';
        teamLobbyStatusEl.textContent = `🔥 TAKIMLAR HAZIR! MAÇ ${state.remainingSec} SANİYE İÇİNDE BAŞLIYOR!`;
        if (teamLobbyFillBotsBtn) teamLobbyFillBotsBtn.style.display = 'none';
      } else {
        const totalCap = state.teamSize * 2;
        const curr = state.seferCount + state.telliCount;
        teamLobbyStatusEl.style.color = '#FFE066';
        teamLobbyStatusEl.textContent = `⏳ Takımların dolması bekleniyor (${curr}/${totalCap})... Dolduğunda maç otomatik başlar!`;
        if (teamLobbyFillBotsBtn) teamLobbyFillBotsBtn.style.display = 'inline-block';
      }

      seferCountBadgeEl.textContent = `${state.seferCount}/${state.teamSize}`;
      telliCountBadgeEl.textContent = `${state.telliCount}/${state.teamSize}`;

      const seferPlayers = state.players.filter((p) => p.team === 'seferogullari');
      const telliPlayers = state.players.filter((p) => p.team === 'telliogullari');
      const sig = `${state.teamSize}|${seferPlayers.map((p) => p.id + ':' + p.name).join(',')}|${telliPlayers.map((p) => p.id + ':' + p.name).join(',')}`;
      if (sig === lastTeamSlotsSignature) return;
      lastTeamSlotsSignature = sig;

      let seferHtml = '';
      for (let i = 0; i < state.teamSize; i++) {
        const p = seferPlayers[i];
        if (p) {
          const safeId = escapeHtml(p.id || '');
          const safeUser = escapeHtml(p.username || '');
          const safeName = escapeHtml(p.name || 'Slime');
          seferHtml += `<div class="team-slot" data-player-id="${safeId}" data-username="${safeUser}" style="cursor:pointer;" onclick="inspectPlayerProfile('${safeId}','${safeUser}')">
            <span>🟢 ${safeName} ${p.id === selfId ? '(Sen)' : ''}</span>
            <span style="color:#00F59B;">👤 Profil / Hazır ✓</span>
          </div>`;
        } else {
          seferHtml += `<div class="team-slot" style="color:#64748B;"><span>Boş Koltuk #${i + 1}</span><span>Bekleniyor...</span></div>`;
        }
      }
      seferSlotsListEl.innerHTML = seferHtml;

      let telliHtml = '';
      for (let i = 0; i < state.teamSize; i++) {
        const p = telliPlayers[i];
        if (p) {
          const safeId = escapeHtml(p.id || '');
          const safeUser = escapeHtml(p.username || '');
          const safeName = escapeHtml(p.name || 'Slime');
          telliHtml += `<div class="team-slot" data-player-id="${safeId}" data-username="${safeUser}" style="cursor:pointer;" onclick="inspectPlayerProfile('${safeId}','${safeUser}')">
            <span>🔴 ${safeName} ${p.id === selfId ? '(Sen)' : ''}</span>
            <span style="color:#FF2A85;">👤 Profil / Hazır ✓</span>
          </div>`;
        } else {
          telliHtml += `<div class="team-slot" style="color:#64748B;"><span>Boş Koltuk #${i + 1}</span><span>Bekleniyor...</span></div>`;
        }
      }
      telliSlotsListEl.innerHTML = telliHtml;
    } else {
      teamWaitingModal.style.display = 'none';
    }
  }

  socket.on('stateUpdate', (state) => {
    const {
      roomStatus,
      isTeam,
      seferScore,
      telliScore,
      isMatchOver: serverMatchOver,
      onlineCount,
      remainingSec,
      players,
      arrows,
      powerups
    } = state;

    totalOnline = onlineCount || players.length;
    netStatusEl.textContent = `🌐 ${totalOnline} Oyuncu | ⚡ ${currentPingMs} ms`;

    const mins = String(Math.floor(remainingSec / 60)).padStart(2, '0');
    const secs = String(remainingSec % 60).padStart(2, '0');
    timerEl.textContent = `${mins}:${secs}`;

    if (isTeam) {
      teamHudScoresEl.style.display = 'flex';
      hudSeferScoreEl.textContent = `🟢 Sefer: ${seferScore || 0}`;
      hudTelliScoreEl.textContent = `🔴 Telli: ${telliScore || 0}`;
    } else {
      teamHudScoresEl.style.display = 'none';
    }

    updateTeamWaitingRoomUI(state);

    renderArrows = arrows || [];
    renderPowerups = powerups || [];

    const activeIds = new Set();
    for (const p of players) {
      activeIds.add(p.id);
      const existing = renderPlayers.get(p.id);
      if (!existing) {
        renderPlayers.set(p.id, {
          ...p,
          renderX: p.x,
          renderY: p.y,
          wobblePhase: Math.random() * Math.PI * 2,
          impactPulse: 0
        });
      } else {
        const justSpawned = !existing.alive && p.alive;
        existing.name = p.name;
        existing.username = p.username;
        existing.color = p.color;
        existing.skin = p.skin;
        existing.equipped = p.equipped || existing.equipped || null;
        existing.team = p.team;
        existing.alive = p.alive;
        existing.waitingForWall = p.waitingForWall;
        existing.spectating = p.spectating;
        existing.watchOnly = p.watchOnly;
        existing.score = p.score;
        existing.cuts = p.cuts;
        existing.kills = p.kills;
        existing.respawnRemaining = p.respawnRemaining;
        existing.activePowerup = p.activePowerup;
        existing.powerupRemaining = p.powerupRemaining;
        existing.x = p.x;
        existing.y = p.y;
        existing.vx = p.vx;
        existing.vy = p.vy;
        existing.bands = p.bands;
        if (justSpawned) {
          existing.renderX = p.x;
          existing.renderY = p.y;
          if (p.id === selfId && followedPlayerId) {
            setCameraFollowPlayer(null, '');
          }
        }
      }
    }

    for (const id of renderPlayers.keys()) {
      if (!activeIds.has(id)) renderPlayers.delete(id);
    }

    const me = renderPlayers.get(selfId);
    if (me && !serverMatchOver && roomStatus === 'playing') {
      const count = me.bands.length;
      const slimeAmmo = Math.max(0, count - 1);
      myScoreEl.textContent = `Puan: ${me.score || 0}`;

      if (me.watchOnly || me.spectating) {
        overlayEl.style.display = 'none';
        spectatorBannerEl.style.display = 'block';
        if (spectatorControlsBarEl && lobbyModal.style.display === 'none') {
          spectatorControlsBarEl.style.display = 'flex';
        }
        if (me.watchOnly) {
          spectatorBannerEl.textContent = `👀 CANLI MAÇ İZLEME MODU (${mins}:${secs}) — Oyunculara tıklayıp kamerayla takip edebilir veya "🚀 Maça Katıl" ile oyuna girebilirsin!`;
          myBandsEl.textContent = '👀 Canlı İzleyici Modu';
        } else {
          spectatorBannerEl.textContent = `👀 İZLEYİCİ MODU — Oyuna başlamak için turun bitmesini bekleyiniz! Yeni turda herkesle eşit başlayacaksın (Kalan: ${mins}:${secs})`;
          myBandsEl.textContent = '⏳ Sonraki Tur Bekleniyor';
        }
      } else if (me.waitingForWall) {
        if (spectatorControlsBarEl) spectatorControlsBarEl.style.display = 'none';
        overlayEl.style.display = 'none';
        spectatorBannerEl.style.display = 'block';
        spectatorBannerEl.textContent = '🎯 DUVAR SEÇİMİ — Doğmak istediğin duvara/kayaya Sol Tıkla veya Klavyede [WASD / Yön Tuşları + Space] bas!';
        myBandsEl.textContent = '🎯 Doğmak İçin Duvara Tıkla / Space Bas!';
      } else if (me.alive) {
        if (spectatorControlsBarEl) spectatorControlsBarEl.style.display = 'none';
        spectatorBannerEl.style.display = 'none';
        overlayEl.style.display = 'none';
        const pMeta = me.activePowerup ? POWERUP_META[me.activePowerup] : null;
        const pSuffix = pMeta && me.powerupRemaining > 0
          ? ` | ${pMeta.icon} ${pMeta.name} (${(me.powerupRemaining / 1000).toFixed(1)}s)`
          : '';
        myBandsEl.textContent = `🔗 ${count} | 🏹 ${slimeAmmo}${pSuffix}`;
      } else {
        if (spectatorControlsBarEl) spectatorControlsBarEl.style.display = 'none';
        spectatorBannerEl.style.display = 'none';
        overlayEl.style.display = 'block';
        overlayTitleEl.textContent = 'Son Kemerin Koptu!';
        overlaySubEl.textContent = `5 sn sonra duvar seçip doğacaksın: ${(me.respawnRemaining / 1000).toFixed(1)} sn`;
      }
    } else if (spectatorControlsBarEl) {
      spectatorControlsBarEl.style.display = 'none';
    }

    const nowMs = performance.now();
    if (nowMs - lastLeaderboardRenderAt >= 350 || !leaderboardListEl.innerHTML) {
      lastLeaderboardRenderAt = nowMs;
      const sorted = [...players]
        .filter((p) => !p.watchOnly || p.id === selfId)
        .sort((a, b) => (b.score || 0) - (a.score || 0) || b.bands.length - a.bands.length)
        .slice(0, 8);
      const topScore = Math.max(100, sorted[0] ? sorted[0].score : 100);

      leaderboardListEl.innerHTML = sorted
        .map((p, idx) => {
          const pct = Math.min(100, Math.round(((p.score || 0) / topScore) * 100));
          const isMeClass = p.id === selfId ? 'lb-row is-me' : 'lb-row';
          const ammo = Math.max(0, p.bands.length - 1);
          const teamPrefix = p.team === 'seferogullari' ? '🟢 ' : p.team === 'telliogullari' ? '🔴 ' : '';
          const followBadge = followedPlayerId === p.id ? '🎥 ' : '';
          const safeId = escapeHtml(p.id || '');
          const safeUser = escapeHtml(p.username || '');
          const safeName = escapeHtml(p.name || 'Slime');
          const safeColor = escapeHtml(p.color || '#00F5D4');
          return `<li class="${isMeClass}" data-player-id="${safeId}" data-username="${safeUser}" title="Profili Gör & Takip Et">
            <div class="lb-bar" style="width:${pct}%; background:${safeColor};"></div>
            <div class="lb-left">
              <span>${idx + 1}.</span>
              <span class="lb-dot" style="background:${safeColor}; color:${safeColor};"></span>
              <span>${followBadge}${teamPrefix}${safeName}</span>
            </div>
            <div class="lb-right">
              <span class="lb-badge-belt">🔗${p.bands.length} (🏹${ammo})</span>
              <span class="lb-badge-cut">✂️${p.cuts || 0}</span>
              <span class="lb-score">${p.score || 0}p 👤</span>
            </div>
          </li>`;
        })
        .join('');
    }
  });

  // --- 3D PARLAK JÖLE RENK TONU ÖNBELLEĞİ ---
  const slimeShadeCache = new Map();

  function getSlimeColorShades(hex) {
    const key = String(hex || '#00F5D4').toUpperCase();
    if (slimeShadeCache.has(key)) return slimeShadeCache.get(key);

    let clean = key.replace('#', '');
    if (clean.length === 3) {
      clean = clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2];
    }
    const num = parseInt(clean, 16);
    const r = Number.isFinite(num) ? (num >> 16) & 255 : 0;
    const g = Number.isFinite(num) ? (num >> 8) & 255 : 245;
    const b = Number.isFinite(num) ? num & 255 : 212;

    const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
    const rgb = (rr, gg, bb) => `rgb(${clamp(rr)}, ${clamp(gg)}, ${clamp(bb)})`;
    const rgba = (rr, gg, bb, a) => `rgba(${clamp(rr)}, ${clamp(gg)}, ${clamp(bb)}, ${a})`;

    const shades = {
      base: key,
      highlight: rgb(r + (255 - r) * 0.58, g + (255 - g) * 0.58, b + (255 - b) * 0.58),
      midBright: rgb(r + (255 - r) * 0.22, g + (255 - g) * 0.22, b + (255 - b) * 0.22),
      deep: rgb(r * 0.52, g * 0.48, b * 0.56),
      darkEdge: rgb(r * 0.34, g * 0.30, b * 0.40),
      rimGlow: rgba(r + (255 - r) * 0.45, g + (255 - g) * 0.45, b + (255 - b) * 0.45, 0.72),
      bellyBounce: rgba(0, 245, 212, 0.42)
    };
    slimeShadeCache.set(key, shades);
    return shades;
  }

  // --- 3D KÜRESEL JÖLE GÖVDE + CAM PARLAMASI + KOSTÜM & MAĞAZA KAPLAMASI (SKIN) ---
  function draw3DSlimeBody(targetCtx, baseR, colorHex, time, wobblePhase = 0, skinId = 'crown', skinCoatingId = null) {
    let effectiveHex = colorHex;
    if (skinCoatingId === 'skin_rgb') {
      const rgbColors = ['#FF2A85', '#FFE066', '#00F59B', '#00BBF9', '#9B5DE5'];
      effectiveHex = rgbColors[Math.floor((time * 0.004) % rgbColors.length)];
    } else if (skinCoatingId === 'skin_gold_armor') {
      effectiveHex = '#FACC15';
    } else if (skinCoatingId === 'skin_lava') {
      effectiveHex = '#EA580C';
    } else if (skinCoatingId === 'skin_ice') {
      effectiveHex = '#38BDF8';
    } else if (skinCoatingId === 'skin_toxic') {
      effectiveHex = '#22C55E';
    } else if (skinCoatingId === 'skin_galaxy') {
      effectiveHex = '#6D28D9';
    } else if (skinCoatingId === 'skin_zombie') {
      effectiveHex = '#65A30D';
    } else if (skinCoatingId === 'skin_camo') {
      effectiveHex = '#4D7C0F';
    }

    const shades = getSlimeColorShades(effectiveHex);
    const points = skinCoatingId === 'skin_8bit' ? 12 : 24;

    targetCtx.save();
    if (skinCoatingId === 'skin_ghost') {
      targetCtx.globalAlpha = 0.58 + Math.sin(time * 0.006) * 0.14;
    }

    targetCtx.beginPath();
    for (let i = 0; i <= points; i++) {
      const a = (i / points) * Math.PI * 2;
      const jellyWave =
        Math.sin(a * 3 + time * 0.008 + wobblePhase) * (baseR * 0.055) +
        Math.cos(a * 2 - time * 0.005 + wobblePhase) * (baseR * 0.025);
      const r = baseR + jellyWave;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) targetCtx.moveTo(px, py);
      else targetCtx.lineTo(px, py);
    }
    targetCtx.closePath();

    // 1) Dış Neon Aura + 3D Küresel Radyal Gövde Gradyanı
    targetCtx.shadowColor = shades.base;
    targetCtx.shadowBlur = baseR * 0.75;
    const bodyGrad = targetCtx.createRadialGradient(
      -baseR * 0.32,
      -baseR * 0.36,
      baseR * 0.06,
      0,
      baseR * 0.08,
      baseR * 1.08
    );
    bodyGrad.addColorStop(0, shades.highlight);
    bodyGrad.addColorStop(0.28, shades.midBright);
    bodyGrad.addColorStop(0.64, shades.base);
    bodyGrad.addColorStop(0.90, shades.deep);
    bodyGrad.addColorStop(1, shades.darkEdge);

    targetCtx.fillStyle = bodyGrad;
    targetCtx.fill();
    targetCtx.shadowBlur = 0;

    // Gövde içi klipleme (iç yansımalar, mağaza kaplama dokuları ve kafa üstü kostüm parlaması)
    targetCtx.save();
    targetCtx.clip();

    // 1.5) MAĞAZA KAPLAMA DOKULARI (10 Özel Kaplama)
    if (skinCoatingId === 'skin_galaxy') {
      const galGrad = targetCtx.createRadialGradient(0, 0, 2, 0, 0, baseR);
      galGrad.addColorStop(0, 'rgba(236, 72, 153, 0.55)');
      galGrad.addColorStop(0.5, 'rgba(109, 40, 217, 0.65)');
      galGrad.addColorStop(1, 'rgba(15, 23, 42, 0.85)');
      targetCtx.fillStyle = galGrad;
      targetCtx.fillRect(-baseR * 1.2, -baseR * 1.2, baseR * 2.4, baseR * 2.4);
      for (let i = 0; i < 8; i++) {
        const ang = time * 0.0015 + i * 0.8;
        const dist = (i % 3 + 1) * (baseR * 0.24);
        targetCtx.beginPath();
        targetCtx.arc(Math.cos(ang) * dist, Math.sin(ang) * dist, i % 2 === 0 ? 1.8 : 1.1, 0, Math.PI * 2);
        targetCtx.fillStyle = i % 2 === 0 ? '#FFFFFF' : '#00F5D4';
        targetCtx.fill();
      }
    } else if (skinCoatingId === 'skin_lava') {
      targetCtx.strokeStyle = '#FEF08A';
      targetCtx.shadowColor = '#FACC15';
      targetCtx.shadowBlur = 8;
      targetCtx.lineWidth = 2.2;
      targetCtx.beginPath();
      targetCtx.moveTo(-baseR * 0.7, -baseR * 0.2);
      targetCtx.lineTo(-baseR * 0.1, baseR * 0.15);
      targetCtx.lineTo(baseR * 0.6, -baseR * 0.3);
      targetCtx.moveTo(-baseR * 0.2, baseR * 0.15);
      targetCtx.lineTo(baseR * 0.2, baseR * 0.75);
      targetCtx.stroke();
      targetCtx.shadowBlur = 0;
    } else if (skinCoatingId === 'skin_ice') {
      targetCtx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      targetCtx.lineWidth = 1.8;
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3 + 0.2;
        targetCtx.beginPath();
        targetCtx.moveTo(Math.cos(a) * (-baseR * 0.65), Math.sin(a) * (-baseR * 0.65));
        targetCtx.lineTo(Math.cos(a) * (baseR * 0.65), Math.sin(a) * (baseR * 0.65));
        targetCtx.stroke();
      }
    } else if (skinCoatingId === 'skin_toxic') {
      for (let i = 0; i < 5; i++) {
        const by = ((time * 0.03 + i * 11) % (baseR * 1.5)) - baseR * 0.75;
        const bx = Math.sin(i * 2.1 + time * 0.004) * (baseR * 0.48);
        targetCtx.beginPath();
        targetCtx.arc(bx, -by, 2.5 + (i % 2), 0, Math.PI * 2);
        targetCtx.fillStyle = 'rgba(190, 242, 100, 0.8)';
        targetCtx.fill();
      }
    } else if (skinCoatingId === 'skin_8bit') {
      const step = Math.max(5, Math.round(baseR * 0.28));
      for (let x = -baseR; x < baseR; x += step) {
        for (let y = -baseR; y < baseR; y += step) {
          if ((Math.floor(x / step) + Math.floor(y / step)) % 2 === 0) {
            targetCtx.fillStyle = 'rgba(255, 255, 255, 0.16)';
            targetCtx.fillRect(x, y, step, step);
          }
        }
      }
    } else if (skinCoatingId === 'skin_camo') {
      const blobs = [
        { x: -0.35, y: -0.25, r: 0.34, c: '#365314' },
        { x: 0.32, y: 0.28, r: 0.36, c: '#1A2E05' },
        { x: -0.22, y: 0.42, r: 0.28, c: '#713F12' },
        { x: 0.28, y: -0.35, r: 0.26, c: '#365314' }
      ];
      for (const b of blobs) {
        targetCtx.beginPath();
        targetCtx.arc(b.x * baseR, b.y * baseR, b.r * baseR, 0, Math.PI * 2);
        targetCtx.fillStyle = b.c;
        targetCtx.fill();
      }
    } else if (skinCoatingId === 'skin_zombie') {
      targetCtx.strokeStyle = '#1E293B';
      targetCtx.lineWidth = 2;
      targetCtx.beginPath();
      targetCtx.moveTo(-baseR * 0.55, -baseR * 0.45);
      targetCtx.lineTo(baseR * 0.15, -baseR * 0.22);
      targetCtx.stroke();
      for (let s = -2; s <= 1; s++) {
        targetCtx.beginPath();
        targetCtx.moveTo(-baseR * 0.2 + s * 4, -baseR * 0.42);
        targetCtx.lineTo(-baseR * 0.24 + s * 4, -baseR * 0.26);
        targetCtx.stroke();
      }
    } else if (skinCoatingId === 'skin_gold_armor') {
      const sheenX = ((time * 0.08) % (baseR * 3)) - baseR * 1.5;
      targetCtx.fillStyle = 'rgba(255, 255, 255, 0.42)';
      targetCtx.beginPath();
      targetCtx.moveTo(sheenX - 6, -baseR);
      targetCtx.lineTo(sheenX + 6, -baseR);
      targetCtx.lineTo(sheenX - 14, baseR);
      targetCtx.lineTo(sheenX - 26, baseR);
      targetCtx.closePath();
      targetCtx.fill();
    }

    // 2) Alt Karın Neon Lazer Yansıması (Görseldeki gövdeyi saran turkuaz/pembe neon ışık yansıması)
    targetCtx.beginPath();
    targetCtx.arc(0, baseR * 0.14, baseR * 0.82, Math.PI * 0.14, Math.PI * 0.86);
    targetCtx.lineWidth = Math.max(2, baseR * 0.09);
    targetCtx.strokeStyle = 'rgba(255, 255, 255, 0.34)';
    targetCtx.shadowColor = '#00F5D4';
    targetCtx.shadowBlur = 8;
    targetCtx.lineCap = 'round';
    targetCtx.stroke();
    targetCtx.shadowBlur = 0;

    // 3) Kafa Üstü 3D Kostüm Işık Yansıması & Gölgesi
    targetCtx.save();
    if (skinId === 'angel') {
      targetCtx.rotate(-0.12);
      targetCtx.beginPath();
      targetCtx.ellipse(0, -baseR * 0.62, baseR * 0.44, baseR * 0.13, 0, 0, Math.PI * 2);
      targetCtx.strokeStyle = 'rgba(255, 230, 102, 0.75)';
      targetCtx.lineWidth = Math.max(2.2, baseR * 0.095);
      targetCtx.shadowColor = '#FFE066';
      targetCtx.shadowBlur = 10;
      targetCtx.stroke();
    } else if (skinId === 'crown' || skinId === 'hat_vip_crown') {
      targetCtx.beginPath();
      targetCtx.ellipse(0, -baseR * 0.68, baseR * 0.56, baseR * 0.16, 0, 0, Math.PI * 2);
      targetCtx.fillStyle = 'rgba(250, 204, 21, 0.34)';
      targetCtx.shadowColor = '#FACC15';
      targetCtx.shadowBlur = 10;
      targetCtx.fill();
    } else if (skinId === 'devil' || skinId === 'hat_devil_horns') {
      for (const s of [-1, 1]) {
        targetCtx.beginPath();
        targetCtx.ellipse(s * baseR * 0.46, -baseR * 0.64, baseR * 0.22, baseR * 0.11, s * 0.35, 0, Math.PI * 2);
        targetCtx.fillStyle = 'rgba(255, 42, 133, 0.45)';
        targetCtx.shadowColor = '#FF2A85';
        targetCtx.shadowBlur = 10;
        targetCtx.fill();
      }
    } else if (skinId === 'cyber' || skinId === 'headset' || skinId === 'hat_cyber_vr') {
      targetCtx.beginPath();
      targetCtx.ellipse(0, -baseR * 0.60, baseR * 0.48, baseR * 0.13, 0, 0, Math.PI * 2);
      targetCtx.strokeStyle = 'rgba(0, 245, 212, 0.58)';
      targetCtx.lineWidth = Math.max(2, baseR * 0.08);
      targetCtx.shadowColor = '#00F5D4';
      targetCtx.shadowBlur = 8;
      targetCtx.stroke();
    } else if (skinId === 'wizard' || skinId === 'hat_dark_wizard') {
      targetCtx.beginPath();
      targetCtx.ellipse(0, -baseR * 0.68, baseR * 0.66, baseR * 0.18, 0, 0, Math.PI * 2);
      targetCtx.fillStyle = 'rgba(168, 85, 247, 0.38)';
      targetCtx.shadowColor = '#C084FC';
      targetCtx.shadowBlur = 10;
      targetCtx.fill();
    } else {
      targetCtx.beginPath();
      targetCtx.ellipse(0, -baseR * 0.68, baseR * 0.58, baseR * 0.16, 0, 0, Math.PI * 2);
      targetCtx.fillStyle = 'rgba(8, 11, 18, 0.28)';
      targetCtx.fill();
    }
    targetCtx.restore();

    // 4) Sol-Üst 3D Cam / Jöle Parlama (Specular Highlight) + İkincil Su Damlası Parıltısı
    const specGrad = targetCtx.createLinearGradient(
      -baseR * 0.55,
      -baseR * 0.72,
      -baseR * 0.05,
      -baseR * 0.12
    );
    specGrad.addColorStop(0, 'rgba(255, 255, 255, 0.78)');
    specGrad.addColorStop(1, 'rgba(255, 255, 255, 0.08)');

    targetCtx.beginPath();
    targetCtx.ellipse(-baseR * 0.30, -baseR * 0.42, baseR * 0.30, baseR * 0.15, -0.52, 0, Math.PI * 2);
    targetCtx.fillStyle = specGrad;
    targetCtx.fill();

    targetCtx.beginPath();
    targetCtx.arc(-baseR * 0.52, -baseR * 0.16, Math.max(1.8, baseR * 0.065), 0, Math.PI * 2);
    targetCtx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    targetCtx.fill();

    targetCtx.restore(); // clip sonu

    // 5) Dış 3D Rim-Light Çerçevesi
    targetCtx.lineWidth = Math.max(1.8, baseR * 0.085);
    targetCtx.strokeStyle = shades.rimGlow;
    targetCtx.stroke();
    targetCtx.restore();
  }

  // --- 3D PIXAR / ARCADE TARZI İRİ PARLAK SEVİMLİ GÖZLER VE GÜLÜMSEME ---
  function draw3DCuteEyes(targetCtx, baseR, lookX, lookY, time, seedPhase = 0) {
    targetCtx.save();

    // Gözlerin hemen altında tatlı 3D yanak allığı ve hafif tebessüm çukuru
    for (const side of [-1, 1]) {
      targetCtx.beginPath();
      targetCtx.ellipse(
        side * baseR * 0.44 + lookX * 0.25,
        baseR * 0.16 + lookY * 0.25,
        baseR * 0.14,
        baseR * 0.075,
        0,
        0,
        Math.PI * 2
      );
      targetCtx.fillStyle = 'rgba(255, 112, 166, 0.34)';
      targetCtx.fill();
    }

    // Tatlı minik gülümseme kavisi
    targetCtx.beginPath();
    targetCtx.arc(lookX * 0.35, baseR * 0.13 + lookY * 0.35, baseR * 0.19, Math.PI * 0.18, Math.PI * 0.82);
    targetCtx.lineWidth = Math.max(1.6, baseR * 0.065);
    targetCtx.lineCap = 'round';
    targetCtx.strokeStyle = 'rgba(15, 23, 42, 0.42)';
    targetCtx.stroke();

    // Doğal göz kırpma animasyonu (her ~4.5 saniyede bir çok kısa sevimli göz kırpma)
    const blinkCycle = Math.sin(time * 0.0022 + seedPhase * 3.7);
    const isBlinking = blinkCycle > 0.985;

    const eyeRx = baseR * 0.235;
    const eyeRy = baseR * 0.285;

    for (const side of [-1, 1]) {
      const ex = side * baseR * 0.245 + lookX * 0.55;
      const ey = -baseR * 0.08 + lookY * 0.55;

      targetCtx.save();
      targetCtx.translate(ex, ey);
      targetCtx.rotate(side * -0.07);

      if (isBlinking) {
        // Mutlu kapalı göz kavisi
        targetCtx.beginPath();
        targetCtx.arc(0, 0, eyeRx, Math.PI * 1.12, Math.PI * 1.88);
        targetCtx.lineWidth = Math.max(2.2, baseR * 0.095);
        targetCtx.lineCap = 'round';
        targetCtx.strokeStyle = '#1E1B4B';
        targetCtx.stroke();
        targetCtx.restore();
        continue;
      }

      // 1) Göz Çukuru 3D Derinlik Gölgesi
      targetCtx.beginPath();
      targetCtx.ellipse(0, baseR * 0.03, eyeRx * 1.10, eyeRy * 1.08, 0, 0, Math.PI * 2);
      targetCtx.fillStyle = 'rgba(8, 11, 18, 0.38)';
      targetCtx.fill();

      // 2) 3D Gölgeli Göz Akı (Sclera)
      const scleraGrad = targetCtx.createRadialGradient(
        -eyeRx * 0.2,
        -eyeRy * 0.2,
        eyeRx * 0.1,
        0,
        0,
        eyeRy * 1.05
      );
      scleraGrad.addColorStop(0, '#FFFFFF');
      scleraGrad.addColorStop(0.75, '#F8FAFC');
      scleraGrad.addColorStop(1, '#CBD5E1');

      targetCtx.beginPath();
      targetCtx.ellipse(0, 0, eyeRx, eyeRy, 0, 0, Math.PI * 2);
      targetCtx.fillStyle = scleraGrad;
      targetCtx.fill();
      targetCtx.lineWidth = Math.max(1.1, baseR * 0.042);
      targetCtx.strokeStyle = 'rgba(15, 23, 42, 0.55)';
      targetCtx.stroke();

      // 3) 3D Parlak Kehribar / Ela-Kahve İris (Görseldeki sıcak parlak göz rengi)
      const irisOffX = lookX * 0.26;
      const irisOffY = lookY * 0.26;
      const irisRx = eyeRx * 0.66;
      const irisRy = eyeRy * 0.66;

      const irisGrad = targetCtx.createRadialGradient(
        irisOffX - irisRx * 0.2,
        irisOffY - irisRy * 0.25,
        irisRx * 0.1,
        irisOffX,
        irisOffY,
        irisRy
      );
      irisGrad.addColorStop(0, '#FBBF24');
      irisGrad.addColorStop(0.45, '#B45309');
      irisGrad.addColorStop(0.82, '#78350F');
      irisGrad.addColorStop(1, '#271206');

      targetCtx.beginPath();
      targetCtx.ellipse(irisOffX, irisOffY, irisRx, irisRy, 0, 0, Math.PI * 2);
      targetCtx.fillStyle = irisGrad;
      targetCtx.fill();

      // 4) Kadife Siyah Göz Bebeği (Pupil)
      targetCtx.beginPath();
      targetCtx.ellipse(irisOffX * 1.08, irisOffY * 1.08, irisRx * 0.54, irisRy * 0.54, 0, 0, Math.PI * 2);
      targetCtx.fillStyle = '#090D16';
      targetCtx.fill();

      // 5) Çift Katmanlı Canlı Işık Yansıması (Catchlights — Sevimliliğin anahtarı!)
      targetCtx.beginPath();
      targetCtx.arc(
        irisOffX - irisRx * 0.34,
        irisOffY - irisRy * 0.36,
        Math.max(1.7, baseR * 0.082),
        0,
        Math.PI * 2
      );
      targetCtx.fillStyle = '#FFFFFF';
      targetCtx.fill();

      targetCtx.beginPath();
      targetCtx.arc(
        irisOffX + irisRx * 0.32,
        irisOffY + irisRy * 0.34,
        Math.max(0.95, baseR * 0.042),
        0,
        Math.PI * 2
      );
      targetCtx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      targetCtx.fill();

      targetCtx.restore();
    }

    targetCtx.restore();
  }

  // --- BASIC 10 KOSTÜM ÇİZİM FONKSİYONU (TAM 3D HACİMLİ, NEON & MÜCEVHER DETAYLI) ---
  function drawSkinAccessory(targetCtx, skinId, baseR, time) {
    targetCtx.save();
    switch (skinId) {
      case 'crown': {
        // 👑 TAM 3D KRAL TACI: Kavisli 3D altın taban halkası, 5 boyutlu taç tepesi, inciler ve 3D yakut/safir/zümrüt taşlar
        const yBase = -baseR + 3;
        // 1) Alt 3D gölge halkası
        targetCtx.beginPath();
        targetCtx.ellipse(0, yBase + 1.5, 15.5, 4.2, 0, 0, Math.PI * 2);
        targetCtx.fillStyle = 'rgba(8, 11, 18, 0.45)';
        targetCtx.fill();

        // 2) Tacın arka iç altın haznesi (3D derinlik)
        targetCtx.beginPath();
        targetCtx.ellipse(0, yBase - 4, 14.5, 5, 0, Math.PI, Math.PI * 2);
        targetCtx.fillStyle = '#92400E';
        targetCtx.fill();

        // 3) Tacın iç kadife kırmızı kubbesi
        const velvetGrad = targetCtx.createRadialGradient(-3, yBase - 10, 2, 0, yBase - 6, 14);
        velvetGrad.addColorStop(0, '#FF2A85');
        velvetGrad.addColorStop(0.6, '#DC2626');
        velvetGrad.addColorStop(1, '#7F1D1D');
        targetCtx.beginPath();
        targetCtx.arc(0, yBase - 2, 12.5, Math.PI, 0);
        targetCtx.fillStyle = velvetGrad;
        targetCtx.fill();

        // 4) 3D Metalik Altın Gövde ve Sivri Uçlar
        const crownGrad = targetCtx.createLinearGradient(-16, yBase - 18, 16, yBase + 2);
        crownGrad.addColorStop(0, '#FEF9C3');
        crownGrad.addColorStop(0.28, '#FDE047');
        crownGrad.addColorStop(0.55, '#FACC15');
        crownGrad.addColorStop(0.82, '#CA8A04');
        crownGrad.addColorStop(1, '#854D0E');

        targetCtx.fillStyle = crownGrad;
        targetCtx.strokeStyle = '#FEF08A';
        targetCtx.shadowColor = '#FACC15';
        targetCtx.shadowBlur = 14;
        targetCtx.lineWidth = 1.6;

        targetCtx.beginPath();
        targetCtx.moveTo(-14.5, yBase);
        targetCtx.lineTo(-17, yBase - 13);
        targetCtx.lineTo(-9, yBase - 5.5);
        targetCtx.lineTo(-5.5, yBase - 16);
        targetCtx.lineTo(0, yBase - 6.5);
        targetCtx.lineTo(0, yBase - 19);
        targetCtx.lineTo(0, yBase - 6.5);
        targetCtx.lineTo(5.5, yBase - 16);
        targetCtx.lineTo(9, yBase - 5.5);
        targetCtx.lineTo(17, yBase - 13);
        targetCtx.lineTo(14.5, yBase);
        targetCtx.quadraticCurveTo(0, yBase + 5, -14.5, yBase);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.stroke();

        // Orta ana tepe üçgeni
        targetCtx.beginPath();
        targetCtx.moveTo(-5, yBase - 5);
        targetCtx.lineTo(0, yBase - 19.5);
        targetCtx.lineTo(5, yBase - 5);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.stroke();
        targetCtx.shadowBlur = 0;

        // 5) Alt 3D Altın Şerit ve Mücevherler (Yakut, Safir, Zümrüt)
        targetCtx.beginPath();
        targetCtx.ellipse(0, yBase - 0.5, 14.5, 3.4, 0, 0, Math.PI);
        targetCtx.strokeStyle = '#FEF9C3';
        targetCtx.lineWidth = 2;
        targetCtx.stroke();

        const tips = [
          { x: -17, y: yBase - 13.5, r: 2.1 },
          { x: -5.5, y: yBase - 16.5, r: 2.2 },
          { x: 0, y: yBase - 20, r: 2.7 },
          { x: 5.5, y: yBase - 16.5, r: 2.2 },
          { x: 17, y: yBase - 13.5, r: 2.1 }
        ];
        for (const pt of tips) {
          targetCtx.beginPath();
          targetCtx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
          targetCtx.fillStyle = '#FFFBEB';
          targetCtx.shadowColor = '#FFE066';
          targetCtx.shadowBlur = 8;
          targetCtx.fill();
        }
        targetCtx.shadowBlur = 0;

        // Mücevherler
        const gems = [
          { x: -8.5, y: yBase - 2.2, c: '#00BBF9', r: 2.1 },
          { x: 0, y: yBase - 2.5, c: '#FF2A85', r: 3.0 },
          { x: 8.5, y: yBase - 2.2, c: '#00F59B', r: 2.1 }
        ];
        for (const gm of gems) {
          targetCtx.beginPath();
          targetCtx.arc(gm.x, gm.y, gm.r, 0, Math.PI * 2);
          targetCtx.fillStyle = gm.c;
          targetCtx.shadowColor = gm.c;
          targetCtx.shadowBlur = 6;
          targetCtx.fill();
          targetCtx.shadowBlur = 0;
          targetCtx.beginPath();
          targetCtx.arc(gm.x - gm.r * 0.3, gm.y - gm.r * 0.3, gm.r * 0.35, 0, Math.PI * 2);
          targetCtx.fillStyle = '#FFFFFF';
          targetCtx.fill();
        }
        break;
      }
      case 'ninja': {
        // 🥷 TAM 3D GÖLGE NİNJA: Kavisli 3D İpek Kuşak, Parlak Çelik Alın Plakası, Perçinler ve Dalgalanan Çift Kuşak
        const bandY = -baseR * 0.56;
        const w = baseR * 0.96;

        // 1) Rüzgarda dalgalanan 3D çift katmanlı ipek düğüm uçları (Sol arkada)
        const wave1 = Math.sin(time * 0.012) * 4.5;
        const wave2 = Math.cos(time * 0.010) * 4.5;

        targetCtx.save();
        targetCtx.fillStyle = '#991B1B';
        targetCtx.beginPath();
        targetCtx.moveTo(-w + 2, bandY + 2);
        targetCtx.quadraticCurveTo(-w - 9, bandY - 8 + wave2, -w - 18, bandY - 3 + wave2);
        targetCtx.lineTo(-w - 15, bandY + 4 + wave2);
        targetCtx.quadraticCurveTo(-w - 7, bandY + 1, -w + 2, bandY + 6);
        targetCtx.closePath();
        targetCtx.fill();

        const ribbonGrad = targetCtx.createLinearGradient(-w, bandY, -w - 18, bandY - 12);
        ribbonGrad.addColorStop(0, '#EF4444');
        ribbonGrad.addColorStop(1, '#F87171');
        targetCtx.fillStyle = ribbonGrad;
        targetCtx.shadowColor = '#EF4444';
        targetCtx.shadowBlur = 8;
        targetCtx.beginPath();
        targetCtx.moveTo(-w + 2, bandY);
        targetCtx.quadraticCurveTo(-w - 10, bandY - 14 + wave1, -w - 20, bandY - 10 + wave1);
        targetCtx.lineTo(-w - 17, bandY - 3 + wave1);
        targetCtx.quadraticCurveTo(-w - 8, bandY - 6 + wave1, -w + 2, bandY + 4);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.restore();

        // 2) Kafa etrafını 3D saran kavisli kırmızı kumaş bant
        const clothGrad = targetCtx.createLinearGradient(-w, bandY, w, bandY);
        clothGrad.addColorStop(0, '#991B1B');
        clothGrad.addColorStop(0.25, '#EF4444');
        clothGrad.addColorStop(0.5, '#F87171');
        clothGrad.addColorStop(0.75, '#DC2626');
        clothGrad.addColorStop(1, '#7F1D1D');

        targetCtx.fillStyle = clothGrad;
        targetCtx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        targetCtx.shadowBlur = 5;
        targetCtx.beginPath();
        targetCtx.moveTo(-w, bandY);
        targetCtx.quadraticCurveTo(0, bandY - 5.5, w, bandY);
        targetCtx.lineTo(w, bandY + 8.5);
        targetCtx.quadraticCurveTo(0, bandY + 3.5, -w, bandY + 8.5);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.shadowBlur = 0;

        // 3) 3D Fırçalanmış Çelik Shinobi Alın Plakası + Neon Sembol
        const plateGrad = targetCtx.createLinearGradient(-10, bandY - 3, 10, bandY + 7);
        plateGrad.addColorStop(0, '#F8FAFC');
        plateGrad.addColorStop(0.45, '#CBD5E1');
        plateGrad.addColorStop(0.55, '#64748B');
        plateGrad.addColorStop(1, '#E2E8F0');

        targetCtx.fillStyle = plateGrad;
        targetCtx.strokeStyle = '#1E293B';
        targetCtx.lineWidth = 1.3;
        targetCtx.beginPath();
        targetCtx.roundRect(-10.5, bandY - 1.5, 21, 7.2, 2.5);
        targetCtx.fill();
        targetCtx.stroke();

        // Plaka üstü neon turkuaz shuriken/spiral sembolü ve 2 yan perçin
        targetCtx.fillStyle = '#00F5D4';
        targetCtx.shadowColor = '#00F5D4';
        targetCtx.shadowBlur = 6;
        targetCtx.beginPath();
        targetCtx.arc(0, bandY + 2.1, 1.9, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.shadowBlur = 0;

        targetCtx.fillStyle = '#334155';
        targetCtx.beginPath();
        targetCtx.arc(-7.5, bandY + 2.1, 1.1, 0, Math.PI * 2);
        targetCtx.arc(7.5, bandY + 2.1, 1.1, 0, Math.PI * 2);
        targetCtx.fill();
        break;
      }
      case 'cyber': {
        // 🕶️ TAM 3D SİBER VİZÖR: Kavisli Holografik Lazer Gözlük, Hareketli Tarayıcı Işık ve Yan Siber Kulak Modülleri
        const vy = -5.5;
        // 1) Yan Siber Kulak Modülleri (3D kapsüller)
        targetCtx.fillStyle = '#1E293B';
        targetCtx.strokeStyle = '#00F5D4';
        targetCtx.lineWidth = 1.5;
        for (const s of [-1, 1]) {
          targetCtx.beginPath();
          targetCtx.roundRect(s * 17 - 2.5, vy - 2, 5, 9, 2);
          targetCtx.fill();
          targetCtx.stroke();
        }

        // 2) Kavisli 3D Holografik Cam Gövdesi
        const visorGrad = targetCtx.createLinearGradient(-18, vy - 5, 18, vy + 8);
        visorGrad.addColorStop(0, '#00F5D4');
        visorGrad.addColorStop(0.35, '#00BBF9');
        visorGrad.addColorStop(0.7, '#3B82F6');
        visorGrad.addColorStop(1, '#FF2A85');

        targetCtx.save();
        targetCtx.fillStyle = visorGrad;
        targetCtx.shadowColor = '#00F5D4';
        targetCtx.shadowBlur = 16;

        targetCtx.beginPath();
        targetCtx.moveTo(-18, vy - 2);
        targetCtx.quadraticCurveTo(0, vy - 6.5, 18, vy - 2);
        targetCtx.lineTo(16.5, vy + 6.5);
        targetCtx.quadraticCurveTo(0, vy + 3, -16.5, vy + 6.5);
        targetCtx.closePath();
        targetCtx.fill();

        // Cam içi animasyonlu lazer tarayıcı çizgi (Knight Rider / Cyberpunk tarayıcı)
        targetCtx.clip();
        const scanX = Math.sin(time * 0.005) * 12;
        const scanGrad = targetCtx.createLinearGradient(scanX - 5, vy, scanX + 5, vy);
        scanGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        scanGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)');
        scanGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        targetCtx.fillStyle = scanGrad;
        targetCtx.fillRect(scanX - 6, vy - 8, 12, 18);

        // Sol üst diyagonal parlak cam yansıması
        targetCtx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        targetCtx.beginPath();
        targetCtx.moveTo(-14, vy - 4);
        targetCtx.lineTo(-6, vy - 4);
        targetCtx.lineTo(-10, vy + 6);
        targetCtx.lineTo(-16, vy + 6);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.restore();

        // 3) Üst 3D Metalik Çerçeve Barı
        targetCtx.strokeStyle = '#FFFFFF';
        targetCtx.shadowColor = '#00F5D4';
        targetCtx.shadowBlur = 8;
        targetCtx.lineWidth = 2;
        targetCtx.beginPath();
        targetCtx.moveTo(-18.5, vy - 2);
        targetCtx.quadraticCurveTo(0, vy - 6.8, 18.5, vy - 2);
        targetCtx.stroke();
        break;
      }
      case 'pirate': {
        // 🏴‍☠️ TAM 3D KORSAN KAPTAN: Kırmızı Bandana, 3D Kıvrımlı Altın İşlemeli Kaptan Şapkası, Kuru Kafa ve Dalgalanan Tüy
        const yB = -baseR + 4;

        // 1) Şapka altı kırmızı korsan bandanası
        targetCtx.beginPath();
        targetCtx.ellipse(0, yB + 1, 16, 4.2, 0, 0, Math.PI);
        targetCtx.fillStyle = '#DC2626';
        targetCtx.fill();

        // 2) Sağ tarafta sallanan 3D Kırmızı Kaptan Tüyü
        const plumeWave = Math.sin(time * 0.008) * 2.5;
        const plumeGrad = targetCtx.createLinearGradient(10, yB - 6, 24, yB - 24);
        plumeGrad.addColorStop(0, '#991B1B');
        plumeGrad.addColorStop(0.5, '#FF2A85');
        plumeGrad.addColorStop(1, '#FDE047');
        targetCtx.fillStyle = plumeGrad;
        targetCtx.shadowColor = '#FF2A85';
        targetCtx.shadowBlur = 8;
        targetCtx.beginPath();
        targetCtx.moveTo(11, yB - 5);
        targetCtx.quadraticCurveTo(22 + plumeWave, yB - 24, 15 + plumeWave, yB - 25);
        targetCtx.quadraticCurveTo(8, yB - 16, 11, yB - 5);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.shadowBlur = 0;

        // 3) 3D Tricorn Kaptan Şapkası Gövdesi ve Altın Kenar Şeridi
        const hatGrad = targetCtx.createRadialGradient(0, yB - 14, 3, 0, yB - 6, 24);
        hatGrad.addColorStop(0, '#334155');
        hatGrad.addColorStop(0.55, '#0F172A');
        hatGrad.addColorStop(1, '#020617');

        targetCtx.fillStyle = hatGrad;
        targetCtx.strokeStyle = '#FACC15';
        targetCtx.shadowColor = '#F59E0B';
        targetCtx.shadowBlur = 10;
        targetCtx.lineWidth = 2.2;

        targetCtx.beginPath();
        targetCtx.moveTo(-23, yB + 1);
        targetCtx.bezierCurveTo(-18, yB - 18, -7, yB - 22, 0, yB - 22);
        targetCtx.bezierCurveTo(7, yB - 22, 18, yB - 18, 23, yB + 1);
        targetCtx.quadraticCurveTo(0, yB - 4, -23, yB + 1);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.stroke();
        targetCtx.shadowBlur = 0;

        // 4) Şapka ortasında 3D Sevimli Korsan Kuru Kafası ve Çapraz Kemikler
        targetCtx.strokeStyle = '#E2E8F0';
        targetCtx.lineWidth = 1.8;
        targetCtx.beginPath();
        targetCtx.moveTo(-5.5, yB - 6);
        targetCtx.lineTo(5.5, yB - 13);
        targetCtx.moveTo(-5.5, yB - 13);
        targetCtx.lineTo(5.5, yB - 6);
        targetCtx.stroke();

        targetCtx.fillStyle = '#FFFFFF';
        targetCtx.beginPath();
        targetCtx.arc(0, yB - 10, 4.2, 0, Math.PI * 2);
        targetCtx.fill();

        targetCtx.fillStyle = '#FF2A85';
        targetCtx.beginPath();
        targetCtx.arc(-1.5, yB - 10, 1.1, 0, Math.PI * 2);
        targetCtx.arc(1.5, yB - 10, 1.1, 0, Math.PI * 2);
        targetCtx.fill();
        break;
      }
      case 'devil': {
        // 😈 TAM 3D ATEŞ BOYNUZU: Lav Soketleri, Kıvrımlı 3D Magma Boynuzlar, Parlak Sırt Yansıması ve Uçuşan Kıvılcımlar
        for (const s of [-1, 1]) {
          targetCtx.save();
          // 1) Kafa üstü kızgın lav soketi halkası
          targetCtx.beginPath();
          targetCtx.ellipse(s * 12, -baseR + 3.5, 4.8, 2.2, s * 0.35, 0, Math.PI * 2);
          targetCtx.fillStyle = '#FEF08A';
          targetCtx.shadowColor = '#FF2A85';
          targetCtx.shadowBlur = 10;
          targetCtx.fill();

          // 2) 3D Kıvrımlı Magma Boynuz Gradyanı
          const hornGrad = targetCtx.createLinearGradient(s * 10, -baseR + 4, s * 22, -baseR - 20);
          hornGrad.addColorStop(0, '#7F1D1D');
          hornGrad.addColorStop(0.35, '#EF4444');
          hornGrad.addColorStop(0.7, '#FF2A85');
          hornGrad.addColorStop(1, '#FEF08A');

          targetCtx.fillStyle = hornGrad;
          targetCtx.shadowColor = '#FF2A85';
          targetCtx.shadowBlur = 14;

          targetCtx.beginPath();
          targetCtx.moveTo(s * 8.5, -baseR + 3);
          targetCtx.bezierCurveTo(
            s * 14,
            -baseR - 10,
            s * 25,
            -baseR - 12,
            s * 19,
            -baseR - 21
          );
          targetCtx.bezierCurveTo(
            s * 22,
            -baseR - 9,
            s * 18,
            -baseR - 2,
            s * 15,
            -baseR + 5
          );
          targetCtx.closePath();
          targetCtx.fill();

          // 3) Boynuz üstü 3D parlak sırt çizgisi (Specular ridge)
          targetCtx.shadowBlur = 0;
          targetCtx.strokeStyle = 'rgba(254, 249, 195, 0.78)';
          targetCtx.lineWidth = 1.4;
          targetCtx.beginPath();
          targetCtx.moveTo(s * 10.5, -baseR + 2);
          targetCtx.quadraticCurveTo(s * 18, -baseR - 9, s * 18.5, -baseR - 19);
          targetCtx.stroke();

          // 4) Boynuz ucunda canlı ateş kıvılcımı
          const sparkY = -baseR - 22 + Math.sin(time * 0.014 + s) * 2.5;
          targetCtx.beginPath();
          targetCtx.arc(s * 19.5, sparkY, 2.0, 0, Math.PI * 2);
          targetCtx.fillStyle = '#FEF08A';
          targetCtx.shadowColor = '#FFE066';
          targetCtx.shadowBlur = 8;
          targetCtx.fill();
          targetCtx.restore();
        }
        break;
      }
      case 'angel': {
        // 😇 TAM 3D KUTSAL HALE: Eğimli 3D Altın Neon Torus Halkası, Sıcak Beyaz Çekirdek ve Dönen Yıldız Parıltıları
        const floatY = -baseR - 11.5 + Math.sin(time * 0.006) * 2.2;
        targetCtx.save();
        targetCtx.translate(0, floatY);
        targetCtx.rotate(-0.12);

        // 1) Dış altın neon halesi
        targetCtx.strokeStyle = '#F59E0B';
        targetCtx.shadowColor = '#FFE066';
        targetCtx.shadowBlur = 18;
        targetCtx.lineWidth = 5.6;
        targetCtx.beginPath();
        targetCtx.ellipse(0, 0, baseR * 0.70, baseR * 0.22, 0, 0, Math.PI * 2);
        targetCtx.stroke();

        // 2) Orta parlak altın katman
        targetCtx.strokeStyle = '#FDE047';
        targetCtx.lineWidth = 3.4;
        targetCtx.beginPath();
        targetCtx.ellipse(0, 0, baseR * 0.70, baseR * 0.22, 0, 0, Math.PI * 2);
        targetCtx.stroke();

        // 3) İç sıcak beyaz-altın çekirdek halkası
        targetCtx.strokeStyle = '#FFFFFF';
        targetCtx.shadowColor = '#FFFFFF';
        targetCtx.shadowBlur = 6;
        targetCtx.lineWidth = 1.6;
        targetCtx.beginPath();
        targetCtx.ellipse(0, 0, baseR * 0.70, baseR * 0.22, 0, 0, Math.PI * 2);
        targetCtx.stroke();

        // 4) Halenin etrafında dönen minik ışık yıldızcıkları
        const starAngle = time * 0.003;
        for (const offset of [0, Math.PI]) {
          const sx = Math.cos(starAngle + offset) * (baseR * 0.74);
          const sy = Math.sin(starAngle + offset) * (baseR * 0.24);
          targetCtx.beginPath();
          targetCtx.arc(sx, sy, 1.8, 0, Math.PI * 2);
          targetCtx.fillStyle = '#FFFFFF';
          targetCtx.fill();
        }
        targetCtx.restore();
        break;
      }
      case 'viking': {
        // ⚔️ TAM 3D VİKİNG MİĞFERİ: 3D Kıvrımlı Fildişi Boynuzlar, Küresel Çelik Kubbe, Bronz Kemer ve Perçinler
        const yV = -baseR + 5;

        // 1) Sağ ve Sol 3D Kıvrımlı Fildişi Viking Boynuzları
        for (const s of [-1, 1]) {
          const hornGrad = targetCtx.createLinearGradient(s * 13, yV, s * 26, yV - 18);
          hornGrad.addColorStop(0, '#A8A29E');
          hornGrad.addColorStop(0.45, '#F5F5F4');
          hornGrad.addColorStop(1, '#FEF3C7');

          targetCtx.fillStyle = hornGrad;
          targetCtx.strokeStyle = '#57534E';
          targetCtx.lineWidth = 1.2;
          targetCtx.beginPath();
          targetCtx.moveTo(s * 13, yV - 5);
          targetCtx.quadraticCurveTo(s * 25, yV - 6, s * 25, yV - 18);
          targetCtx.quadraticCurveTo(s * 21, yV - 8, s * 13, yV + 1);
          targetCtx.closePath();
          targetCtx.fill();
          targetCtx.stroke();

          // Boynuz dibi bronz bilezik
          targetCtx.fillStyle = '#D97706';
          targetCtx.beginPath();
          targetCtx.ellipse(s * 14, yV - 2, 2.2, 3.8, s * 0.2, 0, Math.PI * 2);
          targetCtx.fill();
        }

        // 2) 3D Küresel Çelik Miğfer Kubbesi
        const domeGrad = targetCtx.createRadialGradient(-5, yV - 12, 2, 0, yV - 5, 18);
        domeGrad.addColorStop(0, '#F8FAFC');
        domeGrad.addColorStop(0.45, '#94A3B8');
        domeGrad.addColorStop(0.85, '#475569');
        domeGrad.addColorStop(1, '#1E293B');

        targetCtx.fillStyle = domeGrad;
        targetCtx.strokeStyle = '#CBD5E1';
        targetCtx.lineWidth = 1.5;
        targetCtx.beginPath();
        targetCtx.arc(0, yV, 15.5, Math.PI, 0);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.stroke();

        // 3) Altın/Bronz Alın Şeridi, Orta Sırt ve Perçinler
        const bronzeGrad = targetCtx.createLinearGradient(-16, yV - 3, 16, yV + 2);
        bronzeGrad.addColorStop(0, '#92400E');
        bronzeGrad.addColorStop(0.5, '#FBBF24');
        bronzeGrad.addColorStop(1, '#92400E');

        targetCtx.fillStyle = bronzeGrad;
        targetCtx.beginPath();
        targetCtx.roundRect(-16, yV - 2.5, 32, 4.5, 2);
        targetCtx.fill();

        // Burun koruyucu çıkıntısı
        targetCtx.beginPath();
        targetCtx.roundRect(-2.2, yV - 3, 4.4, 7.5, 1.5);
        targetCtx.fill();

        // Parlak perçin noktaları
        targetCtx.fillStyle = '#FEF9C3';
        for (const rx of [-11, -6, 6, 11]) {
          targetCtx.beginPath();
          targetCtx.arc(rx, yV - 0.3, 1.1, 0, Math.PI * 2);
          targetCtx.fill();
        }
        break;
      }
      case 'wizard': {
        // 🧙 TAM 3D MİSTİK BÜYÜCÜ ŞAPKASI: Geniş 3D Elips Siperlik, Kıvrık Koni Tepe, Altın Tokalı Kuşak ve Parlayan Yıldız/Hilal
        const yW = -baseR + 4;

        // 1) Şapka siperliği alt gölgesi
        targetCtx.beginPath();
        targetCtx.ellipse(0, yW + 1.5, 21.5, 5.2, 0, 0, Math.PI * 2);
        targetCtx.fillStyle = 'rgba(8, 11, 18, 0.45)';
        targetCtx.fill();

        // 2) 3D Kıvrımlı Büyücü Koni Gövdesi
        const wizGrad = targetCtx.createLinearGradient(-12, yW - 24, 14, yW);
        wizGrad.addColorStop(0, '#E879F9');
        wizGrad.addColorStop(0.35, '#9333EA');
        wizGrad.addColorStop(0.75, '#581C87');
        wizGrad.addColorStop(1, '#3B0764');

        targetCtx.fillStyle = wizGrad;
        targetCtx.strokeStyle = '#FDE047';
        targetCtx.shadowColor = '#A855F7';
        targetCtx.shadowBlur = 14;
        targetCtx.lineWidth = 1.6;

        targetCtx.beginPath();
        targetCtx.moveTo(-14.5, yW);
        targetCtx.quadraticCurveTo(-8, yW - 18, 6, yW - 25);
        targetCtx.quadraticCurveTo(13, yW - 26, 15, yW - 21);
        targetCtx.quadraticCurveTo(9, yW - 14, 14.5, yW);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.stroke();

        // 3) Altın Tokalı Şapka Kuşağı
        targetCtx.shadowBlur = 0;
        targetCtx.fillStyle = '#FACC15';
        targetCtx.beginPath();
        targetCtx.ellipse(0, yW - 1, 14.2, 3.2, 0, Math.PI, Math.PI * 2);
        targetCtx.fill();

        // 4) Ön 3D Elips Siperlik (Brim)
        const brimGrad = targetCtx.createLinearGradient(-21, yW - 2, 21, yW + 4);
        brimGrad.addColorStop(0, '#581C87');
        brimGrad.addColorStop(0.5, '#A855F7');
        brimGrad.addColorStop(1, '#3B0764');
        targetCtx.fillStyle = brimGrad;
        targetCtx.strokeStyle = '#FDE047';
        targetCtx.lineWidth = 1.6;
        targetCtx.beginPath();
        targetCtx.ellipse(0, yW + 0.5, 21, 4.6, 0, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.stroke();

        // Ön altın kemer tokası
        targetCtx.strokeStyle = '#FEF08A';
        targetCtx.lineWidth = 1.8;
        targetCtx.strokeRect(-3.5, yW - 4.5, 7, 4.5);

        // 5) Şapka ucunda süzülen büyü küresi ve gövdede altın yıldız
        const orbPulse = 2.2 + Math.sin(time * 0.01) * 0.6;
        targetCtx.beginPath();
        targetCtx.arc(15.5, yW - 21, orbPulse, 0, Math.PI * 2);
        targetCtx.fillStyle = '#FEF08A';
        targetCtx.shadowColor = '#FFE066';
        targetCtx.shadowBlur = 10;
        targetCtx.fill();

        targetCtx.beginPath();
        targetCtx.arc(-2, yW - 11, 2.0, 0, Math.PI * 2);
        targetCtx.fillStyle = '#FDE047';
        targetCtx.fill();
        break;
      }
      case 'headset': {
        // 🎧 TAM 3D PRO OYUNCU KULAKLIĞI: Çift Katmanlı 3D Kafa Bandı, Dolgun RGB Neon Kulaklık Kupaları ve Işıklı Mikrofon
        // 1) Üst 3D Destekli Kafa Bandı
        targetCtx.strokeStyle = '#1E293B';
        targetCtx.lineWidth = 6.5;
        targetCtx.lineCap = 'round';
        targetCtx.beginPath();
        targetCtx.arc(0, 0, baseR + 3.5, Math.PI * 1.12, Math.PI * 1.88);
        targetCtx.stroke();

        const bandNeonGrad = targetCtx.createLinearGradient(-baseR, -baseR, baseR, -baseR);
        bandNeonGrad.addColorStop(0, '#FF2A85');
        bandNeonGrad.addColorStop(0.5, '#00F5D4');
        bandNeonGrad.addColorStop(1, '#FF2A85');

        targetCtx.strokeStyle = bandNeonGrad;
        targetCtx.shadowColor = '#00F5D4';
        targetCtx.shadowBlur = 12;
        targetCtx.lineWidth = 2.8;
        targetCtx.beginPath();
        targetCtx.arc(0, 0, baseR + 4.2, Math.PI * 1.14, Math.PI * 1.86);
        targetCtx.stroke();

        // 2) Sağ ve Sol 3D Dolgun RGB Kulaklık Kupaları (Earcups)
        for (const s of [-1, 1]) {
          targetCtx.save();
          targetCtx.translate(s * (baseR + 2.5), 1);

          // İç siyah yastık (cushion)
          targetCtx.fillStyle = '#0F172A';
          targetCtx.shadowBlur = 0;
          targetCtx.beginPath();
          targetCtx.ellipse(-s * 1.5, 0, 3.8, 9.2, 0, 0, Math.PI * 2);
          targetCtx.fill();

          // Dış 3D RGB Kupa Gövdesi
          const cupGrad = targetCtx.createLinearGradient(-4, -9, 4, 9);
          cupGrad.addColorStop(0, '#FF2A85');
          cupGrad.addColorStop(0.5, '#9B5DE5');
          cupGrad.addColorStop(1, '#00BBF9');

          targetCtx.fillStyle = cupGrad;
          targetCtx.strokeStyle = '#00F5D4';
          targetCtx.shadowColor = '#FF2A85';
          targetCtx.shadowBlur = 10;
          targetCtx.lineWidth = 1.5;
          targetCtx.beginPath();
          targetCtx.ellipse(s * 1.2, 0, 4.2, 8.5, 0, 0, Math.PI * 2);
          targetCtx.fill();
          targetCtx.stroke();

          // Kupa üstü parlak beyaz ışık çizgisi
          targetCtx.shadowBlur = 0;
          targetCtx.fillStyle = 'rgba(255, 255, 255, 0.7)';
          targetCtx.beginPath();
          targetCtx.ellipse(s * 1.6, -3, 1.2, 3.2, 0, 0, Math.PI * 2);
          targetCtx.fill();
          targetCtx.restore();
        }

        // 3) Sol kulaklıktan uzanan 3D Esnek Oyuncu Mikrofonu + Parlayan LED Uç
        targetCtx.shadowBlur = 0;
        targetCtx.strokeStyle = '#CBD5E1';
        targetCtx.lineWidth = 2.2;
        targetCtx.beginPath();
        targetCtx.moveTo(-baseR - 2, 6);
        targetCtx.quadraticCurveTo(-baseR + 4, 15, -7, 11);
        targetCtx.stroke();

        targetCtx.beginPath();
        targetCtx.arc(-6.5, 11, 2.6, 0, Math.PI * 2);
        targetCtx.fillStyle = '#00F5D4';
        targetCtx.shadowColor = '#00F5D4';
        targetCtx.shadowBlur = 10;
        targetCtx.fill();
        break;
      }
      case 'fez': {
        // 🎩 TAM 3D TOSUN PAŞA FESİ: Gerçek 3D Silindirik Kadife Gövde, Üst Elips Perspektifi ve Sallanan İpek Püskül
        const yF = -baseR + 4;
        const topY = yF - 15;

        // 1) Alt oturma gölgesi
        targetCtx.beginPath();
        targetCtx.ellipse(0, yF + 1, 13.5, 3.5, 0, 0, Math.PI * 2);
        targetCtx.fillStyle = 'rgba(8, 11, 18, 0.42)';
        targetCtx.fill();

        // 2) 3D Silindirik Kadife Bordo Gövde Gradyanı
        const fezGrad = targetCtx.createLinearGradient(-13, topY, 13, yF);
        fezGrad.addColorStop(0, '#7F1D1D');
        fezGrad.addColorStop(0.28, '#EF4444');
        fezGrad.addColorStop(0.55, '#DC2626');
        fezGrad.addColorStop(0.85, '#991B1B');
        fezGrad.addColorStop(1, '#450A0A');

        targetCtx.fillStyle = fezGrad;
        targetCtx.shadowColor = '#DC2626';
        targetCtx.shadowBlur = 10;
        targetCtx.beginPath();
        targetCtx.moveTo(-12.5, yF);
        targetCtx.lineTo(-10, topY);
        targetCtx.quadraticCurveTo(0, topY - 2.5, 10, topY);
        targetCtx.lineTo(12.5, yF);
        targetCtx.quadraticCurveTo(0, yF + 3.8, -12.5, yF);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.shadowBlur = 0;

        // 3) Fesin 3D Üst Dairesel Yüzeyi (Üst kapak perspektifi)
        const topGrad = targetCtx.createRadialGradient(-3, topY, 1, 0, topY, 10);
        topGrad.addColorStop(0, '#F87171');
        topGrad.addColorStop(1, '#991B1B');
        targetCtx.fillStyle = topGrad;
        targetCtx.strokeStyle = 'rgba(254, 202, 202, 0.45)';
        targetCtx.lineWidth = 1;
        targetCtx.beginPath();
        targetCtx.ellipse(0, topY, 10, 2.6, 0, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.stroke();

        // Sol kenar 3D kadife parlama çizgisi
        targetCtx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        targetCtx.lineWidth = 2;
        targetCtx.beginPath();
        targetCtx.moveTo(-8, topY + 2);
        targetCtx.lineTo(-9.8, yF - 1);
        targetCtx.stroke();

        // 4) Fes tepesi altın düğme ve sağdan sallanan 3D Siyah/Altın İpek Püskül
        targetCtx.fillStyle = '#FACC15';
        targetCtx.beginPath();
        targetCtx.arc(0, topY, 2.2, 0, Math.PI * 2);
        targetCtx.fill();

        const tasselSwing = Math.sin(time * 0.009) * 2.2;
        targetCtx.strokeStyle = '#FACC15';
        targetCtx.lineWidth = 1.8;
        targetCtx.beginPath();
        targetCtx.moveTo(0, topY);
        targetCtx.quadraticCurveTo(10, topY + 1, 13.5 + tasselSwing * 0.5, topY + 7);
        targetCtx.stroke();

        // Püskül saçağı
        targetCtx.fillStyle = '#111827';
        targetCtx.strokeStyle = '#FACC15';
        targetCtx.lineWidth = 1;
        targetCtx.beginPath();
        targetCtx.moveTo(13.5 + tasselSwing * 0.5, topY + 6.5);
        targetCtx.lineTo(11.5 + tasselSwing, topY + 15);
        targetCtx.lineTo(16.5 + tasselSwing, topY + 14.5);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.stroke();
        break;
      }
      case 'hat_cat_ears': {
        // 🐱 NEON KEDİ KULAKLARI: Sevimli 3D üçgen kulaklar ve pembe neon iç üçgenler
        for (const s of [-1, 1]) {
          targetCtx.save();
          targetCtx.fillStyle = '#1E1B4B';
          targetCtx.strokeStyle = '#00F5D4';
          targetCtx.shadowColor = '#FF2A85';
          targetCtx.shadowBlur = 10;
          targetCtx.lineWidth = 1.6;
          targetCtx.beginPath();
          targetCtx.moveTo(s * 6, -baseR + 4);
          targetCtx.lineTo(s * 18, -baseR - 15);
          targetCtx.lineTo(s * 21, -baseR + 6);
          targetCtx.closePath();
          targetCtx.fill();
          targetCtx.stroke();

          targetCtx.shadowBlur = 0;
          targetCtx.fillStyle = '#FF2A85';
          targetCtx.beginPath();
          targetCtx.moveTo(s * 9, -baseR + 3);
          targetCtx.lineTo(s * 16.5, -baseR - 10);
          targetCtx.lineTo(s * 18.5, -baseR + 4);
          targetCtx.closePath();
          targetCtx.fill();
          targetCtx.restore();
        }
        break;
      }
      case 'hat_party': {
        // 🎉 PARTİ ŞAPKASI: Renkli puantiyeli 3D koni ve tepede ponpon
        const yP = -baseR + 3;
        const pGrad = targetCtx.createLinearGradient(-10, yP - 22, 10, yP);
        pGrad.addColorStop(0, '#FF2A85');
        pGrad.addColorStop(0.5, '#9B5DE5');
        pGrad.addColorStop(1, '#00BBF9');
        targetCtx.fillStyle = pGrad;
        targetCtx.strokeStyle = '#FFE066';
        targetCtx.lineWidth = 1.5;
        targetCtx.beginPath();
        targetCtx.moveTo(-11, yP);
        targetCtx.lineTo(0, yP - 23);
        targetCtx.lineTo(11, yP);
        targetCtx.quadraticCurveTo(0, yP + 3.5, -11, yP);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.stroke();

        // Puantiyeler ve Ponpon
        targetCtx.fillStyle = '#FFE066';
        for (const pt of [{ x: -3, y: yP - 6 }, { x: 4, y: yP - 9 }, { x: 0, y: yP - 14 }]) {
          targetCtx.beginPath();
          targetCtx.arc(pt.x, pt.y, 1.8, 0, Math.PI * 2);
          targetCtx.fill();
        }
        targetCtx.beginPath();
        targetCtx.arc(0, yP - 24.5, 4.2, 0, Math.PI * 2);
        targetCtx.fillStyle = '#00F5D4';
        targetCtx.shadowColor = '#00F5D4';
        targetCtx.shadowBlur = 10;
        targetCtx.fill();
        break;
      }
      case 'hat_flower_crown': {
        // 🌸 BAHAR ÇİÇEK TACI: Yapraklı sarmaşık ve 5 adet 3D renkli bahar çiçeği
        const yFl = -baseR + 4;
        targetCtx.strokeStyle = '#22C55E';
        targetCtx.lineWidth = 3.5;
        targetCtx.beginPath();
        targetCtx.ellipse(0, yFl, 15.5, 3.8, 0, 0, Math.PI * 2);
        targetCtx.stroke();

        const flowers = [
          { x: -13, y: yFl, c: '#FF2A85' },
          { x: -6.5, y: yFl + 2, c: '#00F5D4' },
          { x: 0, y: yFl + 2.5, c: '#FFE066' },
          { x: 6.5, y: yFl + 2, c: '#FF70A6' },
          { x: 13, y: yFl, c: '#00BBF9' }
        ];
        for (const fl of flowers) {
          targetCtx.beginPath();
          targetCtx.arc(fl.x, fl.y, 4.0, 0, Math.PI * 2);
          targetCtx.fillStyle = fl.c;
          targetCtx.shadowColor = fl.c;
          targetCtx.shadowBlur = 6;
          targetCtx.fill();
          targetCtx.shadowBlur = 0;
          targetCtx.beginPath();
          targetCtx.arc(fl.x, fl.y, 1.6, 0, Math.PI * 2);
          targetCtx.fillStyle = '#FFFFFF';
          targetCtx.fill();
        }
        break;
      }
      case 'hat_chef': {
        // 👨‍🍳 USTA AŞÇI ŞAPKASI: Kabarık 3D beyaz şef kepi
        const yC = -baseR + 3;
        targetCtx.fillStyle = '#F8FAFC';
        targetCtx.strokeStyle = '#CBD5E1';
        targetCtx.lineWidth = 1.5;
        for (const p of [{ x: -8, y: yC - 13, r: 7 }, { x: 8, y: yC - 13, r: 7 }, { x: 0, y: yC - 16, r: 8.5 }]) {
          targetCtx.beginPath();
          targetCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          targetCtx.fill();
          targetCtx.stroke();
        }
        targetCtx.fillStyle = '#E2E8F0';
        targetCtx.beginPath();
        targetCtx.roundRect(-11.5, yC - 8, 23, 8.5, 2.5);
        targetCtx.fill();
        targetCtx.stroke();
        break;
      }
      case 'hat_pirate_parrot': {
        // 🦜 KORSAN PAPAĞANI & BANDANA: Kırmızı bandana + omuz/tepede 3D renkli papağan
        drawSkinAccessory(targetCtx, 'pirate', baseR, time);
        const bob = Math.sin(time * 0.01) * 2;
        targetCtx.save();
        targetCtx.translate(18, -baseR - 8 + bob);
        targetCtx.fillStyle = '#EF4444';
        targetCtx.beginPath();
        targetCtx.ellipse(0, 0, 5.5, 7, 0.2, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.fillStyle = '#22C55E';
        targetCtx.beginPath();
        targetCtx.ellipse(2, 1, 3.2, 5, -0.2, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.fillStyle = '#FACC15';
        targetCtx.beginPath();
        targetCtx.moveTo(-4, -3);
        targetCtx.lineTo(-8.5, -1);
        targetCtx.lineTo(-4, 1);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.restore();
        break;
      }
      case 'hat_alien_antenna': {
        // 👽 UZAYLI ANTENİ: Yaylı çift neon yeşil anten ve parlayan küreler
        const sway = Math.sin(time * 0.01) * 3.5;
        for (const s of [-1, 1]) {
          targetCtx.strokeStyle = '#00F59B';
          targetCtx.lineWidth = 2.4;
          targetCtx.beginPath();
          targetCtx.moveTo(s * 8, -baseR + 3);
          targetCtx.quadraticCurveTo(s * 14 + sway, -baseR - 10, s * 13 + sway, -baseR - 19);
          targetCtx.stroke();

          targetCtx.beginPath();
          targetCtx.arc(s * 13 + sway, -baseR - 20, 4.2, 0, Math.PI * 2);
          targetCtx.fillStyle = '#00F59B';
          targetCtx.shadowColor = '#00F59B';
          targetCtx.shadowBlur = 12;
          targetCtx.fill();
          targetCtx.shadowBlur = 0;
        }
        break;
      }
      case 'hat_ninja_bandana': {
        drawSkinAccessory(targetCtx, 'ninja', baseR, time);
        break;
      }
      case 'hat_devil_horns': {
        drawSkinAccessory(targetCtx, 'devil', baseR, time);
        break;
      }
      case 'hat_steampunk_goggles': {
        // ⚙️ STEAMPUNK GÖZLÜĞÜ: Alında bronz/pirinç dişli mercekli gözlük
        const gy = -baseR * 0.56;
        targetCtx.strokeStyle = '#78350F';
        targetCtx.lineWidth = 4;
        targetCtx.beginPath();
        targetCtx.moveTo(-baseR * 0.92, gy);
        targetCtx.quadraticCurveTo(0, gy - 4, baseR * 0.92, gy);
        targetCtx.stroke();

        for (const s of [-1, 1]) {
          targetCtx.beginPath();
          targetCtx.arc(s * 8.5, gy - 1, 6.2, 0, Math.PI * 2);
          targetCtx.fillStyle = '#D97706';
          targetCtx.strokeStyle = '#FEF08A';
          targetCtx.lineWidth = 1.8;
          targetCtx.fill();
          targetCtx.stroke();

          targetCtx.beginPath();
          targetCtx.arc(s * 8.5, gy - 1, 4.0, 0, Math.PI * 2);
          targetCtx.fillStyle = '#00F5D4';
          targetCtx.shadowColor = '#00F5D4';
          targetCtx.shadowBlur = 8;
          targetCtx.fill();
          targetCtx.shadowBlur = 0;
        }
        break;
      }
      case 'hat_spartan': {
        // 🛡️ SPARTALI MİĞFERİ: Kırmızı tüylü sorguçlu altın-bronz gladyatör miğferi
        const yS = -baseR + 4;
        // Kırmızı sorguç (Crest)
        targetCtx.fillStyle = '#EF4444';
        targetCtx.strokeStyle = '#FACC15';
        targetCtx.lineWidth = 1.5;
        targetCtx.beginPath();
        targetCtx.arc(0, yS - 9, 16, Math.PI * 1.1, Math.PI * 1.9);
        targetCtx.lineTo(8, yS - 6);
        targetCtx.lineTo(-8, yS - 6);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.stroke();

        // Bronz Kubbe
        targetCtx.fillStyle = '#F59E0B';
        targetCtx.strokeStyle = '#FEF08A';
        targetCtx.beginPath();
        targetCtx.arc(0, yS, 15, Math.PI, 0);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.stroke();
        break;
      }
      case 'hat_astronaut': {
        // 🧑‍🚀 ASTRONOT KASKI: Şeffaf 3D cam kubbe ve altın-mavi yansıma
        targetCtx.save();
        targetCtx.strokeStyle = '#E2E8F0';
        targetCtx.lineWidth = 2.6;
        targetCtx.fillStyle = 'rgba(56, 189, 248, 0.16)';
        targetCtx.shadowColor = '#00BBF9';
        targetCtx.shadowBlur = 12;
        targetCtx.beginPath();
        targetCtx.arc(0, -1, baseR + 5.5, 0, Math.PI * 2);
        targetCtx.fill();
        targetCtx.stroke();

        targetCtx.shadowBlur = 0;
        targetCtx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
        targetCtx.lineWidth = 2.5;
        targetCtx.beginPath();
        targetCtx.arc(0, -1, baseR + 2.5, Math.PI * 1.15, Math.PI * 1.55);
        targetCtx.stroke();
        targetCtx.restore();
        break;
      }
      case 'hat_samurai': {
        // ⚔️ SAMURAY MİĞFERİ (KABUTO): Geniş yan kanatlar ve altın hilal boynuz (Kuwagata)
        const yK = -baseR + 4;
        targetCtx.fillStyle = '#1E293B';
        targetCtx.strokeStyle = '#EF4444';
        targetCtx.lineWidth = 1.6;
        targetCtx.beginPath();
        targetCtx.moveTo(-21, yK + 5);
        targetCtx.quadraticCurveTo(0, yK - 18, 21, yK + 5);
        targetCtx.lineTo(14, yK + 1);
        targetCtx.lineTo(-14, yK + 1);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.stroke();

        // Altın Hilal
        targetCtx.strokeStyle = '#FACC15';
        targetCtx.shadowColor = '#FACC15';
        targetCtx.shadowBlur = 10;
        targetCtx.lineWidth = 2.6;
        targetCtx.beginPath();
        targetCtx.arc(0, yK - 11, 10, Math.PI * 0.15, Math.PI * 0.85, true);
        targetCtx.stroke();
        targetCtx.shadowBlur = 0;
        break;
      }
      case 'hat_cyber_vr': {
        drawSkinAccessory(targetCtx, 'cyber', baseR, time);
        break;
      }
      case 'hat_dark_wizard': {
        drawSkinAccessory(targetCtx, 'wizard', baseR, time);
        break;
      }
      case 'hat_vip_crown': {
        // 👑 VIP KRAL TACI: Ekstra parlak elmaslı ve süzülen yıldızlı imparatorluk tacı
        drawSkinAccessory(targetCtx, 'crown', baseR, time);
        const pulseR = 3.2 + Math.sin(time * 0.01) * 0.8;
        targetCtx.beginPath();
        targetCtx.arc(0, -baseR - 23, pulseR, 0, Math.PI * 2);
        targetCtx.fillStyle = '#00F5D4';
        targetCtx.shadowColor = '#00F5D4';
        targetCtx.shadowBlur = 14;
        targetCtx.fill();
        targetCtx.shadowBlur = 0;
        break;
      }
    }
    targetCtx.restore();
  }

  function drawPreviewBeltOnCanvas(targetCtx, beltEffect, x1, y1, x2, y2, playerColor, time) {
    const midX = (x1 + x2) * 0.5 + Math.sin(time * 0.004) * 10;
    const midY = (y1 + y2) * 0.5 + Math.cos(time * 0.004) * 10;

    targetCtx.save();
    targetCtx.lineCap = 'round';

    if (beltEffect === 'belt_lightning') {
      targetCtx.strokeStyle = '#38BDF8';
      targetCtx.shadowColor = '#00F5D4';
      targetCtx.shadowBlur = 14;
      targetCtx.lineWidth = 3.2;
      targetCtx.beginPath();
      targetCtx.moveTo(x1, y1);
      const steps = 7;
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const bx = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * midX + t * t * x2;
        const by = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * midY + t * t * y2;
        const jitter = Math.sin(time * 0.04 + i * 3.1) * 6;
        targetCtx.lineTo(bx + jitter, by - jitter);
      }
      targetCtx.lineTo(x2, y2);
      targetCtx.stroke();
    } else if (beltEffect === 'belt_rainbow') {
      const grad = targetCtx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, '#FF2A85');
      grad.addColorStop(0.25, '#FFE066');
      grad.addColorStop(0.5, '#00F59B');
      grad.addColorStop(0.75, '#00BBF9');
      grad.addColorStop(1, '#9B5DE5');
      targetCtx.beginPath();
      targetCtx.lineWidth = 5;
      targetCtx.strokeStyle = grad;
      targetCtx.shadowColor = '#00F5D4';
      targetCtx.shadowBlur = 12;
      targetCtx.moveTo(x1, y1);
      targetCtx.quadraticCurveTo(midX, midY, x2, y2);
      targetCtx.stroke();
    } else if (beltEffect === 'belt_fire_chain') {
      targetCtx.beginPath();
      targetCtx.setLineDash([8, 4]);
      targetCtx.lineWidth = 4.8;
      targetCtx.strokeStyle = '#F97316';
      targetCtx.shadowColor = '#EF4444';
      targetCtx.shadowBlur = 14;
      targetCtx.moveTo(x1, y1);
      targetCtx.quadraticCurveTo(midX, midY, x2, y2);
      targetCtx.stroke();
      targetCtx.setLineDash([]);
    } else if (beltEffect === 'belt_lightsaber') {
      targetCtx.beginPath();
      targetCtx.lineWidth = 7;
      targetCtx.strokeStyle = '#FF2A85';
      targetCtx.shadowColor = '#FF2A85';
      targetCtx.shadowBlur = 18;
      targetCtx.moveTo(x1, y1);
      targetCtx.quadraticCurveTo(midX, midY, x2, y2);
      targetCtx.stroke();

      targetCtx.shadowBlur = 0;
      targetCtx.beginPath();
      targetCtx.lineWidth = 2.6;
      targetCtx.strokeStyle = '#FFFFFF';
      targetCtx.moveTo(x1, y1);
      targetCtx.quadraticCurveTo(midX, midY, x2, y2);
      targetCtx.stroke();
    } else {
      let strokeCol = playerColor || '#00F5D4';
      if (beltEffect === 'belt_gold_rope') strokeCol = '#FACC15';
      else if (beltEffect === 'belt_water_hose') strokeCol = '#38BDF8';
      else if (beltEffect === 'belt_ghost') strokeCol = '#A5F3FC';
      else if (beltEffect === 'belt_blood_vine') strokeCol = '#10B981';
      else if (beltEffect === 'belt_stardust') strokeCol = '#E879F9';
      else if (beltEffect === 'belt_cyber_matrix') strokeCol = '#00F59B';

      targetCtx.beginPath();
      if (beltEffect === 'belt_cyber_matrix') targetCtx.setLineDash([5, 5]);
      targetCtx.lineWidth = 4.2;
      targetCtx.strokeStyle = strokeCol;
      targetCtx.shadowColor = strokeCol;
      targetCtx.shadowBlur = 12;
      targetCtx.globalAlpha = beltEffect === 'belt_ghost' ? 0.55 : 0.92;
      targetCtx.moveTo(x1, y1);
      targetCtx.quadraticCurveTo(midX, midY, x2, y2);
      targetCtx.stroke();
      targetCtx.setLineDash([]);

      targetCtx.shadowBlur = 0;
      targetCtx.beginPath();
      targetCtx.lineWidth = 1.5;
      targetCtx.strokeStyle = '#FFFFFF';
      targetCtx.globalAlpha = 0.85;
      targetCtx.moveTo(x1, y1);
      targetCtx.quadraticCurveTo(midX, midY, x2, y2);
      targetCtx.stroke();

      if (beltEffect === 'belt_stardust' || beltEffect === 'belt_water_hose' || beltEffect === 'belt_blood_vine') {
        for (let i = 1; i <= 4; i++) {
          const t = ((time * 0.0009 + i * 0.25) % 1);
          const px = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * midX + t * t * x2;
          const py = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * midY + t * t * y2;
          targetCtx.beginPath();
          targetCtx.arc(px, py, 2.8, 0, Math.PI * 2);
          targetCtx.fillStyle = beltEffect === 'belt_blood_vine' ? '#F43F5E' : '#FFFFFF';
          targetCtx.fill();
        }
      }
    }

    targetCtx.globalAlpha = 1;
    targetCtx.beginPath();
    targetCtx.arc(x1, y1, 6, 0, Math.PI * 2);
    targetCtx.fillStyle = playerColor || '#00F5D4';
    targetCtx.shadowColor = playerColor || '#00F5D4';
    targetCtx.shadowBlur = 10;
    targetCtx.fill();
    targetCtx.restore();
  }

  function drawPreviewKillEffectOnCanvas(targetCtx, killType, cx, cy, w, h, time) {
    if (!killType) return;
    const cycleMs = 1800;
    const elapsed = (time - (shopPreviewKillStartMs || 0)) % cycleMs;
    const progress = Math.max(0, Math.min(1, elapsed / cycleMs));
    const alpha = Math.max(0.15, 1 - progress * 0.85);

    targetCtx.save();
    targetCtx.translate(cx, cy);
    targetCtx.globalAlpha = alpha;

    const colors = ['#00F5D4', '#FF2A85', '#FFE066', '#00BBF9', '#9B5DE5', '#00F59B'];
    for (let i = 0; i < 14; i++) {
      const a = (Math.PI * 2 * i) / 14 + progress * 1.4;
      const dist = 12 + progress * 56 * (0.65 + (i % 3) * 0.2);
      const px = Math.cos(a) * dist;
      const py = Math.sin(a) * dist + (killType === 'kill_confetti' ? progress * progress * 18 : 0);
      targetCtx.save();
      targetCtx.translate(px, py);
      targetCtx.rotate(progress * 5 + i);
      targetCtx.fillStyle = killType === 'kill_blackhole' ? '#A855F7' : colors[i % colors.length];
      if (killType === 'kill_pixel') {
        targetCtx.fillRect(-3.5, -3.5, 7, 7);
      } else {
        targetCtx.beginPath();
        targetCtx.arc(0, 0, 3.6 * (1 - progress * 0.35), 0, Math.PI * 2);
        targetCtx.fill();
      }
      targetCtx.restore();
    }

    if (killType === 'kill_blackhole') {
      const bhR = 32 * Math.sin(progress * Math.PI);
      const grad = targetCtx.createRadialGradient(0, 0, 2, 0, 0, Math.max(4, bhR));
      grad.addColorStop(0, '#000000');
      grad.addColorStop(0.6, '#3B0764');
      grad.addColorStop(1, 'rgba(168, 85, 247, 0)');
      targetCtx.fillStyle = grad;
      targetCtx.beginPath();
      targetCtx.arc(0, 0, Math.max(4, bhR), 0, Math.PI * 2);
      targetCtx.fill();
    } else if (killType === 'kill_ufo') {
      targetCtx.fillStyle = 'rgba(0, 245, 155, 0.28)';
      targetCtx.beginPath();
      targetCtx.moveTo(-10, -48);
      targetCtx.lineTo(10, -48);
      targetCtx.lineTo(24, 10);
      targetCtx.lineTo(-24, 10);
      targetCtx.closePath();
      targetCtx.fill();
      targetCtx.font = '22px "Segoe UI Emoji", sans-serif';
      targetCtx.textAlign = 'center';
      targetCtx.fillText('🛸', 0, -44 - progress * 14);
    } else if (killType === 'kill_tombstone') {
      targetCtx.font = '24px "Segoe UI Emoji", sans-serif';
      targetCtx.textAlign = 'center';
      targetCtx.fillText('🪦 R.I.P', 0, -28);
    } else if (killType === 'kill_gg_neon') {
      targetCtx.font = '900 20px "Segoe UI", sans-serif';
      targetCtx.textAlign = 'center';
      targetCtx.fillStyle = '#00F5D4';
      targetCtx.shadowColor = '#FF2A85';
      targetCtx.shadowBlur = 14;
      targetCtx.fillText('⚡ GG! ⚡', 0, -28 - progress * 14);
    } else if (killType === 'kill_heartbreak') {
      targetCtx.font = '24px "Segoe UI Emoji", sans-serif';
      targetCtx.textAlign = 'center';
      targetCtx.fillText('💔', 0, -26 - progress * 14);
    } else if (killType === 'kill_fireworks') {
      targetCtx.strokeStyle = '#FFE066';
      targetCtx.lineWidth = 2.2;
      targetCtx.beginPath();
      targetCtx.arc(0, 0, progress * 46, 0, Math.PI * 2);
      targetCtx.stroke();
    } else if (killType === 'kill_bomb_crater') {
      targetCtx.fillStyle = 'rgba(15, 23, 42, 0.78)';
      targetCtx.strokeStyle = '#F97316';
      targetCtx.lineWidth = 2.5;
      targetCtx.beginPath();
      targetCtx.ellipse(0, 6, 24, 11, 0, 0, Math.PI * 2);
      targetCtx.fill();
      targetCtx.stroke();
    } else if (killType === 'kill_screen_crack') {
      targetCtx.strokeStyle = '#E2E8F0';
      targetCtx.shadowColor = '#00BBF9';
      targetCtx.shadowBlur = 10;
      targetCtx.lineWidth = 2;
      const rays = [0.3, 1.1, 2.0, 2.9, 3.8, 4.9, 5.7];
      for (const a of rays) {
        targetCtx.beginPath();
        targetCtx.moveTo(0, 0);
        targetCtx.lineTo(Math.cos(a) * 32, Math.sin(a) * 32);
        targetCtx.lineTo(Math.cos(a + 0.14) * 68, Math.sin(a + 0.14) * 68);
        targetCtx.stroke();
      }
    }

    targetCtx.restore();
  }

  function renderPreviewOnCanvas(targetCanvas, targetCtx, time) {
    if (!targetCanvas || !targetCtx) return;
    const w = targetCanvas.width;
    const h = targetCanvas.height;
    targetCtx.clearRect(0, 0, w, h);

    const isShopCanvas = targetCanvas === shopPreviewCanvas;
    const eco = getActiveEconomy();
    const eq = (eco && eco.equipped) || {};

    const activeHat = (isShopCanvas && shopPreviewLoadout.hat) || eq.hat || selectedSkin || 'crown';
    const activeSkinCoating = (isShopCanvas && shopPreviewLoadout.skin) || eq.skin || null;
    const activeBelt = (isShopCanvas && shopPreviewLoadout.belt) || eq.belt || null;
    const activeKill = isShopCanvas
      ? (shopPreviewLoadout.kill_effect || (currentShopTab === 'kill_effect' ? eq.kill_effect : null))
      : null;
    const activeTitleId = (isShopCanvas && shopPreviewLoadout.title) || eq.title || null;
    const activeTitleMeta = activeTitleId ? TITLE_META[activeTitleId] : null;

    const cx = w / 2;
    const cy = isShopCanvas ? h / 2 - 4 : h / 2 + 12;
    const r = Math.min(w, h) * (isShopCanvas ? 0.23 : 0.27);

    // 0) Mağaza önizlemesinde Kemer / Lazer Efekti (Sol üst duvar ankrajından karaktere uzanan canlı kemer)
    if (isShopCanvas && (activeBelt || currentShopTab === 'belt')) {
      drawPreviewBeltOnCanvas(targetCtx, activeBelt || 'belt_water_hose', 24, 26, cx, cy, selectedColor, time);
    }

    targetCtx.save();
    targetCtx.translate(cx, cy);

    // 1) 3D Parlak Jöle Gövde + Mağaza Kaplaması
    draw3DSlimeBody(targetCtx, r, selectedColor, time, 0.5, activeHat, activeSkinCoating);

    // 2) 3D Sevimli Canlı Gözler
    const lookX = Math.sin(time * 0.0022) * 2.2;
    const lookY = Math.cos(time * 0.0018) * 1.4;
    draw3DCuteEyes(targetCtx, r, lookX, lookY, time, 1.2);

    // 3) 3D Neon Kostüm / Mağaza Şapkası Aksesuarı
    drawSkinAccessory(targetCtx, activeHat, r, time);
    targetCtx.restore();

    // 4) Mağaza önizlemesinde Ölüm / Kill Efekti (Secildiğinde döngüsel olarak patlar)
    if (isShopCanvas && activeKill) {
      drawPreviewKillEffectOnCanvas(targetCtx, activeKill, cx, cy, w, h, time);
    }

    // 5) Mağaza önizlemesinde Unvan & VIP Altın Çerçeve
    if (isShopCanvas && activeTitleMeta) {
      targetCtx.save();
      targetCtx.font = '900 9.5px "Segoe UI", sans-serif';
      const titleW = Math.min(w - 14, Math.max(84, targetCtx.measureText(activeTitleMeta.label).width + 14));
      const boxY = h - 24;
      targetCtx.fillStyle = activeTitleMeta.bg;
      targetCtx.strokeStyle = activeTitleMeta.color;
      targetCtx.lineWidth = activeTitleMeta.isGoldFrame ? 2 : 1.3;
      targetCtx.shadowColor = activeTitleMeta.color;
      targetCtx.shadowBlur = activeTitleMeta.isGoldFrame ? 10 : 6;
      targetCtx.beginPath();
      targetCtx.roundRect(cx - titleW / 2, boxY, titleW, 17, 8);
      targetCtx.fill();
      targetCtx.stroke();

      targetCtx.shadowBlur = 0;
      targetCtx.fillStyle = activeTitleMeta.color;
      targetCtx.textAlign = 'center';
      targetCtx.textBaseline = 'middle';
      targetCtx.fillText(activeTitleMeta.label, cx, boxY + 8.5);
      targetCtx.restore();
    }
  }

  function renderLobbySkinPreview(time) {
    if (previewCtx && lobbyModal && lobbyModal.style.display !== 'none') {
      renderPreviewOnCanvas(skinPreviewCanvas, previewCtx, time);
    }
    if (shopPreviewCtx && shopModal && shopModal.style.display !== 'none') {
      renderPreviewOnCanvas(shopPreviewCanvas, shopPreviewCtx, time);
    }
  }

  // --- HARİTA VE OYUNCU GÖRSELLEŞTİRME ---
  function drawOpenWorldAndObstacles(time) {
    const halfW = config.ARENA_WIDTH / 2;
    const halfH = config.ARENA_HEIGHT / 2;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-halfW, -halfH, config.ARENA_WIDTH, config.ARENA_HEIGHT, 36);
    ctx.fillStyle = '#0B0F1A';
    ctx.fill();
    ctx.clip();

    for (const s of stars) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = s.color;
      ctx.globalAlpha = s.alpha * (0.7 + 0.3 * Math.sin(time * 0.003 + s.x));
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    ctx.strokeStyle = 'rgba(0, 245, 212, 0.055)';
    ctx.lineWidth = 2;
    const step = 100;
    for (let x = -halfW; x <= halfW; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, -halfH);
      ctx.lineTo(x, halfH);
      ctx.stroke();
    }
    for (let y = -halfH; y <= halfH; y += step) {
      ctx.beginPath();
      ctx.moveTo(-halfW, y);
      ctx.lineTo(halfW, y);
      ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-halfW, -halfH, config.ARENA_WIDTH, config.ARENA_HEIGHT, 36);
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#00F5D4';
    ctx.shadowColor = '#00F5D4';
    ctx.shadowBlur = 24;
    ctx.stroke();
    ctx.restore();

    for (const obs of mapObstacles) {
      ctx.save();
      ctx.beginPath();
      if (obs.type === 'circle') {
        ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2);
      } else if (obs.vertices && obs.vertices.length > 0) {
        ctx.moveTo(obs.vertices[0].x, obs.vertices[0].y);
        for (let i = 1; i < obs.vertices.length; i++) {
          ctx.lineTo(obs.vertices[i].x, obs.vertices[i].y);
        }
        ctx.closePath();
      }

      const neonColor = obs.color || '#00F5D4';
      ctx.fillStyle = '#131B2E';
      ctx.fill();
      ctx.shadowColor = neonColor;
      ctx.shadowBlur = 18;
      ctx.lineWidth = 4.5;
      ctx.strokeStyle = neonColor;
      ctx.stroke();

      if (obs.type === 'circle' && obs.radius > 42) {
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(obs.x, obs.y, obs.radius * 0.45, 0, Math.PI * 2);
        ctx.lineWidth = 2;
        ctx.strokeStyle = neonColor;
        ctx.globalAlpha = 0.45;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawBelt(player, band, isTargetedForRightClick, time) {
    const x1 = band.anchorX;
    const y1 = band.anchorY;
    const x2 = player.renderX;
    const y2 = player.renderY;

    const midX = (x1 + x2) * 0.5 + Math.sin(time * 0.004 + band.id) * 14;
    const midY = (y1 + y2) * 0.5 + Math.cos(time * 0.004 + band.id) * 14;

    const beltEffect = (player.equipped && player.equipped.belt) || null;

    ctx.save();
    ctx.lineCap = 'round';

    if (isTargetedForRightClick) {
      ctx.beginPath();
      ctx.setLineDash([12, 6]);
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#FFFFFF';
      ctx.shadowColor = '#FFFFFF';
      ctx.shadowBlur = 16;
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(midX, midY, x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (beltEffect === 'belt_lightning') {
      // ⚡ YILDIRIM AĞI: Yüksek voltajlı zikzaklı elektrik kemeri
      ctx.strokeStyle = '#38BDF8';
      ctx.shadowColor = '#00F5D4';
      ctx.shadowBlur = 18;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      const steps = 8;
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const bx = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * midX + t * t * x2;
        const by = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * midY + t * t * y2;
        const jitter = Math.sin(time * 0.04 + i * 3.1 + band.id) * 8;
        ctx.lineTo(bx + jitter, by - jitter);
      }
      ctx.lineTo(x2, y2);
      ctx.stroke();
    } else if (beltEffect === 'belt_rainbow') {
      // 🌈 GÖKKUŞAĞI NEON KEMER
      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, '#FF2A85');
      grad.addColorStop(0.25, '#FFE066');
      grad.addColorStop(0.5, '#00F59B');
      grad.addColorStop(0.75, '#00BBF9');
      grad.addColorStop(1, '#9B5DE5');
      ctx.beginPath();
      ctx.lineWidth = 5.5;
      ctx.strokeStyle = grad;
      ctx.shadowColor = '#00F5D4';
      ctx.shadowBlur = 14;
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(midX, midY, x2, y2);
      ctx.stroke();
    } else if (beltEffect === 'belt_fire_chain') {
      // 🔥 ATEŞTEN ZİNCİR
      ctx.beginPath();
      ctx.setLineDash([10, 5]);
      ctx.lineWidth = 5.2;
      ctx.strokeStyle = '#F97316';
      ctx.shadowColor = '#EF4444';
      ctx.shadowBlur = 16;
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(midX, midY, x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (beltEffect === 'belt_lightsaber') {
      // ⚔️ IŞIN KILICI LAZER: Ekstra kalın plazma hüzmesi ve bembeyaz çekirdek
      ctx.beginPath();
      ctx.lineWidth = 7.5;
      ctx.strokeStyle = '#FF2A85';
      ctx.shadowColor = '#FF2A85';
      ctx.shadowBlur = 22;
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(midX, midY, x2, y2);
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.lineWidth = 3.0;
      ctx.strokeStyle = '#FFFFFF';
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(midX, midY, x2, y2);
      ctx.stroke();
    } else {
      // Standart + diğer özel kemer renkleri (water_hose, gold_rope, ghost, blood_vine, stardust, cyber_matrix)
      let strokeCol = player.color;
      if (beltEffect === 'belt_gold_rope') strokeCol = '#FACC15';
      else if (beltEffect === 'belt_water_hose') strokeCol = '#38BDF8';
      else if (beltEffect === 'belt_ghost') strokeCol = '#A5F3FC';
      else if (beltEffect === 'belt_blood_vine') strokeCol = '#10B981';
      else if (beltEffect === 'belt_stardust') strokeCol = '#E879F9';
      else if (beltEffect === 'belt_cyber_matrix') strokeCol = '#00F59B';

      ctx.beginPath();
      if (beltEffect === 'belt_cyber_matrix') ctx.setLineDash([6, 6]);
      ctx.lineWidth = 4.6;
      ctx.strokeStyle = strokeCol;
      ctx.shadowColor = strokeCol;
      ctx.shadowBlur = 14;
      ctx.globalAlpha = beltEffect === 'belt_ghost' ? 0.55 : 0.9;
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(midX, midY, x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = '#FFFFFF';
      ctx.globalAlpha = 0.88;
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(midX, midY, x2, y2);
      ctx.stroke();

      // Kemer üstü hareketli parçacıklar (yıldız tozu, su damlası veya sarmaşık dikeni)
      if (beltEffect === 'belt_stardust' || beltEffect === 'belt_water_hose' || beltEffect === 'belt_blood_vine') {
        for (let i = 1; i <= 4; i++) {
          const t = ((time * 0.0008 + i * 0.25) % 1);
          const px = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * midX + t * t * x2;
          const py = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * midY + t * t * y2;
          ctx.beginPath();
          ctx.arc(px, py, 3.2, 0, Math.PI * 2);
          ctx.fillStyle = beltEffect === 'belt_blood_vine' ? '#F43F5E' : '#FFFFFF';
          ctx.fill();
        }
      }
    }

    // Duvar Bağlantı Noktasında Parlak Neon Enerji Küresi
    ctx.globalAlpha = 1.0;
    ctx.beginPath();
    ctx.arc(x1, y1, 7.5, 0, Math.PI * 2);
    ctx.fillStyle = player.color;
    ctx.shadowColor = player.color;
    ctx.shadowBlur = 14;
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(x1, y1, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.restore();
  }

  function drawSlimeArrows() {
    for (const a of renderArrows) {
      const angle = Math.atan2(a.vy, a.vx);
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(angle);

      // Neon Lazer Ok Gövdesi (Görseldeki parlak üçgen neon ok ucuyla birebir uyumlu)
      ctx.shadowColor = a.color;
      ctx.shadowBlur = 18;

      ctx.beginPath();
      ctx.moveTo(19, 0);
      ctx.lineTo(-14, 9);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-14, -9);
      ctx.closePath();

      ctx.fillStyle = a.color;
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();

      // Ok ucu parlak yıldız çekirdeği
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(14, 0, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.restore();
    }
  }

  function drawWallSpawnSelector(me, time) {
    const preview = getNearestWallPreview(mouseWorld.x, mouseWorld.y);
    const pulse = 1 + Math.sin(time * 0.01) * 0.18;

    ctx.save();
    ctx.shadowColor = me.color || '#00F5D4';
    ctx.shadowBlur = 16;

    ctx.beginPath();
    ctx.arc(preview.anchorX, preview.anchorY, 12 * pulse, 0, Math.PI * 2);
    ctx.fillStyle = me.color || '#00F5D4';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();

    ctx.beginPath();
    ctx.setLineDash([10, 6]);
    ctx.moveTo(preview.anchorX, preview.anchorY);
    ctx.lineTo(preview.spawnX, preview.spawnY);
    ctx.lineWidth = 4;
    ctx.strokeStyle = me.color || '#00F5D4';
    ctx.stroke();
    ctx.setLineDash([]);

    const eqMe = (me && me.equipped) || {};
    const meHat = eqMe.hat || me.skin || 'crown';
    const meCoating = eqMe.skin || null;
    ctx.globalAlpha = 0.88;
    ctx.translate(preview.spawnX, preview.spawnY);
    draw3DSlimeBody(ctx, config.PLAYER_RADIUS, me.color || '#00F5D4', time, 0, meHat, meCoating);
    draw3DCuteEyes(ctx, config.PLAYER_RADIUS, 0, 0, time, 0);
    drawSkinAccessory(ctx, meHat, config.PLAYER_RADIUS, time);
    ctx.restore();
  }

  function drawPowerupBoxes(time) {
    if (!renderPowerups || renderPowerups.length === 0) return;
    const boxR = config.POWERUP_RADIUS || 22;

    for (const box of renderPowerups) {
      const bobY = Math.sin(time * 0.005 + box.id) * 4.5;
      const pulse = 1 + Math.sin(time * 0.008 + box.id * 1.7) * 0.12;
      const rot = time * 0.0018 + box.id;

      // Üç gücün renkleri arasında tatlı neon geçişi
      const hueCycle = Math.floor((time * 0.002 + box.id) % 3);
      const glowColor = hueCycle === 0 ? '#00BBF9' : hueCycle === 1 ? '#FF2A85' : '#FFE066';

      ctx.save();
      ctx.translate(box.x, box.y);

      // 1) Zemin üzerindeki 3D süzülme gölgesi ve dış radar halkası
      ctx.beginPath();
      ctx.ellipse(0, boxR + 8, boxR * 0.85, boxR * 0.32, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(8, 11, 18, 0.55)';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, bobY, boxR * 1.32 * pulse, 0, Math.PI * 2);
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.45;
      ctx.setLineDash([6, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1.0;

      // 2) Süzülen 3D Neon Enerji Küpü Gövdesi
      ctx.translate(0, bobY);
      ctx.save();
      ctx.rotate(Math.sin(rot) * 0.18);

      const cubeSize = boxR * 1.45;
      const halfS = cubeSize / 2;
      const boxGrad = ctx.createLinearGradient(-halfS, -halfS, halfS, halfS);
      boxGrad.addColorStop(0, '#00BBF9');
      boxGrad.addColorStop(0.5, '#FF2A85');
      boxGrad.addColorStop(1, '#FFE066');

      ctx.fillStyle = boxGrad;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.6;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 22;

      ctx.beginPath();
      ctx.roundRect(-halfS, -halfS, cubeSize, cubeSize, 8);
      ctx.fill();
      ctx.stroke();

      // 3) Küp içi 3D cam parlama şeridi (Specular highlight)
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath();
      ctx.roundRect(-halfS + 3, -halfS + 3, cubeSize - 6, (cubeSize - 6) * 0.42, 5);
      ctx.fill();

      // 4) Küp merkezi soru işareti / yıldız sembolü
      ctx.font = '900 17px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = '#080B12';
      ctx.shadowBlur = 6;
      ctx.fillText('⚡?', 0, 1);
      ctx.restore();

      ctx.restore();
    }
  }

  function drawPlayerPowerupAura(player, time, lookAngle) {
    if (!player.activePowerup) return;
    const meta = POWERUP_META[player.activePowerup];
    if (!meta) return;

    const baseR = config.PLAYER_RADIUS;
    const totalDur = config.POWERUP_DURATION_MS || 10000;
    const remMs = Math.max(0, player.powerupRemaining || 0);
    const ratio = Math.max(0.05, Math.min(1, remMs / totalDur));
    const pulse = 1 + Math.sin(time * 0.012) * 0.08;

    ctx.save();
    ctx.translate(player.renderX, player.renderY);

    // 1) Dış Parlayan 3D Neon Aura Çemberi (Gücün türüne göre farklı renkte ve desende)
    const auraR = (baseR + 14) * pulse;
    const auraGrad = ctx.createRadialGradient(0, 0, baseR * 0.7, 0, 0, auraR + 12);
    auraGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    if (player.activePowerup === 'wide_cam') {
      auraGrad.addColorStop(0.65, 'rgba(0, 187, 249, 0.28)');
      auraGrad.addColorStop(1, 'rgba(0, 187, 249, 0)');
    } else if (player.activePowerup === 'double_shot') {
      auraGrad.addColorStop(0.65, 'rgba(255, 42, 133, 0.30)');
      auraGrad.addColorStop(1, 'rgba(255, 42, 133, 0)');
    } else {
      auraGrad.addColorStop(0.65, 'rgba(255, 224, 102, 0.32)');
      auraGrad.addColorStop(1, 'rgba(255, 224, 102, 0)');
    }

    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.arc(0, 0, auraR + 12, 0, Math.PI * 2);
    ctx.fill();

    // 2) Kalan 10 Saniye Süre Halkası (Countdown Progress Arc)
    ctx.save();
    ctx.rotate(-Math.PI / 2);
    ctx.beginPath();
    ctx.arc(0, 0, baseR + 11, 0, Math.PI * 2 * ratio);
    ctx.strokeStyle = meta.color;
    ctx.shadowColor = meta.color;
    ctx.shadowBlur = 16;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();

    // 3) Gücün Türüne Özel Canlı 3D Efekt Detayları
    if (player.activePowerup === 'wide_cam') {
      // 🔭 GENİŞ KAMERA: Dönen 4 Siber Radar Tarayıcı Yayları
      const radarRot = time * 0.0035;
      ctx.strokeStyle = '#00BBF9';
      ctx.shadowColor = '#00BBF9';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 2.2;
      for (let i = 0; i < 4; i++) {
        const a0 = radarRot + i * (Math.PI / 2);
        ctx.beginPath();
        ctx.arc(0, 0, baseR + 17, a0, a0 + 0.45);
        ctx.stroke();
      }
    } else if (player.activePowerup === 'double_shot') {
      // 🏹 İKİLİ ATIŞ: Bakış yönünde V şeklinde iki neon lazer nişangah ucu + dönen ikili plazma küresi
      const spread = config.POWERUP_DOUBLE_SHOT_SPREAD_RAD || 0.16;
      ctx.strokeStyle = '#FF2A85';
      ctx.fillStyle = '#FF2A85';
      ctx.shadowColor = '#FF2A85';
      ctx.shadowBlur = 14;
      ctx.lineWidth = 2.2;
      for (const s of [-1, 1]) {
        const a = lookAngle + s * spread;
        const x1 = Math.cos(a) * (baseR + 8);
        const y1 = Math.sin(a) * (baseR + 8);
        const x2 = Math.cos(a) * (baseR + 24);
        const y2 = Math.sin(a) * (baseR + 24);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(x2, y2, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (player.activePowerup === 'high_speed') {
      // ⚡ YÜKSEK HIZ: Oyuncunun etrafında dönen altın şimşek kıvılcımları
      const sparkRot = time * 0.008;
      ctx.fillStyle = '#FFE066';
      ctx.shadowColor = '#FFE066';
      ctx.shadowBlur = 14;
      for (let i = 0; i < 4; i++) {
        const a = sparkRot + i * (Math.PI / 2);
        const sx = Math.cos(a) * (baseR + 16);
        const sy = Math.sin(a) * (baseR + 16);
        ctx.beginPath();
        ctx.arc(sx, sy, 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 4) Kafa üstü / alt isim yanında canlı süre etiketi (Herkes görebilir)
    const secLeft = (remMs / 1000).toFixed(1);
    ctx.font = '900 12px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = meta.color;
    ctx.shadowColor = '#080B12';
    ctx.shadowBlur = 6;
    ctx.fillText(`${meta.icon} ${meta.name} (${secLeft}s)`, 0, baseR + 38);

    ctx.restore();
  }

  function drawJellySlime(player, time) {
    const speed = Math.hypot(player.vx, player.vy);
    const moveAngle = speed > 0.2 ? Math.atan2(player.vy, player.vx) : 0;

    const stretch = 1 + Math.min(speed * 0.032, 0.36) + player.impactPulse * 0.25;
    const squash = 1 / Math.sqrt(stretch);
    player.impactPulse *= 0.88;

    const baseR = config.PLAYER_RADIUS;

    const lookAngle =
      player.id === selfId
        ? joystick.active
          ? joystick.aimAngle
          : keyboard.mode === 'keyboard'
            ? keyboard.aimAngle
            : Math.atan2(mouseWorld.y - player.renderY, mouseWorld.x - player.renderX)
        : moveAngle;

    const eq = player.equipped || {};
    const activeHat = eq.hat || player.skin || 'crown';
    const activeCoating = eq.skin || null;
    const activeTitleMeta = eq.title ? TITLE_META[eq.title] : null;

    // 0) Aktif Güçlendirme (Power-Up) Neon Aurası (Diğer tüm oyuncular tarafından görülür)
    if (player.activePowerup) {
      drawPlayerPowerupAura(player, time, lookAngle);
    }

    // 1) 3D Parlak Jöle Küre Gövde + Mağaza Kaplaması (Hareket yönüne göre esneyen jelly fizik)
    ctx.save();
    ctx.translate(player.renderX, player.renderY);
    ctx.rotate(moveAngle);
    ctx.scale(stretch, squash);
    draw3DSlimeBody(ctx, baseR, player.color || '#00F5D4', time, player.wobblePhase || 0, activeHat, activeCoating);
    ctx.restore();

    // 2) 3D İri Parlak Gözler, Allık, Tebessüm ve Neon Kostüm / Mağaza Şapkası
    ctx.save();
    ctx.translate(player.renderX, player.renderY);
    const lookX = Math.cos(lookAngle) * 4.2;
    const lookY = Math.sin(lookAngle) * 4.2;

    draw3DCuteEyes(ctx, baseR, lookX, lookY, time, player.wobblePhase || 0);

    drawSkinAccessory(ctx, activeHat, baseR, time);

    if (followedPlayerId && player.id === followedPlayerId) {
      ctx.beginPath();
      ctx.arc(0, 0, baseR + 10 + Math.sin(time * 0.01) * 3, 0, Math.PI * 2);
      ctx.lineWidth = 2.5;
      ctx.setLineDash([8, 5]);
      ctx.strokeStyle = '#EC4899';
      ctx.shadowColor = '#EC4899';
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const ammo = Math.max(0, player.bands.length - 1);
    const familyPrefix = player.team === 'seferogullari'
      ? '[SEFER] '
      : player.team === 'telliogullari'
        ? '[TELLİ] '
        : '';

    const nameText = `${familyPrefix}${player.name} [🔗${player.bands.length} | 🏹${ammo}]`;

    // VIP Altın veya Unvan Çerçevesi
    if (activeTitleMeta) {
      ctx.save();
      ctx.font = '900 10px "Segoe UI", sans-serif';
      const titleW = Math.max(88, ctx.measureText(activeTitleMeta.label).width + 14);
      ctx.fillStyle = activeTitleMeta.bg;
      ctx.strokeStyle = activeTitleMeta.color;
      ctx.lineWidth = activeTitleMeta.isGoldFrame ? 2 : 1.3;
      ctx.shadowColor = activeTitleMeta.color;
      ctx.shadowBlur = activeTitleMeta.isGoldFrame ? 10 : 6;
      ctx.beginPath();
      ctx.roundRect(-titleW / 2, baseR + 27, titleW, 16, 8);
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.fillStyle = activeTitleMeta.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(activeTitleMeta.label, 0, baseR + 35);
      ctx.restore();
    }

    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = activeTitleMeta && activeTitleMeta.isGoldFrame ? '#FFE066' : '#F8F9FA';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 6;
    ctx.fillText(nameText, 0, baseR + 20);
    ctx.restore();
  }

  function drawKillAnimations(time) {
    if (killAnimations.length === 0) return;

    for (let i = killAnimations.length - 1; i >= 0; i--) {
      const ka = killAnimations[i];
      const elapsed = time - ka.startTime;
      if (elapsed >= ka.duration) {
        killAnimations.splice(i, 1);
        continue;
      }
      const progress = Math.max(0, Math.min(1, elapsed / ka.duration));
      const alpha = 1 - progress;

      ctx.save();
      ctx.translate(ka.x, ka.y);
      ctx.globalAlpha = alpha;

      // Parçacık patlaması
      for (const pt of ka.particles) {
        pt.rot += pt.vRot;
        const px = pt.vx * (elapsed * 0.06);
        const py = pt.vy * (elapsed * 0.06) + (ka.type === 'kill_confetti' ? progress * progress * 28 : 0);
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(pt.rot);
        ctx.fillStyle = ka.type === 'kill_blackhole' ? '#A855F7' : pt.color;
        if (ka.type === 'kill_pixel') {
          ctx.fillRect(-pt.size, -pt.size, pt.size * 2, pt.size * 2);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, pt.size * (1 - progress * 0.4), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // Ölüm Efektine Özel Merkez 3D Görsel Şov
      if (ka.type === 'kill_blackhole') {
        const bhR = 36 * Math.sin(progress * Math.PI);
        const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, Math.max(4, bhR));
        grad.addColorStop(0, '#000000');
        grad.addColorStop(0.6, '#3B0764');
        grad.addColorStop(1, 'rgba(168, 85, 247, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(4, bhR), 0, Math.PI * 2);
        ctx.fill();
      } else if (ka.type === 'kill_ufo') {
        // 🛸 UFO IŞINLAMASI: Yukarıdan inen yeşil çekim huzmesi ve uçan daire
        ctx.fillStyle = 'rgba(0, 245, 155, 0.28)';
        ctx.beginPath();
        ctx.moveTo(-12, -55);
        ctx.lineTo(12, -55);
        ctx.lineTo(28, 12);
        ctx.lineTo(-28, 12);
        ctx.closePath();
        ctx.fill();
        ctx.font = '28px "Segoe UI Emoji", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🛸', 0, -52 - progress * 20);
      } else if (ka.type === 'kill_tombstone') {
        ctx.font = '32px "Segoe UI Emoji", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🪦 R.I.P', 0, -10 + Math.min(0, (progress - 0.2) * 15));
      } else if (ka.type === 'kill_gg_neon') {
        ctx.font = '900 26px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#00F5D4';
        ctx.shadowColor = '#FF2A85';
        ctx.shadowBlur = 16;
        ctx.fillText('⚡ GG! ⚡', 0, -16 - progress * 24);
      } else if (ka.type === 'kill_heartbreak') {
        ctx.font = '30px "Segoe UI Emoji", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('💔', 0, -12 - progress * 22);
      } else if (ka.type === 'kill_fireworks') {
        ctx.strokeStyle = '#FFE066';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, progress * 55, 0, Math.PI * 2);
        ctx.stroke();
      } else if (ka.type === 'kill_bomb_crater') {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
        ctx.strokeStyle = '#F97316';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 4, 28, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  function drawScreenCrackOverlay(time) {
    if (time >= screenCrackUntil) return;
    const rem = screenCrackUntil - time;
    const alpha = Math.min(1, rem / 550);

    ctx.save();
    ctx.globalAlpha = alpha * 0.85;
    ctx.strokeStyle = '#E2E8F0';
    ctx.shadowColor = '#00BBF9';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2.6;

    const cx = canvas.width * 0.5;
    const cy = canvas.height * 0.5;
    const rays = [0.2, 0.9, 1.55, 2.3, 3.1, 3.9, 4.7, 5.5];
    for (const a of rays) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      const r1 = 90;
      const r2 = 240;
      const r3 = 460;
      ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a + 0.12) * r2, cy + Math.sin(a + 0.12) * r2);
      ctx.lineTo(cx + Math.cos(a - 0.08) * r3, cy + Math.sin(a - 0.08) * r3);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawMinimap() {
    const isSmallScreen = canvas.width < 860;
    const mapW = isSmallScreen ? 125 : 200;
    const mapH = Math.round(mapW * (config.ARENA_HEIGHT / config.ARENA_WIDTH));
    const margin = isSmallScreen ? 10 : 16;
    const mx = margin;
    const my = isSmallScreen ? 52 : canvas.height - mapH - margin;

    ctx.save();
    ctx.fillStyle = 'rgba(11, 15, 26, 0.86)';
    ctx.strokeStyle = 'rgba(0, 245, 212, 0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(mx, my, mapW, mapH, 8);
    ctx.fill();
    ctx.stroke();

    const scaleX = mapW / config.ARENA_WIDTH;
    const scaleY = mapH / config.ARENA_HEIGHT;
    const centerX = mx + mapW / 2;
    const centerY = my + mapH / 2;

    for (const obs of mapObstacles) {
      const ox = centerX + obs.x * scaleX;
      const oy = centerY + obs.y * scaleY;
      const r = Math.max(1.5, (obs.radius || 55) * scaleX);
      ctx.beginPath();
      ctx.arc(ox, oy, r, 0, Math.PI * 2);
      ctx.fillStyle = obs.color || '#00F5D4';
      ctx.globalAlpha = 0.65;
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // Haritadaki güçlendirme kutularını minimap'te parlak sarı noktalar olarak göster
    for (const box of renderPowerups) {
      const bx = centerX + box.x * scaleX;
      const by = centerY + box.y * scaleY;
      ctx.beginPath();
      ctx.arc(bx, by, 2.6, 0, Math.PI * 2);
      ctx.fillStyle = '#FFE066';
      ctx.fill();
    }

    for (const p of renderPlayers.values()) {
      if (!p.alive) continue;
      const px = centerX + p.renderX * scaleX;
      const py = centerY + p.renderY * scaleY;
      ctx.beginPath();
      ctx.arc(px, py, p.id === selfId ? 4 : 2.8, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      if (p.id === selfId) {
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function drawVirtualJoystick() {
    if (!joystick.active) return;

    const dx = joystick.currX - joystick.startX;
    const dy = joystick.currY - joystick.startY;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, joystick.maxRadius);
    const angle = Math.atan2(dy, dx);
    const knobX = joystick.startX + Math.cos(angle) * clampedDist;
    const knobY = joystick.startY + Math.sin(angle) * clampedDist;

    ctx.save();
    ctx.beginPath();
    ctx.arc(joystick.startX, joystick.startY, joystick.maxRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 245, 212, 0.1)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(0, 245, 212, 0.55)';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(knobX, knobY, 24, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 245, 212, 0.75)';
    ctx.shadowColor = '#00F5D4';
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.restore();
  }

  function renderLoop(time) {
    renderLobbySkinPreview(time);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of renderPlayers.values()) {
      const targetX = p.x + p.vx * 0.35;
      const targetY = p.y + p.vy * 0.35;
      p.renderX += (targetX - p.renderX) * 0.3;
      p.renderY += (targetY - p.renderY) * 0.3;
    }

    const me = renderPlayers.get(selfId);
    const followedTarget = followedPlayerId ? renderPlayers.get(followedPlayerId) : null;

    if (followedTarget && followedTarget.alive && (!me || !me.waitingForWall)) {
      camera.zoom += (camera.targetGameplayZoom - camera.zoom) * 0.08;
      camera.x += (followedTarget.renderX - camera.x) * 0.16;
      camera.y += (followedTarget.renderY - camera.y) * 0.16;
      updateMouseWorld();
      if (me && me.alive && !me.spectating) {
        sendMouseTarget();
      }
    } else if (me) {
      if (me.alive && !me.spectating && !me.waitingForWall) {
        // Geniş Kamera (wide_cam) aktifse sadece kutuyu alan oyuncunun FOV'u (kamera açısı) genişler (zoom-out)
        const desiredZoom = me.activePowerup === 'wide_cam'
          ? camera.targetGameplayZoom * (config.POWERUP_WIDE_CAM_MULTIPLIER || 0.65)
          : camera.targetGameplayZoom;
        camera.zoom += (desiredZoom - camera.zoom) * 0.08;
        camera.x += (me.renderX - camera.x) * 0.16;
        camera.y += (me.renderY - camera.y) * 0.16;

        const mySpeed = Math.hypot(me.vx, me.vy);
        if (mySpeed > 6.5) {
          window.soundManager.playCuteGiggle(Math.min(mySpeed / 13, 1));
        }
        updateMouseWorld();
        sendMouseTarget();
      } else {
        // Duvar seçimi, 5 saniye yeniden doğuş sayacı veya izleyici modunda tüm arenayı göster
        const overviewScale = Math.min(
          (canvas.width - 40) / config.ARENA_WIDTH,
          (canvas.height - 110) / config.ARENA_HEIGHT
        );
        camera.zoom += (overviewScale - camera.zoom) * 0.12;
        camera.x += (0 - camera.x) * 0.12;
        camera.y += (0 - camera.y) * 0.12;
        updateMouseWorld();
      }
    }

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    drawOpenWorldAndObstacles(time);
    drawPowerupBoxes(time);

    const targetedBeltId = me ? getTargetedOwnBeltId(me) : null;

    for (const p of renderPlayers.values()) {
      if (!p.alive) continue;
      for (const band of p.bands) {
        const isTargeted = p.id === selfId && band.id === targetedBeltId;
        drawBelt(p, band, isTargeted, time);
      }
    }

    drawSlimeArrows();

    for (let i = snapEffects.length - 1; i >= 0; i--) {
      const fx = snapEffects[i];
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.radius, 0, Math.PI * 2);
      ctx.strokeStyle = fx.color ? fx.color : `rgba(255, 42, 133, ${fx.alpha})`;
      ctx.globalAlpha = Math.max(0, fx.alpha);
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.globalAlpha = 1.0;

      fx.radius += 2.4;
      fx.alpha -= 0.06;
      if (fx.alpha <= 0) snapEffects.splice(i, 1);
    }

    for (let i = splatEffects.length - 1; i >= 0; i--) {
      const sp = splatEffects[i];
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, sp.radius, 0, Math.PI * 2);
      ctx.fillStyle = sp.color;
      ctx.globalAlpha = Math.max(0, sp.alpha);
      ctx.fill();
      ctx.globalAlpha = 1.0;

      sp.radius += 1.6;
      sp.alpha -= 0.05;
      if (sp.alpha <= 0) splatEffects.splice(i, 1);
    }

    drawKillAnimations(time);

    for (const p of renderPlayers.values()) {
      if (!p.alive) continue;
      drawJellySlime(p, time);
    }

    if (me && me.waitingForWall && !me.spectating) {
      drawWallSpawnSelector(me, time);
    }

    for (let i = floatingTexts.length - 1; i >= 0; i--) {
      const ft = floatingTexts[i];
      ctx.save();
      ctx.font = '900 18px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.fillStyle = ft.color;
      ctx.strokeStyle = '#080B12';
      ctx.lineWidth = 4;
      ctx.strokeText(ft.text, ft.x, ft.y);
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();

      ft.y += ft.vy;
      ft.alpha -= 0.022;
      if (ft.alpha <= 0) floatingTexts.splice(i, 1);
    }

    ctx.restore();

    drawMinimap();
    drawVirtualJoystick();
    drawScreenCrackOverlay(time);

    requestAnimationFrame(renderLoop);
  }

  requestAnimationFrame(renderLoop);
})();
