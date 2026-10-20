import { describe,it,expect } from 'vitest';
import { createSpaceFlight,stepSpaceFlight,stopSpaceFlight,assistSpaceFlight,SPACE_WORLDS } from './spaceModel';
import type { WorldId } from './worlds';

describe('space playground',()=>{
  it('cuts assisted travel for reduced motion and leaves the ship stopped outside each world',()=>{
    const state=createSpaceFlight();
    for(const id of Object.keys(SPACE_WORLDS) as WorldId[]){
      assistSpaceFlight(state,id,true);expect(state.target).toBeNull();expect(state.speed).toBe(0);
      stepSpaceFlight(state,0,null);expect(state.nearby).toBe(id);
    }
  });
  it('moves on hold, turns both ways and stops promptly on release',()=>{
    const state=createSpaceFlight();
    for(let i=0;i<60;i++)stepSpaceFlight(state,1/60,{x:0,y:0});
    expect(state.z).toBeGreaterThan(-9);
    for(let i=0;i<30;i++)stepSpaceFlight(state,1/60,{x:1,y:0});
    expect(state.yaw).toBeLessThan(0);
    for(let i=0;i<90;i++)stepSpaceFlight(state,1/60,null);
    expect(state.speed).toBe(0);
  });
  it('can assist to every world from each world without crossing its safety surface',()=>{
    for(const from of Object.values(SPACE_WORLDS))for(const id of Object.keys(SPACE_WORLDS) as WorldId[]){
      const state=createSpaceFlight();state.x=from.x;state.y=from.y+1;state.z=from.z-from.clearance-5;state.target=id;
      for(let i=0;i<60*80&&state.target;i++){
        stepSpaceFlight(state,1/60,null);
        for(const body of Object.values(SPACE_WORLDS))expect(Math.hypot(state.x-body.x,state.y-body.y,state.z-body.z)).toBeGreaterThanOrEqual(body.clearance-0.0001);
      }
      expect(state.target,`arrival at ${id} from ${from.z}`).toBeNull();
      expect(state.nearby).toBe(id);
    }
  });
  it('gives steering ownership back immediately and cancels assistance on suspension',()=>{
    const state=createSpaceFlight();state.target='mars';stepSpaceFlight(state,.05,{x:.5,y:0});expect(state.target).toBeNull();
    state.target='saturn';state.speed=4;stopSpaceFlight(state);expect(state.speed).toBe(0);expect(state.target).toBeNull();
  });
  it('guides around an intervening world instead of getting stuck against it',()=>{
    const state=createSpaceFlight();state.x=-7;state.y=0;state.z=-3;state.target='mars';
    for(let i=0;i<60*80&&state.target;i++)stepSpaceFlight(state,1/60,null);
    expect(state.target).toBeNull();expect(state.nearby).toBe('mars');
  });
  it('keeps time-based controls consistent across frame rates',()=>{
    const positions=[30,60,120].map(hz=>{const state=createSpaceFlight();for(let i=0;i<hz*3;i++)stepSpaceFlight(state,1/hz,{x:.25,y:0});return state;});
    expect(Math.abs(positions[0]!.yaw-positions[2]!.yaw)).toBeLessThan(.001);
    expect(Math.abs(positions[0]!.x-positions[2]!.x)).toBeLessThan(.2);
  });
});
