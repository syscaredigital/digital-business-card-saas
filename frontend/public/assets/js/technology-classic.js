(function () {
  'use strict';
  function photo(id) { return '../../public/assets/images/technology-classic/' + id + '.jpg'; }
  window.SyncVCardTemplateConfig = {
    theme: 'technology-classic',
    demo: {
      title: 'Fedric De Silva', companyName: 'Technology Studio',
      description: 'Web development, secure systems and practical digital products for growing organizations.',
      email: 'fedric@example.com', phone: '+94 76 456 8988', websiteUrl: 'https://example.com', address: '153 York Street, Colombo',
      avatarUrl: photo('photo-1560250097-0b93528c311a'),
      socialLinks: [{label:'LinkedIn',url:'https://linkedin.com'}, {label:'GitHub',url:'https://github.com'}, {label:'YouTube',url:'https://youtube.com'}],
      sections: {
        'basic-details': 'Web Developer',
        services: 'Web Design | Clear, responsive interfaces | '+photo('photo-1522071820081-009f0129c71c')+'\nWeb Maintenance | Reliable updates and support\nWeb Development | Custom websites and applications\nSecurity Assessment | Practical reviews to reduce risk',
        products: 'Mobile Application Design | Usable apps for modern teams | '+photo('photo-1551650975-87deedd944c3')+'\nWeb Development & Design | Digital experiences built with care | '+photo('photo-1460925895917-afdab827c52f')+'\nBrand Identity | A consistent visual system | '+photo('photo-1542744094-3a31f272c490'),
        galleries: 'Teamwork | '+photo('photo-1516321318423-f06f85e504b3')+'\nPlanning | '+photo('photo-1521737711867-e3b97375f902')+'\nWorkshop | '+photo('photo-1552664730-d307ca884978'),
        testimonials: 'The team translated our needs into a reliable, easy-to-use product. | Sample Client | Business owner | '+photo('photo-1494790108377-be9c29b29330')+'\nResponsive, collaborative and technically strong throughout the project. | Sample Client Two | Project lead | '+photo('photo-1500648767791-00dcc994a43e'),
        'business-hours': 'Monday - Friday | 10:30 AM - 7:00 PM',
        appointments: 'Project consultation | 30\nTechnical review | 60'
      }
    },
    decorate: function (root,card,isDemo) {
      var footer=root.querySelector('.final-footer');
      var sections=Array.from(root.querySelectorAll(':scope > .final-section'));
      ['Our Services','Contact','Make an Appointment','Products','Gallery','Testimonials','Business Hours','QR Code','Enquiries'].forEach(function (title) {
        var section=sections.find(function (node) { return node.querySelector('h2').textContent===title; });
        if(section) { section.dataset.classicSection=title.toLowerCase().replace(/ /g,'-'); root.insertBefore(section,footer); }
      });
      var cover=root.querySelector('.final-cover');
      cover.classList.add('technology-grid');
      var badge=document.createElement('span'); badge.className='technology-spark'; badge.textContent='✳'; badge.setAttribute('aria-hidden','true'); cover.appendChild(badge);
      var role=root.querySelector('.final-role');
      var summary=root.querySelector('.final-description');
      if(summary && role) role.after(summary);
      var skills=(card.sections&&card.sections.services||'').split(/\r?\n/).map(function (line) { return line.split('|')[0].trim(); }).filter(Boolean).slice(0,3);
      if(skills.length) {
        var list=document.createElement('div'); list.className='technology-skills'; list.setAttribute('aria-label','Services');
        skills.forEach(function (skill) { var span=document.createElement('span'); span.textContent=skill; list.appendChild(span); });
        cover.appendChild(list);
      }
      var address=root.querySelector('div.final-contact-item');
      root.querySelectorAll('[data-classic-section="our-services"] .final-item-media').forEach(function (media) {
        if(!media.querySelector('img')) media.innerHTML='<svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m8 7-5 5 5 5m8-10 5 5-5 5M14 4l-4 16"/></svg>';
      });
      if(address && card.address) {
        var link=document.createElement('a'); link.className=address.className;
        link.href='https://maps.google.com/?q='+encodeURIComponent(card.address); link.target='_blank'; link.rel='noopener noreferrer';
        link.append.apply(link,Array.from(address.childNodes)); address.replaceWith(link);
      }
      var gallery=root.querySelector('.final-gallery');
      if(gallery) {
        var viewer=document.createElement('dialog'); viewer.className='technology-viewer'; viewer.setAttribute('aria-label','Gallery image');
        var close=document.createElement('button'); close.type='button'; close.textContent='Close image';
        var image=document.createElement('img'); image.alt='Enlarged gallery image'; viewer.append(close,image); root.appendChild(viewer);
        close.addEventListener('click',function () { viewer.close(); });
        viewer.addEventListener('click',function (event) { if(event.target===viewer) viewer.close(); });
        gallery.querySelectorAll('img').forEach(function (thumb,index) {
          var button=document.createElement('button'); button.type='button'; button.className='technology-gallery-button';
          button.setAttribute('aria-label','Open gallery image '+(index+1)); thumb.replaceWith(button); button.appendChild(thumb);
          button.addEventListener('click',function () { image.src=thumb.src; viewer.showModal(); close.focus(); });
        });
      }
      root.querySelectorAll('input,textarea,select').forEach(function (input,i) {
        var label=document.createElement('label'); label.className='technology-field';
        var text=document.createElement('span');
        text.textContent=({date:'Date',time:'Time',serviceName:'Service',meetingMode:'Meeting type'}[input.name])||input.placeholder||input.name;
        input.id='technology-field-'+i; label.htmlFor=input.id; input.before(label); label.append(text,input);
      });
      var qr=root.querySelector('.final-qr-panel'),avatar=root.querySelector('.final-avatar img');
      if(avatar) {
        var portrait=avatar.cloneNode(); portrait.className='technology-qr-avatar'; portrait.alt='Profile photo';
        portrait.addEventListener('error',function () { portrait.remove(); },{once:true}); qr.prepend(portrait);
      }
      var save=document.createElement('button'); save.type='button'; save.className='classic-save'; save.textContent='Save contact';
      var status=document.createElement('p'); status.className='classic-save-status'; status.setAttribute('role','status');
      save.addEventListener('click',function () {
        var trigger=document.querySelector('.vcard-save-trigger');
        if(!isDemo && trigger) trigger.click(); else status.textContent='Contact saving becomes available when this VCard is published.';
      }); qr.append(save,status);
      var enquiries=root.querySelector('[data-classic-section="enquiries"]');
      var intro=document.createElement('p'); intro.className='technology-enquiry-intro';
      intro.textContent='Have a project in mind? Send an enquiry and we will get back to you.';
      enquiries.querySelector('h2').after(intro);
      if(isDemo) footer.textContent='Template preview · Sample projects and reviews · Sync E-Card';
    }
  };
}());
