import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CONFIG } from '../../config.ts';
import { deviceProfile, pixelRatio } from '../../core/deviceProfile.ts';
import type { DeviceProfile } from '../../core/deviceProfile.ts';
import type { MuseumFloor } from '../../types.ts';
import type { Curator } from '../../media/curator.ts';
import type { MuseumLayout } from '../../world/layout.ts';
import type { LobbyHandle } from '../../world/lobby.ts';
import type { ArtworkFrameController } from '../../world/frame.ts';
import type { CinemaHandle } from '../../world/cinema.ts';
import type { PlayerHandle } from '../../controls/player.ts';
import type { TourHandle } from '../../controls/tour.ts';
import { Interactions } from '../../controls/interactions.ts';
import { createCollisionChecker } from '../../controls/collision.ts';
import { MuseumEnvironment } from './MuseumEnvironment.tsx';
import { MuseumLobby } from './MuseumLobby.tsx';
import { MuseumFrames } from './MuseumFrames.tsx';
import { MuseumCinema } from './MuseumCinema.tsx';
import { usePlayerControls } from './usePlayerControls.ts';
import { useCinematicTour } from './useCinematicTour.ts';

interface SceneLightingProps {
  atmosphereRef: RefObject<THREE.HemisphereLight | null>;
}

interface DisposableNode extends THREE.Object3D {
  geometry: THREE.BufferGeometry;
  material: THREE.Material | THREE.Material[];
}

function isMaterial(value: unknown): value is THREE.Material {
  return value instanceof THREE.Material;
}

function isDisposableNode(object: THREE.Object3D): object is DisposableNode {
  if (!('geometry' in object) || !('material' in object)) return false;
  const geometry = object.geometry;
  const material = object.material;
  return (
    geometry instanceof THREE.BufferGeometry &&
    (isMaterial(material) || (Array.isArray(material) && material.every(isMaterial)))
  );
}

function disposeRoomEnvironment(room: THREE.Object3D): void {
  const pending: THREE.Object3D[] = [room];
  while (pending.length > 0) {
    const object = pending.pop();
    if (!object) continue;
    pending.push(...object.children);
    if (!isDisposableNode(object)) continue;
    object.geometry.dispose();
    if (Array.isArray(object.material)) {
      object.material.forEach((entry) => {
        entry.dispose();
      });
    } else {
      object.material.dispose();
    }
  }
}

function SceneLighting({ atmosphereRef }: SceneLightingProps) {
  const { get } = useThree();
  useEffect(() => {
    const { gl, scene } = get();
    const previousEnvironment = scene.environment;
    const previousIntensity = scene.environmentIntensity;
    const room = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(gl);
    const environment = pmrem.fromScene(room, 0.04).texture;
    scene.environment = environment;
    scene.environmentIntensity = 0.32;
    return () => {
      scene.environment = previousEnvironment;
      scene.environmentIntensity = previousIntensity;
      environment.dispose();
      pmrem.dispose();
      disposeRoomEnvironment(room);
    };
  }, [get]);
  return (
    <hemisphereLight ref={atmosphereRef} color={0xfff6ea} groundColor={0x6d6255} intensity={0.75} />
  );
}

interface RenderSettingsProps {
  profile: DeviceProfile;
}

function RenderSettings({ profile }: RenderSettingsProps) {
  const { gl, size } = useThree();
  useEffect(() => {
    gl.setPixelRatio(
      pixelRatio(size.width, size.height, globalThis.devicePixelRatio || 1, profile.render),
    );
  }, [gl, profile, size.height, size.width]);
  return null;
}

interface DeclarativeMuseumSceneProps {
  layout: MuseumLayout | null;
  floors: readonly MuseumFloor[];
  currentFloorIndex: number;
  frames: readonly ArtworkFrameController[];
  curator: Curator | null;
  cinemaHandle: CinemaHandle | null;
  mode: string;
  overlayVisible: boolean;
  onOpenFloors: () => void;
  onOpenProgramme: () => void;
  onFrameClick: (frame: ArtworkFrameController) => void;
  onSitSeat: (pose: { position: THREE.Vector3; yaw: number }) => void;
  onPointerLockChange: (locked: boolean) => void;
  onHoverCaption: (caption: { title: string; subtitle: string } | null) => void;
  onHoverFrame: (frame: ArtworkFrameController | null) => void;
  setTouchVisible: (visible: boolean) => void;
  onPlayerReady?: (player: PlayerHandle | null) => void;
  onCinemaReady: (handle: CinemaHandle | null) => void;
  stopTour: () => void;
  playerRef: RefObject<PlayerHandle | null>;
  tourRef: RefObject<TourHandle | null>;
  lobbyRef: RefObject<LobbyHandle | null>;
  atmosphereRef: RefObject<THREE.HemisphereLight | null>;
}

