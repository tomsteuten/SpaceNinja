DROP-IN TEXTURES
================

The game runs right now with procedurally generated placeholder textures, so you do
not need any of these files. Add them whenever you like: the loader checks this folder
at startup and automatically uses a real image if it finds one. No code changes needed.

Put the files directly in this folder (public/assets/) using these EXACT names:


  earth.jpg       Equirectangular Earth day map (continents, oceans, clouds baked in).
                  Recommended: 2048 x 1024. Anything wider is rescaled to 2048 in the
                  browser before it reaches the GPU, so a 21600 x 10800 Blue Marble
                  original gives you a console warning and a slow load rather than a
                  dead tab — but resize it and save everyone the download.

  earth-roughness.jpg
                  OPTIONAL, and you almost certainly do not need it. Supply earth.jpg
                  alone and the roughness map is derived from it automatically: blue,
                  not-too-bright pixels become sea and catch the specular highlight,
                  everything else stays matte. Only add this file if you want to
                  override that. Do NOT expect the generated Earth's roughness map to
                  pair with a real photo — it is cut from the same noise field as the
                  generated *colour* map, so it describes continents that are not there.

  earth-night.jpg OPTIONAL. City lights, shown on the night side only — the emissive
                  term is masked by the Sun direction, so nothing bleeds onto the
                  daylit half. Absent simply means the night side stays dark.
                  Recommended: 2048 x 1024, and it must line up with earth.jpg.

  moon.jpg        Equirectangular Moon surface map.
                  Recommended: 2048 x 1024.

  mars.jpg        Equirectangular Mars surface map.
                  Recommended: 2048 x 1024.

  saturn.jpg      Equirectangular Saturn map — the banded gold clouds. No rings in this
                  one; the rings are a separate file below.
                  Recommended: 2048 x 1024.

  saturn-rings.png
                  The rings, as a strip that runs INNER edge (left) to OUTER edge (right)
                  along its width. This is the one PNG in the list, and it has to be:
                  the rings need transparency, both for the gaps (the dark Cassini
                  Division, the space between the planet and the inner edge) and so stars
                  show through. A tall thin strip is fine — all the structure is across
                  the width; height barely matters. The loader rewrites the ring mesh's
                  UVs so the width maps across the radius, which THREE does not do on its
                  own. Recommended: 1024 x 16 (or taller). Absent gives generated rings.

  sun.jpg         Sun surface / granulation map. Optional — the placeholder Sun is a
                  glowing emissive sphere and already looks good.
                  Recommended: 1024 x 512.

  starfield.jpg   Equirectangular night-sky panorama, ADDED over the violet gradient
                  rather than replacing it — a star map is nearly all black, so the
                  gradient still supplies the colour and depth underneath and the
                  generated points thin out to a sparse layer in front.
                  Recommended: 4096 x 2048, or 2048 x 1024 for older tablets.
                  Optional — without it you get a generated 3D particle starfield,
                  which is cheaper and honestly quite pretty.


IMPORTANT: the sphere maps must be equirectangular (2:1 width:height) or they will smear
across the spheres. Use .jpg — .png files of this size are several times larger to
download. The one exception is saturn-rings.png, which is a radial strip (not a sphere
map) and needs .png for its transparency.


WHERE TO GET THEM
-----------------

  Solar System Scope     https://www.solarsystemscope.com/textures/
                         Earth, Moon, Sun, and a star map. Free for personal and
                         educational use under CC BY 4.0 — credit "Solar System Scope".
                         This is the easiest one-stop source; grab the 2K versions.

  NASA Visible Earth     https://visibleearth.nasa.gov/collection/1484/blue-marble
                         The Blue Marble originals. Public domain. Very large files —
                         resize to 2048 wide before dropping them in here.

  NASA CGI Moon Kit      https://svs.gsfc.nasa.gov/4720
                         High quality Moon albedo map. Public domain.

  Poly Haven             https://polyhaven.com/hdris/space
                         Space HDRIs. Free (CC0). Convert to .jpg and rename to
                         starfield.jpg if you want to use one as the background.


AFTER ADDING FILES
------------------

Just reload the page. If a texture does not appear, open the browser console — the
loader logs one line per texture saying whether it used the real file or a placeholder.

Remember to credit any CC BY sources (like Solar System Scope) in the README. earth.jpg
is already credited there — add yours to the same list.
