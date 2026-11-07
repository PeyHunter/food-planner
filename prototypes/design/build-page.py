"""Builds one HTML page with every design's screenshots embedded. Usage: python3 build-page.py <out.html> <winner-number> [pitch files read from <n>/pitch.txt]"""
import base64, html, pathlib, sys

root = pathlib.Path(__file__).parent
out, winner = sys.argv[1], sys.argv[2]
names = {"1": "Fresh market", "2": "Playful pastel", "3": "Modern cookbook", "4": "Sticker pop", "5": "Nordic calm"}

def img(p):
    return "data:image/png;base64," + base64.b64encode(p.read_bytes()).decode()

cards = []
for n, name in names.items():
    shots = root / n / "shots"
    if not shots.exists():
        continue
    pitch = (root / n / "pitch.txt").read_text().strip() if (root / n / "pitch.txt").exists() else ""
    figs = "".join(
        f'<figure><img src="{img(shots / f"{s}.png")}" alt="{name}: {s} screen" loading="lazy"><figcaption>{s.capitalize()}</figcaption></figure>'
        for s in ("browse", "recipe", "week") if (shots / f"{s}.png").exists()
    )
    badge = '<span class="win">Picked</span>' if n == winner else ""
    cards.append(f'<section class="design{" picked" if n == winner else ""}" id="d{n}"><header><h2>{n}. {html.escape(name)}</h2>{badge}</header><p>{html.escape(pitch)}</p><div class="shots">{figs}</div></section>')

page = f"""<title>Food planner designs</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&family=Figtree:wght@400;600&display=swap">
<style>
/* Layout: a stack of design rows, each a horizontal strip of three phone screenshots. */
:root {{ --bg:#fbfaf6; --fg:#24261f; --muted:#6b6e60; --line:#e3e1d6; --accent:#3f8f4e; --pick:#fff1c7;
  --display:"Fraunces", Georgia, serif; --body:"Figtree", system-ui, sans-serif; }}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{ --bg:#191a16; --fg:#ecebe3; --muted:#a3a597; --line:#33352d; --accent:#7cc98a; --pick:#3a3320; color-scheme:dark }} }}
:root[data-theme="dark"] {{ --bg:#191a16; --fg:#ecebe3; --muted:#a3a597; --line:#33352d; --accent:#7cc98a; --pick:#3a3320; color-scheme:dark }}
body {{ background:var(--bg); color:var(--fg); font-family:var(--body); font-size:16px; line-height:1.5;
  padding-left:max(16px, env(safe-area-inset-left, 0px)); padding-right:max(16px, env(safe-area-inset-right, 0px)); padding-block:32px 64px }}
main {{ max-width:1200px; margin:0 auto; display:grid; gap:40px }}
h1 {{ font-family:var(--display); font-size:clamp(28px,5vw,44px); margin:0; text-wrap:balance }}
.lede {{ color:var(--muted); max-width:60ch; margin:8px 0 0 }}
.design {{ display:grid; gap:12px; padding-block:24px; border-top:1px solid var(--line) }}
.design.picked {{ background:var(--pick); border-radius:16px; padding:24px }}
.design header {{ display:flex; gap:12px; align-items:center; flex-wrap:wrap }}
h2 {{ font-family:var(--display); font-size:24px; margin:0 }}
.design p {{ margin:0; color:var(--muted); max-width:65ch }}
.win {{ background:var(--accent); color:var(--bg); font-weight:600; font-size:13px; letter-spacing:.04em; text-transform:uppercase; padding:4px 10px; border-radius:999px }}
.shots {{ display:flex; gap:16px; overflow-x:auto; padding-bottom:8px }}
figure {{ margin:0; flex:0 0 auto; width:min(260px, 72vw) }}
figure img {{ width:100%; border-radius:20px; border:1px solid var(--line); display:block }}
figcaption {{ font-size:13px; color:var(--muted); margin-top:6px }}
</style>
<main>
<div><h1>Food planner designs</h1><p class="lede">Five designers each drew the Browse, Recipe and Week screens. The highlighted design is the one being built. Pick another anytime and it can be swapped.</p></div>
{''.join(cards)}
</main>"""
pathlib.Path(out).write_text(page)
print("wrote", out)
