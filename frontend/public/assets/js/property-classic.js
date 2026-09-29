(function () {
  'use strict';
  function photo(id) { return '../../public/assets/images/property-classic/' + id + '.jpg'; }
  window.SyncVCardTemplateConfig = {
    theme: 'property-classic',
    demo: {
      title: 'Alexandra Rose', companyName: 'Rose Property',
      description: 'Helping you find the right property with thoughtful advice and practical local knowledge. From first viewing through completion, I make each step clear and personal.',
      email: 'alexandra@example.com', phone: '+94 76 456 8988', websiteUrl: 'https://example.com', address: '153 York Street, Colombo',
      avatarUrl: photo('photo-1494790108377-be9c29b29330'), coverImageUrl: photo('photo-1600607687920-4e2a09cf159d'),
      socialLinks: [{label:'Facebook',url:'https://facebook.com'}, {label:'X',url:'https://x.com'}, {label:'Instagram',url:'https://instagram.com'}, {label:'TikTok',url:'https://tiktok.com'}, {label:'LinkedIn',url:'https://linkedin.com'}],
      sections: {
        'basic-details': 'Real Estate Agent',
        testimonials: 'Professional and responsive throughout our property search. | Nadeesha P. | Sample buyer | ' + photo('photo-1494790108377-be9c29b29330') + '\nExcellent advice and a smooth property transaction. | Mitchell S. | Sample seller | ' + photo('photo-1560250097-0b93528c311a') + '\nReliable support from viewing to completion. | John D. | Sample client | ' + photo('photo-1507003211169-0a1dd7228f2d'),
        products: 'Perry Street Residence | $850,000 | Example listing · San Francisco, CA | ' + photo('photo-1568605114967-8130f3a36994') + '\nUnion Boulevard Home | $580,000 | Example listing · San Francisco, CA | ' + photo('photo-1570129477492-45c003edd2be'),
        'business-hours': 'Monday | 09:00 - 17:00\nTuesday | 09:00 - 17:00\nWednesday | 09:00 - 17:00\nThursday | 09:00 - 17:00\nFriday | 09:00 - 17:00\nSaturday | 09:00 - 13:00\nSunday | Unavailable',
        galleries: 'City view | ' + photo('photo-1477959858617-67f85cf4f1df') + '\nNeighbourhood | ' + photo('photo-1449824913935-59a10b8d2000') + '\nLandscape | ' + photo('photo-1500530855697-b586d89ba3ee'),
        appointments: 'Property consultation | 30\nViewing request | 60',
        services: 'Buy & Sell | Guidance for buyers and sellers | ' + photo('photo-1556761175-b413da4baf72') + '\nConsultation | Clear advice for your next move | ' + photo('photo-1521737711867-e3b97375f902') + '\nSite Visits | See properties with a local specialist | ' + photo('photo-1551836022-d5d88e9218df')
      }
    },
    decorate: function (root,card,isDemo) {
      var footer = root.querySelector('.final-footer');
      var sections = Array.from(root.querySelectorAll(':scope > .final-section'));
      ['Contact','Testimonials','Products','Business Hours','Gallery','Make an Appointment','Our Services','QR Code','Enquiries'].forEach(function (title) {
        var section = sections.find(function (node) { return node.querySelector('h2').textContent === title; });
        if(section) {
          section.dataset.classicSection = title.toLowerCase().replace(/ /g,'-'); root.insertBefore(section,footer);
          if(title==='Products') section.querySelector('h2').textContent='Properties';
          if(title==='Enquiries') section.querySelector('h2').textContent='Get in Touch';
        }
      });
      var address = root.querySelector('div.final-contact-item');
      if(address && card.address) {
        var link=document.createElement('a'); link.className=address.className;
        link.href='https://maps.google.com/?q='+encodeURIComponent(card.address); link.target='_blank'; link.rel='noopener noreferrer';
        link.append.apply(link,Array.from(address.childNodes)); address.replaceWith(link);
      }
      var description = root.querySelector('.final-description');
      if(description && description.textContent.trim().length>115) {
        var full=description.textContent.trim(), compact=full.slice(0,112).replace(/\s+\S*$/,'')+'…';
        var toggle=document.createElement('button'); toggle.type='button'; toggle.className='property-bio-toggle';
        toggle.setAttribute('aria-expanded','false'); toggle.textContent='Read more';
        toggle.addEventListener('click',function () {
          var expanded=toggle.getAttribute('aria-expanded')==='true';
          toggle.setAttribute('aria-expanded',String(!expanded)); toggle.textContent=expanded?'Read more':'Show less';
          description.textContent=expanded?compact:full;
        });
        description.textContent=compact; description.after(toggle);
      }
      var socials=root.querySelector('.final-socials');
      if(socials) root.querySelector('[data-classic-section="contact"]').appendChild(socials);
      var hours=root.querySelector('[data-classic-section="business-hours"]');
      var gallery=root.querySelector('[data-classic-section="gallery"]');
      if(hours && gallery) {
        var pair=document.createElement('div'); pair.className='property-hours-gallery';
        hours.before(pair); pair.append(hours,gallery);
      }
      root.querySelectorAll('input,textarea,select').forEach(function (input,i) {
        var label=document.createElement('label'); label.className='property-field';
        var text=document.createElement('span');
        text.textContent=({date:'Date',time:'Time',serviceName:'Service',meetingMode:'Meeting type'}[input.name])||input.placeholder||input.name;
        input.id='property-field-'+i; label.htmlFor=input.id; input.before(label); label.append(text,input);
      });
      var qr=root.querySelector('.final-qr-panel'),avatar=root.querySelector('.final-avatar img');
      if(avatar) {
        var portrait=avatar.cloneNode(); portrait.className='property-qr-avatar'; portrait.alt='Profile photo';
        portrait.addEventListener('error',function () { portrait.remove(); },{once:true}); qr.prepend(portrait);
      }
      var save=document.createElement('button'); save.type='button'; save.className='classic-save'; save.textContent='Save contact';
      var status=document.createElement('p'); status.className='classic-save-status'; status.setAttribute('role','status');
      save.addEventListener('click',function () {
        var trigger=document.querySelector('.vcard-save-trigger');
        if(!isDemo && trigger) trigger.click(); else status.textContent='Contact saving becomes available when this VCard is published.';
      });
      qr.append(save,status);
      if(isDemo) footer.textContent='Template preview · Sample properties and reviews · Sync E-Card';
    }
  };
}());
