/** Shared picture identities for controls, titles and earned postcards. */
export function worldPicture(id: string): HTMLSpanElement {
  const picture = document.createElement('span');
  picture.className = `world-orb world-orb--${id}`;
  picture.setAttribute('aria-hidden', 'true');
  if (id !== 'sun') picture.style.backgroundImage = `url(./assets/${id}.jpg)`;
  return picture;
}

export function discoveryPicture(id: string): HTMLImageElement {
  const image = document.createElement('img');
  image.className = 'discovery-picture';
  image.alt = '';
  image.loading = 'lazy';
  image.src = `assets/discoveries/thumbs/${id}.jpg`;
  image.addEventListener('error', () => image.remove(), { once: true });
  return image;
}
