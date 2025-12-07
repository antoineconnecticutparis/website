/*! Connecticut audio unmute helper (v2) */
(function(){
  function enableSound(){
    var videos = document.querySelectorAll('video.ct-video, video');
    videos.forEach(function(v){
      try {
        v.muted = false;
        v.volume = 1.0;
        var p = v.play();
        if (p && typeof p.catch === 'function'){ p.catch(function(){ /* ignore */ }); }
      } catch(e){ /* ignore */ }
    });
    document.documentElement.classList.add('ct-sound-on');
    window.removeEventListener('click', enableSound, true);
    window.removeEventListener('touchstart', enableSound, true);
    window.removeEventListener('keydown', enableSound, true);
  }

  window.addEventListener('click', enableSound, true);
  window.addEventListener('touchstart', enableSound, true);
  window.addEventListener('keydown', enableSound, true);

  var badge = document.createElement('div');
  badge.className = 'ct-sound-badge';
  badge.textContent = 'Tap to enable sound';
  document.addEventListener('DOMContentLoaded', function(){
    document.body.appendChild(badge);
  });
  window.addEventListener('click', function(){ if (badge && badge.parentNode) badge.parentNode.removeChild(badge); }, {once:true});
})();
