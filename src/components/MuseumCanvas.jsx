import React, { useEffect, useRef } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CONFIG } from '../config.js';

function SceneBridge({
  appProxy,
  environment,
  lobby,
  cinema,
  frames,
  player,
  tour,
  curator,
  interactions,
  mode,
  overlayVisible,
  setHoverCaption,
  setTouchVisible,
}) {
  const { camera, gl, scene } = useThree();
  const pickElapsedRef = useRef(0);

  // Synchronize R3F camera, renderer, scene, canvas into appProxy
  useEffect(() => {
    if (!appProxy) return;

    if (appProxy.camera) {
      camera.position.copy(appProxy.camera.position);
      camera.quaternion.copy(appProxy.camera.quaternion);
    }

    appProxy.camera = camera;
    appProxy.renderer = gl;
    appProxy.scene = scene;
    appProxy.canvas = gl.domElement;

    if (player) {
      player.camera = camera;
      player.canvas = gl.domElement;
    }
    if (tour) {
      tour.camera = camera;
    }
    if (interactions) {
      interactions.camera = camera;
    }

    gl.outputColorSpace = THREE.SRGBColorSpace;
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = CONFIG.render.exposure;

    // Ensure PMREM studio reflections are generated on the active WebGLRenderer
    if (gl && scene && !scene.environment) {
      try {
        const pmrem = new THREE.PMREMGenerator(gl);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        scene.environmentIntensity = 0.32;
        pmrem.dispose();
      } catch (err) {
        console.warn('[R3F] Environment map generation fallback:', err);
      }
    }
  }, [camera, gl, scene, appProxy, player]);

  // Main R3F render loop for custom controls, physics, curator, and cinema systems
  useFrame((_, delta) => {
    if (!appProxy) return;
    const dt = Math.min(delta, 0.05);

    // Update systems
    player?.update(dt, appProxy);
    tour?.update(dt, appProxy);
    lobby?.update(dt);
    curator?.update(dt, appProxy);
    cinema?.update(dt, appProxy);

    // Touch controls visibility check
    const isTouchActive = mode === 'explore' && !overlayVisible;
    setTouchVisible?.(isTouchActive);

    // Hover picking throttled for performance
    if (mode === 'explore' && player?.active && !overlayVisible) {
      pickElapsedRef.current += dt;
      if (pickElapsedRef.current >= 0.1) {
        pickElapsedRef.current = 0;
        const picked = interactions?.pick();
        setHoverCaption?.(picked ? picked.target.caption(picked.hit) : null);
      }
    }
  });

  return (
    <>
      {/* Declarative Environment (Hall, Floor, Ceiling, Lighting) */}
      {environment?.group && <primitive object={environment.group} />}

      {/* Declarative Elevator Lobby & Floor Directory */}
      {lobby?.group && <primitive object={lobby.group} />}

      {/* Declarative Framed Artworks */}
      {frames?.map((frame, index) => (
        <primitive key={frame.slot?.id || index} object={frame.group} />
      ))}

      {/* Declarative Cinema Stage, Seats & Screen */}
      {cinema?.group && <primitive object={cinema.group} />}
    </>
  );
}

export function MuseumCanvas({
  canvasRef,
  onClick,
  appProxy,
  environment,
  lobby,
  cinema,
  frames = [],
  player,
  tour,
  curator,
  interactions,
  mode,
  overlayVisible,
  setHoverCaption,
  setTouchVisible,
}) {
  return (
    <div id="canvas-container" style={{ width: '100vw', height: '100vh', position: 'fixed', inset: 0 }}>
      <Canvas
        ref={canvasRef}
        id="canvas"
        onClick={onClick}
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
        <SceneBridge
          appProxy={appProxy}
          environment={environment}
          lobby={lobby}
          cinema={cinema}
          frames={frames}
          player={player}
          tour={tour}
          curator={curator}
          interactions={interactions}
          mode={mode}
          overlayVisible={overlayVisible}
          setHoverCaption={setHoverCaption}
          setTouchVisible={setTouchVisible}
        />
      </Canvas>
    </div>
  );
}
