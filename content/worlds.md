# World content

The source for every new world (DECISIONS.md, line 9). Building a world means filling the
template from its section here: places into `DESTINATIONS` in `src/config.ts`, the map into
`public/assets/`, photographs into `public/assets/discoveries/` with their credit lines in its
`README.txt`, and cues into `src/audio/narration-script.json`.

## Conventions

- **Three places, one set** (`mission.singleSet`), in the order listed. The **last place is
  the hidden one**, reached by dragging. Every set below passes `isPlayableSet` at the stated
  radius (checked 15 October 2026; re-check if a radius changes).
- **Longitude** is east-positive, −180 to 180, as in `src/config.ts` (Olympus Mons is −133.8).
  Most moon and Mercury sources use west longitude; both values are given.
- **Latitude** must stay within ±55° (`POLE_GUARD`): polar lakes, caps and hexagons cannot be
  places.
- **Kind:** *surface* is real ground; *cloud* is an atmospheric feature (giants only, per
  DECISIONS.md line 5); *ring* sits on the ring plane and can never be the hidden one.
- **Giant longitudes are map-relative.** Cloud features drift, so a giant's longitudes are set
  at build time to sit on the feature as drawn in the shipped map, keeping the two in-view
  places within 72° of their mean and at least 17° apart, and the hidden one 72–132° from it.
  Latitudes are real.
- **Maps** must be registered the same way as the shipped `mars.jpg`: check with a known
  feature before shipping. USGS mosaics are often centred on 180°.
- **Photos** are real mission images; take the credit line exactly as printed on the source
  page when downloading. JunoCam images processed by citizen scientists name them in the
  credit. Coloured mosaics marked *enhanced colour* are not what an eye would see.
- **Radii** are true to life (in Earth radii) below about two Earth radii; giants are
  compressed like Saturn (1.5). Ceres (0.074) may need lifting for tapping; decide at build.

### How this was verified

The Gazetteer of Planetary Nomenclature (planetarynames.wr.usgs.gov), NASA, JPL and Wikipedia
could not be opened directly from the build environment. Every value below was cross-checked
by web search against the cited page (gazetteer entries, Photojournal captions, Wikipedia
infoboxes that cite the gazetteer, and papers). Where sources disagree, the conflict is noted
and the better-supported value is used. **Before downloading assets, re-open each cited
source page and confirm the credit line.**

### Cues each world needs

From `cuesByBody()` and `SCREEN_CUES` in `src/audio/narration-script.test.ts`. Every new world
has a mission, a day/night spin with an invitation, and a reveal gate, so each needs:

`arrival-<id>`, `find-<id>`, `discovery-<place>` ×3, `hunt-<id>`, `success-<id>`,
`spin-<id>`, `spin-invite-<id>`, `home-<id>`, `home-nudge-<id>`, `home-nudge-short-<id>`,
`locked-<id>`, `revealed-<id>`: **14 cues per world**, 168 in all. No new shared screen cues.

---

## Mercury

