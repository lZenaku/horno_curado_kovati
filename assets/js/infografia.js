(() => {
'use strict';
const section = document.getElementById('infografia-kovax');
if (!section) return;
const components = [...section.querySelectorAll('[data-kvi-part]')];
const photoButtons = [...section.querySelectorAll('[data-kvi-photo]')];
const markers = [...section.querySelectorAll('[data-kvi-marker]')];
const image = section.querySelector('#kvi-photo-image');
const caption = section.querySelector('#kvi-photo-caption');
const photoLink = section.querySelector('#kvi-photo-open');
let activePart = '01';
function updateMarkers(view) {
 for (const marker of markers) {
  marker.hidden = marker.dataset.kviScene !== view;
  marker.setAttribute('aria-pressed', String(marker.dataset.kviMarker === activePart));
 }
}
function showView(view) {
 const selected = photoButtons.find(button => button.dataset.kviPhoto === view);
 if (!selected) return;
 if (image.getAttribute('src') !== selected.dataset.kviSrc) image.src = selected.dataset.kviSrc;
 image.alt = selected.dataset.kviAlt;
 caption.textContent = selected.dataset.kviCaption;
 photoLink.href = selected.dataset.kviSrc;
 for (const button of photoButtons) button.setAttribute('aria-pressed', String(button === selected));
 updateMarkers(view);
}
function activate(part, forcedView) {
 const selected = components.find(component => component.dataset.kviPart === part);
 if (!selected) return;
 activePart = part;
 for (const component of components) component.open = component === selected;
 showView(forcedView || selected.dataset.kviView);
}
for (const component of components) {
 component.addEventListener('toggle', () => {
  if (component.open && activePart !== component.dataset.kviPart) activate(component.dataset.kviPart);
  else if (!component.open && activePart === component.dataset.kviPart) {
   activePart = null;
   for (const marker of markers) marker.setAttribute('aria-pressed', 'false');
  }
 });
}
for (const button of photoButtons) {
 button.hidden = false;
 button.addEventListener('click', () => activate(button.dataset.kviDefault, button.dataset.kviPhoto));
}
for (const marker of markers) {
 marker.addEventListener('click', () => {
  activate(marker.dataset.kviMarker);
  const selected = components.find(component => component.dataset.kviPart === marker.dataset.kviMarker);
  selected.querySelector('summary').focus({preventScroll:true});
  if (window.matchMedia('(max-width: 800px)').matches) {
   selected.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',block:'start'});
  }
 });
}
activate('01');
})();