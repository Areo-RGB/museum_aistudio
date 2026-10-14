# Hertha 03 Zehlendorf · 2014er Museum

A walkable React Three Fiber (R3F) 3D museum of the 111 images and videos described by
`public/media-manifest.json`, hosted in Cloudflare R2. Choose among nine seasonal
floors (including the undated archive) using the elevator recessed into the right-hand
wall, its wall-mounted directory, the welcome screen, or `M`. Every asset has its own ordinary frame; a
featured duplicate closes each floor. Month sections run in date order. Only the
selected floor exists, and textures stream in by distance. Switching floors
cancels pending media loads and disposes floor-owned GPU resources. The elevator
closes its doors during the change, then reopens with you inside the cabin on the
selected floor. Walk out through the doorway to explore.

Upload your own image or video to any frame (saved locally in IndexedDB).
Rehanging swaps works while keeping the floor's complete collection represented.

Through a door on the left, right inside the entrance, is **The Little Cinema**: rows of velvet seats, a big screen
between drapes, a projector beam and a starry ceiling. Click the screen to open the programme and
pick a film. The house lights dim while it plays, the screen's colour spills onto the room, and the
soundtrack is positional, so it fades as you walk out.

This prototype is derived from ideas and portions of the MIT-licensed **barisulgen/personal-museum** project. The original MIT license is preserved in `LICENSE`.

## Run

Node.js 24 is required (`.node-version` and the `engines` field pin the supported
runtime).

```bash
npm install
npm run dev
```

Quality and release commands:

```bash
npm run typecheck       # strict TypeScript source validation
npm run lint            # Oxlint via Vite+, including type-aware rules
npm run format:check    # Oxfmt validation
npm test                # Vitest behavioral suite (vp test)
npm run build           # Vite+ production build (vp build)
npm run check           # all of the gates above in release order
```

`npm run format` and `npm run lint:fix` apply safe automated fixes. npm is the
authoritative package manager and `package-lock.json` is the only committed lockfile.

## Deploy

Hosted on Cloudflare Workers (static assets) at **https://gallery.h03.uk**.

```bash
npm run deploy   # = cf deploy: builds with Vite+ and uploads to the Worker
```

`cloudflare.config.ts` holds the Worker settings; `domains: ['gallery.h03.uk']` attaches the custom
domain on the `h03.uk` zone (Cloudflare manages the DNS record and certificate). Build output goes
to `.cloudflare/output/` (git-ignored).

## Controls

| Input                          | Action                                                   |
| ------------------------------ | -------------------------------------------------------- |
| `WASD` / arrows                | walk (`Shift` to hurry)                                  |
| Mouse                          | look                                                     |
| Click a frame                  | open the curator panel                                   |
| `M` / click the lobby elevator | choose a time period                                     |
| `C`                            | guided tour (click or `C` again to take over)            |
| `R`                            | rehang every frame with new random pieces (uploads stay) |
| Click the cinema screen        | open the film programme                                  |
| Click a seat                   | sit down (any movement key stands you up)                |
| `Space`                        | pause / resume the film (in the cinema)                  |
| `Esc`                          | release the mouse                                        |

On touch devices, use the left stick to walk and drag the gallery to look. Aim
the crosshair and tap **Use** to curate, call the elevator, select a cinema film,
or sit. **Tour** starts the guided visit; tap the gallery to take over. **Menu**
pauses movement and opens the welcome controls. Panels support portrait and
landscape screens and device safe areas.

Rendering batches each frame's moulding and uses two draws for its caption.
Streaming decisions run five times per second; fades and movement stay smooth.
Phones, small viewports, low-memory and data-saving devices use 1024px image
textures, two concurrent media loads, two active gallery videos and a smaller
streaming radius. GPU pixel budgets cap high-DPI rendering. This lowers GPU
memory and decoding work; R2 still serves the original source files, so image
download sizes are unchanged. Hidden tabs skip rendering and pause video playback.

Visited photos are saved in the browser's disk cache (up to 96 MiB, 64 images,
12 MiB per image). Least recently used photos are evicted first; after seven
days a photo is revalidated online, with a saved copy available during network
outages. The manifest always checks for updates and keeps its last valid copy
as a network-failure fallback. **Clear downloaded photos** in the welcome/menu
screen frees the photo cache without removing uploads. Persistent caching needs
HTTPS or localhost and falls back to normal loading if storage is unavailable.
Videos retain native HTTP/range streaming. Fingerprinted JS/CSS assets have
one-year browser caching; HTML and the manifest revalidate so new deployments
and collection edits remain discoverable. This is not a fully offline app.

## Project structure

Application code is TypeScript/TSX. `App.tsx` owns application state and DOM
panels; the single R3F `MuseumCanvas.tsx` owns the active renderer, scene,
camera, and frame loop. Tooling (Oxlint, Oxfmt, Vitest, commit hooks) is
configured in `vite.config.js` via Vite+; the behavioral suite lives in
`tests/` and imports the runner from `vite-plus/test`.

