(function () {
  'use strict';
  var config = window.SyncVCardTemplateConfig;
  config.theme = 'syscare-classic';
  config.demo.title = 'Alex Morgan';
  config.demo.companyName = 'SysCare';
  config.demo.sections.blogs = 'Building a connected business | Practical ideas for better customer experiences | https://example.com/insights\nA smarter first impression | Make every introduction count | https://example.com/news';
  config.afterRender = function (root) {
    root.querySelectorAll('.corporate-review-controls').forEach(function (node) { node.remove(); });
    root.querySelectorAll('.final-quote').forEach(function (node) { node.hidden = false; });
    var blog = root.querySelector('[data-feature-key="blogs"]');
    if (blog) {
      var track = document.createElement('div');
      track.className = 'syscare-blog-track';
      Array.from(blog.querySelectorAll('.final-extra-item')).forEach(function (item) { track.appendChild(item); });
      blog.appendChild(track);
    }
    var collections = [
      ['[data-classic-section="our-services"] .final-card-grid', 'Services'],
      ['[data-classic-section="products"] .final-card-grid', 'Products'],
      ['.final-gallery', 'Gallery'], ['.final-testimonials', 'Testimonials'],
      ['.syscare-blog-track', 'Blogs']
    ];
    collections.forEach(function (collection, index) {
      var track = root.querySelector(collection[0]);
      if (!track || !track.children.length) return;
      var slides = Array.from(track.children);
      track.classList.add('syscare-carousel');
      track.id = 'syscare-carousel-' + index;
      track.tabIndex = 0;
      track.setAttribute('role', 'region');
      track.setAttribute('aria-roledescription', 'carousel');
      track.setAttribute('aria-label', collection[1]);
      track.removeAttribute('aria-live');
      slides.forEach(function (slide, i) {
        slide.setAttribute('role', 'group');
        slide.setAttribute('aria-roledescription', 'slide');
        slide.setAttribute('aria-label', (i + 1) + ' of ' + slides.length);
      });
      if (slides.length === 1) { track.classList.add('is-single'); return; }
      var controls = document.createElement('div'), counter = document.createElement('span');
      controls.className = 'syscare-carousel-controls';
      counter.setAttribute('aria-live', 'polite');
      var current = 0;
      function go(index) {
        var slide = slides[Math.max(0, Math.min(slides.length - 1, index))];
        track.scrollTo({ left: slide.offsetLeft - slides[0].offsetLeft,
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
      var previous = document.createElement('button'), next = document.createElement('button');
      [previous, next].forEach(function (button, i) {
        button.type = 'button'; button.textContent = i ? '\u2192' : '\u2190';
        button.setAttribute('aria-label', (i ? 'Next ' : 'Previous ') + collection[1].toLowerCase());
        button.setAttribute('aria-controls', track.id);
        button.addEventListener('click', function () { go(current + (i ? 1 : -1)); });
      });
      function update() {
        var nearest = Infinity;
        slides.forEach(function (slide, i) {
          var distance = Math.abs(slide.offsetLeft - slides[0].offsetLeft - track.scrollLeft);
          if (distance < nearest) { nearest = distance; current = i; }
        });
        counter.textContent = (current + 1) + ' / ' + slides.length;
        previous.disabled = current === 0; next.disabled = current === slides.length - 1;
      }
      controls.append(previous, counter, next); track.after(controls);
      track.addEventListener('scroll', update, { passive: true });
      track.addEventListener('keydown', function (event) {
        if (event.target !== track) return;
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault(); go(current + (event.key === 'ArrowRight' ? 1 : -1));
        }
      });
      update();
    });
  };
}());
