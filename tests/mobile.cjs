const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require(process.env.JSDOM_PATH || 'jsdom');
const root = path.resolve(__dirname, '..');

function boot(storage = {}) {
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), {
    url: 'https://ivanhhgdx.github.io/deputat/', runScripts: 'outside-only', pretendToBeVisual: true
  });
  const w = dom.window, errors = [];
  w.addEventListener('error', e => errors.push(e.message));
  w.scrollTo = ({ top }) => { w.scrollY = top; };
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new w.Event('close')); };
  for (const [key, value] of Object.entries(storage)) w.localStorage.setItem(key, value);
  for (const script of w.document.querySelectorAll('script[src]')) {
    vm.runInContext(fs.readFileSync(path.join(root, script.getAttribute('src').split('?')[0]), 'utf8'), dom.getInternalVMContext());
  }
  const q = s => w.document.querySelector(s);
  const go = route => { w.location.hash = route; w.dispatchEvent(new w.HashChangeEvent('hashchange')); };
  const follow = el => { const hash = el.hash; el.click(); go(hash.slice(1)); };
  return { dom, w, q, go, follow, errors };
}

const legacy = { read: ['budget-may-1'], saved: ['budget-may-1'], notes: { plan: 'Сохранённый план', 'budget-may-1': 'Старая заметка' }, controls: { teachers: 'working' } };
const a = boot({ 'deputat-materials-v1': JSON.stringify(legacy) });
const { q, w, go, follow } = a;
assert.equal(q('#mobile-navigation').children.length, 5);
assert.equal(q('.mobile-launches').children.length, 3);
assert.equal(q('#mobile-navigation [aria-current="page"]').hash, '#overview');
assert.equal(w.PUBLIC_MUNICIPAL_NEWS.length, 3, 'retain all current public publications');

q('#more-open').click();
assert(q('#more-dialog').open);
assert.equal(q('#more-open').getAttribute('aria-expanded'), 'true');
assert.equal(q('#more-links').querySelectorAll('a').length, 12);
follow(q('#more-links a[href="#documents"]'));
assert(!q('#more-dialog').open);
assert.equal(q('#more-open').getAttribute('aria-expanded'), 'false');
assert(q('#more-open').classList.contains('active'));
assert.equal(q('.doc-list').children.length, 6);

for (const name of ['overview', 'sessions', 'materials', 'budget', 'agendas', 'situation', 'territory', 'initiatives', 'preparation', 'opportunities', 'council', 'documents']) {
  go(name);
  assert(q('#content h1'), name);
  assert.equal(q('#navigation [aria-current="page"]').hash, '#' + name);
  assert.equal(q('#content .view').dataset.view, name);
  assert.equal(q('#mobile-navigation').children.length, 5);
  assert.equal(q('#mobile-navigation').querySelectorAll('.active').length, 1);
  assert(!q('#content').textContent.includes('undefined'), name);
}
go('budget');
assert(q('#mobile-navigation a[href="#materials"]').classList.contains('active'));
const budgetQuery = q('#budget-query');
budgetQuery.value = 'школ'; budgetQuery.dispatchEvent(new w.Event('input', { bubbles: true }));
assert(q('#budget-results tbody tr'));
q('[data-budget-row]').click(); assert(q('#detail-dialog').open);
q('#dialog-close').click(); assert(!q('#detail-dialog').open);

go('preparation');
assert.equal(q('#personal-plan').value, legacy.notes.plan);
q('#personal-plan').value = 'Новый план <текст>';
q('#personal-plan').dispatchEvent(new w.Event('input', { bubbles: true }));
w.scrollY = 430;
follow(q('#mobile-navigation a[href="#sessions"]'));
assert.equal(w.scrollY, 0);
follow(q('#mobile-navigation a[href="#preparation"]'));
assert.equal(w.scrollY, 430, 'restore screen scroll on returning to a tab');
assert.equal(q('#personal-plan').value, 'Новый план <текст>');
go('agendas');
assert.equal(q('[data-question-note="budget-may-1"]').value, legacy.notes['budget-may-1']);
assert.equal(q('[data-read="budget-may-1"]').getAttribute('aria-pressed'), 'true');

q('#more-open').click(); q('.more-profile').click();
assert(!q('#more-dialog').open); assert(q('#detail-dialog').open);
q('#dialog-close').click();
q('#more-open').click(); q('#more-close').click();
assert(!q('#more-dialog').open);
assert.equal(q('#more-open').getAttribute('aria-expanded'), 'false');

q('#search-open').click(); assert(q('#search-dialog').open);
q('#search-input').value = 'помощник'; q('#search-input').dispatchEvent(new w.Event('input', { bubbles: true }));
assert(q('#search-results').textContent.includes('помощник'));
q('#search-results button').click();
assert(!q('#search-dialog').open); assert(q('#detail-dialog').open);
q('#dialog-close').click();

const storage = Object.fromEntries(Object.keys(w.localStorage).map(key => [key, w.localStorage.getItem(key)]));
const b = boot(storage); b.go('preparation');
assert.equal(b.q('#personal-plan').value, 'Новый план <текст>');
b.go('agendas');
assert.equal(b.q('[data-question-note="budget-may-1"]').value, legacy.notes['budget-may-1']);
assert.deepEqual(a.errors, []); assert.deepEqual(b.errors, []);
a.dom.window.close(); b.dom.window.close();
console.log('PASS: five tabs, all 12 sections, More menu and profile, grouped active state, search/dialogs, budget filter/comparison, scroll restoration, saved notes and reload, all three current publications; no script errors.');
