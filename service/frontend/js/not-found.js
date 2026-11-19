// Apenas nomes conhecidos são apresentados a partir do parâmetro do URL.
const names = { sinfo: 'School Info', bar: 'Bar', lunch: 'Lunch' };
const page = new URLSearchParams(location.search).get('page');
function renderMessage() {
  if (!Object.hasOwn(names, page)) return;
  const translate = window.schoolcoreI18n;
  document.getElementById('message').textContent = translate
    ? translate.t('{page} is not available yet. Please check back later.', { page: translate.t(names[page]) })
    : names[page] + ' is not available yet. Please check back later.';
}
window.addEventListener('schoolcore:language', renderMessage);
renderMessage();
