NASA MOON EXPLORER ASSETS

moon-color.jpg: 4096 x 2048 derivative of the LROC WAC 8K colour map.
moon-relief.png: 2048 x 1024 bump map derived from LOLA uint elevation data.
Source: https://svs.gsfc.nasa.gov/4720/
Credit: NASA's Scientific Visualization Studio. LROC: NASA/GSFC/ASU;
LOLA: NASA/GSFC/MIT. These are observed global data products. The relief is
illustrative shading on a spherical globe, not detailed navigable terrain.

tycho-mountains.jpg: 2560 x 1440 scaled crop of LROC NAC M162350671,
the oblique sunrise photograph of Tycho's central peaks, 10 June 2011.
Source: https://svs.gsfc.nasa.gov/4220/
Exact original: tycho_central_peak_wide_16x9.tif on that page.
Credit: NASA/GSFC/ASU/SVS. This is a spacecraft photograph.
It loads only when the child opens the Tycho image viewer.

scripts/prepare-moon-assets.py reproduces these outputs. sources.json records
original download URLs and SHA-256 hashes. The source TIFF files do not ship.

An incomplete LROC regional mosaic was evaluated and removed because its
gaps and seams obscured the globe. No synthetic fill or invented terrain ships.
