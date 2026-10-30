(() => {
'use strict';
const cards = [...document.querySelectorAll('[data-document]')];
const viewer = document.getElementById('visor');
const scroller = document.getElementById('viewer-content');
const image = document.getElementById('viewer-image');
const title = document.getElementById('viewer-title');
const meta = document.getElementById('viewer-meta');
const status = document.getElementById('viewer-status');
const pageSelect = document.getElementById('viewer-page');
const prev = document.getElementById('viewer-prev');
const next = document.getElementById('viewer-next');
const zoomValue = document.getElementById('viewer-zoom');
let activeCard = null, activeButton = null, page = 1, scale = 1, fitted = true;
function zoom(value, fitMode = false) {
 scale = Math.max(0.08, Math.min(3, value));
 fitted = fitMode;
 image.style.width = Math.round((image.naturalWidth || 2022) * scale) + 'px';
 zoomValue.value = Math.round(scale * 100) + ' %';
 zoomValue.textContent = zoomValue.value;
}
function fit() {
 zoom(Math.min(1, Math.max(100, scroller.clientWidth - 32) / (image.naturalWidth || 2022)), true);
 scroller.scrollTop = 0;
 scroller.scrollLeft = 0;
}
function sheetTitle() {
 return activeCard.querySelectorAll('.drawing-contents li')[page - 1].textContent;
}
function showPage(number) {
 if (!activeCard) return;
 const count = Number(activeCard.dataset.pages);
 page = Math.max(1, Math.min(count, number));
 pageSelect.value = String(page);
 prev.disabled = page === 1;
 next.disabled = page === count;
 status.textContent = 'Cargando lámina ' + page + ' de ' + count + '…';
 image.hidden = true;
 image.alt = activeCard.dataset.title + ' · Lámina ' + page + ': ' + sheetTitle();
 fitted = true;
 image.src = activeCard.dataset.previewBase + String(page).padStart(2, '0') + '.jpg';
}
image.addEventListener('load', () => {
 if (!activeCard || viewer.hidden) return;
 image.hidden = false;
 if (fitted) fit();
 status.textContent = 'Lámina ' + page + ' de ' + activeCard.dataset.pages + ' · ' + sheetTitle();
});
image.addEventListener('error', () => {
 if (!activeCard || viewer.hidden) return;
 image.hidden = true;
 status.textContent = 'No se pudo cargar esta lámina. Puedes abrir o descargar el PDF con los enlaces superiores.';
});
for (const card of cards) {
 const button = card.querySelector('[data-view-pdf]');
 button.hidden = false;
 button.addEventListener('click', () => {
  for (const other of cards) {
   other.removeAttribute('data-viewing');
   other.querySelector('[data-view-pdf]').setAttribute('aria-expanded', 'false');
  }
  activeCard = card;
  activeButton = button;
  card.setAttribute('data-viewing', '');
  button.setAttribute('aria-expanded', 'true');
  title.textContent = card.dataset.title;
  meta.textContent = 'PDF original · ' + card.dataset.pages + (card.dataset.pages === '1' ? ' lámina' : ' láminas');
  document.getElementById('viewer-open').href = card.dataset.pdf;
  const download = document.getElementById('viewer-download');
  download.href = card.dataset.pdf;
  download.download = card.dataset.filename;
  pageSelect.replaceChildren();
  card.querySelectorAll('.drawing-contents li').forEach((li, i) => {
   const option = document.createElement('option');
   option.value = String(i + 1);
   option.textContent = (i + 1) + ' / ' + card.dataset.pages + ' · ' + li.textContent;
   pageSelect.append(option);
  });
  viewer.hidden = false;
  showPage(1);
  title.focus({preventScroll:true});
  viewer.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',block:'start'});
 });
}
prev.addEventListener('click', () => showPage(page - 1));
next.addEventListener('click', () => showPage(page + 1));
pageSelect.addEventListener('change', () => showPage(Number(pageSelect.value)));
document.getElementById('viewer-zoom-in').addEventListener('click', () => zoom(scale * 1.35));
document.getElementById('viewer-zoom-out').addEventListener('click', () => zoom(scale / 1.35));
document.getElementById('viewer-fit').addEventListener('click', fit);
document.getElementById('viewer-original').addEventListener('click', () => zoom(1));
window.addEventListener('resize', () => { if (activeCard && fitted && image.complete && image.naturalWidth) fit(); });
document.getElementById('viewer-close').addEventListener('click', () => {
 viewer.hidden = true;
 activeCard = null;
 image.removeAttribute('src');
 image.hidden = true;
 for (const card of cards) {
  card.removeAttribute('data-viewing');
  card.querySelector('[data-view-pdf]').setAttribute('aria-expanded', 'false');
 }
 if (activeButton) activeButton.focus();
});
})();