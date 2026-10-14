# TypeScript and R3F migration

This document records the audited baseline, the dependency decisions, and the
contracts for the TypeScript/R3F migration. It is a design and integration
reference, not a claim that runtime validation has passed. The migration is
integrated on its dedicated branch, then the normal release workflow runs the
quality gates and browser checks before deployment.

## Audited baseline

The application already has a React 19 and React Three Fiber canvas, but its
ownership boundary was incomplete:

- `src/components/r3f/MuseumCanvas` owns the active R3F renderer, camera, scene,
  and render loop.
- `src/App` still coordinated imperative frame, lobby, and cinema objects and
  floor teardown.
- `src/core/app` was an unused second renderer/camera/loop implementation.
- Gallery frames and cinema playback combined domain state, WebGL resources,
  and orchestration in large imperative classes.
- Controls existed in both legacy controllers and R3F hooks.
- Media loading already had cancellation and disposal behavior, but its public
  data contracts were JavaScript documentation rather than checked types.
- CSS3D cinema output is a DOM compositor for a YouTube iframe. It is not a
  second WebGL renderer and must use the R3F camera/canvas boundary.

The migration preserves the visual design, floor order, stable slot IDs,
manifest data, upload persistence, media cache semantics, cinema programme,
first-person controls, touch controls, tours, elevator timing, and UI classes.

## Target ownership

There is one authoritative render lifecycle:

```text
App state and services
  -> MuseumCanvas <Canvas>
       -> environment + persistent lobby/atmosphere
       -> selected floor + frames OR cinema
       -> player/tour/interaction simulation through useFrame
```

| Domain                                      | Owner                                  | Boundary                                                               |
| ------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------- |
| React UI, mode transitions, floor selection | `App.tsx`                              | React state and typed service handles; no renderer construction        |
| Renderer, scene, camera, animation loop     | `MuseumCanvas.tsx` / R3F               | `Canvas`, `useThree`, `useFrame`; exactly one active WebGL owner       |
| Pure geometry and slot placement            | `world/layout.ts`                      | deterministic layout data; no React or GPU resources                   |
| Hall, lighting, atmosphere, lobby shell     | world R3F components                   | mounted component resources; dispose only owned resources              |
| Frame assignment and media lifecycle        | `world/frame.ts`, media services       | cancellation token, stale-result rejection, explicit ownership         |
| Floor collection and streaming              | `media/library.ts`, `media/curator.ts` | assignment coverage is independent of active video-texture budget      |
| Movement and camera tour                    | typed control hooks/controllers        | refs for per-frame simulation; React state only for UI-visible changes |
| Cinema programme and playback               | `cinema/*` services                    | playback borrows render bindings; leaving the cinema disposes playback |
| Elevator state machine                      | typed lobby handle                     | one ride/timer lifecycle; old rides cannot mutate a later floor        |
| CSS3D screen                                | cinema screen service                  | borrows R3F camera and canvas; no competing render loop                |
| Persistent uploads/cache                    | `storage/db.ts`, `media/cache.ts`      | IndexedDB/CacheStorage lifecycle independent of scene teardown         |

Shared media and frame contracts are defined in `src/types.ts`. Geometry,
controls, lobby, and cinema-specific types stay with their defining modules;
consumers import types rather than duplicate aliases. Public module imports use
explicit `.ts`/`.tsx` extensions where Node-side callers need to import native
TypeScript.

## Resource and performance rules

- A component disposes only resources it allocated. Shared frame geometry,
  materials, and textures survive individual frame/floor teardown.
- Loaded artwork, video textures, object URLs, film players, listeners, timers,
  and animation subscriptions are invalidated before owner unmount. A late
  asynchronous completion must dispose its own stale resource instead of
  attaching it to a removed frame.
- The curator may assign every work on a floor while `maxVideos` limits active
  video textures only. Rehanging swaps existing works and does not reduce
  collection coverage.
- Per-frame code reuses scratch vectors/objects and does not allocate arrays or
  callback closures. Frequently changing simulation values live in refs or
  mutable handles; UI changes are throttled to meaningful transitions.
- Floor replacement tears down floor-owned resources before mounting the next
  selected floor. Lobby and atmosphere persist across floor switches.
