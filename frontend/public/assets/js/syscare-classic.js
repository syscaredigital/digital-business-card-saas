(function () {
  'use strict';
  var config = window.SyncVCardTemplateConfig;
  config.theme = 'syscare-classic';
  config.demo.title = 'Alex Morgan';
  config.demo.companyName = 'SysCare';
  config.demo.sections.blogs = 'Building a connected business | Practical ideas for better customer experiences | https://example.com/insights\nA smarter first impression | Make every introduction count | https://example.com/news';
  config.afterRender = function (root) {
    // Give credentials and professional details the full card width instead of
    // squeezing them into the column reserved beside the portrait.
    var nameBlock = root.querySelector('.final-name-block');
    if (nameBlock) {
      var details = document.createElement('div');
      details.className = 'syscare-professional-details';
      ['.final-qualifications', '.final-role', '.final-company'].forEach(function (selector) {
        var item = nameBlock.querySelector(selector);
        if (item) details.appendChild(item);
      });
      if (details.children.length) nameBlock.after(details);
    }
    var icons = {
      Website: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a18 18 0 0 1 0 18 18 18 0 0 1 0-18Z"/>',
      Location: '<path d="M20 10c0 6-8 11-8 11S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>'
    };
    root.querySelectorAll('.final-contact-item').forEach(function (item) {
      var label = item.querySelector('small'), icon = item.querySelector('.final-contact-icon');
      if (label && icon && icons[label.textContent]) icon.innerHTML = '<svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icons[label.textContent] + '</svg>';
    });
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
      counter.setAttribute('aria-live', 'off');
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
      var motion = window.matchMedia('(prefers-reduced-motion: reduce)');
      var paused = motion.matches, hovered = false, touching = false;
      var pause = document.createElement('button');
      pause.type = 'button'; pause.className = 'syscare-carousel-pause';
      pause.setAttribute('aria-controls', track.id);
      function showPlayback() {
        pause.textContent = paused ? 'Play' : 'Pause';
        pause.setAttribute('aria-label', (paused ? 'Play ' : 'Pause ') + collection[1].toLowerCase() + ' slideshow');
      }
      pause.addEventListener('click', function () { paused = !paused; showPlayback(); });
      motion.addEventListener('change', function (event) { if (event.matches) { paused = true; showPlayback(); } });
      controls.append(previous, counter, pause, next); track.after(controls);
      var section = track.parentElement;
      section.addEventListener('mouseenter', function () { hovered = true; });
      section.addEventListener('mouseleave', function () { hovered = false; });
      track.addEventListener('touchstart', function () { touching = true; }, { passive: true });
      track.addEventListener('touchend', function () { touching = false; }, { passive: true });
      track.addEventListener('touchcancel', function () { touching = false; }, { passive: true });
      var rotation = window.setInterval(function () {
        if (!track.isConnected) { window.clearInterval(rotation); return; }
        if (paused || hovered || touching || document.hidden || section.contains(document.activeElement)) return;
        go((current + 1) % slides.length);
      }, 5000);
      showPlayback();
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