```
src/
  main.tsx             React entry point
  App.tsx              application state, floor transitions, audio, and UI composition
  types.ts             shared media, floor, frame, loading, and layout-facing contracts
  core/
    deviceProfile.ts   conservative GPU/media budgets from viewport and memory
  fame/
    programme.ts       curated Hall of Fame works and background music
  components/
    r3f/
      MuseumCanvas.tsx       authoritative R3F Canvas and scene lifecycle
      MuseumEnvironment.tsx  declarative hall architecture, atmosphere, and lighting
      MuseumLobby.tsx        persistent elevator shaft, cabin, doors, and directory
      MuseumCinema.tsx       declarative cinema shell, stage, seats, and screen
      MuseumFrames.tsx        artwork frame components and interaction targets
      usePlayerControls.ts   first-person input, collision, touch, and movement physics
      useCinematicTour.ts    guided camera interpolation
    *.tsx                DOM panels, HUD, overlay, editor, and touch controls
  config.ts             typed tuning knobs and device/media budgets
  styles.css             museum UI and responsive layout
  world/
    layout.ts            pure floor, section, slot, wall, and collision calculations
    disposal.ts          owned-resource teardown for floor transitions
    lobby.ts             elevator state machine and floor naming
    frame.ts             frame assignment, fitting, loading, and owned media lifecycle
    cinema.ts            cinema playback/render binding boundary
    signage.ts           typed canvas signage and repaint lifecycle
    textures.ts          owned procedural textures
  media/
    library.ts, loader.ts, cache.ts, curator.ts
                         manifest, typed media loading, caching, assignment, and streaming
  cinema/
    programme.ts, films.ts, generators.ts, youtube.ts, screen.ts
                         programme metadata and playback/compositor services
  controls/
    collision.ts, interactions.ts, player.ts, tour.ts
                         pure collision and interaction registries plus movement services
  ui/music.ts            persistent background music and cinema hold lifecycle
  storage/db.ts          IndexedDB persistence for uploads
```

The TypeScript/R3F migration is documented in [`docs/migration.md`](docs/migration.md).
Pure layout and media calculations remain independent from rendering. R3F owns
the WebGL lifecycle; Three.js remains available for geometry, textures,
raycasting, video resources, and other low-level work. CSS3D is used only as a
cinema iframe compositor and does not create a second WebGL renderer or loop.

Common extensions:

- **Hall rhythm** — change spacing in `world/layout.ts`; slot IDs remain stable
  so upload persistence and curator assignments survive rehangs.
- **Different periods** — update the typed `periodFor()`/floor derivation in
  `media/library.ts`.
- **Real films** — add a typed entry to `cinema/programme.ts`; direct video
  hosts must send CORS headers.
- **Another media source** — add a `MediaItem` variant in `types.ts`, then
  implement loading/disposal in the media service rather than in a scene
  component.
- **A clickable world object** — register typed interaction targets with
  distance, occlusion, caption, activation, and unregister behavior.

## Media collection

`public/media-manifest.json` lists the bucket objects (`key`, `url`, `contentType`, ...). Images
(`image/*`) and videos (`video/*`) are supported; captions are derived from file names
(e.g. `IMG_20230115_105410.jpg` → "15 January 2023 · 10:54").

### Bucket layout and local mirror

The bucket is filed the way the museum is built (rules in `scripts/bucket-layout.js`):

```
floors/2023-1-spring/IMG_20230415_101500.jpg   one folder per seasonal floor (December → next winter)
floors/undated/...                              no date in the file name
hall-of-fame/...                                curated entrance-floor videos (src/fame/programme.ts)
music/Twelve_White_Walls.mp3                    background music
manifest.json                                   copy of public/media-manifest.json
```

`scripts/r2.mjs` keeps it that way, entirely through the `cf` CLI (list, get, put, delete) and its login:

```bash
npm run r2:mirror                       # sync the bucket to ~/R2/<bucket> (R2_MIRROR overrides); MD5-verified, moves instead of re-downloading
node scripts/r2.mjs organize            # dry run: where unfiled objects (e.g. new uploads at the root) would go
node scripts/r2.mjs organize --apply    # copy them into place and verify the copies
npm run r2:manifest                     # rebuild public/media-manifest.json (and upload it as manifest.json)
# deploy, check the live site, then:
node scripts/r2.mjs organize --delete-old   # remove the old keys (only those with a verified copy)
```

`CONFIG.media.hidden` lists file names, so hiding a work survives it being refiled.

WebGL needs CORS to sample cross-origin media. The bucket has this CORS rule applied:

```json
[
  {
    "allowed": { "origins": ["*"], "methods": ["GET", "HEAD"], "headers": ["Range"] },
    "exposeHeaders": ["Content-Length", "Content-Range", "ETag"],
    "maxAgeSeconds": 86400
  }
]
```

(`cf r2 buckets cors update <bucket> --rules '<json>'`). Restrict `origins` to your deployed domain if you prefer.
Collection URLs get a `?cors=1` suffix: R2 doesn't send `Vary: Origin`, so this keeps CORS responses
in their own browser-cache entry (R2 ignores the query string).

Images are downscaled to 2048 px before upload to the GPU. Textures are only loaded within
`loadDistance` of the visitor and freed beyond `unloadDistance`; the nearest six video textures can load at once, and videos only play while you're
nearby (see `config.ts`).

## Verification and workflow

Run the complete quality sequence before shipping:

```bash
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm run check
```

`CLAUDE.md` records the requested automatic commit, push-to-main, Cloudflare
deployment, and live-site verification workflow. Browser checks cover all-floor
manifest coverage, repeated switching, real R2 media, desktop controls, and
touch controls. Transient media failures show a retry caption and retry after
five seconds.
