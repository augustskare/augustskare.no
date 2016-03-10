(function() {
  'use strict';
  
  var observer = new FontFaceObserver('Butler');
  observer.check().then(function () {
    document.documentElement.classList.add('wf-active');
  });
})();
