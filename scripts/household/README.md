# Household helpers

Small scripts the LMS chats use to change live data the way the app does, through the API with the
access key in `~/.config/lms/production.env`. Nothing here touches the database directly. Run them
from WSL as `shades`, e.g. `node ~/shades/lms/scripts/household/use.mjs "Coca-Cola" 2142.5 ml`.

| Script | What it does |
| --- | --- |
| `api.mjs` | `api(method, path, body)` and `raw(path)` for anything else |
| `use.mjs` | Marks food used (eaten, drunk, thrown out) by exact product name |
| `closet.mjs` | Adds a garment with photos, label data and its place |
| `photo.mjs` | Adds or saves a closet photo; uploads a Claude vector drawing |
| `letters.mjs` | Turns SVG `<text>` into strokes before a drawing is uploaded |

One-off specs and photos for a task go in a temp folder, not here. They used to live in `/tmp/recipes`,
which a restart wipes.
