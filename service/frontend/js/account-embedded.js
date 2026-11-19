// A conta pode aparecer sozinha ou dentro da navegação principal.
if (window.self !== window.top && new URLSearchParams(location.search).get('embedded') === '1') {
  document.documentElement.classList.add('embedded');
}
