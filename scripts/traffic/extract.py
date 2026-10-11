"""Extract colour-coded vector layers from the traffic appendix PDF (603-0972307)
into display-space SVG path strings + a JSON manifest."""
import json, sys, re
import pymupdf as fitz
from PIL import Image, ImageFilter
import numpy as np

SRC = sys.argv[1]
OUT = sys.argv[2]
doc = fitz.open(SRC)
page = doc[0]
RM = page.rotation_matrix          # unrotated -> displayed
MAP_MAX_X = 3488                   # legend / title block start here (display space)

def rc(c):
    return tuple(round(v, 2) for v in c) if c else None

PREC = 1
def fmt(v):
    t = f"{v:.{PREC}f}".rstrip("0").rstrip(".") if PREC else str(int(round(v)))
    return "0" if t in ("-0", "") else t

class Pen:
    """relative-coordinate SVG writer (keeps file size down)"""
    def __init__(self): self.cx = self.cy = 0.0; self.out = []
    def _rel(self, pt):
        q = fitz.Point(pt) * RM
        x, y = round(q.x, PREC), round(q.y, PREC)
        dx, dy = x - self.cx, y - self.cy
        self.cx, self.cy = x, y
        return fmt(dx) + ("" if fmt(dy).startswith("-") else " ") + fmt(dy)
    def M(self, p):
        self.out.append("m" + self._rel(p)); self.sx, self.sy = self.cx, self.cy
    def L(self, p): self.out.append("l" + self._rel(p))
    def C(self, a, b, c):
        x0, y0 = self.cx, self.cy
        def r(p):
            q = fitz.Point(p) * RM
            return round(q.x, PREC) - x0, round(q.y, PREC) - y0, round(q.x, PREC), round(q.y, PREC)
        A, B, Cc = r(a), r(b), r(c)
        self.cx, self.cy = Cc[2], Cc[3]
        self.out.append("c" + " ".join(fmt(v) for v in (A[0], A[1], B[0], B[1], Cc[0], Cc[1])))
    def Z(self):
        self.out.append("z"); self.cx, self.cy = self.sx, self.sy

PEN = Pen()

def path_d(dr):
    global PEN
    pen = PEN; start = len(pen.out); parts = pen.out; last = None
    class _P:
        pass
    for it in dr["items"]:
        op = it[0]
        if op == "l":
            a, b = it[1], it[2]
            if last is None or abs(a.x - last.x) > .01 or abs(a.y - last.y) > .01:
                pen.M(a)
            pen.L(b); last = b
        elif op == "c":
            a, c1, c2, b = it[1:5]
            if last is None or abs(a.x - last.x) > .01 or abs(a.y - last.y) > .01:
                pen.M(a)
            pen.C(c1, c2, b); last = b
        elif op == "re":
            r = it[1]
            q = [r.tl, r.tr, r.br, r.bl]
            pen.M(q[0]); [pen.L(x) for x in q[1:]]; pen.Z(); last = None
        elif op == "qu":
            q = it[1]
            pts = [q.ul, q.ur, q.lr, q.ll]
            pen.M(pts[0]); [pen.L(x) for x in pts[1:]]; pen.Z(); last = None
    if dr.get("closePath") and len(parts) > start and parts[-1] != "z":
        pen.Z()
    return len(parts) > start

def disp_rect(dr):
    return dr["rect"] * RM

# ---- classification by colour (legend read from the sheet itself) ----
PURPLE = (0.54, 0.0, 0.72); ORANGE = (1.0, 0.5, 0.0); RED = (1.0, 0.0, 0.0)
CYAN = (0.0, 1.0, 1.0); GREEN = (0.0, 1.0, 0.0); MAGENTA = (1.0, 0.0, 1.0)
BLUE = (0.0, 0.43, 0.87); BLACK = (0.0, 0.0, 0.0); GRAY = (0.73, 0.73, 0.73)

KEYS = ["active", "renewal", "arterial", "mtan_existing", "mtan_proposed",
        "local_existing", "local_proposed", "boundary", "cadastre", "cadastre_light"]
