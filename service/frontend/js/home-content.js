// Página inicial e publicações. O conteúdo das publicações é sempre texto, nunca HTML.
(function () {
  const $ = id => document.getElementById(id);
  const t = (key, params) => window.schoolcoreI18n ? window.schoolcoreI18n.t(key, params) : key.replace(/\{(\w+)\}/g, (_, name) => params?.[name] ?? '');
  const locale = () => window.schoolcoreI18n?.getLanguage() === 'pt-PT' ? 'pt-PT' : 'en-GB';
  const dashboard = $('dashboard');
  const postsView = $('posts-view');
  let userName;
  let latest;
  let latestState = 'loading';
  let latestGeneration = 0;
  let posts = [];
  let nextCursor = null;
  let offset = 0;
  let hasMore = false;
  let listState = 'idle';
  let listGeneration = 0;
  let formMessage = '';
  let calendarDate = new Date();
  calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);

  function authRedirect(response) {
    if (response.status !== 401) return false;
    (window.parent !== window ? window.parent : window).location.replace('../login/index.html');
    return true;
  }
  function greeting() {
    if (!userName) return;
    const hour = new Date().getHours();
    const key = hour < 12 ? 'Good morning, {name}!' : hour < 18 ? 'Good afternoon, {name}!' : 'Good evening, {name}!';
    $('welcome').textContent = t(key, { name: userName });
  }
  function postMeta(post) {
    const date = new Date(post.created_at);
    const formatted = Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(locale(), { year: 'numeric', month: 'short', day: 'numeric' });
    return [post.author, formatted].filter(Boolean).join(' · ');
  }
  function renderLatest() {
    $('latest-title').textContent = latestState === 'loading' ? t('Loading…')
      : latestState === 'error' ? t('Could not load posts. Tap to try again.')
      : latest ? latest.title : t('No posts yet.');
    $('latest-body').textContent = latest ? latest.body : '';
    $('latest-meta').textContent = latest ? postMeta(latest) : '';
  }
  function renderPosts() {
    const list = $('posts-list');
    list.replaceChildren();
    for (const post of posts) {
      const card = document.createElement('article');
      card.className = 'home-card post-card';
      const title = document.createElement('h3');
      // Publicações são texto, não HTML: nada de truques mágicos no título.
      title.textContent = post.title;
      const meta = document.createElement('p');
      meta.className = 'post-meta';
      meta.textContent = postMeta(post);
      const body = document.createElement('p');
      body.className = 'post-body';
      body.textContent = post.body;
      card.append(title, meta, body);
      list.appendChild(card);
    }
    $('posts-status').textContent = listState === 'loading' ? t('Loading…')
      : listState === 'error' ? t('Could not load posts. Please try again.')
      : listState === 'ready' && !posts.length ? t('No posts yet.') : '';
    $('posts-retry').hidden = listState !== 'error';
    $('posts-more').hidden = listState !== 'ready' || !hasMore;
    $('post-form-status').textContent = formMessage ? t(formMessage) : '';
  }
  async function loadLatest() {
    // Respostas antigas não devem substituir uma publicação mais recente.
    const generation = ++latestGeneration;
    latestState = 'loading';
    renderLatest();
    try {
      const response = await fetch('../../api/posts?limit=1', { cache: 'no-store' });
      if (authRedirect(response)) return;
      if (!response.ok) throw new Error('posts unavailable');
      const data = await response.json();
      if (generation !== latestGeneration) return;
      latest = data.posts[0] || null;
      latestState = 'ready';
    } catch (error) {
      if (generation !== latestGeneration) return;
      latest = null;
      latestState = 'error';
    }
    renderLatest();
  }
  async function loadPosts(reset = false) {
    if (listState === 'loading' && !reset) return;
    const generation = ++listGeneration;
    if (reset) { posts = []; nextCursor = null; offset = 0; hasMore = false; }
    listState = 'loading';
    renderPosts();
    try {
      // Compatibilidade com servidores antigos que ainda devolvem apenas has_more.
      const query = nextCursor ? '&cursor=' + encodeURIComponent(nextCursor) : offset ? '&offset=' + offset : '';
      const response = await fetch('../../api/posts?limit=20' + query, { cache: 'no-store' });
      if (authRedirect(response)) return;
      if (!response.ok) throw new Error('posts unavailable');
      const data = await response.json();
      if (generation !== listGeneration) return;
      // Evita duplicados se a lista mudar enquanto se carregam mais páginas.
      const known = new Set(posts.map(post => post.id));
      posts.push(...data.posts.filter(post => !known.has(post.id)));
      nextCursor = data.next_cursor;
      offset += data.posts.length;
      hasMore = data.has_more;
      listState = 'ready';
    } catch (error) {
      if (generation !== listGeneration) return;
      listState = 'error';
    }
    renderPosts();
  }
  $('open-posts').addEventListener('click', () => {
    dashboard.hidden = true;
    postsView.hidden = false;
    $('all-posts-title').focus();
    loadPosts(true);
  });
  $('back-home').addEventListener('click', () => {
    postsView.hidden = true;
    dashboard.hidden = false;
    $('open-posts').focus();
    loadLatest();
  });
  $('posts-retry').addEventListener('click', () => loadPosts());
  $('posts-more').addEventListener('click', () => loadPosts());

  $('post-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const title = $('post-title').value.trim();
    const body = $('post-body').value.trim();
    if (!title || !body) {
      formMessage = 'Please enter a title and message.';
      renderPosts();
      return;
    }
    const button = $('post-submit');
    if (button.disabled) return;
    button.disabled = true;
    formMessage = 'Publishing…';
    renderPosts();
    try {
      const response = await fetch('../../api/posts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body })
      });
      if (authRedirect(response)) return;
      if (response.status === 403) {
        const data = await response.json().catch(() => ({}));
        formMessage = data.detail === 'Administrator access required'
          ? 'Only administrators can publish posts.'
          : data.detail === 'Invalid origin'
          ? 'The server rejected this address. Ask your administrator to check APP_ORIGIN.'
          : 'Could not publish. Please try again.';
      } else if (!response.ok) {
        formMessage = 'Could not publish. Please try again.';
      } else {
        const post = await response.json();
        $('post-form').reset();
        formMessage = 'Post published.';
        latestGeneration++;
        latest = post;
        latestState = 'ready';
        renderLatest();
        // Reload from the server so ordering and pagination remain consistent.
        await loadPosts(true);
      }
    } catch (error) {
      formMessage = 'Could not publish. Please try again.';
    } finally {
      button.disabled = false;
      renderPosts();
    }
  });

  function renderCalendar() {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    $('calendar-month').textContent = new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric' }).format(calendarDate);
    const weekdays = $('calendar-weekdays');
    const days = $('calendar-days');
    weekdays.replaceChildren();
    days.replaceChildren();
    const weekdayFormatter = new Intl.DateTimeFormat(locale(), { weekday: 'short' });
    for (let i = 0; i < 7; i++) {
      const label = document.createElement('span');
      label.textContent = weekdayFormatter.format(new Date(2024, 0, 1 + i));
      weekdays.appendChild(label);
    }
    // JavaScript começa ao domingo; o calendário começa à segunda. A semana tem regras.
    const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
    const lastDate = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < firstDay; i++) days.appendChild(document.createElement('span'));
    const today = new Date();
    const fullDate = new Intl.DateTimeFormat(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    for (let day = 1; day <= lastDate; day++) {
      const cell = document.createElement('span');
      cell.className = 'calendar-day';
      cell.textContent = String(day);
      cell.setAttribute('aria-label', fullDate.format(new Date(year, month, day)));
      if (year === today.getFullYear() && month === today.getMonth() && day === today.getDate()) {
        cell.classList.add('today');
        cell.setAttribute('aria-current', 'date');
      }
      days.appendChild(cell);
    }
  }
  $('calendar-prev').addEventListener('click', () => {
    calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
    renderCalendar();
  });
  $('calendar-next').addEventListener('click', () => {
    calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
    renderCalendar();
  });
  window.addEventListener('schoolcore:language', () => { greeting(); renderLatest(); renderPosts(); renderCalendar(); });
  let todayKey = new Date().toDateString();
  window.setInterval(() => {
    greeting();
    const nextDay = new Date().toDateString();
    if (nextDay !== todayKey) { todayKey = nextDay; renderCalendar(); }
  }, 60000);
  renderCalendar();
  renderLatest();
  loadLatest();
  (async () => {
    try {
      const response = await fetch('../../api/me', { cache: 'no-store' });
      if (authRedirect(response)) return;
      if (!response.ok) throw new Error('account unavailable');
      const user = await response.json();
      userName = user.first_name || user.username;
      $('post-create').hidden = user.role !== 'admin';
      greeting();
    } catch (error) {
      $('welcome').textContent = t('Could not load your account. Please refresh the page.');
    }
  })();
})();
