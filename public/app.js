(function(d) {
  'use strict';

  var config = { kitId: 'oou4poe', scriptTimeout: 2000, async: true },
  h=d.documentElement,t=setTimeout(function(){h.className=h.className.replace(/\bwf-loading\b/g,"")+" wf-inactive";},config.scriptTimeout),tk=d.createElement("script"),f=false,s=d.getElementsByTagName("script")[0],a;h.className+=" wf-loading";tk.src='https://use.typekit.net/'+config.kitId+'.js';tk.async=true;tk.onload=tk.onreadystatechange=function(){a=this.readyState;if(f||a&&a!="complete"&&a!="loaded")return;f=true;clearTimeout(t);try{Typekit.load(config)}catch(e){}};s.parentNode.insertBefore(tk,s)

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(function(reg) {
      if (!navigator.serviceWorker.controller) { return; }

      if (reg.waiting) {
        _updateReady(reg.waiting);
        return;
      }

      if (reg.installing) {
        _trackInstalling(reg.installing);
        return;
      }

      reg.addEventListener('updatefound', function() {
        _trackInstalling(reg.installing);
      });
    });
    
    var refreshing;
    navigator.serviceWorker.addEventListener('controllerchange', function() {
      if (refreshing) { return; }
      window.location.reload();
      refreshing = true;
    });

  }

  function _updateReady(worker) {
    console.log('update', worker);
    worker.postMessage({action: 'skipWaiting'});
  }

  function _trackInstalling(worker) {
    console.log('_trackInstalling', worker);
    worker.addEventListener('statechange', function() {
      if (worker.state == 'installed') {
        _updateReady(worker);
      }
    });
  }

})(document);
