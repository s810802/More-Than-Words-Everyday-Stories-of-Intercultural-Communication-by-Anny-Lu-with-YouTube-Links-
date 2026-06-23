/**
 * 側邊欄導覽網站 — 互動邏輯
 * 導覽切換、Markdown 渲染、響應式選單、程式碼複製
 * 側邊欄拖拉調整、設定面板、文字大小切換
 */

(function () {
  'use strict';

  // --- DOM Elements ---
  const navList = document.getElementById('navList');
  const contentInner = document.getElementById('contentInner');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  const menuToggle = document.getElementById('menuToggle');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const sidebarResizer = document.getElementById('sidebarResizer');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsPanel = document.getElementById('settingsPanel');
  const settingsClose = document.getElementById('settingsClose');
  const fontSizeOptions = document.getElementById('fontSizeOptions');
  const themeOptions = document.getElementById('themeOptions');
  const layoutOptions = document.getElementById('layoutOptions');

  // --- State ---
  let currentUnitId = null;
  let currentSectionId = null;

  // --- Constants ---
  var SIDEBAR_MIN = 200;
  var SIDEBAR_MAX = 500;
  var STORAGE_KEY_SIDEBAR = 'sidebar-width';
  var STORAGE_KEY_FONTSIZE = 'font-size';
  var STORAGE_KEY_THEME = 'color-theme';
  var LAYOUT_KEY = 'skill-layout';
  var THEME_LIST = ['warm', 'ocean', 'forest', 'sakura', 'midnight-exec', 'forest-moss', 'coral-energy', 'terracotta', 'ocean-grad', 'charcoal', 'teal-trust', 'berry-cream', 'sage-calm', 'cherry-bold'];

  // --- Initialize ---
  function init() {
    if (typeof UNITS_DATA === 'undefined') {
      contentInner.innerHTML = '<div class="loading">載入內容中...</div>';
      return;
    }

    buildNavigation();
    setupEventListeners();
    createScrollTopButton();
    restoreSettings();

    // 載入第一個有內容的單元
    var firstUnit = UNITS_DATA.find(function (u) { return !u.isGroup; });
    if (firstUnit) {
      loadUnit(firstUnit.id);
    }
  }

  // --- Restore Settings from localStorage ---
  function restoreSettings() {
    var savedLayout = localStorage.getItem(LAYOUT_KEY) || 'classic';
    setLayout(savedLayout);

    // Restore sidebar width
    var savedWidth = localStorage.getItem(STORAGE_KEY_SIDEBAR);
    if (savedWidth && window.innerWidth > 768) {
      var w = parseInt(savedWidth, 10);
      if (w >= SIDEBAR_MIN && w <= SIDEBAR_MAX) {
        setSidebarWidth(w);
      }
    }

    // Restore font size
    var savedFontSize = localStorage.getItem(STORAGE_KEY_FONTSIZE) || 'large';
    setFontSize(savedFontSize);

    // Restore theme
    var savedTheme = localStorage.getItem(STORAGE_KEY_THEME) || 'warm';
    setTheme(savedTheme);
  }

  // --- Build Navigation ---
  function buildNavigation() {
    navList.innerHTML = '';

    UNITS_DATA.forEach(function (unit) {
      var li = document.createElement('li');
      li.className = 'nav-item';

      var a = document.createElement('a');
      a.className = 'nav-btn';
      a.setAttribute('data-unit-id', unit.id);

      if (unit.isGroup) {
        li.className += ' group-title expanded';
        a.innerHTML = unit.shortTitle + ' <span class="expand-icon">&#9654;</span>';
        a.addEventListener('click', function (e) {
          e.preventDefault();
          toggleGroup(li);
        });
      } else if (unit.parent) {
        li.className += ' sub-item';
        li.setAttribute('data-parent', unit.parent);
        a.textContent = unit.shortTitle;
        a.addEventListener('click', function (e) {
          e.preventDefault();
          loadUnit(unit.id);
        });
      } else {
        a.textContent = unit.shortTitle;
        a.addEventListener('click', function (e) {
          e.preventDefault();
          loadUnit(unit.id);
        });
      }

      li.appendChild(a);
      navList.appendChild(li);
    });
  }

  // --- Toggle Group (expand/collapse) ---
  function toggleGroup(groupLi) {
    var isExpanded = groupLi.classList.contains('expanded');
    groupLi.classList.toggle('expanded');

    var groupId = groupLi.querySelector('a').getAttribute('data-unit-id');
    var subItems = navList.querySelectorAll('[data-parent="' + groupId + '"]');

    subItems.forEach(function (item) {
      item.style.display = isExpanded ? 'none' : '';
    });
  }

  // --- Load Unit ---
  function loadUnit(unitId) {
    var unit = UNITS_DATA.find(function (u) { return u.id === unitId; });
    if (!unit || unit.isGroup) return;

    currentUnitId = unitId;

    // Update nav active state
    var allLinks = navList.querySelectorAll('a');
    allLinks.forEach(function (link) {
      link.classList.remove('active');
    });
    var activeLink = navList.querySelector('[data-unit-id="' + unitId + '"]');
    if (activeLink) {
      activeLink.classList.add('active');
    }

    // Render markdown content
    renderContent(unit);

    // Close mobile sidebar
    closeSidebar();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // --- Render Content ---
  function renderContent(unit) {
    if (!unit.content) {
      contentInner.innerHTML = '<div class="welcome-screen"><h2>' + escapeHtml(unit.title) + '</h2><p>此單元暫無內容</p></div>';
      return;
    }

    var normalizedContent = normalizeVideoUrls(unit.content);

    if (typeof marked !== 'undefined') {
      marked.setOptions({
        breaks: true,
        gfm: true,
        highlight: function (code, lang) {
          if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
            try {
              return hljs.highlight(code, { language: lang }).value;
            } catch (e) { /* ignore */ }
          }
          if (typeof hljs !== 'undefined') {
            try {
              return hljs.highlightAuto(code).value;
            } catch (e) { /* ignore */ }
          }
          return code;
        }
      });

      var html = marked.parse(normalizedContent);
      contentInner.innerHTML = html;
    } else {
      contentInner.innerHTML = '<pre style="white-space: pre-wrap; padding: 24px;">' + escapeHtml(normalizedContent) + '</pre>';
    }

    linkifyVideoText();
    addCopyButtons();
    processCallouts();
    buildArticleNavigation(unit);

    if (typeof hljs !== 'undefined') {
      contentInner.querySelectorAll('pre code:not(.hljs)').forEach(function (block) {
        hljs.highlightElement(block);
      });
    }

    // 初始化 Scroll Spy（渲染完成後才能掃描標題）
    initScrollSpy();
  }

  function normalizeVideoUrls(content) {
    return String(content).replace(
      /https:\/\/(?:youtu\\\.be|youtube\\\.com)[^\s<)\]]*/gi,
      function (rawUrl) {
        return rawUrl
          .replace(/\\\./g, '.')
          .replace(/\\_/g, '_')
          .replace(/\\-/g, '-');
      }
    );
  }

  function linkifyVideoText() {
    var blocks = contentInner.querySelectorAll('p, li, blockquote, td, th');
    var urlPattern = /(https:\/\/(?:youtu\.be|www\.youtube\.com|youtube\.com)[^\s<]+)/gi;

    blocks.forEach(function (block) {
      if (block.querySelector('a')) {
        block.querySelectorAll('a[href*="youtu"], a[href*="youtube.com"]').forEach(function (link) {
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
        });
        return;
      }

      var html = block.innerHTML;
      var replaced = html.replace(urlPattern, function (url) {
        return '<a href="' + url + '" target="_blank" rel="noopener noreferrer" class="external-video-link">' + url + '</a>';
      });

      if (replaced !== html) {
        block.innerHTML = replaced;
      }
    });
  }

  function buildArticleNavigation(unit) {
    var sections = extractArticleSections();
    if (!sections.length) {
      buildNavigation();
      var defaultLink = navList.querySelector('[data-unit-id="' + unit.id + '"]');
      if (defaultLink) {
        defaultLink.classList.add('active');
      }
      return;
    }

    navList.innerHTML = '';
    var currentGroupId = null;

    sections.forEach(function (section) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.className = 'nav-btn';
      a.setAttribute('href', '#' + section.targetId);
      a.setAttribute('data-section-id', section.targetId);

      if (section.type === 'unit') {
        li.className = 'nav-item group-title expanded';
        currentGroupId = section.targetId;
        a.innerHTML =
          '<span class="nav-kicker">' + escapeHtml(section.shortTitle) + '</span>' +
          '<span class="nav-title">' + escapeHtml(section.title || '') + '</span>';
      } else {
        li.className = 'nav-item sub-item';
        if (currentGroupId) {
          li.setAttribute('data-parent', currentGroupId);
        }
        a.innerHTML =
          '<span class="nav-kicker">' + escapeHtml(section.shortTitle) + '</span>' +
          '<span class="nav-title">' + escapeHtml(section.title || section.shortTitle) + '</span>';
      }

      a.addEventListener('click', function (e) {
        e.preventDefault();
        scrollToSection(section.targetId);
      });

      li.appendChild(a);
      navList.appendChild(li);
    });
  }

  function extractArticleSections() {
    var paragraphs = contentInner.querySelectorAll('p');
    var bodyAnchors = extractBodyAnchors(paragraphs);
    var tocSections = extractTocSections(paragraphs, bodyAnchors);
    return tocSections.length ? tocSections : bodyAnchors;
  }

  function extractBodyAnchors(paragraphs) {
    var anchors = [];
    var seen = {};
    var started = false;

    paragraphs.forEach(function (p, index) {
      var text = normalizeSectionText(p.textContent || '');

      if (!started && /^UNIT\s+1\b/i.test(text)) {
        started = true;
      }
      if (!started) return;

      var unitMatch = text.match(/^UNIT\s+(\d+)\b(.*)$/i);
      if (unitMatch) {
        var unitNumber = unitMatch[1];
        var unitTitle = normalizeSectionText(unitMatch[2] || '');
        var unitId = ensureElementId(p, 'unit-' + unitNumber);
        if (!seen[unitId]) {
          anchors.push({
            id: unitId,
            targetId: unitId,
            type: 'unit',
            shortTitle: 'Unit ' + unitNumber,
            title: unitTitle,
            order: index
          });
          seen[unitId] = true;
        }
        return;
      }

      var storyMatch = text.match(/^Story\s*0?(\d+)\s*:\s*(.+)$/i);
      if (storyMatch) {
        var storyNumber = storyMatch[1];
        var storyTitle = storyMatch[2].trim();
        var storyId = ensureElementId(p, 'story-' + storyNumber);
        if (!seen[storyId]) {
          anchors.push({
            id: storyId,
            targetId: storyId,
            type: 'story',
            shortTitle: 'Story ' + storyNumber.padStart(2, '0'),
            title: storyTitle,
            order: index
          });
          seen[storyId] = true;
        }
      }
    });

    return anchors;
  }

  function extractTocSections(paragraphs, bodyAnchors) {
    var sections = [];
    var bodyMap = {};
    var inToc = false;
    var activeUnit = null;

    bodyAnchors.forEach(function (item) {
      bodyMap[item.id] = item;
    });

    for (var i = 0; i < paragraphs.length; i += 1) {
      var text = normalizeSectionText(paragraphs[i].textContent || '');
      if (!text) continue;

      if (!inToc) {
        if (/^Table of Contents$/i.test(text)) {
          inToc = true;
        }
        continue;
      }

      if (/^UNIT\s+1\b/i.test(text) && /Daily Life/i.test(text)) {
        break;
      }

      var unitMatch = text.match(/^Unit\s+(\d+)$/i);
      if (unitMatch) {
        var nextUnitTitle = findNextMeaningfulText(paragraphs, i + 1);
        var unitId = 'unit-' + unitMatch[1];
        activeUnit = unitId;
        sections.push({
          id: 'toc-' + unitId,
          targetId: unitId,
          type: 'unit',
          shortTitle: 'Unit ' + unitMatch[1],
          title: cleanupTocTitle(nextUnitTitle),
          parent: null
        });
        continue;
      }

      var storyMatch = text.match(/^Story\s*0?(\d+)$/i);
      if (storyMatch) {
        var storyNum = storyMatch[1];
        var nextStoryTitle = findNextMeaningfulText(paragraphs, i + 1);
        sections.push({
          id: 'toc-story-' + storyNum,
          targetId: 'story-' + parseInt(storyNum, 10),
          type: 'story',
          shortTitle: 'Story ' + storyNum.padStart(2, '0'),
          title: cleanupTocTitle(nextStoryTitle),
          parent: activeUnit
        });
      }
    }

    return sections.filter(function (section) {
      return !!bodyMap[section.targetId];
    });
  }

  function findNextMeaningfulText(paragraphs, startIndex) {
    for (var i = startIndex; i < paragraphs.length; i += 1) {
      var text = normalizeSectionText(paragraphs[i].textContent || '');
      if (!text) continue;
      if (/^[.…\d]+$/.test(text)) continue;
      if (/^More Than Words:/i.test(text)) continue;
      return text;
    }
    return '';
  }

  function cleanupTocTitle(text) {
    return normalizeSectionText(text)
      .replace(/^[.…\d]+\s*/g, '')
      .replace(/\s+Page$/i, '')
      .trim();
  }

  function normalizeSectionText(text) {
    return String(text)
      .replace(/[_"]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function ensureElementId(element, fallback) {
    if (!element.id) {
      element.id = fallback;
    }
    element.style.scrollMarginTop = '96px';
    return element.id;
  }

  function scrollToSection(sectionId) {
    var target = document.getElementById(sectionId);
    if (!target) return;

    currentSectionId = sectionId;
    updateSectionNavState(sectionId);
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    closeSidebar();
  }

  function updateSectionNavState(sectionId) {
    navList.querySelectorAll('a').forEach(function (link) {
      link.classList.remove('active');
      link.classList.remove('scrollspy-active');
    });

    var activeLink = navList.querySelector('[data-section-id="' + sectionId + '"]');
    if (activeLink) {
      activeLink.classList.add('active');
      activeLink.classList.add('scrollspy-active');
    }
  }

  // ============================================================
  // Scroll Spy — 滾動時高亮側邊欄對應項目
  // ============================================================
  var scrollSpyObserver = null;

  function initScrollSpy() {
    // 清除前一個單元的 observer
    if (scrollSpyObserver) {
      scrollSpyObserver.disconnect();
      scrollSpyObserver = null;
    }

    // 清除所有 active 狀態
    navList.querySelectorAll('a').forEach(function (a) {
      a.classList.remove('scrollspy-active');
    });

    // 優先追蹤文章段落錨點；若沒有，再退回標題。
    var headings = contentInner.querySelectorAll('[id^="unit-"], [id^="story-"], h2, h3');
    if (!headings.length) return;

    // 對每個標題加上自動 id（若無）
    headings.forEach(function (h, i) {
      if (!h.id) {
        h.id = 'spy-heading-' + i;
      }
    });

    // 追蹤「目前可見最靠上的標題」
    var visibleHeadings = new Set();

    function updateActiveHeading() {
      if (!visibleHeadings.size) return;

      // 找出 DOM 順序最前面的可見標題
      var topHeading = null;
      headings.forEach(function (h) {
        if (visibleHeadings.has(h.id)) {
          if (!topHeading) topHeading = h;
        }
      });
      if (!topHeading) return;

      // 更新側邊欄 active
      var activeNavLink = navList.querySelector('[data-section-id="' + topHeading.id + '"]')
        || navList.querySelector('[data-unit-id="' + currentUnitId + '"]');
      navList.querySelectorAll('a').forEach(function (a) {
        a.classList.remove('scrollspy-active');
      });

      if (activeNavLink) {
        // 無法比對時維持當前單元高亮
        activeNavLink.classList.add('scrollspy-active');
        currentSectionId = topHeading.id;
      }
    }

    scrollSpyObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          visibleHeadings.add(entry.target.id);
        } else {
          visibleHeadings.delete(entry.target.id);
        }
      });
      updateActiveHeading();
    }, {
      root: null,
      rootMargin: '-10% 0px -70% 0px', // 進入畫面上方 10%~30% 區間觸發
      threshold: 0
    });

    headings.forEach(function (h) {
      scrollSpyObserver.observe(h);
    });
  }

  // --- Add Copy Buttons to Code Blocks ---
  function addCopyButtons() {
    var pres = contentInner.querySelectorAll('pre');
    pres.forEach(function (pre) {
      var wrapper = document.createElement('div');
      wrapper.className = 'code-wrapper';
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      // Language badge
      var code = pre.querySelector('code');
      if (code) {
        var classes = code.className.split(/\s+/);
        for (var i = 0; i < classes.length; i++) {
          var match = classes[i].match(/^(?:language-|hljs-)(.+)$/);
          if (match && match[1] !== 'plaintext') {
            var badge = document.createElement('span');
            badge.className = 'code-lang-badge';
            badge.textContent = match[1].toUpperCase();
            wrapper.appendChild(badge);
            break;
          }
        }
      }

      var btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.textContent = '\u8907\u88fd';
      btn.addEventListener('click', function () {
        var codeEl = pre.querySelector('code');
        var text = codeEl ? codeEl.textContent : pre.textContent;
        copyToClipboard(text, btn);
      });
      wrapper.appendChild(btn);
    });
  }

  // --- Process Callouts (GitHub-style [!TIP] / [!WARNING] / [!NOTE]) ---
  function processCallouts() {
    var blockquotes = contentInner.querySelectorAll('blockquote');
    var calloutMap = {
      'TIP': 'callout-tip',
      'WARNING': 'callout-warning',
      'NOTE': 'callout-note'
    };

    blockquotes.forEach(function (bq) {
      var firstP = bq.querySelector('p');
      if (!firstP) return;
      var text = firstP.innerHTML;
      var match = text.match(/^\[!(TIP|WARNING|NOTE)\]\s*/i);
      if (match) {
        var type = match[1].toUpperCase();
        bq.classList.add(calloutMap[type] || 'callout-note');
        firstP.innerHTML = text.replace(match[0], '');
      }
    });
  }

  // --- Copy to Clipboard ---
  function copyToClipboard(text, btn) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () {
        showCopied(btn);
      }).catch(function () {
        fallbackCopy(text, btn);
      });
    } else {
      fallbackCopy(text, btn);
    }
  }

  function fallbackCopy(text, btn) {
    var textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      showCopied(btn);
    } catch (e) {
      // ignore
    }
    document.body.removeChild(textarea);
  }

  function showCopied(btn) {
    btn.textContent = '\u5df2\u8907\u88fd!';
    btn.classList.add('copied');
    setTimeout(function () {
      btn.textContent = '\u8907\u88fd';
      btn.classList.remove('copied');
    }, 2000);
  }

  // --- Mobile Sidebar ---
  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  // ============================================================
  // Sidebar Resizer (Drag to resize)
  // ============================================================
  function initSidebarResizer() {
    if (!sidebarResizer) return;

    var startX, startWidth;

    sidebarResizer.addEventListener('mousedown', function (e) {
      e.preventDefault();
      startX = e.clientX;
      startWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width'), 10);
      document.body.classList.add('resizing');

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    function onMouseMove(e) {
      var newWidth = startWidth + (e.clientX - startX);
      if (newWidth < SIDEBAR_MIN) newWidth = SIDEBAR_MIN;
      if (newWidth > SIDEBAR_MAX) newWidth = SIDEBAR_MAX;
      setSidebarWidth(newWidth);
    }

    function onMouseUp() {
      document.body.classList.remove('resizing');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      var currentWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width'), 10);
      localStorage.setItem(STORAGE_KEY_SIDEBAR, currentWidth);
    }
  }

  function setSidebarWidth(px) {
    document.documentElement.style.setProperty('--sidebar-width', px + 'px');
  }

  // ============================================================
  // Settings Panel
  // ============================================================
  function initSettingsPanel() {
    if (!settingsBtn || !settingsPanel) return;

    settingsBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = settingsPanel.classList.contains('open');
      if (isOpen) {
        closeSettingsPanel();
      } else {
        openSettingsPanel();
      }
    });

    if (settingsClose) {
      settingsClose.addEventListener('click', function (e) {
        e.stopPropagation();
        closeSettingsPanel();
      });
    }

    // Font size options
    if (fontSizeOptions) {
      fontSizeOptions.addEventListener('click', function (e) {
        var btn = e.target.closest('.settings-option');
        if (!btn) return;
        var size = btn.getAttribute('data-size');
        setFontSize(size);
        localStorage.setItem(STORAGE_KEY_FONTSIZE, size);
      });
    }

    // Theme options
    if (themeOptions) {
      themeOptions.addEventListener('click', function (e) {
        var btn = e.target.closest('.theme-card');
        if (!btn) return;
        var theme = btn.getAttribute('data-theme');
        setTheme(theme);
        localStorage.setItem(STORAGE_KEY_THEME, theme);
      });
    }

    if (layoutOptions) {
      layoutOptions.addEventListener('click', function (e) {
        var btn = e.target.closest('.layout-card');
        if (!btn) return;
        var layout = btn.getAttribute('data-layout');
        setLayout(layout);
        localStorage.setItem(LAYOUT_KEY, layout);
      });
    }
  }

  function openSettingsPanel() {
    settingsPanel.classList.add('open');
  }

  function closeSettingsPanel() {
    settingsPanel.classList.remove('open');
  }

  function setFontSize(size) {
    document.body.classList.remove('font-medium', 'font-large', 'font-xlarge');
    document.body.classList.add('font-' + size);

    if (fontSizeOptions) {
      var buttons = fontSizeOptions.querySelectorAll('.settings-option');
      buttons.forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-size') === size);
      });
    }
  }

  // --- Theme Switching ---
  function setTheme(theme) {
    // Add transition animation
    document.body.classList.add('theme-transitioning');

    // Remove all theme classes
    THEME_LIST.forEach(function (t) {
      document.body.classList.remove('theme-' + t);
    });
    // 'warm' is default (no class needed), others add class
    if (theme !== 'warm') {
      document.body.classList.add('theme-' + theme);
    }

    // Update active button
    if (themeOptions) {
      var cards = themeOptions.querySelectorAll('.theme-card');
      cards.forEach(function (card) {
        card.classList.toggle('active', card.getAttribute('data-theme') === theme);
      });
    }

    // Remove transition class after animation completes
    setTimeout(function () {
      document.body.classList.remove('theme-transitioning');
    }, 400);
  }

  function setLayout(layout) {
    document.body.classList.toggle('layout-dashboard', layout === 'dashboard');
    if (layoutOptions) {
      layoutOptions.querySelectorAll('.layout-card').forEach(function (card) {
        card.classList.toggle('active', card.getAttribute('data-layout') === layout);
      });
    }
  }

  // --- Scroll to Top Button ---
  function createScrollTopButton() {
    var btn = document.createElement('button');
    btn.className = 'scroll-top';
    btn.innerHTML = '&#9650;';
    btn.setAttribute('aria-label', '\u56de\u5230\u9802\u90e8');
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.body.appendChild(btn);

    window.addEventListener('scroll', function () {
      if (window.scrollY > 400) {
        btn.classList.add('visible');
      } else {
        btn.classList.remove('visible');
      }
    });
  }

  // --- Event Listeners ---
  function setupEventListeners() {
    // Hamburger menu toggle
    menuToggle.addEventListener('click', function () {
      if (sidebar.classList.contains('open')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });

    // Overlay click to close
    overlay.addEventListener('click', function () {
      closeSidebar();
      closeSettingsPanel();
    });

    document.addEventListener('click', function (e) {
      if (settingsPanel.classList.contains('open')
          && !settingsPanel.contains(e.target)
          && e.target !== settingsBtn
          && !settingsBtn.contains(e.target)) {
        closeSettingsPanel();
      }
    });

    // Keyboard: Escape to close sidebar / settings
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeSidebar();
        closeSettingsPanel();
      }
    });

    // Keyboard navigation: left/right arrows for prev/next unit
    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      var contentUnits = UNITS_DATA.filter(function (u) { return !u.isGroup; });
      var currentIndex = contentUnits.findIndex(function (u) { return u.id === currentUnitId; });

      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        loadUnit(contentUnits[currentIndex - 1].id);
      } else if (e.key === 'ArrowRight' && currentIndex < contentUnits.length - 1) {
        loadUnit(contentUnits[currentIndex + 1].id);
      }
    });

    // Fullscreen toggle
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', toggleFullscreen);

      document.addEventListener('fullscreenchange', updateFullscreenButton);
      document.addEventListener('webkitfullscreenchange', updateFullscreenButton);
    }

    // Initialize sidebar resizer
    initSidebarResizer();

    // Initialize settings panel
    initSettingsPanel();
  }

  // --- Fullscreen ---
  function toggleFullscreen() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement) {
      var el = document.documentElement;
      if (el.requestFullscreen) {
        el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  }

  function updateFullscreenButton() {
    var isFS = !!(document.fullscreenElement || document.webkitFullscreenElement);
    var icon = document.getElementById('fullscreenIcon');
    var label = fullscreenBtn.querySelector('.btn-label');

    if (isFS) {
      fullscreenBtn.classList.add('fullscreen-active');
      if (icon) icon.innerHTML = '<path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/>';
      if (label) label.textContent = '\u96e2\u958b\u5168\u87a2\u5e55';
    } else {
      fullscreenBtn.classList.remove('fullscreen-active');
      if (icon) icon.innerHTML = '<path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/>';
      if (label) label.textContent = '\u5168\u87a2\u5e55';
    }
  }

  // --- Utility ---
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // --- Start ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
