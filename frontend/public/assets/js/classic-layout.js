(function () {
  'use strict';
  window.SyncClassicLayout = function (root) {
      if(!root.classList.contains("classic-layout"))return;
      // Keep the identity in normal flow regardless of which optional fields exist.
      var identity=root.querySelector(".final-identity"),description=root.querySelector(".final-description"),socials=root.querySelector(".final-socials");
      if(description)identity.appendChild(description);
      var bioToggle=root.querySelector(".property-bio-toggle");if(bioToggle)identity.appendChild(bioToggle);
      if(socials)identity.appendChild(socials);
      var contactSection=root.querySelector('[data-classic-section="contact"]');
      if(contactSection)identity.after(contactSection);
      root.querySelectorAll(".final-form input,.final-form select,.final-form textarea").forEach(function(input,index){
        if(input.closest("label"))return;
        var label=document.createElement("label"),caption=document.createElement("span");
        caption.textContent=({date:"Date",time:"Time",serviceName:"Service",meetingMode:"Meeting type"}[input.name])||input.placeholder||input.name;
        input.id="classic-field-"+index;label.htmlFor=input.id;
        input.before(label);label.append(caption,input);
      });
  };
}());
