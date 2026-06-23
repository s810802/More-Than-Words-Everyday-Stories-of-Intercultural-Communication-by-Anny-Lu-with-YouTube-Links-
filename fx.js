/* ============================================================
   視覺特效 + API 設定模組
   ============================================================ */
(function () {
  'use strict';

  /* ==================== Canvas 粒子引擎 ==================== */
  var canvas, ctx, particles = [], animFrame = null, activeFx = {};
  var STORAGE_KEY_FX  = 'hermes-fx';
  var STORAGE_KEY_API = 'hermes-api';

  var FX_DEFS = {
    snow: {
      chars: ['\u2744','\u2745','\u2746','\u273b','\u2022'],
      speed: [0.6, 1.6], size: [12, 22], swing: 0.4
    },
    sakura: {
      chars: ['\uD83C\uDF38','\uD83C\uDF3A','\uD83C\uDF3C','\uD83D\uDCAE'],
      speed: [0.5, 1.4], size: [14, 22], swing: 0.6
    },
    stars: {
      chars: ['\u2726','\u2727','\u22C6','\u2605','\u2606'],
      speed: [0.3, 1.2], size: [10, 20], swing: 0.2
    },
    firework: {
      chars: ['\u2728','\u2B50','\u26A1','\uD83D\uDCA5'],
      speed: [0.8, 2.0], size: [14, 24], swing: 0.5
    }
  };

  function ensureCanvas() {
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'fxCanvas';
      canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
      document.body.appendChild(canvas);
      ctx = canvas.getContext('2d');
      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);
    }
  }

  function resizeCanvas() {
    if (canvas) { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  }

  function createParticle(fxKey) {
    var def = FX_DEFS[fxKey];
    return {
      fx: fxKey,
      x: Math.random() * window.innerWidth,
      y: -30,
      char: def.chars[Math.floor(Math.random() * def.chars.length)],
      size: def.size[0] + Math.random() * (def.size[1] - def.size[0]),
      speed: def.speed[0] + Math.random() * (def.speed[1] - def.speed[0]),
      swing: def.swing,
      swingOffset: Math.random() * Math.PI * 2,
      alpha: 0.55 + Math.random() * 0.45,
      rotation: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.04
    };
  }

  function animateParticles() {
    var anyActive = Object.keys(activeFx).some(function (k) { return activeFx[k]; });
    if (!anyActive) { animFrame = null; return; }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    var now = Date.now() / 1000;

    Object.keys(activeFx).forEach(function (fxKey) {
      if (!activeFx[fxKey]) return;
      if (Math.random() < 0.35) particles.push(createParticle(fxKey));
    });

    particles = particles.filter(function (p) {
      p.y += p.speed;
      p.x += Math.sin(now * 1.2 + p.swingOffset) * p.swing;
      p.rotation += p.rotSpeed;
      if (p.y > window.innerHeight + 40) return false;
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.font = p.size + 'px serif';
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillText(p.char, -p.size / 2, p.size / 2);
      ctx.restore();
      return true;
    });

    animFrame = requestAnimationFrame(animateParticles);
  }

  function toggleFx(fxKey) {
    var isOn = activeFx[fxKey];

    // 關掉所有特效（單選模式）
    ['snow', 'sakura', 'stars', 'firework'].forEach(function (k) {
      activeFx[k] = false;
      updateFxUI(k);
    });
    particles = [];

    // 如果原本是關閉的，就開啟它；若原本開啟就保持全關（toggle off）
    if (!isOn) {
      activeFx[fxKey] = true;
      updateFxUI(fxKey);
      ensureCanvas();
      if (!animFrame) animFrame = requestAnimationFrame(animateParticles);
    }

    saveFxState();
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function updateFxUI(fxKey) {
    var card  = document.getElementById('fx' + cap(fxKey));
    var badge = document.getElementById('fx' + cap(fxKey) + 'Badge');
    if (!card || !badge) return;
    if (activeFx[fxKey]) {
      card.classList.add('active');
      badge.textContent = '\u958B\u555F';
    } else {
      card.classList.remove('active');
      badge.textContent = '\u95DC\u9589';
    }
  }

  function saveFxState() {
    localStorage.setItem(STORAGE_KEY_FX, JSON.stringify(activeFx));
  }

  function restoreFxState() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY_FX) || '{}');
      Object.keys(saved).forEach(function (k) {
        if (saved[k] && FX_DEFS[k]) {
          activeFx[k] = true;
          ensureCanvas();
        }
      });
      Object.keys(activeFx).forEach(function (k) { updateFxUI(k); });
      if (Object.keys(activeFx).some(function (k) { return activeFx[k]; })) {
        if (!animFrame) animFrame = requestAnimationFrame(animateParticles);
      }
    } catch (e) { /* ignore */ }
  }

  /* ==================== API 設定 ==================== */
  function initApiSettings() {
    var urlInput = document.getElementById('apiUrl');
    var keyInput = document.getElementById('apiKey');
    var eyeBtn   = document.getElementById('apiKeyToggle');
    var testBtn  = document.getElementById('apiTestBtn');
    var saveBtn  = document.getElementById('apiSaveBtn');
    var statusEl = document.getElementById('apiStatus');
    if (!urlInput) return;

    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY_API) || '{}');
      if (saved.url) urlInput.value = saved.url;
      if (saved.key) keyInput.value = saved.key;
    } catch (e) { /* ignore */ }

    if (eyeBtn) {
      eyeBtn.addEventListener('click', function () {
        if (keyInput.type === 'password') {
          keyInput.type = 'text'; eyeBtn.textContent = '\uD83D\uDE48';
        } else {
          keyInput.type = 'password'; eyeBtn.textContent = '\uD83D\uDC41';
        }
      });
    }

    if (testBtn) {
      testBtn.addEventListener('click', function () {
        var url = urlInput.value.trim();
        var key = keyInput.value.trim();
        if (!url) { showStatus(statusEl, '\u8ACB\u8F38\u5165 API \u7DB2\u5740', 'error'); return; }
        testBtn.disabled = true;
        testBtn.innerHTML = '\u23F3 \u6E2C\u8A66\u4E2D...';
        showStatus(statusEl, '\u6B63\u5728\u9023\u7DDA\u5230 API...', 'loading');

        var modelsUrl = url.replace('/chat/completions', '/models');
        fetch(modelsUrl, { headers: { 'Authorization': 'Bearer ' + key } })
          .then(function (r) {
            if (r.ok) return r.json();
            throw new Error('HTTP ' + r.status);
          })
          .then(function () {
            showStatus(statusEl, '\u2705 \u9023\u7DDA\u6210\u529F\uFF01API \u6B63\u5E38\u904B\u4F5C\u4E2D', 'success');
            testBtn.textContent = '\u2705 \u9023\u7DDA\u6210\u529F';
          })
          .catch(function (err) {
            showStatus(statusEl, '\u274C \u9023\u7DDA\u5931\u6557\uFF1A' + err.message, 'error');
            testBtn.textContent = '\u274C \u5931\u6557';
          })
          .finally
            ? fetch(modelsUrl, { headers: { 'Authorization': 'Bearer ' + key } }).catch(function(){})
            : void 0;

        setTimeout(function () {
          testBtn.disabled = false;
          testBtn.innerHTML = '\uD83D\uDD0C \u6E2C\u8A66\u9023\u7DDA';
        }, 4000);
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        localStorage.setItem(STORAGE_KEY_API, JSON.stringify({
          url: urlInput.value.trim(),
          key: keyInput.value.trim()
        }));
        showStatus(statusEl, '\u2705 \u8A2D\u5B9A\u5DF2\u5132\u5B58\uFF01', 'success');
        setTimeout(function () {
          statusEl.className = 'api-status';
          statusEl.textContent = '';
        }, 2500);
      });
    }
  }

  function showStatus(el, msg, type) {
    if (!el) return;
    el.textContent = msg;
    el.className = 'api-status ' + type;
  }

  /* ==================== FX 按鈕事件 ==================== */
  function initFxButtons() {
    ['snow', 'sakura', 'stars', 'firework'].forEach(function (fxKey) {
      var el = document.getElementById('fx' + cap(fxKey));
      if (el) {
        el.addEventListener('click', function () { toggleFx(fxKey); });
      }
    });
  }

  /* ==================== 初始化 ==================== */
  function initExtras() {
    initFxButtons();
    initApiSettings();
    restoreFxState();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExtras);
  } else {
    initExtras();
  }

})();