- The cinema programme can close while playback remains on the in-world screen.
  Leaving the cinema floor stops playback and destroys the iframe/CSS3D layer.
- R3F is responsible for WebGL renderer, camera, scene, and loop lifecycle.
  Imperative Three.js operations remain acceptable for raycasting, media/video
  resources, geometry construction, shaders, and other low-level work.

## Tooling and dependency decisions

Node 24.21.0 is pinned by `.node-version`, the `engines` field, and Volta metadata.
TypeScript 5 uses the strict source-only `tsconfig.json` contract. The compiler
checks `src/**/*.ts` and `src/**/*.tsx`; deployment configuration remains a
separate Cloudflare tool input rather than silently broadening application
strictness.

npm is authoritative. `package-lock.json` is regenerated by npm and `bun.lock`
was removed so CI and contributors do not resolve two different dependency
graphs. Do not use peer overrides, `--force`, or `--legacy-peer-deps`.

The lint stack was selected only after checking registry peers and published
flat-config APIs:

- ESLint 10 with `@eslint/js` 10
- `typescript-eslint` 8 with `strictTypeChecked` and `stylisticTypeChecked`
- React Hooks 7 flat recommended rules
- React Refresh 0.5 component-export rule
- Prettier 3 and `eslint-config-prettier` 10
- React/DOM types 19, Three types aligned to the retained Three 0.183 line,
  and Node types 24
- `@react-three/test-renderer` 9.1 for mounted R3F lifecycle coverage and
  `tsx` 4 for the Node test loader

`eslint.config.mjs` enables TypeScript Project Service for TS/TSX, applies Hooks
rules to both `.ts` and `.tsx`, and places Prettier last. Generated Cloudflare
output, dependencies, build output, vendored reference text, and public media
are ignored. `.cloudflare/` is explicitly ignored because it is generated by
`cf deploy`.

## Node-side scripts and tests

The existing `node:test` suite and R2 maintenance scripts remain JavaScript/MJS
and keep their commands. The test command preloads `tsx` so lifecycle tests can
mount migrated TSX components; Node 24 still does not execute `.tsx` natively.
Pure migrated utilities can use Node's erasable TypeScript support, while TSX
mount tests use the transform-capable harness. No `.js` compatibility
re-exports are retained solely for old imports.

Behavioral coverage must continue to include layout/floor switching, complete
artwork assignment, interaction and elevator transitions, movement/collision,
tours, cinema playback, loading cancellation, mounting/unmounting, and resource
disposal. Browser checks exercise the real app on desktop and touch-sized
viewports; unit tests alone do not prove R3F lifecycle ownership.

## Checks and integration workflow

Run the following from a clean migration checkout after all source slices land:

```bash
npm install
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
npm run check
```

`npm run check` is the release aggregate. Browser validation must additionally
cover initial Fame floor, repeated elevator switches, all seasonal floors,
curator upload/rehang/fit behavior, guided tours, five-film cinema playback,
programme-close persistence, leave-cinema teardown, music persistence/hold,
touch controls, offline/cache fallback, hidden-tab pause, and unmount cleanup.
Do not report a gate as passing unless that command was executed successfully.

For branch integration, keep the migration branch dedicated, reconcile remote
changes before integrating a slice, and preserve unrelated work. Resolve shared
contract changes at the defining module (`src/types.ts`, layout, controls,
lobby, or cinema) rather than adding aliases in consumers. Once gates and
browser checks pass, use the repository release workflow (`npm run deploy`) and
verify the live site at `https://gallery.h03.uk`.

## Necessary exceptions

- `cloudflare.config.ts` is deployment configuration and is intentionally not
  included by the application `tsconfig`; it is formatted and preserved by the
  Cloudflare toolchain.
- R2 scripts and `node:test` files remain JS/MJS to preserve their Node command
  surface. They use typed pure-module APIs through explicit extensions.
- CSS3D cinema DOM rendering is retained as a justified iframe compositor; it
  does not weaken the single-R3F-renderer rule.
- The ESLint non-null assertion rule is warning-level during migration, but new
  code should model absent values explicitly. No lint disable comments or
  unsafe `any` escape hatches are permitted.
