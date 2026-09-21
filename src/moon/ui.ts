import type { Place } from './places';
import type { ControlMode } from './model';
import { WORLDS, type ExplorerWorld, type WorldId } from './worlds';

export const icons = {
  arrow:'<path d="m13 5-7 7 7 7M6 12h14"/>',
  forward:'<path d="m11 5 7 7-7 7M18 12H4"/>',
  moon:'<path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z"/>',
  places:'<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', minus:'<path d="M5 12h14"/>',
  photo:'<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="12" cy="12" r="4"/><path d="M7 5l1-2h8l1 2"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  hand:'<path d="M9 12V5a2 2 0 0 1 4 0v5l4-1c2 0 3 1 3 3v3c0 5-3 7-7 7-3 0-5-2-6-4l-3-4c-1-2 1-3 2-2l3 2"/>',
  settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
};
const svg=(name:keyof typeof icons)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
const worldName=(world:ExplorerWorld)=>world.id==='moon'?'the Moon':world.label;

export function createMoonUI(root:HTMLElement, initialWorld:ExplorerWorld, actions:{start():void;home():void;choose(id:WorldId):void;zoom(closer:boolean):void;go(place:Place):void;mode(mode:ControlMode):void;pause():void;resume():void}) {
  let world = initialWorld;
  root.className='moon-ui'; root.removeAttribute('aria-live');
  root.innerHTML=`
    <header class="moon-brand"><span class="brand-orbit" aria-hidden="true"></span><span>SPACE NINJA <span class="brand-divider">/</span> <strong>EXPLORER</strong></span></header>
    <button class="moon-settings icon-button" aria-label="Grown-up settings">${svg('settings')}</button>
    <section class="moon-welcome" aria-label="Choose a world">
      <p class="eyebrow">A SMALL UNIVERSE TO WANDER</p><h1>Choose a world<span class="title-dot">.</span></h1>
      <div class="world-choice">${WORLDS.map(item=>`<button class="world-card${item.id===world.id?' is-selected':''}" aria-pressed="${item.id===world.id}" data-world="${item.id}"><span class="world-card-orb" style="background-image:url('${import.meta.env.BASE_URL}assets/explorer/${item.id}.jpg')" aria-hidden="true"></span><span><strong>${item.label}</strong><small>${item.strap}</small></span></button>`).join('')}</div>
      <div class="moon-launch">
        <button class="moon-start primary"><span class="selected-world-label">Explore ${worldName(world)}</span> ${svg('forward')}</button>
        <p class="welcome-note">Touch. Drift. Look a little closer.</p>
      </div>
    </section>
    <a class="moon-original" href="?classic">${svg('arrow')} Original adventure</a>
    <p class="moon-credit">NASA imagery · Maps: Solar System Scope</p>
    <nav class="moon-top" aria-label="Exploration navigation" hidden><button class="moon-home quiet">${svg('arrow')} Worlds</button><span class="moon-location">${worldName(world).toUpperCase()}</span></nav>
    <div class="moon-coach" hidden>${svg('hand')}<span>Hold to fly. Slide to steer.</span><small>Let go to stop.</small></div>
    <div class="moon-steering" aria-hidden="true" hidden><span></span></div>
    <div class="moon-landmark" hidden><span class="eyebrow">WORTH A LOOK</span><strong></strong><button class="quiet photo-button">${svg('photo')} Take a look</button></div>
    <nav class="moon-dock" aria-label="World controls" hidden>
      <button class="moon-places">${svg('places')}<span>Places</span></button><span class="dock-divider"></span>
      <button class="moon-closer" aria-label="Fly closer">${svg('plus')}<span>Closer</span></button>
      <button class="moon-wider" aria-label="Fly higher">${svg('minus')}<span>Higher</span></button>
    </nav>
    <p class="moon-status" role="status" aria-live="polite"></p>
    <dialog class="moon-dialog places-dialog" aria-labelledby="places-heading"><div class="dialog-heading"><div><p class="eyebrow">FOLLOW YOUR CURIOSITY</p><h2 id="places-heading">Somewhere to wander</h2></div><button class="icon-button" data-close aria-label="Close places">${svg('close')}</button></div>
      <div class="place-list">${world.places.map((p,i)=>`<button class="place-option" data-place="${p.id}"><span class="place-orb place-orb-${i} place-orb-${world.id}" aria-hidden="true"></span><span><strong>${p.name}</strong><small>${p.description}</small></span>${svg('forward')}</button>`).join('')}</div>
      <p class="dialog-note">Or close this and find your own way.</p>
    </dialog>
      <dialog class="moon-dialog settings-dialog" aria-labelledby="settings-heading"><div class="dialog-heading"><div><p class="eyebrow">EXPLORATION TRIAL</p><h2 id="settings-heading">For grown-ups</h2></div><button class="icon-button" data-close aria-label="Close settings">${svg('close')}</button></div>
      <p>Compare two ways to explore the same world.</p><div class="mode-options"><button data-mode="fly" aria-pressed="true"><strong>Assisted flight</strong><small>Hold to move. Slide to steer. Release to stop.</small></button><button data-mode="drag" aria-pressed="false"><strong>Turn the globe</strong><small>Drag directly. Use Closer and Higher to change your view.</small></button></div>
      <p class="dialog-note">Keyboard: arrow keys to explore, + / − to change height, Escape to close a panel. Motion follows your device’s reduced-motion preference.</p>
      <details><summary>Imagery & exploration notes</summary><p>Explore all four worlds freely. The Places button offers six optional stops on each world. There are no scores, accounts, automatic voices or changes to saved adventure progress.</p><p>The Moon uses NASA LRO colour and LOLA relief maps. Earth, Mars and Saturn use Solar System Scope maps (CC BY 4.0) based on NASA data, with some reconstructed regions. Saturn is a globe of gas, so you orbit its clouds and rings. Its storms are historical Cassini views, not fixed landmarks.</p><p>Flight scale and lighting are illustrative. Close detail opens as real mission imagery, sometimes a composite or false-colour image, with its individual source below it. The main app caches its maps for offline visits; photographs are saved only after opening them.</p><a href="https://svs.gsfc.nasa.gov/4720/" target="_blank" rel="noreferrer">NASA Moon maps ↗</a> · <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noreferrer">Solar System Scope maps · CC BY 4.0 ↗</a></details>
    </dialog>
    <dialog class="moon-dialog photo-dialog" aria-labelledby="photo-heading"><div class="dialog-heading"><div><p class="eyebrow">FROM THE MISSION ARCHIVES</p><h2 id="photo-heading"></h2></div><button class="icon-button" data-close aria-label="Keep exploring">${svg('close')}</button></div>
      <div class="photo-viewport" tabindex="0" aria-label="Mission image; scroll to explore when enlarged"><img alt=""/><p class="photo-loading">Opening the photograph…</p></div>
      <div class="photo-description"><p class="photo-words"></p><button class="quiet photo-zoom" aria-pressed="false">${svg('plus')} Look closer</button></div><a class="photo-source" target="_blank" rel="noreferrer"></a>
    </dialog>`;
  const find=<T extends HTMLElement=HTMLElement>(s:string)=>root.querySelector<T>(s)!;
  const welcome=find('.moon-welcome'), top=find('.moon-top'), dock=find('.moon-dock'), coach=find('.moon-coach');
  const settings=find<HTMLDialogElement>('.settings-dialog'), destinations=find<HTMLDialogElement>('.places-dialog'), photo=find<HTMLDialogElement>('.photo-dialog');
  const landmark=find('.moon-landmark'), steering=find('.moon-steering');
  const img=find<HTMLImageElement>('.photo-viewport img'), loading=find('.photo-loading');
  let activePlace:Place|null=null, openDialog:HTMLDialogElement|null=null, previousFocus:HTMLElement|null=null, photoToken=0;
  function open(dialog:HTMLDialogElement) {
    actions.pause(); previousFocus=document.activeElement as HTMLElement; openDialog=dialog; dialog.showModal();
    dialog.querySelector<HTMLElement>('[data-close]')?.focus();
  }
  function closed() { openDialog=null; actions.resume(); previousFocus?.focus(); }
  for(const dialog of [settings,destinations,photo]) {
    dialog.addEventListener('close',closed);
    dialog.querySelector('[data-close]')!.addEventListener('click',()=>dialog.close());
    dialog.addEventListener('keydown',event=>{
      if(event.key!=='Tab') return;
      const focusable=[...dialog.querySelectorAll<HTMLElement>('button:not([disabled]),a[href],summary,[tabindex="0"]')].filter(el=>el.getClientRects().length>0);
      if(!focusable.length)return;
      const first=focusable[0]!, last=focusable[focusable.length-1]!;
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    });
    // Deliberately no backdrop click dismiss: Android compatibility clicks must not close an opening photo.
  }
  find('.moon-start').onclick=actions.start;
  find('.moon-home').onclick=actions.home;
  find('.moon-settings').onclick=()=>open(settings);
  find('.moon-places').onclick=()=>open(destinations);
  find('.moon-closer').onclick=()=>actions.zoom(true);
  find('.moon-wider').onclick=()=>actions.zoom(false);
  for(const button of root.querySelectorAll<HTMLButtonElement>('[data-place]')) button.onclick=()=>{
    const place=world.places.find(p=>p.id===button.dataset.place)!; destinations.close(); actions.go(place);
  };
  for(const button of root.querySelectorAll<HTMLButtonElement>('[data-world]')) button.onclick=()=>{
    world=WORLDS.find(item=>item.id===button.dataset.world) ?? world;
    for(const option of root.querySelectorAll('[data-world]')) {option.classList.toggle('is-selected',option===button);option.setAttribute('aria-pressed',String(option===button));}
    find('.selected-world-label').textContent=`Explore ${worldName(world)}`;
    find('.moon-location').textContent=worldName(world).toUpperCase();
    renderPlaces(); actions.choose(world.id);
  };
  function renderPlaces() {
    find('.place-list').innerHTML=world.places.map((p,i)=>`<button class="place-option" data-place="${p.id}"><span class="place-orb place-orb-${i} place-orb-${world.id}" aria-hidden="true"></span><span><strong>${p.name}</strong><small>${p.description}</small></span>${svg('forward')}</button>`).join('');
    for(const button of root.querySelectorAll<HTMLButtonElement>('[data-place]')) button.onclick=()=>{const place=world.places.find(p=>p.id===button.dataset.place)!; destinations.close(); actions.go(place);};
    for(const orb of root.querySelectorAll<HTMLElement>('.place-orb')) orb.style.backgroundImage=`url('${import.meta.env.BASE_URL}assets/explorer/${world.id}.jpg')`;
  }
  renderPlaces();
  for(const button of root.querySelectorAll<HTMLButtonElement>('[data-mode]')) button.onclick=()=>{
    actions.mode(button.dataset.mode as ControlMode);
    for(const option of root.querySelectorAll('[data-mode]')) option.setAttribute('aria-pressed',String(option===button));
    settings.close();
  };
  function showPhoto(place:Place) {
    const token=++photoToken; find('#photo-heading').textContent=place.name;
    find('.photo-words').textContent=place.words;
    const link=find<HTMLAnchorElement>('.photo-source'); link.href=place.source; link.textContent=place.credit+' · Image source ↗';
    img.hidden=true; img.alt=place.imageLabel; loading.hidden=false; loading.textContent='Opening the photograph…';
    find('.photo-viewport').classList.remove('is-zoomed'); find('.photo-zoom').setAttribute('aria-pressed','false');
    find('.photo-zoom').hidden=true;
    open(photo);
    img.onload=()=>{if(token!==photoToken)return; img.hidden=false;loading.hidden=true;find('.photo-zoom').hidden=false;};
    img.onerror=()=>{if(token!==photoToken)return;img.hidden=true;loading.textContent='This photograph is unavailable. You can keep exploring.';};
    img.src=import.meta.env.BASE_URL+place.photo;
  }
  find('.photo-button').onclick=()=>{if(activePlace)showPhoto(activePlace);};
  find('.photo-zoom').onclick=()=>{
    const zoomed=find('.photo-viewport').classList.toggle('is-zoomed');
    find('.photo-zoom').setAttribute('aria-pressed',String(zoomed));
  };
  return {
    get modal(){return openDialog!==null;},
    phase(phase:'welcome'|'approach'|'explore'|'travel') {
      root.dataset.phase=phase;
      // The chooser and its credits stay up while flying between worlds, so the world visibly
      // swooshes past behind the menu rather than the menu vanishing for the trip.
      const home=phase==='welcome'||phase==='travel';
      welcome.hidden=!home; top.hidden=home; dock.hidden=phase!=='explore';
      find('.moon-brand').hidden=!home; find('.moon-original').hidden=!home;
      find('.moon-credit').hidden=!home;
      if(phase!=='explore') {coach.hidden=true;landmark.hidden=true;}
    },
    coach(show:boolean, mode:ControlMode) {
      coach.hidden=!show;
      coach.querySelector('span')!.textContent=mode==='fly'?(world.orbital?'Hold to orbit. Slide to steer.':'Hold to fly. Slide to steer.'):'Drag to turn the globe.';
      coach.querySelector('small')!.textContent=mode==='fly'?'Let go to stop.':'Every direction is yours.';
    },
    landmark(place:Place|null) {
      activePlace=place; landmark.hidden=!place;
      if(place) landmark.querySelector('strong')!.textContent=place.name;
    },
    steering(x:number,y:number,show:boolean) {steering.hidden=!show;steering.style.left=x+'px';steering.style.top=y+'px';},
    status(message:string){find('.moon-status').textContent=message;},
    loading(loading:boolean,failed=false){find<HTMLButtonElement>('.moon-start').disabled=loading||failed;find('.world-choice').setAttribute('aria-busy',String(loading));},
    zoomLimits(closer:boolean,wider:boolean){find<HTMLButtonElement>('.moon-closer').disabled=closer;find<HTMLButtonElement>('.moon-wider').disabled=wider;},
    dispose(){photoToken++; img.onload=null;img.onerror=null;root.replaceChildren();},
    get world(){return world;},
  };
}
