DISCOVERY PHOTOS
================

A real photograph of each real place a child can find. Entirely optional, one at a
time: the card checks for the file when a place is found, and a place with no file
looks exactly as it did before. Nothing here is downloaded until that place is
actually found, so adding all nine costs the game nothing at startup.

Put the files directly in this folder using these EXACT names. The name is the
discovery's id in src/config.ts, so if you ever add a place, its photo is named after
its id and no code changes.


  SIZE AND FORMAT

  1024-1280 px on the long edge, .jpg, quality ~80, ideally under 150 KB each.
  They are shown as an 84px thumbnail in the fact card and full-screen on a tap, and
  the target device caps its pixel ratio at 1.5 — beyond about 1280 you are paying
  for detail the tablet will not draw. Any aspect ratio is fine: the thumbnail crops
  to a square and the full view fits the whole picture on screen.

  Landscape or square framing works best. A tall portrait crop loses most of itself
  in the thumbnail.


  A NOTE ON THE SUGGESTIONS BELOW

  Each entry names a specific image worth using and the page it lives on. Those
  came from searching, and the pages could not be opened from the machine this was
  written on — every NASA and Wikimedia host is blocked by its network. So treat
  each one as "this is the picture you want, here is where it is", not as a link
  that has been clicked. Check the credit on the page itself before shipping it:
  most NASA imagery is public domain, and a minority is not.


  EARTH

  earth-sahara.jpg      The Sahara from orbit. Wanted: the sand itself, wide enough
                        to read as "bigger than it looks" — a whole-Africa view beats
                        a close crop of dunes, because the fact is about its size.
                        Blue Marble: Next Generation has exactly that view.
                        https://earthobservatory.nasa.gov/features/BlueMarble
                        Avoid the Richat Structure ("Eye of the Sahara"), which is
                        beautiful and is a 40km circle, not a desert. 23N 13E.

  earth-amazon.jpg      Green, with the river in it. Two good ones:
                        "Amazon River in Sunglint", from the ISS, where the water
                        catches the light through the forest —
                        https://science.nasa.gov/earth/earth-observatory/amazon-river-in-sunglint-84813/
                        or "Cloud Free View of the Amazon" (NASA/GSFC) for the plain
                        wide green. NOT the ESA "Earth from Space" Amazon images:
                        they are lovely and they are not public domain. 3S 60W.

  earth-nightside.jpg   City lights against the dark. The fact is entirely about the
                        lights, so use a Black Marble night composite rather than a
                        daytime photograph of Thailand. NASA SVS Black Marble 2016
                        publishes a 1024x576 print JPEG, which is already the right
                        size for this folder.
                        https://svs.gsfc.nasa.gov/30876/    13.75N 100.5E.


  MOON

  moon-tranquility.jpg  The Apollo 11 site. A surface photograph beats the orbital
                        view here — a crater field means nothing to a five-year-old
                        and a bootprint means everything. AS11-40-5878 is *the*
                        bootprint, 1912x1920, NASA, public domain.
                        https://science.nasa.gov/image-detail/as11-40-5878-orig/
                        Square, so it survives the thumbnail crop well. 0.67N 23.47E.

  moon-tycho.jpg        Tycho, showing the bright rays, since that is what the fact
                        talks about. That means a full-disc or wide view, NOT the
                        LROC close-ups of the crater floor — from close up the rays
                        are invisible and the point is lost.
                        https://www.lroc.asu.edu/images    43.3S 11.4W.

  moon-farside.jpg      The far side as a whole disc, so the difference is the whole
                        picture: cratered all over, none of the dark seas. The LRO
                        Wide Angle Camera mosaic is the one everybody uses.
                        https://svs.gsfc.nasa.gov/4109/    20.4S 129.1E.


  MARS

  mars-olympus.jpg      The whole volcano in frame, not a close crop of the caldera —
                        the fact is about how wide it is. PIA00300 is the classic
                        view; PIA26305 is a newer Odyssey THEMIS one.
                        https://www.jpl.nasa.gov/images/pia00300-olympus-mons/
                        18.65N 133.8W.

  mars-marineris.jpg    Along its length. PIA00422 (Viking, colour) shows the canyon
                        itself; PIA00003 "Valles Marineris Hemisphere" shows it as
                        the scar across a whole planet, which is the more striking of
                        the two for a child.
                        https://www.jpl.nasa.gov/images/pia00003-valles-marineris-hemisphere/
                        14S 59W.

  mars-elysium.jpg      PIA00412 "Elysium" (Viking) puts Elysium Mons in the middle
                        of its region with the two smaller volcanoes either side;
                        PIA25925 is a closer modern view.
                        https://www.jpl.nasa.gov/images/pia00412-elysium/
                        25N 147E.


WHERE TO GET THEM
-----------------

  NASA Image Library    https://images.nasa.gov/
                        The general search. Most NASA imagery is public domain; check
                        each item, because a few are credited to ESA or a university
                        partner and carry their own terms.

  NASA Visible Earth    https://visibleearth.nasa.gov/
                        Earth from orbit, by feature. The Blue Marble and Black Marble
                        collections cover the Sahara, the Amazon and the night side.

  NASA Earth Observatory
                        https://earthobservatory.nasa.gov/images
                        Individual features with an explanation attached, which is
                        useful for checking you have the right place.

  LROC (Moon)           https://www.lroc.asu.edu/images
                        Lunar Reconnaissance Orbiter, including the Apollo landing
                        sites from orbit. Credit "NASA/GSFC/Arizona State University".

  Apollo Image Atlas    https://www.lpi.usra.edu/resources/apollo/
                        The surface photographs from the missions themselves.

  NASA Mars Exploration https://mars.nasa.gov/multimedia/images/
                        Mars Global Surveyor, Odyssey and MRO imagery. Some of the
                        best Valles Marineris and Olympus Mons views are ESA Mars
                        Express — those are CC BY-SA 3.0 IGO, not public domain, so
                        credit them properly or pick a NASA one instead.


CREDIT
------

Public-domain NASA images need no licence line, but credit them anyway in README.md
next to the textures — it is the honest thing and it tells the next person where a
picture came from. Anything from ESA or a university partner MUST be credited under
its own terms; if you are not sure what a file's terms are, do not ship it.
