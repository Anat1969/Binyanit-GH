import pymupdf as fitz, numpy as np
from PIL import Image
d = fitz.open("src.pdf"); p = d[0]
Z = 1.6
pix = p.get_pixmap(matrix=fitz.Matrix(Z, Z), clip=fitz.Rect(0, 0, 2730, 2384), alpha=False)
a = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3).astype(np.int16)
chroma = a.max(2) - a.min(2)
g = a.mean(2)
g[chroma > 16] = 255          # drop the coloured plan layers; keep the grey cadastre + black labels
g = np.clip((g - 40) * 255 / 215, 0, 255)
img = Image.fromarray(g.astype(np.uint8), "L").quantize(16)
img.save("base.png", optimize=True)
print(pix.width, pix.height)
full = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
full.resize((pix.width // 2, pix.height // 2)).save("original.jpg", quality=72)
