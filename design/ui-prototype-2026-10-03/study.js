const $=s=>document.querySelector(s), params=new URLSearchParams(location.search);
let state=params.get('state')||'moon', world=['earth','day'].includes(state)?'earth':state==='sun'?'sun':'moon', modal=null, found=false, audio=null, focusBefore=null, previousModal=null;
const names={moon:'The Moon',earth:'Earth',sun:'The Sun',mars:'Mars',saturn:'Saturn'};
const asset='../../assets/', recording='../../src/audio/recordings/';
const facts={moon:'The Moon goes around Earth. Its rocky surface is covered in craters, made when space rocks crashed into it.',earth:'Earth turns as it travels around the Sun. The side facing the Sun has day. The side facing away has night.',sun:'The Sun is a star. It gives Earth light and warmth. We can look at it from our spaceship, but there is no solid ground to land on.'};
const svg=(body,view='0 0 40 36')=>`<svg viewBox="${view}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const icons={map:svg('<path d="m9 8-5 5 5 5M5 13h11" stroke="#e2f2f6"/><circle cx="25" cy="20" r="9" fill="#77b9cf" stroke="#c4e6ec"/><path d="m24 12-4 6 6 2-1 8 6-5-1-6Z" fill="#b4cc9d" stroke="none"/><circle cx="34" cy="6" r="4" fill="#f2ce79" stroke="none"/>'),speaker:svg('<path d="M6 14h7l9-7v23l-9-7H6Z" fill="#a8dce5" stroke="#a8dce5"/><path d="M28 12a10 10 0 0 1 0 13M33 8a16 16 0 0 1 0 21" stroke="#a8dce5"/>'),book:svg('<path d="M8 4h24v28H8a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z" fill="#a9ced0" stroke="#d5eeed"/><path d="M11 4v24M4 28h28" stroke="#325165"/><circle cx="23" cy="16" r="5" fill="#354d6a" stroke="none"/><path d="m17 19 12-6" stroke="#eddfaf"/>'),turn:svg('<circle cx="20" cy="16" r="11" fill="#739bb3" stroke="#b9d6e5"/><path d="M20 5a11 11 0 0 1 0 22Z" fill="#26374e" stroke="none"/><path d="M8 30c7 5 18 4 23-3m-6-1 7 0-1 6" stroke="currentColor"/>'),stop:svg('<rect x="10" y="7" width="21" height="21" rx="4" fill="currentColor" stroke="none"/>'),back:svg('<path d="m12 7-8 11 8 10M5 18h20c7 0 10 4 10 10"/>'),close:svg('<path d="m10 8 20 20M30 8 10 28"/>'),lock:svg('<rect x="10" y="16" width="20" height="17" rx="4"/><path d="M14 16V10a6 6 0 0 1 12 0v6"/>')};
let scenes={};
try{scenes=await(await fetch('./scenes.json')).json();}catch{announce('Scene captures are still being prepared.');}
function device(){return innerWidth<600?'phone':innerHeight<480?'landscape':'tablet';}
function orb(id){return `<span class="orb ${id}" aria-hidden="true"></span>`;}
function control(action,label,icon,extra=''){return `<button type="button" class="control ${extra}" data-action="${action}"><span class="symbol">${icons[icon]}</span><span class="label">${label}</span></button>`;}
function stopAudio(){if(audio){audio.pause();audio=null;}}
function play(cue){stopAudio();const clip=new Audio(recording+cue+'.mp3');audio=clip;clip.play().catch(error=>{if(audio===clip&&error.name!=='AbortError')announce('The written words are available below.');});}
function announce(t){$('#status').textContent=t;clearTimeout(announce.timer);announce.timer=setTimeout(()=>$('#status').textContent='',3500);}
function render(){
  document.body.dataset.version=params.get('version')||'proposed';
  document.body.dataset.scene=state;
  if(params.get('version')==='current'){
    const d=device()==='landscape'?'short-landscape':device();
    const s=state==='map'?'space-map':state==='sun'?'sun-visit':state==='photo'?'discovery-exit':'world-return';
    if(state==='earth'||state==='day'){$('#background').src=`scenes/current-${device()}-${state}.png`;$('#background').alt='Current Earth interface captured from the game';}
    else{$('#background').src=`../publish-review-2026-10-03/${d}/after-${s}.png`;$('#background').alt='Current published interface';}
    $('#hud').innerHTML='';$('#targets').innerHTML='';return;
  }
  const scene=state==='photo'?'moon':state==='day'&&world!=='earth'?world:state;
  $('#background').src=`scenes/${device()}-${scene}.png`;
  $('#background').alt=state==='map'?'The current game’s space map':`${names[world]} from the current game`;
  if(state==='map'){
    $('#hud').innerHTML=`<header class="header"><div class="identity"><div><h1>Where shall we go?</h1><p>Tap a world</p></div></div><button class="header-journal" data-action="journal" aria-label="Open journal">${icons.book}</button></header><nav class="rail destination-row" aria-label="Destinations">${['sun','earth','moon','mars','saturn'].map(id=>`<button class="control ${id==='moon'?'selected':''} ${['mars','saturn'].includes(id)?'locked':''}" data-world="${id}">${orb(id)}<span class="label">${id==='moon'?'Moon':names[id].replace('The ','')}${['mars','saturn'].includes(id)?`<span class="tiny-lock">${icons.lock}</span>`:''}</span></button>`).join('')}</nav>`;
  }else{
    const isDay=state==='day', hasTurn=world!=='sun';
    $('#hud').innerHTML=`<header class="header"><div class="identity">${orb(world)}<div><h1>${names[world]}</h1><p>${world==='sun'?'Our nearest star':isDay?'Sunlight makes day.':world==='earth'?'Turn Earth. See day and night.':'Tap a gold place'}</p></div></div>${world==='sun'?'':isDay?'<div class="day-key"><span><i></i>Day</span><span><i class="night"></i>Night</span></div>':`<div class="progress" role="img" aria-label="${found?1:0} of 3 places found"><span class="pip ${found?'found':''}"></span><span class="pip"></span><span class="pip"></span></div>`}</header><nav class="rail" style="--count:${hasTurn?4:3}" aria-label="Explore this world">${control('map','Space map','map','map')}${control('listen','Listen','speaker')}${hasTurn?control('turn',isDay?'Stop':'Day & night',isDay?'stop':'turn',isDay?'turning':world==='earth'?'invite':''):''}${control('journal','Journal','book','journal')}</nav>`;
  }
  $('#targets').innerHTML='';
  const ss=scenes[`${device()}-${scene}`];
  if(ss&&!['map','sun','day'].includes(state)){
    const[w,h]=device()==='phone'?[390,844]:device()==='tablet'?[1024,768]:[844,390];
    const scale=Math.max(innerWidth/w,innerHeight/h);
    for(const [i,t]of ss.targets.entries())if(t.visible){const b=document.createElement('button');b.className='hit';b.style.left=((innerWidth-w*scale)/2+t.x*scale)+'px';b.style.top=((innerHeight-h*scale)/2+t.y*scale)+'px';b.setAttribute('aria-label',`Open discovery ${i+1}`);b.onclick=()=>{found=true;openModal('photo');};$('#targets').append(b);}
  }
  if(state==='photo'){world='moon';openModal('photo');}
}
function openModal(kind){
  clearTimeout(announce.timer);$('#status').textContent='';
  if(!modal)focusBefore=document.activeElement;
  const photoWorld=kind==='photo'&&modal==='journal'?'moon':world;
  previousModal=modal;modal=kind;stopAudio();
  const photoId=photoWorld==='earth'?'earth-sahara':'moon-tranquility';
  const title=photoWorld==='earth'?'The Sahara':'The first footprints';
  const description=photoWorld==='earth'?'The Sahara is a huge desert in northern Africa. From space, we can see its sweeping sand and rock.':'An astronaut left this bootprint on the Moon. With no wind or rain to wash it away, it can stay for a very long time.';
  const backToJournal=previousModal==='journal';
  const close=`<button class="close" data-action="close" aria-label="Close ${kind}">${icons.close}</button>`;
  const ret=`<button class="return" data-action="${backToJournal?'back-journal':'close'}">${icons.back}${backToJournal?icons.book:orb(state==='map'?'earth':world)}<span>${backToJournal?'Back to journal':state==='map'?'Back to space':'Keep exploring'}</span></button>`;
  let content='';
  if(kind==='photo')content=`<div class="dialog-head"><h2 id="dialog-title">${title}</h2>${close}</div><img class="photo" src="${asset}discoveries/${photoId}.jpg" alt="${photoWorld==='earth'?'The Sahara photographed from space':'Apollo 11 bootprint on the Moon'}"><div class="photo-copy"><p>${description}</p><p class="credit">${photoWorld==='earth'?'NASA':'NASA / Buzz Aldrin · Apollo 11'}</p></div><div class="dialog-footer">${ret}</div>`;
  if(kind==='listen')content=`<div class="dialog-head"><h2 id="dialog-title">${names[world]}</h2>${close}</div><div class="reading-picture">${orb(world)}<span>A little about ${names[world].toLowerCase()}</span></div><p>${facts[world]}</p><div class="dialog-footer"><button class="audio" data-action="replay" aria-label="Replay narration">${icons.speaker}</button>${ret}</div>`;
  if(kind==='journal')content=`<div class="dialog-head"><h2 id="dialog-title">My discoveries</h2>${close}</div><p>Little memories of a big adventure.</p><div class="journal-grid"><button class="postcard" data-action="photo"><img src="${asset}discoveries/thumbs/moon-tranquility.jpg" alt="Moon bootprint"><span>First footprints</span></button>${Array.from({length:5},()=>'<div class="postcard empty" aria-label="An undiscovered place" style="display:grid;place-items:center">·</div>').join('')}</div><div class="dialog-footer">${ret}</div>`;
  $('#overlay').innerHTML=`<div class="shade"><section class="dialog ${kind==='photo'?'photo-dialog':''}" role="dialog" aria-modal="true" aria-labelledby="dialog-title">${content}</section></div>`;
  $('#hud').inert=true;$('#targets').inert=true;requestAnimationFrame(()=>$('#overlay .return').focus());
  if(kind==='listen')play('arrival-'+world);
}
function closeModal(){if(modal==='photo'&&previousModal==='journal'){openModal('journal');return;}stopAudio();modal=null;$('#overlay').innerHTML='';$('#hud').inert=false;$('#targets').inert=false;if(state==='photo')state='moon';render();const fallback=$('[data-action="map"]');if(focusBefore?.isConnected)focusBefore.focus();else fallback?.focus();}
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.world){const id=b.dataset.world;if(['mars','saturn'].includes(id)){announce('Visit the Moon to discover more worlds.');return;}stopAudio();world=id;state=id;render();return;}
  switch(b.dataset.action){
    case'map':stopAudio();state='map';render();break;
    case'listen':openModal('listen');break;
    case'journal':openModal('journal');break;
    case'close':closeModal();break;
    case'back-journal':openModal('journal');break;
    case'photo':openModal('photo');break;
    case'replay':play('arrival-'+world);break;
    case'turn':state=state==='day'?world:'day';render();break;
  }
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal){e.preventDefault();closeModal();}if(e.key==='Tab'&&modal){const list=[...$('#overlay').querySelectorAll('button')];const first=list[0],last=list.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
addEventListener('resize',()=>{if(!modal)render();});addEventListener('pagehide',stopAudio);document.addEventListener('visibilitychange',()=>{if(document.hidden)stopAudio();});render();

