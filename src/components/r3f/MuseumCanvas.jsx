import React, { useEffect, useRef, useMemo } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CONFIG } from '../../config.js';
import { MuseumEnvironment } from './MuseumEnvironment.jsx';
import { MuseumLobby } from './MuseumLobby.jsx';
import { MuseumFrames } from './MuseumFrames.jsx';
import { MuseumCinema } from './MuseumCinema.jsx';
import { usePlayerControls } from './usePlayerControls.js';
import { useCinematicTour } from './useCinematicTour.js';

function SceneLighting({ atmosphereRef }) {
  const { gl, scene } = useThree();

  useEffect(() => {
    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = CONFIG.render.exposure;
    scene.background = new THREE.Color(0x151413);
    scene.fog = new THREE.Fog(0xe4e0d8, 35, 140);

    const pmrem = new THREE.PMREMGenerator(gl);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.32;
    pmrem.dispose();
  }, [gl, scene]);

  return <hemisphereLight ref={atmosphereRef} color={0xfff6ea} groundColor={0x6d6255} intensity={0.75} />;
}

function DeclarativeMuseumScene({
  layout,
  floors,
  currentFloorIndex,
  frames,
  curator,
  cinemaHall,
  mode,
  overlayVisible,
  onOpenFloors,
  onOpenProgramme,
  onFrameClick,
  onSitSeat,
  onPointerLockChange,
  onHoverCaption,
  setTouchVisible,
  stopTour,
  playerRef,
  tourRef,
  lobbyRef,
  atmosphereRef,
}) {
  const { camera } = useThree();
  const pickElapsedRef = useRef(0);

  // Player controls hook
  const collidesChecker = useMemo(() => {
    if (!layout) return () => false;
    return (pos) => {
      const collidesWall = layout.colliders.some((c) => {
        const dx = pos.x - c.x;
        const dz = pos.z - c.z;
        return (
          Math.abs(dx) < c.hw + CONFIG.player.radius &&
          Math.abs(dz) < c.hd + CONFIG.player.radius
        );
      });
      const blocksDoor = lobbyRef?.current?.blocksDoor?.(pos, CONFIG.player.radius) ?? false;
      return collidesWall || blocksDoor;
    };
  }, [layout, lobbyRef]);

  usePlayerControls({
    enabled: mode === 'explore' && !overlayVisible,
    collides: collidesChecker,
    start: layout?.start,
    onLockChange: onPointerLockChange,
    playerRef,
  });

  // Tour hook
  useCinematicTour({
    frames,
    active: mode === 'touring',
    onStop: stopTour,
    tourRef,
  });

  // Background systems update loop
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);

    // Curator distance texture streaming
    curator?.update?.(dt, { camera });

    // Touch controls visibility
    const isTouchActive = mode === 'explore' && !overlayVisible;
    setTouchVisible?.(isTouchActive);

    // Hover picking throttled for HUD captions
    if (mode === 'explore' && !overlayVisible) {
      pickElapsedRef.current += dt;
      if (pickElapsedRef.current >= 0.1) {
        pickElapsedRef.current = 0;
        // Check frame proximity for crosshair caption
        const cameraPos = camera.position;
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        let foundCaption = null;

        for (const frame of frames) {
          const toFrame = new THREE.Vector3().subVectors(frame.center, cameraPos);
          const dist = toFrame.length();
          if (dist < 6 && toFrame.dot(forward) / dist > 0.85) {
            if (frame.item) {
              foundCaption = {
                title: frame.item.title,
                subtitle: `${frame.item.subtitle} · click to curate`,
              };
              break;
            }
          }
        }
        onHoverCaption?.(foundCaption);
      }
    }
  });

  return (
    <>
      <SceneLighting atmosphereRef={atmosphereRef} />

      {/* Declarative Exhibition Hall Architecture */}
      <MuseumEnvironment layout={layout} />

      {/* Declarative Lobby Elevator & Floor Directory */}
      <MuseumLobby
        floors={floors}
        currentFloorIndex={currentFloorIndex}
        onOpenFloors={onOpenFloors}
        lobbyRef={lobbyRef}
      />

      {/* Declarative Framed Artworks */}
      <MuseumFrames
        frames={frames}
        curator={curator}
        onFrameClick={onFrameClick}
      />

      {/* Declarative Cinema Stage, Seats & Screen */}
      {layout?.cinema && (
        <MuseumCinema
          cinemaHall={cinemaHall}
          isWatching={mode === 'watching'}
          onOpenProgramme={onOpenProgramme}
          onSitSeat={onSitSeat}
        />
      )}
    </>
  );
}

export function MuseumCanvas({
  layout,
  floors,
  currentFloorIndex,
  frames,
  curator,
  cinemaHall,
  mode,
  overlayVisible,
  onOpenFloors,
  onOpenProgramme,
  onFrameClick,
  onSitSeat,
  onPointerLockChange,
  onHoverCaption,
  setTouchVisible,
  stopTour,
  playerRef,
  tourRef,
  lobbyRef,
  atmosphereRef,
  onCanvasClick,
}) {
  return (
    <div
      id="canvas-container"
      style={{
        width: '100vw',
        height: '100vh',
        position: 'fixed',
        inset: 0,
      }}
      onClick={onCanvasClick}
    >
      <Canvas
        id="canvas"
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: 'high-performance',
        }}
        camera={{
          fov: CONFIG.render.fov,
          near: 0.05,
          far: 220,
          position: [0, CONFIG.player.eyeHeight, 0],
        }}
        style={{ width: '100%', height: '100%' }}
      >
        <DeclarativeMuseumScene
          layout={layout}
          floors={floors}
          currentFloorIndex={currentFloorIndex}
          frames={frames}
          curator={curator}
          cinemaHall={cinemaHall}
          mode={mode}
          overlayVisible={overlayVisible}
          onOpenFloors={onOpenFloors}
          onOpenProgramme={onOpenProgramme}
          onFrameClick={onFrameClick}
          onSitSeat={onSitSeat}
          onPointerLockChange={onPointerLockChange}
          onHoverCaption={onHoverCaption}
          setTouchVisible={setTouchVisible}
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
