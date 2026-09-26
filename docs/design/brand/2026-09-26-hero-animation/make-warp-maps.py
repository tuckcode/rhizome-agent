"""Radial displacement maps for the hero warp (numpy + Pillow).

Each map pushes pixels outward from the hub, peaking at radius R0 and
fading to zero at the hub, far away, and before the text side (x < 760).
"""
import numpy as np
from PIL import Image

W, H = 1600, 800
CX, CY = 1125, 374  # hub centre in the 1600x800 frame
y, x = np.mgrid[0:H, 0:W].astype(np.float32)
dx, dy = x - CX, y - CY
r = np.sqrt(dx * dx + dy * dy) + 1e-3
ux, uy = dx / r, dy / r
fade = np.clip((x - 760) / 180, 0, 1)

for name, r0, sharpness in [("warp-nodes", 230, 2.2), ("warp-fibers", 520, 1.4)]:
    g = ((r / r0) * np.exp(1 - r / r0)) ** sharpness * fade
    # feDisplacementMap samples from P + scale*(C-0.5): sampling inward pushes content outward.
    red = np.clip(128 - ux * g * 127, 0, 255)
    green = np.clip(128 - uy * g * 127, 0, 255)
    rgba = np.dstack([red, green, np.full_like(red, 128), np.full_like(red, 255)]).astype(np.uint8)
    Image.fromarray(rgba, "RGBA").save(f"assets/{name}.png")
