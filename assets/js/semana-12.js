(() => {
'use strict';
const video = document.getElementById('w12-video');
const status = document.getElementById('w12-video-status');
if (!video || !status) return;
function timeLabel(seconds) {
 return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
}
document.querySelectorAll('[data-video-time]').forEach(button => {
 button.hidden = false;
 button.addEventListener('click', () => {
  const seconds = Number(button.dataset.videoTime);
  const seek = () => {
   const target = Number.isFinite(video.duration) ? Math.min(seconds, Math.max(0, video.duration - 0.1)) : seconds;
   video.currentTime = target;
   status.textContent = 'Momento seleccionado: ' + timeLabel(seconds) + '.';
   video.focus({preventScroll:true});
   video.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',block:'start'});
   const playback = video.play();
   if (playback && typeof playback.catch === 'function') {
    playback.catch(() => { status.textContent = 'Video ubicado en ' + timeLabel(seconds) + '. Pulsa reproducir para continuar.'; });
   }
  };
  if (video.readyState >= 1) seek();
  else { video.addEventListener('loadedmetadata', seek, {once:true}); video.load(); }
 });
});
video.addEventListener('error', () => {
 status.textContent = 'Puedes abrir o descargar el archivo MP4 desde los enlaces disponibles debajo del reproductor.';
});
})();