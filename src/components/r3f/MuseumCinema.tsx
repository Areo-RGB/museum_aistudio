import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { useFrame, useThree } from '@react-three/fiber';
import { CINEMA, DOOR, ROOM, SEATS } from '../../world/layout.ts';
import type { LayoutPlacement } from '../../world/layout.ts';
import { createCarpetTexture, createVelvetTexture } from '../../world/textures.ts';
import { disposeCanvasPanel, signMesh } from '../../world/signage.ts';
import { CinemaPlayback } from '../../world/cinema.ts';
import type { CinemaHandle, CinemaRenderBindings } from '../../world/cinema.ts';

RectAreaLightUniformsLib.init();

const B = CINEMA.bounds;
const FACE = ROOM.wall / 2;
const H = CINEMA.height;
const SCREEN = CINEMA.screen;
const SCREEN_Z = B.maxZ - FACE - 0.03;
const BACK_Z = B.minZ + FACE;
const PALETTE = {
  ceiling: 0x0d0b0c,
  panel: 0x3a1a20,
  trim: 0x1a1311,
  seatFabric: 0x7d1d27,
  seatFrame: 0x161213,
  warm: 0xffb36b,
};

export interface MuseumCinemaProps {
  readonly placement: LayoutPlacement;
  readonly isWatching: boolean;
  readonly onCinemaReady?: (handle: CinemaHandle | null) => void;
  readonly onOpenProgramme?: () => void;
  readonly onSitSeat?: (pose: { position: THREE.Vector3; yaw: number }) => void;
  readonly setAmbient: (factor: number) => void;
}