function DeclarativeMuseumScene({
  layout,
  floors,
  currentFloorIndex,
  frames,
  curator,
  cinemaHandle,
  mode,
  overlayVisible,
  onOpenFloors,
  onOpenProgramme,
  onFrameClick,
  onSitSeat,
  onPointerLockChange,
  onHoverCaption,
  onHoverFrame,
  setTouchVisible,
  onPlayerReady,
  onCinemaReady,
  stopTour,
  playerRef,
  tourRef,
  lobbyRef,
  atmosphereRef,
}: DeclarativeMuseumSceneProps) {
  const { camera, scene } = useThree();
  const interactions = useMemo(() => new Interactions(camera), [camera]);
  useEffect(
    () => () => {
      interactions.clear();
    },
    [interactions],
  );
  const raycaster = useMemo(() => {
    const instance = new THREE.Raycaster();
    instance.far = 6.5;
    return instance;
  }, []);
  const rayOrigin = useMemo(() => new THREE.Vector2(0, 0), []);
  const targetsRef = useRef<THREE.Object3D[]>([]);
  const ownersRef = useRef(new Map<THREE.Object3D, ArtworkFrameController>());
  const hoveredRef = useRef<ArtworkFrameController | null>(null);

  const collision = useMemo(() => {
    const walls = createCollisionChecker(layout?.colliders ?? [], CONFIG.player.radius);
    return (position: THREE.Vector3): boolean =>
      walls(position) || Boolean(lobbyRef.current?.blocksDoor(position, CONFIG.player.radius));
  }, [layout, lobbyRef]);

  usePlayerControls({
    enabled: mode === 'explore' && !overlayVisible,
    collides: collision,
    start: layout?.start,
    onLockChange: onPointerLockChange,
    playerRef,
  });
  useCinematicTour({ frames, active: mode === 'touring', onStop: stopTour, tourRef });
  useEffect(() => {
    setTouchVisible(mode === 'explore' && !overlayVisible);
  }, [mode, overlayVisible, setTouchVisible]);
  useEffect(() => {
    const targets = targetsRef.current;
    const owners = ownersRef.current;
    targets.length = 0;
    owners.clear();
    for (const frame of frames) {
      for (const target of frame.hitTargets) {
        targets.push(target);
        owners.set(target, frame);
      }
    }
    return () => {
      targets.length = 0;
      owners.clear();
    };
  }, [frames]);
  const setCinemaAmbient = useCallback(
    (factor: number): void => {
      if (atmosphereRef.current) atmosphereRef.current.intensity = 0.75 * factor;
    },
    [atmosphereRef],
  );
  const curatorContext = useMemo(() => ({ camera }), [camera]);
  const intersectionsRef = useRef<THREE.Intersection[]>([]);

  useEffect(() => {
    onPlayerReady?.(playerRef.current);
    return () => {
      onPlayerReady?.(null);
    };
  }, [onPlayerReady, playerRef]);

  useEffect(() => {
    const onVisibilityChange = (): void => {
      const visible = !document.hidden;
      curator?.onVisibilityChange(visible);
      cinemaHandle?.onVisibilityChange(visible);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [cinemaHandle, curator]);

  useFrame((_, delta) => {
    const active = mode === 'explore' && !overlayVisible;
    curator?.update(Math.min(delta, 0.05), curatorContext);
    if (!active) {
      if (hoveredRef.current) {
        hoveredRef.current = null;
        onHoverCaption(null);
        onHoverFrame(null);
      }
      return;
    }
    raycaster.setFromCamera(rayOrigin, camera);
    const intersections = intersectionsRef.current;
    intersections.length = 0;
    raycaster.intersectObjects(scene.children, true, intersections);
    let hovered: ArtworkFrameController | null = null;
    const first = intersections[0];
    if (first) {
      let object: THREE.Object3D | null = first.object;
      while (object && !hovered) {
        hovered = ownersRef.current.get(object) ?? null;
        object = object.parent;
      }
      if (first.distance > 6) hovered = null;
    }
    if (hoveredRef.current !== hovered) {
      hoveredRef.current = hovered;
      onHoverFrame(hovered);
      onHoverCaption(
        hovered?.item
          ? { title: hovered.item.title, subtitle: `${hovered.item.subtitle} · click to curate` }
          : null,
      );
    }
  });

  return (
    <>
      <SceneLighting atmosphereRef={atmosphereRef} />
      <MuseumEnvironment layout={layout} />
      <MuseumLobby
        floors={floors}
        currentFloorIndex={currentFloorIndex}
        onOpenFloors={onOpenFloors}
        lobbyRef={lobbyRef}
        interactions={interactions}
      />
      <MuseumFrames
        frames={frames}
        onFrameClick={(frame) => {
          if (
            mode === 'explore' &&
            !overlayVisible &&
            hoveredRef.current === frame &&
            camera.position.distanceTo(frame.center) <= 6
          )
            onFrameClick(frame);
        }}
      />
      {layout?.cinema && (
        <MuseumCinema
          placement={layout.cinema}
          isWatching={mode === 'watching'}
          onCinemaReady={onCinemaReady}
          onOpenProgramme={onOpenProgramme}
          onSitSeat={onSitSeat}
          setAmbient={setCinemaAmbient}
        />
      )}
    </>
  );
}

export interface MuseumCanvasProps extends Omit<DeclarativeMuseumSceneProps, 'cinemaHandle'> {
  cinemaHandle: CinemaHandle | null;
  onCanvasClick: () => void;
  profile?: DeviceProfile;
  canvasRef?: { current: HTMLCanvasElement | null };
}

export function MuseumCanvas({
  layout,
  floors,
  currentFloorIndex,
  frames,
  curator,
  cinemaHandle,
  mode,
  overlayVisible,
  onOpenFloors,
  onOpenProgramme,
  onFrameClick,
  onSitSeat,
  onPointerLockChange,
  onHoverCaption,
  onHoverFrame,
  setTouchVisible,
  onCinemaReady,
  onPlayerReady,
  stopTour,
  playerRef,
  tourRef,
  lobbyRef,
  atmosphereRef,
  onCanvasClick,
  profile: renderProfile,
  canvasRef,
}: MuseumCanvasProps) {
  const detectedProfile = useMemo(
    () =>
      deviceProfile({
        coarsePointer: matchMedia('(pointer: coarse)').matches,
        width: globalThis.innerWidth,
        deviceMemory: 8,
        saveData: false,
      }),
    [],
  );
  const profile = renderProfile ?? detectedProfile;
  return (
    <div
      id="canvas-container"
      style={{ width: '100vw', height: '100vh', position: 'fixed', inset: 0 }}
      onClick={onCanvasClick}
    >
      <Canvas
        id="canvas"
        gl={{
          alpha: true,
          antialias: profile.render.antialias,
          powerPreference: 'high-performance',
          outputColorSpace: THREE.SRGBColorSpace,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.08,
        }}
        dpr={[1, profile.render.maxPixelRatio]}
        camera={{
          fov: CONFIG.render.fov,
          near: 0.05,
          far: 220,
          position: [0, CONFIG.player.eyeHeight, 0],
        }}
        style={{ width: '100%', height: '100%' }}
        onCreated={({ gl }) => {
          if (canvasRef) canvasRef.current = gl.domElement;
        }}
      >
        <RenderSettings profile={profile} />
        <DeclarativeMuseumScene
          layout={layout}
          floors={floors}
          currentFloorIndex={currentFloorIndex}
          frames={frames}
          curator={curator}
          cinemaHandle={cinemaHandle}
          mode={mode}
          overlayVisible={overlayVisible}
          onOpenFloors={onOpenFloors}
          onOpenProgramme={onOpenProgramme}
          onFrameClick={onFrameClick}
          onSitSeat={onSitSeat}
          onPointerLockChange={onPointerLockChange}
          onHoverCaption={onHoverCaption}
          onHoverFrame={onHoverFrame}
          setTouchVisible={setTouchVisible}
          onCinemaReady={onCinemaReady}
          onPlayerReady={onPlayerReady}
          stopTour={stopTour}
          playerRef={playerRef}
          tourRef={tourRef}
          lobbyRef={lobbyRef}
          atmosphereRef={atmosphereRef}
        />
      </Canvas>
    </div>
  );
}
