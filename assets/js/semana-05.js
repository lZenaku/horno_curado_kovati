(() => {
'use strict';
const dialog = document.getElementById('w5-diagram-dialog');
if (!dialog || typeof dialog.showModal !== 'function') return;
const figures = [...document.querySelectorAll('.w5-drawing')].map(figure => ({
 title: figure.querySelector('h3').textContent,
 image: figure.querySelector('img').getAttribute('src')
}));
const image = document.getElementById('w5-diagram-image');
const scroller = document.getElementById('w5-diagram-scroll');
const select = document.getElementById('w5-diagram-select');
const prev = document.getElementById('w5-prev');
const next = document.getElementById('w5-next');
const value = document.getElementById('w5-zoom');
const help = document.querySelector('.w5-dialog-help');
const defaultHelp = help.textContent;
let index = 0, scale = 1, fitted = true;
function zoom(number, fitMode = false) {
 scale = Math.max(0.08, Math.min(3, number));
 fitted = fitMode;
 image.style.width = Math.round((image.naturalWidth || 2022) * scale) + 'px';
 value.value = Math.round(scale * 100) + ' %';
 value.textContent = value.value;
}
function fit() {
 zoom(Math.min(1, Math.max(100, scroller.clientWidth - 32) / (image.naturalWidth || 2022)), true);
 scroller.scrollTop = 0;
 scroller.scrollLeft = 0;
}
function show(number) {
 index = Math.max(0, Math.min(figures.length - 1, number));
 const figure = figures[index];
 document.getElementById('w5-diagram-title').textContent = figure.title;
 document.getElementById('w5-open-image').href = figure.image;
 select.value = String(index);
 prev.disabled = index === 0;
 next.disabled = index === figures.length - 1;
 fitted = true;
 image.hidden = true;
 image.alt = figure.title + ' · Diagrama del proyecto KOVAX';
 image.src = figure.image;
 help.textContent = defaultHelp;
}
document.querySelectorAll('[data-diagram]').forEach(button => {
 button.hidden = false;
 button.addEventListener('click', () => {
  if (!dialog.open) dialog.showModal();
  show(Number(button.dataset.diagram));
 });
});
image.addEventListener('load', () => {
 if (!dialog.open) return;
 image.hidden = false;
 if (fitted) fit();
});
image.addEventListener('error', () => {
 if (dialog.open) help.textContent = 'No se pudo cargar el plano. Utiliza el enlace Abrir imagen o consulta el PDF desde la página.';
});
prev.addEventListener('click', () => show(index - 1));
next.addEventListener('click', () => show(index + 1));
select.addEventListener('change', () => show(Number(select.value)));
document.getElementById('w5-zoom-in').addEventListener('click', () => zoom(scale * 1.35));
document.getElementById('w5-zoom-out').addEventListener('click', () => zoom(scale / 1.35));
document.getElementById('w5-fit').addEventListener('click', fit);
document.getElementById('w5-original').addEventListener('click', () => zoom(1));
window.addEventListener('resize', () => { if (dialog.open && fitted && image.complete && image.naturalWidth) fit(); });
dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
dialog.addEventListener('close', () => { image.removeAttribute('src'); image.hidden = true; });
})();