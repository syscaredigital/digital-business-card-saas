(function () {
  'use strict';
  function photo(id) { return '../../public/assets/images/boutique-classic/' + id + '.jpg'; }
  window.SyncVCardTemplateConfig = {
    theme: 'boutique-classic',
    demo: {
      title: 'Sophia Alexander', companyName: 'Style Boutique',
      description: 'Find your style. Love your look. Thoughtfully selected fashion and personal styling for every occasion.',
      email: 'hello@example.com', phone: '+94 77 123 4567', websiteUrl: 'https://example.com', address: '123 Manning Street, Colombo 07',
      avatarUrl: photo('photo-1494790108377-be9c29b29330'), coverImageUrl: photo('photo-1441986300917-64674bd600d8'),
      socialLinks: [{label:'WhatsApp',url:'https://wa.me/94771234567'}, {label:'Instagram',url:'https://instagram.com'}, {label:'Facebook',url:'https://facebook.com'}, {label:'TikTok',url:'https://tiktok.com'}],
      sections: {
        'basic-details': 'CEO of Style Boutique',
        'business-hours': 'Monday | 10:00 AM - 7:00 PM\nTuesday | 10:00 AM - 7:00 PM\nWednesday | 10:00 AM - 7:00 PM\nThursday | 10:00 AM - 7:00 PM\nFriday | 10:00 AM - 7:00 PM\nSaturday | 10:00 AM - 8:00 PM\nSunday | 11:00 AM - 5:00 PM',
        services: 'Personal Styling\nOutfit Consultations\nCustom Alterations\nOnline Orders\nFashion Advice',
        products: 'Dresses | New arrivals | ' + photo('photo-1595777457583-95e059d581b8') + '\nBags & Accessories | Curated accessories | ' + photo('photo-1584917865442-de89df76afd3') + '\nTops & Blouses | Everyday favourites | ' + photo('photo-1523381210434-271e8be1f52b') + '\nFootwear | Complete your look | ' + photo('photo-1543163521-1bf539c55dd2'),
        galleries: ['photo-1441986300917-64674bd600d8','photo-1555529669-e69e7aa0ba9a','photo-1483985988355-763728e1935b','photo-1525507119028-ed4c629a60a3'].map(function (id,i) { return 'Boutique collection '+(i+1)+' | '+photo(id); }).join('\n'),
        testimonials: 'Beautiful collection and amazing service. My go-to boutique in Colombo. | Nadeesha P. | Sample customer | '+photo('photo-1534528741775-53994a69daeb'),
        appointments: 'Styling consultation | 30\nAlteration fitting | 30'
      }
    },
    decorate: function (root,card,isDemo) {
      var footer=root.querySelector('.final-footer');
      var sections=Array.from(root.querySelectorAll(':scope > .final-section'));
      ['Contact','Business Hours','Our Services','Products','Gallery','Testimonials','Make an Appointment','QR Code','Enquiries'].forEach(function (title) {
        var section=sections.find(function (node) { return node.querySelector('h2').textContent===title; });
        if(section) { section.dataset.classicSection=title.toLowerCase().replace(/ /g,'-'); root.insertBefore(section,footer); }
      });
      var cover=root.querySelector('.final-cover');
      var brand=document.createElement('div'); brand.className='boutique-brand';
      var brandTitle=document.createElement('strong'); brandTitle.textContent=card.companyName||(isDemo?'Style Boutique':'');
      var brandLine=document.createElement('span'); brandLine.textContent=isDemo?'Find your style, love your look.':'';
      brand.append(brandTitle,brandLine);
      if(brandTitle.textContent) cover.appendChild(brand);
      var address=root.querySelector('div.final-contact-item');
      if(address && card.address) {
        var link=document.createElement('a'); link.className=address.className;
        link.href='https://maps.google.com/?q='+encodeURIComponent(card.address); link.target='_blank'; link.rel='noopener noreferrer';
        link.append.apply(link,Array.from(address.childNodes)); address.replaceWith(link);
      }
      var hours=root.querySelector('[data-classic-section="business-hours"]');
      var services=root.querySelector('[data-classic-section="our-services"]');
      if(hours && services) { var info=document.createElement('div'); info.className='boutique-info'; hours.before(info); info.append(hours,services); }
      root.querySelectorAll('[data-classic-section="our-services"] .final-item-copy p').forEach(function (paragraph) {
        if(paragraph.textContent==='Professional service tailored to your needs.') paragraph.remove();
      });
      var products=root.querySelector('[data-classic-section="products"]');
      var gallery=root.querySelector('[data-classic-section="gallery"]');
      if(products && gallery) { var media=document.createElement('div'); media.className='boutique-media'; products.before(media); media.append(products,gallery); }
      var socials=root.querySelector('.final-socials');
      if(socials) root.querySelector('[data-classic-section="enquiries"]').after(socials);
      root.querySelectorAll('input,textarea,select').forEach(function (input) {
        input.setAttribute('aria-label',({date:'Appointment date',time:'Appointment time',serviceName:'Service',meetingMode:'Meeting type'}[input.name])||input.placeholder||input.name);
      });
      var qr=root.querySelector('.final-qr-panel'),avatar=root.querySelector('.final-avatar img');
      if(avatar) {
        var portrait=avatar.cloneNode(); portrait.className='boutique-qr-avatar'; portrait.alt='Profile photo';
        portrait.addEventListener('error',function () { portrait.remove(); },{once:true}); qr.prepend(portrait);
      }
      var save=document.createElement('button'); save.type='button'; save.className='classic-save'; save.textContent='Save contact';
      var status=document.createElement('p'); status.className='classic-save-status'; status.setAttribute('role','status');
      save.addEventListener('click',function () {
        var trigger=document.querySelector('.vcard-save-trigger');
        if(!isDemo && trigger) trigger.click(); else status.textContent='Contact saving becomes available when this VCard is published.';
      });
      qr.append(save,status);
      if(isDemo) footer.textContent='Template preview · Sample collections and reviews · Sync E-Card';
    }
  };
}());
