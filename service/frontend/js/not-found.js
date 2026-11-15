const names = { sinfo: 'School Info', bar: 'Bar', lunch: 'Lunch' };
const page = new URLSearchParams(location.search).get('page');
if (Object.hasOwn(names, page)) {
  document.getElementById('message').textContent = names[page] + ' is not available yet. Please check back later.';
}
