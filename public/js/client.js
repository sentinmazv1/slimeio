// Slime.io v2.0 - Lobi, Üyelik, Basic 10 Kostüm, Seferoğulları vs Tellioğulları Takım Odaları, Sosyal & Mobil İstemci
(() => {
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

  // Alt Menü Butonları
  const openLobbyBtn = document.getElementById('open-lobby-btn');
  const openFriendsBtn = document.getElementById('open-friends-btn');
  const myFriendCountBadge = document.getElementById('my-friend-count-badge');
  const openMyProfileBtn = document.getElementById('open-my-profile-btn');
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
  const teamLobbyInviteBtn = document.getElementById('team-lobby-invite-btn');

  // Profil & Arkadaş Modalları
  const profileModal = document.getElementById('profile-modal');
  const profileContent = document.getElementById('profile-content');
  const profileAddFriendBtn = document.getElementById('profile-add-friend-btn');
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
  const finalStandingsBody = document.getElementById('final-standings-body');
  const nextMatchCountdownEl = document.getElementById('next-match-countdown');
  const backToLobbyFromEndBtn = document.getElementById('back-to-lobby-from-end-btn');

  // Durum Değişkenleri
  let selfId = null;
  let config = window.SharedConstants.GAME_CONFIG;
  let availableColors = window.SharedConstants.SLIME_COLORS || [];
  let availableSkins = window.SharedConstants.BASIC_10_SKINS || [];
  let availableModes = window.SharedConstants.GAME_MODES || [];
  let mapObstacles = [];
  let roomsSummary = [];

  let currentUser = null; // Giriş yapmış üye bilgisi
  let selectedColor = availableColors[0] ? availableColors[0].id : '#00F5D4';
  let selectedSkin = availableSkins[0] ? availableSkins[0].id : 'crown';
  let selectedModeId = 'ffa';
  let currentRoomId = null;
  let pendingInviteData = null;

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

  leaderboardHeaderEl.addEventListener('click', () => {
    const isHidden = leaderboardListEl.style.display === 'none';
    leaderboardListEl.style.display = isHidden ? 'flex' : 'none';
  });

  const renderPlayers = new Map();
  let renderArrows = [];
  const snapEffects = [];
  const splatEffects = [];
  const floatingTexts = [];

  const stars = Array.from({ length: 140 }, () => ({
    x: (Math.random() * 2 - 1) * 2800,
    y: (Math.random() * 2 - 1) * 1900,
    r: 1 + Math.random() * 2.2,
    alpha: 0.25 + Math.random() * 0.65,
    color: ['#00F5D4', '#FF2A85', '#00BBF9', '#FFE066', '#FFFFFF'][Math.floor(Math.random() * 5)]
  }));

  // --- LOBİ, ÜYELİK & KOSTÜM ARAYÜZÜ ---
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

  function updateAuthUI() {
    if (currentUser) {
      authGuestOrMemberBox.style.display = 'none';
      loggedInUserBox.style.display = 'flex';
      memberDisplayNameEl.textContent = `@${currentUser.username}`;
      memberFullnameEl.textContent = currentUser.fullName;
      memberFriendsStatEl.textContent = `👥 ${currentUser.friendCount || 0} Arkadaş`;
      memberWinsStatEl.textContent = `🏆 ${(currentUser.stats && currentUser.stats.wins) || 0} Galibiyet`;
      myFriendCountBadge.textContent = String(currentUser.friendCount || 0);
      skinLockBadge.textContent = '✓ Üye Kostümleri Açık';
      skinLockBadge.style.color = '#00F59B';
      selectedColor = currentUser.color || selectedColor;
      selectedSkin = currentUser.skin || selectedSkin;
    } else {
      authGuestOrMemberBox.style.display = 'block';
      loggedInUserBox.style.display = 'none';
      myFriendCountBadge.textContent = '0';
      skinLockBadge.textContent = '🔒 Üyelere Özel';
      skinLockBadge.style.color = '#FFB800';
    }
    renderColorAndSkinSelectors();
    renderModesList();
  }

  function renderColorAndSkinSelectors() {
    colorPaletteContainer.innerHTML = availableColors.map((c) => {
      const isSel = c.id === selectedColor ? 'color-swatch selected' : 'color-swatch';
      return `<div class="${isSel}" style="background:${c.id}; color:${c.id};" title="${c.name}" data-color="${c.id}"></div>`;
    }).join('');

    colorPaletteContainer.querySelectorAll('.color-swatch').forEach((el) => {
      el.addEventListener('click', () => {
        if (!currentUser) {
          switchAuthTab('register');
          authFeedback.style.color = '#FFB800';
          authFeedback.textContent = '🎨 Slime rengini seçmek için lütfen hızlı üye ol veya giriş yap!';
          return;
        }
        selectedColor = el.dataset.color;
        currentUser.color = selectedColor;
        renderColorAndSkinSelectors();
        socket.emit('updateCustomization', { color: selectedColor, skin: selectedSkin });
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
          authFeedback.textContent = '👑 Basic 10 kostümden birini seçmek için lütfen hızlı üye ol veya giriş yap!';
          return;
        }
        selectedSkin = el.dataset.skin;
        currentUser.skin = selectedSkin;
        renderColorAndSkinSelectors();
        socket.emit('updateCustomization', { color: selectedColor, skin: selectedSkin });
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
      </div>`;
    }).join('');

    modesListContainer.querySelectorAll('.mode-card').forEach((el) => {
      el.addEventListener('click', () => {
        const modeId = el.dataset.mode;
        const modeObj = availableModes.find((m) => m.id === modeId);
        if (modeObj && modeObj.isTeam && !currentUser) {
          switchAuthTab('register');
          authFeedback.style.color = '#FFB800';
          authFeedback.textContent = '⚔️ Seferoğulları / Tellioğulları takım odalarına girmek için lütfen hızlı üye olun!';
          return;
        }
        selectedModeId = modeId;
        renderModesList();
      });
    });
  }

  // Üye Giriş / Kayıt İşlemleri
  doLoginBtn.addEventListener('click', () => {
    const username = loginUsernameInput.value.trim();
    const password = loginPasswordInput.value.trim();
    socket.emit('authLogin', { username, password }, (res) => {
      if (res && res.ok) {
        currentUser = res.user;
        localStorage.setItem('slimeio_creds', JSON.stringify({ username, password }));
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
        localStorage.setItem('slimeio_creds', JSON.stringify({ username, password }));
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
    selectedModeId = 'ffa';
    updateAuthUI();
  });

  // Odaya Katılma
  function enterRoom(roomId, preferredTeam = null) {
    window.soundManager.init();
    const guestName = guestNameInput.value.trim();
    if (!currentUser && guestName) {
      localStorage.setItem('slimeio_guest_name', guestName);
    }

    socket.emit('joinRoom', {
      roomId,
      guestName,
      preferredTeam
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

      if (res.isTeam && res.roomStatus === 'waiting_for_teams') {
        teamWaitingModal.style.display = 'flex';
      } else {
        teamWaitingModal.style.display = 'none';
      }
    });
  }

  joinGameBtn.addEventListener('click', () => {
    enterRoom(selectedModeId);
  });

  guestNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') enterRoom(selectedModeId);
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

  muteBtn.addEventListener('click', () => {
    const isMuted = window.soundManager.toggleMute();
    muteBtn.textContent = isMuted ? '🔇 Ses' : '🔊 Ses';
  });

  // --- PROFİL İNCELEME & ARKADAŞ SİSTEMİ ---
  window.inspectPlayerProfile = (targetId, targetUsername) => {
    socket.emit('inspectProfile', { targetId, targetUsername }, (res) => {
      if (!res || !res.ok || !res.profile) return;
      const pf = res.profile;
      const skinObj = availableSkins.find((s) => s.id === pf.skin) || { icon: '👑', name: 'Klasik' };

      profileContent.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:center; gap:12px; background:rgba(255,255,255,0.04); padding:14px; border-radius:16px;">
          <div style="width:54px; height:54px; border-radius:50%; background:${pf.color}; display:flex; align-items:center; justify-content:center; font-size:28px; box-shadow:0 0 18px ${pf.color}; border:2px solid #FFF;">
            ${skinObj.icon}
          </div>
          <div style="text-align:left;">
            <div style="font-size:18px; font-weight:900; color:#FFF;">${pf.displayName}</div>
            <div style="font-size:12px; color:#94A3B8;">${pf.fullName} ${pf.username ? '(@' + pf.username + ')' : ''}</div>
            <div style="font-size:11px; color:#00F5D4; margin-top:2px;">Kostüm: ${skinObj.icon} ${skinObj.name}</div>
          </div>
        </div>
        <div style="background:rgba(0,245,155,0.12); border:1.5px solid #00F59B; border-radius:12px; padding:10px; font-size:15px; font-weight:900; color:#00F59B;">
          👥 Arkadaş Sayısı: ${pf.friendCount || 0}
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

      if (pf.isRegistered && currentUser && pf.username !== currentUser.username) {
        profileAddFriendBtn.style.display = pf.isFriend ? 'none' : 'inline-block';
        profileAddFriendBtn.onclick = () => {
          socket.emit('addFriend', { targetUsername: pf.username }, (fRes) => {
            if (fRes && fRes.ok) {
              currentUser.friendCount = fRes.friendCount;
              updateAuthUI();
              window.inspectPlayerProfile(targetId, pf.username);
            }
          });
        };
        profileInviteBtn.style.display = pf.online ? 'inline-block' : 'none';
        profileInviteBtn.onclick = () => {
          socket.emit('sendGameInvite', { targetUsername: pf.username, roomId: currentRoomId || selectedModeId }, () => {
            profileInviteBtn.textContent = '✓ Davet Gönderildi!';
          });
        };
      } else {
        profileAddFriendBtn.style.display = 'none';
        profileInviteBtn.style.display = 'none';
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
    if (!currentUser) {
      lobbyModal.style.display = 'flex';
      switchAuthTab('register');
      authFeedback.style.color = '#FFB800';
      authFeedback.textContent = '👥 Arkadaş eklemek ve oyuna davet etmek için lütfen hızlı üye olun!';
      return;
    }
    friendActionMsg.textContent = '';
    friendsModal.style.display = 'flex';
    refreshFriendsList();
  }

  function refreshFriendsList() {
    socket.emit('getFriendsList', (res) => {
      if (!res || !res.ok) return;
      friendsCountTitle.textContent = `Toplam ${res.friendCount || 0} Arkadaş`;
      myFriendCountBadge.textContent = String(res.friendCount || 0);
      if (currentUser) currentUser.friendCount = res.friendCount || 0;

      if (!res.friends || res.friends.length === 0) {
        friendsListBox.innerHTML = `<div style="text-align:center; color:#64748B; padding:18px; font-size:13px;">Henüz arkadaşın yok. Yukarıdan kullanıcı adı yazarak veya skor tablosunda oyunculara tıklayarak arkadaş ekleyebilirsin!</div>`;
        return;
      }

      friendsListBox.innerHTML = res.friends.map((f) => {
        const statusDot = f.online
          ? `<span style="color:#00F59B; font-size:11px; font-weight:800;">● Çevrimiçi ${f.roomName ? '(' + f.roomName + ')' : ''}</span>`
          : `<span style="color:#64748B; font-size:11px;">○ Çevrimdışı</span>`;

        const inviteBtnHtml = f.online
          ? `<button class="btn-primary" style="padding:5px 10px; font-size:11px;" onclick="inviteFriendByUsername('${f.username}')">📩 Davet Et</button>`
          : '';

        return `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:10px;">
          <div style="cursor:pointer;" onclick="inspectPlayerProfile(null, '${f.username}')">
            <div style="font-weight:900; font-size:13px; color:#FFF;">@${f.username} <span style="color:#94A3B8; font-weight:600;">(${f.fullName})</span></div>
            <div>${statusDot} • <span style="font-size:11px; color:#00BBF9;">👥 ${f.friendCount} Arkadaş</span></div>
          </div>
          <div>${inviteBtnHtml}</div>
        </div>`;
      }).join('');
    });
  }

  window.inviteFriendByUsername = (username) => {
    socket.emit('sendGameInvite', { targetUsername: username, roomId: currentRoomId || selectedModeId }, (res) => {
      if (res && res.ok) {
        friendActionMsg.style.color = '#00F59B';
        friendActionMsg.textContent = `✓ @${username} oyuncusuna davet gönderildi!`;
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

  addFriendSubmitBtn.addEventListener('click', () => {
    const val = addFriendInput.value.trim().replace(/^@/, '');
    if (!val) return;
    socket.emit('addFriend', { targetUsername: val }, (res) => {
      if (res && res.ok) {
        addFriendInput.value = '';
        friendActionMsg.style.color = '#00F59B';
        friendActionMsg.textContent = `✓ ${res.targetDisplayName} arkadaş listene eklendi!`;
        refreshFriendsList();
        updateAuthUI();
      } else {
        friendActionMsg.style.color = '#FF2A85';
        friendActionMsg.textContent = (res && res.error) || 'Eklenemedi.';
      }
    });
  });

  // Gelen Oyun Daveti (Toast)
  socket.on('gameInviteReceived', (data) => {
    pendingInviteData = data;
    inviteToastText.textContent = `@${data.fromUsername} seni [${data.roomName}] odasına davet ediyor!`;
    inviteToast.style.display = 'block';
    window.soundManager.playWallAttachScream();
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

  function updateMouseWorld() {
    if (joystick.active) {
      const me = renderPlayers.get(selfId);
      if (me && me.alive) {
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
    }
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

  // --- FARE VE DOKUNMATİK KONTROLLERİ ---
  window.addEventListener('mousemove', (e) => {
    if (joystick.active) return;
    mouseScreen.x = e.clientX;
    mouseScreen.y = e.clientY;
    sendMouseTarget();
  });

  window.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('mousedown', (e) => {
    if (
      e.target.closest('button') ||
      e.target.closest('input') ||
      e.target.closest('.modal-backdrop') ||
      e.target.closest('#leaderboard') ||
      e.target.closest('#invite-toast')
    ) {
      return;
    }
    if (isTouchDevice && e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;

    window.soundManager.init();
    mouseScreen.x = e.clientX;
    mouseScreen.y = e.clientY;
    updateMouseWorld();

    const me = renderPlayers.get(selfId);
    if (!me || me.spectating) return;

    if (e.button === 0) {
      if (me.waitingForWall) {
        socket.emit('spawnAtWall', { x: mouseWorld.x, y: mouseWorld.y });
      } else if (me.alive) {
        socket.emit('shootArrow', { x: mouseWorld.x, y: mouseWorld.y });
      }
      return;
    }

    if (e.button === 2 && me.alive) {
      socket.emit('cutOwnBelt', { x: mouseWorld.x, y: mouseWorld.y });
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
      if (!touch || !me || me.spectating) return;

      if (me.waitingForWall) {
        mouseScreen.x = touch.clientX;
        mouseScreen.y = touch.clientY;
        mouseWorld.x = (mouseScreen.x - canvas.width / 2) / camera.zoom + camera.x;
        mouseWorld.y = (mouseScreen.y - canvas.height / 2) / camera.zoom + camera.y;
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
        sendMouseTarget();
      } else if (me.alive) {
        const tapWorldX = (touch.clientX - canvas.width / 2) / camera.zoom + camera.x;
        const tapWorldY = (touch.clientY - canvas.height / 2) / camera.zoom + camera.y;
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
  canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
  canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

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

  function sendMouseTarget() {
    updateMouseWorld();
    socket.emit('mouseMove', { x: mouseWorld.x, y: mouseWorld.y });
  }

  function getTargetedOwnBeltId(player) {
    if (!player || !player.alive || player.bands.length <= 1) return null;
    const lookAngle = joystick.active
      ? joystick.aimAngle
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

    const savedGuestName = localStorage.getItem('slimeio_guest_name');
    if (savedGuestName) guestNameInput.value = savedGuestName;

    const savedCredsRaw = localStorage.getItem('slimeio_creds');
    if (savedCredsRaw) {
      try {
        const creds = JSON.parse(savedCredsRaw);
        if (creds && creds.username && creds.password) {
          socket.emit('authLogin', creds, (res) => {
            if (res && res.ok) {
              currentUser = res.user;
            }
            updateAuthUI();
          });
          return;
        }
      } catch (_e) {}
    }

    updateAuthUI();
    resizeCanvas();
  });

  socket.on('roomsSummary', (list) => {
    roomsSummary = list || [];
    if (lobbyModal.style.display !== 'none') {
      renderModesList();
    }
  });

  socket.on('teamMatchCountdown', ({ seconds, message }) => {
    window.soundManager.playWallAttachScream();
    teamLobbyStatusEl.style.color = '#00F59B';
    teamLobbyStatusEl.textContent = `${message} (${seconds} sn)`;
  });

  socket.on('returnedToTeamLobby', () => {
    matchEndModal.style.display = 'none';
    teamWaitingModal.style.display = 'flex';
  });

  socket.on('bandAttached', ({ playerId }) => {
    if (playerId === selfId) {
      window.soundManager.playWallAttachScream();
      const me = renderPlayers.get(selfId);
      if (me) me.impactPulse = 1.0;
    }
  });

  socket.on('arrowShot', ({ playerId }) => {
    if (playerId === selfId) {
      window.soundManager.playArrowShoot();
    }
  });

  socket.on('arrowSplat', ({ x, y, color }) => {
    splatEffects.push({ x, y, color: color || '#00F5D4', radius: 7, alpha: 1.0 });
  });

  socket.on('bandSnapped', ({ snapX, snapY }) => {
    window.soundManager.playBandSnap();
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

  socket.on('playerDied', ({ victimId }) => {
    if (victimId === selfId) {
      window.soundManager.playDeathPop();
    }
  });

  socket.on('matchEnded', ({ isTeam, seferScore, telliScore, winnerName, winnerScore, winnerBands, standings, nextMatchIn }) => {
    overlayEl.style.display = 'none';
    spectatorBannerEl.style.display = 'none';
    matchEndModal.style.display = 'flex';
    window.soundManager.playWallAttachScream();

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
        return `<tr class="${rowClass}" style="cursor:pointer;" onclick="inspectPlayerProfile('${p.id}', '${p.username || ''}')">
          <td>${medal}</td>
          <td style="text-align:left;">
            <span class="lb-dot" style="background:${p.color}; color:${p.color}; margin-right:6px;"></span>${teamLabel}${p.name}
          </td>
          <td>${p.bandsCount}</td>
          <td>✂️ ${p.cuts}</td>
          <td>💀 ${p.kills}</td>
          <td style="text-align:right; font-weight:900; color:#FFE066;">${p.score} Puan</td>
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
    if (!state.isTeam) {
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
      } else {
        const totalCap = state.teamSize * 2;
        const curr = state.seferCount + state.telliCount;
        teamLobbyStatusEl.style.color = '#FFE066';
        teamLobbyStatusEl.textContent = `⏳ Takımların dolması bekleniyor (${curr}/${totalCap})... Dolduğunda maç otomatik başlar!`;
      }

      seferCountBadgeEl.textContent = `${state.seferCount}/${state.teamSize}`;
      telliCountBadgeEl.textContent = `${state.telliCount}/${state.teamSize}`;

      const seferPlayers = state.players.filter((p) => p.team === 'seferogullari');
      const telliPlayers = state.players.filter((p) => p.team === 'telliogullari');

      let seferHtml = '';
      for (let i = 0; i < state.teamSize; i++) {
        const p = seferPlayers[i];
        if (p) {
          seferHtml += `<div class="team-slot" style="cursor:pointer;" onclick="inspectPlayerProfile('${p.id}','${p.username || ''}')">
            <span>🟢 ${p.name} ${p.id === selfId ? '(Sen)' : ''}</span>
            <span style="color:#00F59B;">Hazır ✓</span>
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
          telliHtml += `<div class="team-slot" style="cursor:pointer;" onclick="inspectPlayerProfile('${p.id}','${p.username || ''}')">
            <span>🔴 ${p.name} ${p.id === selfId ? '(Sen)' : ''}</span>
            <span style="color:#FF2A85;">Hazır ✓</span>
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
      arrows
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
        existing.name = p.name;
        existing.username = p.username;
        existing.color = p.color;
        existing.skin = p.skin;
        existing.team = p.team;
        existing.alive = p.alive;
        existing.waitingForWall = p.waitingForWall;
        existing.spectating = p.spectating;
        existing.score = p.score;
        existing.cuts = p.cuts;
        existing.kills = p.kills;
        existing.respawnRemaining = p.respawnRemaining;
        existing.x = p.x;
        existing.y = p.y;
        existing.vx = p.vx;
        existing.vy = p.vy;
        existing.bands = p.bands;
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

      if (me.spectating) {
        overlayEl.style.display = 'none';
        spectatorBannerEl.style.display = 'block';
        spectatorBannerEl.textContent = `👀 İZLEYİCİ MODU — Oyuna başlamak için turun bitmesini bekleyiniz! Yeni turda herkesle eşit başlayacaksın (Kalan: ${mins}:${secs})`;
        myBandsEl.textContent = '⏳ Sonraki Tur Bekleniyor';
      } else if (me.waitingForWall) {
        spectatorBannerEl.style.display = 'none';
        overlayEl.style.display = 'none';
        myBandsEl.textContent = '🎯 Doğmak İçin Bir Kayaya/Duvara Dokun!';
      } else if (me.alive) {
        spectatorBannerEl.style.display = 'none';
        overlayEl.style.display = 'none';
        myBandsEl.textContent = `🔗 ${count} | 🏹 ${slimeAmmo}`;
      } else {
        spectatorBannerEl.style.display = 'none';
        overlayEl.style.display = 'block';
        overlayTitleEl.textContent = 'Son Kemerin Koptu!';
        overlaySubEl.textContent = `Yeniden doğmana: ${(me.respawnRemaining / 1000).toFixed(1)} sn`;
      }
    }

    const sorted = [...players]
      .sort((a, b) => (b.score || 0) - (a.score || 0) || b.bands.length - a.bands.length)
      .slice(0, 8);
    const topScore = Math.max(100, sorted[0] ? sorted[0].score : 100);

    leaderboardListEl.innerHTML = sorted
      .map((p, idx) => {
        const pct = Math.min(100, Math.round(((p.score || 0) / topScore) * 100));
        const isMeClass = p.id === selfId ? 'lb-row is-me' : 'lb-row';
        const ammo = Math.max(0, p.bands.length - 1);
        const teamPrefix = p.team === 'seferogullari' ? '🟢 ' : p.team === 'telliogullari' ? '🔴 ' : '';
        return `<li class="${isMeClass}" onclick="inspectPlayerProfile('${p.id}', '${p.username || ''}')">
          <div class="lb-bar" style="width:${pct}%; background:${p.color};"></div>
          <div class="lb-left">
            <span>${idx + 1}.</span>
            <span class="lb-dot" style="background:${p.color}; color:${p.color};"></span>
            <span>${teamPrefix}${p.name}</span>
          </div>
          <div class="lb-right">
            <span class="lb-badge-belt">🔗${p.bands.length} (🏹${ammo})</span>
            <span class="lb-badge-cut">✂️${p.cuts || 0}</span>
            <span class="lb-score">${p.score || 0}p</span>
          </div>
        </li>`;
      })
      .join('');
  });

  // --- BASIC 10 KOSTÜM ÇİZİM FONKSİYONU ---
  function drawSkinAccessory(targetCtx, skinId, baseR, time) {
    targetCtx.save();
    switch (skinId) {
      case 'crown': {
        // Altın Kral Tacı
        targetCtx.fillStyle = '#FFD700';
        targetCtx.strokeStyle = '#B45309';
        targetCtx.lineWidth = 2;
        targetCtx.beginPath();
        targetCtx.moveTo(-14, -baseR + 4);
        targetCtx.lineTo(-16, -baseR - 12);
        targetCtx.lineTo(-6, -baseR - 4);
        targetCtx.lineTo(0, -baseR - 15);
        targetCtx.lineTo(6, -baseR - 4);
        targetCtx.lineTo(16, -baseR - 12);
        targetCtx.lineTo(14, -baseR + 4);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.stroke();
        break;
      }
      case 'ninja': {
        // Kırmızı Ninja Bandı
        targetCtx.fillStyle = '#EF4444';
        targetCtx.fillRect(-baseR + 2, -baseR * 0.55, (baseR - 2) * 2, 7);
        targetCtx.beginPath();
        targetCtx.moveTo(-baseR + 2, -baseR * 0.45);
        targetCtx.lineTo(-baseR - 12, -baseR * 0.65 + Math.sin(time * 0.01) * 4);
        targetCtx.lineTo(-baseR - 10, -baseR * 0.25 + Math.sin(time * 0.01) * 4);
        targetCtx.closePath();
        targetCtx.fill();
        break;
      }
      case 'cyber': {
        // Siber Lazer Vizör Gözlük
        targetCtx.fillStyle = '#00F5D4';
        targetCtx.shadowColor = '#00F5D4';
        targetCtx.shadowBlur = 10;
        targetCtx.fillRect(-15, -7, 30, 8);
        targetCtx.strokeStyle = '#FFFFFF';
        targetCtx.lineWidth = 1.5;
        targetCtx.strokeRect(-15, -7, 30, 8);
        break;
      }
      case 'pirate': {
        // Korsan Şapkası
        targetCtx.fillStyle = '#1E293B';
        targetCtx.strokeStyle = '#F59E0B';
        targetCtx.lineWidth = 2;
        targetCtx.beginPath();
        targetCtx.moveTo(-20, -baseR + 4);
        targetCtx.quadraticCurveTo(0, -baseR - 18, 20, -baseR + 4);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.stroke();
        break;
      }
      case 'devil': {
        // Ateş Boynuzları
        targetCtx.fillStyle = '#FF0055';
        targetCtx.beginPath();
        targetCtx.moveTo(-14, -baseR + 4);
        targetCtx.quadraticCurveTo(-22, -baseR - 14, -8, -baseR - 12);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.beginPath();
        targetCtx.moveTo(14, -baseR + 4);
        targetCtx.quadraticCurveTo(22, -baseR - 14, 8, -baseR - 12);
        targetCtx.closePath();
        targetCtx.fill();
        break;
      }
      case 'angel': {
        // Kutsal Altın Hale
        targetCtx.strokeStyle = '#FFE066';
        targetCtx.shadowColor = '#FFE066';
        targetCtx.shadowBlur = 12;
        targetCtx.lineWidth = 3.5;
        targetCtx.beginPath();
        targetCtx.ellipse(0, -baseR - 10 + Math.sin(time * 0.006) * 2, 16, 5, 0, 0, Math.PI * 2);
        targetCtx.stroke();
        break;
      }
      case 'viking': {
        // Boynuzlu Viking Miğferi
        targetCtx.fillStyle = '#94A3B8';
        targetCtx.beginPath();
        targetCtx.arc(0, -baseR + 5, 15, Math.PI, 0);
        targetCtx.fill();
        targetCtx.strokeStyle = '#F8FAFC';
        targetCtx.lineWidth = 3;
        targetCtx.beginPath();
        targetCtx.moveTo(-14, -baseR + 2);
        targetCtx.lineTo(-22, -baseR - 10);
        targetCtx.moveTo(14, -baseR + 2);
        targetCtx.lineTo(22, -baseR - 10);
        targetCtx.stroke();
        break;
      }
      case 'wizard': {
        // Mistik Büyücü Şapkası
        targetCtx.fillStyle = '#6D28D9';
        targetCtx.strokeStyle = '#FCD34D';
        targetCtx.lineWidth = 2;
        targetCtx.beginPath();
        targetCtx.moveTo(-18, -baseR + 4);
        targetCtx.lineTo(0, -baseR - 20);
        targetCtx.lineTo(18, -baseR + 4);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.stroke();
        break;
      }
      case 'headset': {
        // RGB Oyuncu Kulaklığı
        targetCtx.strokeStyle = '#00F5D4';
        targetCtx.lineWidth = 4;
        targetCtx.beginPath();
        targetCtx.arc(0, 0, baseR + 3, Math.PI * 1.1, Math.PI * 1.9);
        targetCtx.stroke();
        targetCtx.fillStyle = '#FF2A85';
        targetCtx.fillRect(-baseR - 5, -6, 6, 14);
        targetCtx.fillRect(baseR - 1, -6, 6, 14);
        break;
      }
      case 'fez': {
        // Tosun Paşa Fesi (Seferoğulları / Tellioğulları Özel)
        targetCtx.fillStyle = '#DC2626';
        targetCtx.beginPath();
        targetCtx.moveTo(-12, -baseR + 4);
        targetCtx.lineTo(-10, -baseR - 13);
        targetCtx.lineTo(10, -baseR - 13);
        targetCtx.lineTo(12, -baseR + 4);
        targetCtx.closePath();
        targetCtx.fill();
        targetCtx.strokeStyle = '#111827';
        targetCtx.lineWidth = 2.5;
        targetCtx.beginPath();
        targetCtx.moveTo(0, -baseR - 13);
        targetCtx.lineTo(13, -baseR - 4);
        targetCtx.stroke();
        break;
      }
    }
    targetCtx.restore();
  }

  function renderLobbySkinPreview(time) {
    if (!previewCtx || lobbyModal.style.display === 'none') return;
    const w = skinPreviewCanvas.width;
    const h = skinPreviewCanvas.height;
    previewCtx.clearRect(0, 0, w, h);

    previewCtx.save();
    previewCtx.translate(w / 2, h / 2 + 12);
    const r = 26;

    previewCtx.beginPath();
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const wave = Math.sin(a * 3 + time * 0.008) * 1.6;
      const px = Math.cos(a) * (r + wave);
      const py = Math.sin(a) * (r + wave);
      if (i === 0) previewCtx.moveTo(px, py);
      else previewCtx.lineTo(px, py);
    }
    previewCtx.closePath();
    previewCtx.fillStyle = selectedColor;
    previewCtx.shadowColor = selectedColor;
    previewCtx.shadowBlur = 14;
    previewCtx.fill();
    previewCtx.shadowBlur = 0;
    previewCtx.lineWidth = 2;
    previewCtx.strokeStyle = '#FFFFFF';
    previewCtx.stroke();

    // Gözler
    for (const s of [-1, 1]) {
      previewCtx.beginPath();
      previewCtx.arc(s * 7, -2, 4.5, 0, Math.PI * 2);
      previewCtx.fillStyle = '#FFF';
      previewCtx.fill();
      previewCtx.beginPath();
      previewCtx.arc(s * 7 + 1, -2, 2.2, 0, Math.PI * 2);
      previewCtx.fillStyle = '#080B12';
      previewCtx.fill();
    }

    drawSkinAccessory(previewCtx, selectedSkin, r, time);
    previewCtx.restore();
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

    ctx.save();
    ctx.beginPath();
    ctx.arc(x1, y1, 7, 0, Math.PI * 2);
    ctx.fillStyle = player.color;
    ctx.shadowColor = player.color;
    ctx.shadowBlur = 10;
    ctx.fill();

    ctx.beginPath();
    if (isTargetedForRightClick) {
      ctx.setLineDash([12, 6]);
      ctx.lineWidth = 5.5;
      ctx.strokeStyle = '#FFFFFF';
      ctx.shadowColor = '#FFFFFF';
      ctx.shadowBlur = 14;
    } else {
      ctx.lineWidth = 3.4;
      ctx.strokeStyle = player.color;
      ctx.shadowColor = player.color;
      ctx.shadowBlur = 8;
      ctx.globalAlpha = 0.85;
    }
    ctx.moveTo(x1, y1);
    ctx.quadraticCurveTo(midX, midY, x2, y2);
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }

  function drawSlimeArrows() {
    for (const a of renderArrows) {
      const angle = Math.atan2(a.vy, a.vx);
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(angle);

      ctx.shadowColor = a.color;
      ctx.shadowBlur = 14;

      ctx.beginPath();
      ctx.moveTo(17, 0);
      ctx.quadraticCurveTo(0, 9, -15, 5);
      ctx.lineTo(-10, 0);
      ctx.lineTo(-15, -5);
      ctx.quadraticCurveTo(0, -9, 17, 0);
      ctx.closePath();

      ctx.fillStyle = a.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();
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

    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(preview.spawnX, preview.spawnY, config.PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = me.color || '#00F5D4';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();
    ctx.restore();
  }

  function drawJellySlime(player, time) {
    const speed = Math.hypot(player.vx, player.vy);
    const moveAngle = speed > 0.2 ? Math.atan2(player.vy, player.vx) : 0;

    const stretch = 1 + Math.min(speed * 0.032, 0.38) + player.impactPulse * 0.25;
    const squash = 1 / Math.sqrt(stretch);
    player.impactPulse *= 0.88;

    ctx.save();
    ctx.translate(player.renderX, player.renderY);
    ctx.rotate(moveAngle);
    ctx.scale(stretch, squash);

    const baseR = config.PLAYER_RADIUS;
    const points = 16;
    ctx.beginPath();
    for (let i = 0; i <= points; i++) {
      const a = (i / points) * Math.PI * 2;
      const jellyWave = Math.sin(a * 3 + time * 0.008 + player.wobblePhase) * 1.8;
      const r = baseR + jellyWave;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    ctx.shadowColor = player.color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = player.color;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(-baseR * 0.28, -baseR * 0.32, baseR * 0.28, baseR * 0.15, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(player.renderX, player.renderY);
    const lookAngle =
      player.id === selfId
        ? joystick.active
          ? joystick.aimAngle
          : Math.atan2(mouseWorld.y - player.renderY, mouseWorld.x - player.renderX)
        : moveAngle;
    const lookX = Math.cos(lookAngle) * 4;
    const lookY = Math.sin(lookAngle) * 4;

    for (const side of [-1, 1]) {
      const ex = side * 6.5 + lookX * 0.6;
      const ey = -2 + lookY * 0.6;

      ctx.beginPath();
      ctx.arc(ex, ey, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(ex + lookX * 0.3, ey + lookY * 0.3, 2.3, 0, Math.PI * 2);
      ctx.fillStyle = '#080B12';
      ctx.fill();
    }

    // Seçili Basic 10 Kostümünü Çiz
    drawSkinAccessory(ctx, player.skin || 'crown', baseR, time);

    const ammo = Math.max(0, player.bands.length - 1);
    const familyPrefix = player.team === 'seferogullari'
      ? '[SEFER] '
      : player.team === 'telliogullari'
        ? '[TELLİ] '
        : '';

    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#F8F9FA';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 6;
    ctx.fillText(`${familyPrefix}${player.name} [🔗${player.bands.length} | 🏹${ammo}]`, 0, baseR + 20);
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
    if (me) {
      if (me.spectating) {
        // İzleyici modunda lider oyuncuyu veya arenayı izlet
        let leader = null;
        for (const p of renderPlayers.values()) {
          if (p.alive && (!leader || (p.score || 0) > (leader.score || 0))) {
            leader = p;
          }
        }
        const targetZoom = camera.targetGameplayZoom * 0.75;
        camera.zoom += (targetZoom - camera.zoom) * 0.08;
        const tx = leader ? leader.renderX : 0;
        const ty = leader ? leader.renderY : 0;
        camera.x += (tx - camera.x) * 0.08;
        camera.y += (ty - camera.y) * 0.08;
      } else if (me.waitingForWall) {
        const overviewScale = Math.min(
          (canvas.width - 40) / config.ARENA_WIDTH,
          (canvas.height - 110) / config.ARENA_HEIGHT
        );
        camera.zoom += (overviewScale - camera.zoom) * 0.12;
        camera.x += (0 - camera.x) * 0.12;
        camera.y += (0 - camera.y) * 0.12;
      } else if (me.alive) {
        camera.zoom += (camera.targetGameplayZoom - camera.zoom) * 0.08;
        camera.x += (me.renderX - camera.x) * 0.14;
        camera.y += (me.renderY - camera.y) * 0.14;

        const mySpeed = Math.hypot(me.vx, me.vy);
        if (mySpeed > 6.5) {
          window.soundManager.playCuteGiggle(Math.min(mySpeed / 13, 1));
        }
      }
      sendMouseTarget();
    }

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    drawOpenWorldAndObstacles(time);

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
      ctx.strokeStyle = `rgba(255, 42, 133, ${fx.alpha})`;
      ctx.lineWidth = 4;
      ctx.stroke();

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

    requestAnimationFrame(renderLoop);
  }

  requestAnimationFrame(renderLoop);
})();
