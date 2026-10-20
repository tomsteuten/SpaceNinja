import './moon.css';
import { createSpaceFlight, stepSpaceFlight, stopSpaceFlight, assistSpaceFlight, SPACE_WORLDS } from './spaceModel';
import { createStage } from '../scene/Stage';
import { detectQuality, prefersReducedMotion } from '../scene/quality';
import { createSessionLifecycle } from './lifecycle';
import { createMoonScene } from './scene';
import { createFlight, stepFlight, stopFlight, dragGlobe, angularDistance, wrap, degrees, clamp } from './model';
import type { Place } from './places';
import { createMoonUI } from './ui';
import { worldById, placeView, type WorldId, type ExplorerWorld } from './worlds';

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
  const spaceFlight=createSpaceFlight();
  let enteringWorld=false, spaceRequest=0;
  let dayAngle=0, dayActive=false, daySuggested=false;
  let phase:'welcome'|'approach'|'explore'|'space'='welcome';
  let approach=0, frames=0, lastTouch=0, exploreTime=0, hasMoved=false, disposed=false;
  let pointer:{x:number;y:number}|null=null, pointerId:number|null=null, previous={x:0,y:0};
  let navigation:{lat:number;lon:number;alt:number;to:Place;elapsed:number}|null=null;
  let scene:Awaited<ReturnType<typeof createMoonScene>>|null=null;
  let ui:ReturnType<typeof createMoonUI>|null=null;
  let currentWorld: ExplorerWorld = initialWorld;
  let worldReady = true, selection = 0;
  const keys=new Set<string>();
  function release() {
    if(pointerId!==null&&canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    pointerId=null;pointer=null;keys.clear(); ui?.steering(0,0,false);
  }
  function suspend() {release();stopFlight(state);stopSpaceFlight(spaceFlight);}
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
    suspend();navigation=null;dayActive=false;dayAngle=0;scene?.setDayAngle(0);
    Object.assign(state,createFlight(),{mode:state.mode});
    const startingPlace=currentWorld.places[0];
    if(startingPlace) {
      const view=placeView(startingPlace,currentWorld);
      state.lat=view.lat; state.lon=view.lon;
      state.heading=0; state.altitude=state.targetAltitude=view.altitude;
    }
    approach=0;exploreTime=0;lastTouch=0;hasMoved=false;
    setPhase(reduced?'explore':'approach');
    daySuggested=currentWorld.id==='earth';
    canvas.focus({preventScroll:true});
  }
  function zoom(closer:boolean) {
    navigation=null;
    state.targetAltitude=clamp(state.targetAltitude*(closer?0.57:1.75),currentWorld.minAltitude,currentWorld.maxAltitude);
    lastTouch=exploreTime;
  }
  async function chooseWorld(id:WorldId) {
      const token=++selection;
      currentWorld=worldById(id);
      dayActive=false;dayAngle=0;scene?.setDayAngle(0);
      ui!.selectWorld(currentWorld);
      worldReady=false; ui!.loading(true); ui!.status(`Opening ${currentWorld.label}…`);
      document.title=`Space Ninja — ${currentWorld.label} Explorer`;
      canvas.setAttribute('aria-label',`Explore ${currentWorld.label}. Hold and slide to fly, release to stop. Arrow keys also move.`);
      try {
        const ready=await scene!.setWorld(currentWorld);
        if(disposed||token!==selection)return;
        worldReady=ready; ui!.loading(false); ui!.status('');
      } catch {
        if(disposed||token!==selection)return;
        ui!.loading(false,true); ui!.status('This world could not open. Try it again or choose another.');
      }

  }
  function launchSpace() {
    suspend();navigation=null;spaceRequest++;enteringWorld=false;dayActive=false;dayAngle=0;scene?.setDayAngle(0);
    Object.assign(spaceFlight,createSpaceFlight());
    if(phase==='explore') {
      const body=SPACE_WORLDS[currentWorld.id];
      spaceFlight.x=body.x;spaceFlight.y=body.y+1;spaceFlight.z=body.z-body.clearance-5;
    }
    scene!.enterSpace();setPhase('space');exploreTime=0;lastTouch=0;hasMoved=false;
    ui!.status('');canvas.setAttribute('aria-label','Fly through space. Hold to fly, release to stop. Tap a world picture for help reaching it.');
    canvas.focus({preventScroll:true});
  }
  ui=createMoonUI(root,currentWorld,{
    start, launch:launchSpace,
    home(){suspend();spaceRequest++;enteringWorld=false;dayActive=false;dayAngle=0;scene?.setDayAngle(0);navigation=null;setPhase('welcome');ui!.status('');},
    spaceTarget(id){
      release();spaceRequest++;enteringWorld=false;assistSpaceFlight(spaceFlight,id,reduced);
      if(reduced)scene!.enterSpace();
      ui!.status(reduced?'Explore or keep flying.':`Flying to ${worldById(id).label} - touch space to steer yourself`);
    },
    stopSpace(){suspend();ui!.status('');},
    async arrive(){
      const id=spaceFlight.nearby;if(!id||enteringWorld)return;
      const request=++spaceRequest;enteringWorld=true;suspend();
      await chooseWorld(id);
      if(disposed||request!==spaceRequest||phase!=='space')return;
      enteringWorld=false;
      if(worldReady&&!ui!.modal){ui!.selectWorld(currentWorld);start();}
    },
    choose:chooseWorld, zoom,
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
    day(){
      if(currentWorld.id!=='earth'||phase!=='explore')return;
      if(dayActive){dayActive=false;dayAngle=0;scene!.setDayAngle(0);ui!.status('Sunlight paused.');return;}
      release();dayActive=true;daySuggested=false;dayAngle=0.001;scene!.setDayAngle(dayAngle);
      ui!.status('Watch Earth turn through sunlight.');
    },
    pause:suspend,resume(){lastTouch=exploreTime;},
  });
  ui.phase('welcome');

  function steer(x:number,y:number) {
    const sx=(x-innerWidth/2)/(Math.min(innerWidth,innerHeight)*0.37);
    const sy=(y-innerHeight/2)/(Math.min(innerWidth,innerHeight)*0.37);
    const length=Math.hypot(sx,sy);
    pointer=phase==='space'?{x:clamp(sx,-1,1),y:clamp(sy,-1,1)}:length<0.18?{x:0,y:-1}:{x:sx/length,y:sy/length};
    ui!.steering(x,y,phase==='space'||state.mode==='fly');
  }
  canvas.addEventListener('pointerdown',event=>{
    if(ui!.modal||enteringWorld||dayActive||pointerId!==null||event.button!==0)return;
    if(phase==='welcome'){start();return;}
    if(phase==='approach'){approach=1;setPhase('explore');}
    navigation=null;pointerId=event.pointerId;canvas.setPointerCapture(event.pointerId);
    previous={x:event.clientX,y:event.clientY};steer(event.clientX,event.clientY);
    lastTouch=exploreTime;hasMoved=true;canvas.focus({preventScroll:true});
  },{signal:events.signal});
  canvas.addEventListener('pointermove',event=>{
    if(pointerId!==event.pointerId)return;
    if(phase==='explore'&&state.mode==='drag')dragGlobe(state,event.clientX-previous.x,event.clientY-previous.y,Math.min(innerWidth,innerHeight));
    previous={x:event.clientX,y:event.clientY};steer(event.clientX,event.clientY);lastTouch=exploreTime;
  },{signal:events.signal});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,event=>{
    if((event as PointerEvent).pointerId===pointerId)release();
  },{signal:events.signal});
  window.addEventListener('blur',suspend,{signal:events.signal});
  canvas.addEventListener('wheel',event=>{if(phase==='explore'&&!ui!.modal){event.preventDefault();zoom(event.deltaY<0);}},{passive:false,signal:events.signal});
  window.addEventListener('keydown',event=>{
    if(ui!.modal||enteringWorld||(phase!=='explore'&&phase!=='space')||(event.target instanceof HTMLElement&&event.target.closest('button,a,input,summary')))return;
    if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
      event.preventDefault();navigation=null;keys.add(event.key);hasMoved=true;lastTouch=exploreTime;
    }
    if(phase==='explore'&&(event.key==='+'||event.key==='='))zoom(true);
    if(phase==='explore'&&event.key==='-')zoom(false);
  },{signal:events.signal});
  window.addEventListener('keyup',event=>keys.delete(event.key),{signal:events.signal});

  stage.onFrame(dt=>{
    frames++;
    if(phase==='approach'&&!ui!.modal){approach=Math.min(1,approach+dt/2.6);if(approach===1)setPhase('explore');}
    if(phase==='explore'&&!ui!.modal){
      exploreTime+=dt;
      if(dayActive){
        dayAngle=Math.min(Math.PI*2,dayAngle+dt*0.72);
        scene!.setDayAngle(dayAngle);
        if(dayAngle>=Math.PI*2){dayActive=false;daySuggested=false;ui!.status('Morning comes as Earth turns.');}
      }
      let input=pointer;
      if(dayActive) input=null;
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
      ui!.coach(!dayActive&&!input&&!navigation&&((!hasMoved&&exploreTime<8)||(!hasMoved&&exploreTime-lastTouch>16)),state.mode);
      ui!.day(currentWorld.id==='earth',dayActive,daySuggested&&!hasMoved&&exploreTime>1);
      ui!.zoomLimits(state.targetAltitude<=currentWorld.minAltitude+0.001,state.targetAltitude>=currentWorld.maxAltitude-0.001);
      if(exploreTime-lastTouch>4&&!navigation)ui!.status('');
    }
    if(phase==='space') {
      if(!ui!.modal&&!enteringWorld){
        exploreTime+=dt;
        const input=keys.size?{x:Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft')),y:Number(keys.has('ArrowDown'))-Number(keys.has('ArrowUp'))}:pointer;
        const wasTarget=spaceFlight.target;
        stepSpaceFlight(spaceFlight,dt,input);
        if(wasTarget&&!spaceFlight.target)ui!.status(spaceFlight.nearby?'You made it! Explore or keep flying.':'You are flying the rocket');
        ui!.coach(!input&&!spaceFlight.target&&(!hasMoved||exploreTime-lastTouch>12),'fly');
      }
      ui!.space(spaceFlight.nearby,spaceFlight.target,enteringWorld);
      scene!.renderSpace(spaceFlight,ui!.modal?0:dt,reduced);
    }else scene!.render(state,phase,approach,dt,reduced);
    if(frames===1)boot.classList.add('is-hidden');
  });
  if(import.meta.env.VITE_PLAYTEST==='1'){
    (window as Window & {moonTrialSnapshot?:unknown}).moonTrialSnapshot=()=>Object.freeze({
      space:Object.freeze({...spaceFlight}),dayAngle,dayActive,enteringWorld,
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
