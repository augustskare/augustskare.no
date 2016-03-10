(function() {
  'use strict';

  var observer = new FontFaceObserver('Butler');
  observer.check().then(function () {
    document.documentElement.classList.add('wf-active');
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(function() {
      console.log('serviceworker register');
    }, function(err) {
      console.log(err, 'error');
    });
  }

})();
