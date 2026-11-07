(() => {
'use strict';
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const viewport = $('.viewport');
const chapters = $$('.chapter');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const pad = n => String(n).padStart(2, '0');
let current = 0;
let scrollFrame = 0;
let wheelLock = 0;
let wheelSum = 0;
let wheelLast = 0;
const menu = $('#mobile-menu');
const menuToggle = $('.menu-toggle');
const dialog = $('#project-dialog');
const companyDialog = $('#company-dialog');
$('.about-more').addEventListener('click', () => { companyDialog.showModal(); window.SiteMotion?.popup(companyDialog); });
$('.company-dialog-close').addEventListener('click', () => companyDialog.close());
function setMenu(open) {
  menu.classList.toggle('open', open);
  menu.inert = !open;
  menuToggle.setAttribute('aria-expanded', String(open));
  menuToggle.setAttribute('aria-label', open ? 'إغلاق القائمة' : 'فتح القائمة');
}
menuToggle.addEventListener('click', () => setMenu(!menu.classList.contains('open')));
function activate(index) {
  if (index < 0 || index >= chapters.length) return;
  const previousIndex = current;
  current = index;
  chapters.forEach((chapter, n) => {
    chapter.classList.toggle('is-active', n === index);
    if (n === index) chapter.classList.remove('leaving');
  });
  document.body.dataset.theme = chapters[index].classList.contains('light') ? 'light' : 'dark';
  $$('.chapter-nav a').forEach((a, n) => {
    a.classList.toggle('active', n === index);
    if (n === index) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
  });
  $$('.main-nav a').forEach(a => {
    const selected = a.hash === '#' + chapters[index].id;
    a.classList.toggle('current', selected);
    if (selected) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
  });
  $('#current-number').textContent = pad(index + 1);
  $('#current-title').textContent = chapters[index].dataset.title;
  $('.progress-track i').style.width = ((index + 1) / chapters.length * 100) + '%';
  $('#section-up').disabled = index === 0;
  $('#section-down').disabled = index === chapters.length - 1;
  $('#scroll-hint').setAttribute('aria-label', index === chapters.length - 1 ? 'العودة إلى البداية' : 'انتقل إلى القسم التالي');
  $('#scroll-hint>span:nth-child(2)').textContent = index === chapters.length - 1 ? 'العودة إلى البداية' : 'مرّر لاكتشاف المزيد';
  window.SiteMotion?.enter(chapters[index], previousIndex);
  window.SiteHeroVideo?.sync();
}
function updateFromScroll() {
  const marker = viewport.scrollTop + viewport.clientHeight * .34;
  let next = 0;
  chapters.forEach((chapter, n) => { if (chapter.offsetTop <= marker) next = n; });
  if (next !== current) activate(next);
  scrollFrame = 0;
}
viewport.addEventListener('scroll', () => {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(updateFromScroll);
}, { passive: true });
function goTo(index, updateHash = true, focusDestination = false) {
  if (index < 0 || index >= chapters.length) return;
  setMenu(false);
  if (focusDestination) {
    const heading = $('h1, h2', chapters[index]);
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }
  if (index !== current) chapters[current].classList.add('leaving');
  viewport.scrollTo({ top: chapters[index].offsetTop, behavior: reducedMotion.matches ? 'instant' : 'smooth' });
  if (updateHash) history.replaceState(null, '', '#' + chapters[index].id);
  $('.section-announcer').textContent = chapters[index].dataset.title + '، القسم ' + (index + 1) + ' من ' + chapters.length;
  window.setTimeout(() => chapters.forEach(c => c.classList.remove('leaving')), 850);
}
$$('a[href^="#"]').forEach(link => {
  const index = chapters.findIndex(c => '#' + c.id === link.getAttribute('href'));
  if (index >= 0) link.addEventListener('click', event => { event.preventDefault(); goTo(index, true, true); });
});
$('#section-up').addEventListener('click', () => goTo(current - 1));
$('#section-down').addEventListener('click', () => goTo(current + 1));
$('#scroll-hint').addEventListener('click', () => goTo((current + 1) % chapters.length));
viewport.addEventListener('wheel', event => {
  if (window.innerWidth <= 900 || companyDialog.open || dialog.open || menu.classList.contains('open') || event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
  const chapter = chapters[current];
  const y = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1);
  if (Math.abs(y) < 2) return;
  const atTop = chapter.scrollTop < 2;
  const atBottom = chapter.scrollTop + chapter.clientHeight >= chapter.scrollHeight - 2;
  if (chapter.scrollHeight > chapter.clientHeight + 3 && ((y > 0 && !atBottom) || (y < 0 && !atTop))) return;
  event.preventDefault();
  const now = performance.now();
  if (now < wheelLock) return;
  if (now - wheelLast > 180 || Math.sign(wheelSum) !== Math.sign(y)) wheelSum = 0;
  wheelLast = now;
  wheelSum += y;
  if (Math.abs(wheelSum) < 32) return;
  const next = current + Math.sign(wheelSum);
  wheelSum = 0;
  if (next < 0 || next >= chapters.length) return;
  wheelLock = now + 1100;
  goTo(next);
}, { passive: false });
document.addEventListener('keydown', event => {
  if (window.SiteIntro?.active) return;
  if (event.key === 'Escape') {
    if (menu.classList.contains('open')) { setMenu(false); menuToggle.focus(); }
    return;
  }
  if (dialog.open) {
    if (event.key === 'ArrowLeft') { event.preventDefault(); showLightbox(lightboxIndex + 1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); showLightbox(lightboxIndex - 1); }
    return;
  }
  if (companyDialog.open) return;
  if (menu.classList.contains('open') || event.altKey || event.metaKey || event.ctrlKey || /INPUT|TEXTAREA|SELECT|BUTTON|SUMMARY/.test(event.target.tagName)) return;
  const keys = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1 };
  if (keys[event.key]) {
    if (innerWidth <= 900) return;
    event.preventDefault();
    const chapter = chapters[current];
    const direction = keys[event.key];
    const canScroll = direction > 0 ? chapter.scrollTop + chapter.clientHeight < chapter.scrollHeight - 2 : chapter.scrollTop > 2;
    if (canScroll) {
      chapter.scrollBy({ top: direction * (event.key.startsWith('Page') ? chapter.clientHeight * .8 : 80), behavior: reducedMotion.matches ? 'instant' : 'smooth' });
    } else goTo(current + direction);
  }
  if (event.key === 'Home') { event.preventDefault(); goTo(0); }
  if (event.key === 'End') { event.preventDefault(); goTo(chapters.length - 1); }
});
window.addEventListener('hashchange', () => {
  const index = chapters.findIndex(c => '#' + c.id === location.hash);
  if (index >= 0) goTo(index, false);
});
let serviceTimer;
$$('.service-list summary').forEach((summary, index) => {
  summary.addEventListener('click', event => {
    event.preventDefault();
    const details = summary.parentElement;
    if (details.open) return;
    $$('.service-list details').forEach(d => { d.open = d === details; });
    const image = $('#service-image');
    image.classList.add('changing');
    clearTimeout(serviceTimer);
    serviceTimer = setTimeout(() => {
      image.src = 'assets/service-' + details.dataset.image + '.webp';
      image.alt = $('h3', summary).textContent;
      $('#service-image-title').textContent = details.dataset.caption;
      $('.service-big-number').textContent = pad(index + 1);
      const finish = () => { image.classList.remove('changing'); window.SiteMotion?.service(image); };
      if (image.complete) finish(); else { image.onload = finish; image.onerror = finish; }
    }, reducedMotion.matches ? 0 : 180);
  });
});
const photos = Array.from({ length: 10 }, (_, i) => ({
  id: i + 1,
  category: i < 8 ? 'buildings' : 'equipment',
  src: 'assets/project-' + pad(i + 1) + '.webp',
  title: i < 8 ? 'من مشاريع البناء' : 'أعمال الحفر والمعدات',
  alt: i < 3 ? 'واجهات حجرية وزجاجية لأحد مباني الشركة' : i < 8 ? 'واجهة مبنى من معرض مشاريع الشركة' : 'موقع أعمال الحفر ومعدات الشركة'
}));
let filter = 'all';
let galleryPage = 0;
let lightboxIndex = 0;
let lightboxPhotos = photos;
function pageSize() { return innerWidth <= 600 ? 1 : innerWidth <= 900 ? 2 : 3; }
function filteredPhotos() { return photos.filter(p => filter === 'all' || p.category === filter); }
function renderGallery() {
  const list = filteredPhotos();
  const size = pageSize();
  const totalPages = Math.ceil(list.length / size);
  galleryPage = ((galleryPage % totalPages) + totalPages) % totalPages;
  const start = galleryPage * size;
  const visible = list.slice(start, start + size);
  $('#project-gallery').innerHTML = visible.map(photo => `<button class="project-card" data-id="${photo.id}" aria-label="تكبير الصورة ${photo.id}: ${photo.alt}"><img src="${photo.src}" alt="${photo.alt}" loading="lazy" width="960" height="1280"><span class="project-label"><span><small>روابي إنجاز تهامة / ${pad(photo.id)}</small><strong>${photo.title}</strong></span><span class="round-button"><svg><use href="#external"/></svg></span></span></button>`).join('');
  $('#project-count').textContent = pad(start + 1) + (visible.length > 1 ? ' — ' + pad(start + visible.length) : '') + ' / ' + pad(list.length);
  $$('.project-card').forEach(button => button.addEventListener('click', () => {
    lightboxPhotos = list;
    showLightbox(list.findIndex(p => p.id === Number(button.dataset.id)));
    dialog.showModal();
    window.SiteMotion?.popup(dialog);
  }));
  window.SiteMotion?.gallery();
}
$$('.project-tabs button').forEach(button => button.addEventListener('click', () => {
  filter = button.dataset.filter;
  galleryPage = 0;
  $$('.project-tabs button').forEach(b => {
    b.classList.toggle('selected', b === button);
    b.setAttribute('aria-pressed', String(b === button));
  });
  renderGallery();
}));
$('#project-prev').addEventListener('click', () => { galleryPage--; renderGallery(); });
$('#project-next').addEventListener('click', () => { galleryPage++; renderGallery(); });
function showLightbox(index) {
  lightboxIndex = (index + lightboxPhotos.length) % lightboxPhotos.length;
  const photo = lightboxPhotos[lightboxIndex];
  $('.dialog-image img').src = photo.src;
  $('.dialog-image img').alt = photo.alt;
  $('#lightbox-caption').textContent = photo.title + ' — ' + pad(lightboxIndex + 1) + ' / ' + pad(lightboxPhotos.length);
  if (dialog.open) window.SiteMotion?.lightbox($('.dialog-image'));
}
$('.dialog-close').addEventListener('click', () => dialog.close());
$('#lightbox-prev').addEventListener('click', () => showLightbox(lightboxIndex - 1));
$('#lightbox-next').addEventListener('click', () => showLightbox(lightboxIndex + 1));
dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
const testimonials = [
  ['أحمد الزهراني', 'الخدمة ممتازة والأسعار معقولة، صراحة كنت متخوف أول لكن بعد ما شفت النتيجة عرفت إني اخترت الشركة الصح. كل الشكر لهم'],
  ['عبد الله', 'شغّلوا لي مشروع تجاري وكانوا ملتزمين بالتسليم في الموعد، كل شيء كان مرتب ومنظم. كنا مطمئنين لهم من البداية لنهايته، وفعلاً استحقوا الثقة'],
  ['محمد المالكي', 'رغم حجم المشروع الكبير، روابي إنجاز تهامة تعاملوا مع كل التفاصيل باحترافية، وفريقهم كان متعاون ومرن. شعرت بالراحة أنهم في أيدٍ أمينة'],
  ['عبد الله الحربي', 'أعجبني اهتمامهم بتقديم حلول سريعة وفعّالة. الصيانة اللي سووها للمبنى كانت رائعة، وفعلاً شغلهم كان نظيف ومرتب. أنصح فيهم لأي شخص يبغى جودة وخدمة متميزة']
];
let testimonialIndex = 0;
function showTestimonial(index) {
  testimonialIndex = (index + testimonials.length) % testimonials.length;
  const [name, quote] = testimonials[testimonialIndex];
  $('#testimonial-copy blockquote').textContent = quote;
  $('#testimonial-copy strong').textContent = name;
  $('.author-initial').textContent = name.charAt(0);
  $('#testimonial-count').textContent = pad(testimonialIndex + 1) + ' / 04';
  if (!reducedMotion.matches) $('#testimonial-copy').animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 430, easing: 'cubic-bezier(.22,1,.36,1)' });
}
$('#testimonial-prev').addEventListener('click', () => showTestimonial(testimonialIndex - 1));
$('#testimonial-next').addEventListener('click', () => showTestimonial(testimonialIndex + 1));
let lastPageSize = pageSize();
window.addEventListener('resize', () => {
  if (pageSize() !== lastPageSize) { lastPageSize = pageSize(); galleryPage = 0; renderGallery(); }
  if (innerWidth > 900) setMenu(false);
  updateFromScroll();
});
$('#year').textContent = new Date().getFullYear();
renderGallery();
activate(0);
const initialIndex = chapters.findIndex(c => '#' + c.id === location.hash);
if (initialIndex > 0) requestAnimationFrame(() => { viewport.scrollTo({ top: chapters[initialIndex].offsetTop, behavior: 'instant' }); activate(initialIndex); });
})();
