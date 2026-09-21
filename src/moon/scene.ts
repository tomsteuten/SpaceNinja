import * as THREE from 'three';
import type { Stage } from '../scene/Stage';
import type { FlightState } from './model';
import { radians } from './model';
import type { ExplorerWorld } from './worlds';

const assets = import.meta.env.BASE_URL + 'assets/';
export function direction(lat: number, lon: number) {
  return new THREE.Vector3(Math.cos(lat)*Math.cos(lon), Math.sin(lat), -Math.cos(lat)*Math.sin(lon));
}
export function basis(lat: number, lon: number, heading = 0) {
  const up = direction(lat, lon);
  const north = new THREE.Vector3(-Math.sin(lat)*Math.cos(lon), Math.cos(lat), Math.sin(lat)*Math.sin(lon));
  const east = new THREE.Vector3(-Math.sin(lon),0,-Math.cos(lon));
  return { up, forward: north.multiplyScalar(Math.cos(heading)).addScaledVector(east,Math.sin(heading)), east };
}
/** The imagery for one world, loaded ahead of the moment it is swapped onto the globe. */
export interface WorldAssets {
  world: ExplorerWorld;
  map: THREE.Texture;
  bump: THREE.Texture | null;
  ring: THREE.Texture | null;
  fallback: boolean;
}
/** Visual state of a world-to-world hop: how large to draw the body, and how hard to streak. */
export interface TravelVisual { scale: number; streak: number; }

