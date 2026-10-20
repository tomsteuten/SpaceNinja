import * as THREE from 'three';

/** A small toy survey rocket. Authored nose is +Z; no textures or extra lights. */
export function createExplorerRocket() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const geometry = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const paint = (color: number, metalness = 0.1) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness });
    materials.add(material); return material;
  };
  const cream = paint(0xffefd3), orange = paint(0xff7146), navy = paint(0x193855);
  const glass = paint(0x44d9ef, 0.45), gold = paint(0xffd16b);
  const glow = new THREE.MeshBasicMaterial({ color: 0x94f4ff }); materials.add(glow);
  const sphere = new THREE.SphereGeometry(1, 16, 10); geometry.add(sphere);
  function ellipsoid(material: THREE.Material, scale: number[], position: number[]) {
    const mesh = new THREE.Mesh(sphere, material);
    mesh.scale.set(scale[0]!, scale[1]!, scale[2]!);
    mesh.position.set(position[0]!, position[1]!, position[2]!); body.add(mesh); return mesh;
  }
  ellipsoid(cream, [0.22, 0.17, 0.53], [0, 0, 0]);
  ellipsoid(orange, [0.19, 0.15, 0.22], [0, 0, 0.36]);
  ellipsoid(navy, [0.15, 0.09, 0.23], [0, 0.145, 0.09]);
  ellipsoid(glass, [0.115, 0.07, 0.18], [0, 0.19, 0.12]);
  // Swept, rounded outriggers make direction legible even on a small screen.
  const flames: THREE.Mesh[] = [];
  for (const side of [-1, 1]) {
    const fin = ellipsoid(orange, [0.28, 0.035, 0.20], [side * 0.25, -0.015, -0.22]);
    fin.rotation.y = side * -0.5;
    ellipsoid(cream, [0.09, 0.095, 0.25], [side * 0.34, 0, -0.28]);
    ellipsoid(navy, [0.075, 0.08, 0.07], [side * 0.34, 0, -0.50]);
    flames.push(ellipsoid(glow, [0.052, 0.056, 0.08], [side * 0.34, 0, -0.59]));
  }
  const tail = ellipsoid(orange, [0.035, 0.19, 0.18], [0, 0.13, -0.33]);
  tail.rotation.x = -0.3;
  ellipsoid(gold, [0.065, 0.022, 0.07], [0, 0.17, -0.17]);
  return {
    root,
    update(throttle: number, bank: number, reduced: boolean) {
      body.rotation.z = reduced ? 0 : -THREE.MathUtils.clamp(bank, -1, 1) * 0.32;
      for (const flame of flames) {
        flame.scale.z = 0.04 + throttle * 0.24;
        flame.position.z = -0.55 - flame.scale.z * 0.7;
        flame.visible = throttle > 0.015;
      }
    },
    dispose() { for (const g of geometry) g.dispose(); for (const m of materials) m.dispose(); },
  };
}
