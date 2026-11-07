/* The supplied Riyadh film, with visibility-aware and user-controlled playback. */
(() => {
  'use strict';
  const video = document.querySelector('#hero-video');
  const button = document.querySelector('#hero-video-toggle');
  const hero = document.querySelector('#home');
  if (!video || !button || !hero) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let userPaused = false;
  let userRequestedPlay = false;
  let failed = false;
  let request = 0;
  video.muted = true;
  video.defaultMuted = true;
  function visible() {
    return hero.classList.contains('is-active') && !document.hidden &&
      (!window.SiteIntro?.active || window.SiteIntro.revealing);
  }
  function updateButton() {
    const playing = !video.paused && !video.ended;
    button.setAttribute('aria-label', playing ? 'إيقاف فيديو الخلفية' : 'تشغيل فيديو الخلفية');
    button.querySelector('use').setAttribute('href', playing ? '#video-pause' : '#video-play');
    button.querySelector('span').textContent = failed ? 'الفيديو غير متاح' : playing ? 'إيقاف المشهد' : 'تشغيل المشهد';
    button.disabled = failed;
  }
  async function sync() {
    const current = ++request;
    if (failed || !visible() || userPaused || (reduce.matches && !userRequestedPlay)) {
      video.pause(); updateButton(); return;
    }
    try {
      await video.play();
      if (current !== request && (!visible() || userPaused || (reduce.matches && !userRequestedPlay))) video.pause();
    } catch { /* A blocked autoplay keeps the poster and exposes the play button. */ }
    updateButton();
  }
  button.addEventListener('click', () => {
    if (!video.paused) { userPaused = true; userRequestedPlay = false; }
    else { userPaused = false; userRequestedPlay = true; }
    sync();
  });
  video.addEventListener('play', updateButton);
  video.addEventListener('pause', updateButton);
  const fail = () => {
    failed = true; video.pause(); video.hidden = true; updateButton();
  };
  video.addEventListener('error', fail);
  video.querySelector('source')?.addEventListener('error', fail);
  document.addEventListener('visibilitychange', sync);
  reduce.addEventListener('change', () => { userRequestedPlay = false; sync(); });
  window.SiteHeroVideo = { sync };
  sync();
})();
