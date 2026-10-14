import React, { useEffect, useRef, useState, useCallback } from 'react';
import './styles.css';
import { CONFIG } from './config.js';
import { deviceProfile } from './core/deviceProfile.js';
import { createLayout } from './world/layout.js';
import { buildHall, setupAtmosphere } from './world/environment.js';
import { Lobby } from './world/lobby.js';
import { MediaFrame } from './world/frame.js';
import { CinemaHall } from './world/cinema.js';
import { MediaLibrary } from './media/library.js';
import { Curator } from './media/curator.js';
import { CINEMA_FLOOR, YOUTUBE_FILMS } from './cinema/programme.js';
import {
  BACKGROUND_MUSIC_URL,
  HALL_OF_FAME_FEATURE,
  HALL_OF_FAME_FLOOR,
  HALL_OF_FAME_ITEMS,
} from './fame/programme.js';
import { PlayerController } from './controls/player.js';
import { createCollisionChecker } from './controls/collision.js';
import { Interactions } from './controls/interactions.js';
import { CinematicTour } from './controls/tour.js';
import { BackgroundMusic } from './ui/music.js';

import { MuseumCanvas } from './components/MuseumCanvas.jsx';
import { Overlay } from './components/Overlay.jsx';
import { TouchControls } from './components/TouchControls.jsx';
import { FloorPanel } from './components/FloorPanel.jsx';
import { CinemaPanel } from './components/CinemaPanel.jsx';
import { CinemaViewing } from './components/CinemaViewing.jsx';
import { EditorPanel } from './components/EditorPanel.jsx';
import { Hud } from './components/Hud.jsx';

const PROGRAMME_SECTIONS = [
  { heading: 'September 2026 · Five films', films: YOUTUBE_FILMS },
];

