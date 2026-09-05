DROP-IN TEXTURES
================

The loader checks this folder at startup and automatically uses a real image when it
finds one, falling back to a generated placeholder for anything missing. No code
changes are needed when a file is added or replaced.

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
                         Earth, Moon, Mars, Saturn, Sun, and a star map. Available for
                         any purpose under CC BY 4.0 — credit "Solar System Scope".
                         This is the easiest one-stop source; grab the 2K versions.

  NASA Visible Earth     https://visibleearth.nasa.gov/collection/1484/blue-marble
                         The Blue Marble originals. Public domain. Very large files —
                         resize to 2048 wide before dropping them in here.

  NASA CGI Moon Kit      https://svs.gsfc.nasa.gov/4720
                         High quality Moon albedo map. Public domain.

  NASA PDS Cassini maps https://atmos.nmsu.edu/data_and_services/atmospheres_data/Cassini/sat_global_map.html
                         Derived, equirectangular global maps made from Cassini ISS
                         observations. DOI: 10.17189/rkkb-6y30.

  Poly Haven             https://polyhaven.com/hdris/space
                         Space HDRIs. Free (CC0). Convert to .jpg and rename to
                         starfield.jpg if you want to use one as the background.


AFTER ADDING FILES
------------------

Just reload the page. If a texture does not appear, open the browser console — the
loader logs one line per texture saying whether it used the real file or a placeholder.

Remember to credit any CC BY sources (like Solar System Scope) in the README. Its installed
textures are already credited there — add yours to the same list.


SATURN ASSET STATUS
-------------------

  saturn.jpg      Installed Solar System Scope 2K Saturn texture, 2048 x 1024 JPEG.
                  https://www.solarsystemscope.com/textures/download/2k_saturn.jpg
                  SHA-256: 54A900CA9BF7AB62E70F862852759ABDF342E6D6436A95A2FE9EBDB6BCD3BBAC

                  Solar System Scope describes the texture pack as based on NASA imagery
                  and says unmapped gaps are filled with corresponding fictional terrain;
                  its colours are also slightly saturated. It is therefore credited as a
                  visual reconstruction, not represented as a wholly observed photograph.
                  It replaces a fully generated fallback with an observation-grounded,
                  seamless map whose bands remain legible to a child.

                  The full 3601 x 1801 Cassini ISS RGB map in NASA's PDS was also downloaded,
                  converted and tested in the real scene. It is genuine and correctly
                  projected, but the rings blocked Cassini's view of broad latitude bands.
                  Those missing observations are black in the archive product and became
                  enormous black belts on the globe, so it was not shipped. Source checked:
                  Cassini ISS Global Maps of Jupiter and Saturn, DOI 10.17189/rkkb-6y30,
                  by Liming Li, Robert West, Xun Jiang and Benjamin Knowles.
                  https://atmos.nmsu.edu/PDS/data/PDS4/co_iss_global-maps/data_derived/

  saturn-rings.png
                  A radial transect through Cassini natural-colour mosaic PIA06175,
                  with observed brightness also used as alpha so the dark divisions
                  remain transparent. Resized to 1024 x 16; inner edge is left and
                  outer edge is right.
                  Credit: NASA/JPL/Space Science Institute.
                  https://science.nasa.gov/photojournal/panoramic-rings/
