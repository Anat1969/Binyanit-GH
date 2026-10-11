import json, re
from shapely.geometry import Polygon
from shapely.ops import unary_union

D = json.load(open("layers_svg.json"))

def rings(d):
    out = []
    for sub in re.split(r"(?=M)", d):
        nums = [float(v) for v in re.findall(r"-?\d+(?:\.\d+)?", sub)]
        pts = list(zip(nums[0::2], nums[1::2]))
        if len(pts) >= 3: out.append(pts)
    return out

polys = [Polygon(r).buffer(0) for r in rings(D["boundary"]["nonzero"])]
u = unary_union([p.buffer(1.5) for p in polys if not p.is_empty])
parts = list(u.geoms) if hasattr(u, "geoms") else [u]
holes = [Polygon(i) for g in parts for i in g.interiors]
holes = [h for h in holes if h.area > 5000]
print("plan-area parts", [round(h.area) for h in holes])
f = lambda v: ("%.1f" % v).rstrip("0").rstrip(".")
D["planArea"] = "".join("M" + "L".join(f"{f(x)} {f(y)}" for x, y in h.simplify(1).exterior.coords) + "Z" for h in holes)

out = json.dumps(D, separators=(",", ":"))
open("sheet-layers.json", "w", encoding="utf-8").write(out)  # -> public/data/sheet-layers.json
print(len(out))
