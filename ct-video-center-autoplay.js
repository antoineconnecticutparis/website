/*! Connecticut lazy video + center-line audible (v4: preload 3 videos + 4 images) */
(function () {
  const vids = Array.from(document.querySelectorAll('video[data-src-mp4],video[data-src-webm]'));
  if (!vids.length) return;

  // Baseline attributes
  vids.forEach(v => {
    v.controls = false;
    v.classList.add('ct-video');
    v.setAttribute('playsinline', '');
    v.autoplay = true;
    v.muted = true; // start muted to satisfy autoplay; try to unmute later
    v.preload = 'metadata';
  });

  const inject = (v, primary = true) => {
    if (v.dataset._injected === (primary ? "1" : "2")) return;
    while (v.firstChild) v.removeChild(v.firstChild);
    const webm = primary ? v.dataset.srcWebm : v.dataset.fallbackWebm;
    const mp4  = primary ? v.dataset.srcMp4  : v.dataset.fallbackMp4;
    if (webm) { const s = document.createElement('source'); s.src = webm; s.type = 'video/webm'; v.appendChild(s); }
    if (mp4)  { const s = document.createElement('source'); s.src = mp4;  s.type = 'video/mp4';  v.appendChild(s); }
    v.dataset._injected = primary ? "1" : "2";
    v.load();
  };

  // Preload helper for images
  const preloadImage = (href) => {
    if (!href) return;
    // Avoid duplicate preloads
    if ([...document.querySelectorAll('link[rel="preload"][as="image"]')].some(l => l.href === href)) return;
    const link = document.createElement('link');
    link.rel = 'preload'; link.as = 'image'; link.href = href;
    document.head.appendChild(link);
  };

  // Eager lazy-load of videos
  const observeLazy = (v) => {
    if (!('IntersectionObserver' in window)) { inject(v, true); return; }
    const io = new IntersectionObserver((es, ob) => {
      es.forEach(e => { if (e.isIntersecting) { inject(v, true); ob.unobserve(v); } });
    }, { rootMargin: '1600px' }); // load well before center-cross
    io.observe(v);
  };

  // Fallback to original URLs if optimized stall/error
  const installFallbacks = (v) => {
    const swap = () => {
      if (v.dataset._injected !== '2' && (v.dataset.fallbackMp4 || v.dataset.fallbackWebm)) {
        inject(v, false);
        v.play().catch(() => {});
      }
    };
    v.addEventListener('error',   swap, { passive: true });
    v.addEventListener('stalled', swap, { passive: true });
    v.addEventListener('abort',   swap, { passive: true });
    v.addEventListener('emptied', swap, { passive: true });
    setTimeout(() => { if (v.readyState < 2) swap(); }, 2500);
  };

  vids.forEach(v => { observeLazy(v); installFallbacks(v); });

  // --- Preload the first three videos (by top position) ---
  const preloadTopVideos = () => {
    const sorted = [...vids].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    const top3 = sorted.slice(0, 3);
    top3.forEach((v, i) => {
      if (!v.querySelector('source')) inject(v, true);
      // Start a brief muted play to warm up the buffer/decoder
      v.muted = true; v.volume = 0;
      v.play().then(() => {
        // Pause shortly after to keep buffer without making noise
        setTimeout(() => { try { v.pause(); } catch(e){} }, 200 + i*100);
      }).catch(() => {});
      // Preload poster too if present
      if (v.poster) preloadImage(v.poster);
      // Also add <link rel="preload"> for mp4/webm
      const href = v.dataset.srcMp4 || v.dataset.srcWebm;
      if (href) {
        const link = document.createElement('link');
        link.rel = 'preload'; link.as = 'video'; link.href = href;
        document.head.appendChild(link);
      }
    });
  };

  // --- Preload the first four images in DOM flow ---
  const preloadTopImages = () => {
    const imgs = Array.from(document.querySelectorAll('img[src], img[data-src]'));
    const scored = imgs.map(img => {
      const r = img.getBoundingClientRect();
      const top = r.top + window.scrollY;
      const href = img.getAttribute('src') || img.getAttribute('data-src');
      return { img, top, href };
    }).filter(x => !!x.href).sort((a, b) => a.top - b.top);
    const first4 = scored.slice(0, 4);
    first4.forEach(x => preloadImage(x.href));
  };

  // Run once DOM is ready
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(() => { preloadTopVideos(); preloadTopImages(); }, 30);
  } else {
    document.addEventListener('DOMContentLoaded', () => setTimeout(() => { preloadTopVideos(); preloadTopImages(); }, 30));
  }

  // --- Audio unlock (desktop may allow instantly; iOS needs a gesture) ---
  let audioAllowed = false;
  let audioCtx;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioAllowed = audioCtx.state === 'running';
  } catch (e) {}

  const unlock = () => {
    try { if (audioCtx && audioCtx.state !== 'running') audioCtx.resume(); } catch(e){}
    audioAllowed = true;
  };
  window.addEventListener('pointerdown', unlock, { once: true, capture: true });
  window.addEventListener('touchstart', unlock, { once: true, capture: true });
  window.addEventListener('click', unlock, { once: true, capture: true });
  window.addEventListener('keydown', unlock, { once: true, capture: true });

  // --- Center-line selection & playback ---
  async function playBest(best) {
    if (!best) return;
    if (!best.querySelector('source')) inject(best, true);
    for (const v of vids) {
      if (v !== best) { v.volume = 0; v.muted = true; try { if (v.readyState > 1) v.pause(); } catch (e) {} }
    }
    try {
      if (audioAllowed) { best.muted = false; best.volume = 1; await best.play(); }
      else { best.muted = false; best.volume = 1; await best.play(); audioAllowed = true; }
    } catch (e1) {
      best.muted = true; best.volume = 0; try { await best.play(); } catch (e2) {}
    }
  }
  let ticking = false;
  function choose() {
    ticking = false;
    const cy = window.innerHeight / 2;
    let best = null, bestDist = Infinity;
    for (const v of vids) {
      const r = v.getBoundingClientRect();
      const contains = r.top <= cy && r.bottom >= cy;
      let d = Math.min(Math.abs(r.top - cy), Math.abs(r.bottom - cy));
      if (contains) d = 0;
      if (d < bestDist) { bestDist = d; best = v; }
    }
    playBest(best);
  }
  const onSR = () => { if (!ticking) { ticking = true; requestAnimationFrame(choose); } };
  window.addEventListener('scroll', onSR, { passive: true });
  window.addEventListener('resize', onSR);
  window.addEventListener('orientationchange', onSR);
  window.addEventListener('load', () => { setTimeout(choose, 50); });
  document.addEventListener('DOMContentLoaded', () => { setTimeout(choose, 50); });
})();