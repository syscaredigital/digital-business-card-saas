(function () {
  'use strict';
  function photo(id) { return '../../public/assets/images/medical-classic/' + id + '.jpg'; }
  window.SyncVCardTemplateConfig = {
    theme: 'medical-classic',
    demo: {
      title: 'Mitchell Satner', companyName: 'Medical Practice',
      description: 'Personalized care and clear guidance for your health and wellbeing.',
      email: 'mitchell@example.com', phone: '+94 77 123 4567', websiteUrl: 'https://example.com', address: 'Colombo, Sri Lanka',
      avatarUrl: photo('photo-1612349317150-e413f6a5b16d'),
      coverImageUrl: photo('photo-1516841273335-e39b37888115'),
      socialLinks: [{label:'LinkedIn',url:'https://linkedin.com'}, {label:'Facebook',url:'https://facebook.com'}],
      sections: {
        'basic-details': 'Doctor',
        services: 'Sports Doctor | Consultations and care for active lifestyles\nDietitian | Nutrition guidance tailored to your goals',
        galleries: 'Practice | '+photo('photo-1576091160550-2173dba999ef')+'\nCare | '+photo('photo-1538108149393-fbbd81895907'),
        products: 'Health Screening | Learn more about your health | '+photo('photo-1631815588090-d4bfec5b1ccb')+'\nWellness Consultation | Practical guidance for everyday wellbeing | '+photo('photo-1579154204601-01588f351e67')+'\nFollow-up Visit | Continue your care plan | '+photo('photo-1582719478250-c89cae4dc85b'),
        testimonials: 'A thoughtful, clear consultation from start to finish. | Sample Patient | Visitor\nThe team made the process easy to understand. | Sample Patient Two | Visitor',
        'business-hours': 'Monday - Friday | 9:00 AM - 5:00 PM',
        appointments: 'Medical consultation | 30\nFollow-up visit | 30'
      }
    },
    decorate: function (root, card, isDemo) {
      var footer = root.querySelector('.final-footer');
      var sections = Array.from(root.querySelectorAll(':scope > .final-section'));
      ['Contact','Make an Appointment','Our Services','Gallery','Products','Testimonials','QR Code','Business Hours','Enquiries'].forEach(function (title) {
        var section = sections.find(function (node) { return node.querySelector('h2').textContent === title; });
        if (section) { section.dataset.classicSection = title.toLowerCase().replace(/ /g, '-'); root.insertBefore(section, footer); }
      });
      var address = root.querySelector('div.final-contact-item');
      if (address && card.address) {
        var link = document.createElement('a'); link.className = address.className;
        link.href = 'https://maps.google.com/?q=' + encodeURIComponent(card.address);
        link.target = '_blank'; link.rel = 'noopener noreferrer';
        link.append.apply(link, Array.from(address.childNodes)); address.replaceWith(link);
      }
      root.querySelectorAll('[data-classic-section="our-services"] .final-item-media').forEach(function (media) {
        if (!media.querySelector('img')) media.innerHTML = '<svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="9"/></svg>';
      });
      var gallery = root.querySelector('.final-gallery');
      if (gallery) {
        var viewer = document.createElement('dialog'); viewer.className = 'medical-viewer'; viewer.setAttribute('aria-label', 'Gallery image');
        var close = document.createElement('button'); close.type = 'button'; close.textContent = 'Close image';
        var image = document.createElement('img'); image.alt = 'Enlarged gallery image'; viewer.append(close, image); root.appendChild(viewer);
        close.addEventListener('click', function () { viewer.close(); });
        viewer.addEventListener('click', function (event) { if (event.target === viewer) viewer.close(); });
        gallery.querySelectorAll('img').forEach(function (thumb, index) {
          var button = document.createElement('button'); button.type = 'button'; button.className = 'medical-gallery-button';
          button.setAttribute('aria-label', 'Open gallery image ' + (index + 1)); thumb.replaceWith(button); button.appendChild(thumb);
          button.addEventListener('click', function () { image.src = thumb.src; viewer.showModal(); close.focus(); });
        });
      }
      var qr = root.querySelector('.final-qr-panel');
      var avatar = root.querySelector('.final-avatar img');
      if (avatar) {
        var portrait = avatar.cloneNode(); portrait.className = 'medical-qr-avatar'; portrait.alt = 'Profile photo';
        portrait.addEventListener('error', function () { portrait.remove(); }, {once:true}); qr.appendChild(portrait);
      }
      var save = document.createElement('button'); save.type = 'button'; save.className = 'classic-save'; save.textContent = 'Save contact';
      var status = document.createElement('p'); status.className = 'classic-save-status'; status.setAttribute('role', 'status');
      save.addEventListener('click', function () {
        var trigger = document.querySelector('.vcard-save-trigger');
        if (!isDemo && trigger) trigger.click(); else status.textContent = 'Contact saving becomes available when this VCard is published.';
      });
      qr.append(save, status);
      var enquiry = root.querySelector('[data-classic-section="enquiries"]');
      var intro = document.createElement('p'); intro.className = 'medical-enquiry-intro'; intro.textContent = 'Questions about an appointment? Send an enquiry.';
      enquiry.querySelector('h2').after(intro);
      var note = document.createElement('p'); note.className = 'medical-emergency';
      note.textContent = 'For a medical emergency, contact your local emergency service. Do not use this form for urgent care.';
      enquiry.appendChild(note);
      if (isDemo) footer.textContent = 'Template preview · Sample information and reviews · Sync E-Card';
    }
  };
}());
