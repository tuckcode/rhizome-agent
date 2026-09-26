# Animated hero (README)

HyperFrames 0.8.78 composition behind `docs/assets/rhizome-hero-animated.webp`.
The Settings hero (`src/assets/brand/rhizome-organic-hero.png`) drifts slowly
behind a still copy of its own text side, masked out before the first sphere.
The drift goes out and back over 10 s, so the loop is seamless.

Re-render:

```bash
mkdir assets
cp ../../../../src/assets/brand/rhizome-organic-hero.png assets/hero.png
cp assets/hero.png assets/hero-type.png   # two files: lint flags one image used twice
npx hyperframes@0.8.78 render --output hero.mp4
ffmpeg -i hero.mp4 -vf "fps=15,scale=1200:-1:flags=lanczos" frames/f%03d.png
img2webp -loop 0 -lossy -q 72 -m 6 -d 67 frames/*.png -o rhizome-hero-animated.webp
```

A GIF of this is 22–34 MB: every pixel changes in every frame. Animated WebP is 3.6 MB.
