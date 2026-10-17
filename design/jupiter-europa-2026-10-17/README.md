# Jupiter and Europa image reference pack

Gathered 17 October 2026 against GitHub main `6a8b891`, reconciled with main `1a0a2b1`.
**[content/worlds.md](../../content/worlds.md) is authoritative: new worlds have
exactly three places.** The six-image sheets below are supplemental reference
selections, not six-place world plans. Use the locked content IDs, coordinates and
chosen source products when implementing; pack IDs identify assets only.

Research only: no gameplay,
`public/`, runtime catalogue, discovery IDs, saves or narration changed. Nothing is
installed in the game. The owner authorized merging this reference pack on 17 October.

Open [the offline review page](index.html), or browse the static contact sheets:

- [Jupiter — six candidates](jupiter-contact-sheet.jpg)
- [Europa — six candidates](europa-contact-sheet.jpg)

The pack contains **two globe-map candidates, twelve shortlisted photographs and
one backup photograph**, plus an annotated Jupiter map reference. All imagery is
real spacecraft/telescope data from official archives. The short child-facing
captions are newly drafted proposals, not NASA quotations or approved game copy.

## Files and provenance

| File or directory | Purpose |
| --- | --- |
| [assets.json](assets.json) | Source/download URLs, exact credits, mission/instrument, observation versus release dates, image processing, reuse policies, proposed subjects and placement cautions |
| [inventory.json](inventory.json) | Original and derivative dimensions, byte sizes and SHA-256 checksums |
| `originals/` | Untouched publisher JPEGs; no inpainting, recolouring, cropping or generated documentary imagery |
| `prepared/maps/` | Full-extent 2:1 JPEG map candidates, capped at 2048 pixels wide |
| `prepared/photos/` | JPEG review/photo candidates capped at 1024 pixels on the long edge; no upscaling or cropping |
| `prepared/thumbs/` | Small aspect-preserving review thumbnails, at most 320 × 220; not approved square game badges |
| [prepare_pack.py](prepare_pack.py) | Explicit downloads, deterministic size-only derivatives, offline review page, static sheets and inventory verification; requires Pillow |
| [inspect_sources.py](inspect_sources.py) | Optional metadata/link inspection of explicitly supplied source pages; uses the system HTTPS client with TLS verification |

Original assets total **3,762,921 bytes**. Prepared maps/photos total **2,074,830
bytes**, and review thumbnails **210,935 bytes**. These are research-pack totals,
not a request to ship the entire pack. Keep full photographs lazy when integrating;
promote only selected maps and appropriately cropped small control thumbnails.

## Globe candidates

