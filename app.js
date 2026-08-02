(() => {
  'use strict';

  const DATA = window.HANDBOOK_DATA;
  if (!DATA || !Number.isInteger(DATA.pageCount)) {
    throw new Error('Không tìm thấy dữ liệu cẩm nang.');
  }

  const storage = {
    get(key) { try { return window.localStorage.getItem(key); } catch (_) { return null; } },
    set(key, value) { try { window.localStorage.setItem(key, value); } catch (_) {} }
  };

  const PAGE_COUNT = DATA.pageCount;
  const PAGE_RATIO = 1414 / 2000;
  const PAGE_PATH = (index) => `assets/pages/page-${String(index + 1).padStart(3, '0')}.png`;
  const THUMB_PATH = (index) => `assets/thumbs/page-${String(index + 1).padStart(3, '0')}.webp`;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const book = $('#book');
  const pageSlot = $('#pageSlot');
  const pageImg = $('#pageImg');
  const flipLayer = $('#flipLayer');
  const flipFront = $('#flipFront');
  const flipBack = $('#flipBack');
  const pageLabel = $('#pageLabel');
  const pageRange = $('#pageRange');
  const prevBtn = $('#prevBtn');
  const nextBtn = $('#nextBtn');
  const edgePrev = $('#edgePrev');
  const edgeNext = $('#edgeNext');
  const sidebar = $('#sidebar');
  const scrim = $('#scrim');
  const zoomLabel = $('#zoomResetBtn');
  const stage = $('#stage');
  const readModeBtn = $('#readModeBtn');
  const fitBtn = $('#fitBtn');

  let currentPage = Number(storage.get('aiHandbookLastPage') || 0);
  currentPage = Math.max(0, Math.min(PAGE_COUNT - 1, currentPage));
  let animating = false;
  let zoom = 1;
  let viewMode = storage.get('aiHandbookViewMode') === 'fit' ? 'fit' : 'read';
  let pointerStartX = null;
  let pointerStartY = null;
  let resizeTimer = null;

  const normalize = (value) => String(value || '')
    .toLocaleLowerCase('vi-VN')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
    }[character]));
  }

  function loadPage(index) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
      image.src = PAGE_PATH(index);
      if (image.complete) resolve(true);
    });
  }

  function pageAlt(index) {
    const text = String(DATA.pageTexts?.[index] || '').replace(/\s+/g, ' ').trim();
    const summary = text.length > 110 ? `${text.slice(0, 110)}…` : text;
    return summary ? `Trang ${index + 1}: ${summary}` : `Trang ${index + 1}`;
  }

  function calculateBaseWidth() {
    const style = getComputedStyle(stage);
    const horizontalPadding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const verticalPadding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const availableWidth = Math.max(260, stage.clientWidth - horizontalPadding);
    const availableHeight = Math.max(300, stage.clientHeight - verticalPadding);
    const mobile = window.matchMedia('(max-width: 900px)').matches;

    if (viewMode === 'fit') {
      return Math.max(250, Math.min(availableWidth, availableHeight * PAGE_RATIO));
    }

    if (mobile) return Math.min(availableWidth, 720);
    return Math.min(Math.max(680, availableWidth * 0.78), 920, availableWidth);
  }

  function applyPageSize(keepPosition = false) {
    const previousCenter = keepPosition ? {
      x: stage.scrollLeft + stage.clientWidth / 2,
      y: stage.scrollTop + stage.clientHeight / 2,
      width: book.offsetWidth,
      height: book.offsetHeight
    } : null;

    const width = Math.round(calculateBaseWidth() * zoom);
    book.style.width = `${width}px`;
    zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
    readModeBtn.classList.toggle('active', viewMode === 'read');
    fitBtn.classList.toggle('active', viewMode === 'fit');

    if (previousCenter && previousCenter.width > 0 && previousCenter.height > 0) {
      requestAnimationFrame(() => {
        const scaleX = book.offsetWidth / previousCenter.width;
        const scaleY = book.offsetHeight / previousCenter.height;
        stage.scrollLeft = Math.max(0, previousCenter.x * scaleX - stage.clientWidth / 2);
        stage.scrollTop = Math.max(0, previousCenter.y * scaleY - stage.clientHeight / 2);
      });
    }
  }

  function updateDocumentTitle() {
    document.title = `Trang ${currentPage + 1} | Cẩm nang AI Y tế Việt Nam 2026`;
  }

  function render(save = true) {
    const source = PAGE_PATH(currentPage);
    if (!pageImg.src.endsWith(source)) pageImg.src = source;
    pageImg.alt = pageAlt(currentPage);
    pageSlot.setAttribute('aria-label', `Trang ${currentPage + 1} trên ${PAGE_COUNT}`);
    pageLabel.textContent = `Trang ${currentPage + 1} / ${PAGE_COUNT}`;
    pageRange.value = String(currentPage + 1);

    const atFirst = currentPage === 0;
    const atLast = currentPage === PAGE_COUNT - 1;
    prevBtn.disabled = atFirst;
    nextBtn.disabled = atLast;
    edgePrev.disabled = atFirst;
    edgeNext.disabled = atLast;

    if (save) storage.set('aiHandbookLastPage', String(currentPage));
    updateDocumentTitle();
    updateActiveNavigation();
    preloadNearby();
  }

  function preloadNearby() {
    [-2, -1, 1, 2].forEach((offset) => {
      const index = currentPage + offset;
      if (index >= 0 && index < PAGE_COUNT) {
        const image = new Image();
        image.src = PAGE_PATH(index);
      }
    });
  }

  async function animateTo(target, direction) {
    if (animating || target === currentPage || target < 0 || target >= PAGE_COUNT) return;
    animating = true;

    const oldPage = currentPage;
    const loaded = await loadPage(target);
    if (!loaded) {
      animating = false;
      return;
    }

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      currentPage = target;
      render();
      animating = false;
      return;
    }

    pageImg.src = PAGE_PATH(target);
    pageImg.alt = pageAlt(target);
    flipFront.src = PAGE_PATH(oldPage);
    flipBack.src = PAGE_PATH(target);
    flipFront.alt = pageAlt(oldPage);
    flipBack.alt = pageAlt(target);
    flipLayer.className = `flip-layer active ${direction}`;

    const finish = () => {
      currentPage = target;
      flipLayer.className = 'flip-layer';
      flipFront.removeAttribute('src');
      flipBack.removeAttribute('src');
      render();
      animating = false;
    };

    flipLayer.addEventListener('animationend', finish, { once: true });
    window.setTimeout(() => {
      if (animating && currentPage === oldPage) finish();
    }, 900);
  }

  function next() { animateTo(currentPage + 1, 'next'); }
  function prev() { animateTo(currentPage - 1, 'prev'); }

  function goToPage(pageNumber, close = true, animateAdjacent = true) {
    const target = Math.max(0, Math.min(PAGE_COUNT - 1, Number(pageNumber) - 1));
    if (target === currentPage) {
      if (close) closeSidebar();
      return;
    }

    if (animateAdjacent && Math.abs(target - currentPage) === 1) {
      animateTo(target, target > currentPage ? 'next' : 'prev');
    } else {
      currentPage = target;
      render();
      stage.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
    }
    if (close) closeSidebar();
  }

  function setZoom(value) {
    zoom = Math.max(.7, Math.min(2.2, Math.round(value * 10) / 10));
    applyPageSize(true);
  }

  function setViewMode(mode) {
    viewMode = mode === 'fit' ? 'fit' : 'read';
    zoom = 1;
    storage.set('aiHandbookViewMode', viewMode);
    applyPageSize();
    stage.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
  }

  function openSidebar(tabName = null) {
    sidebar.classList.add('open');
    sidebar.setAttribute('aria-hidden', 'false');
    $('#sidebarBtn').setAttribute('aria-expanded', 'true');
    scrim.hidden = false;
    if (tabName) selectTab(tabName);
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
    sidebar.setAttribute('aria-hidden', 'true');
    $('#sidebarBtn').setAttribute('aria-expanded', 'false');
    scrim.hidden = true;
  }

  function selectTab(name) {
    $$('.tab').forEach((button) => {
      const active = button.dataset.tab === name;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    $$('.tab-panel').forEach((panel) => panel.classList.toggle('active', panel.id === `panel-${name}`));
    if (name === 'search') window.setTimeout(() => $('#searchInput').focus(), 60);
  }

  function buildTOC() {
    const groups = new Map();
    DATA.toc.forEach((item) => {
      if (!groups.has(item.group)) groups.set(item.group, []);
      groups.get(item.group).push(item);
    });

    const container = $('#tocList');
    container.innerHTML = '';
    groups.forEach((items, group) => {
      const section = document.createElement('section');
      section.className = 'toc-group';
      section.innerHTML = `<div class="toc-group-title">${escapeHtml(group)}</div>`;
      items.forEach((item) => {
        const button = document.createElement('button');
        button.className = 'toc-item';
        button.dataset.page = item.page;
        button.innerHTML = `<span>${escapeHtml(item.title)}</span><span class="pno">${item.page}</span>`;
        button.addEventListener('click', () => goToPage(item.page));
        section.appendChild(button);
      });
      container.appendChild(section);
    });
  }

  function buildThumbs() {
    const grid = $('#thumbGrid');
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < PAGE_COUNT; index += 1) {
      const button = document.createElement('button');
      button.className = 'thumb';
      button.dataset.page = index + 1;
      button.title = `Mở trang ${index + 1}`;
      button.innerHTML = `<img loading="lazy" src="${THUMB_PATH(index)}" alt="Ảnh thu nhỏ trang ${index + 1}"><span>${index + 1}</span>`;
      button.addEventListener('click', () => goToPage(index + 1));
      fragment.appendChild(button);
    }
    grid.appendChild(fragment);
  }

  function updateActiveNavigation() {
    $$('.thumb').forEach((element) => {
      element.classList.toggle('active', Number(element.dataset.page) - 1 === currentPage);
    });

    const tocItems = $$('.toc-item');
    tocItems.forEach((element, index) => {
      const start = Number(element.dataset.page);
      const end = index + 1 < tocItems.length ? Number(tocItems[index + 1].dataset.page) - 1 : PAGE_COUNT;
      element.classList.toggle('active', currentPage + 1 >= start && currentPage + 1 <= end);
    });
  }

  function doSearch(query) {
    const results = $('#searchResults');
    const normalizedQuery = normalize(query);
    if (normalizedQuery.length < 2) {
      results.innerHTML = '';
      return;
    }

    const hits = [];
    DATA.pageTexts.forEach((text, index) => {
      if (normalize(text).includes(normalizedQuery)) hits.push({ page: index + 1, text });
    });

    if (!hits.length) {
      results.innerHTML = '<div class="empty-state">Không tìm thấy nội dung phù hợp.</div>';
      return;
    }

    results.innerHTML = '';
    hits.slice(0, 40).forEach((hit) => {
      const button = document.createElement('button');
      button.className = 'search-result';
      let excerpt = String(hit.text).replace(/\s+/g, ' ').trim();
      if (excerpt.length > 220) excerpt = `${excerpt.slice(0, 220)}…`;
      button.innerHTML = `<strong>Trang ${hit.page}</strong><p>${escapeHtml(excerpt)}</p>`;
      button.addEventListener('click', () => goToPage(hit.page));
      results.appendChild(button);
    });

    if (hits.length > 40) {
      const note = document.createElement('div');
      note.className = 'empty-state';
      note.textContent = `Hiển thị 40 / ${hits.length} kết quả.`;
      results.appendChild(note);
    }
  }

  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', next);
  edgePrev.addEventListener('click', prev);
  edgeNext.addEventListener('click', next);
  pageRange.addEventListener('input', (event) => goToPage(event.target.value, false, false));
  $('#sidebarBtn').addEventListener('click', () => sidebar.classList.contains('open') ? closeSidebar() : openSidebar());
  $('#closeSidebarBtn').addEventListener('click', closeSidebar);
  scrim.addEventListener('click', closeSidebar);
  $$('.tab').forEach((button) => button.addEventListener('click', () => selectTab(button.dataset.tab)));
  $('#searchInput').addEventListener('input', (event) => doSearch(event.target.value));
  $('#zoomOutBtn').addEventListener('click', () => setZoom(zoom - .1));
  $('#zoomInBtn').addEventListener('click', () => setZoom(zoom + .1));
  zoomLabel.addEventListener('click', () => setZoom(1));
  readModeBtn.addEventListener('click', () => setViewMode('read'));
  fitBtn.addEventListener('click', () => setViewMode('fit'));

  $('#themeBtn').addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme === 'dark';
    const nextTheme = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = nextTheme;
    storage.set('aiHandbookTheme', nextTheme);
  });

  $('#fullscreenBtn').addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
      else await document.exitFullscreen?.();
    } catch (_) {}
  });

  $('#startBtn').addEventListener('click', () => {
    $('#welcome').classList.add('hidden');
    storage.set('aiHandbookWelcomeSeen', '1');
  });

  stage.addEventListener('pointerdown', (event) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    pointerStartX = event.clientX;
    pointerStartY = event.clientY;
  });

  stage.addEventListener('pointerup', (event) => {
    if (pointerStartX === null || pointerStartY === null) return;
    const deltaX = event.clientX - pointerStartX;
    const deltaY = event.clientY - pointerStartY;
    pointerStartX = null;
    pointerStartY = null;
    if (Math.abs(deltaX) > 55 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) {
      deltaX < 0 ? next() : prev();
    }
  });

  stage.addEventListener('pointercancel', () => {
    pointerStartX = null;
    pointerStartY = null;
  });

  stage.addEventListener('wheel', (event) => {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    setZoom(zoom + (event.deltaY < 0 ? .1 : -.1));
  }, { passive: false });

  document.addEventListener('keydown', (event) => {
    if (event.target.matches('input, textarea')) {
      if (event.key === 'Escape') closeSidebar();
      return;
    }
    if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
      event.preventDefault();
      next();
    } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
      event.preventDefault();
      prev();
    } else if (event.key === 'Home') {
      event.preventDefault();
      goToPage(1, false, false);
    } else if (event.key === 'End') {
      event.preventDefault();
      goToPage(PAGE_COUNT, false, false);
    } else if (event.key === '+' || event.key === '=') {
      setZoom(zoom + .1);
    } else if (event.key === '-') {
      setZoom(zoom - .1);
    } else if (event.key.toLowerCase() === 'f') {
      $('#fullscreenBtn').click();
    } else if (event.key === 'Escape') {
      closeSidebar();
    }
  });

  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => applyPageSize(), 100);
  });

  const savedTheme = storage.get('aiHandbookTheme');
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;
  else if (window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.dataset.theme = 'dark';

  if (storage.get('aiHandbookWelcomeSeen') || new URLSearchParams(location.search).get('start') === '1') {
    $('#welcome').classList.add('hidden');
  }

  buildTOC();
  buildThumbs();
  applyPageSize();
  render(false);
})();
