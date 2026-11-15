(function () {
  const DATA_URL = 'data/books.json?v=20261115a';
  const PASSAGES_URL = 'data/passages.json?v=20261115a';
  const USER_KEY = 'concept-lib:user';
  const KIND_META = {
    concept: { noun: '概念', section: 'concepts', hashPrefix: 'concept-', openAttr: 'data-open-item', listLabel: '关键概念' },
    method:  { noun: '方法', section: 'methods',  hashPrefix: 'method-',  openAttr: 'data-open-item', listLabel: '方法论' },
    model:   { noun: '模型', section: 'models',   hashPrefix: 'model-',   openAttr: 'data-open-item', listLabel: '模型' }
  };

  function practiceTypesFor(kind) {
    const noun = (KIND_META[kind] || KIND_META.concept).noun;
    return [
      {
        id: 'understand',
        chip: '理解',
        label: '我对这个' + noun + '的理解',
        placeholder: '我对这个' + noun + '的理解是…'
      },
      {
        id: 'curious',
        chip: '好奇',
        label: '我对这个' + noun + '好奇',
        placeholder: '我对这个' + noun + '还好奇什么？'
      },
      {
        id: 'relate',
        chip: '与我相关',
        label: '这个' + noun + '与我相关',
        placeholder: '这个' + noun + '怎样与我相关？'
      },
      {
        id: 'practice',
        chip: '践行',
        label: '我的践行',
        placeholder: '我做了什么？有什么效果？'
      }
    ];
  }

  function practiceById(kind) {
    return Object.fromEntries(practiceTypesFor(kind).map(t => [t.id, t]));
  }

  const BOOK_RECAP_TYPES = [
    {
      id: 'understand',
      chip: '理解',
      label: '我对这本书的理解',
      placeholder: '这本书里，我真正弄懂的是…'
    },
    {
      id: 'curious',
      chip: '好奇',
      label: '我还好奇的',
      placeholder: '合上之后，我还想继续追问的是…'
    },
    {
      id: 'practice',
      chip: '践行',
      label: '我准备践行的',
      placeholder: '我准备去做的一件事是…'
    }
  ];


  function chipClass(type) {
    if (type === '公众号') return 'chip chip-wechat';
    if (type === '开源') return 'chip chip-open';
    return 'chip chip-epub';
  }

  function qs(name) {
    return new URLSearchParams(location.search).get(name);
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function primarySource(book) {
    return book.officialUrl || book.sourceUrl || '#';
  }

  function itemSourceUrl(book, item) {
    if (item && item.sourceUrl) return item.sourceUrl;
    const base = primarySource(book);
    if (item && item.sourceAnchor) {
      const hash = String(item.sourceAnchor).replace(/^#/, '');
      return base.replace(/#.*$/, '') + '#' + hash;
    }
    return base;
  }

  function asExcerpt(blurb) {
    return String(blurb || '')
      .replace(/^作者主张[：:]\s*/, '')
      .trim();
  }

  function formatTime(isoOrLocal) {
    if (!isoOrLocal) return '';
    const d = new Date(isoOrLocal);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    }
    return String(isoOrLocal);
  }


  function formatPublishedZh(published) {
    if (!published) return '';
    const m = String(published).trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) {
      return `${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日`;
    }
    return String(published);
  }

  function bookByline(book) {
    const parts = [];
    if (book.author) parts.push(book.author);
    const pub = formatPublishedZh(book.published);
    if (pub) parts.push(pub);
    return parts.join(' · ');
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    } catch (e) {
      return null;
    }
  }

  function setUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  function highlight(text, q) {
    const safe = escapeHtml(text);
    if (!q) return safe;
    const parts = q.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return safe;
    const re = new RegExp('(' + parts.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'ig');
    return safe.replace(re, '<mark>$1</mark>');
  }

  async function loadBooks() {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error('无法加载书目数据');
    return res.json();
  }

  function expandPassageUrl(u, base) {
    if (!u) return '';
    if (/^https?:/i.test(u)) return u;
    return (base || 'https://lixiaolai.com/books/') + u;
  }

  function normalizePassages(data) {
    if (!data) return [];
    if (Array.isArray(data)) {
      return data.map(p => ({
        bookId: p.bookId || p.b,
        bookTitle: p.bookTitle || '',
        heading: p.heading || p.h || '',
        url: expandPassageUrl(p.url || p.u, ''),
        text: p.text || p.t || '',
        snippet: p.snippet || p.s || ''
      }));
    }
    const base = data.base || 'https://lixiaolai.com/books/';
    const titles = data.books || {};
    return (data.passages || []).map(p => {
      const bookId = p.bookId || p.b;
      return {
        bookId,
        bookTitle: p.bookTitle || titles[bookId] || '',
        heading: p.heading || p.h || '',
        url: expandPassageUrl(p.url || p.u, base),
        text: p.text || p.t || '',
        snippet: p.snippet || p.s || ''
      };
    });
  }

  async function loadPassages() {
    try {
      const res = await fetch(PASSAGES_URL);
      if (!res.ok) return [];
      return normalizePassages(await res.json());
    } catch (err) {
      console.warn('passage index unavailable', err);
      return [];
    }
  }

  function chapterKey(url) {
    if (!url) return '';
    try {
      const u = new URL(url, 'https://lixiaolai.com');
      return (u.origin + u.pathname).replace(/\/+$/, '');
    } catch (e) {
      return String(url).split('#')[0].replace(/\/+$/, '');
    }
  }

  function excerptAround(text, q, maxLen) {
    const source = String(text || '').replace(/\s+/g, ' ').trim();
    if (!source) return '';
    const limit = maxLen || 160;
    const token = (q || '').trim().split(/\s+/).filter(Boolean)[0] || '';
    let idx = token ? source.toLowerCase().indexOf(token.toLowerCase()) : -1;
    if (idx < 0) {
      const cut = source.slice(0, limit);
      return source.length > limit ? cut.replace(/[,，、\s]+$/, '') + '…' : source;
    }
    let start = Math.max(0, idx - 36);
    // prefer a nearby sentence boundary
    const before = source.lastIndexOf('。', idx);
    if (before >= 0 && idx - before < 80 && idx - before > 4) start = before + 1;
    while (start < source.length && /\s/.test(source[start])) start += 1;
    let end = Math.min(source.length, start + limit);
    const after = source.indexOf('。', idx);
    if (after >= 0 && after + 1 - start <= limit + 20 && after + 1 > end) {
      end = after + 1;
    }
    let snip = source.slice(start, end).trim();
    if (start > 0) snip = '…' + snip;
    if (end < source.length) snip = snip + '…';
    return snip;
  }

  function cardHref(book, kind, item) {
    const meta = KIND_META[kind] || KIND_META.concept;
    const id = (item && (item.id || item.name)) || '';
    return 'book.html?id=' + encodeURIComponent(book.id) + '#' + meta.hashPrefix + encodeURIComponent(id);
  }

  function setupNav() {
    const links = document.querySelector('[data-nav-links]');
    if (!links) return;
    const path = location.pathname.split('/').pop() || 'index.html';
    links.querySelectorAll('a').forEach(a => {
      const href = a.getAttribute('href');
      if (href === path || (path === '' && href === 'index.html')) {
        a.classList.add('active');
        a.setAttribute('aria-current', 'page');
      }
    });
  }

  function setupTheme() {
    const key = 'concept-lib:theme';
    const group = document.querySelector('[data-theme-switch]');
    if (!group) return;
    const buttons = Array.from(group.querySelectorAll('[data-theme-choice]'));
    const allowed = ['day', 'night', 'paper'];

    function apply(theme, persist) {
      if (!allowed.includes(theme)) theme = 'day';
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.style.colorScheme = theme === 'night' ? 'dark' : 'light';
      buttons.forEach(btn => {
        const on = btn.getAttribute('data-theme-choice') === theme;
        btn.setAttribute('aria-checked', on ? 'true' : 'false');
        btn.tabIndex = on ? 0 : -1;
      });
      if (persist) {
        try { localStorage.setItem(key, theme); } catch (e) { /* private mode */ }
      }
    }

    apply(document.documentElement.getAttribute('data-theme') || 'day', false);

    buttons.forEach((btn, index) => {
      btn.addEventListener('click', () => apply(btn.getAttribute('data-theme-choice'), true));
      btn.addEventListener('keydown', (e) => {
        const forward = e.key === 'ArrowRight' || e.key === 'ArrowDown';
        const back = e.key === 'ArrowLeft' || e.key === 'ArrowUp';
        if (!forward && !back) return;
        e.preventDefault();
        const next = buttons[(index + (forward ? 1 : -1) + buttons.length) % buttons.length];
        next.focus();
        apply(next.getAttribute('data-theme-choice'), true);
      });
    });
  }

  function renderBookCards(books, mount) {
    const rows = books.map(b => `
      <tr>
        <td class="col-title">
          <a class="book-title" href="book.html?id=${encodeURIComponent(b.id)}">${escapeHtml(b.title)}</a>${b.published ? ` <span class="book-year">（${escapeHtml(b.published)}）</span>` : ''}
          <div class="book-sub">${escapeHtml(b.author)} · <span class="${chipClass(b.type)}">${escapeHtml(b.type)}</span></div>
        </td>
        <td class="col-summary">${escapeHtml(b.summary)}</td>
        <td class="col-actions">
          <a href="book.html?id=${encodeURIComponent(b.id)}">查看</a>
          <a href="${escapeHtml(primarySource(b))}" target="_blank" rel="noopener">原站</a>
        </td>
      </tr>
    `).join('');
    mount.innerHTML = `
      <div class="book-table-wrap">
        <table class="book-table">
          <thead>
            <tr>
              <th class="col-title">书名</th>
              <th class="col-summary">简介</th>
              <th class="col-actions">操作</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function searchLibrary(books, passages, q) {
    const query = (q || '').trim().toLowerCase();
    if (!query) return [];
    const tokens = query.split(/\s+/).filter(Boolean);
    const cardHits = [];
    const bookHits = [];
    const cardChapters = new Set();

    books.forEach(book => {
      const hayBook = [book.title, book.author].join(' ').toLowerCase();
      if (tokens.every(t => hayBook.includes(t))) {
        bookHits.push({
          kind: 'book',
          book,
          bookTitle: book.title,
          title: book.title,
          snippet: book.summary,
          href: 'book.html?id=' + encodeURIComponent(book.id),
          sourceUrl: primarySource(book)
        });
      }
      [['concept', book.concepts], ['method', book.methods], ['model', book.models]].forEach(([kind, items]) => {
        (items || []).forEach(item => {
          const hay = [item.name, asExcerpt(item.blurb)].join(' ').toLowerCase();
          if (!tokens.every(t => hay.includes(t))) return;
          const sourceUrl = itemSourceUrl(book, item);
          cardHits.push({
            kind,
            book,
            bookTitle: book.title,
            title: item.name,
            snippet: asExcerpt(item.blurb),
            href: cardHref(book, kind, item),
            sourceUrl
          });
          const key = chapterKey(sourceUrl);
          if (key) cardChapters.add(key);
        });
      });
    });

    const passageHits = [];
    const seenPassage = new Set();
    (passages || []).forEach(p => {
      const hay = [p.heading, p.text, p.snippet].join(' ').toLowerCase();
      if (!tokens.every(t => hay.includes(t))) return;
      const url = p.url || '';
      const chap = chapterKey(url);
      if (chap && cardChapters.has(chap)) return;
      const dedupe = (p.bookId || '') + '|' + (url || p.heading || '');
      if (seenPassage.has(dedupe)) return;
      seenPassage.add(dedupe);
      passageHits.push({
        kind: 'passage',
        bookId: p.bookId,
        bookTitle: p.bookTitle,
        title: p.heading || p.bookTitle || '原文',
        snippet: excerptAround(p.text || p.snippet, q, 160),
        href: url,
        sourceUrl: url,
        bookHref: p.bookId ? 'book.html?id=' + encodeURIComponent(p.bookId) : ''
      });
    });

    // Common words like「时间」can hit hundreds of excerpts; keep the list usable.
    const PASSAGE_LIMIT = 40;
    return cardHits.concat(passageHits.slice(0, PASSAGE_LIMIT), bookHits);
  }

  // Back-compat alias used by any leftover call sites
  function searchBooks(books, q) {
    return searchLibrary(books, [], q);
  }

  function renderResults(hits, q, mount, meta) {
    if (!q.trim()) {
      meta.textContent = '';
      mount.innerHTML = '';
      return;
    }
    meta.textContent = hits.length ? `找到 ${hits.length} 条与「${q}」相关的结果` : `没有找到与「${q}」相关的结果`;
    if (!hits.length) {
      mount.innerHTML = '<div class="empty-state">试试概念、原话或书名，例如「财富」「时间」「定投」</div>';
      return;
    }
    const kindLabel = { book: '书目', concept: '概念', method: '方法论', model: '模型', passage: '原文' };
    mount.innerHTML = hits.map(h => {
      const bookTitle = h.bookTitle || (h.book && h.book.title) || '';
      const metaLine = (kindLabel[h.kind] || '') + (bookTitle ? ' · 《' + escapeHtml(bookTitle) + '》' : '');
      const contextHref = h.sourceUrl || '';
      const isExternal = h.kind === 'passage' || (contextHref && contextHref === h.href);
      const titleAttrs = isExternal && /^https?:/i.test(h.href || '')
        ? ' target="_blank" rel="noopener"'
        : '';
      const context = contextHref
        ? `<a class="context-link result-context" href="${escapeHtml(contextHref)}" target="_blank" rel="noopener">看上下文 ↗</a>`
        : '';
      const secondary = (h.kind === 'passage' && h.bookHref)
        ? `<a class="result-book-link" href="${escapeHtml(h.bookHref)}">查看本书概念</a>`
        : '';
      return `
      <article class="result-item">
        <div class="meta">${metaLine}</div>
        <h3><a href="${escapeHtml(h.href || '#')}"${titleAttrs}>${highlight(h.title, q)}</a></h3>
        <p class="snippet">${highlight(h.snippet, q)}</p>
        <div class="result-actions">${context}${secondary}</div>
      </article>`;
    }).join('');
  }

  function itemKey(bookId, kind, idOrName) {
    return 'cmt:' + bookId + ':' + kind + ':' + idOrName;
  }

  function loadLocalNotes(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveLocalNote(key, note) {
    const list = loadLocalNotes(key);
    list.unshift(note);
    localStorage.setItem(key, JSON.stringify(list.slice(0, 50)));
  }

  function practiceMeta(typeId, kind) {
    const map = practiceById(kind || 'concept');
    return map[typeId] || map.understand;
  }

  function renderNoteCard(n, kind) {
    const round = n.round || n.visit;
    const roundLabel = n.kaijiang && round
      ? `<span class="visit-tag">第${escapeHtml(String(round))}轮</span>`
      : '';
    const pType = practiceMeta(n.practiceType || n.type || 'understand', kind);
    return `
      <article class="thread-item${n.kaijiang ? ' is-kaijiang' : ''}" data-practice-type="${escapeHtml(pType.id)}">
        <header>
          <span class="practice-tag">${escapeHtml(pType.chip)}</span>
          <strong>${escapeHtml(n.name || '匿名')}</strong>
          ${n.kaijiang ? '<span class="badge-kaijiang">开讲班</span>' : ''}
          ${roundLabel}
          <time datetime="${escapeHtml(n.at || '')}">${escapeHtml(formatTime(n.at))}</time>
        </header>
        <p>${escapeHtml(n.body)}</p>
      </article>
    `;
  }

  function renderNoteList(notes, kind) {
    const noun = (KIND_META[kind] || KIND_META.concept).noun;
    if (!notes.length) {
      return '<p class="thread-empty">还没有人写下与自己相关的内容。选一个方向，把' + noun + '内化进来。</p>';
    }
    const types = practiceTypesFor(kind);
    const byId = practiceById(kind);
    const order = types.map(t => t.id);
    const groups = order.map(id => ({
      meta: byId[id],
      items: notes.filter(n => (n.practiceType || n.type || 'understand') === id)
    })).filter(g => g.items.length);
    const typed = new Set(notes.map(n => n.practiceType || n.type).filter(Boolean));
    const legacy = notes.filter(n => !n.practiceType && !n.type);
    if (!typed.size && legacy.length && !groups.length) {
      return notes.map(n => renderNoteCard(n, kind)).join('');
    }
    if (groups.length <= 1) {
      return notes.map(n => renderNoteCard(n, kind)).join('');
    }
    return groups.map(g => `
      <div class="practice-group">
        <div class="practice-group-title">${escapeHtml(g.meta.label)}</div>
        ${g.items.map(n => renderNoteCard(n, kind)).join('')}
      </div>`).join('');
  }

  function renderItemTiles(book, kind, items) {
    const meta = KIND_META[kind] || KIND_META.concept;
    if (!items.length) {
      return '<p class="placeholder-note">' + meta.noun + '整理中</p>';
    }
    return `
      <div class="concept-tiles" role="list" data-kind="${escapeHtml(kind)}">
        ${items.map((c, i) => {
          const id = c.id || c.name || String(i + 1);
          const key = itemKey(book.id, kind, id);
          const count = loadLocalNotes(key).length;
          const num = String(i + 1).padStart(2, '0');
          return `
            <button type="button" class="concept-tile" role="listitem"
              data-open-item="${escapeHtml(id)}"
              data-item-kind="${escapeHtml(kind)}"
              aria-label="${num}. ${escapeHtml(c.name)}">
              <span class="concept-tile-index" aria-hidden="true">${num}</span>
              <span class="concept-tile-main">
                <span class="concept-tile-name">${escapeHtml(c.name)}</span>
              </span>
              ${count ? `<span class="concept-tile-count">${count}</span>` : ''}
            </button>`;
        }).join('')}
      </div>`;
  }

  function renderRegisterForm(user) {
    if (user) {
      return `
        <div class="panel-user" data-panel-user>
          <span>以 <strong>${escapeHtml(user.nickname)}</strong> 身份写下${user.kaijiang ? ' · 开讲班' : ''}</span>
          <button type="button" class="linkish" data-reset-user>更换</button>
        </div>`;
    }
    return `
      <form class="register-form" data-register-form>
        <p class="panel-section-label">写下前先登记（仅本机）</p>
        <input name="nickname" type="text" placeholder="昵称" required autocomplete="nickname">
        <label class="check-kaijiang">
          <input type="checkbox" name="kaijiang" data-reg-kaijiang> 我是开讲班的同学
        </label>
        <button type="submit" class="btn btn-primary btn-sm">开始写下</button>
        <p class="register-prompt-note">我的理解、好奇与践行</p>
      </form>`;
  }

  function renderInterpretForm(user, kind, options) {
    if (!user) return '';
    const opts = options || {};
    const types = opts.types || practiceTypesFor(kind);
    const defaultType = types[0];
    const noun = (KIND_META[kind] || KIND_META.concept).noun;
    const chips = types.map((t, i) => `
      <button type="button" class="practice-chip${i === 0 ? ' is-active' : ''}"
        data-practice-chip="${escapeHtml(t.id)}" aria-pressed="${i === 0 ? 'true' : 'false'}">
        ${escapeHtml(t.chip)}
      </button>`).join('');
    const roundBlock = user.kaijiang ? `
      <div class="round-row">
        <span class="round-label">这一轮是</span>
        <label class="round-opt"><input type="radio" name="round" value="1" required> 第1轮</label>
        <label class="round-opt"><input type="radio" name="round" value="2"> 第2轮</label>
        <label class="round-opt"><input type="radio" name="round" value="3"> 第3轮</label>
      </div>` : '';
    const intro = opts.intro === false ? '' : `
        <p class="panel-section-label">超级践行 · 把${escapeHtml(noun)}内化成自己的</p>
        <p class="practice-hint">重点不是评论${escapeHtml(noun)}本身，而是把它内化成自己的。选一个方向写下。</p>`;
    return `
      <form class="interpret-form" data-interpret-form>
        ${intro}
        <div class="practice-chips" role="tablist" aria-label="${escapeHtml(opts.chipLabel || '写下方向')}">${chips}</div>
        <input type="hidden" name="practiceType" value="${escapeHtml(defaultType.id)}" data-practice-type>
        <p class="practice-prompt" data-practice-prompt>${escapeHtml(defaultType.label)}</p>
        <textarea name="body" rows="4" placeholder="${escapeHtml(defaultType.placeholder)}" required data-practice-body></textarea>
        ${roundBlock}
        <button type="submit" class="btn btn-primary btn-sm">写下这条</button>
      </form>`;
  }

  function ensurePanelHost() {
    let host = document.querySelector('[data-concept-panel-host]');
    if (host) return host;
    host = document.createElement('div');
    host.setAttribute('data-concept-panel-host', '');
    document.body.appendChild(host);
    return host;
  }

  let panelWriterAbort = null;

  function closeItemPanel(kind) {
    if (panelWriterAbort) {
      panelWriterAbort.abort();
      panelWriterAbort = null;
    }
    const host = document.querySelector('[data-concept-panel-host]');
    if (!host) return;
    const sheet = host.querySelector('.concept-sheet');
    if (sheet) sheet.classList.remove('is-open');
    setTimeout(() => { host.innerHTML = ''; }, 220);
    document.body.classList.remove('panel-open');
    const hash = location.hash || '';
    const meta = KIND_META[kind];
    if (meta && hash.startsWith('#' + meta.hashPrefix)) {
      history.replaceState(null, '', location.pathname + location.search + '#' + meta.section);
    } else if (hash.startsWith('#concept-') || hash.startsWith('#method-') || hash.startsWith('#model-')) {
      const section = hash.startsWith('#method-') ? 'methods' : (hash.startsWith('#model-') ? 'models' : 'concepts');
      history.replaceState(null, '', location.pathname + location.search + '#' + section);
    }
  }

  function closeConceptPanel() { closeItemPanel(); }

  function openItemPanel(book, kind, item, index) {
    const meta = KIND_META[kind] || KIND_META.concept;
    const host = ensurePanelHost();
    if (panelWriterAbort) panelWriterAbort.abort();
    panelWriterAbort = new AbortController();
    const id = item.id || item.name;
    const key = itemKey(book.id, kind, id);
    const notes = loadLocalNotes(key);
    const user = getUser();
    const srcUrl = itemSourceUrl(book, item);
    const excerpt = asExcerpt(item.blurb);

    host.innerHTML = `
      <div class="concept-backdrop" data-close-panel></div>
      <aside class="concept-sheet" role="dialog" aria-modal="true" aria-labelledby="concept-sheet-title">
        <header class="concept-sheet-head">
          <button type="button" class="sheet-close" data-close-panel aria-label="关闭">✕</button>
          ${typeof index === 'number' ? `<div class="concept-sheet-index" aria-hidden="true">${String(index + 1).padStart(2, '0')}</div>` : ''}
          <h2 id="concept-sheet-title">${escapeHtml(item.name)}</h2>
        </header>
        <div class="concept-sheet-body">
          <section class="panel-block">
            <div class="panel-section-label-row">
              <span class="panel-section-label">书里原文</span>
              <a class="context-link" href="${escapeHtml(srcUrl)}" target="_blank" rel="noopener">看上下文 ↗</a>
            </div>
            <blockquote class="panel-excerpt">${escapeHtml(excerpt || '（原文整理中）')}</blockquote>
          </section>

          <section class="panel-block">
            <div class="panel-section-label-row">
              <span class="panel-section-label">超级践行</span>
              <span class="panel-muted">${notes.length ? notes.length + ' 条' : ''}</span>
            </div>
            <p class="practice-frame">真正内化往往要反复打磨。欢迎你多次回来，再写一版理解与践行。</p>
            <div class="thread-list" data-panel-thread>${renderNoteList(notes, kind)}</div>
          </section>

          <section class="panel-block panel-write" data-panel-write>
            ${renderRegisterForm(user)}
            ${renderInterpretForm(user, kind)}
          </section>
        </div>
      </aside>
    `;

    requestAnimationFrame(() => {
      const sheet = host.querySelector('.concept-sheet');
      if (sheet) sheet.classList.add('is-open');
    });
    document.body.classList.add('panel-open');
    history.replaceState(null, '', location.pathname + location.search + '#' + meta.hashPrefix + encodeURIComponent(id));

    host.querySelectorAll('[data-close-panel]').forEach(el => {
      el.addEventListener('click', () => closeItemPanel(kind));
    });

    const write = host.querySelector('[data-panel-write]');

    function refreshWrite() {
      const u = getUser();
      write.innerHTML = renderRegisterForm(u) + renderInterpretForm(u, kind);
      bindWrite();
    }

    function bindWrite() {
      const reg = write.querySelector('[data-register-form]');
      if (reg) {
        reg.addEventListener('submit', (e) => {
          e.preventDefault();
          const fd = new FormData(reg);
          const nickname = String(fd.get('nickname') || '').trim();
          if (!nickname) return;
          setUser({
            nickname,
            kaijiang: !!fd.get('kaijiang')
          });
          document.dispatchEvent(new CustomEvent('concept-lib:user'));
          refreshWrite();
        });
      }
      const reset = write.querySelector('[data-reset-user]');
      if (reset) {
        reset.addEventListener('click', () => {
          localStorage.removeItem(USER_KEY);
          document.dispatchEvent(new CustomEvent('concept-lib:user'));
          refreshWrite();
        });
      }
      const form = write.querySelector('[data-interpret-form]');
      if (form) {
        const typeInput = form.querySelector('[data-practice-type]');
        const promptEl = form.querySelector('[data-practice-prompt]');
        const bodyEl = form.querySelector('[data-practice-body]');
        form.querySelectorAll('[data-practice-chip]').forEach(chip => {
          chip.addEventListener('click', () => {
            const tid = chip.getAttribute('data-practice-chip');
            const pmeta = practiceMeta(tid, kind);
            form.querySelectorAll('[data-practice-chip]').forEach(c => {
              const on = c === chip;
              c.classList.toggle('is-active', on);
              c.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
            if (typeInput) typeInput.value = pmeta.id;
            if (promptEl) promptEl.textContent = pmeta.label;
            if (bodyEl) bodyEl.setAttribute('placeholder', pmeta.placeholder);
          });
        });
        form.addEventListener('submit', (e) => {
          e.preventDefault();
          const u = getUser();
          if (!u) return;
          const fd = new FormData(form);
          const body = String(fd.get('body') || '').trim();
          if (!body) return;
          const round = u.kaijiang ? String(fd.get('round') || '').trim() : '';
          if (u.kaijiang && !round) {
            alert('请选择这是第几轮');
            return;
          }
          const practiceType = String(fd.get('practiceType') || 'understand');
          const note = {
            name: u.nickname,
            body,
            practiceType,
            kaijiang: !!u.kaijiang,
            round,
            at: nowIso()
          };
          saveLocalNote(key, note);
          const list = loadLocalNotes(key);
          host.querySelector('[data-panel-thread]').innerHTML = renderNoteList(list, kind);
          document.dispatchEvent(new CustomEvent('concept-lib:notes', {
            detail: { key: key, kind: kind, id: id }
          }));
          const keepType = practiceType;
          form.reset();
          if (typeInput) typeInput.value = keepType;
          const pmeta = practiceMeta(keepType, kind);
          if (promptEl) promptEl.textContent = pmeta.label;
          if (bodyEl) bodyEl.setAttribute('placeholder', pmeta.placeholder);
          form.querySelectorAll('[data-practice-chip]').forEach(c => {
            const on = c.getAttribute('data-practice-chip') === keepType;
            c.classList.toggle('is-active', on);
            c.setAttribute('aria-pressed', on ? 'true' : 'false');
          });
          const tile = Array.from(document.querySelectorAll('[data-open-item]'))
            .find(el => el.getAttribute('data-open-item') === id && el.getAttribute('data-item-kind') === kind);
          if (tile) {
            let badge = tile.querySelector('.concept-tile-count');
            if (!badge) {
              badge = document.createElement('span');
              badge.className = 'concept-tile-count';
              tile.appendChild(badge);
            }
            badge.textContent = String(list.length);
          }
        });
      }
    }
    bindWrite();
    document.addEventListener('concept-lib:user', refreshWrite, { signal: panelWriterAbort.signal });
    document.dispatchEvent(new CustomEvent('concept-lib:select', {
      detail: {
        bookId: book.id,
        kind: kind,
        id: id,
        index: typeof index === 'number' ? index : -1
      }
    }));
  }

  function openConceptPanel(book, item, index) {
    openItemPanel(book, 'concept', item, index);
  }

  function searchContextInBook(book, query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return [];
    const pool = []
      .concat((book.concepts || []).map(c => ({ kind: '概念', item: c })))
      .concat((book.methods || []).map(m => ({ kind: '方法', item: m })))
      .concat((book.models || []).map(m => ({ kind: '模型', item: m })));
    return pool.filter(({ item }) => {
      const hay = [item.name, item.blurb].join(' ').toLowerCase();
      return hay.includes(q);
    }).slice(0, 8);
  }

  function renderBookDetail(book, mount) {
    const concepts = (book.concepts || []);
    const methods = (book.methods || []);
    const models = (book.models || []);
    const source = primarySource(book);

    const modelsSection = `
      <section class="section section-concepts" id="models">
        <div class="section-head">
          <h2>模型 <span class="count-pill">${models.length}</span></h2>
          <p class="section-hint">点开模型名，看原文，并写下理解、好奇、与我相关，或你的践行。</p>
        </div>
        ${renderItemTiles(book, 'model', models)}
        <div class="suggest-compact suggest-quiet">
          <button type="button" class="btn btn-ghost btn-sm" data-toggle-suggest>＋ 提议还缺的模型</button>
          <div class="suggest-box" id="suggest-model" hidden>
            <form class="suggest-form" data-suggest-form data-suggest-kind="model">
              <input name="name" type="text" placeholder="模型名称" required>
              <textarea name="why" rows="2" placeholder="为什么值得列？（可选）"></textarea>
              <input name="nick" type="text" placeholder="昵称（可选）">
              <button type="submit" class="btn btn-primary btn-sm">提交提议</button>
            </form>
            <div class="suggest-list" data-suggest-list></div>
          </div>
        </div>
      </section>`;

    mount.innerHTML = `
      <div class="detail-hero">
        <div class="cover-placeholder" aria-hidden="true">${escapeHtml(book.type)}</div>
        <div>
          <span class="${chipClass(book.type)}">${escapeHtml(book.type)}</span>
          <h1>${escapeHtml(book.title)}</h1>
          <p class="meta-line">${escapeHtml(bookByline(book))}</p>
          <p class="detail-summary">${escapeHtml(book.summary)}</p>
          <div class="book-actions">
            <a class="btn btn-ghost" href="${escapeHtml(source)}" target="_blank" rel="noopener">在原站打开</a>
            <a class="btn btn-ghost" href="books.html">返回书库</a>
          </div>
        </div>
      </div>

      <section class="section section-concepts" id="concepts">
        <div class="section-head">
          <h2>关键概念 <span class="count-pill">${concepts.length}</span></h2>
          <p class="section-hint">点开概念名，看原文，并写下理解、好奇、与我相关，或你的践行。</p>
        </div>
        ${renderItemTiles(book, 'concept', concepts)}
        <div class="suggest-compact suggest-quiet">
          <div class="suggest-bar">
            <button type="button" class="btn btn-ghost btn-sm" data-toggle-suggest>＋ 提议还缺的概念</button>
            <button type="button" class="btn btn-ghost btn-sm" data-lookup-context>查上下文</button>
          </div>
          <div class="suggest-box" id="suggest-concept" hidden>
            <p class="section-hint">提交后先收集，不会自动变成正式概念。查上下文可在本页概念库中检索，并打开原书。</p>
            <form class="suggest-form" data-suggest-form data-suggest-kind="concept">
              <input name="name" type="text" placeholder="概念名称" required data-suggest-name>
              <textarea name="why" rows="2" placeholder="为什么值得列？（可选）"></textarea>
              <input name="nick" type="text" placeholder="昵称（可选）">
              <div class="suggest-actions">
                <button type="button" class="btn btn-ghost btn-sm" data-suggest-lookup>在概念库中查找</button>
                <button type="submit" class="btn btn-primary btn-sm">提交提议</button>
              </div>
            </form>
            <div class="context-hits" data-context-hits hidden></div>
            <div class="suggest-list" data-suggest-list></div>
          </div>
        </div>
      </section>

      <section class="section section-concepts" id="methods">
        <div class="section-head">
          <h2>方法论 <span class="count-pill">${methods.length}</span></h2>
          <p class="section-hint">点开方法名，看原文，并写下理解、好奇、与我相关，或你的践行。</p>
        </div>
        ${renderItemTiles(book, 'method', methods)}
        <div class="suggest-compact suggest-quiet">
          <button type="button" class="btn btn-ghost btn-sm" data-toggle-suggest>＋ 提议还缺的方法</button>
          <div class="suggest-box" id="suggest-method" hidden>
            <form class="suggest-form" data-suggest-form data-suggest-kind="method">
              <input name="name" type="text" placeholder="方法名称" required>
              <textarea name="why" rows="2" placeholder="为什么值得列？（可选）"></textarea>
              <input name="nick" type="text" placeholder="昵称（可选）">
              <button type="submit" class="btn btn-primary btn-sm">提交提议</button>
            </form>
            <div class="suggest-list" data-suggest-list></div>
          </div>
        </div>
      </section>

      ${modelsSection}

      <section class="section section-quiet" id="lectures">
        <h2>开讲班 · 超级践行</h2>
        <p class="placeholder-note">开讲班同学登记身份后，写下的内容会带上第几轮；此处保留期次汇总入口。</p>
      </section>
    `;

    function itemsForKind(kind) {
      if (kind === 'method') return methods;
      if (kind === 'model') return models;
      return concepts;
    }

    mount.querySelectorAll('[data-open-item]').forEach(btn => {
      btn.addEventListener('click', () => {
        const kind = btn.getAttribute('data-item-kind') || 'concept';
        const cid = btn.getAttribute('data-open-item');
        const list = itemsForKind(kind);
        const idx = list.findIndex(c => (c.id || c.name) === cid);
        const item = idx >= 0 ? list[idx] : null;
        if (item) openItemPanel(book, kind, item, idx);
      });
    });

    // Hash deep-link: #concept-C01 / #method-M01 / #model-MOD01
    function openCurrentHash() {
      const hash = location.hash || '';
      function openFromHash(prefix, kind) {
        if (!hash.startsWith(prefix)) return false;
        const cid = decodeURIComponent(hash.slice(prefix.length));
        const list = itemsForKind(kind);
        const idx = list.findIndex(c => (c.id || c.name) === cid);
        const item = idx >= 0 ? list[idx] : null;
        if (item) openItemPanel(book, kind, item, idx);
        return !!item;
      }
      return openFromHash('#concept-', 'concept') || openFromHash('#method-', 'method') || openFromHash('#model-', 'model');
    }
    setTimeout(openCurrentHash, 60);
    window.addEventListener('hashchange', openCurrentHash);

    document.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape') closeItemPanel();
    });

    mount.querySelectorAll('[data-toggle-suggest]').forEach(btn => {
      btn.addEventListener('click', () => {
        const box = btn.closest('.suggest-compact').querySelector('.suggest-box');
        if (box.hasAttribute('hidden')) box.removeAttribute('hidden');
        else box.setAttribute('hidden', '');
      });
    });

    function showContextHits(query, box) {
      const hitsEl = box.querySelector('[data-context-hits]');
      if (!hitsEl) return;
      const hits = searchContextInBook(book, query);
      hitsEl.hidden = false;
      if (!hits.length) {
        hitsEl.innerHTML = `
          <p class="section-hint">本页概念库未命中「${escapeHtml(query)}」。全文检索稍后接入；也可先打开原书浏览。</p>
          <a class="btn btn-ghost btn-sm" href="${escapeHtml(source)}" target="_blank" rel="noopener">打开原书 ↗</a>`;
        return;
      }
      hitsEl.innerHTML = `
        <p class="section-hint">在本页找到 ${hits.length} 处相关（全书全文检索稍后接入）：</p>
        <ul class="context-hit-list">
          ${hits.map(({ kind, item }) => `
            <li>
              <button type="button" class="linkish" data-hit-open="${escapeHtml(item.id || item.name)}" data-hit-kind="${escapeHtml(kind)}">
                <span class="hit-kind">${escapeHtml(kind)}</span> ${escapeHtml(item.name)}
              </button>
              <p>${escapeHtml(asExcerpt(item.blurb).slice(0, 72))}${asExcerpt(item.blurb).length > 72 ? '…' : ''}</p>
            </li>`).join('')}
        </ul>
        <a class="btn btn-ghost btn-sm" href="${escapeHtml(source)}" target="_blank" rel="noopener">打开原书看上下文 ↗</a>`;
      hitsEl.querySelectorAll('[data-hit-open]').forEach(b => {
        b.addEventListener('click', () => {
          const cid = b.getAttribute('data-hit-open');
          const kindLabel = b.getAttribute('data-hit-kind');
          const kind = kindLabel === '方法' ? 'method' : (kindLabel === '模型' ? 'model' : 'concept');
          const list = itemsForKind(kind);
          const idx = list.findIndex(c => (c.id || c.name) === cid);
          const item = idx >= 0 ? list[idx] : null;
          if (item) openItemPanel(book, kind, item, idx);
        });
      });
    }

    mount.querySelectorAll('[data-lookup-context]').forEach(btn => {
      btn.addEventListener('click', () => {
        const compact = btn.closest('.suggest-compact');
        const box = compact.querySelector('.suggest-box');
        box.removeAttribute('hidden');
        const nameInput = box.querySelector('[data-suggest-name]');
        const q = (nameInput && nameInput.value.trim()) || window.prompt('输入要查的概念关键词', '') || '';
        if (nameInput && q) nameInput.value = q;
        if (q) showContextHits(q, box);
        else {
          window.open(source, '_blank', 'noopener');
        }
      });
    });

    mount.querySelectorAll('[data-suggest-lookup]').forEach(btn => {
      btn.addEventListener('click', () => {
        const box = btn.closest('.suggest-box');
        const nameInput = box.querySelector('[data-suggest-name]');
        const q = (nameInput && nameInput.value.trim()) || '';
        if (!q) {
          alert('先填写概念名称，再查找');
          return;
        }
        showContextHits(q, box);
      });
    });

    function refreshSuggestLists() {
      mount.querySelectorAll('[data-suggest-form]').forEach(form => {
        const kind = form.getAttribute('data-suggest-kind');
        const key = 'suggest:' + book.id + ':' + kind;
        const box = form.parentElement.querySelector('[data-suggest-list]');
        const items = loadLocalNotes(key);
        box.innerHTML = items.length
          ? items.map(s => `<div class="suggest-item"><strong>${escapeHtml(s.name)}</strong>${s.why ? `<span> — ${escapeHtml(s.why)}</span>` : ''}<em> · ${escapeHtml(s.nick || '匿名')}</em></div>`).join('')
          : '';
      });
    }
    refreshSuggestLists();

    mount.querySelectorAll('[data-suggest-form]').forEach(form => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const kind = form.getAttribute('data-suggest-kind');
        const fd = new FormData(form);
        const name = String(fd.get('name') || '').trim();
        if (!name) return;
        saveLocalNote('suggest:' + book.id + ':' + kind, {
          name,
          why: String(fd.get('why') || '').trim(),
          nick: String(fd.get('nick') || '').trim(),
          at: nowIso()
        });
        form.reset();
        refreshSuggestLists();
        alert('已收到提议（本机暂存）。正式收集上云后会统一整理。');
      });
    });
  }

  function mountCompanion(book) {
    const slot = document.querySelector('[data-companion-slot]');
    if (!slot) return { setPassages() {} };

    const COMPANION_STOP = new Set(['的', '了', '是', '在', '和', '与', '或', '及', '把', '被', '对', '从', '为', '以', '而', '也', '就', '都', '这', '那', '一个', '一种', '可以', '我们', '自己', '什么', '如何', '以及', '其中', '这个', '核心', '方法', '概念', '必须', '不是', '就是', '作者', '主张', '待核验']);
    const bookRecapKey = 'recap:' + book.id;
    const mq = window.matchMedia('(max-width: 1239px)');
    let passages = [];
    let passagesReady = false;
    let selection = null;
    let currentTab = 'map';

    slot.innerHTML = `
      <aside class="companion" data-companion aria-label="陪读">
        <div class="companion-tabs" role="tablist" aria-label="陪读栏目">
          <button type="button" class="companion-tab" id="companion-tab-map" role="tab" data-tab="map" aria-controls="companion-panel-map" aria-selected="true">地图</button>
          <button type="button" class="companion-tab" id="companion-tab-read" role="tab" data-tab="read" aria-controls="companion-panel-read" aria-selected="false" tabindex="-1">伴读<span class="tab-dot" data-tab-dot="read" hidden></span></button>
          <button type="button" class="companion-tab" id="companion-tab-recap" role="tab" data-tab="recap" aria-controls="companion-panel-recap" aria-selected="false" tabindex="-1">复盘</button>
        </div>
        <div class="companion-sheet" data-companion-sheet>
          <div class="companion-handle">
            <span class="companion-handle-title">陪读</span>
            <button type="button" class="companion-close" data-companion-close>收起</button>
          </div>
          <div class="companion-panels">
            <div role="tabpanel" id="companion-panel-map" data-panel="map" aria-labelledby="companion-tab-map"></div>
            <div role="tabpanel" id="companion-panel-read" data-panel="read" aria-labelledby="companion-tab-read" hidden></div>
            <div role="tabpanel" id="companion-panel-recap" data-panel="recap" aria-labelledby="companion-tab-recap" hidden></div>
          </div>
        </div>
      </aside>`;

    const root = slot.querySelector('[data-companion]');
    const sheet = root.querySelector('[data-companion-sheet]');
    const scrim = document.createElement('div');
    scrim.className = 'companion-scrim';
    scrim.hidden = true;
    scrim.setAttribute('data-companion-scrim', '');
    document.body.appendChild(scrim);

    function findItem(kind, id) {
      const meta = KIND_META[kind];
      if (!meta) return null;
      const list = book[meta.section] || [];
      const index = list.findIndex(item => (item.id || item.name) === id);
      if (index < 0) return null;
      return { item: list[index], index };
    }

    function itemKeywords(name) {
      const parts = String(name || '').split(/[／/、，,：:；;（）()「」“”"'《》·—–\s]+/);
      const out = [];
      parts.forEach(raw => {
        const s = raw.trim();
        if (s.length < 2 || COMPANION_STOP.has(s)) return;
        if (/^[\d.§]+$/.test(s)) return;
        if (/^[A-Za-z0-9]+$/.test(s) && s.length < 4) return;
        out.push(s);
      });
      return [...new Set(out)];
    }

    function glossOf(blurb) {
      const text = asExcerpt(blurb);
      if (!text) return '';
      const sentence = text.split(/[。！？]/)[0].trim();
      if (!sentence) return '';
      return sentence.length > 46 ? sentence.slice(0, 46) + '…' : sentence;
    }

    function scrollPanelTo(el) {
      if (!el) return;
      const scroller = el.closest('.companion-panels');
      if (!scroller) return;
      const elRect = el.getBoundingClientRect();
      const scRect = scroller.getBoundingClientRect();
      if (elRect.top < scRect.top + 8 || elRect.bottom > scRect.bottom - 8) {
        scroller.scrollTop += elRect.top - scRect.top - 12;
      }
    }

    function passagesFor(item) {
      const keys = itemKeywords(item.name);
      const chap = item.sourceUrl ? chapterKey(item.sourceUrl) : '';
      const ranked = [];
      passages.forEach(p => {
        if (p.bookId !== book.id) return;
        const heading = p.heading || '';
        const text = p.text || '';
        const same = !!(chap && chapterKey(p.url) === chap);
        let score = same ? 8 : 0;
        let matched = '';
        keys.forEach(k => {
          const inHead = heading.includes(k);
          const inText = text.includes(k);
          if (!inHead && !inText) return;
          if (!same && k.length < 4) return;
          score += (k.length >= 4 ? 4 : 2) + (inHead ? 3 : 0);
          if (k.length > matched.length) matched = k;
        });
        if (!same && !keys.some(k => k.length >= 4 && (heading.includes(k) || text.includes(k)))) score = 0;
        if (score > 0) ranked.push({ p, score, matched, same });
      });
      ranked.sort((a, b) => b.score - a.score);
      const seen = new Set();
      const unique = [];
      ranked.forEach(row => {
        const marker = (row.p.heading || '') + '|' + chapterKey(row.p.url);
        if (seen.has(marker)) return;
        seen.add(marker);
        unique.push(row);
      });
      const picked = unique.filter(row => row.same).slice(0, 2);
      unique.filter(row => !row.same && row.score >= 6).slice(0, 1).forEach(row => {
        if (picked.length < 3) picked.push(row);
      });
      return picked;
    }

    function relatedFor(kind, item) {
      const selfId = item.id || item.name;
      const chap = item.sourceUrl ? chapterKey(item.sourceUrl) : '';
      const keys = itemKeywords(item.name);
      const rows = [];
      ['concept', 'method', 'model'].forEach(k => {
        (book[KIND_META[k].section] || []).forEach((it, index) => {
          if (k === kind && (it.id || it.name) === selfId) return;
          const same = !!(chap && it.sourceUrl && chapterKey(it.sourceUrl) === chap);
          const overlap = keys.filter(key => key.length >= 3 && itemKeywords(it.name).includes(key));
          const score = (same ? 5 : 0) + overlap.length * 3;
          if (!score) return;
          rows.push({ kind: k, item: it, index, score });
        });
      });
      rows.sort((a, b) => b.score - a.score);
      return rows.slice(0, 4);
    }

    function syncExpanded() {
      const open = !mq.matches || root.classList.contains('is-open');
      root.querySelectorAll('[data-tab]').forEach(tab => {
        const on = tab.getAttribute('aria-selected') === 'true';
        tab.setAttribute('aria-expanded', on && open ? 'true' : 'false');
      });
    }

    function closeSheet() {
      root.classList.remove('is-open');
      scrim.hidden = true;
      document.body.classList.remove('companion-open');
      if (mq.matches) sheet.inert = true;
      syncExpanded();
    }

    function openSheet() {
      if (!mq.matches) return;
      root.classList.add('is-open');
      scrim.hidden = false;
      sheet.inert = false;
      document.body.classList.add('companion-open');
      syncExpanded();
    }

    function selectTab(name) {
      if (mq.matches && name === currentTab && root.classList.contains('is-open')) {
        closeSheet();
        return;
      }
      currentTab = name;
      root.querySelectorAll('[data-tab]').forEach(tab => {
        const on = tab.getAttribute('data-tab') === name;
        tab.setAttribute('aria-selected', on ? 'true' : 'false');
        tab.tabIndex = on ? 0 : -1;
      });
      root.querySelectorAll('[data-panel]').forEach(panel => {
        panel.hidden = panel.getAttribute('data-panel') !== name;
      });
      if (name === 'read') {
        const dot = root.querySelector('[data-tab-dot="read"]');
        if (dot) dot.hidden = true;
      }
      if (mq.matches) openSheet();
      syncExpanded();
    }

    function paintCurrent() {
      document.querySelectorAll('.concept-tile.is-current').forEach(el => {
        el.classList.remove('is-current');
        el.removeAttribute('aria-current');
      });
      root.querySelectorAll('.map-row.is-current').forEach(el => el.classList.remove('is-current'));
      root.querySelectorAll('.map-hit[aria-current]').forEach(el => el.removeAttribute('aria-current'));
      if (!selection) return;
      document.querySelectorAll('.concept-tile').forEach(tile => {
        if (tile.getAttribute('data-open-item') === selection.id && tile.getAttribute('data-item-kind') === selection.kind) {
          tile.classList.add('is-current');
          tile.setAttribute('aria-current', 'true');
        }
      });
      const row = root.querySelector('.map-row[data-item-kind="' + selection.kind + '"][data-map-id="' + CSS.escape(selection.id) + '"]');
      if (!row) return;
      row.classList.add('is-current');
      const hit = row.querySelector('.map-hit');
      if (hit) hit.setAttribute('aria-current', 'true');
      const panel = row.closest('[role="tabpanel"]');
      if (panel && !panel.hidden) scrollPanelTo(row);
    }

    function paintTileCount(kind, id) {
      const count = loadLocalNotes(itemKey(book.id, kind, id)).length;
      document.querySelectorAll('.concept-tile').forEach(tile => {
        if (tile.getAttribute('data-open-item') !== id || tile.getAttribute('data-item-kind') !== kind) return;
        let badge = tile.querySelector('.concept-tile-count');
        if (!count) {
          if (badge) badge.remove();
          return;
        }
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'concept-tile-count';
          tile.appendChild(badge);
        }
        badge.textContent = String(count);
      });
    }

    function paintMapCount(kind, id) {
      const row = root.querySelector('.map-row[data-item-kind="' + kind + '"][data-map-id="' + CSS.escape(id) + '"]');
      if (!row) return;
      const count = loadLocalNotes(itemKey(book.id, kind, id)).length;
      const nameRow = row.querySelector('.map-name-row');
      if (!nameRow) return;
      let badge = nameRow.querySelector('.map-count');
      if (!count) {
        if (badge) badge.remove();
        return;
      }
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'map-count';
        nameRow.appendChild(badge);
      }
      badge.textContent = String(count);
    }

    function refreshOpenThread(kind, id) {
      const meta = KIND_META[kind];
      if (!meta) return;
      if ((location.hash || '') !== '#' + meta.hashPrefix + encodeURIComponent(id)) return;
      const thread = document.querySelector('[data-concept-panel-host] [data-panel-thread]');
      if (!thread) return;
      const notes = loadLocalNotes(itemKey(book.id, kind, id));
      thread.innerHTML = renderNoteList(notes, kind);
      const countEl = document.querySelector('[data-concept-panel-host] .panel-muted');
      if (countEl) countEl.textContent = notes.length ? notes.length + ' 条' : '';
    }

    function renderMap() {
      const panel = root.querySelector('[data-panel="map"]');
      const groups = [
        ['concept', '概念', book.concepts || []],
        ['method', '方法', book.methods || []],
        ['model', '模型', book.models || []]
      ].filter(group => group[2].length);
      if (!groups.length) {
        panel.innerHTML = '<p class="companion-lead">这本书还没有抽出概念、方法或模型。</p>';
        return;
      }
      panel.innerHTML = `
        <p class="companion-lead">按概念、方法、模型来定方位。</p>
        <p class="companion-lead">点名字打开卡片。这不是目录。</p>
        ${groups.map(([kind, label, items]) => `
          <section class="map-group">
            <h3>${label} <span class="count-pill">${items.length}</span></h3>
            ${items.map((item, index) => {
              const id = item.id || item.name;
              const num = String(index + 1).padStart(2, '0');
              const count = loadLocalNotes(itemKey(book.id, kind, id)).length;
              const gloss = glossOf(item.blurb);
              const src = item.sourceUrl || '';
              return `
                <div class="map-row" data-map-id="${escapeHtml(id)}" data-item-kind="${kind}">
                  <button type="button" class="map-hit" data-map-open="${escapeHtml(id)}" data-item-kind="${kind}">
                    <span class="map-index" aria-hidden="true">${num}</span>
                    <span class="map-copy">
                      <span class="map-name-row">
                        <span class="map-name">${escapeHtml(item.name)}</span>
                        ${count ? `<span class="map-count">${count}</span>` : ''}
                      </span>
                      ${gloss ? `<span class="map-gloss">${escapeHtml(gloss)}</span>` : ''}
                    </span>
                  </button>
                  ${src ? `<a class="context-link map-context" href="${escapeHtml(src)}" target="_blank" rel="noopener">看上下文</a>` : ''}
                </div>`;
            }).join('')}
          </section>`).join('')}`;
      paintCurrent();
    }

    function relatedBlock(title, id, rows, empty) {
      const list = rows.length
        ? `<div class="related-list">${rows.map(row => `
            <button type="button" class="related-hit" data-related-open="${escapeHtml(row.item.id || row.item.name)}" data-item-kind="${row.kind}">
              <span class="related-index">${String(row.index + 1).padStart(2, '0')}</span>
              <span class="related-name">${escapeHtml(row.item.name)}</span>
            </button>`).join('')}</div>`
        : `<p class="companion-lead">${empty}</p>`;
      return `<section class="companion-section" id="${id}"><h3>${title}</h3>${list}</section>`;
    }

    function renderRead() {
      const panel = root.querySelector('[data-panel="read"]');
      if (!selection) {
        panel.innerHTML = '<p class="companion-lead">打开一张卡片之后，这里放上它的意思、同书相关的卡片，以及能对上的原文。</p>';
        return;
      }
      const found = findItem(selection.kind, selection.id);
      if (!found) {
        panel.innerHTML = '<p class="companion-lead">这张卡片不在当前书里。</p>';
        return;
      }
      const item = found.item;
      const meta = KIND_META[selection.kind] || KIND_META.concept;
      const num = String(found.index + 1).padStart(2, '0');
      const src = item.sourceUrl || '';
      const related = relatedFor(selection.kind, item);
      const concepts = related.filter(row => row.kind === 'concept');
      const methods = related.filter(row => row.kind === 'method');
      const models = related.filter(row => row.kind === 'model');
      let passagesHtml = '';
      if (!passagesReady) {
        passagesHtml = '<p class="companion-lead">正在对照这本书的原文短摘。</p>';
      } else {
        const hits = passagesFor(item);
        passagesHtml = hits.length
          ? hits.map(row => {
              const text = excerptAround(row.p.text || row.p.snippet, row.matched, 120);
              return `
                <article class="passage-card">
                  <p class="passage-heading">${escapeHtml(row.p.heading || '原文')}</p>
                  <p>${escapeHtml(text)}</p>
                  ${row.p.url ? `<a class="context-link" href="${escapeHtml(row.p.url)}" target="_blank" rel="noopener">看上下文</a>` : ''}
                </article>`;
            }).join('')
          : '<p class="companion-lead">原文短摘里没有对上这张卡片的段落。</p>';
      }
      panel.innerHTML = `
        <p class="companion-kicker">${escapeHtml(meta.noun)} ${num}</p>
        <h3 class="companion-title">${escapeHtml(item.name)}</h3>
        <section class="companion-section">
          <div class="panel-section-label-row">
            <span class="panel-section-label">意思</span>
            ${src ? `<a class="context-link" href="${escapeHtml(src)}" target="_blank" rel="noopener">看上下文</a>` : ''}
          </div>
          <blockquote class="panel-excerpt">${escapeHtml(asExcerpt(item.blurb) || '（这张卡片还没有整理出意思）')}</blockquote>
        </section>
        <div class="quick-actions">
          <button type="button" class="quick-action" data-qa="concepts">本页相关概念</button>
          ${src
            ? `<a class="quick-action" href="${escapeHtml(src)}" target="_blank" rel="noopener">看原文上下文</a>`
            : '<button type="button" class="quick-action" disabled>看原文上下文</button>'}
          <button type="button" class="quick-action" data-qa="methods">相关方法论</button>
        </div>
        ${relatedBlock('相关概念', 'companion-related-concepts', concepts, '同书里没有抽出直接相关的概念。')}
        ${relatedBlock('相关方法论', 'companion-related-methods', methods, '同书里没有抽出直接相关的方法。')}
        ${models.length ? relatedBlock('相关模型', 'companion-related-models', models, '') : ''}
        <section class="companion-section" id="companion-passages">
          <h3>原文</h3>
          ${passagesHtml}
        </section>`;
    }

    function bindRegister(container) {
      const reg = container.querySelector('[data-register-form]');
      if (reg) {
        reg.addEventListener('submit', (e) => {
          e.preventDefault();
          const fd = new FormData(reg);
          const nickname = String(fd.get('nickname') || '').trim();
          if (!nickname) return;
          setUser({ nickname, kaijiang: !!fd.get('kaijiang') });
          document.dispatchEvent(new CustomEvent('concept-lib:user'));
        });
      }
      const reset = container.querySelector('[data-reset-user]');
      if (reset) {
        reset.addEventListener('click', () => {
          localStorage.removeItem(USER_KEY);
          document.dispatchEvent(new CustomEvent('concept-lib:user'));
        });
      }
    }

    function bindInterpretForm(form, opts) {
      const types = opts.types || practiceTypesFor(opts.kind);
      const byId = Object.fromEntries(types.map(t => [t.id, t]));
      const typeInput = form.querySelector('[data-practice-type]');
      const promptEl = form.querySelector('[data-practice-prompt]');
      const bodyEl = form.querySelector('[data-practice-body]');
      form.querySelectorAll('[data-practice-chip]').forEach(chip => {
        chip.addEventListener('click', () => {
          const tid = chip.getAttribute('data-practice-chip');
          const pmeta = byId[tid] || practiceMeta(tid, opts.kind);
          form.querySelectorAll('[data-practice-chip]').forEach(other => {
            const on = other === chip;
            other.classList.toggle('is-active', on);
            other.setAttribute('aria-pressed', on ? 'true' : 'false');
          });
          if (typeInput) typeInput.value = pmeta.id;
          if (promptEl) promptEl.textContent = pmeta.label;
          if (bodyEl) bodyEl.setAttribute('placeholder', pmeta.placeholder);
        });
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const user = getUser();
        if (!user) return;
        const fd = new FormData(form);
        const body = String(fd.get('body') || '').trim();
        if (!body) return;
        const round = user.kaijiang ? String(fd.get('round') || '').trim() : '';
        if (user.kaijiang && !round) {
          alert('请选择这是第几轮');
          return;
        }
        const practiceType = String(fd.get('practiceType') || types[0].id);
        saveLocalNote(opts.key, {
          name: user.nickname,
          body,
          practiceType,
          kaijiang: !!user.kaijiang,
          round,
          at: nowIso()
        });
        form.reset();
        const kept = byId[practiceType] || practiceMeta(practiceType, opts.kind);
        if (typeInput) typeInput.value = kept.id;
        if (promptEl) promptEl.textContent = kept.label;
        if (bodyEl) bodyEl.setAttribute('placeholder', kept.placeholder);
        form.querySelectorAll('[data-practice-chip]').forEach(chip => {
          const on = chip.getAttribute('data-practice-chip') === kept.id;
          chip.classList.toggle('is-active', on);
          chip.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        document.dispatchEvent(new CustomEvent('concept-lib:notes', {
          detail: { key: opts.key, kind: opts.kind, id: opts.id || '' }
        }));
      });
    }

    function paintBookNotes() {
      const el = root.querySelector('[data-book-notes]');
      if (!el) return;
      const notes = loadLocalNotes(bookRecapKey);
      el.innerHTML = notes.length ? notes.map(note => renderNoteCard(note, 'concept')).join('') : '';
    }

    function paintCardNotes() {
      const el = root.querySelector('[data-card-notes]');
      if (!el || !selection) return;
      const notes = loadLocalNotes(itemKey(book.id, selection.kind, selection.id));
      el.innerHTML = notes.length ? notes.map(note => renderNoteCard(note, selection.kind)).join('') : '';
    }

    function paintRecapCard() {
      const host = root.querySelector('[data-recap-card]');
      if (!host) return;
      if (!selection) {
        host.innerHTML = `
          <p class="companion-kicker">当前卡片</p>
          <p class="companion-lead">打开一张卡片后，可以在这里写理解、好奇、与我相关和践行。和卡片里是同一份记录。</p>`;
        return;
      }
      const found = findItem(selection.kind, selection.id);
      if (!found) {
        host.innerHTML = '';
        return;
      }
      const user = getUser();
      const noun = (KIND_META[selection.kind] || KIND_META.concept).noun;
      host.innerHTML = `
        <p class="companion-kicker">当前卡片 · ${escapeHtml(noun)}</p>
        <h3 class="companion-title">${escapeHtml(found.item.name)}</h3>
        <p class="companion-lead">理解、好奇、与我相关、践行。和这张卡片里是同一份记录。</p>
        ${user ? '' : '<p class="companion-lead">先在上面登记昵称，再写到这张卡片上。</p>'}
        <div data-recap-card-write></div>
        <div class="recap-notes" data-card-notes></div>`;
      if (user) {
        const write = host.querySelector('[data-recap-card-write]');
        write.innerHTML = renderInterpretForm(user, selection.kind, {
          intro: false,
          chipLabel: '这张卡片的写下方向'
        });
        const form = write.querySelector('[data-interpret-form]');
        if (form) {
          bindInterpretForm(form, {
            kind: selection.kind,
            key: itemKey(book.id, selection.kind, selection.id),
            id: selection.id,
            types: practiceTypesFor(selection.kind)
          });
        }
      }
      paintCardNotes();
    }

    function paintRecapIndex() {
      const host = root.querySelector('[data-recap-index]');
      if (!host) return;
      const rows = [];
      ['concept', 'method', 'model'].forEach(kind => {
        (book[KIND_META[kind].section] || []).forEach((item, index) => {
          const id = item.id || item.name;
          const notes = loadLocalNotes(itemKey(book.id, kind, id));
          if (notes.length) rows.push({ kind, item, index, notes });
        });
      });
      if (!rows.length) {
        host.innerHTML = `
          <p class="companion-kicker">已经写下</p>
          <p class="companion-lead">卡片上还没有记下的内容。</p>`;
        return;
      }
      host.innerHTML = `
        <p class="companion-kicker">已经写下</p>
        <div class="index-list">
          ${rows.map(row => {
            const latest = row.notes[0];
            const noun = KIND_META[row.kind].noun;
            const id = row.item.id || row.item.name;
            return `
              <button type="button" class="index-hit" data-index-open="${escapeHtml(id)}" data-item-kind="${row.kind}">
                <span>
                  <span class="index-kind">${escapeHtml(noun)}</span>
                  <span class="index-name">${escapeHtml(row.item.name)}</span>
                  <span class="index-snippet">${escapeHtml(latest.body || '')}</span>
                </span>
                <span class="index-count">${row.notes.length}</span>
              </button>`;
          }).join('')}
        </div>`;
    }

    function paintAuth() {
      const auth = root.querySelector('[data-recap-auth]');
      const write = root.querySelector('[data-recap-book-write]');
      if (!auth || !write) return;
      const user = getUser();
      auth.innerHTML = renderRegisterForm(user);
      bindRegister(auth);
      if (!user) {
        write.innerHTML = '';
        return;
      }
      write.innerHTML = renderInterpretForm(user, 'concept', {
        types: BOOK_RECAP_TYPES,
        intro: false,
        chipLabel: '这本书的理解、好奇或践行'
      });
      const form = write.querySelector('[data-interpret-form]');
      if (form) {
        bindInterpretForm(form, {
          kind: 'concept',
          key: bookRecapKey,
          id: '',
          types: BOOK_RECAP_TYPES
        });
      }
    }

    function renderRecap() {
      const panel = root.querySelector('[data-panel="recap"]');
      panel.innerHTML = `
        <div class="recap-block">
          <p class="companion-kicker">合上之前</p>
          <h3 class="companion-title">留给自己的三句话</h3>
          <p class="companion-lead">理解、好奇、践行。写在这台设备上，可以一条条追加。</p>
          <div data-recap-auth></div>
          <div data-recap-book-write></div>
          <div class="recap-notes" data-book-notes></div>
        </div>
        <div class="recap-block" data-recap-card></div>
        <div class="recap-block" data-recap-index></div>`;
      paintAuth();
      paintBookNotes();
      paintRecapCard();
      paintRecapIndex();
    }

    function setSelection(kind, id) {
      const found = findItem(kind, id);
      selection = found ? { kind, id, index: found.index } : { kind, id, index: -1 };
      paintCurrent();
      renderRead();
      paintRecapCard();
      if (currentTab !== 'read') {
        const dot = root.querySelector('[data-tab-dot="read"]');
        if (dot) dot.hidden = false;
      }
    }

    renderMap();
    renderRead();
    renderRecap();
    if (mq.matches) sheet.inert = true;
    syncExpanded();

    root.querySelector('[data-companion-close]').addEventListener('click', closeSheet);
    scrim.addEventListener('click', closeSheet);
    root.querySelectorAll('[data-tab]').forEach(tab => {
      tab.addEventListener('click', () => selectTab(tab.getAttribute('data-tab')));
    });
    root.querySelector('[role="tablist"]').addEventListener('keydown', (e) => {
      const names = ['map', 'read', 'recap'];
      const index = names.indexOf(currentTab);
      let next = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (index + 1) % names.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (index + names.length - 1) % names.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = names.length - 1;
      else return;
      e.preventDefault();
      selectTab(names[next]);
      const button = root.querySelector('[data-tab="' + names[next] + '"]');
      if (button) button.focus();
    });
    root.addEventListener('click', (e) => {
      const opener = e.target.closest('[data-map-open], [data-related-open]');
      if (opener && root.contains(opener)) {
        const kind = opener.getAttribute('data-item-kind');
        const id = opener.getAttribute('data-map-open') || opener.getAttribute('data-related-open');
        const found = findItem(kind, id);
        if (found) openItemPanel(book, kind, found.item, found.index);
        return;
      }
      const indexHit = e.target.closest('[data-index-open]');
      if (indexHit && root.contains(indexHit)) {
        setSelection(indexHit.getAttribute('data-item-kind'), indexHit.getAttribute('data-index-open'));
        scrollPanelTo(root.querySelector('[data-recap-card]'));
        return;
      }
      const action = e.target.closest('[data-qa]');
      if (action && root.contains(action)) {
        const which = action.getAttribute('data-qa');
        const target = which === 'methods'
          ? root.querySelector('#companion-related-methods')
          : root.querySelector('#companion-related-concepts');
        scrollPanelTo(target);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('.concept-sheet.is-open')) return;
      if (mq.matches && root.classList.contains('is-open')) {
        e.preventDefault();
        closeSheet();
      }
    }, true);

    mq.addEventListener('change', () => {
      if (!mq.matches) {
        scrim.hidden = true;
        sheet.inert = false;
        root.classList.remove('is-open');
        document.body.classList.remove('companion-open');
      } else if (!root.classList.contains('is-open')) {
        sheet.inert = true;
      }
      syncExpanded();
    });

    document.addEventListener('concept-lib:select', (e) => {
      const detail = e.detail || {};
      if (detail.bookId && detail.bookId !== book.id) return;
      if (!detail.kind || !detail.id) return;
      setSelection(detail.kind, detail.id);
    });
    document.addEventListener('concept-lib:user', () => {
      paintAuth();
      paintBookNotes();
      paintRecapCard();
    });
    document.addEventListener('concept-lib:notes', (e) => {
      const detail = e.detail || {};
      if (detail.key === bookRecapKey) paintBookNotes();
      if (detail.kind && detail.id) {
        paintTileCount(detail.kind, detail.id);
        paintMapCount(detail.kind, detail.id);
        refreshOpenThread(detail.kind, detail.id);
        if (selection && selection.kind === detail.kind && selection.id === detail.id) paintCardNotes();
      }
      paintRecapIndex();
    });

    return {
      setPassages(list) {
        passages = list || [];
        passagesReady = true;
        if (selection) renderRead();
      }
    };
  }

  async function boot() {
    setupTheme();
    setupNav();
    const page = document.body.dataset.page;
    let books = [];
    try {
      books = await loadBooks();
    } catch (err) {
      const fail = document.querySelector('[data-error]');
      if (fail) fail.textContent = err.message || '加载失败';
      console.error(err);
      return;
    }

    if (page === 'home') {
      const input = document.querySelector('[data-search-input]');
      const btn = document.querySelector('[data-search-btn]');
      const mount = document.querySelector('[data-results]');
      const meta = document.querySelector('[data-results-meta]');
      const hint = document.querySelector('[data-hint]');
      const passages = await loadPassages();

      function run() {
        const q = input.value;
        const hits = searchLibrary(books, passages, q);
        renderResults(hits, q, mount, meta);
        if (hint) hint.hidden = !!q.trim();
      }

      btn.addEventListener('click', run);
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          run();
        }
      });
      const preset = qs('q');
      if (preset) {
        input.value = preset;
        run();
      }
    }

    if (page === 'books') {
      const mount = document.querySelector('[data-book-grid]');
      const count = document.querySelector('[data-book-count]');
      if (count) count.textContent = String(books.length);
      renderBookCards(books, mount);
    }

    if (page === 'book') {
      const id = qs('id');
      const mount = document.querySelector('[data-book-detail]');
      const book = books.find(b => b.id === id);
      if (!book) {
        mount.innerHTML = `
          <div class="section">
            <h2>未找到这本书</h2>
            <p class="placeholder-note">请从<a href="books.html">书库</a>重新选择。</p>
          </div>`;
        return;
      }
      document.title = book.title + ' · 概念书库';
      renderBookDetail(book, mount);
      const companion = mountCompanion(book);
      loadPassages().then(list => companion.setPassages(list));
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
