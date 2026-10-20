# F.C. Hertha 03 Zehlendorf (2014er) · 3D Football Heritage Museum & Hall of Fame Redesign

This plan transforms the 3D photo and video museum into a premier **Football Heritage Pavilion & Championship Hall of Fame** for F.C. Hertha 03 Zehlendorf (Jahrgang 2014), pairing architectural stadium-tunnel and trophy-room 3D spaces with a sleek, translucent dark-glass HUD and editorial sports typography.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following architectural and aesthetic choices incorporate your feedback and establish the scope of the redesign across both the 3D WebGL world and the 2D user interface:

- **Confirmed Decision 1 · Sport & Football Heritage Visual Direction**: The museum shifts from a generic classical parlor to an authentic **Football Club Heritage Pavilion & Hall of Fame** celebrating youth soccer photography and match films—featuring Hertha 03 Royal Blue (`#163B68` / `#1E4D8C`), Championship Gold (`#D4AF37`), crisp pitch-line architectural inlays, stadium floodlight track rigs, and matchday photography framing.
- **Confirmed Decision 2 · Comprehensive 3D & UI Scope**: We will upgrade the **3D Gallery Architecture, Lighting, Frames & Materials**, the **Elevator Lobby, Benches & Hall of Fame Details**, and the **Welcome Screen, Floor Directory & Curatorial HUD Overlays** while preserving all existing keyboard, mouse, touch, elevator, and cinema interactions.
- **Confirmed Decision 3 · Sleek Translucent Dark Glass HUD**: All 2D overlays (Welcome modal, Floor Directory drawer, Frame Curator panel, Cinema Programme, and floating HUD controls) will adopt a unified obsidian dark-glass aesthetic with crisp typography, subtle specular borders, and unobtrusive floating controls that leave the 3D viewport center completely clear.

---

## 1. Overview & Core Concept

- **What It Does**: An interactive first-person 3D football archive and virtual museum where players, families, and supporters walk through seasonal photo and video galleries, visit the Ground-Floor Hall of Fame, ride the stadium-pavilion elevator between seasons, curate individual frames with custom uploads, and watch match highlights in The Little Cinema.
- **Target Audience / Persona**: Players, parents, coaches, and supporters of F.C. Hertha 03 Zehlendorf (2014er cohort) exploring team memories across desktop and mobile devices.
- **Key Value**: Elevates personal youth-soccer photography and match videos into a museum-grade sports exhibition with dramatic architectural lighting, tactile 3D framing, and a cohesive, distraction-free dark-glass interface.

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Matchday Pavilion Welcome Overlay**: Visitors arrive at a sleek obsidian-glass welcome card showcasing the Hertha 03 Zehlendorf crest, collection statistics, direct quick-launch actions (*Enter the Gallery*, *Guided Tour*, *Select Season*, *Cinema Programme*), and a clean keyboard/touch reference grid.
2. **Hall of Fame & Seasonal Galleries (3D Exploration)**: Stepping into the Ground Floor (*Hall of Fame*), visitors walk along a championship runner flanked by royal-blue architectural walls, gold pilasters, and illuminated photography frames with brushed-brass and anodized-aluminum museum plaques. Seasonal floors feature warm oak parquetry with subtle pitch-line brass inlays, architectural skylight coffers, and leather-upholstered gallery benches.
3. **Elevator & Season Directory Flow**: Approaching the lobby elevator or pressing `M` opens the sleek dark-glass Season Directory drawer, displaying floor badges (`G`, `1`, `2`, …, `B`, `C`), season date ranges, and work counts. Selecting a floor triggers the physical 3D elevator door sequence and floor transition toast.
4. **Frame Curation & Inspection Flow**: Aiming at any photograph or video frame within 6 meters expands the minimal reticle and reveals a floating bottom caption card with the work's title and date. Clicking opens the dark-glass Curatorial Inspector to cycle works, switch framing modes (*Fit Frame*, *Matted*, *Fill*), or upload personal match photos/videos to IndexedDB.
5. **Cinema Screening Flow**: Riding to floor `C` (*The Little Cinema*) or clicking the screen opens the dark-glass Cinema Programme drawer with 16:9 film cards, active screening indicators, and a compact bottom playback bar while seated.

