import { useCallback, useEffect, useRef, useState } from 'react';
import type * as THREE from 'three';
import './styles.css';
import { CONFIG } from './config.ts';
import { deviceProfile } from './core/deviceProfile.ts';
import type { DeviceProfile } from './core/deviceProfile.ts';
import { createLayout } from './world/layout.ts';
import type { MuseumLayout } from './world/layout.ts';
import { ArtworkFrameController } from './world/frame.ts';
import { MediaLibrary } from './media/library.ts';
import { Curator } from './media/curator.ts';
import type { CinemaHandle, CinemaSnapshot } from './world/cinema.ts';
import { CINEMA_FLOOR, YOUTUBE_FILMS } from './cinema/programme.ts';
import {
  BACKGROUND_MUSIC_URL,
  HALL_OF_FAME_FEATURE,
  HALL_OF_FAME_FLOOR,
  HALL_OF_FAME_ITEMS,
} from './fame/programme.ts';
import type { FitMode, MuseumFloor } from './types.ts';
import type { PlayerHandle } from './controls/player.ts';
import type { TourHandle } from './controls/tour.ts';
import type { LobbyHandle } from './world/lobby.ts';
import { BackgroundMusic } from './ui/music.ts';
import { MuseumCanvas } from './components/r3f/MuseumCanvas.tsx';
import { Overlay } from './components/Overlay.tsx';
import { TouchControls } from './components/TouchControls.tsx';
import { FloorPanel } from './components/FloorPanel.tsx';
import { CinemaPanel, type CinemaFilm, type ProgrammeSection } from './components/CinemaPanel.tsx';
import { CinemaViewing } from './components/CinemaViewing.tsx';
import { EditorPanel } from './components/EditorPanel.tsx';
import { Hud, type HoverCaption } from './components/Hud.tsx';

const PROGRAMME_SECTIONS: readonly ProgrammeSection[] = [
  { heading: 'September 2026 · Five films', films: YOUTUBE_FILMS },
];
const EMPTY_SNAPSHOT: CinemaSnapshot = { nowPlaying: null, loading: null, film: null };
type AppMode = 'intro' | 'explore' | 'panel' | 'touring' | 'riding' | 'watching';
type Panel = 'none' | 'floors' | 'cinema' | 'editor';
function runtimeDeviceProfile(): DeviceProfile {
  const nav = navigator as Navigator & { deviceMemory?: unknown; connection?: unknown };
  const memory: unknown = nav.deviceMemory;
  const connection: unknown = nav.connection;
  const saveData =
    typeof connection === 'object' &&
    connection !== null &&
    (connection as { saveData?: unknown }).saveData === true;
  return deviceProfile({
    coarsePointer: matchMedia('(pointer: coarse)').matches,
    width: globalThis.innerWidth,
    deviceMemory: typeof memory === 'number' ? memory : 8,
    saveData,
  });
}