| | |
|---|---|
| id | `mercury` |
| page | Inner planets |
| radius | 0.383 (true) |
| map | USGS *Mercury MESSENGER MDIS Global Basemap BDR 166m* (grey, like Mercury looks). Credit NASA/Johns Hopkins University Applied Physics Laboratory/Carnegie Institution of Washington; USGS Astrogeology. [source](https://astrogeology.usgs.gov/search/map/mercury_messenger_mdis_global_basemap_bdr_166m) |

| # | id | name | kind | lat | lon (E) | source coords | child fact | photo |
|---|---|---|---|---|---|---|---|---|
| 1 | `mercury-rachmaninoff` | The Ring Inside a Ring | surface | 27.6 | 57.6 | 27.6°N 302.4°W ([Wikipedia](https://en.wikipedia.org/wiki/Rachmaninoff_(crater)); MESSENGER gives 27.67°N 57.44°E) | A giant crater with a second ring of mountains inside it, and a floor once flooded by lava. | [PIA15049](https://photojournal.jpl.nasa.gov/catalog/PIA15049) |
| 2 | `mercury-caloris` | The Giant Splash | surface | 30.5 | 161.2 | 30.5°N 198.8°W ([Wikipedia](https://en.wikipedia.org/wiki/Caloris_Planitia); MESSENGER gives 31°N 163°E) | One of the biggest craters anywhere, about 1,550 km across, made when a huge space rock hit Mercury long ago. | [PIA19216](https://photojournal.jpl.nasa.gov/catalog/PIA19216) (enhanced colour) |
| 3 | `mercury-debussy` | The Splash Marks | surface | −33.9 | 12.5 | 33.9°S 347.5°W ([Wikipedia ray-crater list](https://en.wikipedia.org/wiki/List_of_craters_with_ray_systems); gazetteer entry not seen) | A young crater whose bright rays stretch hundreds of kilometres across Mercury, like splash marks. | [PIA13471](https://photojournal.jpl.nasa.gov/catalog/PIA13471) |

Day/night: a Mercury solar day lasts about 176 Earth days. Confirm the figure when writing
the spin fact.

## Venus

| | |
|---|---|
| id | `venus` |
| page | Inner planets |
| radius | 0.95 (true) |
| map | USGS *Venus Magellan Global C3-MDIR Mosaic 2025m* (radar). Credit NASA/JPL; PDS Geosciences Node; USGS Astrogeology. [source](https://astrogeology.usgs.gov/search/map/venus_magellan_global_c3_mdir_mosaic_2025m) |

**Honesty note:** to the eye, Venus is a pale, featureless cloud ball. The map is radar
"seeing through" the clouds, which is how its places are known. The arrival fact must say so:
thick clouds hide the ground, and the Magellan spacecraft used radar to map it.

| # | id | name | kind | lat | lon (E) | source coords | child fact | photo |
|---|---|---|---|---|---|---|---|---|
| 1 | `venus-aphrodite` | The Huge Highland | surface | −5.8 | 104.8 | 5.8°S 104.8°E ([Wikipedia](https://en.wikipedia.org/wiki/Aphrodite_Terra); [Britannica](https://www.britannica.com/place/Aphrodite-Terra) extent 10°N–20°S, 60–150°E) | A high land so big it would cover a whole continent on Earth. | [PIA00146](https://photojournal.jpl.nasa.gov/catalog/PIA00146) (Ovda Regio, western Aphrodite) |
| 2 | `venus-mead` | The Biggest Crater | surface | 12.5 | 57.2 | 12.5°N 57.2°E ([Wikipedia](https://en.wikipedia.org/wiki/Mead_(crater)); NASA caption 57.4°E) | The biggest crater on Venus, about 270 km across. | [PIA00148](https://photojournal.jpl.nasa.gov/catalog/PIA00148) |
| 3 | `venus-maat` | The Tallest Volcano | surface | 0.5 | −165.4 | 0.5°N 194.6°E ([Wikipedia](https://en.wikipedia.org/wiki/Maat_Mons); NASA captions 0.9°N 194.5°E) | Venus's tallest volcano, about 8 km high, nearly as tall as Mount Everest. | [PIA00254](https://www.jpl.nasa.gov/images/pia00254-venus-3-d-perspective-view-of-maat-mons) **(3-D perspective from radar data with exaggerated height; prefer a flat Magellan view if one exists)** |

Day/night: Venus spins backwards, and its day is longer than its year. Confirm the figures
when writing the spin fact.

## Jupiter

| | |
|---|---|
| id | `jupiter` |
| page | Jupiter & moons |
| radius | compressed; larger than Saturn's 1.5 (decide in Wave 2) |
| visit | giant: orbital/cloud places only, needing its own capability (not `rings`) |
| map | [PIA07782](https://photojournal.jpl.nasa.gov/catalog/PIA07782) *Cassini's Best Maps of Jupiter: Cylindrical Map*, 3601×1801, from images of 11–12 December 2000. Credit NASA/JPL/Space Science Institute. Oval BA formed in March 2000, so it is drawn. |

| # | id | name | kind | lat | lon (E) | source | child fact | photo |
|---|---|---|---|---|---|---|---|---|
| 1 | `jupiter-belts` | The Stripes | cloud | 12 | map-relative (bands circle the planet, so pick any longitude that satisfies the rule) | North Equatorial Belt ≈ 7–17°N planetographic ([Rogers et al.](https://arxiv.org/pdf/1707.03343)) | Brown belts and white zones of cloud, each racing around Jupiter at its own speed. | [PIA04866](https://www.jpl.nasa.gov/images/pia04866-cassini-jupiter-portrait/) Cassini portrait |
| 2 | `jupiter-oval-ba` | Red Spot Junior | cloud | −33 | map-relative: on the drawn oval | 33–34°S ([Sky & Telescope](https://skyandtelescope.org/astronomy-news/jupiters-new-red-spot/); [ScienceDaily](https://www.sciencedaily.com/releases/2006/05/060504175855.htm)) | A storm about as wide as Earth, made in 2000 when three smaller storms bumped together. | [PIA22942](https://photojournal.jpl.nasa.gov/catalog/PIA22942) (JunoCam; NASA/JPL-Caltech/SwRI/MSSS/Gerald Eichstädt/Seán Doran) |
| 3 | `jupiter-red-spot` | The Great Red Spot | cloud | −22 | map-relative: on the drawn spot | 22°S ([Great Red Spot](https://dlab.epfl.ch/wikispeedia/wpcd/wp/g/Great_Red_Spot.htm)) | A giant storm wider than the whole Earth, which has been swirling for well over a hundred years. | [PIA21775](https://photojournal.jpl.nasa.gov/catalog/PIA21775) (JunoCam true colour; NASA/JPL-Caltech/SwRI/MSSS/Björn Jónsson) |

Width check: the Great Red Spot is about 15,800 km across and Earth is 12,742 km
([Universe Today](https://www.universetoday.com/articles/big-great-red-spot)).
Day/night: about ten hours, like Saturn.

## Io

| | |
|---|---|
| id | `io` |
| page | Jupiter & moons, parent `jupiter` |
| radius | 0.286 (true) |
| map | USGS *Io Galileo SSI / Voyager Color Merged Global Mosaic 1km*, public domain. Credit NASA/JPL/USGS. [source](https://astrogeology.usgs.gov/search/map/io_galileo_ssi_voyager_color_merged_global_mosaic_1km) |

| # | id | name | kind | lat | lon (E) | source coords | child fact | photo |
|---|---|---|---|---|---|---|---|---|
| 1 | `io-loki` | The Lava Lake | surface | 13.0 | 51.2 | 13°N 308.8°W ([Wikipedia](https://en.wikipedia.org/wiki/Loki_Patera); [Matson 2006](https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2006JE002703) 12.6°N 309.9°W) | A lake of lava about 200 km across, bigger than the island of Hawaiʻi. ([USGS](https://www.usgs.gov/center-news/volcano-watch-active-lava-lakes-are-found-beyond-earth)) | [PIA03530](https://photojournal.jpl.nasa.gov/catalog/PIA03530) |
| 2 | `io-pele` | The Red Ring | surface | −18.7 | 104.7 | 18.7°S 255.3°W ([Wikipedia](https://en.wikipedia.org/wiki/Pele_(volcano))) | A volcano that throws sulfur more than 300 km high, painting a red ring around itself. | [PIA02510](https://photojournal.jpl.nasa.gov/catalog/PIA02510) *Pele's Glow* |
| 3 | `io-prometheus` | Old Faithful | surface | −1.52 | −153.94 | 1.52°S 153.94°W (Wikidata/Commons; [USGS](https://www.usgs.gov/publications/heartbeat-volcano-discovery-episodic-activity-prometheus-io)) | A volcano that was puffing out a plume every time a spacecraft could see it. | [PIA02505](https://photojournal.jpl.nasa.gov/catalog/PIA02505) (confirm title on download) |

The hidden place sits 128° from the in-view pair, near the 132° limit. It is legal, but it
is the longest drag in the game.

## Europa

| | |
|---|---|
| id | `europa` |
| page | Jupiter & moons, parent `jupiter` |
| radius | 0.245 (true) |
| map | USGS *Europa Voyager / Galileo* global image mosaic (500 m/pixel source), public domain. Credit NASA/JPL/USGS. [source](https://astrogeology.usgs.gov/search/map/europa_voyager_galileo_global_image_mosaic_map) |

| # | id | name | kind | lat | lon (E) | source coords | child fact | photo |
|---|---|---|---|---|---|---|---|---|
| 1 | `europa-tyre` | The Bullseye | surface | 33.6 | −146.6 | 33.6°N 146.6°W ([gazetteer 6170](https://planetarynames.wr.usgs.gov/Feature/6170) via search; [Wikipedia](https://en.wikipedia.org/wiki/Tyre_(Europa))) | A crater with rings around it like a target, about 150 km across. The ice cracked in circles when something hit it. | [PIA01633](https://photojournal.jpl.nasa.gov/catalog/PIA01633) |
| 2 | `europa-thera` | The Hidden Lake | surface | −46.7 | 178.8 | 46.7°S 181.2°W ([gazetteer 5967](https://planetarynames.wr.usgs.gov/Feature/5967) via search) | Scientists think a lake of water may be hiding inside the ice under this dark patch. ([Schmidt et al. 2011](https://www.jsg.utexas.edu/news/2011/11/scientists-find-evidence-for-great-lake-on-europa/)) | [PIA00875](https://photojournal.jpl.nasa.gov/catalog/PIA00875) |
| 3 | `europa-conamara` | The Ice Rafts | surface | 9.7 | 87.3 | 9.7°N 272.7°W ([Wikipedia](https://en.wikipedia.org/wiki/Conamara_Chaos)) | Blocks of ice that broke apart, drifted and froze again: a clue that there is an ocean under Europa's ice. | [PIA01407](https://photojournal.jpl.nasa.gov/catalog/PIA01407) |

Pwyll crater was considered but sits 1° of longitude from Conamara, so the two cannot share a
visit.

## Ganymede

| | |
|---|---|
| id | `ganymede` |
| page | Jupiter & moons, parent `jupiter` |
| radius | 0.413 (true) |
| map | USGS *Ganymede Voyager / Galileo SSI Global Mosaic 1km*, public domain. Credit NASA/JPL/USGS. [source](https://astrogeology.usgs.gov/search/map/ganymede_voyager_galileo_ssi_global_mosaic_1km) |

| # | id | name | kind | lat | lon (E) | source coords | child fact | photo |
|---|---|---|---|---|---|---|---|---|
| 1 | `ganymede-galileo-regio` | The Dark Old Land | surface | 47.0 | −129.6 | 47°N 129.6°W ([Wikipedia](https://en.wikipedia.org/wiki/Galileo_Regio)) | A dark, very old land about 4,400 km across, covered in craters. | [PIA00278](https://pds-rings.seti.org/press_releases/pages/PIA00xxx/PIA00278.html) |
| 2 | `ganymede-tros` | The Bright Splash | surface | 11.1 | −27.3 | 11.1°N 27.3°W ([Wikipedia](https://en.wikipedia.org/wiki/Tros_(crater))) | A young crater that splashed clean, bright ice out in rays all around it. | **Unresolved:** a Juno Perijove 34 JunoCam view (June 2021) shows Tros; find its PIA number. Voyager [PIA01516](https://photojournal.jpl.nasa.gov/catalog/PIA01516) does not name Tros. |
| 3 | `ganymede-uruk` | The Grooves | surface | 3.4 | −160.0 | 3.4°N 160°W (gazetteer via search; [Wikipedia](https://en.wikipedia.org/wiki/Uruk_Sulcus) 0.8°N 160.3°W) | Long grooves and ridges where Ganymede's icy crust was pulled and cracked. | [PIA00280](https://photojournal.jpl.nasa.gov/catalog/PIA00280) |

Arrival fact candidate: the biggest moon in the solar system, bigger than Mercury.

## Callisto

| | |
|---|---|
| id | `callisto` |
| page | Jupiter & moons, parent `jupiter` (a fourth companion: use `moreMoons`) |
| radius | 0.378 (true) |
| map | USGS *Callisto Galileo/Voyager Global Mosaic 1km*, public domain. Credit NASA/JPL/USGS. [source](https://astrogeology.usgs.gov/search/map/callisto_galileo_voyager_global_mosaic_1km) |

| # | id | name | kind | lat | lon (E) | source coords | child fact | photo |
|---|---|---|---|---|---|---|---|---|
| 1 | `callisto-valhalla` | The Giant Target | surface | 18 | −57 | 18°N 57°W ([Wikipedia](https://en.wikipedia.org/wiki/Valhalla_(crater)); NASA global view centred 56°W) | The biggest crater on Callisto: rings around a bright middle, about 3,800 km across. | [PIA01649](https://pds-rings.seti.org/press_releases/pages/PIA01xxx/PIA01649.html) |
| 2 | `callisto-har` | The Crater with a Bump | surface | −3.3 | 2.1 | 3.3°S 357.9°W: **image centre**, which the caption says is on Har ([PIA01054](https://photojournal.jpl.nasa.gov/catalog/PIA01054)). Confirm against the gazetteer. | A crater with a strange round hill in the middle of its floor. | [PIA01054](https://photojournal.jpl.nasa.gov/catalog/PIA01054) |
| 3 | `callisto-asgard` | The Second Target | surface | 32.2 | −139.9 | 32.2°N 139.9°W (Wikidata, gazetteer 420; [NASA PIA01648](https://photojournal.jpl.nasa.gov/catalog/PIA01648) ≈30°N 142°W). The Wikipedia infobox prints *E*, an apparent sign error. | Another giant ringed crater. Callisto is covered in craters because its surface is so very old. | [PIA01634](https://www.jpl.nasa.gov/images/pia01634-asgard-multi-ring-structure-on-callisto/) |

Gunntro Catena (19.5°S 16.9°E, a crater chain) also plays here, but no photograph of it was
found. Eikin Catena fails the placement rules.

## Titan

| | |
|---|---|
| id | `titan` |
| page | Saturn & Titan, parent `saturn` |
| radius | 0.404 (true) |
| map | Cassini ISS near-global mosaic (USGS control network covers about +45° to −65°: **poles missing**, so check coverage before choosing). [source](https://astrogeology.usgs.gov/search/map/initial_global_control_network_and_moasicking_of_iss_images_of_titan) |

**Honesty note:** to the eye, Titan is an orange haze ball. Its surface map comes from
infrared and radar. Draw the haze, or say in the arrival fact that cameras saw through it.
Titan's lakes are near the poles (above 55°), so they belong in facts, not places.

| # | id | name | kind | lat | lon (E) | source coords | child fact | photo |
|---|---|---|---|---|---|---|---|---|
| 1 | `titan-belet` | The Sand Sea | surface | −5 | 105 | 5°S 255°W (USGS list via [HandWiki](https://handwiki.org/wiki/Astronomy:List_of_geological_features_on_Titan); paper: 60–120°E) | A sea of tall dunes, but the sand is made of tiny bits of frozen chemicals, not rock. | [PIA12559](https://www.jpl.nasa.gov/images/pia12559-dark-belet/) *Dark Belet* |
| 2 | `titan-huygens` | Where Huygens Landed | surface | −10.57 | 167.66 | 10.57°S 192.34°W (2010 reconstruction, [Wikipedia](https://en.wikipedia.org/wiki/Huygens_(spacecraft)); JPL 2005: 10.3°S 192.3°W) | In 2005 a probe called Huygens floated down here on a parachute and photographed icy pebbles on the ground. | [PIA07232](https://photojournal.jpl.nasa.gov/catalog/PIA07232), the real surface photo (NASA/JPL/ESA/University of Arizona) |
| 3 | `titan-xanadu` | The Bright Land | surface | −15 | −100 | 15°S 100°W ([Wikipedia](https://en.wikipedia.org/wiki/Xanadu_(Titan)); Radebaugh et al.: equator, 100°W) | A bright, hilly land about as big as Australia. | [PIA06192](https://www.jpl.nasa.gov/images/pia06192-zoomed-in-xanadu/) |

## Uranus: incomplete, cannot yet be fully represented

| | |
|---|---|
| id | `uranus` |
| page | Ice giants |
| radius | compressed (decide in Wave 3) |
| visit | giant: orbital/cloud places only. **Axial tilt 97.8°** sets the rings almost on edge; check ring readability and arrival composition in Wave 3. |
| map | No real global map was found. Uranus is nearly featureless, so a pale cyan `banded` fallback is honest. |

| # | id | name | kind | lat | lon (E) | source | child fact | photo |
|---|---|---|---|---|---|---|---|---|
| 1 | `uranus-rings` | The Dark Rings | ring 2.00 | – | map-relative | ε ring ≈51,140–51,150 km ([PDS Rings](https://pds-rings.seti.org/uranus/uranus_rings_table.html)) ÷ 25,559 km | Thin, dark rings made of dark bits of ice and rock. | [PIA01977](https://photojournal.jpl.nasa.gov/catalog/PIA01977) (all nine rings, Voyager 2) |
| 2 | `uranus-dark-spot` | The Dark Storm | cloud | 27 | map-relative | 27°N, Hubble 23 August 2006 ([ESA/Hubble](https://esahubble.org/images/opo0647a/)) | In 2006 the Hubble telescope spotted a dark storm here, bigger than a whole country. | [opo0647a](https://esahubble.org/images/opo0647a/), CC BY 4.0. Credit NASA, ESA, L. Sromovsky and P. Fry (University of Wisconsin), H. Hammel (Space Science Institute), K. Rages (SETI Institute) |
| 3 | **unresolved** | – | cloud | – | – | Candidate: the 2014 storm at ~15°N, the brightest ever seen ([de Pater et al.](https://arxiv.org/abs/1501.01309)), but the only images found are Keck (not public domain). Second candidate: Hubble's 1994 southern bright clouds ([opo9450c](https://esahubble.org/images/opo9450c), CC BY 4.0), whose latitude still needs a source. | – | – |

Do not build Uranus until its third place has a sourced latitude and a usable photograph.

## Neptune

| | |
|---|---|
| id | `neptune` |
| page | Ice giants |
| radius | compressed (decide in Wave 3) |
| visit | giant: orbital/cloud places only |
| map | No public-domain global map was found. Use a deep blue `banded` fallback. The cloud places are phrased as "Voyager saw it here", not as features drawn on the map. |

| # | id | name | kind | lat | lon (E) | source | child fact | photo |
|---|---|---|---|---|---|---|---|---|
| 1 | `neptune-rings` | The Ring Arcs | ring 2.54 | – | map-relative | Adams ring 62,932 km (Voyager; NASA fact sheet 62,933) ÷ 24,764 km | Thin rings, and in the outer one the bits bunch up into clumps called arcs. | [PIA01493](https://photojournal.jpl.nasa.gov/catalog/PIA01493) |
| 2 | `neptune-scooter` | The Scooter | cloud | −42 | map-relative | ≈42°S ([NSSDC Voyager 2 catalogue](https://nssdc.gsfc.nasa.gov/imgcat/html/object_page/vg2_1130449.html)) | A small white cloud that raced all the way around Neptune in less than 16 hours. | [PIA00049](https://pds-rings.seti.org/press_releases/pages/PIA00xxx/PIA00049.html) |
| 3 | `neptune-dark-spot` | The Great Dark Spot | cloud | −22 | map-relative | 22°S, 1989 ([NSSDC](https://nssdc.gsfc.nasa.gov/imgcat/html/object_page/vg2_1132632.html)); gone by 1994 | In 1989 Voyager 2 saw a dark storm here about as big as Earth. It has gone now: Neptune's storms come and go. | [PIA01492](https://pds-rings.seti.org/press_releases/pages/PIA01xxx/PIA01492.html) |

## Pluto

| | |
|---|---|
| id | `pluto` |
| page | Small worlds |
| radius | 0.187 (true) |
| map | USGS *Pluto global mosaic, New Horizons, July 2017* (LORRI + MVIC, 300 m/pixel), public domain. **Honesty note:** the hemisphere away from the flyby is seen only at low resolution; ship it as is and do not fill it in. [source](https://www.usgs.gov/media/images/pluto-global-mosaic-new-horizons-july-2017) |

| # | id | name | kind | lat | lon (E) | source coords | child fact | photo |
|---|---|---|---|---|---|---|---|---|
| 1 | `pluto-belton` | The Dark Whale | surface | −7.9 | 95.7 | −7.9°, 95.7° ([Beyer & Showalter 2021](https://rossbeyer.net/science/archive/Beyer-Showalter_2021_Pluto-Charon-Nomenclature.pdf), as Cthulhu Macula; now Belton Regio. [Wikipedia](https://en.wikipedia.org/wiki/Belton_Regio) gives 0°N 90°E) | A long dark land shaped a bit like a whale, about 3,000 km long. | **Unresolved:** [PIA19937](https://pds-rings.seti.org/press_releases/pages/PIA19xxx/PIA19937.html) is a synthetic perspective; find a direct New Horizons view. |
| 2 | `pluto-sputnik` | The Heart | surface | 20 | 180 | 20°N 180°E ([Wikipedia](https://en.wikipedia.org/wiki/Sputnik_Planitia)) | One half of Pluto's heart: a huge smooth plain of frozen ice. | [PIA19841](https://pds-rings.seti.org/press_releases/pages/PIA19xxx/PIA19841.html) |
| 3 | `pluto-tartarus` | The Ice Blades | surface | 8.5 | −126.91 | 8.5°N 233.09°E ([gazetteer 15679](https://planetarynames.wr.usgs.gov/Feature/15679) via search) | Rows of giant ice blades, some as tall as skyscrapers. | [PIA19957](https://photojournal.jpl.nasa.gov/catalog/PIA19957) |

Blade height: NASA says hundreds of feet; other reports say up to about 500 m. "As tall as
skyscrapers" covers both.

## Ceres

| | |
|---|---|
| id | `ceres` |
| page | Small worlds |
| radius | 0.074 (true; may need lifting for tapping) |
| map | USGS *Ceres Dawn FC Global Mosaic 140m* (DLR). Credit NASA/JPL-Caltech/UCLA/MPS/DLR/IDA; confirm on download. [source](https://astrogeology.usgs.gov/search/map/ceres_dawn_fc_global_mosaic_140m) |

| # | id | name | kind | lat | lon (E) | source coords | child fact | photo |
|---|---|---|---|---|---|---|---|---|
| 1 | `ceres-occator` | The Bright Spots | surface | 19.86 | −121.15 | 19.86°N 238.85°E ([Wikipedia](https://en.wikipedia.org/wiki/Occator_(crater)); Cerealia Facula 19.7°N 239.6°E) | The brightest spots on Ceres: salty stuff left behind when water came up from inside and dried away. | [PIA21924](https://pds-rings.seti.org/press_releases/pages/PIA21xxx/PIA21924.html) |
| 2 | `ceres-ahuna` | The Lonely Mountain | surface | −10.46 | −44.2 | 10.46°S 315.8°E ([Wikipedia](https://en.wikipedia.org/wiki/Ahuna_Mons)) | A mountain about 4 km tall standing all on its own. It may be a volcano made of ice and mud. | [PIA20348](https://photojournal.jpl.nasa.gov/catalog/PIA20348) |
| 3 | `ceres-haulani` | The Fresh Crater | surface | 5.34 | 10.58 | 5.34°N 10.58°E ([Wikipedia](https://en.wikipedia.org/wiki/Haulani_(crater))) | One of the youngest craters on Ceres, with bright rays splashed all around it. | [PIA20358](https://pds-rings.seti.org/press_releases/pages/PIA20xxx/PIA20358.html) (enhanced colour) |

---

## Open items

1. **Uranus** needs a third place with a sourced latitude and a usable photograph before
   Wave 3 builds it.
2. **Photos still to find:** Tros (Juno PJ34), Pluto's Belton Regio (a direct view), and a
   flat Maat Mons view if one exists.
3. **Coordinates to confirm** against the gazetteer when it can be opened: Debussy, Har
   (image-centre proxy) and Asgard (sign conflict).
4. **Maps** for Uranus and Neptune are honest fallbacks, not imagery. Jupiter's longitudes
   are set from PIA07782 at build.
5. **Downloads are blocked here.** The environment's network policy denies NASA, JPL and
   USGS hosts; allow them before building a world's assets.