### Visual Identity & Theme
- **Aesthetic Direction**: **Modern Football Heritage Pavilion & Dark-Glass Spatial HUD**—combining the prestige of a European football club museum (UEFA/FIFA Hall of Fame atmosphere) with contemporary spatial UI design.
- **Color Palette & Mood (60-30-10 Discipline)**:
  - **60% Dominant Canvas & Surfaces**: Deep Obsidian Glass (`rgba(12, 16, 23, 0.88)`) for UI overlays; Warm Architectural Limestone (`#EFECE6`) for seasonal gallery walls and Deep Stadium Navy (`#0D1F38`) for the Hall of Fame.
  - **30% Structural Surfaces & Framing**: Anodized Charcoal (`#161920`), Brushed Steel (`#8F9AA6`), Warm Oak Flooring, and subtle hairline borders (`rgba(255, 255, 255, 0.10)`).
  - **10% Accent Budget**: Hertha Royal Blue (`#1E56A0`) for primary interactive actions and active states, paired with Championship Gold (`#D4AF37`) for Hall of Fame trim, active floor indicators, and curatorial highlights.
- **Typography & Hierarchy (2+1 Font System)**:
  - **Display & Titles**: `Outfit` (geometric, athletic-modern display sans) paired with `Cormorant Garamond` for curatorial artwork plaques and ceremonial Hall of Fame headers.
  - **Body & UI Controls**: `Plus Jakarta Sans` for crisp, high-legibility HUD controls, descriptions, and buttons.
  - **Tabular Metrics & Badges**: Tabular numerals (`font-variant-numeric: tabular-nums`) for floor numbers, work counts, and keyboard shortcut badges.
- **Component Styling & Spatial Layout**:
  - **Floating Top Utility Pills**: Clean, single-line dark-glass controls at top-left (*Season / Floor Selector* and *Cinema Programme*) and top-right (*Background Music Toggle*), keeping the central 90% of the 3D viewport completely unobstructed.
  - **Zero-Pill Metadata Discipline**: Static metadata (dates, work counts, frame IDs) rendered as clean inline text with middle-dot (`·`) separators; interactive controls styled as tactile dark-glass buttons and segmented tabs.

### Interactive Feedback & Motion
- **Reticle & Caption Micro-Interactions**: Smooth 180ms transform and opacity transitions on the center reticle and bottom artwork caption card whenraycasting over frames or lobby controls.
- **3D Lighting & Material Polish**: ACES Filmic tone mapping with calibrated exposure, warm-cool hemisphere lighting contrast, soft directional spotlight cones on artwork frames, and high-resolution procedural canvas textures for signage and plaques.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 · Athletic Heritage + Curatorial Elegance Hybrid**:
  - *Chosen Approach*: Blend football-inspired architectural details (royal blue & gold Hall of Fame, stadium tunnel lighting accents, pitch-inspired geometry lines, tufted leather benches) with high-end gallery framing.
  - *Why*: Pure stadium concrete feels cold for family/team memories, whereas a Victorian art parlor feels disconnected from youth soccer. A modern Club Heritage Museum honors the sport while treating every player photo like a masterpiece.
  - *Alternatives Considered*: Generic white-cube gallery (too sterile) or outdoor pitch simulation (distracts from framed photography and video playback).
- **Decision 2 · High-Contrast Dark Glass UI Overlays**:
  - *Chosen Approach*: Unify all panels (`Overlay`, `FloorPanel`, `EditorPanel`, `CinemaPanel`, `Hud`, and floating buttons) under a cohesive dark-glass token system (`--glass-bg`, `--glass-border`, `--accent-blue`, `--accent-gold`).
  - *Why*: Previously, panels mixed bright paper-white drawers with dark cinema drawers. A unified dark-glass HUD reduces eye strain when transitioning between bright seasonal galleries, the navy Hall of Fame, and the darkened Cinema room, while making photographs pop.
- **Decision 3 · Procedural 3D Detail & Zero-Regression Lifecycle**:
  - *Chosen Approach*: Enhance procedural textures (wood grain, championship runner, velvet curtains, high-DPI signage, and plaque typography) and composite 3D architectural fixtures while keeping exact interaction target coordinates and resource disposal lifecycles intact.
  - *Why*: Guarantees 60fps performance, zero external 404 assets, and 100% compatibility with the existing automated test suite.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### Architecture & Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        App State & Controllers                          │
