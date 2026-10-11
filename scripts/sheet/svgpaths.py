"""Extract colored plan layers from the PDF as SVG paths in display (rotated) coordinates."""
import pymupdf as fitz, json
from shapely.geometry import LineString
from shapely.ops import unary_union

d = fitz.open("src.pdf"); p = d[0]
H = 2384.0; MAPW = 2730

def T(pt): return (round(pt.y, 1), round(H - pt.x, 1))
def key(c): return tuple(round(v, 2) for v in c) if c else None
def f(v): return ("%.1f" % v).rstrip("0").rstrip(".")
def P(pt): x, y = T(pt); return f"{f(x)} {f(y)}"

def path_d(dr):
    s = []; last = None
    for it in dr["items"]:
        k = it[0]
        if k in ("l", "c"):
            a = it[1]
            if last is None or abs(a.x-last.x) > .05 or abs(a.y-last.y) > .05:
                if s: s.append("Z")
                s.append("M" + P(a))
            if k == "l": s.append("L" + P(it[2])); last = it[2]
            else: s.append("C" + P(it[2]) + " " + P(it[3]) + " " + P(it[4])); last = it[4]
        elif k == "re":
            r = it[1]; s.append("M%sL%sL%sL%sZ" % (P(r.tl), P(r.tr), P(r.br), P(r.bl))); last = None
        elif k == "qu":
            q = it[1]; s.append("M%sL%sL%sL%sZ" % (P(q.ul), P(q.ur), P(q.lr), P(q.ll))); last = None
    if dr.get("closePath") or dr["fill"]: s.append("Z")
    return "".join(s)

def xs(dr):
    r = dr["rect"]; return r.y0, r.y1  # display x range

FILL = {"boundary": (0.0, 0.25, 1.0), "active": (0.54, 0.0, 0.72), "metro": (0.84, 0.16, 0.73),
        "traffic": (1.0, 0.0, 0.0), "public": (0.68, 0.87, 0.97)}
HATCH = (0.87, 0.73, 0.85)
out = {k: [] for k in FILL}; hatch_d = []; hatch_lines = []
for dr in p.get_drawings():
    fl = key(dr["fill"]); st = key(dr["color"])
    if xs(dr)[1] > MAPW: continue
    for k, c in FILL.items():
        if fl == c:
            out[k].append({"d": path_d(dr), "eo": bool(dr.get("even_odd"))})
    if st == HATCH and not fl:
        hatch_d.append(path_d(dr).replace("Z", ""))
        for it in dr["items"]:
            if it[0] == "l": hatch_lines.append(LineString([T(it[1]), T(it[2])]))

# merge each layer's paths into one d string per fill rule (keeps SVG small)
layers = {}
for k, items in out.items():
    layers[k] = {"nonzero": "".join(i["d"] for i in items if not i["eo"]),
                 "evenodd": "".join(i["d"] for i in items if i["eo"]), "count": len(items)}
layers["renewal"] = {"stroke": "".join(hatch_d), "count": len(hatch_d)}

# hover zones for the hatched renewal areas (hatch lines -> area polygons)
z = unary_union([l.buffer(5, resolution=2) for l in hatch_lines]).buffer(-4.2, resolution=2).simplify(1.2)
zones = list(z.geoms) if hasattr(z, "geoms") else [z]
zones = [g for g in zones if g.area > 300]
def ring(cs): return "M" + "L".join(f"{f(x)} {f(y)}" for x, y in cs) + "Z"
layers["renewal"]["zones"] = [ring(g.exterior.coords) + "".join(ring(i.coords) for i in g.interiors) for g in zones]
for k, v in layers.items():
    print(k, v["count"], sum(len(x) for x in v.values() if isinstance(x, str)), len(v.get("zones", [])))
json.dump(layers, open("layers_svg.json", "w"))
