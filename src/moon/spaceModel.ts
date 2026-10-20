import type { WorldId } from './worlds';
import { clamp, wrap } from './model';

export const SPACE_WORLDS: Record<WorldId, { x:number; y:number; z:number; radius:number; clearance:number }> = {
  earth: { x:-7, y:0, z:3, radius:2.4, clearance:3.1 },
  moon: { x:6, y:2, z:11, radius:1.2, clearance:1.9 },
  mars: { x:-7, y:-2, z:28, radius:1.9, clearance:2.6 },
  saturn: { x:9, y:3, z:46, radius:3, clearance:7.5 },
};
export interface SpaceFlight {
  x:number; y:number; z:number; yaw:number; pitch:number; speed:number;
  target:WorldId|null; nearby:WorldId|null; bank:number;
}
export function createSpaceFlight():SpaceFlight {
  return { x:0,y:1,z:-12,yaw:0,pitch:0,speed:0,target:null,nearby:null,bank:0 };
}
export function stopSpaceFlight(state:SpaceFlight) { state.speed=0; state.target=null; state.bank=0; }
export function assistSpaceFlight(state:SpaceFlight,id:WorldId,reduced:boolean) {
  stopSpaceFlight(state);
  if(!reduced){state.target=id;return;}
  // Assisted travel becomes a cut; direct, child-controlled movement stays available.
  const body=SPACE_WORLDS[id];
  state.x=body.x;state.y=body.y+0.4;state.z=body.z-body.clearance-1.1;
  state.yaw=0;state.pitch=0;state.nearby=id;
}
/** Time-based steering; release brakes. Destination help is cancelled by any steering. */
export function stepSpaceFlight(state:SpaceFlight, dt:number, input:{x:number;y:number}|null) {
  dt=clamp(dt,0,0.05);
  if(input) state.target=null;
  let wantedSpeed=input?5:0;
  state.bank+=( (input?.x??0)-state.bank)*(1-Math.exp(-dt*8));
  if(input) {
    state.yaw=wrap(state.yaw-input.x*dt*1.25);
    state.pitch=clamp(state.pitch-input.y*dt*0.85,-0.8,0.8);
  } else if(state.target) {
    const body=SPACE_WORLDS[state.target];
    let dx=body.x-state.x,dy=body.y-state.y,dz=body.z-state.z;
    const distance=Math.hypot(dx,dy,dz);
    // If another world blocks the route, guide above its safety sphere first.
    // This also recovers a child who asks for help while stopped against a globe.
    let obstruction=Infinity;
    for(const [id,other] of Object.entries(SPACE_WORLDS)) {
      if(id===state.target)continue;
      const ox=other.x-state.x,oy=other.y-state.y,oz=other.z-state.z;
      const along=(ox*dx+oy*dy+oz*dz)/Math.max(distance*distance,.001);
      const clearance=other.clearance+1;
      if(along<=0||along>=1||along>=obstruction)continue;
      if(Math.hypot(ox-dx*along,oy-dy*along,oz-dz*along)<clearance)obstruction=along;
    }
    if(obstruction!==Infinity){
      const obstacleX=state.x+dx*obstruction,obstacleZ=state.z+dz*obstruction;
      let top=state.y;
      for(const other of Object.values(SPACE_WORLDS)){
        if(Math.hypot(other.x-obstacleX,other.z-obstacleZ)<other.clearance+1)top=Math.max(top,other.y+other.clearance+3);
      }
      dx=obstacleX-state.x;dy=top-state.y;dz=obstacleZ-state.z;
    }
    const desired=Math.atan2(dx,dz);
    state.yaw=wrap(state.yaw+wrap(desired-state.yaw)*(1-Math.exp(-dt*3)));
    state.pitch+=(Math.atan2(dy,Math.hypot(dx,dz))-state.pitch)*(1-Math.exp(-dt*3));
    // Turn before accelerating so a destination behind the ship remains reachable.
    wantedSpeed=Math.min(7,Math.max(0,distance-body.clearance-1)*1.4)*Math.max(0,Math.cos(wrap(desired-state.yaw)));
    if(distance<body.clearance+1.25) {state.target=null;wantedSpeed=0;}
  }
  state.speed+=(wantedSpeed-state.speed)*(1-Math.exp(-dt*(wantedSpeed?5:14)));
  if(state.speed<0.001)state.speed=0;
  state.x+=Math.sin(state.yaw)*Math.cos(state.pitch)*state.speed*dt;
  state.y+=Math.sin(state.pitch)*state.speed*dt;
  state.z+=Math.cos(state.yaw)*Math.cos(state.pitch)*state.speed*dt;
  state.nearby=null;
  let nearest=Infinity;
  for(const [id,body] of Object.entries(SPACE_WORLDS)) {
    let dx=state.x-body.x,dy=state.y-body.y,dz=state.z-body.z;
    const distance=Math.hypot(dx,dy,dz);
    if(distance<body.clearance) {
      if(distance<0.001){dx=0;dy=0;dz=-1;}
      const scale=body.clearance/Math.max(distance,0.001);
      if(distance<0.001){state.x=body.x;state.y=body.y;state.z=body.z-body.clearance;}
      else {state.x=body.x+dx*scale;state.y=body.y+dy*scale;state.z=body.z+dz*scale;}
      state.speed=0;
    }
    const gap=distance-body.clearance;
    if(gap<3&&gap<nearest){state.nearby=id as WorldId;nearest=gap;}
  }
  // A soft safety boundary keeps a wandering child near something recognisable.
  const reach=Math.hypot(state.x,state.y,state.z-20);
  if(reach>65) {
    const scale=65/reach;state.x*=scale;state.y*=scale;state.z=20+(state.z-20)*scale;
    state.speed=0;
  }
}
