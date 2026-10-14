# Migration to React Three Fiber (R3F) for Hertha 03 Zehlendorf Museum

Migrate the Hertha 03 Zehlendorf 2014er 3D gallery from an imperative Three.js lifecycle into a modern, declarative React Three Fiber (R3F) scene graph with `@react-three/drei`, preserving custom first-person physics, distance-based media streaming, and in-world cinema playback.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural decisions were confirmed during the interactive planning session:

- **Confirmed Decision 1 (Scene Composition)**: Fully declarative R3F component hierarchy (`<Canvas>`, `<MuseumEnvironment>`, `<LobbyElevator>`, `<MediaFrames>`, `<CinemaStage>`) replacing the imperative canvas runner in `app.js`.
- **Confirmed Decision 2 (Navigation & Collision)**: Port existing custom FPS walking kinematics, collision capsule detection against walls/doors, and the cinematic tour controller directly into R3F `useFrame` hooks.
- **Confirmed Decision 3 (Cinema Screen)**: Replace the detached CSS3DRenderer and overlay sync system with `@react-three/drei`'s `<Html transform>` component for a seamless, in-world responsive YouTube cinema screen.

---

### 1. Overview & Core Concept

- **What It Does**: Transforms the 3D museum experience for F.C. Hertha 03 Zehlendorf (2014 generation) into a declarative React component hierarchy. Visitors walk through the Hall of Fame, explore seasonal tournament halls, ride the elevator between periods, and sit in "The Little Cinema" to watch match films.
- **Target Audience & Persona**: Players, parents, coaches, and club supporters experiencing high-resolution youth football memories, tournament photos, and video archives in an intuitive 3D architectural setting.
- **Key Value**: Eliminates manual Three.js object lifecycle leaks, enables reactive React props and state propagation to 3D meshes, unifies HUD/modal overlays with 3D elements, and modernizes the YouTube cinema screen using Drei's transformative HTML projection.

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. *Entrance & Hall of Fame*: User enters on Floor 0 (Hall of Fame), welcomed by ambient lighting, warm wood acoustic panels, and the team's historic trophies and feature frames.
  2. *Elevator Travel*: User presses `M` or clicks the elevator panel to ride smoothly between tournament seasons, accompanied by animated elevator doors and arrival chime.
  3. *Media Inspection & Curation*: Visitors approach any frame to see unboxed contextual captions; clicking opens the curatorial drawer to swap images or adjust aspect fitting.
  4. *Cinema Screening*: In the Cinema Hall, visitors can click an armchair to sit or click the screen to launch YouTube match footage directly on the stage screen with theater dimming.
  5. *Cinematic Guided Tour*: Pressing `C` or clicking "Tour" transitions the camera into a smooth spline fly-through visiting each framed memory.

- **Visual Identity & Atmosphere**:
  - *Color Palette*: Team club blues (`#004B93`, `#0A2540`), crisp museum white, limestone plaster (`#EBE6DF`), rich walnut frames, and deep obsidian auditorium textiles.
  - *Lighting Rig*: 3-point studio lighting with a warm directional key light, cool hemisphere fill, PMREM `RoomEnvironment` reflections for trophy metals, and theater dimming when watching cinema films.
  - *Typographic Discipline*: Unboxed text metadata with `·` separators (no static pill capsules), clean editorial serif headlines for historical trophies, and tabular numerals for tournament match scores and dates.

- **Ergonomic Viewport & Controls**:
  - Unobstructed center viewport with quiet top navigation indicators (`whitespace-nowrap`).
  - Mobile touch virtual stick and tap affordances cleanly integrated with pointer lock states.
  - No synthetic glowing dots, fake status tickers, or intrusive side panels.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Declarative R3F Mesh Hierarchy vs Imperative Object Additions**
  - *Chosen Approach*: Break down `buildHall`, `Lobby`, `MediaFrame`, and `CinemaHall` into dedicated React components (`<HallMesh>`, `<ElevatorLobby>`, `<ArtworkFrame>`, `<CinemaHall>`) rendered inside `<Canvas>`.
  - *Why*: Enables React state (floor selection, curation uploads, video play state) to flow naturally via props and context, eliminating manual scene graph traversal and dangling listener leaks.
  - *Alternatives Considered*: Wrapping the imperative `ThreeApp` inside a React ref. Rejected because it prevents reactive updates and creates duplicate state synchronization bugs.

- **Decision 2: In-Engine FPS Physics in `useFrame`**
  - *Chosen Approach*: Keep the custom collision checker and velocity damping math intact, driving them within an R3F `<PlayerController>` component using `useFrame((state, delta) => ...)`.
  - *Why*: Preserves exact museum collision boundaries, stairs, and elevator door blocking without introducing external heavy physics engines.
  - *Alternatives Considered*: Standard Drei `PointerLockControls`. Rejected because Drei's basic controls lack collision detection against walls and elevator doors.

