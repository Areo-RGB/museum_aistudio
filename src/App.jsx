import React, { useEffect, useRef, useState, useCallback } from 'react';
import './styles.css';
import { CONFIG } from './config.js';
import { createLayout } from './world/layout.js';
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
import { BackgroundMusic } from './ui/music.js';

import { MuseumCanvas } from './components/r3f/MuseumCanvas.jsx';
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
  // Core application state
  const [library, setLibrary] = useState(null);
  const [collectionSize, setCollectionSize] = useState(null);
  const [floors, setFloors] = useState([]);
  const [currentFloorIndex, setCurrentFloorIndex] = useState(0);
  const [layout, setLayout] = useState(null);
  const [frames, setFrames] = useState([]);
  const [curator, setCurator] = useState(null);
  const [cinemaHall, setCinemaHall] = useState(null);

  // UI state
  const [mode, setMode] = useState('intro'); // 'intro'|'explore'|'panel'|'touring'|'riding'|'watching'
  const [activePanel, setActivePanel] = useState('none'); // 'none'|'floors'|'cinema'|'editor'
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [enterLabel, setEnterLabel] = useState('Enter the gallery');
  const [hasCinema, setHasCinema] = useState(false);

  // Cinema playback state
  const [cinemaState, setCinemaState] = useState({
    nowPlaying: null,
    loading: null,
    film: null,
    isWatching: false,
  });

  // Editor drawer state
  const [editorState, setEditorState] = useState({
    frame: null,
    isBusy: false,
    statusMessage: '',
  });

  // HUD state
  const [hoverCaption, setHoverCaption] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState({ pending: 0, done: 0 });
  const [toastMessage, setToastMessage] = useState('');

  // Audio and mobile touch state
  const [musicState, setMusicState] = useState({ wanted: true, playing: false });
  const [touchAvailable, setTouchAvailable] = useState(false);
  const [touchVisible, setTouchVisible] = useState(false);

  // 3D scene bridge references
  const playerRef = useRef(null);
  const tourRef = useRef(null);
  const lobbyRef = useRef(null);
  const atmosphereRef = useRef(null);
  const musicRef = useRef(null);
  const toastTimerRef = useRef(null);

  const showToast = useCallback((msg, ms = 2400) => {
    setToastMessage(msg);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage('');
    }, ms);
  }, []);

  const setWatchingUI = useCallback(
    (watching) => {
      document.body.classList.toggle('cinema-watching', watching);
      setCinemaState((prev) => ({ ...prev, isWatching: watching }));
      cinemaHall?.videoScreen?.setInteractive(watching);
    },
    [cinemaHall]
  );

  const startWatching = useCallback(() => {
    if (!cinemaHall) return;
    setActivePanel('none');
    setOverlayVisible(false);
    setMode('watching');

    playerRef.current?.standUp?.();
    playerRef.current?.clearInput?.();
    playerRef.current?.unlock?.();

    setHoverCaption(null);
    setWatchingUI(true);
  }, [cinemaHall, setWatchingUI]);

  const leaveWatching = useCallback(() => {
    setWatchingUI(false);
    setMode('explore');
    playerRef.current?.syncFromCamera?.();
    playerRef.current?.lock?.();
  }, [setWatchingUI]);

  const closePanel = useCallback(
    (resume) => {
      if (activePanel === 'cinema' && cinemaHall?.film) {
        startWatching();
        return;
      }
      setActivePanel('none');
      if (curator) curator.preferredFrame = null;
      setMode('explore');
      if (resume) {
        playerRef.current?.lock?.();
      } else {
        setEnterLabel('Continue');
        setOverlayVisible(true);
      }
    },
    [activePanel, cinemaHall, curator, startWatching]
  );

  const openPanel = useCallback(
    (panelType, ...args) => {
      setWatchingUI(false);
      setOverlayVisible(false);
      setMode('panel');
      setActivePanel(panelType);
      setHoverCaption(null);

      playerRef.current?.unlock?.();
      playerRef.current?.clearInput?.();

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
    if (cinemaHall) {
      setOverlayVisible(false);
      openPanel('cinema');
      return;
    }
    setMode('touring');
    playerRef.current?.standUp?.();
    playerRef.current?.clearInput?.();
    playerRef.current?.unlock?.();
    setHoverCaption(null);
    tourRef.current?.start?.();
  }, [cinemaHall, openPanel]);

  const stopTour = useCallback(() => {
    tourRef.current?.stop?.();
    playerRef.current?.syncFromCamera?.();
    setMode('explore');
    playerRef.current?.lock?.();
  }, []);

  const placeInElevator = useCallback(() => {
    playerRef.current?.standUp?.();
    playerRef.current?.clearInput?.();
    if (lobbyRef.current) {
      playerRef.current?.euler?.set(0, lobbyRef.current.cabinYaw, 0);
    }
  }, []);

  const showFloors = useCallback(() => {
    if (mode === 'riding') return;
    if (mode === 'touring') {
      tourRef.current?.stop?.();
      playerRef.current?.syncFromCamera?.();
    }
    setOverlayVisible(false);
    lobbyRef.current?.openDoors?.();
    openPanel('floors');
  }, [mode, openPanel]);

  // Switch to a chosen floor
  const switchFloor = useCallback(
    (index, targetLibrary, targetFloors) => {
      const activeLib = targetLibrary || library;
      const allFloors = targetFloors || floors;
      if (!allFloors[index]) return;

      closePanel(true);
      setWatchingUI(false);

      cinemaHall?.dispose?.();
      setCinemaHall(null);
      setHasCinema(false);
      setCinemaState({ nowPlaying: null, loading: null, film: null, isWatching: false });

      curator?.dispose?.();
      for (const frame of frames) frame.dispose?.();

      const newLayout = createLayout(allFloors[index]);
      const newFrames = newLayout.slots.map((slot) => new MediaFrame(slot));

      const newCurator = new Curator(newFrames, activeLib, {
        media: CONFIG.media,
        anisotropy: 8,
        onProgress: (p) => {
          setLoadingProgress(p);
        },
      });

      let newCinema = null;
      if (newLayout.cinema) {
        newCinema = new CinemaHall(
          { camera: null, maxAnisotropy: 8, scene: null },
          newLayout.cinema,
          {
            setAmbient(factor) {
              if (atmosphereRef.current) {
                atmosphereRef.current.intensity = 0.75 * factor;
              }
            },
          }
        );
        newCinema.onChange = () => {
          setCinemaState({
            nowPlaying: newCinema.nowPlaying,
            loading: newCinema.loading,
            film: newCinema.film,
            isWatching: mode === 'watching',
          });
        };
        setCinemaHall(newCinema);
        setHasCinema(true);
      }

      setCurrentFloorIndex(index);
      setLayout(newLayout);
      setFrames(newFrames);
      setCurator(newCurator);

      playerRef.current?.standUp?.();
      playerRef.current?.clearInput?.();
      tourRef.current?.setFrames?.(newFrames);

      setLoadingProgress({ pending: 0, done: 0 });
      newCurator.hangAll();
    },
    [library, floors, closePanel, setWatchingUI, cinemaHall, curator, frames, mode]
  );

  const rideElevator = useCallback(
    (index) => {
      if (mode === 'riding' || !floors[index]) return;
      if (index === currentFloorIndex) {
        closePanel(true);
        return;
      }
      closePanel(true);
      setMode('riding');
      placeInElevator();
      showToast(`Elevator · ${floors[index].label}`, 2600);
      lobbyRef.current?.closeDoors?.();

      setTimeout(() => {
        switchFloor(index);
        placeInElevator();

        setTimeout(() => {
          lobbyRef.current?.openDoors?.();
          setMode('explore');
          showToast(
            floors[index].kind === 'cinema'
              ? 'Arrived · The Little Cinema · click the screen to choose a film'
              : `Arrived · ${floors[index].label}`,
            floors[index].kind === 'cinema' ? 4200 : 2400
          );
          if (!playerRef.current?.active) {
            setEnterLabel('Continue');
            setOverlayVisible(true);
          }
        }, 600);
      }, 1200);
    },
    [mode, floors, currentFloorIndex, closePanel, placeInElevator, showToast, switchFloor]
  );

  // Initialize Media Library & Hall of Fame once
  useEffect(() => {
    let mounted = true;
    setTouchAvailable(matchMedia('(pointer: coarse)').matches);

    async function init() {
      const lib = await MediaLibrary.load(CONFIG.media.manifestUrl, {
        hidden: CONFIG.media.hidden,
      });
      if (!mounted) return;

      const floorList = lib.floors();
      lib.add([...HALL_OF_FAME_ITEMS, HALL_OF_FAME_FEATURE]);
      floorList.unshift(HALL_OF_FAME_FLOOR);
      floorList.push(CINEMA_FLOOR);

      setLibrary(lib);
      setFloors(floorList);
      setCollectionSize(lib.size);

      musicRef.current = new BackgroundMusic(BACKGROUND_MUSIC_URL, {
        onChange: ({ wanted, playing }) => {
          setMusicState({ wanted, playing });
        },
      });

      switchFloor(0, lib, floorList);

      if (import.meta.env.DEV) {
        Object.assign(window, {
          museum: {
            library: lib,
            floors: floorList,
            switchFloor,
            rideElevator,
          },
        });
      }
    }

    init();

    return () => {
      mounted = false;
      cinemaHall?.dispose?.();
      curator?.dispose?.();
      for (const frame of frames) frame.dispose?.();
    };
  }, []);

  // Global keydown shortcuts
  useEffect(() => {
    const onKeyDown = (e) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.code === 'KeyM') {
        showFloors();
        return;
      }
      if (e.code === 'KeyB') {
        musicRef.current?.toggle();
        showToast(
          musicRef.current?.wanted ? 'Background music on · B to stop' : 'Background music off'
        );
        return;
      }
      if (e.code === 'Escape' && mode === 'watching') {
        leaveWatching();
        return;
      }
      if (e.code === 'Escape' && mode === 'panel') {
        closePanel(false);
        return;
      }
      if (e.code === 'Escape' && mode === 'touring') {
        stopTour();
        return;
      }
      if (e.code === 'KeyC' && (mode === 'explore' || mode === 'touring')) {
        if (mode === 'touring') stopTour();
        else {
          setOverlayVisible(false);
          startTour();
        }
        return;
      }
      if (e.code === 'KeyR' && (mode === 'explore' || mode === 'touring')) {
        curator?.shuffleAll();
        showToast('Rehanging the gallery…');
        return;
      }
      if (e.code === 'Space' && cinemaHall?.film && (mode === 'watching' || activePanel === 'cinema')) {
        e.preventDefault();
        cinemaHall.togglePause();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, activePanel, cinemaHall, curator, closePanel, leaveWatching, showFloors, showToast, startTour, stopTour]);

  // Frame curation editor handlers
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
    if (!frame || !curator) return;
    handleEditorRun(
      () => curator.upload(frame, file),
      `Saved “${file.name}” to this frame.`
    );
  };

  const handleShuffle = () => {
    const frame = editorState.frame;
    if (!frame || !curator) return;
    handleEditorRun(() => curator.shuffle(frame), 'New piece hung.');
  };

  const handleReset = () => {
    const frame = editorState.frame;
    if (!frame || !curator) return;
    handleEditorRun(() => curator.reset(frame), 'Upload removed.');
  };

  const handleFit = (fit) => {
    const frame = editorState.frame;
    if (!frame || !curator) return;
    handleEditorRun(() => curator.setFit(frame, fit));
  };

  const currentFloor = floors[currentFloorIndex];
  const floorButtonText = currentFloor
    ? `${currentFloor.label} · ${touchAvailable ? 'Change period' : 'M to change period'}`
    : 'Choose a time period';

  return (
    <>
      {/* Declarative React Three Fiber Canvas and Scene */}
      <MuseumCanvas
        layout={layout}
        floors={floors}
        currentFloorIndex={currentFloorIndex}
        frames={frames}
        curator={curator}
        cinemaHall={cinemaHall}
        mode={mode}
        overlayVisible={overlayVisible}
        onOpenFloors={showFloors}
        onOpenProgramme={() => openPanel('cinema')}
        onFrameClick={(frame) => openPanel('editor', frame)}
        onSitSeat={(seat) => playerRef.current?.sit?.(seat)}
        onPointerLockChange={(locked) => {
          if (!locked && mode === 'explore') {
            setHoverCaption(null);
            setEnterLabel('Continue');
            setOverlayVisible(true);
          }
        }}
        onHoverCaption={setHoverCaption}
        setTouchVisible={setTouchVisible}
        stopTour={stopTour}
        playerRef={playerRef}
        tourRef={tourRef}
        lobbyRef={lobbyRef}
        atmosphereRef={atmosphereRef}
        onCanvasClick={() => {
          if (mode === 'touring') {
            stopTour();
            return;
          }
          if (mode !== 'explore') return;
          if (playerRef.current?.touchEnabled) return;
          if (!playerRef.current?.locked) {
            setOverlayVisible(false);
            playerRef.current?.lock?.();
          }
        }}
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
          playerRef.current?.lock?.();
        }}
        onTour={() => {
          setOverlayVisible(false);
          startTour();
        }}
        onChooseFloors={showFloors}
        onWatchCinema={() => openPanel('cinema')}
      />

      {/* Touch controls for mobile devices */}
      <TouchControls
        visible={touchVisible}
        player={playerRef.current}
        onUse={() => {
          if (hoverCaption) {
            const hitFrame = frames.find((f) => f.item?.title === hoverCaption.title);
            if (hitFrame) openPanel('editor', hitFrame);
          }
        }}
        onTour={() => {
          setOverlayVisible(false);
          startTour();
        }}
        onPause={() => {
          if (mode !== 'explore') return;
          playerRef.current?.clearInput?.();
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
            if (mode !== 'riding' && cinemaHall) {
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
          musicRef.current?.toggle();
          showToast(
            musicRef.current?.wanted ? 'Background music on · B to stop' : 'Background music off'
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

      {/* Heads-up display */}
      <Hud
        hoverCaption={hoverCaption}
        loadingProgress={loadingProgress}
        isTouring={mode === 'touring'}
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
          if (!cinemaHall) return;
          startWatching();
          cinemaHall.project(film).catch((err) => {
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
        onTogglePlay={() => cinemaHall?.togglePause?.()}
        onStop={() => cinemaHall?.stop?.()}
        onProgramme={() => openPanel('cinema')}
        onWalk={leaveWatching}
      />
    </>
  );
}
