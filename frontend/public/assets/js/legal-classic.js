(function () {
  'use strict';
  function photo(id) { return '../../public/assets/images/legal-classic/' + id + '.jpg'; }
  window.SyncVCardTemplateConfig = {
    theme: 'legal-classic',
    demo: {
      title: 'Mary Arden', companyName: 'Arden Legal',
      description: 'Experienced legal counsel providing strategic, reliable representation for individuals and businesses.',
      email: 'mary@example.com', phone: '+1 407 845 8740', websiteUrl: 'https://example.com', address: 'New York, USA',
      avatarUrl: photo('photo-1580489944761-15a19d654956'), coverImageUrl: photo('photo-1589829545856-d10d557cf95f'),
      socialLinks: [{label:'Facebook',url:'https://facebook.com'}, {label:'Instagram',url:'https://instagram.com'}, {label:'LinkedIn',url:'https://linkedin.com'}],
      sections: {
        'basic-details': 'Lawyer',
        services: 'Legal Advice | Guidance tailored to your circumstances\nContract Drafting | Clear written agreements\nLitigation | Representation in court proceedings\nConsultation | Discuss your legal questions',
        galleries: 'Law library | '+photo('photo-1589994965851-a8f479c573a9')+'\nCourthouse | '+photo('photo-1589578527966-fdac0f44566c')+'\nDocuments | '+photo('photo-1450101499163-c8848c66ca85')+'\nOffice | '+photo('photo-1505664194779-8beaceb93744'),
        products: 'Legal Resources | Reference materials | '+photo('photo-1505664194779-8beaceb93744')+'\nCourt Preparation | Case support | '+photo('photo-1589578527966-fdac0f44566c')+'\nDocument Review | Contract and document services | '+photo('photo-1589829545856-d10d557cf95f'),
        testimonials: 'Clear and professional advice throughout. | Sample Client | Business owner | '+photo('photo-1500648767791-00dcc994a43e'),
        'business-hours': 'Monday - Friday | 10:00 AM - 7:00 PM\nSaturday | 10:00 AM - 2:00 PM',
        appointments: 'Legal consultation | 60\nDocument review | 30'
      }
    },
    decorate: function (root, card, isDemo) {
      var footer = root.querySelector('.final-footer');
      var sections = Array.from(root.querySelectorAll(':scope > .final-section'));
      ['Contact','Our Services','Gallery','Make an Appointment','Testimonials','QR Code','Products','Business Hours','Enquiries'].forEach(function (title) {
        var section = sections.find(function (node) { return node.querySelector('h2').textContent === title; });
        if (section) { section.dataset.classicSection = title.toLowerCase().replace(/ /g, '-'); root.insertBefore(section, footer); }
      });
      var contact = root.querySelector('[data-classic-section="contact"]');
      var avatar = root.querySelector('.final-avatar img');
      if (avatar && contact) {
        var portrait = avatar.cloneNode(); portrait.className = 'legal-contact-portrait'; portrait.alt = 'Profile photo';
        portrait.addEventListener('error', function () { portrait.remove(); }, {once:true});
        contact.querySelector('.final-contact-grid').before(portrait);
      }
      var address = root.querySelector('div.final-contact-item');
      if (address && card.address) {
        var link = document.createElement('a'); link.className = address.className;
        link.href = 'https://maps.google.com/?q=' + encodeURIComponent(card.address); link.target = '_blank'; link.rel = 'noopener noreferrer';
        link.append.apply(link, Array.from(address.childNodes)); address.replaceWith(link);
      }
      var icons = ['<path d="M3 20h18M5 8l7-4 7 4M7 8v9m5-9v9m5-9v9M4 18h16"/>','<path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12h7m-7 4h7"/>','<path d="M12 3v17M3 8h18M5 8l-3 7h6l-3-7zm14 0-3 7h6l-3-7z"/>','<path d="M4 5h16v12H9l-5 4V5zM8 10h8m-8 3h6"/>'];
      root.querySelectorAll('[data-classic-section="our-services"] .final-item-media').forEach(function (media, i) {
        if (!media.querySelector('img')) media.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">' + icons[i % icons.length] + '</svg>';
      });
      var gallery = root.querySelector('.final-gallery');
      if (gallery) {
        var viewer = document.createElement('dialog'); viewer.className = 'legal-viewer'; viewer.setAttribute('aria-label', 'Gallery image');
        var close = document.createElement('button'); close.type = 'button'; close.textContent = 'Close image';
        var image = document.createElement('img'); image.alt = 'Enlarged gallery image'; viewer.append(close, image); root.appendChild(viewer);
        close.addEventListener('click', function () { viewer.close(); });
        viewer.addEventListener('click', function (event) { if (event.target === viewer) viewer.close(); });
        gallery.querySelectorAll('img').forEach(function (thumb, index) {
          var button = document.createElement('button'); button.type = 'button'; button.className = 'legal-gallery-button';
          button.setAttribute('aria-label', 'Open gallery image ' + (index + 1)); thumb.replaceWith(button); button.appendChild(thumb);
          button.addEventListener('click', function () { image.src = thumb.src; viewer.showModal(); close.focus(); });
        });
      }
      var qr = root.querySelector('.final-qr-panel');
      if (avatar) {
        var qrPortrait = avatar.cloneNode(); qrPortrait.className = 'legal-qr-avatar'; qrPortrait.alt = 'Profile photo';
        qrPortrait.addEventListener('error', function () { qrPortrait.remove(); }, {once:true}); qr.prepend(qrPortrait);
      }
      var save = document.createElement('button'); save.type = 'button'; save.className = 'classic-save'; save.textContent = 'Save contact';
      var status = document.createElement('p'); status.className = 'classic-save-status'; status.setAttribute('role', 'status');
      save.addEventListener('click', function () {
        var trigger = document.querySelector('.vcard-save-trigger');
        if (!isDemo && trigger) trigger.click(); else status.textContent = 'Contact saving becomes available when this VCard is published.';
      }); qr.append(save, status);
      if (isDemo) footer.textContent = 'Template preview · Sample information and review · Sync E-Card';
    }
  };
}());
