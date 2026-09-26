# Animated hero (README)

HyperFrames 0.8.78 composition behind `docs/assets/rhizome-hero-animated.webp`.
The Settings hero (`src/assets/brand/rhizome-organic-hero.png`) moves behind
a still copy of its own text side, masked out before the first sphere:

- slow drift and push-in of the whole artwork
- the spheres stretch out along their arms and pull back, twice per loop
  (SVG `feDisplacementMap` with `assets/warp-nodes.png`)
- the outer roots creep outward and settle, once per loop
  (`assets/warp-fibers.png`)

Every motion returns to its start at 10 s, so the loop is seamless. The
maps come from `make-warp-maps.py`.

Re-render:

```bash
python3 make-warp-maps.py                 # only if the maps change
cp ../../../../src/assets/brand/rhizome-organic-hero.png assets/hero.png
cp assets/hero.png assets/hero-type.png   # two files: lint flags one image used twice
npx hyperframes@0.8.78 render --output hero.mp4
ffmpeg -i hero.mp4 -vf "fps=15,scale=1200:-1:flags=lanczos" frames/f%03d.png
img2webp -loop 0 -lossy -q 72 -m 6 -d 67 frames/*.png -o rhizome-hero-animated.webp
```

A GIF of this is 22–34 MB: every pixel changes in every frame. Animated WebP is 4.1 MB.
