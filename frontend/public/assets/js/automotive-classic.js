(function () {
  'use strict';
  function photo(id) {
    return '../../public/assets/images/automotive-classic/' + id + '.jpg';
  }
  window.SyncVCardTemplateConfig = {
    theme: 'automotive-classic',
    demo: {
      title: 'Mitchell Johnson', companyName: 'Drive Your Dreams',
      description: 'Vehicle sales, trade-ins and dependable after-sales care.',
      email: 'mitchell@example.com', phone: '+94 71 456 7892',
      websiteUrl: 'https://example.com', address: '125 Main Road, Colombo',
      avatarUrl: photo('photo-1500648767791-00dcc994a43e', 300),
      coverImageUrl: photo('photo-1504215680853-026ed2a45def', 900),
      socialLinks: [{label: 'WhatsApp', url: 'https://wa.me/94734567892'}, {label: 'Facebook', url: 'https://facebook.com'}, {label: 'Instagram', url: 'https://instagram.com'}, {label: 'LinkedIn', url: 'https://linkedin.com'}],
      sections: {
        'basic-details': 'Car Dealer | Showroom Owner',
        services: 'Sales | New and used vehicles\nTrade-In | Vehicle exchange\nFinancing | Flexible finance plans\nInsurance | Vehicle coverage',
        galleries: ['photo-1544829099-b9a0c07fad1a', 'photo-1494905998402-395d579af36f', 'photo-1503736334956-4c8f8e92946d', 'photo-1519641471654-76ce0107ad1b'].map(function (id, i) { return 'Vehicle ' + (i + 1) + ' | ' + photo(id); }).join('\n'),
        products: 'Vehicle Care | Maintenance essentials | ' + photo('photo-1487754180451-c456f719a1fc') + '\nSpare Parts | Quality replacements | ' + photo('photo-1578844251758-2f71da64c96f') + '\nAccessories | Make it yours | ' + photo('photo-1487754180451-c456f719a1fc') + '\nBody Paints | Finish and protection | ' + photo('photo-1586864387967-d02ef85d93e8'),
        testimonials: 'Fantastic range of vehicles. Highly recommended! | Eric Perera | Sample customer | ' + photo('photo-1560250097-0b93528c311a', 200),
        'business-hours': 'Monday - Friday | 8:30 AM - 6:30 PM\nSaturday | 8:30 AM - 7:00 PM\nSunday | Closed',
        appointments: 'Showroom visit | 30\nTest drive | 60'
      }
    },
    decorate: function (root, card, isDemo) {
      // Preserve the supplied design's reading order while sharing the real forms.
      var order = ['Contact', 'Our Services', 'Gallery', 'Business Hours', 'Enquiries', 'Products', 'Testimonials', 'Make an Appointment', 'QR Code'];
      var sections = Array.from(root.querySelectorAll(':scope > .final-section'));
      var footer = root.querySelector('.final-footer');
      order.forEach(function (title) {
        var section = sections.find(function (node) { return node.querySelector('h2').textContent === title; });
        if (!section) return;
        section.dataset.classicSection = title.toLowerCase().replace(/ /g, '-');
        root.insertBefore(section, footer);
      });
      var heading = root.querySelector('h1');
      var words = heading.textContent.trim().split(/\s+/);
      if (words.length > 1) {
        var accent = document.createElement('span');
        accent.textContent = words.pop();
        heading.replaceChildren(document.createTextNode(words.join(' ') + ' '), accent);
      }
      var address = root.querySelector('div.final-contact-item');
      if (address && card.address) {
        var link = document.createElement('a');
        link.className = address.className;
        link.href = 'https://maps.google.com/?q=' + encodeURIComponent(card.address);
        link.target = '_blank'; link.rel = 'noopener noreferrer';
        link.append.apply(link, Array.from(address.childNodes));
        address.replaceWith(link);
      }
      var enquiry = root.querySelector('.message-panel');
      var serviceIcons = [
        '<path d="m4 10 2-6h12l2 6M3 10h18v9H3zM6 19v2m12-2v2M6 14h2m8 0h2"/>',
        '<path d="M3 7h17m-5-5 5 5-5 5M21 17H4m5-5-5 5 5 5"/>',
        '<path d="m2 8 10-6 10 6H2zm1 14h18M5 11v8m7-8v8m7-8v8"/>',
        '<path d="m12 2 9 4v7c0 5-9 9-9 9s-9-4-9-9V6l9-4zm-5 10 3 3 7-7"/>'
      ];
      root.querySelectorAll('[data-classic-section="our-services"] .final-item-media').forEach(function (media, index) {
        if (!media.querySelector('img')) media.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true">' + serviceIcons[index % serviceIcons.length] + '</svg>';
      });
      var socials = root.querySelector('.final-socials');
      if (socials) enquiry.appendChild(socials);
      root.querySelectorAll('input,textarea,select').forEach(function (input) {
        input.setAttribute('aria-label', input.placeholder || ({date: 'Appointment date', time: 'Appointment time', serviceName: 'Service', meetingMode: 'Meeting type'}[input.name]) || input.name);
      });
      var qr = root.querySelector('.final-qr-panel');
      var avatar = root.querySelector('.final-avatar img');
      if (avatar) {
        var portrait = avatar.cloneNode(); portrait.className = 'classic-qr-avatar';
        portrait.alt = 'Profile photo';
        portrait.addEventListener('error', function () { portrait.remove(); }, {once:true});
        qr.prepend(portrait);
      }
      var save = document.createElement('button');
      save.type = 'button'; save.className = 'classic-save'; save.textContent = 'Save contact';
      var status = document.createElement('p'); status.className = 'classic-save-status'; status.setAttribute('role', 'status');
      save.addEventListener('click', function () {
        var trigger = document.querySelector('.vcard-save-trigger');
        if (!isDemo && trigger) trigger.click();
        else status.textContent = 'Contact saving becomes available when this VCard is published.';
      });
      qr.append(save, status);
      if (isDemo) footer.textContent = 'Template preview · Sample details · Sync E-Card';
    }
  };
}());
