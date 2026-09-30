(function () {
  'use strict';
  function photo(id) { return '../../public/assets/images/creative-classic/' + id + '.jpg'; }
  window.SyncVCardTemplateConfig = {
    theme: 'creative-classic',
    demo: {
      title: 'Sarah Miller', companyName: 'Creative Studio',
      description: 'Graphic design, video editing and visual storytelling for brands with something to say.',
      email: 'sarah@example.com', phone: '+94 76 456 8988', websiteUrl: 'https://example.com', address: '153 York Street, Colombo',
      avatarUrl: photo('photo-1494790108377-be9c29b29330'), coverImageUrl: photo('photo-1545235617-9465d2a55698'),
      socialLinks: [{label:'Instagram',url:'https://instagram.com'}, {label:'LinkedIn',url:'https://linkedin.com'}, {label:'Behance',url:'https://behance.net'}, {label:'Dribbble',url:'https://dribbble.com'}],
      sections: {
        'basic-details': 'Graphic Designer & Video Editor',
        services: 'Brand Design | Distinctive visual identities | '+photo('photo-1561070791-2526d30994b5')+'\nVideo Editing | Motion and storytelling for every platform | '+photo('photo-1574717024653-61fd2cf4d44d'),
        products: 'Social Media Kit | Visual assets for your channels | '+photo('photo-1611162617474-5b21e879e113')+'\nPortfolio Package | A polished digital presentation | '+photo('photo-1561154464-82e9adf32764')+'\nCreative Tools | Practical templates and guidance | '+photo('photo-1550745165-9bc0b252726f'),
        appointments: 'Project consultation | 30\nVideo review | 45',
        galleries: 'Event visuals | '+photo('photo-1531058020387-3be344556be6')+'\nArt direction | '+photo('photo-1513364776144-60967b0f800f')+'\nColor studies | '+photo('photo-1541701494587-cb58502866ab'),
        testimonials: 'Creative, thoughtful and easy to work with. Our brand looks fantastic. | Sample Client | Business owner | '+photo('photo-1500648767791-00dcc994a43e')+'\nGreat attention to detail and excellent communication. | Sample Client Two | Project lead | '+photo('photo-1507003211169-0a1dd7228f2d'),
        'business-hours': 'Monday | 10:30 AM - 7:00 PM\nTuesday | 10:30 AM - 7:00 PM\nWednesday | 10:30 AM - 2:30 PM\nThursday | 10:30 AM - 7:00 PM\nFriday | 10:30 AM - 2:30 PM\nSaturday | Closed\nSunday | Closed'
      }
    },
    decorate: function (root,card,isDemo) {
      var footer=root.querySelector('.final-footer');
      var sections=Array.from(root.querySelectorAll(':scope > .final-section'));
      ['Contact','Our Services','Products','Make an Appointment','Gallery','Testimonials','Business Hours','QR Code','Enquiries'].forEach(function (title) {
        var section=sections.find(function (node) { return node.querySelector('h2').textContent===title; });
        if(section) { section.dataset.classicSection=title.toLowerCase().replace(/ /g,'-'); root.insertBefore(section,footer); }
      });
      var address=root.querySelector('div.final-contact-item');
      if(address && card.address) {
        var link=document.createElement('a'); link.className=address.className;
        link.href='https://maps.google.com/?q='+encodeURIComponent(card.address); link.target='_blank'; link.rel='noopener noreferrer';
        link.append.apply(link,Array.from(address.childNodes)); address.replaceWith(link);
      }
      var testimonials=root.querySelector('.final-testimonials');
      if(testimonials) testimonials.setAttribute('aria-label','Client testimonials');
      var gallery=root.querySelector('.final-gallery');
      if(gallery) {
        var viewer=document.createElement('dialog'); viewer.className='creative-viewer'; viewer.setAttribute('aria-label','Gallery image');
        var close=document.createElement('button'); close.type='button'; close.className='creative-viewer-close'; close.textContent='Close image';
        var image=document.createElement('img'); image.alt='Enlarged gallery image';
        viewer.append(close,image); root.appendChild(viewer);
        close.addEventListener('click',function () { viewer.close(); });
        viewer.addEventListener('click',function (event) { if(event.target===viewer) viewer.close(); });
        gallery.querySelectorAll('img').forEach(function (thumb,index) {
          var button=document.createElement('button'); button.type='button'; button.className='creative-gallery-button';
          button.setAttribute('aria-label','Open gallery image '+(index+1));
          thumb.replaceWith(button); button.appendChild(thumb);
          button.addEventListener('click',function () { image.src=thumb.src; viewer.showModal(); close.focus(); });
        });
      }
      root.querySelectorAll('input,textarea,select').forEach(function (input,i) {
        var label=document.createElement('label'); label.className='creative-field';
        var text=document.createElement('span');
        text.textContent=({date:'Date',time:'Time',serviceName:'Service',meetingMode:'Meeting type'}[input.name])||input.placeholder||input.name;
        input.id='creative-field-'+i; label.htmlFor=input.id; input.before(label); label.append(text,input);
      });
      var qr=root.querySelector('.final-qr-panel'),avatar=root.querySelector('.final-avatar img');
      if(avatar) {
        var portrait=avatar.cloneNode(); portrait.className='creative-qr-avatar'; portrait.alt='Profile photo';
        portrait.addEventListener('error',function () { portrait.remove(); },{once:true}); qr.prepend(portrait);
      }
      var save=document.createElement('button'); save.type='button'; save.className='classic-save'; save.textContent='Save contact';
      var status=document.createElement('p'); status.className='classic-save-status'; status.setAttribute('role','status');
      save.addEventListener('click',function () {
        var trigger=document.querySelector('.vcard-save-trigger');
        if(!isDemo && trigger) trigger.click(); else status.textContent='Contact saving becomes available when this VCard is published.';
      });
      qr.append(save,status);
      var enquiry=root.querySelector('[data-classic-section="enquiries"]');
      var intro=document.createElement('p'); intro.className='creative-enquiry-intro';
      intro.textContent='Have a project in mind? Send a message and we will get back to you.';
      enquiry.querySelector('h2').after(intro);
      if(isDemo) footer.textContent='Template preview · Sample projects and reviews · Sync E-Card';
    }
  };
}());
