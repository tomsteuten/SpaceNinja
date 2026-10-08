import type { BodyId } from '../scene/Bodies';

export interface MapPlace { id: string; label: string; body?: BodyId; color: string }
export interface Neighborhood { id: string; title: string; places: readonly MapPlace[]; scene: readonly BodyId[] }
const p = (id: string, label: string, color: string, body?: BodyId): MapPlace => ({ id, label, color, body });
/** Presentation fixtures only: these IDs never enter the catalogue or progress. */
export const NEIGHBORHOODS: readonly Neighborhood[] = [
  { id:'mercury', title:'Mercury', scene:[], places:[p('mercury','Mercury','#aaa59c')] },
  { id:'venus', title:'Venus', scene:[], places:[p('venus','Venus','#dfb983')] },
  { id:'earth', title:'Earth & Moon', scene:['earth','moon'], places:[p('earth','Earth','#6daac4','earth'),p('moon','Moon','#bfc3c8','moon'),p('sun','Sun','#ffd279','sun')] },
  { id:'mars', title:'Mars', scene:['mars'], places:[p('mars','Mars','#cf9478','mars')] },
  { id:'jupiter', title:'Jupiter & moons', scene:[], places:[p('jupiter','Jupiter','#d4b18e'),p('io','Io','#dcce83'),p('europa','Europa','#d5c8ae'),p('ganymede','Ganymede','#aca69a'),p('callisto','Callisto','#8e8a84')] },
  { id:'saturn', title:'Saturn & Titan', scene:['saturn'], places:[p('saturn','Saturn','#d9c396','saturn'),p('titan','Titan','#d4a45f')] },
  { id:'uranus', title:'Uranus', scene:[], places:[p('uranus','Uranus','#a3d6d9')] },
  { id:'neptune', title:'Neptune', scene:[], places:[p('neptune','Neptune','#729dcc')] },
  { id:'dwarfs', title:'Small worlds', scene:[], places:[p('pluto','Pluto','#c7aaa0'),p('ceres','Ceres','#a5a2a1'),p('eris','Eris','#d2d2cc')] },
];
export function availability(place: MapPlace, revealed: readonly string[]): 'ready' | 'locked' | 'unbuilt' {
  return !place.body ? 'unbuilt' : revealed.includes(place.body) ? 'ready' : 'locked';
}
export function pageIndex(index: number, step: number, count = NEIGHBORHOODS.length): number {
  return ((index + step) % count + count) % count;
}
export function companionPages(n: Neighborhood): number { return Math.max(1, Math.ceil((n.places.length - 1) / 2)); }
export function visiblePlaces(n: Neighborhood, page: number): readonly MapPlace[] {
  return [n.places[0]!, ...n.places.slice(1 + page * 2, 3 + page * 2)];
}
export function createMapModel() {
  let index = NEIGHBORHOODS.findIndex(n => n.id === 'earth'), companions = 0;
  return {
    get index() { return index; },
    get neighborhood() { return NEIGHBORHOODS[index]!; },
    get companionPage() { return companions; },
    get places() { return visiblePlaces(NEIGHBORHOODS[index]!, companions); },
    move(step: number) { index = pageIndex(index, step); companions = 0; },
    moreMoons() { companions = pageIndex(companions, 1, companionPages(NEIGHBORHOODS[index]!)); },
  };
}
