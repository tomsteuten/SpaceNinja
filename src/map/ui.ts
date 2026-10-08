import { createIcon } from '../ui/icons';
import { worldPicture } from '../ui/pictures';
import { availability, companionPages, NEIGHBORHOODS, pageIndex, type MapPlace, type createMapModel } from './model';
import './map.css';

export function createMapUI(root: HTMLElement, model: ReturnType<typeof createMapModel>, options: {
  revealed(): readonly string[]; prerequisite(id: string): string | undefined;
  choose(place: MapPlace): void; browse(step: number): void; moreMoons(): void;
}) {
  function node<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text = '') {
    const result = document.createElement(tag); result.className = cls; result.textContent = text; return result;
  }
  const container = node('section','neighborhood-map');
  container.setAttribute('aria-label','Neighborhood space map');
  const heading = node('header','map-heading');
  const title = node('h1','map-title');
  const instruction = node('p','map-instruction'); instruction.setAttribute('role','status');
  heading.append(node('span','map-eyebrow','SPACE MAP'),title,instruction);
  const preview = node('button','map-preview'); preview.type = 'button';
  preview.setAttribute('aria-disabled','true');
  preview.addEventListener('click',() => options.choose(model.neighborhood.places[0]!));
  const dock = node('nav','map-tray'); dock.setAttribute('aria-label','Neighborhood travel');
  function arrow(direction: -1 | 1) {
    const button = node('button',`map-page map-page--${direction === 1 ? 'next' : 'previous'}`);
    button.type = 'button';
    const chevron = node('span','map-chevron',direction === 1 ? '›' : '‹'); chevron.setAttribute('aria-hidden','true');
    const name = node('span','map-page-label'); button.append(chevron,name);
    button.addEventListener('click',() => options.browse(direction)); return { button,name };
  }
  const previous = arrow(-1), next = arrow(1);
  const destinations = node('div','map-destinations');
  const foot = node('div','map-tray-foot');
  const position = node('span','map-position'); position.setAttribute('aria-hidden','true');
  const moons = node('button','map-more-moons'); moons.type = 'button';
  moons.addEventListener('click',options.moreMoons);
  foot.append(position,moons); dock.append(previous.button,destinations,next.button,foot);
  container.append(heading,preview,dock); root.append(container); root.classList.add('has-neighborhood-map');
  function picture(place: MapPlace) {
    if (place.body) return worldPicture(place.body);
    const orb = node('span','map-fixture-orb'); orb.setAttribute('aria-hidden','true');
    orb.style.setProperty('--orb-color',place.color); return orb;
  }
  function render() {
    const revealed = options.revealed(), n = model.neighborhood, primary = n.places[0]!;
    const state = availability(primary,revealed);
    title.textContent = n.title; container.dataset.neighborhood = n.id;
    instruction.textContent = state === 'ready' ? 'Tap a world to fly there' : state === 'locked'
      ? `Visit ${options.prerequisite(primary.id)} first` : 'Coming later · keep exploring the map';
    previous.name.textContent = NEIGHBORHOODS[pageIndex(model.index,-1)]!.places[0]!.label;
    next.name.textContent = NEIGHBORHOODS[pageIndex(model.index,1)]!.places[0]!.label;
    previous.button.setAttribute('aria-label',`Previous neighborhood: ${previous.name.textContent}`);
    next.button.setAttribute('aria-label',`Next neighborhood: ${next.name.textContent}`);
    position.replaceChildren(...NEIGHBORHOODS.map((_,i) => { const dot = node('span',''); dot.classList.toggle('is-current',i === model.index); return dot; }));
    moons.hidden = companionPages(n) === 1;
    moons.textContent = `More moons ${model.companionPage+1}/${companionPages(n)} ›`;
    preview.hidden = state === 'ready';
    preview.setAttribute('aria-label',`Preview ${primary.label}: ${state === 'locked' ? 'locked' : 'coming later'}`);
    const previewLabel = node('span','map-preview-label');
    previewLabel.append(createIcon(state === 'locked' ? 'lock' : 'construction'),document.createTextNode(state === 'locked' ? 'Visit to unlock' : 'Coming later'));
    preview.replaceChildren(picture(primary),previewLabel);
    destinations.replaceChildren(...model.places.map(place => {
      const state = availability(place,revealed), button = node('button','map-destination'); button.type = 'button';
      button.dataset.destination = place.id; button.dataset.availability = state;
      button.setAttribute('aria-label',state === 'ready' ? `Fly to ${place.label}` : state === 'locked'
        ? `${place.label} — visit ${options.prerequisite(place.id)} first` : `${place.label} — coming later`);
      if (state !== 'ready') button.setAttribute('aria-disabled','true');
      button.append(picture(place),node('span','',place.label));
      if (state !== 'ready') button.append(createIcon(state === 'locked' ? 'lock' : 'construction'));
      button.addEventListener('click',() => options.choose(place)); return button;
    }));
    destinations.dataset.count = String(model.places.length);
  }
  let inset = .3, offset = 0;
  function measure() {
    const top = heading.getBoundingClientRect().bottom+18, bottom = dock.getBoundingClientRect().top-20;
    if (bottom <= top) return;
    inset = 1-(bottom-top)/innerHeight; offset = innerHeight/2-(top+bottom)/2;
  }
  const observer = new ResizeObserver(measure); observer.observe(dock); observer.observe(heading);
  return {
    render,measure, get inset() { return inset; }, get offset() { return offset; },
    setActive(active: boolean) { container.hidden = !active; },
    feedback(text: string) { instruction.textContent = text; },
    dispose() { observer.disconnect(); container.remove(); root.classList.remove('has-neighborhood-map'); },
  };
}
