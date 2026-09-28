(function () {
  'use strict';
  function photo(id) { return '../../public/assets/images/corporate-classic/' + id + '.jpg'; }
  window.SyncVCardTemplateConfig = {
    theme: 'corporate-classic',
    demo: {
      title: 'John Wilson', companyName: 'Wilson Creative',
      description: 'Thoughtful digital solutions for ambitious businesses.',
      email: 'john@example.com', phone: '+94 77 645 6888', websiteUrl: 'https://example.com', address: '153 York Street, Colombo',
      avatarUrl: photo('photo-1560250097-0b93528c311a'),
      coverImageUrl: photo('photo-1521737604893-d14cc237f11d'),
      socialLinks: [{label:'Facebook',url:'https://facebook.com'}, {label:'X',url:'https://x.com'}, {label:'LinkedIn',url:'https://linkedin.com'}],
      sections: {
        'basic-details': 'Corporate CEO',
        services: 'Web Design | Responsive websites that help customers discover your business.\nGraphic Design | Clear visual identities and compelling creative work.\nSocial Media Management | Consistent storytelling and meaningful customer connections.',
        appointments: 'Consultation | 30\nProject planning | 60',
        galleries: ['photo-1560250097-0b93528c311a','photo-1551836022-d5d88e9218df','photo-1522071820081-009f0129c71c','photo-1556761175-b413da4baf72'].map(function (id,i) { return 'Our team ' + (i+1) + ' | ' + photo(id); }).join('\n'),
        products: 'Analytics Package | Understand your performance | ' + photo('photo-1551288049-bebda4e38f71') + '\nBusiness Dashboard | Your key metrics in one place | ' + photo('photo-1551288049-bebda4e38f71') + '\nDigital Strategy | A practical plan for growth | ' + photo('photo-1516321318423-f06f85e504b3'),
        testimonials: 'Excellent professional service. The team understood our requirements and delivered a great result. | Ronald Richards | Sample customer | ' + photo('photo-1507003211169-0a1dd7228f2d') + '\nReliable, creative and easy to work with. I would happily recommend their services. | Jenny Wilson | Sample business owner | ' + photo('photo-1494790108377-be9c29b29330'),
        'business-hours': 'Sunday | 09:00 - 17:00\nMonday | 09:00 - 17:00\nTuesday | 09:00 - 17:00\nWednesday | 09:00 - 17:00\nThursday | 09:00 - 17:00\nFriday | 09:00 - 17:00\nSaturday | Closed'
      }
    },
    decorate: function (root,card,isDemo) {
      var sections = Array.from(root.querySelectorAll(':scope > .final-section'));
      var footer = root.querySelector('.final-footer');
      ['Contact','Our Services','Make an Appointment','Gallery','Products','Testimonials','Business Hours','QR Code','Enquiries'].forEach(function (title) {
        var section = sections.find(function (node) { return node.querySelector('h2').textContent === title; });
        if(section) { section.dataset.classicSection = title.toLowerCase().replace(/ /g,'-'); root.insertBefore(section,footer); }
      });
      var address = root.querySelector('div.final-contact-item');
      if(address && card.address) {
        var link = document.createElement('a'); link.className = address.className;
        link.href = 'https://maps.google.com/?q=' + encodeURIComponent(card.address);
        link.target = '_blank'; link.rel = 'noopener noreferrer';
        link.append.apply(link,Array.from(address.childNodes)); address.replaceWith(link);
      }
      var icons = ['<path d="m4 17 1-5L16 1l7 7-11 11-5 1-3-3zm3-5 5 5M3 23h18"/>','<path d="M3 3h6v6H3zm12 12h6v6h-6zM9 6h9v9M6 9v9h9"/>','<circle cx="5" cy="12" r="3"/><circle cx="19" cy="5" r="3"/><circle cx="19" cy="19" r="3"/><path d="m8 11 8-5M8 13l8 5"/>'];
      root.querySelectorAll('[data-classic-section="our-services"] .final-item-media').forEach(function (media,i) {
        if(!media.querySelector('img')) media.innerHTML = '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">' + icons[i%icons.length] + '</svg>';
      });
      // Keep keyboard-operated testimonial navigation; never inject sample reviews into live cards.
      var testimonials = root.querySelector('.final-testimonials');
      if(testimonials) {
        var quotes = Array.from(testimonials.querySelectorAll('.final-quote'));
        testimonials.setAttribute('aria-live','polite');
        if(quotes.length>1) {
          var current = 0, controls = document.createElement('nav');
          controls.className = 'corporate-review-controls'; controls.setAttribute('aria-label','Testimonials');
          var counter = document.createElement('span');
          function show() { quotes.forEach(function (quote,i) { quote.hidden = i!==current; }); counter.textContent = (current+1)+' / '+quotes.length; }
          [-1,1].forEach(function (direction) {
            var button = document.createElement('button'); button.type = 'button';
            button.textContent = direction<0?'\u2190':'\u2192';
            button.setAttribute('aria-label',direction<0?'Previous testimonial':'Next testimonial');
            button.addEventListener('click',function () { current = (current+direction+quotes.length)%quotes.length; show(); });
            controls.appendChild(button);
          });
          controls.insertBefore(counter,controls.lastChild); testimonials.after(controls); show();
        }
      }
      var hours = root.querySelector('[data-classic-section="business-hours"]');
      var qrSection = root.querySelector('[data-classic-section="qr-code"]');
      if(hours) {
        var info = document.createElement('div'); info.className = 'corporate-info';
        hours.before(info); info.append(hours,qrSection);
      }
      var qr = root.querySelector('.final-qr-panel');
      var avatar = root.querySelector('.final-avatar img');
      if(avatar) {
        var portrait = avatar.cloneNode(); portrait.className = 'corporate-qr-avatar'; portrait.alt = 'Profile photo';
        portrait.addEventListener('error',function () { portrait.remove(); },{once:true}); qr.prepend(portrait);
      }
      var save = document.createElement('button'); save.type='button'; save.className='classic-save'; save.textContent='Save contact';
      var status = document.createElement('p'); status.className='classic-save-status'; status.setAttribute('role','status');
      save.addEventListener('click',function () {
        var trigger = document.querySelector('.vcard-save-trigger');
        if(!isDemo && trigger) trigger.click(); else status.textContent='Contact saving becomes available when this VCard is published.';
      });
      qr.append(save,status);
      // Visible labels also provide accessible names for the real shared forms.
      root.querySelectorAll('input,select,textarea').forEach(function (input,i) {
        var label = document.createElement('label'); label.className='corporate-field';
        var text = document.createElement('span');
        text.textContent = ({date:'Date',time:'Time',serviceName:'Service',meetingMode:'Meeting type'}[input.name]) || input.placeholder || input.name;
        input.id='corporate-field-'+i; label.htmlFor=input.id;
        if(input.tagName==='TEXTAREA') label.classList.add('corporate-field-wide');
        input.before(label); label.append(text,input);
      });
      var intro = document.createElement('p'); intro.className='corporate-enquiry-intro';
      intro.textContent='For service information, pricing or a custom requirement, send a message using the form below.';
      root.querySelector('.message-panel h2').after(intro);
      if(isDemo) footer.textContent='Template preview · Sample details · Sync E-Card';
    }
  };
}());