export function App() {
  const [profile] = useState(runtimeDeviceProfile);
  const [floors, setFloors] = useState<MuseumFloor[]>([]);
  const [currentFloorIndex, setCurrentFloorIndex] = useState(0);
  const [layout, setLayout] = useState<MuseumLayout | null>(null);
  const [frames, setFrames] = useState<ArtworkFrameController[]>([]);
  const [curator, setCurator] = useState<Curator | null>(null);
  const [cinemaHandle, setCinemaHandle] = useState<CinemaHandle | null>(null);
  const [mode, setMode] = useState<AppMode>('intro');
  const [activePanel, setActivePanel] = useState<Panel>('none');
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [enterLabel, setEnterLabel] = useState('Enter the gallery');
  const [touchAvailable] = useState(() => matchMedia('(pointer: coarse)').matches);
  const [touchVisible, setTouchVisible] = useState(false);
  const [touchPlayer, setTouchPlayer] = useState<PlayerHandle | null>(null);
  const [hoverCaption, setHoverCaption] = useState<HoverCaption | null>(null);
  const [hoverFrame, setHoverFrame] = useState<ArtworkFrameController | null>(null);
  const [loadingProgress, setLoadingProgress] = useState({ pending: 0, done: 0 });
  const [toastMessage, setToastMessage] = useState('');
  const [collectionSize, setCollectionSize] = useState<number | null>(null);
  const [cinemaState, setCinemaState] = useState<CinemaSnapshot>(EMPTY_SNAPSHOT);
  const [editorFrame, setEditorFrame] = useState<ArtworkFrameController | null>(null);
  const [editorBusy, setEditorBusy] = useState(false);
  const [editorStatus, setEditorStatus] = useState('');
  const [musicState, setMusicState] = useState({ wanted: true, playing: false });

  const playerRef = useRef<PlayerHandle | null>(null);
  const tourRef = useRef<TourHandle | null>(null);
  const lobbyRef = useRef<LobbyHandle | null>(null);
  const atmosphereRef = useRef<THREE.HemisphereLight | null>(null);
  const musicRef = useRef<BackgroundMusic | null>(null);
  const cinemaRef = useRef<CinemaHandle | null>(null);
  const curatorRef = useRef<Curator | null>(null);
  const libraryRef = useRef<MediaLibrary | null>(null);
  const framesRef = useRef<ArtworkFrameController[]>([]);
  const floorsRef = useRef<MuseumFloor[]>([]);
  const toastTimerRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const showToast = useCallback((message: string, duration = 2400): void => {
    setToastMessage(message);
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage('');
    }, duration);
  }, []);

  const setCinema = useCallback((handle: CinemaHandle | null): void => {
    cinemaRef.current = handle;
    setCinemaHandle(handle);
    if (!handle) setCinemaState(EMPTY_SNAPSHOT);
  }, []);
  const switchFloor = useCallback(
    (index: number, targetLibrary?: MediaLibrary, targetFloors?: MuseumFloor[]): void => {
      const activeLibrary = targetLibrary ?? libraryRef.current;
      const activeFloors = targetFloors ?? floorsRef.current;
      const selectedFloor = activeFloors[index];
      if (!selectedFloor || !activeLibrary) return;
      cinemaRef.current?.dispose();
      cinemaRef.current = null;
      setCinemaHandle(null);
      setCinemaState(EMPTY_SNAPSHOT);
      curatorRef.current?.dispose();
      for (const frame of framesRef.current) frame.unload();
      const nextLayout = createLayout(selectedFloor);
      const nextFrames = nextLayout.slots.map((slot) => new ArtworkFrameController(slot));
      const nextCurator = new Curator(nextFrames, activeLibrary, {
        media: { ...CONFIG.media, ...profile.media },
        anisotropy: profile.anisotropy,
        onProgress: setLoadingProgress,
      });
      framesRef.current = nextFrames;
      curatorRef.current = nextCurator;
      setCurrentFloorIndex(index);
      setLayout(nextLayout);
      setFrames(nextFrames);
      setCurator(nextCurator);
      setLoadingProgress({ pending: 0, done: 0 });
      void nextCurator.hangAll();
    },
    [profile],
  );

  useEffect(() => {
    let mounted = true;
    const initialize = async (): Promise<void> => {
      const loadedLibrary = await MediaLibrary.load(CONFIG.media.manifestUrl, {
        hidden: CONFIG.media.hidden,
      });
      if (!mounted) return;
      loadedLibrary.add([...HALL_OF_FAME_ITEMS, HALL_OF_FAME_FEATURE]);
      const nextFloors = [HALL_OF_FAME_FLOOR, ...loadedLibrary.floors(), CINEMA_FLOOR];
      libraryRef.current = loadedLibrary;
      floorsRef.current = nextFloors;
      setFloors(nextFloors);
      setCollectionSize(loadedLibrary.size);
      switchFloor(0, loadedLibrary, nextFloors);
    };
    void initialize();
    return () => {
      mounted = false;
      if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
      cinemaRef.current?.dispose();
      curatorRef.current?.dispose();
      for (const frame of framesRef.current) frame.unload();
    };
  }, [switchFloor]);

  useEffect(() => {
    musicRef.current = new BackgroundMusic(BACKGROUND_MUSIC_URL, {
      onChange: ({ wanted, playing }) => {
        setMusicState({ wanted, playing });
      },
    });
    return () => musicRef.current?.dispose();
  }, []);

  useEffect(() => {
    if (!cinemaHandle) return;
    const unsubscribe = cinemaHandle.subscribe((snapshot) => {
      setCinemaState(snapshot);
    });
    return () => {
      unsubscribe();
    };
  }, [cinemaHandle]);
  const isCinemaPlaying = cinemaState.film !== null && !cinemaState.film.paused;
  useEffect(() => {
    musicRef.current?.hold(isCinemaPlaying);
  }, [isCinemaPlaying]);
  useEffect(() => {
    const watching = mode === 'watching';
    document.body.classList.toggle('cinema-watching', watching);
    return () => {
      document.body.classList.remove('cinema-watching');
    };
  }, [mode]);

  const closePanel = useCallback(
    (resume: boolean): void => {
      if (activePanel === 'cinema' && cinemaState.film) {
        setActivePanel('none');
        setMode('watching');
        setOverlayVisible(false);
        cinemaRef.current?.setInteractive(true);
        return;
      }
      setActivePanel('none');
      setMode('explore');
      if (resume) playerRef.current?.lock();
      else {
        setEnterLabel('Continue');
        setOverlayVisible(true);
      }
    },
    [activePanel, cinemaState.film],
  );

  const startWatching = useCallback((): void => {
    if (!cinemaRef.current) return;
    setActivePanel('none');
    setOverlayVisible(false);
    setMode('watching');
    playerRef.current?.standUp();
    playerRef.current?.clearInput();
    playerRef.current?.unlock();
    setHoverCaption(null);
    cinemaRef.current.setInteractive(true);
  }, []);

  const leaveWatching = useCallback((): void => {
    cinemaRef.current?.setInteractive(false);
    setMode('explore');
    playerRef.current?.syncFromCamera();
    playerRef.current?.lock();
  }, []);

  const openPanel = useCallback((panel: Panel, frame?: ArtworkFrameController): void => {
    if (panel === 'cinema' && !cinemaRef.current) return;
    setActivePanel(panel);
    setOverlayVisible(false);
    setMode('panel');
    setHoverCaption(null);
    playerRef.current?.unlock();
    playerRef.current?.clearInput();
    if (panel === 'editor') {
      setEditorFrame(frame ?? null);
      setEditorStatus('Uploads stay in this browser (IndexedDB).');
    }
  }, []);

  const showFloors = useCallback((): void => {
    if (mode === 'riding') return;
    if (mode === 'touring') tourRef.current?.stop();
    lobbyRef.current?.openDoors();
    openPanel('floors');
  }, [mode, openPanel]);

  const rideElevator = useCallback(
    (index: number): void => {
      const destination = floorsRef.current[index];
      const lobby = lobbyRef.current;
      if (!destination || !lobby || mode === 'riding') return;
      if (index === currentFloorIndex) {
        closePanel(true);
        return;
      }
      closePanel(true);
      setMode('riding');
      playerRef.current?.standUp();
      playerRef.current?.clearInput();
      playerRef.current?.resetPose({ position: lobby.cabinPosition, yaw: lobby.cabinYaw });
      showToast(`Elevator · ${destination.label}`, 2600);
      lobby.closeDoors();
      lobby.travelTo(
        index,
        () => {
          switchFloor(index);
          playerRef.current?.resetPose({ position: lobby.cabinPosition, yaw: lobby.cabinYaw });
        },
        () => {
          lobby.openDoors();
          setMode('explore');
          showToast(
            destination.kind === 'cinema'
              ? 'Arrived · The Little Cinema · click the screen to choose a film'
              : `Arrived · ${destination.label}`,
            destination.kind === 'cinema' ? 4200 : 2400,
          );
          if (!playerRef.current?.active) {
            setEnterLabel('Continue');
            setOverlayVisible(true);
          }
        },
      );
    },
    [closePanel, currentFloorIndex, mode, showToast, switchFloor],
  );

  const startTour = useCallback((): void => {
    if (cinemaRef.current) {
      openPanel('cinema');
      return;
    }
    setMode('touring');
    setOverlayVisible(false);
    playerRef.current?.standUp();
    playerRef.current?.clearInput();
    playerRef.current?.unlock();
    tourRef.current?.start();
  }, [openPanel]);
  const stopTour = useCallback((): void => {
    tourRef.current?.stop();
    playerRef.current?.syncFromCamera();
    setMode('explore');
    playerRef.current?.lock();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement
      )
        return;
      if (event.code === 'KeyM') {
        showFloors();
        return;
      }
      if (event.code === 'KeyB') {
        musicRef.current?.toggle();
        return;
      }
      if (event.code === 'Escape' && mode === 'watching') {
        leaveWatching();
        return;
      }
      if (event.code === 'Escape' && mode === 'panel') {
        closePanel(false);
        return;
      }
      if (event.code === 'Escape' && mode === 'touring') {
        stopTour();
        return;
      }
      if (event.code === 'KeyC' && (mode === 'explore' || mode === 'touring')) {
        if (mode === 'touring') stopTour();
        else startTour();
        return;
      }
      if (event.code === 'KeyR' && (mode === 'explore' || mode === 'touring')) {
        curatorRef.current?.shuffleAll();
        showToast('Rehanging the gallery…');
        return;
      }
      if (
        event.code === 'Space' &&
        cinemaState.film &&
        (mode === 'watching' || activePanel === 'cinema')
      ) {
        event.preventDefault();
        void cinemaRef.current?.togglePause();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [
    activePanel,
    cinemaState.film,
    closePanel,
    leaveWatching,
    mode,
    showFloors,
    showToast,
    startTour,
    stopTour,
  ]);

  const runEditor = useCallback(
    async (action: () => Promise<void>, message = ''): Promise<void> => {
      setEditorBusy(true);
      try {
        await action();
        setEditorStatus(message);
      } catch (error: unknown) {
        setEditorStatus(error instanceof Error ? error.message : 'Something went wrong.');
      } finally {
        setEditorBusy(false);
      }
    },
    [],
  );
  const currentFloor = floors[currentFloorIndex];
  const floorButtonText = currentFloor
    ? `${currentFloor.label} · ${touchAvailable ? 'Change period' : 'M to change period'}`
    : 'Choose a time period';
  const editorFrameHandle = editorFrame;
  const film = cinemaState.film;
  const onUpload = (file: File): void => {
    const frame = editorFrameHandle;
    const activeCurator = curatorRef.current;
    if (!frame || !activeCurator) return;
    void runEditor(() => activeCurator.upload(frame, file), `Saved “${file.name}” to this frame.`);
  };
  const onShuffle = (): void => {
    const frame = editorFrameHandle;
    const activeCurator = curatorRef.current;
    if (!frame || !activeCurator) return;
    void runEditor(() => activeCurator.shuffle(frame), 'New piece hung.');
  };
  const onReset = (): void => {
    const frame = editorFrameHandle;
    const activeCurator = curatorRef.current;
    if (!frame || !activeCurator) return;
    void runEditor(() => activeCurator.reset(frame), 'Upload removed.');
  };
  const onFit = (fit: FitMode): void => {
    const frame = editorFrameHandle;
    const activeCurator = curatorRef.current;
    if (!frame || !activeCurator) return;
    void runEditor(() => activeCurator.setFit(frame, fit));
  };

  const updateTouchVisible = useCallback(
    (visible: boolean): void => {
      setTouchVisible(visible && touchAvailable);
    },
    [touchAvailable],
  );
  return (
    <>
      <MuseumCanvas
        layout={layout}
        floors={floors}
        currentFloorIndex={currentFloorIndex}
        frames={frames}
        curator={curator}
        cinemaHandle={cinemaHandle}
        mode={mode}
        overlayVisible={overlayVisible}
        onOpenFloors={showFloors}
        onOpenProgramme={() => {
          openPanel('cinema');
        }}
        onFrameClick={(frame) => {
          openPanel('editor', frame);
        }}
        onSitSeat={(pose) => {
          playerRef.current?.sit(pose);
        }}
        onPointerLockChange={(locked) => {
          if (!locked && mode === 'explore') {
            setEnterLabel('Continue');
            setOverlayVisible(true);
          }
        }}
        onHoverCaption={setHoverCaption}
        onHoverFrame={setHoverFrame}
        setTouchVisible={updateTouchVisible}
        onPlayerReady={setTouchPlayer}
        onCinemaReady={setCinema}
        stopTour={stopTour}
        playerRef={playerRef}
        tourRef={tourRef}
        lobbyRef={lobbyRef}
        atmosphereRef={atmosphereRef}
        onCanvasClick={() => {
          if (mode === 'touring') stopTour();
          else if (mode === 'explore' && !touchPlayer && !playerRef.current?.locked) {
            setOverlayVisible(false);
            playerRef.current?.lock();
          }
        }}
        profile={profile}
        canvasRef={canvasRef}
      />
      <Overlay
        visible={overlayVisible}
        enterLabel={enterLabel}
        collectionSize={collectionSize}
        hasCinema={currentFloor?.kind === 'cinema'}
        onEnter={() => {
          setOverlayVisible(false);
          setMode('explore');
          playerRef.current?.lock();
        }}
        onTour={startTour}
        onChooseFloors={showFloors}
        onWatchCinema={() => {
          openPanel('cinema');
        }}
      />
      <TouchControls
        visible={touchVisible}
        player={touchPlayer}
        canvasRef={canvasRef}
        onUse={() => {
          if (hoverFrame) openPanel('editor', hoverFrame);
        }}
        onTour={startTour}
        onPause={() => {
          if (mode === 'explore') {
            playerRef.current?.clearInput();
            setEnterLabel('Continue');
            setOverlayVisible(true);
          }
        }}
      />
      {currentFloor?.kind === 'cinema' && (
        <button
          id="cinemaButton"
          className="pill"
          onClick={() => {
            openPanel('cinema');
          }}
        >
          Cinema programme
        </button>
      )}
      <button
        id="musicButton"
        className="pill"
        aria-pressed={musicState.wanted}
        aria-label={musicState.playing ? 'Pause background music' : 'Play background music'}
        title="Background music (B)"
        onClick={() => {
          musicRef.current?.toggle();
        }}
      >
        {musicState.playing ? '❚❚ Music' : '▶ Music'}
      </button>
      <button id="floorButton" className="pill" onClick={showFloors}>
        {floorButtonText}
      </button>
      <FloorPanel
        isOpen={activePanel === 'floors'}
        floors={floors}
        currentIndex={currentFloorIndex}
        onSelect={rideElevator}
        onClose={() => {
          closePanel(false);
        }}
      />
      <Hud
        hoverCaption={hoverCaption}
        loadingProgress={loadingProgress}
        isTouring={mode === 'touring'}
        toastMessage={toastMessage}
        isTouch={touchAvailable}
      />
      <EditorPanel
        isOpen={activePanel === 'editor'}
        isBusy={editorBusy}
        frame={editorFrameHandle}
        statusMessage={editorStatus}
        onUpload={onUpload}
        onShuffle={onShuffle}
        onReset={onReset}
        onFit={onFit}
        onClose={() => {
          closePanel(true);
        }}
      />
      <CinemaPanel
        isOpen={activePanel === 'cinema'}
        nowPlaying={cinemaState.nowPlaying}
        loading={cinemaState.loading}
        film={film}
        sections={PROGRAMME_SECTIONS}
        onSelect={(entry: CinemaFilm) => {
          startWatching();
          void cinemaRef.current?.project(entry);
        }}
        onClose={() => {
          closePanel(true);
        }}
      />
      <CinemaViewing
        visible={cinemaState.film !== null && mode === 'watching'}
        film={film}
        loading={cinemaState.loading ? film : null}
        onTogglePlay={() => {
          void cinemaRef.current?.togglePause();
        }}
        onStop={() => {
          cinemaRef.current?.stop();
        }}
        onProgramme={() => {
          openPanel('cinema');
        }}
        onWalk={leaveWatching}
      />
    </>
  );
}