export function App() {
  const canvasRef = useRef(null);

  // App proxy mimicking core App interface for R3F compatibility
  const appProxyRef = useRef({
    renderer: null,
    camera: null,
    scene: null,
    canvas: null,
    profile: deviceProfile({
      coarsePointer: matchMedia('(pointer: coarse)').matches,
      width: window.innerWidth,
      deviceMemory: navigator.deviceMemory,
      saveData: navigator.connection?.saveData,
    }),
    get maxAnisotropy() {
      return Math.min(
        this.profile.anisotropy,
        this.renderer?.capabilities.getMaxAnisotropy() || 8
      );
    },
    mediaOptions: CONFIG.media,
  });

  // Core state
  const [collectionSize, setCollectionSize] = useState(null);
  const [floors, setFloors] = useState([]);
  const [currentFloorIndex, setCurrentFloorIndex] = useState(0);
  const [mode, setMode] = useState('intro'); // 'intro'|'explore'|'panel'|'touring'|'riding'|'watching'
  const [activePanel, setActivePanel] = useState('none'); // 'none'|'floors'|'cinema'|'editor'
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [enterLabel, setEnterLabel] = useState('Enter the gallery');
  const [hasCinema, setHasCinema] = useState(false);

  // Declarative R3F Scene State
  const [worldState, setWorldState] = useState({
    environment: null,
    lobby: null,
    cinema: null,
    frames: [],
  });

  // Cinema playback state
  const [cinemaState, setCinemaState] = useState({
    nowPlaying: null,
    loading: null,
    film: null,
    isWatching: false,
  });

  // Editor state
  const [editorState, setEditorState] = useState({
    frame: null,
    isBusy: false,
    statusMessage: '',
  });

  // HUD state
  const [hoverCaption, setHoverCaption] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState({ pending: 0, done: 0 });
  const [isTouring, setIsTouring] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Audio & touch state
  const [musicState, setMusicState] = useState({ wanted: true, playing: false });
  const [touchAvailable, setTouchAvailable] = useState(false);
  const [touchVisible, setTouchVisible] = useState(false);

  // Internal mutable refs for 3D world objects and listeners
  const engineRef = useRef({
    app: appProxyRef.current,
    library: null,
    floors: [],
    currentFloor: 0,
    layout: null,
    environment: null,
    frames: [],
    curator: null,
    atmosphere: null,
    ambientBase: null,
    lobby: null,
    cinema: null,
    player: null,
    tour: null,
    interactions: null,
    music: null,
    mode: 'intro',
    activePanel: 'none',
    toastTimer: null,
  });

  const showToast = useCallback((msg, ms = 2400) => {
    setToastMessage(msg);
    clearTimeout(engineRef.current.toastTimer);
    engineRef.current.toastTimer = setTimeout(() => {
      setToastMessage('');
    }, ms);
  }, []);

  const setWatchingUI = useCallback((watching) => {
    document.body.classList.toggle('cinema-watching', watching);
    setCinemaState((prev) => ({ ...prev, isWatching: watching }));
    engineRef.current.cinema?.videoScreen.setInteractive(watching);
  }, []);

  const startWatching = useCallback(() => {
    const { cinema, app, player } = engineRef.current;
    if (!cinema || !app?.camera) return;
    setActivePanel('none');
    setOverlayVisible(false);
    setMode('watching');
    engineRef.current.mode = 'watching';
    engineRef.current.activePanel = 'none';

    player.standUp();
    player.clearInput();
    player.enabled = false;
    player.unlock();

    app.camera.position.copy(cinema.viewingPosition());
    app.camera.lookAt(cinema.lookAtScreen());
    player.syncFromCamera();
    setHoverCaption(null);
    setWatchingUI(true);
  }, [setWatchingUI]);

  const leaveWatching = useCallback(() => {
    setWatchingUI(false);
    setMode('explore');
    engineRef.current.mode = 'explore';
    const { player } = engineRef.current;
    player.syncFromCamera();
    player.enabled = true;
    player.lock();
  }, [setWatchingUI]);

  const closePanel = useCallback(
    (resume) => {
      const { activePanel: currentPanel, cinema, curator, player } = engineRef.current;
      if (currentPanel === 'cinema' && cinema?.film) {
        startWatching();
        return;
      }
      setActivePanel('none');
      engineRef.current.activePanel = 'none';
      if (curator) curator.preferredFrame = null;
      setMode('explore');
      engineRef.current.mode = 'explore';
      if (player) {
        player.enabled = true;
        if (resume) {
          player.lock();
        } else {
          setEnterLabel('Continue');
          setOverlayVisible(true);
        }
      }
    },
    [startWatching]
  );

  const openPanel = useCallback(
    (panelType, ...args) => {
      setWatchingUI(false);
      setOverlayVisible(false);
      setMode('panel');
      setActivePanel(panelType);
      engineRef.current.mode = 'panel';
      engineRef.current.activePanel = panelType;
      setHoverCaption(null);

      const { player } = engineRef.current;
      if (player) {
        player.unlock();
        player.clearInput();
        player.enabled = false;
      }

      if (panelType === 'editor') {
        const frame = args[0];
        setEditorState({
          frame,
          isBusy: false,
          statusMessage: 'Uploads stay in this browser (IndexedDB).',
        });
      }
    },
    [setWatchingUI]
  );

  const startTour = useCallback(() => {
    const { cinema, player, tour } = engineRef.current;
    if (cinema) {
      setOverlayVisible(false);
      openPanel('cinema');
      return;
    }
    setMode('touring');
    engineRef.current.mode = 'touring';
    player.standUp();
    player.enabled = false;
    player.clearInput();
    player.unlock();
    setHoverCaption(null);
    setIsTouring(true);
    tour.start();
  }, [openPanel]);

  const stopTour = useCallback(() => {
    const { tour, player } = engineRef.current;
    tour.stop();
    setIsTouring(false);
    player.syncFromCamera();
    player.enabled = true;
    setMode('explore');
    engineRef.current.mode = 'explore';
    player.lock();
  }, []);

  const placeInElevator = useCallback(() => {
    const { player, app, lobby } = engineRef.current;
    if (!app?.camera) return;
    player.standUp();
    player.velocity.set(0, 0, 0);
    player.keys.clear();
    app.camera.position.fromArray(lobby.cabinPosition);
    player.euler.set(0, lobby.cabinYaw, 0);
    app.camera.quaternion.setFromEuler(player.euler);
  }, []);

  const showFloors = useCallback(() => {
    if (engineRef.current.mode === 'riding') return;
    if (engineRef.current.mode === 'touring') {
      engineRef.current.tour.stop();
      setIsTouring(false);
      engineRef.current.player.enabled = true;
      engineRef.current.player.syncFromCamera();
    }
    setOverlayVisible(false);
    engineRef.current.lobby?.openDoors();
    openPanel('floors');
  }, [openPanel]);

  const createCinema = useCallback(() => {
    const { layout, atmosphere, ambientBase } = engineRef.current;
    const app = appProxyRef.current;
    const cinema = new CinemaHall(app, layout.cinema, {
      setAmbient(factor) {
        if (atmosphere?.hemisphere) {
          atmosphere.hemisphere.intensity = ambientBase.hemisphere * factor;
        }
        if (app.scene) {
          app.scene.environmentIntensity = ambientBase.env * factor;
        }
      },
    });
    cinema.onChange = () => {
      setCinemaState({
        nowPlaying: cinema.nowPlaying,
        loading: cinema.loading,
        film: cinema.film,
        isWatching: engineRef.current.mode === 'watching',
      });
    };
    engineRef.current.cinema = cinema;
    setHasCinema(true);
    return cinema;
  }, []);

  const switchFloor = useCallback(
    (index, initial = false) => {
      const eng = engineRef.current;
      const { floors: allFloors } = eng;
      const app = appProxyRef.current;
      if (!allFloors[index] || (!initial && index === eng.currentFloor)) return;

      closePanel(true);
      setWatchingUI(false);
      eng.cinema?.dispose();
      eng.cinema = null;
      setHasCinema(false);
      setCinemaState({ nowPlaying: null, loading: null, film: null, isWatching: false });

      eng.curator?.dispose();
      for (const frame of eng.frames) frame.dispose();

      if (!initial) {
        eng.environment?.dispose();
        eng.layout = createLayout(allFloors[index]);
        eng.environment = buildHall(app, eng.layout);
      }

      eng.currentFloor = index;
      setCurrentFloorIndex(index);

      eng.frames = eng.layout.slots.map((slot) => new MediaFrame(slot));

      eng.curator = new Curator(eng.frames, eng.library, {
        media: app.mediaOptions,
        anisotropy: Math.min(8, app.maxAnisotropy),
        onProgress: (p) => {
          setLoadingProgress(p);
          if (eng.activePanel === 'editor') {
            setEditorState((prev) => ({ ...prev, frame: prev.frame }));
          }
        },
      });

      eng.interactions.clear();
      eng.interactions.addOccluders(eng.environment.walls);
      for (const frame of eng.frames) {
        eng.interactions.add(frame.hitTargets, {
          caption: () =>
            frame.item && {
              title: frame.item.title,
              subtitle: `${frame.item.subtitle} · click to curate`,
            },
          activate: () => openPanel('editor', frame),
        });
      }

      eng.lobby.registerInteractions(eng.interactions, showFloors);

      if (eng.layout.cinema) {
        const cinema = createCinema();
        cinema.registerInteractions(eng.interactions, {
          onScreen: () => openPanel('cinema'),
          onSeat: (seat) => eng.player.sit(seat),
        });
      }

      eng.player.standUp();
      eng.player.velocity.set(0, 0, 0);
      eng.player.keys.clear();

      const collides = createCollisionChecker(eng.layout.colliders, CONFIG.player.radius);
      eng.player.collides = (position) =>
        collides(position) || eng.lobby.blocksDoor(position, CONFIG.player.radius);

      if (app.camera) {
        app.camera.position.fromArray(eng.layout.start.position);
        eng.player.euler.set(0, eng.layout.start.yaw, 0);
        app.camera.quaternion.setFromEuler(eng.player.euler);
      }

      eng.tour.setFrames(eng.frames);
      eng.lobby.setCurrent(index);

      setLoadingProgress({ pending: 0, done: 0 });
      eng.curator.hangAll();

      // Update declarative R3F world state
      setWorldState({
        environment: eng.environment,
        lobby: eng.lobby,
        cinema: eng.cinema,
        frames: eng.frames,
      });
    },
    [closePanel, createCinema, openPanel, setWatchingUI, showFloors]
  );

  const rideElevator = useCallback(
    (index) => {
      const eng = engineRef.current;
      const { floors: allFloors } = eng;
      if (eng.mode === 'riding' || !allFloors[index]) return;
      if (index === eng.currentFloor) {
        closePanel(true);
        return;
      }
      closePanel(true);
      setMode('riding');
      eng.mode = 'riding';
      eng.player.enabled = false;
      placeInElevator();
      showToast(`Elevator · ${allFloors[index].label}`, 2600);

      eng.lobby.travelTo(
        index,
        () => {
          switchFloor(index);
          placeInElevator();
        },
        () => {
          setMode('explore');
          eng.mode = 'explore';
          eng.player.enabled = true;
          showToast(
            eng.cinema
              ? 'Arrived · The Little Cinema · click the screen to choose a film'
              : `Arrived · ${allFloors[index].label}`,
            eng.cinema ? 4200 : 2400
          );
          if (!eng.player.active) {
            setEnterLabel('Continue');
            setOverlayVisible(true);
          }
        }
      );
    },
    [closePanel, placeInElevator, showToast, switchFloor]
  );

  // Initialize the 3D gallery data and controllers
  useEffect(() => {
    let mounted = true;
    const eng = engineRef.current;
    const app = appProxyRef.current;

    async function init() {
      setTouchAvailable(app.profile.touch);

      const library = await MediaLibrary.load(CONFIG.media.manifestUrl, {
        hidden: CONFIG.media.hidden,
      });
      if (!mounted) return;
      eng.library = library;

      const floorList = library.floors();
      library.add([...HALL_OF_FAME_ITEMS, HALL_OF_FAME_FEATURE]);
      floorList.unshift(HALL_OF_FAME_FLOOR);
      floorList.push(CINEMA_FLOOR);

      eng.floors = floorList;
      setFloors(floorList);
      setCollectionSize(library.size);

      eng.currentFloor = 0;
      eng.layout = createLayout(floorList[0]);
      eng.environment = buildHall(app, eng.layout);
      eng.atmosphere = setupAtmosphere(app);
      eng.ambientBase = {
        hemisphere: eng.atmosphere.hemisphere.intensity,
        env: 0.32,
      };

      eng.lobby = new Lobby(floorList);

      eng.player = new PlayerController(app.camera, app.canvas, {
        ...CONFIG.player,
        start: eng.layout.start,
        collides: createCollisionChecker(eng.layout.colliders, CONFIG.player.radius),
      });

      eng.tour = new CinematicTour(app.camera, eng.frames, {
        ...CONFIG.tour,
        eyeHeight: CONFIG.player.eyeHeight,
      });

      eng.interactions = new Interactions(app.camera);

      eng.music = new BackgroundMusic(BACKGROUND_MUSIC_URL, {
        onChange: ({ wanted, playing }) => {
          setMusicState({ wanted, playing });
        },
      });

      switchFloor(0, true);

      // Devtools exposure
      if (import.meta.env.DEV) {
        Object.assign(window, {
          museum: {
            app,
            library,
            floors: floorList,
            tour: eng.tour,
            player: eng.player,
            lobby: eng.lobby,
            music: eng.music,
            switchFloor,
            rideElevator,
            get cinema() { return eng.cinema; },
            get layout() { return eng.layout; },
            get frames() { return eng.frames; },
            get curator() { return eng.curator; },
            get currentFloor() { return eng.currentFloor; },
          },
        });
      }
    }

    init();

    return () => {
      mounted = false;
      eng.cinema?.dispose();
      eng.curator?.dispose();
      for (const frame of eng.frames) frame.dispose();
      eng.environment?.dispose();
    };
  }, [createCinema, rideElevator, switchFloor]);

  // Sync eng.overlayVisible
  useEffect(() => {
    engineRef.current.overlayVisible = overlayVisible;
  }, [overlayVisible]);

  // Pointer lock change listener
  useEffect(() => {
    const onPointerLockChange = () => {
      const eng = engineRef.current;
      if (!eng.player?.active && eng.mode === 'explore') {
        setHoverCaption(null);
        setEnterLabel('Continue');
        setOverlayVisible(true);
      }
    };
    document.addEventListener('pointerlockchange', onPointerLockChange);
    return () => {
      document.removeEventListener('pointerlockchange', onPointerLockChange);
    };
  }, []);

  // Canvas click listener
  const handleCanvasClick = useCallback(() => {
    const eng = engineRef.current;
    if (eng.mode === 'touring') {
      stopTour();
      return;
    }
    if (eng.mode !== 'explore') return;
    if (eng.player?.touchEnabled) return;
    if (!eng.player?.locked) {
      setOverlayVisible(false);
      eng.player?.lock();
      return;
    }
    const picked = eng.interactions?.pick();
    picked?.target.activate(picked.hit);
  }, [stopTour]);

  // Global keydown listener
  useEffect(() => {
    const onKeyDown = (e) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      const eng = engineRef.current;
      if (e.code === 'KeyM') {
        showFloors();
        return;
      }
      if (e.code === 'KeyB') {
        eng.music?.toggle();
        showToast(
          eng.music?.wanted ? 'Background music on · B to stop' : 'Background music off'
        );
        return;
      }
      if (e.code === 'Escape' && eng.mode === 'watching') {
        leaveWatching();
        return;
      }
      if (e.code === 'Escape' && eng.mode === 'panel') {
        closePanel(false);
        return;
      }
      if (e.code === 'Escape' && eng.mode === 'touring') {
        stopTour();
        return;
      }
      if (e.code === 'KeyC' && (eng.mode === 'explore' || eng.mode === 'touring')) {
        if (eng.mode === 'touring') stopTour();
        else {
          setOverlayVisible(false);
          startTour();
        }
        return;
      }
      if (e.code === 'KeyR' && (eng.mode === 'explore' || eng.mode === 'touring')) {
        eng.curator?.shuffleAll();
        showToast('Rehanging the gallery…');
        return;
      }
      if (
        e.code === 'Space' &&
        eng.cinema?.film &&
        (eng.cinema.contains(appProxyRef.current.camera?.position) || eng.activePanel === 'cinema')
      ) {
        e.preventDefault();
        eng.cinema.togglePause();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closePanel, leaveWatching, showFloors, showToast, startTour, stopTour]);

  // Handle window resize camera sync during cinema watching
  useEffect(() => {
    const onResize = () => {
      const eng = engineRef.current;
      const app = appProxyRef.current;
      if (eng.mode !== 'watching' || !eng.cinema || !app?.camera) return;
      app.camera.position.copy(eng.cinema.viewingPosition());
      app.camera.lookAt(eng.cinema.lookAtScreen());
      eng.player.syncFromCamera();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Frame curation handlers
  const handleEditorRun = async (action, successMsg) => {
    setEditorState((prev) => ({ ...prev, isBusy: true }));
    try {
      await action();
      setEditorState((prev) => ({
        ...prev,
        isBusy: false,
        statusMessage: successMsg || '',
      }));
    } catch (err) {
      console.error(err);
      setEditorState((prev) => ({
        ...prev,
        isBusy: false,
        statusMessage: err.message || 'Something went wrong.',
      }));
    }
  };

  const handleUpload = (file) => {
    const frame = editorState.frame;
    if (!frame) return;
    handleEditorRun(
      () => engineRef.current.curator.upload(frame, file),
      `Saved “${file.name}” to this frame.`
    );
  };

  const handleShuffle = () => {
    const frame = editorState.frame;
    if (!frame) return;
    handleEditorRun(
      () => engineRef.current.curator.shuffle(frame),
      'New piece hung.'
    );
  };

  const handleReset = () => {
    const frame = editorState.frame;
    if (!frame) return;
    handleEditorRun(
      () => engineRef.current.curator.reset(frame),
      'Upload removed.'
    );
  };

  const handleFit = (fit) => {
    const frame = editorState.frame;
    if (!frame) return;
    handleEditorRun(() => engineRef.current.curator.setFit(frame, fit));
  };

  const currentFloor = floors[currentFloorIndex];
  const floorButtonText = currentFloor
    ? `${currentFloor.label} · ${touchAvailable ? 'Change period' : 'M to change period'}`
    : 'Choose a time period';

  return (
    <>
      {/* Declarative React Three Fiber Canvas Renderer */}
      <MuseumCanvas
        canvasRef={canvasRef}
        onClick={handleCanvasClick}
        appProxy={appProxyRef.current}
        environment={worldState.environment}
        lobby={worldState.lobby}
        cinema={worldState.cinema}
        frames={worldState.frames}
        player={engineRef.current.player}
        tour={engineRef.current.tour}
        curator={engineRef.current.curator}
        interactions={engineRef.current.interactions}
        mode={mode}
        overlayVisible={overlayVisible}
        setHoverCaption={setHoverCaption}
        setTouchVisible={setTouchVisible}
      />

      {/* Welcome / Paused Overlay */}
      <Overlay
        visible={overlayVisible}
        enterLabel={enterLabel}
        collectionSize={collectionSize}
        hasCinema={hasCinema}
        onEnter={() => {
          setOverlayVisible(false);
          setMode('explore');
          engineRef.current.mode = 'explore';
          if (engineRef.current.player) {
            engineRef.current.player.enabled = true;
            engineRef.current.player.lock();
          }
        }}
        onTour={() => {
          setOverlayVisible(false);
          startTour();
        }}
        onChooseFloors={showFloors}
        onWatchCinema={() => openPanel('cinema')}
      />

      {/* Touch controls for coarse pointer / mobile devices */}
      <TouchControls
        visible={touchVisible}
        player={engineRef.current.player}
        canvasRef={canvasRef}
        onUse={() => {
          if (engineRef.current.mode === 'explore') {
            const picked = engineRef.current.interactions?.pick();
            picked?.target.activate(picked.hit);
          }
        }}
        onTour={() => {
          setOverlayVisible(false);
          startTour();
        }}
        onPause={() => {
          if (engineRef.current.mode !== 'explore') return;
          const { player } = engineRef.current;
          if (player) {
            player.clearInput();
            player.enabled = false;
          }
          setEnterLabel('Continue');
          setOverlayVisible(true);
        }}
      />

      {/* Top action buttons */}
      {hasCinema && (
        <button
          id="cinemaButton"
          className="pill"
          onClick={() => {
            if (mode !== 'riding' && engineRef.current.cinema) {
              openPanel('cinema');
            }
          }}
        >
          Cinema programme
        </button>
      )}

      <button
        id="musicButton"
        className="pill"
        aria-pressed={musicState.wanted ? 'true' : 'false'}
        aria-label={musicState.playing ? 'Pause background music' : 'Play background music'}
        title="Background music (B)"
        onClick={() => {
          engineRef.current.music?.toggle();
          showToast(
            engineRef.current.music?.wanted
              ? 'Background music on · B to stop'
              : 'Background music off'
          );
        }}
      >
        {musicState.playing ? '❚❚ Music' : '▶ Music'}
      </button>

      <button id="floorButton" className="pill" onClick={showFloors}>
        {floorButtonText}
      </button>

      {/* Lobby Elevator / Floor Directory Modal */}
      <FloorPanel
        isOpen={activePanel === 'floors'}
        floors={floors}
        currentIndex={currentFloorIndex}
        onSelect={rideElevator}
        onClose={() => closePanel(false)}
      />

      {/* Heads-up display: Crosshair, Hover caption, Progress bar, Tour badge, Toast */}
      <Hud
        hoverCaption={hoverCaption}
        loadingProgress={loadingProgress}
        isTouring={isTouring}
        toastMessage={toastMessage}
        isTouch={touchAvailable}
      />

      {/* Frame Curator Side Drawer */}
      <EditorPanel
        isOpen={activePanel === 'editor'}
        isBusy={editorState.isBusy}
        frame={editorState.frame}
        statusMessage={editorState.statusMessage}
        onUpload={handleUpload}
        onShuffle={handleShuffle}
        onReset={handleReset}
        onFit={handleFit}
        onClose={() => closePanel(true)}
      />

      {/* Cinema Programme Modal */}
      <CinemaPanel
        isOpen={activePanel === 'cinema'}
        nowPlaying={cinemaState.nowPlaying}
        loading={cinemaState.loading}
        film={cinemaState.film}
        sections={PROGRAMME_SECTIONS}
        onSelect={(film) => {
          const { cinema } = engineRef.current;
          if (!cinema) return;
          startWatching();
          cinema.project(film).catch((err) => {
            console.error(err);
          });
        }}
        onClose={() => closePanel(true)}
      />

      {/* Cinema Playback Viewing Toolbar */}
      <CinemaViewing
        visible={cinemaState.isWatching}
        film={cinemaState.film}
        loading={cinemaState.loading}
        onTogglePlay={() => engineRef.current.cinema?.togglePause()}
        onStop={() => engineRef.current.cinema?.stop()}
        onProgramme={() => openPanel('cinema')}
        onWalk={leaveWatching}
      />
    </>
  );
}
