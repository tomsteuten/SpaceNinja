import * as THREE from 'three';
import { TEACHING_SUN_RADIUS, TEACHING_SUN_GLOW_RADIUS } from './dayTurnFraming';

export interface TeachingSun {
  readonly group: THREE.Group;
  show(position: THREE.Vector3, scale: number, opacity: number): void;
  hide(): void;
  dispose(): void;
}

/** Shares the world's textures, which remain owned and disposed by Bodies. Two draw calls. */
export function createTeachingSun(
  sunMap: THREE.Texture,
  glowMap: THREE.Texture,
  onVisible: (visible: boolean) => void = () => {},
): TeachingSun {
  const group = new THREE.Group();
  group.visible = false;
  const discMaterial = new THREE.MeshBasicMaterial({ map: sunMap, transparent: true, fog: false });
  discMaterial.color.setRGB(1.4, 1.1, 0.75);
  const disc = new THREE.Mesh(new THREE.SphereGeometry(TEACHING_SUN_RADIUS, 24, 16), discMaterial);
  const glowMaterial = new THREE.SpriteMaterial({ map: glowMap, transparent: true,
    depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  glowMaterial.color.setRGB(0.9, 0.55, 0.2);
  const glow = new THREE.Sprite(glowMaterial);
  glow.scale.setScalar(TEACHING_SUN_GLOW_RADIUS * 2);
  group.add(disc, glow);
  return {
    group,
    show(position, scale, opacity) {
      group.position.copy(position);
      group.scale.setScalar(scale);
      group.visible = opacity > 0;
      onVisible(group.visible);
      discMaterial.opacity = opacity;
      glowMaterial.opacity = opacity;
    },
    hide() { group.visible = false; onVisible(false); },
    dispose() {
      group.visible = false;
      onVisible(false);
      group.removeFromParent();
      disc.geometry.dispose();
      discMaterial.dispose();
      glowMaterial.dispose();
    },
  };
}
