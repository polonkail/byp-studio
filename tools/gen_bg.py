"""Generates the site's background textures (dark gold-veined marble, pearl silk)."""
import numpy as np
from PIL import Image, ImageFilter
import os

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "assets", "img")
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(11)


def value_noise(h, w, cell, rng):
    gh, gw = h // cell + 2, w // cell + 2
    g = rng.random((gh, gw))
    y = np.arange(h) / cell
    x = np.arange(w) / cell
    y0 = np.floor(y).astype(int); x0 = np.floor(x).astype(int)
    fy = y - y0; fx = x - x0
    fy = fy * fy * (3 - 2 * fy); fx = fx * fx * (3 - 2 * fx)
    a = g[y0][:, x0]; b = g[y0][:, x0 + 1]
    c = g[y0 + 1][:, x0]; d = g[y0 + 1][:, x0 + 1]
    top = a + (b - a) * fx[None, :]
    bot = c + (d - c) * fx[None, :]
    return top + (bot - top) * fy[:, None]


def fbm(h, w, base, octaves, rng, gain=0.5):
    out = np.zeros((h, w)); amp = 1.0; tot = 0
    cell = base
    for _ in range(octaves):
        out += amp * value_noise(h, w, max(2, int(cell)), rng)
        tot += amp; amp *= gain; cell /= 2
    return out / tot


def marble(w, h, name, base_dark=(18, 15, 17), base_light=(38, 32, 34), vein=(196, 160, 106), gain=1.0):
    n1 = fbm(h, w, 700, 3, rng, gain=0.45)
    n1b = fbm(h, w, 160, 3, rng, gain=0.5)
    n2 = fbm(h, w, 380, 4, rng)
    fade = fbm(h, w, 500, 3, rng)
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    # diagonal flow, domain-warped (smooth warp + a little detail)
    t = (xx * 0.00085 + yy * 0.0016) + n1 * 2.4 + n1b * 0.18
    v_main = np.abs(np.sin(t * np.pi))
    width = 0.012 + 0.03 * fade
    veins = np.clip(1 - v_main / width, 0, 1) ** 1.3
    veins *= np.clip((fade - 0.35) * 2.6, 0, 1)            # veins fade in and out
    halo = np.clip(1 - v_main / (width * 6), 0, 1) ** 2 * 0.18 * np.clip((fade - 0.3) * 2, 0, 1)
    t2 = (xx * 0.0021 - yy * 0.0009) + n2 * 2.8 + n1b * 0.25
    v2 = np.clip(1 - np.abs(np.sin(t2 * np.pi)) / 0.012, 0, 1) ** 2 * 0.32 * np.clip((0.65 - fade) * 2.5, 0, 1)
    veins = veins + halo
    cloud = fbm(h, w, 600, 5, rng)
    base = np.array(base_dark)[None, None, :] + (np.array(base_light) - np.array(base_dark))[None, None, :] * (cloud[..., None] ** 1.4)
    # vignette toward the left/bottom so text reads
    vig = np.clip(1 - 0.55 * ((xx / w - 0.85) ** 2 + (yy / h - 0.25) ** 2), 0.35, 1)
    vmask = np.clip((veins * 0.85 + v2) * (0.25 + 0.75 * (xx / w) ** 1.2) * vig * gain, 0, 1)[..., None]
    img = base * (1 - vmask) + np.array(vein)[None, None, :] * vmask
    grain = rng.normal(0, 2.2, (h, w, 1))
    img = np.clip(img + grain, 0, 255).astype(np.uint8)
    im = Image.fromarray(img).filter(ImageFilter.GaussianBlur(0.6))
    im.save(os.path.join(OUT, name + ".webp"), quality=82, method=6)
    im.resize((w // 2, h // 2), Image.LANCZOS).save(os.path.join(OUT, name + "-sm.webp"), quality=80, method=6)


def silk(w, h, name, c0=(246, 241, 236), c1=(226, 214, 203), c2=(255, 252, 248)):
    yy, xx = np.mgrid[0:h, 0:w].astype(float)
    n = fbm(h, w, 900, 3, rng, gain=0.4)
    u = (xx / w) * 1.5 + (yy / h) * 0.55 + n * 0.7
    folds = 0.5 + 0.5 * np.sin(u * np.pi * 2.0 + np.sin((yy / h) * 2.2 + n * 1.5) * 1.1)
    shade = folds ** 1.4
    hi = np.clip((folds - 0.8) / 0.2, 0, 1) ** 1.5
    img = np.array(c0)[None, None] \
        + (np.array(c1) - np.array(c0))[None, None] * (1 - shade[..., None]) * 0.55 \
        + (np.array(c2) - np.array(c0))[None, None] * hi[..., None] * 0.9
    img = np.clip(img + rng.normal(0, 1.3, (h, w, 1)), 0, 255).astype(np.uint8)
    im = Image.fromarray(img).filter(ImageFilter.GaussianBlur(6))
    im.save(os.path.join(OUT, name + ".webp"), quality=80, method=6)


marble(2400, 1400, "marble-noir", base_light=(44, 37, 39), gain=1.9)
marble(1600, 1000, "marble-band", base_dark=(22, 18, 20), base_light=(34, 28, 30))
silk(2000, 1200, "silk-pearl")
print("ok")
