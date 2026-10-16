// Slime.io - Masaüstü + Mobil Dokunmatik (Sanal Joystick & Çoklu Dokunuş) Uyumlu İstemci
(() => {
  const socket = io({
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 500
  });
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const timerEl = document.getElementById('timer');
  const myScoreEl = document.getElementById('my-score');
  const myBandsEl = document.getElementById('my-bands');
  const netStatusEl = document.getElementById('net-status');
  const leaderboardHeaderEl = document.getElementById('leaderboard-header');
  const leaderboardListEl = document.getElementById('leaderboard-list');
  const overlayEl = document.getElementById('overlay-msg');
  const overlayTitleEl = document.getElementById('overlay-title');
  const overlaySubEl = document.getElementById('overlay-sub');
  const nameInput = document.getElementById('name-input');
  const nameBtn = document.getElementById('name-btn');
  const addBotBtn = document.getElementById('add-bot-btn');
  const remBotBtn = document.getElementById('rem-bot-btn');
  const endMatchBtn = document.getElementById('end-match-btn');
  const muteBtn = document.getElementById('mute-btn');

  const mobileActionBtns = document.getElementById('mobile-action-btns');
  const mobShootBtn = document.getElementById('mob-shoot-btn');
  const mobCutBtn = document.getElementById('mob-cut-btn');

  const matchEndModal = document.getElementById('match-end-modal');
  const winnerTitleEl = document.getElementById('winner-title');
  const winnerSubtitleEl = document.getElementById('winner-subtitle');
  const finalStandingsBody = document.getElementById('final-standings-body');
  const nextMatchCountdownEl = document.getElementById('next-match-countdown');
  const playAgainBtn = document.getElementById('play-again-btn');

  let selfId = null;
  let config = window.SharedConstants.GAME_CONFIG;
  let mapObstacles = [];
  let countdownInterval = null;
  let currentPingMs = 1;
  let totalOnline = 1;

  // Mobil / Dokunmatik Durumu ve Sanal Joystick
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

  // Mobilde skor tablosu başlığına dokununca aç/kapat
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
    // Mobil ekranlarda görüş alanının daralmaması için ekran boyutuna duyarlı kamera zoom'u
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
          spawnY: obs.y + ny * (approxR + config.PLAYER_RADIUS + 18),
          wallName: 'NEON SİPER / KRİSTAL'
        };
      }
    }

    const dTop = Math.abs(cy - (-halfH));
    const dBottom = Math.abs(cy - halfH);
    const dLeft = Math.abs(cx - (-halfW));
    const dRight = Math.abs(cx - halfW);

    if (dTop < bestDist) {
      bestDist = dTop;
      best = { anchorX: cx, anchorY: -halfH, spawnX: cx, spawnY: -halfH + config.PLAYER_RADIUS + 18, wallName: 'KUZEY DUVARI' };
    }
    if (dBottom < bestDist) {
      bestDist = dBottom;
      best = { anchorX: cx, anchorY: halfH, spawnX: cx, spawnY: halfH - config.PLAYER_RADIUS - 18, wallName: 'GÜNEY DUVARI' };
    }
    if (dLeft < bestDist) {
      bestDist = dLeft;
      best = { anchorX: -halfW, anchorY: cy, spawnX: -halfW + config.PLAYER_RADIUS + 18, spawnY: cy, wallName: 'BATI DUVARI' };
    }
    if (dRight < bestDist) {
      best = { anchorX: halfW, anchorY: cy, spawnX: halfW - config.PLAYER_RADIUS - 18, spawnY: cy, wallName: 'DOĞU DUVARI' };
    }

    return best || { anchorX: 0, anchorY: -halfH, spawnX: 0, spawnY: -halfH + 40, wallName: 'DUVAR' };
  }

  // --- MASAÜSTÜ FARE KONTROLLERİ ---
  window.addEventListener('mousemove', (e) => {
    if (joystick.active) return;
    mouseScreen.x = e.clientX;
    mouseScreen.y = e.clientY;
    sendMouseTarget();
  });

  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  window.addEventListener('mousedown', (e) => {
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('#leaderboard-header')) return;
    if (isTouchDevice && e.sourceCapabilities && e.sourceCapabilities.firesTouchEvents) return;

    window.soundManager.init();
    mouseScreen.x = e.clientX;
    mouseScreen.y = e.clientY;
    updateMouseWorld();

    const me = renderPlayers.get(selfId);
    if (!me) return;

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

  // --- MOBİL DOKUNMATİK (TOUCH) VE SANAL JOYSTICK KONTROLLERİ ---
  canvas.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      window.soundManager.init();
      mobileActionBtns.style.display = 'flex';

      const me = renderPlayers.get(selfId);
      const touch = e.changedTouches[0];
      if (!touch) return;

      // 1) Eğer oyuncu doğmak için duvar seçiyorsa: dokunduğu en yakın kayada/duvarda doğ!
      if (me && me.waitingForWall) {
        mouseScreen.x = touch.clientX;
        mouseScreen.y = touch.clientY;
        mouseWorld.x = (mouseScreen.x - canvas.width / 2) / camera.zoom + camera.x;
        mouseWorld.y = (mouseScreen.y - canvas.height / 2) / camera.zoom + camera.y;
        socket.emit('spawnAtWall', { x: mouseWorld.x, y: mouseWorld.y });
        return;
      }

      // 2) Eğer joystick henüz aktif değilse ilk parmağı Sanal Joystick olarak ata
      if (!joystick.active) {
        joystick.active = true;
        joystick.touchId = touch.identifier;
        joystick.startX = touch.clientX;
        joystick.startY = touch.clientY;
        joystick.currX = touch.clientX;
        joystick.currY = touch.clientY;
        sendMouseTarget();
      } else if (me && me.alive) {
        // İkinci parmakla ekranda bir noktaya dokunulduysa doğrudan o noktaya Slime Oku fırlat!
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

  // Mobil "🏹 OK AT" Butonu: Baktığı yöne (veya en yakın rakibe) Slime Oku fırlatır
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

  // Mobil "✂️ KOPAR" Butonu: Baktığı yöndeki kendi kemerini koparır
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

  nameBtn.addEventListener('click', () => {
    window.soundManager.init();
    socket.emit('setName', nameInput.value);
    nameInput.blur();
  });

  addBotBtn.addEventListener('click', () => {
    window.soundManager.init();
    socket.emit('addBot');
  });

  remBotBtn.addEventListener('click', () => {
    window.soundManager.init();
    socket.emit('removeBot');
  });

  endMatchBtn.addEventListener('click', () => {
    window.soundManager.init();
    socket.emit('endMatchNow');
  });

  playAgainBtn.addEventListener('click', () => {
    window.soundManager.init();
    socket.emit('restartMatchNow');
  });

  muteBtn.addEventListener('click', () => {
    const isMuted = window.soundManager.toggleMute();
    muteBtn.textContent = isMuted ? '🔇 Ses' : '🔊 Ses';
  });

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
    config = data.config;
    mapObstacles = data.obstacles || [];
    resizeCanvas();
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
    snapEffects.push({
      x: snapX,
      y: snapY,
      radius: 8,
      alpha: 1.0
    });
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

  socket.on('matchEnded', ({ winnerName, winnerScore, winnerBands, standings, nextMatchIn }) => {
    overlayEl.style.display = 'none';
    matchEndModal.style.display = 'flex';
    window.soundManager.playWallAttachScream();

    winnerTitleEl.textContent = `👑 Şampiyon: ${winnerName}`;
    winnerSubtitleEl.textContent = `${winnerScore} Toplam Puan • ${winnerBands} Aktif Kemer`;

    finalStandingsBody.innerHTML = (standings || [])
      .slice(0, 8)
      .map((p, idx) => {
        const medal = idx === 0 ? '🥇 1.' : idx === 1 ? '🥈 2.' : idx === 2 ? '🥉 3.' : `${idx + 1}.`;
        const rowClass = p.id === selfId ? 'me-row' : '';
        return `<tr class="${rowClass}">
          <td>${medal}</td>
          <td style="text-align:left;">
            <span class="lb-dot" style="background:${p.color}; color:${p.color}; margin-right:6px;"></span>${p.name}
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
    overlayEl.style.display = 'none';
  });

  socket.on('stateUpdate', ({ isMatchOver: serverMatchOver, onlineCount, remainingSec, players, arrows }) => {
    totalOnline = onlineCount || players.length;
    netStatusEl.textContent = `🌐 ${totalOnline} Oyuncu | ⚡ ${currentPingMs} ms`;

    const mins = String(Math.floor(remainingSec / 60)).padStart(2, '0');
    const secs = String(remainingSec % 60).padStart(2, '0');
    timerEl.textContent = `${mins}:${secs}`;

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
        existing.color = p.color;
        existing.alive = p.alive;
        existing.waitingForWall = p.waitingForWall;
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
    if (me && !serverMatchOver) {
      const count = me.bands.length;
      const slimeAmmo = Math.max(0, count - 1);
      myScoreEl.textContent = `Puan: ${me.score || 0}`;

      if (me.waitingForWall) {
        overlayEl.style.display = 'none';
        myBandsEl.textContent = '🎯 Doğmak İçin Bir Kayaya/Duvara Dokun!';
      } else if (me.alive) {
        overlayEl.style.display = 'none';
        myBandsEl.textContent = `🔗 ${count} | 🏹 ${slimeAmmo}`;
      } else {
        overlayEl.style.display = 'block';
        overlayTitleEl.textContent = 'Son Kemerin Koptu!';
        overlaySubEl.textContent = `Yeniden doğmana: ${(me.respawnRemaining / 1000).toFixed(1)} sn`;
      }
    }

    const sorted = [...players].sort((a, b) => (b.score || 0) - (a.score || 0) || b.bands.length - a.bands.length).slice(0, 8);
    const topScore = Math.max(100, sorted[0] ? sorted[0].score : 100);

    leaderboardListEl.innerHTML = sorted
      .map((p, idx) => {
        const pct = Math.min(100, Math.round(((p.score || 0) / topScore) * 100));
        const isMeClass = p.id === selfId ? 'lb-row is-me' : 'lb-row';
        const ammo = Math.max(0, p.bands.length - 1);
        return `<li class="${isMeClass}">
          <div class="lb-bar" style="width:${pct}%; background:${p.color};"></div>
          <div class="lb-left">
            <span>${idx + 1}.</span>
            <span class="lb-dot" style="background:${p.color}; color:${p.color};"></span>
            <span>${p.name}</span>
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

  // --- GÖRSELLEŞTİRME ---
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

    const ammo = Math.max(0, player.bands.length - 1);
    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#F8F9FA';
    ctx.shadowColor = '#000000';
    ctx.shadowBlur = 6;
    ctx.fillText(`${player.name} [🔗${player.bands.length} | 🏹${ammo}]`, 0, baseR + 20);
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

  // Mobil Sanal Joystick Çizimi
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
    // Dış Halka
    ctx.beginPath();
    ctx.arc(joystick.startX, joystick.startY, joystick.maxRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 245, 212, 0.1)';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(0, 245, 212, 0.55)';
    ctx.stroke();

    // İç Topuz (Thumbstick)
    ctx.beginPath();
    ctx.arc(knobX, knobY, 24, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 245, 212, 0.75)';
    ctx.shadowColor = '#00F5D4';
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.restore();
  }

  function renderLoop(time) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of renderPlayers.values()) {
      const targetX = p.x + p.vx * 0.35;
      const targetY = p.y + p.vy * 0.35;
      p.renderX += (targetX - p.renderX) * 0.3;
      p.renderY += (targetY - p.renderY) * 0.3;
    }

    const me = renderPlayers.get(selfId);
    if (me) {
      if (me.waitingForWall) {
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

    if (me && me.waitingForWall) {
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
