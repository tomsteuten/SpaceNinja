import * as THREE from 'three';
import { createExplorerRocket } from './rocket';
import { SPACE_WORLDS, type SpaceFlight } from './spaceModel';
import type { WorldId } from './worlds';

/** Compressed space playground; the same four worlds remain in view together. */
export function createSpaceScene(loadTexture:(file:string)=>Promise<THREE.Texture>) {
  const root=new THREE.Group();
  const rocket=createExplorerRocket();root.add(rocket.root);
  const geometries:THREE.BufferGeometry[]=[];
  const materials:THREE.Material[]=[];
  const ownG=<T extends THREE.BufferGeometry>(g:T)=>{geometries.push(g);return g;};
  const ownM=<T extends THREE.Material>(m:T)=>{materials.push(m);return m;};
  const sphere=ownG(new THREE.SphereGeometry(1,32,20));
  const colors={earth:0x69b7e8,moon:0xc8c6ba,mars:0xde825e,saturn:0xe5c58a};
  let disposed=false,loaded=false;
  const maps: { id:WorldId;material:THREE.MeshStandardMaterial }[]=[];
  for(const [key,body] of Object.entries(SPACE_WORLDS)) {
    const id=key as WorldId;
    const material=ownM(new THREE.MeshStandardMaterial({color:colors[id],roughness:1}));
    const globe=new THREE.Mesh(sphere,material);
    globe.position.set(body.x,body.y,body.z);globe.scale.setScalar(body.radius);root.add(globe);
    maps.push({id,material});
    if(id==='saturn') {
      const rings=new THREE.Mesh(ownG(new THREE.RingGeometry(3.9,6.9,64)),ownM(new THREE.MeshStandardMaterial({color:0xdcc494,side:THREE.DoubleSide,roughness:1})));
      rings.rotation.x=-1.12;rings.position.copy(globe.position);root.add(rings);
    }
  }
  // Sparse rocks give nearby parallax and a place to wander, without a hazard or score.
  const rocks=new THREE.InstancedMesh(ownG(new THREE.IcosahedronGeometry(1,0)),ownM(new THREE.MeshStandardMaterial({color:0x8e8b9d,roughness:1})),28);
  const dummy=new THREE.Object3D();
  for(let i=0;i<28;i++) {
    const angle=i*2.39996;
    dummy.position.set(Math.cos(angle)*(11+i%4),Math.sin(angle)*4-2,17+Math.sin(i*1.9)*8);
    dummy.scale.set(0.18+(i%3)*0.11,0.12+(i%4)*0.08,0.23+(i%2)*0.13);
    dummy.rotation.set(i*0.7,i*1.3,i*0.4);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);
  }
  root.add(rocks);
  const position=new THREE.Vector3(),forward=new THREE.Vector3(),desiredCamera=new THREE.Vector3(),look=new THREE.Vector3();
  let cameraReady=false;
  return {
    root,
    enter() {
      cameraReady=false;
      if(loaded)return;loaded=true;
      for(const {id,material} of maps)void loadTexture(`explorer/${id}.jpg`).then(texture=>{
        if(disposed)return;material.map=texture;material.color.set(0xffffff);material.needsUpdate=true;
      }).catch(()=>{/* The coloured globe stays usable offline if a thumbnail is unavailable. */});
    },
    render(state:SpaceFlight,camera:THREE.PerspectiveCamera,dt:number,reduced:boolean) {
      position.set(state.x,state.y,state.z);
      forward.set(Math.sin(state.yaw)*Math.cos(state.pitch),Math.sin(state.pitch),Math.cos(state.yaw)*Math.cos(state.pitch));
      rocket.root.position.copy(position);rocket.root.scale.setScalar(0.72);
      rocket.root.up.set(0,1,0);rocket.root.lookAt(look.copy(position).add(forward));
      rocket.update(Math.min(1,state.speed/5),state.bank,reduced);
      desiredCamera.copy(position).addScaledVector(forward,-4.2);desiredCamera.y+=1.5;
      camera.position.lerp(desiredCamera,!cameraReady||reduced?1:1-Math.exp(-dt*6));
      look.copy(position).addScaledVector(forward,5);look.y+=0.45;
      camera.up.set(0,1,0);camera.lookAt(look);cameraReady=true;
    },
    dispose(){disposed=true;rocket.dispose();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();},
  };
}
