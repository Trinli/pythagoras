# Triangle Solver

A small standalone PWA: enter any 3 sides and/or angles of a triangle, and it
computes the rest and draws the triangle to scale. See [requirements.md](requirements.md)
for the full spec.

No build step — it's plain HTML/CSS/JS.

## Run locally

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000 in a browser.

## Deploy to GitHub Pages

```sh
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```

Then in the repo on GitHub: **Settings → Pages → Source: Deploy from a branch →
Branch: main, folder: / (root)**.

All paths in this project are relative (`./`, `icons/...`, etc.), so it works
whether it's served from the repo root or from a subpath like
`https://<user>.github.io/pythagoras/` — no configuration needed.

Once deployed, open the site on an iPhone (Safari → Share → Add to Home
Screen) or Android (Chrome → menu → Install app) to use it as a standalone
app.