│   MediaLibrary · Curator · Lobby (Elevator) · CinemaHandle · Music      │
└───────────────────┬─────────────────────────────────┬───────────────────┘
                    │                                 │
                    ▼                                 ▼
┌───────────────────────────────────────┐ ┌───────────────────────────────┐
│        3D WebGL Scene (R3F)           │ │   Sleek Dark-Glass 2D HUD     │
│ ┌───────────────────────────────────┐ │ │ ┌───────────────────────────┐ │
│ │ MuseumEnvironment                 │ │ │ │ Floating Top Bar Controls │ │
│ │ · Royal Blue / Limestone Halls    │ │ │ │ · Floor / Season Trigger  │ │
│ │ · Coffered Skylights & Track Rig  │ │ │ │ · Cinema & Music Toggles  │ │
│ │ · Tufted Stadium-Lounge Benches   │ │ │ └───────────────────────────┘ │
│ │ · Hall of Fame Gold Trim & Runner │ │ │ ┌───────────────────────────┐ │
│ └───────────────────────────────────┘ │ │ │ Hud (Center / Bottom)     │ │
│ ┌───────────────────────────────────┐ │ │ │ · Dynamic Reticle         │ │
│ │ MuseumLobby & MuseumFrames        │ │ │ │ · Glass Artwork Caption   │ │
│ │ · Brushed Steel & Brass Elevator  │ │ │ │ · Progress & Status Toast │ │
│ │ · High-DPI Club Directory Sign    │ │ │ └───────────────────────────┘ │
│ │ · Beveled Frames & Museum Plaques │ │ │ ┌───────────────────────────┐ │
│ └───────────────────────────────────┘ │ │ │ Slide-Over Glass Drawers  │ │
│ ┌───────────────────────────────────┐ │ │ │ · Welcome Overlay Modal   │ │
│ │ MuseumCinema                      │ │ │ │ · Season Directory Drawer │ │
│ │ · Velvet Proscenium & Seating     │ │ │ │ · Frame Curator Inspector │ │
│ └───────────────────────────────────┘ │ │ │ · Cinema Programme & Bar  │ │
└───────────────────────────────────────┘ └─┴───────────────────────────┴─┘
```

### Data Model & State
- **Floor & Collection State**: Managed in `App` via `MediaLibrary` and `Curator`, organizing works into `HALL_OF_FAME_FLOOR` (`G`), dated seasonal floors (`1..N`), `undated` archive (`B`), and `CINEMA_FLOOR` (`C`).
- **Frame Controller State**: Each `ArtworkFrameController` manages asynchronous texture/video loading, aspect-ratio fitting (`auto`, `contain`, `cover`), distance-based video playback, and 3D plaque rendering.
- **UI Mode State**: `AppMode` (`intro`, `explore`, `panel`, `touring`, `riding`, `watching`) and `Panel` (`none`, `floors`, `cinema`, `editor`) coordinate pointer lock, raycasting, and drawer visibility.

### Interactive Component & State Mapping
- **Welcome Modal (`Overlay`)**: Displays club emblem, live work counter, primary action buttons (`onEnter`, `onTour`, `onChooseFloors`, `onWatchCinema`), keybindings, and IndexedDB/Cache clear handler with status feedback.
- **Top Floating Controls & `FloorPanel`**: Clicking `#floorButton` or 3D lobby targets opens `#floorPanel`, rendering interactive `.floor-choice` cards with floor badges, season titles, and work counts; selecting a floor invokes `rideElevator(index)`.
- **Curatorial Inspector (`EditorPanel`)**: Clicking a hovered 3D frame opens `#editor`, wiring `#shuffleFrame`, `#mediaInput` file upload, `.segmented` fit-mode buttons (`auto`, `contain`, `cover`), and `#resetFrame` to `Curator` methods with busy-state protection.
- **Cinema Suite (`CinemaPanel` & `CinemaViewing`)**: Selecting a `.film-card` projects the film onto the 3D screen and transitions to `watching` mode with the bottom `#cinemaViewing` transport dock (*Play/Pause*, *Stop*, *Programme*, *Stand up*).