- **Decision 3: Drei `<Html transform>` for Cinema Screen**
  - *Chosen Approach*: Embed the YouTube player via Drei's `<Html transform occlude portal={...}>` mounted directly on the cinema screen plane.
  - *Why*: Automatically handles 3D perspective transformation, camera matrix projection, and pointer raycasting without a second manual `CSS3DRenderer` DOM loop.
  - *Alternatives Considered*: WebGL VideoTexture canvas streaming. Rejected because YouTube prevents direct raw cross-origin pixel extraction into WebGL textures.

---

### 4. Technical Architecture & Data Strategy

#### Architecture & Component Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                               App.jsx                                  │
│  State: currentFloorIndex, mode, activePanel, cinemaState, curator     │
└───────────┬──────────────────────────────────────────────┬─────────────┘
            │                                              │
            ▼                                              ▼
┌──────────────────────────────┐              ┌──────────────────────────┐
│         2D HUD & UI          │              │    R3F <MuseumCanvas>    │
│  - <Overlay>                 │              │  - ToneMapping & Lights  │
│  - <Hud> (crosshair, toast)  │              │  - Studio Environment    │
│  - <FloorPanel> (modal)      │              │  - PerspectiveCamera     │
│  - <EditorPanel> (drawer)    │              └────────────┬─────────────┘
│  - <CinemaPanel> (programme) │                           │
│  - <TouchControls>           │                           │
└──────────────────────────────┘                           │
                                                           ▼
                      ┌────────────────────────────────────────────────────────┐
                      │                   <MuseumWorld>                        │
                      │                                                        │
                      │  ┌──────────────────┐    ┌──────────────────────────┐  │
                      │  │ <Environment>    │    │ <ElevatorLobby>          │  │
                      │  │  - Walls/Floors  │    │  - Shaft & Cabin meshes  │  │
                      │  │  - Acoustic wood │    │  - Sliding animated doors│  │
                      │  │  - Plaque lights │    │  - Floor level call signs│  │
                      │  └──────────────────┘    └──────────────────────────┘  │
                      │                                                        │
                      │  ┌──────────────────┐    ┌──────────────────────────┐  │
                      │  │ <FramesCollection│    │ <CinemaStage>            │  │
                      │  │  - <MediaFrame>  │    │  - Tiered theater seating│  │
                      │  │  - Distance LOD  │    │  - Projector & stage rig │  │
                      │  │  - Raycast pick  │    │  - Drei <Html transform> │  │
                      │  │  - Art textures  │    │    (YouTube player)      │  │
                      │  └──────────────────┘    └──────────────────────────┘  │
                      │                                                        │
                      │  ┌──────────────────────────────────────────────────┐  │
                      │  │ Controllers in useFrame:                         │  │
                      │  │  - <PlayerController> (FPS & collision)          │  │
                      │  │  - <CinematicTourController> (smooth camera fly) │  │
                      │  │  - <CuratorSystem> (distance streaming)          │  │
                      │  └──────────────────────────────────────────────────┘  │
                      └────────────────────────────────────────────────────────┘
```

#### Package Dependencies Strategy
- Install `@react-three/fiber` and `@react-three/drei`.
- Verify full build and test compatibility with React 19 and Three.js 0.183.

#### Component & State Mapping
| React Component | R3F Responsibility | State & Event Handlers |
| :--- | :--- | :--- |
| `<MuseumCanvas>` | Canvas root, ACESFilmic, shadows, pixel ratio, Studio lighting | Manages viewport resize & camera binding |
| `<PlayerController>` | Custom FPS movement, keys, mouse look, eye height, collision | Updates camera position in `useFrame`, checks door/wall colliders |
| `<CinematicTourController>` | Interpolates camera along frame viewpoints | Activated when `mode === 'touring'` |
| `<MuseumEnvironment>` | Instanced floor tiles, acoustic wall panels, ceiling light coves | Reacts to layout changes when floor switches |
| `<ElevatorLobby>` | Elevator shaft, cabin, sliding door animations, travel lerp | Triggers `rideElevator` on floor select; plays chimes |
| `<MediaFrame>` | Beveled wood frame, glass reflection, plaque, canvas art | Distance-based mip/texture load, hover caption, click to edit |
| `<CinemaStage>` | Theater acoustic walls, tiered red velvet seats, stage trim | Click seat to sit, click screen to watch, theater lighting dimming |
| `<DreiCinemaScreen>` | Drei `<Html transform>` embedding YouTube player | Synchronized 3D perspective, pause/play, volume control |

---

### 5. Verification Plan

1. **Build & Lint Verification**:
   - Run `npm test` to ensure existing unit tests pass.
   - Run `compile_applet` to confirm clean compilation and zero module resolution issues.
2. **First-Person Walkthrough & Collision**:
   - Verify WASD and pointer lock navigation across Hall of Fame, tournament floors, and cinema.
   - Confirm player cannot walk through walls or closed elevator doors.
3. **Elevator Operation**:
   - Test riding the elevator between Floor 0 (Hall of Fame), tournament season floors, and the cinema floor.
4. **Media Curator & Frame Inspection**:
   - Verify artwork textures load smoothly based on camera distance.
   - Test clicking a frame to open the curator side drawer and update an image.
5. **Cinema Screening & YouTube**:
   - Travel to the cinema floor, sit in a seat, select a film from the programme, and confirm the YouTube video renders crisply in 3D perspective.
