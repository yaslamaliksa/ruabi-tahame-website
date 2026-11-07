/* Architectural motion: progressive enhancement, no content replacement. */
(() => {
  'use strict';
  if (!Element.prototype.animate || !window.IntersectionObserver) return;
  const root = document.documentElement;
  const viewport = document.querySelector('.viewport');
  const chapters = [...document.querySelectorAll('.chapter')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const ease = 'cubic-bezier(.16,1,.3,1)';
  const animations = new Map();
  const pending = new Map();
  const pointerBindings = new WeakSet();
  const pointerTargets = new Set();
  let activeChapter;
  let direction = 1;
  let pointerFrame = 0;
  let scrollFrame = 0;
  let lastPointer;
  let lastScroll = viewport.scrollTop;
  let entered = false;

  // Wrap complete Arabic lines; never separate connected Arabic characters.
  chapters.forEach(chapter => {
    chapter.querySelectorAll('h2').forEach(heading => {
      const parts = [[]];
      [...heading.childNodes].forEach(node => {
        if (node.nodeName === 'BR') parts.push([]); else parts[parts.length - 1].push(node);
      });
      const fragment = document.createDocumentFragment();
      parts.forEach(nodes => {
        const line = document.createElement('span');
        const ink = document.createElement('span');
        line.className = 'motion-heading-line';
        ink.className = 'motion-heading-ink';
        nodes.forEach(node => ink.append(node));
        line.append(ink); fragment.append(line);
      });
      heading.replaceChildren(fragment);
    });
  });
  root.classList.add('motion-enhanced');

  function stop(element) {
    const previous = animations.get(element);
    if (previous) { previous.cancel(); animations.delete(element); }
  }
  function animate(element, frames, options = {}) {
    if (!element || reduce.matches) return;
    stop(element);
    element.dataset.motionState = 'playing';
    const animation = element.animate(frames, {
      duration: 720, easing: ease, fill: 'both', ...options
    });
    animations.set(element, animation);
    animation.finished.then(() => {
      if (animations.get(element) !== animation) return;
      element.dataset.motionState = 'done';
      animations.delete(element);
      animation.cancel();
    }).catch(() => {});
  }
  function inView(element) {
    const r = element.getBoundingClientRect();
    return r.bottom > 100 && r.top < viewport.clientHeight - 85;
  }
  function reveal(element, plan) {
    pending.delete(element); observer.unobserve(element);
    if (reduce.matches || plan.chapter !== activeChapter) {
      element.dataset.motionState = 'done'; return;
    }
    const delay = plan.delay;
    if (element.matches('.motion-heading-ink, .line-mask > span')) {
      animate(element, [
        { opacity: 0, transform: `translate3d(0,${direction * 105}%,0) rotate(${direction * 1.2}deg)` },
        { opacity: 1, transform: 'translate3d(0,0,0) rotate(0deg)' }
      ], { duration: 980, delay });
    } else if (element.matches('.about-visual, .services-visual')) {
      animate(element, [
        { opacity: 1, clipPath: direction > 0 ? 'inset(0 0 100% 0)' : 'inset(100% 0 0 0)' },
        { opacity: 1, clipPath: 'inset(0 0 0% 0)' }
      ], { duration: 1120, delay: 100 });
      const photo = element.querySelector('img');
      if (photo) animate(photo, [{ transform: 'scale(1.12)' }, { transform: 'scale(1)' }], { duration: 1550, delay: 100 });
    } else if (element.matches('.project-gallery')) {
      element.dataset.motionState = 'done';
      gallery();
    } else {
      const x = element.matches('.values article, .contact-item') ? -12 : 0;
      animate(element, [
        { opacity: 0, transform: `translate3d(${x}px,${direction * 26}px,0)` },
        { opacity: 1, transform: 'translate3d(0,0,0)' }
      ], { duration: 760, delay });
    }
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const plan = pending.get(entry.target);
      if (entry.isIntersecting && plan && plan.chapter === activeChapter) {
        reveal(entry.target, { ...plan, delay: Math.min(plan.delay, 100) });
      }
    });
  }, { root: viewport, rootMargin: '-85px 0px -75px 0px', threshold: .01 });

  function enter(chapter, previousIndex = -1) {
    if (window.SiteIntro?.active && !window.SiteIntro.revealing) return;
    const index = chapters.indexOf(chapter);
    if (chapter === activeChapter && entered) return;
    direction = previousIndex < 0 || index >= previousIndex ? 1 : -1;
    animations.forEach((animation, element) => {
      animation.cancel(); element.dataset.motionState = 'done';
    });
    animations.clear();
    pending.forEach((_, element) => { element.dataset.motionState = 'done'; observer.unobserve(element); });
    pending.clear();
    if (activeChapter) activeChapter.classList.remove('motion-enter');
    activeChapter = chapter;
    entered = true;
    resetPointer();
    chapters.forEach(c => { c.style.setProperty('--scroll-drift', '0px'); });
    if (reduce.matches) return;
    chapter.dataset.motionDirection = direction > 0 ? 'down' : 'up';
    chapter.classList.remove('motion-enter');
    // Restart only this chapter's decorative line drawings.
    requestAnimationFrame(() => {
      if (activeChapter === chapter && !reduce.matches) chapter.classList.add('motion-enter');
    });
    const candidates = [...chapter.querySelectorAll('.reveal')].filter(element => {
      if (element.matches('h2, .service-list, .about-points')) { element.dataset.motionState = 'done'; return false; }
      return true;
    });
    candidates.push(...chapter.querySelectorAll('.motion-heading-ink, .line-mask > span, .service-list details, .about-points > div'));
    candidates.forEach((element, n) => {
      const heading = element.matches('.motion-heading-ink, .line-mask > span');
      const row = element.matches('.values article, .contact-item');
      let delay = Math.min(n * 65, 360);
      if (heading) {
        const lines = [...element.parentElement.parentElement.querySelectorAll('.motion-heading-ink, .line-mask > span')];
        delay = 100 + Math.max(lines.indexOf(element), 0) * 120;
      }
      if (row) delay = 120 + (n % 4) * 90;
      if (element.matches('.service-list details, .about-points > div')) {
        const siblings = [...element.parentElement.children];
        delay = 130 + siblings.indexOf(element) * 55;
      }
      const plan = { chapter, delay };
      element.dataset.motionState = 'waiting';
      pending.set(element, plan);
      if (inView(element)) reveal(element, plan); else observer.observe(element);
    });
    if (chapter.id === 'home') {
      animate(chapter.querySelector('.hero-photo video, .hero-photo img'), [
        { transform: 'scale(1.15)', filter: 'brightness(.65) saturate(.65)' },
        { transform: 'scale(1)', filter: chapter.querySelector('.hero-photo video') ? 'brightness(1.04) saturate(.96)' : 'brightness(.95) saturate(.84)' }
      ], { duration: 1850 });
    }
    bindPointer();
  }

  function gallery() {
    bindPointer();
    if (reduce.matches || activeChapter?.id !== 'projects') return;
    activeChapter.querySelectorAll('.project-card').forEach((card, n) => {
      animate(card, [
        { opacity: 0, clipPath: 'inset(0 0 12% 0)', transform: `translate3d(0,${direction * 30}px,0)` },
        { opacity: 1, clipPath: 'inset(0 0 0% 0)', transform: 'translate3d(0,0,0)' }
      ], { duration: 850, delay: n * 105 });
    });
  }
  function service(element) {
    if (reduce.matches) return;
    animate(element, [
      { opacity: 0, clipPath: 'inset(0 0 0 100%)', transform: 'scale(1.07)' },
      { opacity: 1, clipPath: 'inset(0 0 0 0%)', transform: 'scale(1)' }
    ], { duration: 740 });
    animate(document.querySelector('#service-image-title'), [
      { opacity: 0, transform: 'translate3d(0,12px,0)' },
      { opacity: 1, transform: 'translate3d(0,0,0)' }
    ], { duration: 550, delay: 70 });
  }
  function popup(element) {
    if (reduce.matches || !element.open) return;
    animate(element, [
      { opacity: 0, transform: 'translate3d(0,20px,0) scale(.975)' },
      { opacity: 1, transform: 'translate3d(0,0,0) scale(1)' }
    ], { duration: 430 });
  }
  function lightbox(element) {
    animate(element, [{ opacity: .25, transform: 'scale(.985)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 450 });
  }
  function resetPointer() {
    lastPointer = null;
    if (pointerFrame) cancelAnimationFrame(pointerFrame);
    pointerFrame = 0;
    pointerTargets.forEach(element => {
      element.style.removeProperty('--tilt-x'); element.style.removeProperty('--tilt-y');
      element.style.removeProperty('--hover-x'); element.style.removeProperty('--hover-y');
      element.style.removeProperty('translate');
    });
    pointerTargets.clear();
    chapters[0].style.removeProperty('--pointer-x'); chapters[0].style.removeProperty('--pointer-y');
  }
  function bindPointer() {
    document.querySelectorAll('.project-card, .button.primary, .header-contact').forEach(element => {
      if (pointerBindings.has(element)) return;
      pointerBindings.add(element);
      element.addEventListener('pointermove', event => {
        if (reduce.matches || !finePointer.matches || event.pointerType === 'touch') return;
        const r = element.getBoundingClientRect();
        const x = (event.clientX - r.left) / r.width - .5;
        const y = (event.clientY - r.top) / r.height - .5;
        pointerTargets.add(element);
        if (element.matches('.project-card')) {
          element.style.setProperty('--tilt-x', (-y * 3.2).toFixed(2) + 'deg');
          element.style.setProperty('--tilt-y', (x * 3.2).toFixed(2) + 'deg');
          element.style.setProperty('--hover-x', (x * -8).toFixed(2) + 'px');
          element.style.setProperty('--hover-y', (y * -8).toFixed(2) + 'px');
        } else element.style.translate = (x * 6).toFixed(2) + 'px ' + (y * 5).toFixed(2) + 'px';
      }, { passive: true });
      element.addEventListener('pointerleave', () => {
        ['--tilt-x', '--tilt-y', '--hover-x', '--hover-y'].forEach(key => element.style.removeProperty(key));
        element.style.removeProperty('translate'); pointerTargets.delete(element);
      }, { passive: true });
    });
  }
  const hero = chapters[0];
  hero.addEventListener('pointermove', event => {
    if (reduce.matches || !finePointer.matches || activeChapter !== hero) return;
    lastPointer = { x: event.clientX, y: event.clientY };
    if (!pointerFrame) pointerFrame = requestAnimationFrame(() => {
      pointerFrame = 0;
      if (!lastPointer || reduce.matches || !finePointer.matches || document.hidden || activeChapter !== hero) return;
      hero.style.setProperty('--pointer-x', ((lastPointer.x / innerWidth - .5) * -12).toFixed(2) + 'px');
      hero.style.setProperty('--pointer-y', ((lastPointer.y / innerHeight - .5) * -8).toFixed(2) + 'px');
    });
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { lastPointer = null; resetPointer(); });
  viewport.addEventListener('scroll', () => {
    if (reduce.matches || !finePointer.matches || !activeChapter || scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      if (reduce.matches || !finePointer.matches || document.hidden) return;
      const top = viewport.scrollTop;
      root.dataset.scrollDirection = top >= lastScroll ? 'down' : 'up';
      lastScroll = top;
      if (activeChapter.id === 'home' || activeChapter.id === 'why-us') {
        const offset = Math.max(-1, Math.min(1, (top - activeChapter.offsetTop) / viewport.clientHeight));
        activeChapter.style.setProperty('--scroll-drift', (offset * 22).toFixed(2) + 'px');
      }
    });
  }, { passive: true });
  reduce.addEventListener('change', () => {
    if (reduce.matches) {
      animations.forEach((animation, element) => { animation.cancel(); element.dataset.motionState = 'done'; });
      animations.clear();
      pending.forEach((_, element) => { element.dataset.motionState = 'done'; observer.unobserve(element); });
      pending.clear(); chapters.forEach(c => { c.classList.remove('motion-enter'); c.style.removeProperty('--scroll-drift'); });
      resetPointer();
    }
  });
  finePointer.addEventListener('change', resetPointer);
  document.addEventListener('visibilitychange', () => { if (document.hidden) resetPointer(); });
  document.addEventListener('focusin', event => {
    // Keyboard focus always wins over a decorative entrance delay.
    const waiting = event.target.closest('[data-motion-state="waiting"]');
    if (waiting) { stop(waiting); pending.delete(waiting); observer.unobserve(waiting); waiting.dataset.motionState = 'done'; }
  });
  function replay() {
    entered = false;
    const chapter = document.querySelector('.chapter.is-active');
    if (chapter) enter(chapter, chapters.indexOf(chapter));
  }
  window.SiteMotion = { enter, gallery, service, popup, lightbox, replay };
})();