| World | Source and preparation | Current status |
| --- | --- | --- |
| Jupiter | [Cassini PIA07782](https://science.nasa.gov/photojournal/cassinis-best-maps-of-jupiter-cylindrical-map/), NASA/JPL/Space Science Institute. Use `originals/jupiter-map-main.jpg`, the unlabelled 3601 × 1801 archive raster, resampled across its complete extent to `prepared/maps/jupiter-map.jpg` at 2048 × 1024. The extra endpoint row/column is normalised without discarding map coverage. | Preferred dated cloud-skin candidate. Source combines near-infrared/blue filters to approximate visible colour. It records December 2000 weather, not permanent terrain. |
| Europa | [JPL Solar System Simulator](https://maps.jpl.nasa.gov/tmaps/jupiter.html), Caltech/JPL/USGS. The publisher identifies `jup2vss2.jpg` as a cleaned Voyager mosaic. `prepared/maps/europa-map.jpg` retains native 1440 × 720 resolution and grayscale. | Provisional art/engineering reference. Uneven resolution and baked illumination remain visible. Longitude origin/direction and modern control-network alignment are not specified by this landing page. |

`originals/jupiter-map.jpg` is an **annotated axis reference**, not the globe texture.
Its border, labels and title must not be wrapped onto a planet. No height, normal,
night-light or roughness map has been invented from either image's brightness.

Before marker integration, verify map orientation/longitude conventions against
known landmarks and the runtime UV maths. For Europa, cross-check at least Pwyll
and Tyre against a current authoritative control/reference map. Use a modern USGS
controlled mosaic if the legacy map fails those checks; do not move real feature
coordinates to make a mismatched texture appear correct. Both maps remain marked
`marker_ready: false` in the manifest.

## Jupiter reference subjects

| Candidate | Archive | How to use it honestly |
| --- | --- | --- |
| Great Red Spot | PIA00014, Voyager 1, 25 February 1979 | A moving atmospheric storm. Match the dated texture's feature rather than attaching a modern fixed longitude. Avoid historical size/age superlatives. |
| Cloud bands | PIA04866, Cassini, 29 December 2000 | Near-visible-colour whole-world mosaic. The bands are atmospheric regions, not solid landing ground. |
| Polar cyclones | PIA22335, Juno/JIRAM, released 7 March 2018 | Infrared thermal composite. Its red/yellow palette represents heat; it is not a naked-eye picture of fiery clouds. |
| Aurora | heic1613a, Hubble, released 30 June 2016 | Optical 2014 imagery combined with ultraviolet 2016 observations. Explain the invisible-light composite. |
| Io's shadow | PIA23602, JunoCam, publisher dates the observation 12 September 2019 | Enhanced colour, processed by Tanya Oleksuik. The shadow is a transient eclipse event. Preserve the complete credit; the publisher says CC BY without a licence version/link. |
| Jupiter turns | PIA02825, Cassini, 22–23 October 2000 | Nine actual frames arranged as a time sequence. Best as an optional rotation explanation; a poor tiny badge or permanent point target. |

For the shadow subject, [PIA01540](https://science.nasa.gov/photojournal/pj-hubble-clicks-images-of-io-sweeping-across-jupiter/)
is also downloaded as `jupiter-io-shadow-backup`: a Hubble UV/violet false-colour
sequence with a separate plume inset. Its publisher credit is NASA/JPL/STScI, with
no separate third-party copyright notice in the caption. It is more visually
complicated, but supplies an alternative if the preferred image's exact CC licence
cannot be confirmed. It is labelled as a backup on the review page.

These are **six educational subjects, not six approved surface markers**. A future
Jupiter visit needs an explicit atmospheric/orbital/archive capability. A ring
marker cannot represent Io's shadow. Photo research does not solve navigation,
selection, framing or child comprehension.

## Europa reference subjects

| Candidate | Archive | Coordinate evidence and limitations |
| --- | --- | --- |
| Pwyll crater | PIA00586 | Caption gives the feature at 26° S, 271° W. Equivalent east longitude is 89°. Legacy caption values need a modern reference check. |
| Conamara's jumbled ice | PIA01403 | Image centre: 9° N, 274° W / 86° E. Mixed-resolution images from two encounters. The image centre is not automatically the IAU feature centre. |
| Crossing ridges | PIA00544 | Image centre: 5.83° N, 325° W / 35° E. A regional surface subject, not a named point. |
| Tyre's impact rings | PIA00702 | Caption gives the structure at 34° N, 146.5° W / 213.5° E. False-colour composite; these are rings in the ice, not orbiting rings. |
| Agenor's bright band | PIA00877 | Image centre: 40° S, 210° W / 150° E. Low-resolution regional context; choose a verified point on the actual band later. |
| Icy freckles | PIA03878 | Caption gives the northern hemisphere but no centre. Mixed-date detail and colour. Original observation-footprint research is required before placement. |

East longitudes above are arithmetic conversions, **not a new cartographic
validation**. The captions do not specify the latitude convention. Do not copy
image-centre values into game markers as if they were named-feature centres.
No picture here directly shows an exposed subsurface ocean or establishes life.

The locked implementation set differs from this earlier reference selection:
Jupiter uses belts (PIA04866, present here), Oval BA (PIA22942) and the Great Red Spot
(PIA21775). Europa uses Tyre (PIA01633), Thera (PIA00875) and Conamara (PIA01407),
plus a controlled USGS global mosaic. Those exact missing products still need
downloading before their world is built. The legacy Europa map and other photographs
here are references/alternates, not silent replacements for the authored sources.

## Reuse and credit

Every entry retains the full publisher credit, including partner institutions and
citizen processing. The applicable policy/source links are recorded per entry and
displayed beside each image in the offline page:

- [NASA media guidance](https://www.nasa.gov/nasa-brand-center/images-and-media/)
  and [JPL image policy](https://www.jpl.nasa.gov/jpl-image-use-policy/): use within
  their stated educational/informational terms, acknowledge the source, respect
  separately marked rights and imply no endorsement. Do not relabel all partner
  or citizen-processed products as NASA public domain.
- [ESA/Hubble policy](https://esahubble.org/copyright/): the aurora product is
  available under CC BY 4.0, with its full **NASA, ESA** credit and active source/
  licence links.
- The preferred shadow image retains **Tanya Oleksuik's CC BY credit**. Its precise
  licence version/link is an open production metadata item, with a downloaded
  backup available. No permission request or message has been sent to anyone.

On promotion, copy the exact map credits into `public/assets/README.txt` and photo
credits into `public/assets/discoveries/README.txt`, and retain the required visible
viewer credits/source links. This research manifest does not replace shipped credits.

## Rebuilding and validation

With Python and Pillow, from this directory:

```text
python prepare_pack.py --download   # fetch only missing selected originals
python prepare_pack.py              # regenerate local derivatives and review files
python prepare_pack.py --verify      # verify existing pinned files without rewriting
```

Do not regenerate `inventory.json` to bless an unexplained changed original.
Investigate source/version changes first. All selected downloads were decoded as
images, reviewed in contact sheets, and recorded with checksums. Preparation keeps
full image extents; map outputs have exact 2:1 dimensions and nothing is upscaled.
The static sheets are compositions of these same real images with labels/credits.

Validation completed: 46 pinned image files passed dimensions/byte-length/SHA-256
verification. The offline HTML page loaded all 15 local images without page errors,
failed requests or horizontal overflow at 1440 × 1000 and 390 × 844, both at scale 1.
Typecheck and all 362 baseline unit tests passed. No game browser suite ran because
the change is confined to unshipped reference material.

No game-screen redesign, full local browser suite, physical-tablet performance
test or child playtest belongs to this asset-only preparation. Future integration
still follows the [world expansion checklist](../../docs/worlds-roadmap.md).

## Historical selection notes

- The published Jupiter map's annotated figure was unsuitable as a texture. The
  actual unlabelled archive raster was obtained instead; the figure remains an
  axis reference only.
- Thera/Thrace's low-resolution context was considered but not added: it overlaps
  the Agenor subject. Freckles provide a more distinct sixth Europa subject.
- NASA's Europa 3D model was inspected as an alternative, but its landing page
  does not establish the embedded texture's upstream map/coordinate provenance.
  No unexplained extraction or synthetic colour texture was substituted.
- Broader USGS regional mosaic archives are useful future alignment sources, but
  downloading a multi-gigabyte cartography collection was unnecessary for this
  bounded reference pack.
