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


  EARTH

  earth-sahara.jpg      The Sahara from orbit. Wanted: the sand itself, ideally wide
                        enough to read as "bigger than it looks". 23N 13E.

  earth-amazon.jpg      The Amazon rainforest from orbit — green, with the river in
                        it if you can. 3S 60W.

  earth-nightside.jpg   Earth's night side: city lights against the dark. This is the
                        one whose whole point is the lights, so a Black Marble night
                        composite beats a daytime shot of Thailand. 13.75N 100.5E.


  MOON

  moon-tranquility.jpg  The Apollo 11 landing site. Either the LRO view from orbit or
                        a surface photograph from the mission — a footprint or the
                        lander both land better with a child than a crater field.
                        0.67N 23.47E.

  moon-tycho.jpg        Tycho crater, ideally showing the bright rays streaking away
                        from it, since that is what the fact talks about. 43.3S 11.4W.

  moon-farside.jpg      The lunar far side. Wanted: the obviously *different* face —
                        cratered all over, none of the dark seas. 20.4S 129.1E.


  MARS

  mars-olympus.jpg      Olympus Mons, from orbit and wide enough to see the whole
                        volcano. 18.65N 133.8W.

  mars-marineris.jpg    Valles Marineris, along its length. 14S 59W.

  mars-elysium.jpg      Elysium Mons. 25N 147E.


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
