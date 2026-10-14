import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { CINEMA, SEATS, DOOR, ROOM } from '../../world/layout.js';
import { createCarpetTexture, createVelvetTexture } from '../../world/textures.js';
import { signMesh } from '../../world/signage.js';

const B = CINEMA.bounds;
const FACE = ROOM.wall / 2;
const H = CINEMA.height;
const SCREEN = CINEMA.screen;
const SCREEN_Z = B.maxZ - FACE - 0.03;
const BACK_Z = B.minZ + FACE;
const SEATED_EYE = 1.12;

const PALETTE = {
  ceiling: 0x0d0b0c,
  panel: 0x3a1a20,
  trim: 0x1a1311,
  seatFabric: 0x7d1d27,
  seatFrame: 0x161213,
  warm: 0xffb36b,
};

export function MuseumCinema({
  cinemaHall,
  isWatching,
  onOpenProgramme,
  onSitSeat,
}) {
  const { gl, camera } = useThree();
  const screenRef = useRef();

  // Width & depth of cinema room
  const width = B.maxX - B.minX;
  const depth = B.maxZ - B.minZ;
  const cx = (B.minX + B.maxX) / 2;
  const cz = (B.minZ + B.maxZ) / 2;

  // Carpet texture
  const carpetTexture = useMemo(() => {
    const tex = createCarpetTexture({ anisotropy: gl?.capabilities?.getMaxAnisotropy() || 8 });
    tex.repeat.set(width / 1.6, depth / 1.6);
    return tex;
  }, [width, depth, gl]);

  // Velvet drape texture
  const velvetTexture = useMemo(() => createVelvetTexture(), []);

  // Fiber-optic starry sky
  const starsBuffer = useMemo(() => {
    const stars = new Float32Array(240 * 3);
    for (let i = 0; i < 240; i++) {
      stars.set(
        [
          B.minX + 0.4 + Math.random() * (width - 0.8),
          H - 0.02,
          B.minZ + 0.4 + Math.random() * (depth - 0.8),
        ],
        i * 3
      );
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(stars, 3));
    return geo;
  }, [width, depth]);

  // Projector beam geometry
  const beamGeometry = useMemo(() => {
    const apex = new THREE.Vector3(0, DOOR.height + 1.35, BACK_Z + 0.05);
    const hw = SCREEN.width / 2;
    const hh = SCREEN.height / 2;
    const corners = [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ].map(([x, y]) => new THREE.Vector3(x, SCREEN.y + y, SCREEN_Z - 0.05));

    const positions = [];
    const colors = [];
    for (let i = 0; i < 4; i++) {
      for (const [v, c] of [
        [apex, 0.35],
        [corners[i], 0.015],
        [corners[(i + 1) % 4], 0.015],
      ]) {
        positions.push(v.x, v.y, v.z);
        colors.push(c, c, c);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geo;
  }, []);

  // Signs
  const exitSign = useMemo(
    () =>
      signMesh('EXIT', {
        width: 0.5,
        height: 0.18,
        bg: '#0c1a10',
        fg: '#3dff7a',
        font: '700 120px Inter, sans-serif',
      }),
    []
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
    []
  );

  // Seat instancing meshes
  const seatMeshes = useMemo(() => {
    const fabric = new THREE.MeshPhysicalMaterial({
      color: PALETTE.seatFabric,
      roughness: 0.85,
      sheen: 1,
      sheenColor: new THREE.Color(0xff8a90),
      sheenRoughness: 0.5,
    });
    const frame = new THREE.MeshStandardMaterial({
      color: PALETTE.seatFrame,
      roughness: 0.5,
      metalness: 0.2,
    });
    const parts = [
      { geo: new THREE.BoxGeometry(0.56, 0.12, 0.5), mat: fabric, offset: [0, 0.44, 0.03] },
      { geo: new THREE.BoxGeometry(0.56, 0.74, 0.1), mat: fabric, offset: [0, 0.86, -0.24], tilt: -0.12 },
      { geo: new THREE.BoxGeometry(0.06, 0.68, 0.6), mat: frame, offset: [-0.31, 0.34, -0.02] },
      { geo: new THREE.BoxGeometry(0.06, 0.68, 0.6), mat: frame, offset: [0.31, 0.34, -0.02] },
    ];
    const dummy = new THREE.Object3D();
    return parts.map(({ geo, mat, offset, tilt = 0 }) => {
      const mesh = new THREE.InstancedMesh(geo, mat, SEATS.length);
      SEATS.forEach((seat, i) => {
        dummy.position.set(seat.x + offset[0], offset[1], seat.z + offset[2]);
        dummy.rotation.set(tilt, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.computeBoundingSphere();
      return mesh;
    });
  }, []);

  // Sync cinema hall update loop in useFrame
  useFrame((_, delta) => {
    if (cinemaHall) {
      cinemaHall.update(delta, { camera });
    }
  });

  const stage = CINEMA.stage;
  const drapeH = H - stage.height - 0.1;

  return (
    <group name="declarative-cinema">
      {/* Carpet Floor */}
      <mesh position={[cx, 0, cz]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial map={carpetTexture} roughness={1} />
      </mesh>

      {/* Ceiling */}
      <mesh position={[cx, H, cz]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={PALETTE.ceiling} roughness={1} />
      </mesh>

      {/* Starry Sky */}
      <points geometry={starsBuffer}>
        <pointsMaterial color={0xffe2b0} size={0.035} />
      </points>

      {/* Acoustic Fabric Panels */}
      {Array.from({ length: Math.floor((B.maxZ - B.minZ - 2.8) / 2) + 1 }, (_, i) => {
        const z = B.minZ + 1.2 + i * 2;
        return (
          <group key={`panel-side-${i}`}>
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
        <mesh key={`panel-back-${x}`} position={[x, 2.3, BACK_Z + 0.03]}>
          <boxGeometry args={[1.7, 3.6, 0.06]} />
          <meshStandardMaterial color={PALETTE.panel} roughness={1} />
        </mesh>
      ))}

      {/* Sconces */}
      {[B.minZ + 4.2, B.minZ + 10.2].map((z) =>
        [-1, 1].map((side) => {
          const wallX = side < 0 ? B.minX + FACE : B.maxX - FACE;
          return (
            <group key={`sconce-${z}-${side}`} position={[wallX, 2.9, z]} rotation={[0, side < 0 ? 0 : Math.PI, 0]}>
              <mesh>
                <cylinderGeometry args={[0.13, 0.08, 0.38, 16, 1, false, 0, Math.PI]} />
                <meshStandardMaterial color={0x2a1c14} emissive={PALETTE.warm} emissiveIntensity={2} />
              </mesh>
              <pointLight position={[-side * 0.35, 0.1, 0]} color={PALETTE.warm} intensity={2.2} distance={5.5} decay={2} />
            </group>
          );
        })
      )}

      {/* Stage */}
      <mesh position={[0, stage.height / 2, B.maxZ - stage.depth / 2]}>
        <boxGeometry args={[width, stage.height, stage.depth]} />
        <meshStandardMaterial color={PALETTE.trim} roughness={0.55} />
      </mesh>
      <mesh position={[0, stage.height - 0.03, B.maxZ - stage.depth - 0.01]}>
        <boxGeometry args={[width, 0.02, 0.02]} />
        <meshBasicMaterial color={PALETTE.warm} />
      </mesh>

      {/* Velvet Drapes */}
      {[-1, 1].map((side) => (
        <mesh
          key={`drape-${side}`}
          position={[side * (SCREEN.width / 2 + 1.0), stage.height + drapeH / 2, SCREEN_Z - 0.35]}
        >
          <boxGeometry args={[1.5, drapeH, 0.25]} />
          <meshPhysicalMaterial map={velvetTexture} roughness={0.9} sheen={1} sheenColor={new THREE.Color(0xff6a7a)} sheenRoughness={0.45} />
        </mesh>
      ))}

      {/* Screen Masking & Surface */}
      <group
        onClick={(e) => {
          e.stopPropagation();
          onOpenProgramme?.();
        }}
      >
        <mesh position={[0, SCREEN.y, SCREEN_Z + 0.02]}>
          <boxGeometry args={[SCREEN.width + 0.5, SCREEN.height + 0.5, 0.04]} />
          <meshStandardMaterial color={0x050505} roughness={1} />
        </mesh>
        <mesh position={[0, SCREEN.y, SCREEN_Z - 0.005]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[SCREEN.width, SCREEN.height]} />
          <meshBasicMaterial color={0x020202} />
        </mesh>
        {/* In-world surface hooked to cinemaHall active film texture */}
        {cinemaHall?.surface && <primitive object={cinemaHall.surface} />}
      </group>

      {/* Seats */}
      {seatMeshes.map((seatInst, i) => (
        <primitive
          key={i}
          object={seatInst}
          onClick={(e) => {
            e.stopPropagation();
            if (e.instanceId !== undefined) {
              const seat = SEATS[e.instanceId];
              if (seat) {
                onSitSeat?.(seat);
              }
            }
          }}
        />
      ))}

      {/* Projector Booth & Beam */}
      <group position={[0, DOOR.height + 1.35, BACK_Z + 0.05]}>
        <mesh position={[0, 0, -0.02]}>
          <boxGeometry args={[0.7, 0.4, 0.05]} />
          <meshStandardMaterial color={0x080808} />
        </mesh>
        <mesh position={[0, 0, 0.01]}>
          <circleGeometry args={[0.07, 24]} />
          <meshBasicMaterial color={0xffffff} />
        </mesh>
      </group>
      {cinemaHall?.beamMesh && <primitive object={cinemaHall.beamMesh} />}

      {/* Signs */}
      <primitive object={exitSign} position={[0, DOOR.height + 0.3, BACK_Z + 0.02]} />
      <primitive object={marqueeSign} position={[0, DOOR.height + 0.55, B.minZ - FACE - 0.02]} rotation={[0, Math.PI, 0]} />
    </group>
  );
}
