(function () {
  'use strict';
  window.SyncVCardTemplateConfig = {
    theme: 'trainer-classic',
    demo: {
      "title": "Sam Jonathan",
      "companyName": "Professional Learning",
      "description": "Empowering professionals through practical skills and impactful learning.",
      "email": "sam@example.com",
      "phone": "+1 407 845 874",
      "websiteUrl": "https://example.com",
      "address": "New York, USA",
      "avatarUrl": "../../public/assets/images/trainer-classic/photo-1500648767791-00dcc994a43e.jpg",
      "coverImageUrl": "../../public/assets/images/trainer-classic/photo-1556761175-b413da4baf72.jpg",
      "socialLinks": [
        {
          "label": "Facebook",
          "url": "https://facebook.com"
        },
        {
          "label": "Instagram",
          "url": "https://instagram.com"
        },
        {
          "label": "LinkedIn",
          "url": "https://linkedin.com"
        },
        {
          "label": "X",
          "url": "https://x.com"
        }
      ],
      "sections": {
        "basic-details": "Corporate Trainer",
        "services": "Leadership Training\nSkill Development\nSoft Skills Training\nTeam Building\nCareer Coaching\nProductivity Training\nSales Training\nWorkshops\nDigital Skills\nCommunication Skills",
        "galleries": "Training session 1 | ../../public/assets/images/trainer-classic/photo-1517048676732-d65bc937f952.jpg\nTraining session 2 | ../../public/assets/images/trainer-classic/photo-1544531586-fde5298cdd40.jpg\nTraining session 3 | ../../public/assets/images/trainer-classic/photo-1524178232363-1fb2b075b655.jpg\nTraining session 4 | ../../public/assets/images/trainer-classic/photo-1551836022-d5d88e9218df.jpg",
        "appointments": "Training consultation | 30\nCareer coaching | 60",
        "testimonials": "Practical training with exceptional professionalism, making complex concepts easy to understand and apply in the workplace. | John Doe | Sample client | ../../public/assets/images/trainer-classic/photo-1507003211169-0a1dd7228f2d.jpg",
        "business-hours": "Monday | 10:00 AM - 7:00 PM\nTuesday | 10:00 AM - 7:00 PM\nWednesday | 10:00 AM - 7:00 PM\nThursday | 10:00 AM - 7:00 PM\nFriday | 10:00 AM - 7:00 PM\nSaturday | 10:00 AM - 8:00 PM\nSunday | 10:00 AM - 2:00 PM",
        "products": "Training Handbook | A practical reference collection | ../../public/assets/images/trainer-classic/photo-1544716278-ca5e3f4abd8c.jpg\nTraining Notebook | Plan and reflect on your learning | ../../public/assets/images/trainer-classic/photo-1456324504439-367cee3b3c32.jpg\nAchievement Award | Celebrate professional progress | ../../public/assets/images/trainer-classic/photo-1567427017947-545c5f8d16ad.jpg"
      }
    },
    decorate: function (root,card,isDemo) {
      var footer = root.querySelector('.final-footer');
      var sections = Array.from(root.querySelectorAll(':scope > .final-section'));
      ['Our Services','Contact','Gallery','Make an Appointment','Testimonials','QR Code','Business Hours','Products','Enquiries'].forEach(function (title) {
        var section = sections.find(function (node) { return node.querySelector('h2').textContent === title; });
        if(section) {
          section.dataset.classicSection = title.toLowerCase().replace(/ /g,'-'); root.insertBefore(section,footer);
          if(title==='Testimonials') section.querySelector('h2').textContent='What Clients Say';
          if(title==='QR Code') section.querySelector('h2').textContent='Download QR Code';
        }
      });
      root.querySelectorAll('.final-section-title').forEach(function (heading) {
        var label=document.createElement('span'); label.className='trainer-heading-label';
        label.textContent=heading.textContent; heading.replaceChildren(label);
      });
      var services=root.querySelector('[data-classic-section="our-services"]');
      var contact=root.querySelector('[data-classic-section="contact"]');
      if(services && contact) {
        var top=document.createElement('div'); top.className='trainer-top';
        services.before(top); top.append(services,contact);
      }
      root.querySelectorAll('[data-classic-section="our-services"] .final-item-copy p').forEach(function (p) {
        if(p.textContent==='Professional service tailored to your needs.') p.remove();
      });
      var address = root.querySelector('div.final-contact-item');
      if(address && card.address) {
        var link=document.createElement('a'); link.className=address.className;
        link.href='https://maps.google.com/?q='+encodeURIComponent(card.address); link.target='_blank'; link.rel='noopener noreferrer';
        link.append.apply(link,Array.from(address.childNodes)); address.replaceWith(link);
      }
      // Each dot is a real, keyboard-accessible page control, shown only when needed.
      function paginate(container,selector,pageSize,label) {
        if(!container) return;
        var items=Array.from(container.querySelectorAll(selector)), count=Math.ceil(items.length/pageSize);
        if(count<2) return;
        var controls=document.createElement('nav'); controls.className='trainer-pagination'; controls.setAttribute('aria-label',label+' pages');
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
        var panel=document.createElement('div'); panel.className='trainer-hours-panel';
        var clock=document.createElement('span'); clock.className='trainer-clock'; clock.setAttribute('aria-hidden','true');
        clock.innerHTML='<svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2"><circle cx="24" cy="24" r="19"/><path d="M24 11v14l10 6"/></svg>';
        hours.before(panel); panel.append(clock,hours);
      }
      root.querySelectorAll('input,textarea,select').forEach(function (input) {
        input.setAttribute('aria-label',({date:'Appointment date',time:'Appointment time',serviceName:'Service',meetingMode:'Meeting type'}[input.name]) || input.placeholder || input.name);
      });
      var qr=root.querySelector('.final-qr-panel'), avatar=root.querySelector('.final-avatar img');
      if(avatar) {
        var portrait=avatar.cloneNode(); portrait.className='trainer-qr-avatar'; portrait.alt='Profile photo';
        portrait.addEventListener('error',function () { portrait.remove(); },{once:true}); qr.prepend(portrait);
      }
      var save=document.createElement('button'); save.type='button'; save.className='classic-save'; save.textContent='Save contact';
      var status=document.createElement('p'); status.className='classic-save-status'; status.setAttribute('role','status');
      save.addEventListener('click',function () {
        var trigger=document.querySelector('.vcard-save-trigger');
        if(!isDemo && trigger) trigger.click(); else status.textContent='Contact saving becomes available when this VCard is published.';
      });
      qr.append(save,status);
      if(isDemo) footer.textContent='Template preview · Sample details · Sync E-Card';
    }
  };
}());