export function MuseumCinema({
  placement,
  isWatching,
  onCinemaReady,
  onOpenProgramme,
  onSitSeat,
  setAmbient,
}: MuseumCinemaProps): ReactNode {
  const { gl, camera, scene } = useThree();
  const surfaceRef = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>>(null);
  const letterboxRef = useRef<THREE.Mesh>(null);
  const screenLightRef = useRef<THREE.RectAreaLight>(null);
  const stageLedRef = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>(null);
  const beamRef = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>(null);
  const lensRef = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>>(null);
  const speakerRef = useRef<THREE.Object3D>(null);
  const sconce0Ref = useRef<THREE.PointLight>(null);
  const sconce1Ref = useRef<THREE.PointLight>(null);
  const sconce2Ref = useRef<THREE.PointLight>(null);
  const sconce3Ref = useRef<THREE.PointLight>(null);
  const seat0Ref = useRef<THREE.InstancedMesh>(null);
  const seat1Ref = useRef<THREE.InstancedMesh>(null);
  const seat2Ref = useRef<THREE.InstancedMesh>(null);
  const seat3Ref = useRef<THREE.InstancedMesh>(null);

  const width = B.maxX - B.minX;
  const depth = B.maxZ - B.minZ;
  const centerX = (B.minX + B.maxX) / 2;
  const centerZ = (B.minZ + B.maxZ) / 2;
  const carpetTexture = useMemo(() => {
    const texture = createCarpetTexture({ anisotropy: gl.capabilities.getMaxAnisotropy() });
    texture.repeat.set(width / 1.6, depth / 1.6);
    return texture;
  }, [depth, gl, width]);
  const velvetTexture = useMemo(() => createVelvetTexture(), []);
  const valanceTexture = useMemo(() => {
    const texture = velvetTexture.clone();
    texture.repeat.set(6, 1);
    return texture;
  }, [velvetTexture]);
  const starsGeometry = useMemo(() => {
    const stars = new Float32Array(240 * 3);
    for (let index = 0; index < 240; index += 1) {
      const horizontal = Math.abs(Math.sin(index * 12.9898) * 43758.5453) % 1;
      const depthPosition = Math.abs(Math.sin(index * 78.233) * 43758.5453) % 1;
      stars.set(
        [
          B.minX + 0.4 + horizontal * (width - 0.8),
          H - 0.02,
          B.minZ + 0.4 + depthPosition * (depth - 0.8),
        ],
        index * 3,
      );
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(stars, 3));
    return geometry;
  }, [depth, width]);
  const beamGeometry = useMemo(() => {
    const apex = new THREE.Vector3(0, DOOR.height + 1.35, BACK_Z + 0.05);
    const halfWidth = SCREEN.width / 2;
    const halfHeight = SCREEN.height / 2;
    const corners = [
      [-halfWidth, -halfHeight],
      [halfWidth, -halfHeight],
      [halfWidth, halfHeight],
      [-halfWidth, halfHeight],
    ].map(([x = 0, y = 0]) => new THREE.Vector3(x, SCREEN.y + y, SCREEN_Z - 0.05));
    const positions: number[] = [];
    const colors: number[] = [];
    for (let index = 0; index < 4; index += 1) {
      const corner = corners[index];
      const next = corners[(index + 1) % 4];
      if (!corner || !next) continue;
      for (const [vertex, color] of [
        [apex, 0.35],
        [corner, 0.015],
        [next, 0.015],
      ] as const) {
        positions.push(vertex.x, vertex.y, vertex.z);
        colors.push(color, color, color);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geometry;
  }, []);
  const exitSign = useMemo(
    () =>
      signMesh('EXIT', {
        width: 0.5,
        height: 0.18,
        bg: '#0c1a10',
        fg: '#3dff7a',
        font: '700 120px Inter, sans-serif',
      }),
    [],
  );
  const marqueeSign = useMemo(
    () =>
      signMesh('CINEMA', {
        width: 1.9,
        height: 0.42,
        bg: '#1b1a17',
        fg: '#e9d9b8',
        font: '600 150px "Cormorant Garamond", Georgia, serif',
        spacing: 0.35,
      }),
    [],
  );

  useEffect(
    () => () => {
      carpetTexture.dispose();
    },
    [carpetTexture],
  );
  useEffect(
    () => () => {
      velvetTexture.dispose();
    },
    [velvetTexture],
  );
  useEffect(
    () => () => {
      valanceTexture.dispose();
    },
    [valanceTexture],
  );
  useEffect(
    () => () => {
      disposeCanvasPanel(exitSign);
    },
    [exitSign],
  );
  useEffect(
    () => () => {
      disposeCanvasPanel(marqueeSign);
    },
    [marqueeSign],
  );
  const host = useMemo(
    () => ({ camera, canvas: gl.domElement, scene, setAmbient }),
    [camera, gl.domElement, scene, setAmbient],
  );
  const playback = useMemo(() => new CinemaPlayback(host, placement), [host, placement]);

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    const letterbox = letterboxRef.current;
    const screenLight = screenLightRef.current;
    const stageLed = stageLedRef.current;
    const beam = beamRef.current;
    const lens = lensRef.current;
    const speaker = speakerRef.current;
    if (!surface || !letterbox || !screenLight || !stageLed || !beam || !lens || !speaker) return;
    const sconces = [
      sconce0Ref.current,
      sconce1Ref.current,
      sconce2Ref.current,
      sconce3Ref.current,
    ].flatMap((light) => (light ? [{ light, base: 2.2 }] : []));
    const bindings: CinemaRenderBindings = {
      surface,
      letterbox,
      screenLight,
      stageLed,
      beamMesh: beam,
      projectorLens: lens,
      speaker,
      sconces,
    };
    playback.attach(
      bindings,
      [seat0Ref.current, seat1Ref.current, seat2Ref.current, seat3Ref.current].flatMap((seat) =>
        seat ? [seat] : [],
      ),
    );
    onCinemaReady?.(playback);
    return () => {
      onCinemaReady?.(null);
      playback.dispose();
    };
  }, [onCinemaReady, playback]);

  useEffect(() => {
    playback.setInteractive(isWatching);
  }, [isWatching, playback]);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    const offsets: readonly { x: number; y: number; z: number; tilt: number }[] = [
      { x: 0, y: 0.44, z: 0.03, tilt: 0 },
      { x: 0, y: 0.86, z: -0.24, tilt: -0.12 },
      { x: -0.31, y: 0.34, z: -0.02, tilt: 0 },
      { x: 0.31, y: 0.34, z: -0.02, tilt: 0 },
    ];
    for (const [partIndex, mesh] of [
      seat0Ref.current,
      seat1Ref.current,
      seat2Ref.current,
      seat3Ref.current,
    ].entries()) {
      if (!mesh) continue;
      const offset = offsets[partIndex];
      if (!offset) continue;
      for (const [seatIndex, seat] of SEATS.entries()) {
        dummy.position.set(seat.x + offset.x, offset.y, seat.z + offset.z);
        dummy.rotation.set(offset.tilt, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(seatIndex, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, []);

  useFrame((_, delta) => {
    playback.update(delta);
  });

  const stage = CINEMA.stage;
  const drapeHeight = H - stage.height - 0.1;
  const panelCount = Math.floor((B.maxZ - B.minZ - 2.8) / 2) + 1;

  return (
    <group
      name="declarative-cinema"
      position={placement.position}
      rotation={[0, placement.rotationY, 0]}
    >
      <mesh position={[centerX, 0, centerZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial map={carpetTexture} roughness={1} />
      </mesh>
      <mesh position={[centerX, H, centerZ]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={PALETTE.ceiling} roughness={1} />
      </mesh>
      <points geometry={starsGeometry}>
        <pointsMaterial color={0xffe2b0} size={0.035} />
      </points>
      {Array.from({ length: panelCount }, (_, index) => {
        const z = B.minZ + 1.2 + index * 2;
        return (
          <group key={`panel-side-${String(index)}`}>
            <mesh position={[B.minX + FACE + 0.03, 2.3, z]}>
              <boxGeometry args={[0.06, 3.6, 1.7]} />
              <meshStandardMaterial color={PALETTE.panel} roughness={1} />
            </mesh>
            <mesh position={[B.maxX - FACE - 0.03, 2.3, z]}>
              <boxGeometry args={[0.06, 3.6, 1.7]} />
              <meshStandardMaterial color={PALETTE.panel} roughness={1} />
            </mesh>
          </group>
        );
      })}
      {[-6, -4, -2, 2, 4, 6].map((x) => (
        <mesh key={`panel-back-${String(x)}`} position={[x, 2.3, BACK_Z + 0.03]}>
          <boxGeometry args={[1.7, 3.6, 0.06]} />
          <meshStandardMaterial color={PALETTE.panel} roughness={1} />
        </mesh>
      ))}
      {[B.minZ + 4.2, B.minZ + 10.2].map((z) =>
        [-1, 1].map((side) => {
          const wallX = side < 0 ? B.minX + FACE : B.maxX - FACE;
          const index = (z === B.minZ + 10.2 ? 2 : 0) + (side > 0 ? 1 : 0);
          return (
            <group
              key={`sconce-${String(z)}-${String(side)}`}
              position={[wallX, 2.9, z]}
              rotation={[0, side < 0 ? 0 : Math.PI, 0]}
            >
              <mesh>
                <cylinderGeometry args={[0.13, 0.08, 0.38, 16, 1, false, 0, Math.PI]} />
                <meshStandardMaterial
                  color={0x2a1c14}
                  emissive={PALETTE.warm}
                  emissiveIntensity={2}
                />
              </mesh>
              <pointLight
                ref={
                  index === 0
                    ? sconce0Ref
                    : index === 1
                      ? sconce1Ref
                      : index === 2
                        ? sconce2Ref
                        : sconce3Ref
                }
                position={[-side * 0.35, 0.1, 0]}
                color={PALETTE.warm}
                intensity={2.2}
                distance={5.5}
                decay={2}
              />
            </group>
          );
        }),
      )}
      <mesh position={[0, stage.height / 2, B.maxZ - stage.depth / 2]}>
        <boxGeometry args={[width, stage.height, stage.depth]} />
        <meshStandardMaterial color={PALETTE.trim} roughness={0.55} />
      </mesh>
      <mesh ref={stageLedRef} position={[0, stage.height - 0.03, B.maxZ - stage.depth - 0.01]}>
        <boxGeometry args={[width, 0.02, 0.02]} />
        <meshBasicMaterial color={PALETTE.warm} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={`drape-${String(side)}`}
          position={[
            side * (SCREEN.width / 2 + 1),
            stage.height + drapeHeight / 2,
            SCREEN_Z - 0.35,
          ]}
        >
          <boxGeometry args={[1.5, drapeHeight, 0.25]} />
          <meshPhysicalMaterial
            map={velvetTexture}
            roughness={0.9}
            sheen={1}
            sheenColor={new THREE.Color(0xff6a7a)}
            sheenRoughness={0.45}
          />
        </mesh>
      ))}
      <mesh position={[0, H - 0.3, SCREEN_Z - 0.4]}>
        <boxGeometry args={[B.maxX - B.minX, 0.6, 0.3]} />
        <meshPhysicalMaterial
          map={valanceTexture}
          roughness={0.9}
          sheen={1}
          sheenColor={new THREE.Color(0xff6a7a)}
          sheenRoughness={0.45}
        />
      </mesh>
      <group
        onClick={(event) => {
          event.stopPropagation();
          onOpenProgramme?.();
        }}
      >
        <mesh position={[0, SCREEN.y, SCREEN_Z + 0.02]}>
          <boxGeometry args={[SCREEN.width + 0.5, SCREEN.height + 0.5, 0.04]} />
          <meshStandardMaterial color={0x050505} roughness={1} />
        </mesh>
        <mesh
          ref={letterboxRef}
          position={[0, SCREEN.y, SCREEN_Z - 0.005]}
          rotation={[0, Math.PI, 0]}
        >
          <planeGeometry args={[SCREEN.width, SCREEN.height]} />
          <meshBasicMaterial color={0x020202} />
        </mesh>
        <mesh ref={surfaceRef} position={[0, SCREEN.y, SCREEN_Z - 0.01]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color={0xffffff} toneMapped={false} />
        </mesh>
      </group>
      <instancedMesh
        ref={seat0Ref}
        args={[undefined, undefined, SEATS.length]}
        onClick={(event) => {
          event.stopPropagation();
          if (event.instanceId !== undefined) {
            const pose = playback.interaction?.seatPose(event.instanceId);
            if (pose) onSitSeat?.(pose);
          }
        }}
      >
        <boxGeometry args={[0.56, 0.12, 0.5]} />
        <meshPhysicalMaterial
          color={PALETTE.seatFabric}
          roughness={0.85}
          sheen={1}
          sheenColor={new THREE.Color(0xff8a90)}
          sheenRoughness={0.5}
        />
      </instancedMesh>
      <instancedMesh ref={seat1Ref} args={[undefined, undefined, SEATS.length]}>
        <boxGeometry args={[0.56, 0.74, 0.1]} />
        <meshPhysicalMaterial
          color={PALETTE.seatFabric}
          roughness={0.85}
          sheen={1}
          sheenColor={new THREE.Color(0xff8a90)}
          sheenRoughness={0.5}
        />
      </instancedMesh>
      <instancedMesh ref={seat2Ref} args={[undefined, undefined, SEATS.length]}>
        <boxGeometry args={[0.06, 0.68, 0.6]} />
        <meshStandardMaterial color={PALETTE.seatFrame} roughness={0.5} metalness={0.2} />
      </instancedMesh>
      <instancedMesh ref={seat3Ref} args={[undefined, undefined, SEATS.length]}>
        <boxGeometry args={[0.06, 0.68, 0.6]} />
        <meshStandardMaterial color={PALETTE.seatFrame} roughness={0.5} metalness={0.2} />
      </instancedMesh>
      <group position={[0, DOOR.height + 1.35, BACK_Z + 0.05]}>
        <mesh position={[0, 0, -0.02]}>
          <boxGeometry args={[0.7, 0.4, 0.05]} />
          <meshStandardMaterial color={0x080808} />
        </mesh>
        <mesh ref={lensRef} position={[0, 0, 0.01]}>
          <circleGeometry args={[0.07, 24]} />
          <meshBasicMaterial color={0xffffff} toneMapped={false} />
        </mesh>
      </group>
      <mesh ref={beamRef} geometry={beamGeometry} visible={false}>
        <meshBasicMaterial
          vertexColors
          transparent
          opacity={0}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
        />
      </mesh>
      <rectAreaLight
        ref={screenLightRef}
        position={[0, SCREEN.y, SCREEN_Z - 0.05]}
        rotation={[0, Math.PI, 0]}
        intensity={1}
        width={SCREEN.width}
        height={SCREEN.height}
      />
      <group ref={speakerRef} position={[0, SCREEN.y, SCREEN_Z - 0.3]} rotation={[0, Math.PI, 0]} />
      <primitive
        object={exitSign}
        dispose={null}
        position={[0, DOOR.height + 0.3, BACK_Z + 0.02]}
      />
      <primitive
        object={marqueeSign}
        dispose={null}
        position={[0, DOOR.height + 0.55, B.minZ - FACE - 0.02]}
        rotation={[0, Math.PI, 0]}
      />
    </group>
  );
}
