/* ============================================================
   AI 對話視窗模組
   支援 OpenAI 與 Google Gemini
   ============================================================ */
(function () {
  'use strict';

  var STORAGE_KEY_CHAT = 'site-chat-config';
  var provider = 'openai';
  var apiKey = '';
  var chatHistory = [];
  var isLoading = false;

  var SYSTEM_PROMPT = '你是本教學網站的 AI 助理。請根據網站主題回答訪客提問，使用繁體中文，語氣親切友善。';

  /* ==================== DOM ==================== */
  function $(id) { return document.getElementById(id); }

  /* ==================== Provider 選擇 ==================== */
  function initProviderGrid() {
    var grid = $('providerGrid');
    if (!grid) return;
    grid.addEventListener('click', function (e) {
      var btn = e.target.closest('.provider-card');
      if (!btn) return;
      provider = btn.getAttribute('data-provider');
      grid.querySelectorAll('.provider-card').forEach(function (c) {
        c.classList.toggle('active', c === btn);
      });
      saveConfig();
      updateProviderLabel();
    });
  }

  function updateProviderLabel() {
    var el = $('chatProviderLabel');
    if (!el) return;
    if (!apiKey) {
      el.textContent = '請先在設定面板輸入 API Key';
    } else if (provider === 'openai') {
      el.textContent = 'OpenAI GPT-4o — 已連線';
    } else {
      el.textContent = 'Google Gemini 2.0 — 已連線';
    }
  }

  /* ==================== API Key 設定 ==================== */
  function initApiSettings() {
    var keyInput  = $('apiKey');
    var eyeBtn    = $('apiKeyToggle');
    var saveBtn   = $('apiSaveBtn');
    var statusEl  = $('apiStatus');
    if (!keyInput) return;

    // 還原
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY_CHAT) || '{}');
      if (saved.provider) {
        provider = saved.provider;
        var grid = $('providerGrid');
        if (grid) {
          grid.querySelectorAll('.provider-card').forEach(function (c) {
            c.classList.toggle('active', c.getAttribute('data-provider') === provider);
          });
        }
      }
      if (saved.apiKey) {
        apiKey = saved.apiKey;
        keyInput.value = saved.apiKey;
      }
    } catch (e) { /* ignore */ }

    updateProviderLabel();

    // 顯示/隱藏 Key
    if (eyeBtn) {
      eyeBtn.addEventListener('click', function () {
        keyInput.type = keyInput.type === 'password' ? 'text' : 'password';
        eyeBtn.textContent = keyInput.type === 'password' ? '\uD83D\uDC41' : '\uD83D\uDE48';
      });
    }

    // 儲存
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        apiKey = keyInput.value.trim();
        saveConfig();
        updateProviderLabel();
        if (statusEl) {
          statusEl.textContent = '\u2705 \u5DF2\u5132\u5B58\uFF01';
          statusEl.className = 'api-status success';
          setTimeout(function () { statusEl.textContent = ''; statusEl.className = 'api-status'; }, 2000);
        }
        // 自動開啟聊天視窗
        openChat();
      });
    }
  }

  function saveConfig() {
    localStorage.setItem(STORAGE_KEY_CHAT, JSON.stringify({ provider: provider, apiKey: apiKey }));
  }

  /* ==================== 聊天視窗 ==================== */
  function initChatWindow() {
    var fab        = $('chatFab');
    var win        = $('chatWindow');
    var closeBtn   = $('chatCloseBtn');
    var clearBtn   = $('chatClearBtn');
    var sendBtn    = $('chatSendBtn');
    var inputEl    = $('chatInput');
    if (!fab || !win) return;

    fab.addEventListener('click', function () {
      win.classList.contains('open') ? closeChat() : openChat();
    });
    if (closeBtn) closeBtn.addEventListener('click', closeChat);
    if (clearBtn) clearBtn.addEventListener('click', clearChat);

    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
    if (inputEl) {
      inputEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
        // auto resize
        setTimeout(function () {
          inputEl.style.height = 'auto';
          inputEl.style.height = Math.min(inputEl.scrollHeight, 100) + 'px';
        }, 0);
      });
    }
  }

  function openChat() {
    var win = $('chatWindow');
    if (win) win.classList.add('open');
  }

  function closeChat() {
    var win = $('chatWindow');
    if (win) win.classList.remove('open');
  }

  function clearChat() {
    chatHistory = [];
    var msgs = $('chatMessages');
    if (msgs) {
      msgs.innerHTML = '<div class="chat-msg assistant"><div class="chat-bubble">\uD83E\uDDF9 \u5C0D\u8A71\u5DF2\u6E05\u9664\uFF01\u53EF\u4EE5\u91CD\u65B0\u958B\u59CB\u554F\u554F\u984C\u5566\uFF01</div></div>';
    }
  }

  function appendMsg(role, text) {
    var msgs = $('chatMessages');
    if (!msgs) return null;
    var div = document.createElement('div');
    div.className = 'chat-msg ' + role;
    var bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.textContent = text;
    div.appendChild(bubble);
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return bubble;
  }

  function showTyping() {
    var msgs = $('chatMessages');
    if (!msgs) return null;
    var div = document.createElement('div');
    div.className = 'chat-msg thinking';
    div.id = 'typingIndicator';
    div.innerHTML = '<div class="chat-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>';
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return div;
  }

  function removeTyping() {
    var el = $('typingIndicator');
    if (el) el.remove();
  }

  /* ==================== 傳送訊息 ==================== */
  function sendMessage() {
    var inputEl = $('chatInput');
    var sendBtn = $('chatSendBtn');
    if (!inputEl || isLoading) return;

    var text = inputEl.value.trim();
    if (!text) return;

    if (!apiKey) {
      appendMsg('assistant', '\u26A0\uFE0F \u8ACB\u5148\u5728\u8A2D\u5B9A\u9762\u677F\u9078\u64C7 AI \u63D0\u4F9B\u5546\u4E26\u8F38\u5165 API Key\uFF01');
      return;
    }

    inputEl.value = '';
    inputEl.style.height = 'auto';
    appendMsg('user', text);
    chatHistory.push({ role: 'user', content: text });

    isLoading = true;
    if (sendBtn) sendBtn.disabled = true;
    var typing = showTyping();

    (provider === 'gemini' ? callGemini(text) : callOpenAI())
      .then(function (reply) {
        removeTyping();
        appendMsg('assistant', reply);
        chatHistory.push({ role: 'assistant', content: reply });
      })
      .catch(function (err) {
        removeTyping();
        appendMsg('assistant', '\u274C \u767C\u751F\u932F\u8AA4\uFF1A' + err.message);
      })
      .finally(function () {
        isLoading = false;
        if (sendBtn) sendBtn.disabled = false;
        var msgs = $('chatMessages');
        if (msgs) msgs.scrollTop = msgs.scrollHeight;
      });
  }

  /* ==================== OpenAI ==================== */
  function callOpenAI() {
    var messages = [{ role: 'system', content: SYSTEM_PROMPT }].concat(chatHistory);
    return fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7
      })
    })
    .then(function (r) {
      if (!r.ok) return r.json().then(function (d) { throw new Error((d.error && d.error.message) || 'HTTP ' + r.status); });
      return r.json();
    })
    .then(function (d) {
      return d.choices[0].message.content;
    });
  }

  /* ==================== Google Gemini ==================== */
  function callGemini(userText) {
    var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + apiKey;
    var contents = [];

    // 加入歷史（Gemini 格式：user/model 交替）
    for (var i = 0; i < chatHistory.length - 1; i++) {
      contents.push({
        role: chatHistory[i].role === 'user' ? 'user' : 'model',
        parts: [{ text: chatHistory[i].content }]
      });
    }
    // 最後一則是剛加進去的 user 訊息
    contents.push({ role: 'user', parts: [{ text: userText }] });

    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: contents,
        generationConfig: { maxOutputTokens: 1000, temperature: 0.7 }
      })
    })
    .then(function (r) {
      if (!r.ok) return r.json().then(function (d) { throw new Error((d.error && d.error.message) || 'HTTP ' + r.status); });
      return r.json();
    })
    .then(function (d) {
      return d.candidates[0].content.parts[0].text;
    });
  }

  /* ==================== 初始化 ==================== */
  function init() {
    initProviderGrid();
    initApiSettings();
    initChatWindow();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
