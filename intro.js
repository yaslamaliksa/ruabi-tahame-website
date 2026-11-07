/* A real-time hoist: rope, hook and cover share a single progress value. */
(() => {
  'use strict';
  const intro = document.querySelector('#crane-intro');
  const enterButton = document.querySelector('#intro-enter');
  const skipButton = document.querySelector('#intro-skip');
  const replayButton = document.querySelector('#intro-replay');
  if (!intro || !enterButton || !skipButton || !replayButton) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const machine = intro.querySelector('.intro-machine');
  const model = machine.querySelector('svg');
  const pin = intro.querySelector('#intro-trolley-pin');
  const cable = intro.querySelector('#intro-main-cable');
  const slings = intro.querySelector('#intro-slings');
  const hook = intro.querySelector('#intro-hook');
  const meter = intro.querySelector('progress');
  const count = intro.querySelector('output');
  const liveStatus = intro.querySelector('#intro-announcer');
  const viewport = document.querySelector('.viewport');
  if (!pin || !model || !cable || !slings || !hook || !viewport) return;
  let active = false;
  let revealing = false;
  let progress = 0;
  let frame = 0;
  let resizeFrame = 0;
  let operation = 0;
  let drag = null;
  let geometry;
  let background = [];
  let restoreFocus;
  let lifted = false;
  let suppressClick = false;
  let suppressTimer = 0;
  let safetyTimer = 0;
  const clamp = v => Math.max(0, Math.min(1, v));
  const ease = t => 1 - Math.pow(1 - t, 3);
  const api = { get active() { return active; }, get revealing() { return revealing; }, open, close: () => finish(true), refreshRig, syncAnchor };
  window.SiteIntro = api;
  function refreshRig() {
    if (!active) return;
    measure(); setProgress(progress);
  }
  function syncAnchor(point) {
    if (!active || !geometry) return;
    geometry.x = point.x; geometry.y = point.y;
    setProgress(progress);
  }
  function stop() { operation++; if (frame) cancelAnimationFrame(frame); frame = 0; }
  function measure() {
    intro.style.setProperty('--sheet-y', '0px');
    intro.style.setProperty('--rig-y', '0px');
    model.setAttribute('viewBox', innerWidth <= 600 ? '250 20 850 530' : '0 0 1200 550');
    const a = intro.querySelector('.intro-eyelet-a').getBoundingClientRect();
    const b = intro.querySelector('.intro-eyelet-b').getBoundingClientRect();
    const p = pin.getBoundingClientRect();
    const anchor3d = window.SiteCrane3D?.getAnchor();
    const r = intro.getBoundingClientRect();
    geometry = { h: r.height, x: anchor3d?.x ?? p.left + p.width / 2 - r.left, y: anchor3d?.y ?? p.top + p.height / 2 - r.top,
      a: { x: a.left + a.width / 2 - r.left, y: a.top + a.height / 2 - r.top },
      b: { x: b.left + b.width / 2 - r.left, y: b.top + b.height / 2 - r.top } };
  }
  function setProgress(value) {
    progress = clamp(value);
    if (!geometry) return;
    const { h, a, b, x, y } = geometry;
    const lift = h * 1.13 * progress;
    const slingHeight = Math.min(75, h * .095);
    const hookY = Math.min(a.y, b.y) - slingHeight - lift;
    // Once the winch reaches its travel limit, the camera follows the hoist up.
    const cameraRise = Math.max(0, y + 24 - hookY);
    const ropeTop = y - cameraRise;
    intro.style.setProperty('--sheet-y', (-lift).toFixed(2) + 'px');
    intro.style.setProperty('--rig-y', (-cameraRise).toFixed(2) + 'px');
    cable.setAttribute('d', `M ${x - 3} ${ropeTop} V ${hookY - 18} M ${x + 3} ${ropeTop} V ${hookY - 18}`);
    hook.setAttribute('transform', `translate(${x} ${hookY - 12})`);
    slings.setAttribute('d', `M ${a.x} ${a.y - lift} L ${x} ${hookY + 12} L ${b.x} ${b.y - lift}`);
    window.SiteCrane3D?.setLift({ progress, cameraRise, hookX: x, hookY, ropeTop, a: { x: a.x, y: a.y - lift }, b: { x: b.x, y: b.y - lift } });
    meter.value = Math.round(progress * 100);
    count.textContent = String(Math.round(progress * 100)).padStart(2, '0') + '%';
    if (progress > .4 && lifted && !revealing) revealSite();
  }
  function revealSite() {
    revealing = true;
    try { window.SiteMotion?.replay(); } catch { /* Decorative motion cannot block entry. */ }
  }
  function animateTo(target, duration, complete) {
    stop();
    const id = operation;
    const from = progress;
    const start = performance.now();
    const tick = now => {
      if (!active || id !== operation) return;
      const t = Math.min(1, (now - start) / duration);
      setProgress(from + (target - from) * ease(t));
      if (t < 1) frame = requestAnimationFrame(tick);
      else { frame = 0; complete?.(); }
    };
    frame = requestAnimationFrame(tick);
  }
  function focusDestination() {
    const target = restoreFocus?.isConnected && restoreFocus !== document.body ? restoreFocus : document.querySelector('.chapter.is-active h1, .chapter.is-active h2') || viewport;
    if (!target.hasAttribute('tabindex') && !target.matches('a,button,input,select,textarea')) target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }
  function finish(immediate = false) {
    if (!active) return;
    stop();
    clearTimeout(safetyTimer);
    if (!immediate) setProgress(1);
    active = false;
    drag = null;
    intro.hidden = true;
    window.SiteCrane3D?.close();
    intro.classList.remove('is-lifting', 'is-dragging');
    document.body.classList.remove('intro-active');
    background.forEach(([element, wasInert]) => { element.inert = wasInert; });
    background = [];
    if (!revealing) revealSite();
    focusDestination();
    replayButton.hidden = false;
  }
  function lift() {
    if (!active || lifted) return;
    lifted = true;
    if (reduce.matches) { finish(true); return; }
    intro.classList.add('is-lifting');
    intro.classList.remove('is-dragging');
    enterButton.disabled = true;
    skipButton.focus({ preventScroll: true });
    safetyTimer = setTimeout(() => finish(true), 2400);
    liveStatus.textContent = 'جارٍ رفع الواجهة والكشف عن الموقع.';
    animateTo(1, Math.max(550, 1500 * (1 - progress)), () => finish());
  }
  function open() {
    if (active) return;
    stop();
    active = true; revealing = false; lifted = false; progress = 0; drag = null;
    restoreFocus = document.activeElement;
    background = [...document.body.children].filter(element => element !== intro && element.tagName !== 'SCRIPT' && element.tagName !== 'SVG').map(element => [element, element.inert]);
    background.forEach(([element]) => { element.inert = true; });
    intro.hidden = false;
    document.body.classList.add('intro-active');
    enterButton.disabled = false;
    intro.classList.remove('is-lifting', 'is-dragging');
    liveStatus.textContent = 'اسحب الواجهة للأعلى أو اضغط ابدأ الإنجاز. يمكنك تخطي الافتتاحية.';
    window.SiteCrane3D?.open();
    measure(); setProgress(0);
    enterButton.focus({ preventScroll: true });
  }
  function release(event, cancelled) {
    if (!drag || (event.pointerId !== undefined && event.pointerId !== drag.id)) return;
    const moved = drag.moved;
    const pointer = drag.id;
    drag = null;
    intro.classList.remove('is-dragging');
    if (intro.hasPointerCapture?.(pointer)) intro.releasePointerCapture(pointer);
    if (moved) {
      suppressClick = true;
      clearTimeout(suppressTimer);
      suppressTimer = setTimeout(() => { suppressClick = false; }, 350);
    }
    if (!cancelled && progress >= .18) lift();
    else if (reduce.matches) setProgress(0);
    else animateTo(0, 420);
  }
  intro.addEventListener('pointerdown', event => {
    if (!active || lifted || event.button !== 0 || event.target.closest('button,a')) return;
    stop();
    drag = { id: event.pointerId, y: event.clientY, start: progress, moved: false };
    intro.setPointerCapture(event.pointerId);
    intro.classList.add('is-dragging');
  });
  intro.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const delta = drag.y - event.clientY;
    if (Math.abs(delta) > 6) drag.moved = true;
    if (reduce.matches) {
      if (delta > 65) { release(event, true); finish(true); }
      return;
    }
    setProgress(drag.start + delta / (geometry.h * .8));
  });
  intro.addEventListener('pointerup', event => release(event, false));
  intro.addEventListener('pointercancel', event => release(event, true));
  intro.addEventListener('lostpointercapture', event => { if (drag) release(event, true); });
  intro.addEventListener('click', event => { if (suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); } }, true);
  intro.addEventListener('wheel', event => {
    if (!active || event.ctrlKey) return;
    event.preventDefault();
    if (lifted || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    if (reduce.matches) { if (event.deltaY > 10) finish(true); return; }
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? geometry.h : 1);
    stop(); setProgress(progress + delta / (geometry.h * 1.4));
    if (progress >= .18) lift();
  }, { passive: false });
  enterButton.addEventListener('click', lift);
  skipButton.addEventListener('click', () => finish(true));
  replayButton.addEventListener('click', open);
  document.addEventListener('keydown', event => {
    if (!active) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    event.stopImmediatePropagation();
    if (event.key === 'Escape') { event.preventDefault(); finish(true); }
    else if (event.key === 'Tab') {
      const controls = [skipButton, enterButton].filter(button => !button.disabled);
      const i = controls.indexOf(document.activeElement);
      event.preventDefault(); controls[(i + (event.shiftKey ? -1 : 1) + controls.length) % controls.length].focus();
    } else if (['ArrowUp','ArrowDown','PageDown','PageUp'].includes(event.key)) { event.preventDefault(); lift(); }
  }, true);
  window.addEventListener('resize', () => {
    if (!active || resizeFrame) return;
    resizeFrame = requestAnimationFrame(() => {
      resizeFrame = 0;
      if (!active) return;
      measure(); setProgress(progress);
    });
  });
  reduce.addEventListener('change', () => { if (active && reduce.matches) { if (lifted) finish(true); else { stop(); setProgress(0); } } });
  document.addEventListener('visibilitychange', () => { if (document.hidden && active && lifted) finish(true); });
  // Install handlers before shielding the page: unavailable JavaScript never blocks entry.
  try { open(); replayButton.hidden = false; }
  catch { finish(true); intro.hidden = true; }
})();
