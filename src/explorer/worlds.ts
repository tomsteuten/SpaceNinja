import { DESTINATIONS, type Discovery } from '../config';
import type { BodyId } from '../scene/Bodies';
import { WORLDS as CATALOGUE, shortLabel } from '../worlds/catalogue';
import { places as moonPlaces, type Place } from './places';
import { photoCredits } from './photoCredits';
import { radians, MIN_ALTITUDE, MAX_ALTITUDE } from './model';

export type WorldId = BodyId;
/** A place resolved against the discovery it is, so progress and narration share one id. */
export type WorldPlace = Place & { discovery: Discovery };
export interface ExplorerWorld {
  id: WorldId; label: string;
  places: readonly WorldPlace[]; orbital: boolean; minAltitude: number; maxAltitude: number; startAltitude: number;
  /** A sharper colour map (and relief) swapped onto the body the first time it is explored. */
  detail?: { color: string; relief?: string };
}
const names: Record<string,[string,string]> = {
  'earth-sahara':['Sahara desert','An ocean of sand'],
  'earth-amazon':['Amazon rainforest','Follow a winding river'],
  'earth-lakes':['Great Lakes','Five enormous lakes'],
  'earth-himalaya':['Himalayas','The tallest mountains'],
  'earth-reef':['Great Barrier Reef','A world beneath the water'],
  'earth-nightside':['Cities at night','See Earth after dark'],
  'moon-procellarum':['Ocean of Storms','A sea without water'],
  'moon-crisium':['Sea of Crises','A dark oval on the Moon'],
  'moon-farside':['The far side','See the hidden half'],
  'mars-olympus':['Olympus Mons','An enormous volcano'],
  'mars-marineris':['Valles Marineris','Fly along a giant canyon'],
  'mars-hellas':['Hellas basin','An ancient impact'],
  'mars-jezero':['Jezero crater','Where a helicopter flew'],
  'mars-gale':['Gale crater','A rover’s view'],
  'mars-elysium':['Elysium Mons','Another giant volcano'],
  'saturn-rings':['The rings','Ice and rock in orbit'],
  'saturn-hexagon':['The hexagon','A six-sided cloud'],
  'saturn-division':['Cassini Division','A gap in the rings'],
  'saturn-jet':['The jet stream','Very fast winds'],
  'saturn-bands':['Cloud bands','Stripes around a giant'],
  'saturn-storm':['The great storm','A storm seen by Cassini'],
};
const words: Record<string,string> = {
  'earth-sahara':'The Sahara is Earth’s biggest hot desert. Look how much of Africa it covers.',
  'earth-nightside':'This night-time satellite map shows the glow of towns and cities around Earth.',
  'moon-farside':'This NASA reconstruction uses LRO imagery to show the far side. Earth never sees this half of the Moon.',
  'mars-marineris':'This huge canyon system stretches for about 4,000 kilometres across Mars.',
  'mars-hellas':'A gigantic impact made this wide, deep basin long ago.',
  'mars-elysium':'Elysium Mons is another enormous Martian volcano. It rises far above the plains.',
  'saturn-hexagon':'Cassini photographed a six-sided cloud around Saturn’s north pole.',
  'saturn-jet':'These false colours help scientists see a fast jet stream in Saturn’s clouds.',
  'saturn-bands':'This infrared Cassini image reveals Saturn’s bands of clouds.',
  'saturn-storm':'These pictures follow a huge northern storm in 2010 and 2011. Saturn’s weather changes.',
};
function asPlace(discovery:Discovery, orbital=false):WorldPlace {
  const credit=photoCredits[discovery.id];
  if(!credit) throw new Error('Missing photograph provenance: '+discovery.id);
  const name=names[discovery.id];
  return {
    id:discovery.id,discovery,name:name?.[0]??discovery.name,description:name?.[1]??discovery.short,
    lat:radians(discovery.lat),lon:radians(discovery.lon),
    photo:'assets/discoveries/'+discovery.id+'.jpg',...credit,
    words:words[discovery.id]??discovery.short,orbital,
    // Saturn's rings and historical storms are archive subjects, not fixed ground locations.
    ...(orbital?{viewLat:radians(discovery.ring?30:discovery.id==='saturn-hexagon'?72:discovery.id==='saturn-storm'?35:discovery.lat),viewAltitude:discovery.ring?2.4:1.8}:{}),
  };
}
const discoveries=(id:WorldId)=>DESTINATIONS[id]!.mission.discoveries;
// Every place is keyed by its discovery id, so the journal and saved progress are shared with
// the classic adventure. The Moon's hand-written places keep their own words and photographs.
const lunar=discoveries('moon').map((d):WorldPlace=>{
  const special=moonPlaces.find(p=>'moon-'+p.id===d.id);
  return special?{...special,id:d.id,discovery:d}:asPlace(d);
});
const surface={orbital:false,minAltitude:MIN_ALTITUDE,maxAltitude:MAX_ALTITUDE,startAltitude:0.34};
// A ringed giant has no surface to fly over: its places are orbital views, held higher.
const orbital={orbital:true,minAltitude:1.4,maxAltitude:4.5,startAltitude:2.4};
/** What the explorer knows about a world beyond the catalogue: only the Moon's sharper maps. */
const extras:Partial<Record<string,Pick<ExplorerWorld,'places'|'detail'>>>={
  moon:{places:lunar,detail:{color:'moon-trial/moon-color.jpg',relief:'moon-trial/moon-relief.png'}},
};
// One explorer world per catalogue world, in catalogue order: a ringed world is orbital.
export const WORLDS:readonly ExplorerWorld[]=CATALOGUE.map((world):ExplorerWorld=>{
  const isOrbital=Boolean(world.rings);
  const id=world.id as WorldId;
  return {
    id,label:shortLabel(world),
    places:discoveries(id).map(d=>asPlace(d,isOrbital)),
    ...(isOrbital?orbital:surface),
    ...extras[world.id],
  };
});
/** A square crop of the place's own photograph (scripts/make-place-thumbnails.py). */
export function thumbnail(place:Place) { return 'assets/discoveries/thumbs/'+place.id+'.jpg'; }
export function worldById(id:WorldId) { return WORLDS.find(w=>w.id===id)!; }
export function placeView(place:Place,world:ExplorerWorld) {
  return {lat:place.viewLat??place.lat,lon:place.lon,altitude:place.viewAltitude??world.startAltitude};
}
