import { radians } from './model';
export interface Place {
  id:string; name:string; description:string; lat:number; lon:number;
  photo:string; credit:string; words:string; source:string; imageLabel:string;
  viewLat?:number; viewAltitude?:number; orbital?:boolean;
}
export const places: readonly Place[] = [
  { id: 'tycho', name: 'Tycho crater', description: 'Mountains inside a crater', lat: radians(-43.3), lon: radians(-11.4),
    photo: 'assets/moon-trial/tycho-mountains.jpg', credit: 'NASA / GSFC / Arizona State University / SVS',
    words: 'A mountain rises from the middle of this giant crater. Look at its long shadow!',
    source: 'https://svs.gsfc.nasa.gov/4220/', imageLabel: 'Real LRO photograph of the mountains inside Tycho crater' },
  { id: 'tranquility', name: 'Sea of Tranquility', description: 'Where people first walked', lat: radians(0.674), lon: radians(23.473),
    photo: 'assets/discoveries/moon-tranquility.jpg', credit: 'NASA / Buzz Aldrin',
    words: 'People walked on the Moon here. This is a real bootprint left in the soft lunar dust.',
    source: 'https://science.nasa.gov/resource/apollo-11-bootprint/', imageLabel: 'Apollo 11 bootprint photographed on the Moon' },
  { id: 'orientale', name: 'Orientale basin', description: 'A huge circle of mountains', lat: radians(-19.4), lon: radians(-92.8),
    photo: 'assets/discoveries/moon-orientale.jpg', credit: 'NASA / GSFC / Arizona State University',
    words: 'A huge impact made these circles of mountains. This close-up shows smaller craters nearby.',
    source: 'https://images.nasa.gov/details/PIA12999', imageLabel: 'LRO photograph of a crater chain in the Orientale region' },
];
