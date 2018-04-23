import './style.css';

window.addEventListener('load', e => {
  if (navigator.serviceWorker && PRODUCTION) {
    navigator.serviceWorker.register('/sw.js');
  }
});