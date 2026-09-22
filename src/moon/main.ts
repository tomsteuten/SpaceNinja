import './moon.css';
import { createStage } from '../scene/Stage';
import { detectQuality, prefersReducedMotion } from '../scene/quality';
import { createSessionLifecycle } from './lifecycle';
import { createMoonScene, type WorldAssets } from './scene';
import { createFlight, stepFlight, stopFlight, dragGlobe, angularDistance, wrap, degrees, clamp } from './model';
import type { Place } from './places';
import { createMoonUI } from './ui';
import { worldById, placeView, type WorldId, type ExplorerWorld } from './worlds';
import { createDeparture, createArrival, reverseArrivalToDeparture, advanceTravel, travelScale, travelStreak, type Travel } from './travel';

const destinationName=(world:ExplorerWorld)=>world.id==='moon'?'the Moon':world.label;

export async function startMoonTrial(canvas:HTMLCanvasElement, root:HTMLElement, initialWorldId:WorldId='moon') {
  const initialWorld=worldById(initialWorldId);
  document.title=`Space Ninja — ${initialWorld.label} Explorer`;
  canvas.setAttribute('aria-label',`Explore ${initialWorld.label}. Hold and slide to fly, release to stop. Arrow keys also move.`);
  canvas.tabIndex=0;
  const boot=document.getElementById('boot')!;
  const loading=boot.querySelector('.boot-status'); if(loading) loading.textContent=`Getting ${initialWorld.label} ready…`;
  const reduced=prefersReducedMotion();
  const quality=detectQuality();
  const stage=createStage(canvas,{...quality,bloom:false,maxPixelRatio:Math.min(quality.maxPixelRatio,1.5)});
  const events=new AbortController();
  const state=createFlight();
  let phase:'welcome'|'approach'|'explore'|'travel'='welcome';
  let approach=0, frames=0, lastTouch=0, exploreTime=0, hasMoved=false, disposed=false;
  let pointer:{x:number;y:number}|null=null, pointerId:number|null=null, previous={x:0,y:0};
  let navigation:{lat:number;lon:number;alt:number;to:Place;elapsed:number}|null=null;
  // A world-to-world hop in flight: the timing model, the world being flown to (null for the
  // opening fly-in, whose world is already loaded), its imagery once fetched, and a stale guard.
  let travelState:{model:Travel;target:ExplorerWorld|null;assets:WorldAssets|null;failed:boolean;token:number}|null=null;
  let scene:Awaited<ReturnType<typeof createMoonScene>>|null=null;
  let ui:ReturnType<typeof createMoonUI>|null=null;
  let currentWorld: ExplorerWorld = initialWorld;
  let worldReady = true, selection = 0;
  const keys=new Set<string>();
  function release() {
    if(pointerId!==null&&canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    pointerId=null;pointer=null;keys.clear(); ui?.steering(0,0,false);
  }
  function suspend() {release();stopFlight(state);}
  function failure(error:unknown) {
    for(const dialog of root.querySelectorAll<HTMLDialogElement>('dialog[open]'))dialog.close();
    boot.classList.add('has-error','has-crash');boot.classList.remove('is-hidden');
    const detail=boot.querySelector('.boot-detail'); if(detail)detail.textContent=error instanceof Error?error.message:String(error);
    boot.querySelector('.boot-restart')?.addEventListener('click',()=>location.reload(),{once:true});
  }
  const lifetime=createSessionLifecycle({stage,document,window,suspend,fail:failure,dispose(){
    disposed=true;events.abort();scene?.dispose();ui?.dispose();stage.dispose();
    if(import.meta.env.VITE_PLAYTEST==='1') delete (window as Window & {moonTrialSnapshot?:unknown}).moonTrialSnapshot;
  }});
  try { scene=await createMoonScene(stage,currentWorld); }
  catch(error) {lifetime.dispose();throw error;}
  if(disposed){scene.dispose();return;}

  function setPhase(next:typeof phase) {phase=next;ui?.phase(next);}
  function start() {
    if(!worldReady)return;
    suspend();navigation=null;travelState=null;
    Object.assign(state,createFlight(),{mode:state.mode});
    const startingPlace=currentWorld.places[0];
    if(startingPlace) {
      const view=placeView(startingPlace,currentWorld);
      state.lat=view.lat; state.lon=view.lon;
      state.heading=0; state.altitude=state.targetAltitude=view.altitude;
    }
    approach=0;exploreTime=0;lastTouch=0;hasMoved=false;
    setPhase(reduced?'explore':'approach');
    canvas.focus({preventScroll:true});
  }
  function zoom(closer:boolean) {
    navigation=null;
    state.targetAltitude=clamp(state.targetAltitude*(closer?0.57:1.75),currentWorld.minAltitude,currentWorld.maxAltitude);
    lastTouch=exploreTime;
  }
  ui=createMoonUI(root,currentWorld,{
    start, home(){suspend();navigation=null;travelState=null;setPhase('welcome');ui!.status('');},
    choose(id:WorldId){
      const token=++selection;
      const target=worldById(id);
      currentWorld=target;
      worldReady=false; ui!.loading(true);
      document.title=`Space Ninja — ${target.label} Explorer`;
      canvas.setAttribute('aria-label',`Explore ${target.label}. Hold and slide to fly, release to stop. Arrow keys also move.`);
      // Reduced motion, or re-picking the world already on screen: swap in place, no journey.
      if(reduced||scene!.worldId===id){
        travelState=null;
        ui!.status(reduced?`Opening ${target.label}…`:'');
        // Apply only after the latest-selection guard. `setWorld()` applies internally, which
        // would let an older reduced-motion request repaint the globe after a newer choice.
        scene!.loadWorld(target).then(assets=>{
          if(disposed||token!==selection)return;
          scene!.applyWorld(assets);
          worldReady=true; ui!.loading(false); ui!.status('');
        }).catch(()=>{
          if(disposed||token!==selection)return;
          ui!.loading(false,true); ui!.status('This world could not open. Try it again or choose another.');
        });
        return;
      }
      // Otherwise fly there. A pick mid-hop retargets the same journey rather than starting a
      // jarring new one, so a child can change their mind (or escape a slow load) in flight; if
      // the old world was already arriving, drop back out so the new one can swap at the far point.
      if(travelState){
        travelState.target=target; travelState.assets=null; travelState.failed=false; travelState.token=token;
        if(travelState.model.leg==='arrive') travelState.model=reverseArrivalToDeparture(travelState.model);
      } else {
        travelState={model:createDeparture(),target,assets:null,failed:false,token};
      }
      setPhase('travel');
      ui!.status(`Travelling to ${destinationName(target)}…`);
      scene!.loadWorld(target).then(assets=>{
        if(disposed||token!==selection||!travelState)return;
        travelState.assets=assets;
      }).catch(()=>{
        if(disposed||token!==selection||!travelState)return;
        travelState.failed=true;
      });
    }, zoom,
    go(place){
      suspend();
      const view=placeView(place,currentWorld);
      if(reduced){navigation=null;state.lat=view.lat;state.lon=view.lon;state.heading=0;state.altitude=state.targetAltitude=view.altitude;}
      else navigation={lat:state.lat,lon:state.lon,alt:state.altitude,to:place,elapsed:0};
      lastTouch=exploreTime;ui!.status(`Gliding to ${place.name}`);
    },
    mode(mode){suspend();navigation=null;state.mode=mode;state.heading=0;hasMoved=false;lastTouch=exploreTime;
      if(mode==='drag')state.targetAltitude=Math.max(0.4,state.altitude);
      else state.targetAltitude=currentWorld.startAltitude;
      ui!.status(mode==='fly'?'Assisted flight':'Turn the globe');
    },
    pause:suspend,resume(){lastTouch=exploreTime;},
  });
  // Open by flying in from space rather than cutting to a static globe (skipped for reduced motion).
  if(reduced) setPhase('welcome');
  else { travelState={model:createArrival(),target:null,assets:null,failed:false,token:++selection}; setPhase('travel'); }

  function steer(x:number,y:number) {
    const sx=(x-innerWidth/2)/(Math.min(innerWidth,innerHeight)*0.37);
    const sy=(y-innerHeight/2)/(Math.min(innerWidth,innerHeight)*0.37);
    const length=Math.hypot(sx,sy);
    pointer=length<0.18?{x:0,y:-1}:{x:sx/length,y:sy/length};
    ui!.steering(x,y,state.mode==='fly');
  }
  canvas.addEventListener('pointerdown',event=>{
    if(ui!.modal||pointerId!==null||event.button!==0)return;
    if(phase==='travel'){
      // The opening fly-in is decorative. A child's first touch should still immediately begin
      // exploring; actual world-to-world hops keep their controls exclusive until they land.
      if(travelState?.target===null) start();
      return;
    }
    if(phase==='welcome'){start();return;}
    if(phase==='approach'){approach=1;setPhase('explore');}
    navigation=null;pointerId=event.pointerId;canvas.setPointerCapture(event.pointerId);
    previous={x:event.clientX,y:event.clientY};steer(event.clientX,event.clientY);
    lastTouch=exploreTime;hasMoved=true;canvas.focus({preventScroll:true});
  },{signal:events.signal});
  canvas.addEventListener('pointermove',event=>{
    if(pointerId!==event.pointerId)return;
    if(state.mode==='drag')dragGlobe(state,event.clientX-previous.x,event.clientY-previous.y,Math.min(innerWidth,innerHeight));
    previous={x:event.clientX,y:event.clientY};steer(event.clientX,event.clientY);lastTouch=exploreTime;
  },{signal:events.signal});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,event=>{
    if((event as PointerEvent).pointerId===pointerId)release();
  },{signal:events.signal});
  window.addEventListener('blur',suspend,{signal:events.signal});
  canvas.addEventListener('wheel',event=>{if(phase==='explore'&&!ui!.modal){event.preventDefault();zoom(event.deltaY<0);}},{passive:false,signal:events.signal});
  window.addEventListener('keydown',event=>{
    if(ui!.modal||phase!=='explore'||(event.target instanceof HTMLElement&&event.target.closest('button,a,input,summary')))return;
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
      event.preventDefault();navigation=null;keys.add(event.key);hasMoved=true;lastTouch=exploreTime;
    }
    if(event.key==='+'||event.key==='=')zoom(true);
    if(event.key==='-')zoom(false);
  },{signal:events.signal});
  window.addEventListener('keyup',event=>keys.delete(event.key),{signal:events.signal});

  stage.onFrame(dt=>{
    frames++;
    if(phase==='travel'&&travelState&&!ui!.modal){
      if(travelState.failed){
        // The next world's imagery would not load: abort the hop, stay put, invite a retry.
        ui!.loading(false,true); ui!.status('This world could not open. Try it again or choose another.');
        travelState=null; setPhase('welcome');
      } else {
        const step=advanceTravel(travelState.model,dt,travelState.assets!==null);
        if(step.swap&&travelState.assets) scene!.applyWorld(travelState.assets);
        if(step.done){ worldReady=true; ui!.loading(false); ui!.status(''); travelState=null; setPhase('welcome'); }
      }
    }
    if(phase==='approach'&&!ui!.modal){approach=Math.min(1,approach+dt/2.6);if(approach===1)setPhase('explore');}
    if(phase==='explore'&&!ui!.modal){
      exploreTime+=dt;
      let input=pointer;
      if(keys.size){
        const x=Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft'));
        const y=Number(keys.has('ArrowDown'))-Number(keys.has('ArrowUp'));
        input=x||y?{x,y}:null;
        if(state.mode==='drag')dragGlobe(state,-x*dt*180,-y*dt*180,500);
      }
      if(navigation){
        navigation.elapsed+=dt;
        const t=Math.min(1,navigation.elapsed/2.6), e=t*t*(3-2*t);
        const view=placeView(navigation.to,currentWorld);
        state.lat=navigation.lat+(view.lat-navigation.lat)*e;
        state.lon=wrap(navigation.lon+wrap(navigation.to.lon-navigation.lon)*e);
        state.heading=0;
        const targetAlt=view.altitude;
        state.altitude=state.targetAltitude=navigation.alt+(targetAlt-navigation.alt)*e;
        if(t===1){ui!.status('');navigation=null;}
      }else stepFlight(state,dt,input,{min:currentWorld.minAltitude,max:currentWorld.maxAltitude});
      if(reduced)state.altitude=state.targetAltitude;
      const near=currentWorld.places.find(p=>angularDistance(state,placeView(p,currentWorld))<0.18)??null;
      ui!.landmark(navigation?null:near);
      ui!.coach(!input&&!navigation&&((!hasMoved&&exploreTime<8)||(!hasMoved&&exploreTime-lastTouch>16)),state.mode);
      ui!.zoomLimits(state.targetAltitude<=currentWorld.minAltitude+0.001,state.targetAltitude>=currentWorld.maxAltitude-0.001);
      if(exploreTime-lastTouch>4&&!navigation)ui!.status('');
    }
    const travelVisual=phase==='travel'&&travelState?{scale:travelScale(travelState.model),streak:travelStreak(travelState.model)}:null;
    scene!.render(state,phase,approach,dt,reduced,travelVisual);
    if(frames===1)boot.classList.add('is-hidden');
  });
  if(import.meta.env.VITE_PLAYTEST==='1'){
    (window as Window & {moonTrialSnapshot?:unknown}).moonTrialSnapshot=()=>Object.freeze({
      phase,frame:frames,latitude:degrees(state.lat),longitude:degrees(state.lon),heading:state.heading,
      altitude:state.altitude,speed:state.speed,mode:state.mode,steering:pointer!==null,
      navigating:navigation!==null,modal:ui!.modal,reducedMotion:reduced,
      camera:stage.camera.position.toArray(),mapFallback:scene!.mapFallback,world:currentWorld.id,
      renderedWorld:scene!.worldId,worldReady,placeCount:currentWorld.places.length,
    });
  }
  lifetime.start();
  return { canReload:()=>phase==='welcome'&&!ui!.modal };
}