pens = {(k, m): Pen() for k in KEYS for m in ("fill", "stroke")}
counts = {(k, m): 0 for k in KEYS for m in ("fill", "stroke")}
stroke_w = {}

for dr in page.get_drawings():
    r = disp_rect(dr)
    if r.x0 >= MAP_MAX_X - 2:
        continue
    col, fill = rc(dr.get("color")), rc(dr.get("fill"))
    size = max(r.width, r.height)
    key = None; mode = "fill" if fill else "stroke"
    c = fill or col
    if c == PURPLE: key = "active"
    elif c == ORANGE: key = "renewal"
    elif c == RED: key = "arterial"
    elif c == GREEN: key = "local_existing"
    elif c == MAGENTA: key = "local_proposed"
    elif c == BLUE: key = "boundary"
    elif c == CYAN:
        # long filled bands = existing axis; small squares + zig-zags = proposed axis
        key = "mtan_existing" if (fill and size > 40) else "mtan_proposed"
    elif c == BLACK:
        key = "cadastre"
        if mode == "stroke":
            w = round(dr.get("width") or 0, 2); stroke_w[w] = stroke_w.get(w, 0) + 1
    elif c == GRAY: key = "cadastre_light"
    if not key:
        continue
    PREC = 0 if key.startswith("cadastre") else 1
    PEN = pens[(key, mode)]
    if path_d(dr):
        counts[(key, mode)] += 1

# ---- parcel / block numbers (numeric text only; Hebrew in this PDF uses a broken font map) ----
labels = []
for b in page.get_text("dict")["blocks"]:
    for l in b.get("lines", []):
        for s in l["spans"]:
            t = s["text"].strip()
            if not re.fullmatch(r"\d{1,4}", t):
                continue
            bb = fitz.Rect(s["bbox"]) * RM  # get_text returns unrotated coordinates
            if bb.x0 >= MAP_MAX_X: continue
            labels.append([round((bb.x0 + bb.x1) / 2, 1), round((bb.y0 + bb.y1) / 2, 1), t, round(s["size"], 1)])

# ---- dark-grey areas (raster in source) -> RGBA overlay via colour keying ----
pix = page.get_pixmap(matrix=fitz.Matrix(1, 1), clip=fitz.Rect(0, 0, MAP_MAX_X, page.rect.height))
arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)[:, :, :3].astype(int)
gray_ref = np.median(arr[1000:1100, 1100:1200].reshape(-1, 3), axis=0)  # inside central grey zone
dist = np.abs(arr - gray_ref).sum(axis=2)
mask = (dist < 40).astype(np.uint8) * 255
from scipy import ndimage
m = Image.fromarray(mask).filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.MinFilter(7))
lab, n = ndimage.label(np.array(m) > 0)
sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
keep = np.isin(lab, [i + 1 for i, sz in enumerate(sizes) if sz > 20000])
keep = ndimage.binary_fill_holes(ndimage.binary_closing(keep, structure=np.ones((15, 15))))
m = Image.fromarray((keep * 255).astype(np.uint8))
rgba = Image.new("RGBA", m.size, tuple(int(v) for v in gray_ref) + (0,))
rgba.putalpha(m)
rgba.save(f"{OUT}/excluded.png", optimize=True)

manifest = {
    "viewBox": [0, 0, MAP_MAX_X, round(page.rect.height, 1)],
    "grayRef": [int(v) for v in gray_ref],
    "counts": {f"{k}.{m}": n for (k, m), n in counts.items()},
    "labels": len(labels),
    "blackStrokeWidths": stroke_w,
}
layers = {k: {m: "".join(pens[(k, m)].out) for m in ("fill", "stroke")} for k in KEYS}
json.dump(layers, open(f"{OUT}/layers.json", "w"))
json.dump(labels, open(f"{OUT}/labels.json", "w"))
json.dump(manifest, open(f"{OUT}/manifest.json", "w"), indent=1)
print(json.dumps(manifest, indent=1))
