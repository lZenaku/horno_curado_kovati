(() => {
'use strict';
const search = document.getElementById('w4-search');
const type = document.getElementById('w4-type');
const entries = [...document.querySelectorAll('.w4-requirement')];
const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const index = entries.map(element => ({element, text: normalize(element.textContent)}));
function filter() {
 const q = normalize(search.value);
 let count = 0;
 for (const item of index) {
  const visible = (type.value === 'all' || item.element.dataset.type === type.value) && item.text.includes(q);
  item.element.hidden = !visible;
  if (visible) count++;
 }
 document.querySelectorAll('.w4-req-group').forEach(group => {
  group.hidden = ![...group.querySelectorAll('.w4-requirement')].some(entry => !entry.hidden);
 });
 document.getElementById('w4-count').textContent = count + ' de 37 requisitos';
 document.getElementById('w4-empty').hidden = count !== 0;
}
search.addEventListener('input', filter);
type.addEventListener('change', filter);
search.form.addEventListener('reset', () => { requestAnimationFrame(filter); });
const dialog = document.getElementById('w4-diagram');
const image = document.getElementById('w4-diagram-full');
const scroller = document.getElementById('w4-diagram-scroll');
const value = document.getElementById('w4-zoom-value');
const opener = document.getElementById('w4-diagram-open');
if (typeof dialog.showModal !== 'function') return;
opener.hidden = false;
let scale = 1, fitted = true;
function zoom(next, fitMode = false) {
 scale = Math.max(0.1, Math.min(3, next));
 fitted = fitMode;
 image.style.width = Math.round((image.naturalWidth || 1672) * scale) + 'px';
 value.value = Math.round(scale * 100) + ' %';
 value.textContent = value.value;
}
function fit() {
 zoom(Math.min(1, Math.max(120, scroller.clientWidth - 32) / (image.naturalWidth || 1672)), true);
 scroller.scrollTop = 0;
 scroller.scrollLeft = 0;
}
opener.addEventListener('click', () => { dialog.showModal(); fit(); });
document.getElementById('w4-zoom-in').addEventListener('click', () => zoom(scale * 1.35));
document.getElementById('w4-zoom-out').addEventListener('click', () => zoom(scale / 1.35));
document.getElementById('w4-zoom-fit').addEventListener('click', fit);
document.getElementById('w4-zoom-original').addEventListener('click', () => zoom(1));
image.addEventListener('load', () => { if (dialog.open && fitted) fit(); });
window.addEventListener('resize', () => { if (dialog.open && fitted) fit(); });
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
})();