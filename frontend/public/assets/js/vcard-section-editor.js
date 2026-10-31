(function () {
  'use strict';
  var definitions = {
    services: { item: 'service', fields: [['name','Service name'],['description','Description']], image: true },
    products: { item: 'product', fields: [['name','Product name'],['price','Price'],['description','Description']], image: true },
    galleries: { item: 'photo', fields: [['name','Caption']], image: true },
    'instagram-embed': { item: 'photo', fields: [['name','Caption']], image: true },
    testimonials: { item: 'review', fields: [['quote','Review'],['name','Customer name'],['role','Customer role']], image: true },
    blogs: { item: 'article', fields: [['name','Article title'],['description','Summary'],['url','Article link','url']] },
    appointments: { item: 'booking service', fields: [['name','Service name'],['duration','Duration in minutes','duration']] },
    'social-links': { item: 'social link', fields: [['name','Network'],['url','Profile link','url']] },
    'custom-links': { item: 'link', fields: [['name','Link label'],['url','Website address','url']] },
    iframes: { item: 'featured link', fields: [['name','Title'],['url','Content link','url']] },
    banners: { item: 'banner', fields: [['name','Banner title']], image: true },
    advanced: { item: 'detail', fields: [['name','Detail']] },
    'manage-section': { item: 'detail', fields: [['name','Additional information']] }
  };
  var days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  var fonts = ['Arial','Georgia','Verdana','Times New Roman','DM Sans','Oswald','Playfair Display'];
  var descriptions = {
    services:'Introduce your services. Add a name, description and optional photo for each one.',
    products:'Add products or listings with a price, description and optional photo.',
    appointments:'Create the services visitors can book. You approve requests from your Appointments page.',
    'business-hours':'Set your opening times for each day. Turn off days when you are closed.',
    seo:'Choose how this card appears in the browser and search results.',
    'custom-fonts':'Choose a font for your public card.',
    'qrcode-customize':'Choose the appearance of your QR code. It always opens your VCard.',
    'privacy-policy':'Explain how you handle information submitted through your card.',
    'term-condition':'Add the terms that apply to your own services.'
  };
  function node(tag, className, text) {
    var element=document.createElement(tag);
    if(className)element.className=className;
    if(text!=null)element.textContent=text;
    return element;
  }
  function button(label, action) { var b=node('button','section-editor-button',label);b.type='button';b.addEventListener('click',action);return b; }
  function isImage(value) { return /^data:image\/(png|jpe?g|webp);base64,/i.test(value) || /^https?:\/\//i.test(value); }
  function clean(value) { return String(value||'').trim().replace(/\r?\n/g,' ').replace(/\|/g,' / '); }
  function validUrl(value) { try { var url=new URL(value); return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password; } catch (_) { return false; } }
  function decodeTime(value) {
    var match=String(value).trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if(!match)return '';
    var hour=Number(match[1]);
    if(match[3])hour=(hour%12)+(match[3].toUpperCase()==='PM'?12:0);
    return hour<24 && Number(match[2]||0)<60 ? String(hour).padStart(2,'0')+':'+(match[2]||'00') : '';
  }
  function mount(root, options) {
    var features=(options.features||[]).filter(function(f){return f.key!=='basic-details';});
    var saved=options.values||{}, hidden=options.hiddenSections, states={}, tabs=[], panels=[], active=0, uploads=0;
    root.replaceChildren(); root.classList.add('section-editor');
    var heading=node('div','section-editor-heading'), title=node('div');
    title.append(node('h3','', 'Build your card sections'),node('p','', 'Choose a section, fill in the form and turn it on when it is ready.'));
    heading.append(title,node('span','section-editor-plan',options.planName||'Your plan'));root.appendChild(heading);
    if(!features.length){root.append(node('p','section-editor-empty','Your plan includes profile and contact details. Complete those fields above to create your card.'));}
    var layout=node('div','section-editor-layout'), navigation=node('div','section-editor-tabs'), content=node('div','section-editor-panels');
    navigation.setAttribute('role','tablist');navigation.setAttribute('aria-label','Card sections');navigation.setAttribute('aria-orientation','vertical');
    layout.append(navigation,content);if(features.length)root.appendChild(layout);
    function select(index, focus) {
      active=index;
      tabs.forEach(function(tab,i){tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;panels[i].hidden=i!==index;});
      if(focus && tabs[index])tabs[index].focus();
    }
    function field(label, value, kind, onChange) {
      var wrap=node('label','section-editor-field');wrap.append(node('span','',label));
      var input=kind==='long'?node('textarea'):node('input');
      if(input.tagName==='INPUT')input.type=kind==='time'?'time':'text';
      if(kind==='url') {input.inputMode='url';input.placeholder='https://example.com';}
      if(kind==='duration'){input.inputMode='numeric';input.placeholder='30';}
      if(kind==='long')input.rows=6;
      input.value=value||'';input.maxLength=kind==='long'?10000:2000;
      input.addEventListener('input',function(){onChange(input.value);});wrap.appendChild(input);return wrap;
    }
    features.forEach(function(feature,index){
      var value=String(saved[feature.key]||''), definition=definitions[feature.key];
      var state=states[feature.key]={enabled:Array.isArray(hidden)?!hidden.includes(feature.key):Boolean(value.trim()),rows:[],value:value,inputs:[]};
      var tab=node('button','section-editor-tab'), tabName=node('span','',feature.label), status=node('small');tab.type='button';
      tab.id=root.id+'-tab-'+feature.key;tab.setAttribute('role','tab');tab.setAttribute('aria-controls',root.id+'-panel-'+feature.key);tab.append(tabName,status);tabs.push(tab);navigation.appendChild(tab);
      var panel=node('section','section-editor-panel');panel.id=root.id+'-panel-'+feature.key;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tab.id);panels.push(panel);content.appendChild(panel);
      var panelHeader=node('div','section-editor-panel-heading'), copy=node('div');copy.append(node('h4','',feature.label),node('p','',descriptions[feature.key]||'Add the information you want visitors to see on your card.'));
      var switchLabel=node('label','section-editor-switch'), toggle=node('input');toggle.type='checkbox';toggle.checked=state.enabled;toggle.setAttribute('role','switch');toggle.setAttribute('aria-label','Show '+feature.label+' on card');switchLabel.append(toggle,node('span','','Show on card'));panelHeader.append(copy,switchLabel);panel.appendChild(panelHeader);
      var offNote=node('p','section-editor-off','This section is off. Turn it on to add content. Your saved content is kept when you turn a section off.');panel.appendChild(offNote);
      var form=node('div','section-editor-fields');panel.appendChild(form);
      function visibility(){form.hidden=!state.enabled;offNote.hidden=state.enabled;status.textContent=state.enabled?'On':'Off';tab.dataset.enabled=String(state.enabled);}
      toggle.addEventListener('change',function(){state.enabled=toggle.checked;visibility();});
      tab.addEventListener('click',function(){select(index);});
      tab.addEventListener('keydown',function(event){var next=index;if(['ArrowDown','ArrowRight'].includes(event.key))next=(index+1)%features.length;else if(['ArrowUp','ArrowLeft'].includes(event.key))next=(index-1+features.length)%features.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=features.length-1;else return;event.preventDefault();select(next,true);});

      if(definition){
        value.split(/\r?\n/).filter(function(line){return line.trim();}).forEach(function(line){
          var parts=line.split(/\s*\|\s*/), row={values:{},image:''};
          // Only image-enabled sections consume a trailing image; article URLs stay links.
          if(definition.image && isImage(parts.at(-1)||''))row.image=parts.pop();
          definition.fields.forEach(function(f,i){row.values[f[0]]=parts[i]||'';});
          if(parts.length>definition.fields.length)row.values[definition.fields.at(-1)[0]]=parts.slice(definition.fields.length-1).join(' | ');
          state.rows.push(row);
        });
        if(!state.rows.length)state.rows.push({values:{},image:''});
        var rowList=node('div','section-editor-items');form.appendChild(rowList);
        function renderRows(){
          rowList.replaceChildren();state.inputs=[];
          state.rows.forEach(function(row,rowIndex){
            var article=node('div','section-editor-item'), itemHeading=node('div','section-editor-item-heading');article.dataset.sectionRow=feature.key;
            itemHeading.append(node('strong','',feature.label+' '+(rowIndex+1)));
            var actions=node('div','section-editor-item-actions');
            var up=button('↑',function(){var previous=state.rows[rowIndex-1];state.rows[rowIndex-1]=row;state.rows[rowIndex]=previous;renderRows();});up.disabled=rowIndex===0;up.setAttribute('aria-label','Move '+definition.item+' up');
            var down=button('↓',function(){var next=state.rows[rowIndex+1];state.rows[rowIndex+1]=row;state.rows[rowIndex]=next;renderRows();});down.disabled=rowIndex===state.rows.length-1;down.setAttribute('aria-label','Move '+definition.item+' down');
            actions.append(up,down,button('Remove',function(){state.rows.splice(rowIndex,1);renderRows();}));itemHeading.appendChild(actions);article.appendChild(itemHeading);
            var grid=node('div','section-editor-field-grid');
            definition.fields.forEach(function(f){var control=field(f[1],row.values[f[0]],f[2],function(v){row.values[f[0]]=v;});grid.appendChild(control);state.inputs.push({input:control.querySelector('input,textarea'),row:row,field:f});});article.appendChild(grid);
            if(definition.image){
              var imageArea=node('div','section-editor-photo'), upload=node('label','section-editor-upload'), file=node('input');file.type='file';file.accept='image/png,image/jpeg,image/webp';file.setAttribute('aria-label','Photo for '+definition.item+' '+(rowIndex+1));
              upload.append(node('span','',row.image?'Replace photo':'Add photo'),file);imageArea.appendChild(upload);
              var preview=node('img');preview.alt='Photo for '+(row.values.name||definition.item);preview.hidden=!row.image;if(row.image)preview.src=row.image;imageArea.appendChild(preview);
              var remove=button('Remove photo',function(){row.image='';renderRows();});remove.hidden=!row.image;imageArea.appendChild(remove);
              var uploadStatus=node('small','section-editor-upload-status','PNG, JPG or WebP, up to 1 MB.');uploadStatus.setAttribute('role','status');imageArea.appendChild(uploadStatus);
              file.addEventListener('change',async function(){
                var selected=file.files[0];if(!selected)return;
                if(!/^image\/(png|jpeg|webp)$/.test(selected.type)||selected.size>1024*1024){uploadStatus.textContent='Choose a PNG, JPG or WebP image smaller than 1 MB.';file.value='';return;}
                uploads++;uploadStatus.textContent='Loading your photo…';
                var read=new FileReader();read.onload=function(){uploads--;row.image=String(read.result||'');renderRows();};read.onerror=function(){uploads--;uploadStatus.textContent='This photo could not be read. Please try again.';};read.readAsDataURL(selected);
              });article.appendChild(imageArea);
            }
            rowList.appendChild(article);
          });
        }
        renderRows();form.appendChild(button('+ Add '+definition.item,function(){if(state.rows.length>=50)return;state.rows.push({values:{},image:''});renderRows();rowList.lastElementChild.querySelector('input,textarea').focus();}));
      } else if(feature.key==='business-hours'){
        var existing={};value.split(/\r?\n/).forEach(function(line){var parts=line.split(/\s*\|\s*/);existing[parts[0].toLowerCase()]=parts.slice(1).join(' | ');});
        state.hours=days.map(function(day,i){var previous=existing[day.toLowerCase()], times=String(previous||'').split(/\s*[-–]\s*/);return {day:day,open:previous!=null?!/closed/i.test(previous):!value.trim()&&i<5,start:decodeTime(times[0])||'09:00',end:decodeTime(times[1])||'17:00',original:previous};});
        state.hours.forEach(function(day){var row=node('div','section-editor-hours'), label=node('label'), open=node('input');open.type='checkbox';open.checked=day.open;open.setAttribute('role','switch');label.append(open,node('span','',day.day));row.appendChild(label);
          var start=field('Opens',day.start,'time',function(v){day.start=v;day.original=null;}),end=field('Closes',day.end,'time',function(v){day.end=v;day.original=null;});
          function sync(){start.querySelector('input').disabled=end.querySelector('input').disabled=!day.open;}open.addEventListener('change',function(){day.open=open.checked;day.original=null;sync();});sync();row.append(start,end);form.appendChild(row);
        });
      } else if(feature.key==='qrcode-customize'){
        var qrSaved={};try{qrSaved=JSON.parse(value)||{};}catch(_){}
        state.qr={size:[256,384,512,768,1024].includes(Number(qrSaved.size))?Number(qrSaved.size):512,foreground:/^#[0-9a-f]{6}$/i.test(qrSaved.foreground||'')?qrSaved.foreground:'#111827',background:/^#[0-9a-f]{6}$/i.test(qrSaved.background||'')?qrSaved.background:'#ffffff',style:['square','rounded','dots'].includes(qrSaved.style)?qrSaved.style:'square'};
        var qrGrid=node('div','section-editor-field-grid'),preview=node('img','section-editor-qr-preview'),hint=node('p','section-editor-qr-hint');preview.alt='QR appearance preview';
        var qrTimer;
        function updateQr(){
          window.clearTimeout(qrTimer);qrTimer=window.setTimeout(function(){
            var query=new URLSearchParams(state.qr);query.set('data',window.location.origin+'/preview');
            preview.src=(window.SyncVCardApiOrigin||window.location.origin)+'/api/public/qrcode?'+query;
          },120);
          hint.textContent='Preview only. Your saved QR code opens your VCard. Use a dark code on a light background for reliable scanning.';
        }
        [['size','Image size',[[256,'256 × 256'],[384,'384 × 384'],[512,'512 × 512'],[768,'768 × 768'],[1024,'1024 × 1024']]],['style','Module style',[['square','Square'],['rounded','Rounded'],['dots','Dots']]]].forEach(function(setting){
          var wrap=node('label','section-editor-field'),select=node('select');wrap.append(node('span','',setting[1]));setting[2].forEach(function(choice){var option=node('option','',choice[1]);option.value=choice[0];select.appendChild(option);});select.value=state.qr[setting[0]];select.addEventListener('change',function(){state.qr[setting[0]]=setting[0]==='size'?Number(select.value):select.value;updateQr();});wrap.appendChild(select);qrGrid.appendChild(wrap);
        });
        [['foreground','QR color'],['background','Background color']].forEach(function(setting){var wrap=node('label','section-editor-field'),input=node('input');input.type='color';input.value=state.qr[setting[0]];input.addEventListener('input',function(){state.qr[setting[0]]=input.value;updateQr();});wrap.append(node('span','',setting[1]),input);qrGrid.appendChild(wrap);});
        form.append(qrGrid,preview,hint);updateQr();
      } else if(feature.key==='seo'){
        state.seo={};value.split(/\r?\n/).forEach(function(line){var parts=line.split(/\s*\|\s*/);state.seo[parts[0].toLowerCase()]=parts.slice(1).join(' | ');});
        [['title','Page title'],['description','Search description'],['keywords','Keywords']].forEach(function(f){form.appendChild(field(f[1],state.seo[f[0]],'text',function(v){state.seo[f[0]]=v;}));});
      } else if(feature.key==='custom-fonts'){
        var label=node('label','section-editor-field'), selectFont=node('select');label.append(node('span','','Card font'));
        var choices=fonts.includes(value)||!value?fonts:[value].concat(fonts);choices.forEach(function(font){var option=node('option','',font);option.value=font;selectFont.appendChild(option);});selectFont.value=value||'Arial';state.value=selectFont.value;selectFont.addEventListener('change',function(){state.value=selectFont.value;});label.appendChild(selectFont);form.appendChild(label);
      } else {
        var control=field(feature.label,value,'long',function(v){state.value=v;});form.appendChild(control);
      }
      visibility();
    });
    function error(index, input, message){select(index);if(input)input.focus();throw new Error(message);}
    function collect(){
      if(uploads)throw new Error('Please wait for your photos to finish loading before saving.');
      var result={};
      features.forEach(function(feature,index){var state=states[feature.key],definition=definitions[feature.key],value='';
        if(definition){
          value=state.rows.map(function(row){
            var values=definition.fields.map(function(f){return clean(row.values[f[0]]);});
            if(!values.some(Boolean)&&!row.image)return '';
            if(state.enabled){
              var first=state.inputs.find(function(item){return item.row===row&&item.field[0]===definition.fields[0][0];});
              if(!values[0])error(index,first&&first.input,'Add '+definition.fields[0][1].toLowerCase()+' in '+feature.label+'.');
              definition.fields.forEach(function(f){var text=row.values[f[0]]||'',entry=state.inputs.find(function(item){return item.row===row&&item.field[0]===f[0];});
                if(f[2]==='url'&&text&&!validUrl(text))error(index,entry.input,'Enter a full website address in '+feature.label+'.');
                if(f[2]==='duration'&&(!/^\d+$/.test(text)||Number(text)<15||Number(text)>480))error(index,entry.input,'Choose a duration between 15 and 480 minutes.');
              });
            }
            while(values.length&&values.at(-1)==='')values.pop();if(row.image)values.push(row.image);return values.join(' | ');
          }).filter(Boolean).join('\n');
        } else if(state.hours){
          value=state.hours.map(function(day){
            if(state.enabled&&day.open&&(!day.start||!day.end||day.start>=day.end))error(index,null,'Choose a closing time after the opening time for '+day.day+'.');
            return day.day+' | '+(day.original!=null?day.original:day.open?day.start+' - '+day.end:'Closed');
          }).join('\n');
        } else if(state.qr){value=JSON.stringify(state.qr);}
        else if(state.seo){value=['title','description','keywords'].filter(function(key){return state.seo[key];}).map(function(key){return key+' | '+clean(state.seo[key]);}).join('\n');}
        else {value=state.value.trim();}
        if(value)result[feature.key]=value;
      });return result;
    }
    root._sectionBuilder={getSections:collect,getHiddenSections:function(){return features.filter(function(f){return !states[f.key].enabled;}).map(function(f){return f.key;});}};
    var parentForm=root.closest('form');
    if(parentForm){if(root._sectionReset)parentForm.removeEventListener('reset',root._sectionReset);root._sectionReset=function(){window.setTimeout(function(){mount(root,options);},0);};parentForm.addEventListener('reset',root._sectionReset);}
    if(features.length)select(active);
    return root._sectionBuilder;
  }
  window.SyncVcardSections={mount:mount};
})();
