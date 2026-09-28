(function () {
  'use strict';
  function photo(id) { return '../../public/assets/images/events-classic/' + id + '.jpg'; }
  window.SyncVCardTemplateConfig = {
    theme: 'events-classic',
    demo: {
      title: 'Vanessa Joe', companyName: 'Vanessa Joe Events',
      description: 'We plan. You celebrate. Your occasion, perfectly planned.',
      email: 'vanessa@example.com', phone: '+94 76 456 8988', websiteUrl: 'https://example.com', address: '153 York Street, Colombo',
      avatarUrl: photo('photo-1494790108377-be9c29b29330'), coverImageUrl: photo('photo-1519167758481-83f550bb49b3'),
      socialLinks: [{label:'Facebook',url:'https://facebook.com'}, {label:'Instagram',url:'https://instagram.com'}, {label:'LinkedIn',url:'https://linkedin.com'}, {label:'X',url:'https://x.com'}],
      sections: {
        'basic-details': 'Event Planner',
        services: 'Event Planning | Memorable occasions tailored to you\nWedding Planning | Thoughtful details for your special day\nCorporate Events | Professional events that impress',
        galleries: ['photo-1464366400600-7168b8af9bc3','photo-1507504031003-b417219a0fde','photo-1519167758481-83f550bb49b3','photo-1519225421980-715cb0215aed'].map(function (id,i) { return 'Celebration ' + (i+1) + ' | ' + photo(id); }).join('\n'),
        products: 'Garden Tablescape | LKR 720,000 | Sample package | ' + photo('photo-1519167758481-83f550bb49b3') + '\nWhite & Gold Tablescape | LKR 1,250,000 | Sample package | ' + photo('photo-1464366400600-7168b8af9bc3') + '\nGarden Wedding Decor | LKR 2,250,000 | Sample package | ' + photo('photo-1507504031003-b417219a0fde'),
        testimonials: 'Thoughtful planning and beautiful details made our celebration unforgettable. | Nadeesha P. | Sample client | ' + photo('photo-1522673607200-164d1b6ce486'),
        appointments: 'Event consultation | 30\nWedding consultation | 60\nCorporate event planning | 60',
        'business-hours': 'Monday | 10:00 AM - 7:00 PM\nTuesday | 10:00 AM - 7:00 PM\nWednesday | 10:00 AM - 7:00 PM\nThursday | 10:00 AM - 7:00 PM\nFriday | 10:00 AM - 8:00 PM\nSaturday | Closed\nSunday | Closed'
      }
    },
    decorate: function (root,card,isDemo) {
      var footer = root.querySelector('.final-footer');
      var sections = Array.from(root.querySelectorAll(':scope > .final-section'));
      ['Contact','Our Services','Gallery','Products','Testimonials','Make an Appointment','Business Hours','QR Code','Enquiries'].forEach(function (title) {
        var section = sections.find(function (node) { return node.querySelector('h2').textContent === title; });
        if(section) {
          section.dataset.classicSection = title.toLowerCase().replace(/ /g,'-'); root.insertBefore(section,footer);
          if(title==='Testimonials') section.querySelector('h2').textContent='What Our Clients Say';
          if(title==='QR Code') section.querySelector('h2').textContent='Our QR Code';
        }
      });
      var address = root.querySelector('div.final-contact-item');
      if(address && card.address) {
        var link=document.createElement('a'); link.className=address.className;
        link.href='https://maps.google.com/?q='+encodeURIComponent(card.address); link.target='_blank'; link.rel='noopener noreferrer';
        link.append.apply(link,Array.from(address.childNodes)); address.replaceWith(link);
      }
      var icons = ['<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6m10-6v6M3 11h18M7 15h3m4 0h3m-10 3h3"/>','<circle cx="12" cy="14" r="7"/><path d="m8 5 4-3 4 3-4 4-4-4z"/>','<path d="m3 3 8 2-2 7c-2 4-8 2-7-2l1-7zm18 0-8 2 2 7c2 4 8 2 7-2l-1-7zM5 15l-1 6m-2-1 5 2m12-7 1 6m-3 1 5-2"/>'];
      root.querySelectorAll('[data-classic-section="our-services"] .final-item-media').forEach(function (media,i) {
        if(!media.querySelector('img')) media.innerHTML='<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">'+icons[i%icons.length]+'</svg>';
      });
      // Each dot is a real, keyboard-accessible page control, shown only when needed.
      function paginate(container,selector,pageSize,label) {
        if(!container) return;
        var items=Array.from(container.querySelectorAll(selector)), count=Math.ceil(items.length/pageSize);
        if(count<2) return;
        var controls=document.createElement('nav'); controls.className='events-pagination'; controls.setAttribute('aria-label',label+' pages');
        function show(page) {
          items.forEach(function (item,i) { item.hidden=Math.floor(i/pageSize)!==page; });
          controls.querySelectorAll('button').forEach(function (button,i) { button.setAttribute('aria-pressed',String(i===page)); });
        }
        for(var i=0;i<count;i++) {
          (function (page) {
            var button=document.createElement('button'); button.type='button'; button.setAttribute('aria-label',label+' page '+(page+1));
            button.addEventListener('click',function () { show(page); }); controls.appendChild(button);
          }(i));
        }
        container.after(controls); show(0);
      }
      paginate(root.querySelector('.final-gallery'),'figure',4,'Gallery');
      paginate(root.querySelector('.final-testimonials'),'.final-quote',1,'Testimonial');
      var hours=root.querySelector('.final-hours');
      if(hours) {
        var panel=document.createElement('div'); panel.className='events-hours-panel';
        var clock=document.createElement('span'); clock.className='events-clock'; clock.setAttribute('aria-hidden','true');
        clock.innerHTML='<svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2"><circle cx="24" cy="24" r="19"/><path d="M24 11v14l10 6"/></svg>';
        hours.before(panel); panel.append(clock,hours);
      }
      root.querySelectorAll('input,textarea,select').forEach(function (input) {
        input.setAttribute('aria-label',({date:'Appointment date',time:'Appointment time',serviceName:'Service',meetingMode:'Meeting type'}[input.name]) || input.placeholder || input.name);
      });
      var qr=root.querySelector('.final-qr-panel'), avatar=root.querySelector('.final-avatar img');
      if(avatar) {
        var portrait=avatar.cloneNode(); portrait.className='events-qr-avatar'; portrait.alt='Profile photo';
        portrait.addEventListener('error',function () { portrait.remove(); },{once:true}); qr.prepend(portrait);
      }
      var save=document.createElement('button'); save.type='button'; save.className='classic-save'; save.textContent='Save contact';
      var status=document.createElement('p'); status.className='classic-save-status'; status.setAttribute('role','status');
      save.addEventListener('click',function () {
        var trigger=document.querySelector('.vcard-save-trigger');
        if(!isDemo && trigger) trigger.click(); else status.textContent='Contact saving becomes available when this VCard is published.';
      });
      qr.append(save,status);
      if(isDemo) footer.textContent='Template preview · Sample details and prices · Sync E-Card';
    }
  };
}());
