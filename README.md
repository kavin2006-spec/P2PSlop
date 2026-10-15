# P2P (working title)

A private, serverless peer-to-peer game launcher for me and my friends.
Play retro couch co-op games and old shooters (starting with Quake 3) together in the browser,
with direct WebRTC connections, private rooms, and built-in network telemetry and fault injection.

## Status
Phase 0 in progress: the Network Lab works (manual invite/reply connection, ping telemetry, fault injector).
Next: test it with real friends, then Trystero rooms. See `docs/roadmap.md`.

## Layout
- `site/`       everything GitHub Pages will serve (launcher, Network Lab, JS modules)
- `docs/`       architecture, decisions log, roadmap, measured test logs
- `tools/`      local dev server and helper scripts
- `tests/`      unit tests for the logic (telemetry math, fault injector, connection codes)
- `local-data/` my own game files during development (gitignored, never published)

## Running locally
Needs Node 20+ (no dependencies to install).

    npm run serve     # then open http://localhost:8080/lab.html
    npm test          # unit tests

No Node? Any static server works, e.g. `python -m http.server 8080 --directory site`.

To test two tabs on one machine without STUN, open `lab.html?stun=off` in both.

## Using the Network Lab
1. Host: press "Create invite", send the text to your friend.
2. Friend: paste it under "Join", press "Create reply", send the reply back.
3. Host: paste the reply, press "Connect".
Then watch the telemetry. Use the same fault-injection preset on both sides to simulate bad networks.
Record results for each friend in `docs/test-logs/` (copy `TEMPLATE.md`).

## Hosting
Pushing to `main` runs the tests and publishes `site/` to GitHub Pages
(`.github/workflows/pages.yml`). In the repo settings, Pages > Source must be "GitHub Actions".
The Network Lab lives at `<pages-url>/lab.html`.

## Game data and legality
No ROMs, game data or proprietary assets are included or ever uploaded.
Each player loads their own legally obtained files from their own disk.
