(() => {
  'use strict';
  const dialog = document.getElementById('w2-pfd-dialog');
  const image = document.getElementById('w2-pfd-full');
  const scroller = document.getElementById('w2-pfd-scroll');
  const value = document.getElementById('w2-zoom-value');
  if (!dialog || !image || !scroller || !value) return;
  let scale = 1, fitted = true;
  const naturalWidth = () => image.naturalWidth || 1619;
  function zoom(next, isFit = false) {
    scale = Math.max(0.1, Math.min(3, next));
    fitted = isFit;
    image.style.width = Math.round(naturalWidth() * scale) + 'px';
    value.value = Math.round(scale * 100) + ' %';
    value.textContent = value.value;
  }
  function fit() {
    zoom(Math.min(1, Math.max(120, scroller.clientWidth - 32) / naturalWidth()), true);
    scroller.scrollTop = 0;
    scroller.scrollLeft = 0;
  }
  document.querySelectorAll('[data-pfd-open]').forEach(button => button.addEventListener('click', () => {
    if (!dialog.open) dialog.showModal();
    fit();
  }));
  document.getElementById('w2-zoom-in').addEventListener('click', () => zoom(scale * 1.35));
  document.getElementById('w2-zoom-out').addEventListener('click', () => zoom(scale / 1.35));
  document.getElementById('w2-zoom-fit').addEventListener('click', fit);
  document.getElementById('w2-zoom-original').addEventListener('click', () => zoom(1));
  image.addEventListener('load', () => { if (dialog.open && fitted) fit(); });
  window.addEventListener('resize', () => { if (dialog.open && fitted) fit(); });
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
})();
