const frame = document.getElementById('page-frame');
const content = document.getElementById('content');
const indicator = document.getElementById('nav-indicator');
const navigation = document.querySelector('.navigation');
const lunchPanel = document.getElementById('lunch-panel');
const lunchFrame = document.getElementById('lunch-frame');
let lunchStarted = false;
const giaeUrl = 'https://giae.aeb.pt/';
document.getElementById('lunch-retry').addEventListener('click', () => {
  lunchStarted = true;
  lunchFrame.src = giaeUrl;
});

let navTimer;
let keyboardFocus = false;
function expandNavigation() {
  navigation.classList.add('is-expanded');
  clearTimeout(navTimer);
  navTimer = setTimeout(() => {
    if (!keyboardFocus) navigation.classList.remove('is-expanded');
  }, 3000);
}
navigation.addEventListener('pointerenter', (event) => { if (event.pointerType === 'mouse') expandNavigation(); });
navigation.addEventListener('pointermove', (event) => { if (event.pointerType === 'mouse') expandNavigation(); });
navigation.addEventListener('pointerdown', () => { keyboardFocus = false; expandNavigation(); });
navigation.addEventListener('focusin', (event) => {
  keyboardFocus = event.target.matches(':focus-visible');
  expandNavigation();
});
navigation.addEventListener('focusout', (event) => {
  if (!navigation.contains(event.relatedTarget)) { keyboardFocus = false; expandNavigation(); }
});
document.addEventListener('pointerdown', (event) => {
  if (!navigation.contains(event.target)) { keyboardFocus = false; clearTimeout(navTimer); navigation.classList.remove('is-expanded'); }
});
window.addEventListener('blur', () => { keyboardFocus = false; clearTimeout(navTimer); navigation.classList.remove('is-expanded'); });

const pages = {
  sinfo: { url: './not-found.html?page=sinfo', title: 'School Info', position: 0 },
  bar: { url: './not-found.html?page=bar', title: 'Bar', position: 1 },
  home: { url: './home-content.html', title: 'Home', position: 2 },
  lunch: { title: 'Lunch', position: 3 },
  user: { url: './account.html?embedded=1', title: 'User', position: 4 }
};
let activePage = 'home';
function updatePageTitle() {
  const title = pages[activePage].title;
  const translated = window.schoolcoreI18n ? window.schoolcoreI18n.t(title) : title;
  document.getElementById('page-title').textContent = translated;
  frame.title = translated;
}
window.addEventListener('schoolcore:language', updatePageTitle);

function navigate(page) {
  if (!pages[page] || page === activePage) return;
  activePage = page;
  const selected = pages[page];
  indicator.style.transform = 'translateX(' + (selected.position * 100) + '%)';
  updatePageTitle();
  frame.hidden = page === 'lunch';
  lunchPanel.hidden = page !== 'lunch';
  document.querySelectorAll('[data-page]').forEach((link) => {
    if (link.dataset.page === page) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  content.classList.remove('has-error');
  if (page === 'lunch') {
    content.classList.remove('is-loading');
    content.setAttribute('aria-busy', 'false');
    if (!lunchStarted) {
      lunchStarted = true;
      lunchFrame.src = giaeUrl;
    }
    return;
  }
  content.classList.add('is-loading');
  document.getElementById('content-loading').textContent = window.schoolcoreI18n ? window.schoolcoreI18n.t('Loading…') : 'Loading…';
  content.setAttribute('aria-busy', 'true');
  frame.src = selected.url;
}

function frameLoaded() {
  document.getElementById('home-splash').hidden = true;
  try {
    const path = frame.contentWindow.location.pathname;
    if (path.endsWith('/pages/login/index.html') || path.endsWith('/pages/start/index.html')) {
      window.location.replace(frame.contentWindow.location.href);
      return;
    }
    if (frame.contentDocument && frame.contentDocument.contentType.includes('json')) {
      content.classList.add('is-loading');
      content.classList.add('has-error');
      content.setAttribute('aria-busy', 'false');
      document.getElementById('content-loading').textContent = window.schoolcoreI18n ? window.schoolcoreI18n.t('Could not load this page. Restart the server and try again.') : 'Could not load this page. Restart the server and try again.';
      return;
    }
  } catch (error) { /* The iframe may be inaccessible during navigation. */ }
  const preferences = window.schoolcorePreferences?.current?.();
  if (preferences && frame.contentWindow) {
    frame.contentWindow.postMessage({ type: 'schoolcore:preferences', preferences }, location.origin);
  }
  content.classList.remove('is-loading');
  content.setAttribute('aria-busy', 'false');
}
frame.addEventListener('load', frameLoaded);
try {
  if (frame.contentDocument && frame.contentDocument.readyState === 'complete' &&
      frame.contentWindow.location.pathname !== 'blank' && frame.contentWindow.location.href !== 'about:blank') frameLoaded();
} catch (error) { /* Wait for the load event if the frame is not accessible. */ }
setTimeout(() => {
  if (!document.getElementById('home-splash').hidden) {
    document.getElementById('home-splash').hidden = true;
    content.classList.add('has-error');
    content.setAttribute('aria-busy', 'false');
    document.getElementById('content-loading').textContent = window.schoolcoreI18n ? window.schoolcoreI18n.t('Could not load this page. Refresh to try again.') : 'Could not load this page. Refresh to try again.';
  }
}, 15000);
document.querySelectorAll('[data-page]').forEach((link) => {
  link.addEventListener('click', () => navigate(link.dataset.page));
});
function pageFromHash() {
  const page = location.hash.slice(1);
  return Object.hasOwn(pages, page) ? page : 'home';
}
window.addEventListener('hashchange', () => navigate(pageFromHash()));
window.addEventListener('message', (event) => {
  if (event.origin !== location.origin || event.source !== frame.contentWindow || !event.data) return;
  if (event.data.type === 'schoolcore:refresh') { window.location.reload(); return; }
  if (event.data.type === 'schoolcore:navigate' && event.data.page === 'user') location.hash = 'user';
  if (event.data.type === 'schoolcore:preferences') window.schoolcorePreferences.apply(event.data.preferences);
});
navigate(pageFromHash());
