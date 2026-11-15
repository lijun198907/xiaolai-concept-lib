(function () {
  const DATA_URL = 'data/books.json?v=20261105q';
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

  function setupNav() {
    const btn = document.querySelector('[data-nav-toggle]');
    const links = document.querySelector('[data-nav-links]');
    if (!btn || !links) return;
    btn.addEventListener('click', () => links.classList.toggle('open'));
    const path = location.pathname.split('/').pop() || 'index.html';
    links.querySelectorAll('a').forEach(a => {
      const href = a.getAttribute('href');
      if (href === path || (path === '' && href === 'index.html')) {
        a.classList.add('active');
      }
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

  function searchBooks(books, q) {
    const query = (q || '').trim().toLowerCase();
    if (!query) return [];
    const tokens = query.split(/\s+/).filter(Boolean);
    const hits = [];

    books.forEach(book => {
      const hayBook = [book.title, book.author, book.summary, book.type].join(' ').toLowerCase();
      const bookMatch = tokens.every(t => hayBook.includes(t));
      if (bookMatch) {
        hits.push({
          kind: 'book',
          book,
          title: book.title,
          snippet: book.summary,
          href: 'book.html?id=' + encodeURIComponent(book.id)
        });
      }
      (book.concepts || []).forEach(c => {
        const hay = [c.name, c.blurb, book.title].join(' ').toLowerCase();
        if (tokens.every(t => hay.includes(t))) {
          hits.push({
            kind: 'concept',
            book,
            title: c.name,
            snippet: asExcerpt(c.blurb) + ' · 《' + book.title + '》',
            href: 'book.html?id=' + encodeURIComponent(book.id) + '#concepts'
          });
        }
      });
      (book.methods || []).forEach(m => {
        const hay = [m.name, m.blurb, book.title].join(' ').toLowerCase();
        if (tokens.every(t => hay.includes(t))) {
          hits.push({
            kind: 'method',
            book,
            title: m.name,
            snippet: m.blurb + ' · 《' + book.title + '》',
            href: 'book.html?id=' + encodeURIComponent(book.id) + '#methods'
          });
        }
      });
      (book.models || []).forEach(m => {
        const hay = [m.name, m.blurb, book.title].join(' ').toLowerCase();
        if (tokens.every(t => hay.includes(t))) {
          hits.push({
            kind: 'model',
            book,
            title: m.name,
            snippet: m.blurb + ' · 《' + book.title + '》',
            href: 'book.html?id=' + encodeURIComponent(book.id) + '#models'
          });
        }
      });
    });
    return hits;
  }

  function renderResults(hits, q, mount, meta) {
    if (!q.trim()) {
      meta.textContent = '';
      mount.innerHTML = '';
      return;
    }
    meta.textContent = hits.length ? `找到 ${hits.length} 条与「${q}」相关的结果` : `没有找到与「${q}」相关的结果`;
    if (!hits.length) {
      mount.innerHTML = '<div class="empty-state">试试书名，或概念关键词，例如「时间」「定投」「原则」</div>';
      return;
    }
    const kindLabel = { book: '书目', concept: '概念', method: '方法论', model: '模型' };
    mount.innerHTML = hits.map(h => `
      <article class="result-item">
        <div class="meta">${kindLabel[h.kind] || ''} · ${escapeHtml(h.book.type)}</div>
        <h3><a href="${h.href}">${highlight(h.title, q)}</a></h3>
        <p class="snippet">${highlight(h.snippet, q)}</p>
      </article>
    `).join('');
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

  function renderInterpretForm(user, kind) {
    if (!user) return '';
    const types = practiceTypesFor(kind);
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
    return `
      <form class="interpret-form" data-interpret-form>
        <p class="panel-section-label">超级践行 · 把${escapeHtml(noun)}内化成自己的</p>
        <p class="practice-hint">重点不是评论${escapeHtml(noun)}本身，而是把它内化成自己的。选一个方向写下。</p>
        <div class="practice-chips" role="tablist" aria-label="写下方向">${chips}</div>
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

  function closeItemPanel(kind) {
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
          refreshWrite();
        });
      }
      const reset = write.querySelector('[data-reset-user]');
      if (reset) {
        reset.addEventListener('click', () => {
          localStorage.removeItem(USER_KEY);
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
    const hash = location.hash || '';
    function openFromHash(prefix, kind) {
      if (!hash.startsWith(prefix)) return false;
      const cid = decodeURIComponent(hash.slice(prefix.length));
      const list = itemsForKind(kind);
      const idx = list.findIndex(c => (c.id || c.name) === cid);
      const item = idx >= 0 ? list[idx] : null;
      if (item) setTimeout(() => openItemPanel(book, kind, item, idx), 60);
      return !!item;
    }
    openFromHash('#concept-', 'concept') || openFromHash('#method-', 'method') || openFromHash('#model-', 'model');

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

  async function boot() {
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

      function run() {
        const q = input.value;
        const hits = searchBooks(books, q);
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
    }
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