/** One globe at a time. Textures are loaded on selection and shared across repeat visits. */
export async function createMoonScene(stage: Stage, initialWorld: ExplorerWorld) {
  const { scene, camera, renderer } = stage;
  let activeWorld = initialWorld, disposed = false, mapFallback = false;
  const pending = new AbortController();
  const textures = new Map<string, Promise<THREE.Texture>>();
  const loaded = new Set<THREE.Texture>();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const ownGeometry = <T extends THREE.BufferGeometry>(g:T) => { geometries.push(g); return g; };
  const ownMaterial = <T extends THREE.Material>(m:T) => { materials.push(m); return m; };

  function loadTexture(file: string, color = true): Promise<THREE.Texture> {
    const cached = textures.get(file);
    if (cached) return cached;
    const request = (async () => {
      // Older Android browsers do not implement AbortSignal.any/timeout.
      const controller = new AbortController();
      const abort = () => controller.abort();
      pending.signal.addEventListener('abort', abort, { once: true });
      const timeout = window.setTimeout(abort, 15000);
      let objectUrl: string | undefined;
      try {
        if (disposed) throw new Error('Scene closed');
        const response = await fetch(assets + file, { signal: controller.signal });
        if (!response.ok) throw new Error('Image unavailable (' + response.status + ')');
        objectUrl = URL.createObjectURL(await response.blob());
        const image = new Image(); image.src = objectUrl;
        await image.decode();
        if (disposed) throw new Error('Scene closed');
        const texture = new THREE.Texture(image);
        texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
        texture.needsUpdate = true; loaded.add(texture);
        return texture;
      } finally {
        clearTimeout(timeout); pending.signal.removeEventListener('abort', abort);
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      }
    })();
    textures.set(file, request);
    void request.catch(() => textures.delete(file));
    return request;
  }

  scene.background = new THREE.Color('#03070d');
  renderer.toneMappingExposure = 1.1;
  const stars = new Float32Array(600*3);
  let seed = 781;
  const random = () => { seed=(seed*1664525+1013904223)>>>0; return seed/4294967296; };
  for (let i=0;i<600;i++) stars.set(direction(Math.asin(random()*2-1),random()*Math.PI*2).multiplyScalar(110).toArray(),i*3);
  const starGeometry = ownGeometry(new THREE.BufferGeometry());
  starGeometry.setAttribute('position',new THREE.BufferAttribute(stars,3));
  // Kept on hand so a world-to-world hop can streak and spin the field for a sense of speed.
  const starMaterial = ownMaterial(new THREE.PointsMaterial({color:0xb8cce2,size:0.12,transparent:true,opacity:0.65}));
  const starPoints = new THREE.Points(starGeometry,starMaterial);
  scene.add(starPoints);
  const light = new THREE.DirectionalLight(0xfff5e8,2.7);
  const welcomeLight = new THREE.Vector3(4,1.8,-2.5);
  light.position.copy(welcomeLight);
  scene.add(light,new THREE.AmbientLight(0xc7d6e8,0.65));
  // Globe and rings live under one group so a journey can scale the whole body toward a far
  // dot and back without touching the surface flight maths, which still works in body space.
  const bodyGroup = new THREE.Group();
  scene.add(bodyGroup);
  const surface = ownMaterial(new THREE.MeshStandardMaterial({roughness:1,metalness:0,bumpScale:0.006}));
  const globe = new THREE.Mesh(ownGeometry(new THREE.SphereGeometry(1,128,80)),surface);
  bodyGroup.add(globe);

  // Ring-strip UVs run across the radius, and the rings share the body's equator.
  const ringGeometry = ownGeometry(new THREE.RingGeometry(1.28,2.3,96,1));
  const ringPositions = ringGeometry.getAttribute('position');
  const ringUV = ringGeometry.getAttribute('uv');
  for(let i=0;i<ringPositions.count;i++) ringUV.setXY(i,(Math.hypot(ringPositions.getX(i),ringPositions.getY(i))-1.28)/1.02,0.5);
  const ringMaterial = ownMaterial(new THREE.MeshStandardMaterial({transparent:true,side:THREE.DoubleSide,roughness:1,depthWrite:false,emissive:0xffffff,emissiveIntensity:0.2}));
  const rings = new THREE.Mesh(ringGeometry,ringMaterial);
  rings.rotation.x=-Math.PI/2; rings.renderOrder=1; rings.visible=false; bodyGroup.add(rings);

  const ship = new THREE.Group();
  const hull = ownMaterial(new THREE.MeshStandardMaterial({color:0xe6e8e6,roughness:0.44,metalness:0.3}));
  const dark = ownMaterial(new THREE.MeshStandardMaterial({color:0x2b4253,roughness:0.3,metalness:0.5}));
  const body = new THREE.Mesh(ownGeometry(new THREE.SphereGeometry(1,16,10)),hull);
  body.scale.set(0.095,0.055,0.24); ship.add(body);
  const glass = new THREE.Mesh(ownGeometry(new THREE.SphereGeometry(1,12,8)),dark);
  glass.scale.set(0.067,0.043,0.095); glass.position.set(0,0.046,0.025); ship.add(glass);
  const wing = new THREE.Mesh(ownGeometry(new THREE.BoxGeometry(0.42,0.017,0.11)),hull);
  wing.position.z=-0.065; ship.add(wing);
  const engine = new THREE.Mesh(ownGeometry(new THREE.SphereGeometry(1,10,6)),ownMaterial(new THREE.MeshBasicMaterial({color:0x8adad9,transparent:true,opacity:0.7})));
  engine.scale.set(0.035,0.03,0.045); engine.position.z=-0.25; ship.add(engine);
  ship.visible=false; scene.add(ship);

  // Loading a world's imagery and putting it on the globe are split so a journey can fetch the
  // next world during the depart leg and only swap it in at the far point (see travel.ts).
  async function loadWorld(next: ExplorerWorld): Promise<WorldAssets> {
    let fallback = false;
    const map = await loadTexture(next.texture).catch(() => { fallback=true; return loadTexture(next.fallback); });
    const [bump, ring] = await Promise.all([
      next.id==='moon' ? loadTexture('moon-trial/moon-relief.png',false).catch(()=>null) : null,
      next.orbital ? loadTexture('saturn-rings.png') : null,
    ]);
    return { world:next, map, bump, ring, fallback };
  }
  function applyWorld(assets: WorldAssets) {
    if (disposed) return;
    surface.map=assets.map; surface.bumpMap=assets.bump; surface.needsUpdate=true;
    ringMaterial.map=assets.ring; ringMaterial.emissiveMap=assets.ring; ringMaterial.needsUpdate=true;
    rings.visible=assets.world.orbital; activeWorld=assets.world; mapFallback=assets.fallback;
  }
  async function setWorld(next: ExplorerWorld) {
    const assets = await loadWorld(next);
    if (disposed) return false;
    applyWorld(assets);
    return true;
  }
  function dispose() {
    if (disposed) return;
    disposed=true; pending.abort();
    for(const texture of loaded) texture.dispose();
    for(const geometry of geometries) geometry.dispose();
    for(const material of materials) material.dispose();
    textures.clear(); loaded.clear(); scene.clear();
  }
  try { await setWorld(initialWorld); } catch(error) { dispose(); throw error; }

  const currentPosition=new THREE.Vector3(),currentTarget=new THREE.Vector3();
  const shipBasis=new THREE.Matrix4();
  let cameraReady=false;
  function render(state:FlightState, phase:'welcome'|'approach'|'explore'|'travel', approach:number,dt:number,reduced:boolean,travel:TravelVisual|null=null) {
    const frame=basis(state.lat,state.lon,state.heading);
    const height=state.mode==='drag'?Math.max(state.altitude,0.4):state.altitude;
    const orbital=activeWorld.orbital;
    const orbitPosition=frame.up.clone().multiplyScalar(1+height).addScaledVector(frame.forward,-height*0.35);
    const orbitTarget=orbital?new THREE.Vector3():frame.up.clone().addScaledVector(frame.forward,state.mode==='drag'?0:height*0.4);
    const portrait=camera.aspect<0.8;
    const welcomeDir=direction(radians(orbital?28:-15),radians(-13));
    const homeDistance=orbital?(portrait?6.6:5.3):(portrait?3.6:3.1);
    const welcomePosition=welcomeDir.multiplyScalar(homeDistance);
    const welcomeTarget=portrait?new THREE.Vector3(0,0.15,0):new THREE.Vector3(0,0,orbital?0.9:0.65);
    // Travel holds the welcome framing; the sense of motion comes from the body shrinking away
    // and the stars streaking, not from moving the camera.
    const amount=phase==='welcome'||phase==='travel'?0:phase==='explore'?1:approach*approach*(3-2*approach);
    const smoothing=!cameraReady||reduced||phase!=='explore'?1:1-Math.exp(-dt*9);
    // Body scale and star streak for a world-to-world hop; both rest at their defaults otherwise.
    const streak=travel?travel.streak:0;
    bodyGroup.scale.setScalar(travel?travel.scale:1);
    starMaterial.size=0.12+streak*0.5;
    starMaterial.opacity=0.65+streak*0.3;
    starPoints.rotation.y+=streak*dt*0.7;
    currentPosition.lerp(welcomePosition.lerp(orbitPosition,amount),smoothing);
    currentTarget.lerp(welcomeTarget.lerp(orbitTarget,amount),smoothing); cameraReady=true;
    camera.position.copy(currentPosition);
    camera.up.set(0,1,0).lerp(frame.up,orbital?0:amount).normalize(); camera.lookAt(currentTarget);
    // Illustrative survey light follows the view so every authored place remains readable.
    const surveyLight=frame.up.clone().multiplyScalar(4).addScaledVector(frame.east,-2).addScaledVector(frame.forward,2);
    light.position.copy(welcomeLight).lerp(surveyLight,amount);
    ship.visible=phase==='explore'&&state.mode==='fly'&&!orbital;
    if(ship.visible) {
      ship.position.copy(frame.up).multiplyScalar(1+height*0.42).addScaledVector(frame.forward,height*0.05);
      ship.scale.setScalar(height*0.18);
      const right=new THREE.Vector3().crossVectors(frame.up,frame.forward).normalize();
      shipBasis.makeBasis(right,frame.up,frame.forward); ship.quaternion.setFromRotationMatrix(shipBasis);
      engine.scale.z=0.035+state.speed*1.8;
    }
  }
  return { render,dispose,setWorld,loadWorld,applyWorld,get mapFallback(){return mapFallback;},get worldId(){return activeWorld.id;} };
}
// End of explorer scene.
