const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'frontend', 'js', 'i18n.js'), 'utf8');

function setup(language, defaultLanguage) {
  const nodes = [
    { nodeValue: '  Continue  ', parentElement: { tagName: 'SPAN' } },
    { nodeValue: 'Username', parentElement: { tagName: 'LABEL' } },
    { nodeValue: 'User data', parentElement: { tagName: 'SPAN' } }
  ];
  const attributes = { 'aria-label': 'Main navigation' };
  const element = { getAttribute: name => attributes[name] || null, setAttribute: (name, value) => { attributes[name] = value; } };
  const document = {
    title: 'SchoolCore — Home', body: {}, documentElement: { dataset: { defaultLanguage } },
    createTreeWalker() {
      let index = -1;
      return { nextNode() { return ++index < nodes.length; }, get currentNode() { return nodes[index]; } };
    },
    querySelectorAll: () => [element]
  };
  const events = [];
  const window = { dispatchEvent: event => events.push(event.detail) };
  class CustomEvent { constructor(name, data) { this.type = name; this.detail = data.detail; } }
  vm.runInNewContext(source, { document, window, navigator: { language }, NodeFilter: { SHOW_TEXT: 4 }, CustomEvent });
  return { document, window, nodes, attributes, events };
}

test('device language is applied before login and unknown languages fall back to English', () => {
  const pt = setup('pt-BR');
  assert.equal(pt.document.documentElement.lang, 'pt-PT');
  assert.equal(pt.nodes[0].nodeValue, '  Continuar  ');
  assert.equal(pt.attributes['aria-label'], 'Navegação principal');
  assert.equal(pt.document.title, 'SchoolCore — Início');
  const other = setup('fr-FR');
  assert.equal(other.document.documentElement.lang, 'en');
  assert.equal(other.nodes[0].nodeValue, '  Continue  ');
});

test('login can request English by default even on Portuguese devices', () => {
  const app = setup('pt-PT', 'en');
  assert.equal(app.document.documentElement.lang, 'en');
  assert.equal(app.nodes[0].nodeValue, '  Continue  ');
  app.window.schoolcoreI18n.setLanguage('pt-PT');
  assert.equal(app.nodes[0].nodeValue, '  Continuar  ');
});

test('changing language keeps dynamic content and safely interpolates names', () => {
  const app = setup('en');
  app.nodes[1].nodeValue = 'value set by application';
  app.window.schoolcoreI18n.setLanguage('pt-PT');
  assert.equal(app.nodes[0].nodeValue, '  Continuar  ');
  assert.equal(app.nodes[1].nodeValue, 'value set by application');
  assert.equal(app.nodes[2].nodeValue, 'User data');
  assert.equal(app.window.schoolcoreI18n.t('Hello, {name}!', { name: '<Ana>' }), 'Olá, <Ana>!');
  assert.equal(app.window.schoolcoreI18n.t('unknown key'), 'unknown key');
  app.window.schoolcoreI18n.setLanguage('en');
  assert.equal(app.nodes[0].nodeValue, '  Continue  ');
  assert.deepEqual(app.events, ['en', 'pt-PT', 'en']);
});
