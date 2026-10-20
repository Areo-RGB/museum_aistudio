import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { LOBBY, ROOM } from '../../world/layout.ts';
import type { BenchLayout, HallBounds, MuseumLayout, WallLayout } from '../../world/layout.ts';
import type { FrameSlot } from '../../types.ts';
import { canvasPanel, disposeCanvasPanel, periodLabel } from '../../world/signage.ts';
import {
  createCarpetTexture,
  createWoodFloorBumpTexture,
  createWoodFloorTexture,
} from '../../world/textures.ts';

const PALETTE = {
  wall: 0xefece6,
  accentWall: 0x163b68,
  baseboard: 0x181c24,
  ceiling: 0xf6f4ef,
  skylight: 0xfdfbf7,
  coffer: 0xdcd7cd,
  cofferFrame: 0x232730,
  track: 0x161920,
  benchWood: 0x543824,
  benchLeather: 0x13294b,
  benchMetal: 0x1a1e26,
  cinemaWall: 0x120f14,
  brass: 0xc5a059,
} as const;

const FAME = {
  wall: 0x0f2342,
  accentWall: 0x081529,
  ceiling: 0x0c1a30,
  baseboard: 0x9e7b3b,
  carpet: 0x7a1420,
  gold: 0xd4af37,
} as const;

const PILASTER_OFFSET = 3.1;

interface BenchProps {
  bench: BenchLayout;
}

function Bench({ bench }: BenchProps) {
  const { x, z, w, d } = bench;
  return (
    <group position={[x, 0, z]}>
      {/* Soft grounding shadow plane */}
      <mesh position={[0, 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w + 0.24, d + 0.24]} />
        <meshBasicMaterial color={0x000000} transparent opacity={0.22} depthWrite={false} />
      </mesh>
      {/* Timber base deck */}
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[w, 0.045, d]} />
        <meshStandardMaterial color={PALETTE.benchWood} roughness={0.48} />
      </mesh>
      {/* Brass perimeter inlay strip */}
      <mesh position={[0, 0.425, 0]}>
        <boxGeometry args={[w + 0.01, 0.012, d + 0.01]} />
        <meshStandardMaterial color={PALETTE.brass} roughness={0.28} metalness={0.85} />
      </mesh>
      {/* Upholstered Hertha navy leather cushion */}
      <mesh position={[0, 0.465, 0]}>
        <boxGeometry args={[w - 0.04, 0.068, d - 0.04]} />
        <meshStandardMaterial color={PALETTE.benchLeather} roughness={0.42} metalness={0.08} />
      </mesh>
      {/* Center seam detail */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[w - 0.08, 0.004, 0.012]} />
        <meshStandardMaterial color={PALETTE.brass} roughness={0.3} metalness={0.8} />
      </mesh>
      {/* Architectural sled legs & stretcher bar */}
      {[-d / 2 + 0.22, d / 2 - 0.22].map((legZ) => (
        <mesh key={legZ} position={[0, 0.2, legZ]}>
          <boxGeometry args={[w - 0.12, 0.4, 0.055]} />
          <meshStandardMaterial color={PALETTE.benchMetal} roughness={0.35} metalness={0.68} />
        </mesh>
      ))}
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[0.08, 0.04, d - 0.44]} />
        <meshStandardMaterial color={PALETTE.benchMetal} roughness={0.35} metalness={0.68} />
      </mesh>
    </group>
  );
}

interface CeilingFixturesProps {
  hall: HallBounds;
  slots: readonly FrameSlot[];
}

interface SpotData {
  position: [number, number, number];
  rotation: THREE.Euler;
}

function CeilingFixtures({ hall, slots }: CeilingFixturesProps) {
  const y = hall.height;
  const spacing = 6;
  const count = Math.max(1, Math.floor((hall.length - 2) / spacing));
  const first = hall.minZ + (hall.length - (count - 1) * spacing) / 2;
  const trackX = hall.maxX - 2.2;
  const metal = useMemo(
    () =>
      new THREE.MeshStandardMaterial({ color: PALETTE.track, roughness: 0.38, metalness: 0.72 }),
    [],
  );
  const brass = useMemo(
    () =>
      new THREE.MeshStandardMaterial({ color: PALETTE.brass, roughness: 0.28, metalness: 0.85 }),
    [],
  );
  useEffect(() => {
    return () => {
      metal.dispose();
      brass.dispose();
    };
  }, [brass, metal]);

  const spotData = useMemo<SpotData[]>(() => {
    const dummy = new THREE.Object3D();
    return slots.map((slot) => {
      const [sx, sy, sz] = slot.position;
      const near: [number, number, number] = slot.hero
        ? [0, y - 0.2, sz - 2.4]
        : [Math.sign(sx) * trackX, y - 0.2, sz];
      dummy.position.set(...near);
      dummy.rotation.set(0, 0, 0);
      dummy.lookAt(sx, sy, sz);
      return { position: near, rotation: dummy.rotation.clone() };
    });
  }, [slots, trackX, y]);

  return (
    <group>
      {Array.from({ length: count }, (_, index) => {
        const z = first + index * spacing;
        return (
          <group key={index} position={[0, y, z]}>
            <mesh position={[0, -0.003, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <planeGeometry args={[3.1, 3.1]} />
              <meshStandardMaterial color={PALETTE.cofferFrame} roughness={0.5} metalness={0.4} />
            </mesh>
            <mesh position={[0, -0.006, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <planeGeometry args={[2.9, 2.9]} />
              <meshStandardMaterial color={PALETTE.coffer} roughness={0.9} />
            </mesh>
            <mesh position={[0, -0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <planeGeometry args={[2.5, 2.5]} />
              <meshBasicMaterial color={PALETTE.skylight} />
            </mesh>
          </group>
        );
      })}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * trackX, y - 0.04, (hall.minZ + hall.maxZ) / 2]}>
          <boxGeometry args={[0.06, 0.04, hall.length - 1]} />
          <primitive object={metal} attach="material" />
        </mesh>
      ))}
      {spotData.map((spot, index) => (
        <group key={index} position={spot.position} rotation={spot.rotation}>
          <mesh>
            <cylinderGeometry args={[0.055, 0.075, 0.2, 14]} />
            <primitive object={metal} attach="material" />
          </mesh>
          <mesh position={[0, -0.095, 0]}>
            <cylinderGeometry args={[0.076, 0.076, 0.018, 14]} />
            <primitive object={brass} attach="material" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

interface FameDecorProps {
  layout: MuseumLayout;
}

interface DecorBox {
  position: [number, number, number];
  args: [number, number, number];
}

function HallOfFameDecor({ layout }: FameDecorProps) {
  const { gl } = useThree();
  const { hall, slots } = layout;
  const face = ROOM.wall / 2;
  const carpetLength = hall.length - 3;
  const carpetZ = hall.minZ + 1 + carpetLength / 2;
  const goldMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: FAME.gold, roughness: 0.25, metalness: 0.88 }),
    [],
  );
  useEffect(() => {
    return () => {
      goldMat.dispose();
    };
  }, [goldMat]);

  const carpetTexture = useMemo(() => {
    const texture = createCarpetTexture({
      anisotropy: gl.capabilities.getMaxAnisotropy() || 16,
    });
    texture.repeat.set(1.6, carpetLength / 1.6);
    return texture;
  }, [carpetLength, gl]);
  useEffect(() => {
    return () => {
      carpetTexture.dispose();
    };
  }, [carpetTexture]);

  const titlePanel = useMemo(() => {
    const title = canvasPanel(
      5.6,
      0.85,
      (context, width, height) => {
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = 'rgba(230, 200, 117, 0.82)';
        context.font = `600 ${String(height * 0.16)}px "Outfit", sans-serif`;
        context.letterSpacing = '0.28em';
        context.fillText('F.C. HERTHA 03 ZEHLENDORF · JAHRGANG 2014', width / 2, height * 0.2);
        context.fillStyle = '#e6c875';
        context.font = `600 ${String(height * 0.5)}px "Cormorant Garamond", Georgia, serif`;
        context.letterSpacing = '0.2em';
        context.fillText('HALL OF FAME', width / 2, height * 0.56);
        context.letterSpacing = '0em';
        context.font = `${String(height * 0.28)}px Georgia, serif`;
        for (const x of [width * 0.05, width * 0.95]) context.fillText('★', x, height * 0.54);
        context.fillStyle = '#d4af37';
        context.fillRect(width * 0.18, height * 0.88, width * 0.64, height * 0.025);
      },
      { lit: false, transparent: true, resolution: 1536 },
    );
    title.position.set(0, hall.height - 0.58, hall.maxZ - face - 0.02);
    title.rotation.y = Math.PI;
    return title;
  }, [face, hall.height, hall.maxZ]);
  useEffect(() => {
    return () => {
      disposeCanvasPanel(titlePanel);
    };
  }, [titlePanel]);

  const { pilasters, dadoRails, cornices } = useMemo(() => {
    const pilasters: DecorBox[] = [];
    const dadoRails: DecorBox[] = [];
    const cornices: DecorBox[] = [];
    const sideZs = [...new Set(slots.filter((slot) => !slot.hero).map((slot) => slot.position[2]))];
    for (const z of sideZs.flatMap((value) => [value - PILASTER_OFFSET, value + PILASTER_OFFSET])) {
      for (const side of [-1, 1] as const) {
        pilasters.push({
          position: [side * (hall.maxX - face - 0.05), (hall.height - 0.6) / 2, z],
          args: [0.1, hall.height - 0.6, 0.32],
        });
      }
    }
    const { directory, elevator } = LOBBY;
    const elevatorZ = elevator.placement.position[2];
    const lobbyGap: [number, number] = [
      directory.position[2] - directory.width / 2 - 0.2,
      elevatorZ + elevator.width / 2 + 0.2,
    ];
    for (const side of [-1, 1] as const) {
      const x = side * (hall.maxX - face - 0.02);
      cornices.push({
        position: [x, hall.height - 0.5, (hall.minZ + hall.maxZ) / 2],
        args: [0.04, 0.12, hall.length],
      });
      const gaps: [number, number][] = slots
        .filter((slot) => !slot.hero && Math.sign(slot.position[0]) === side)
        .map((slot) => [slot.position[2] - PILASTER_OFFSET, slot.position[2] + PILASTER_OFFSET]);
      if (side < 0) gaps.push(lobbyGap);
      gaps.sort((a, b) => a[0] - b[0]);
      let from = hall.minZ;
      for (const [start, end] of [...gaps, [hall.maxZ, hall.maxZ] as [number, number]]) {
        if (start > from) {
          dadoRails.push({
            position: [x, 1.05, (from + start) / 2],
            args: [0.04, 0.05, start - from],
          });
        }
        from = Math.max(from, end);
      }
    }
    return { pilasters, dadoRails, cornices };
  }, [face, hall, slots]);

  const renderDecorBoxes = (boxes: readonly DecorBox[], prefix: string) =>
    boxes.map((box, index) => (
      <mesh key={`${prefix}-${String(index)}`} position={box.position}>
        <boxGeometry args={box.args} />
        <primitive object={goldMat} attach="material" />
      </mesh>
    ));

  return (
    <group>
      <mesh position={[0, 0.004, carpetZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.8, carpetLength]} />
        <meshStandardMaterial map={carpetTexture} roughness={0.88} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 1.44, 0.004, carpetZ]}>
          <boxGeometry args={[0.08, 0.008, carpetLength]} />
          <primitive object={goldMat} attach="material" />
        </mesh>
      ))}
      {renderDecorBoxes(cornices, 'cornice')}
      {renderDecorBoxes(dadoRails, 'dado')}
      {renderDecorBoxes(pilasters, 'pilaster')}
      <primitive object={titlePanel} />
    </group>
  );
}

export interface MuseumEnvironmentProps {
  layout: MuseumLayout | null;
}

export function MuseumEnvironment({ layout }: MuseumEnvironmentProps) {
  if (!layout) return null;
  return <MuseumEnvironmentContents layout={layout} />;
}

interface MuseumEnvironmentContentsProps {
  layout: MuseumLayout;
}

function MuseumEnvironmentContents({ layout }: MuseumEnvironmentContentsProps) {
  const { gl } = useThree();
  const { hall } = layout;
  const fame = layout.theme === 'fame';
  const width = hall.maxX - hall.minX;
  const centerZ = (hall.minZ + hall.maxZ) / 2;
  const maxAnisotropy = gl.capabilities.getMaxAnisotropy() || 16;
  const floorTexture = useMemo(() => {
    const texture = createWoodFloorTexture({ anisotropy: maxAnisotropy });
    texture.repeat.set(width / 1.8, hall.length / 1.8);
    texture.rotation = Math.PI / 2;
    return texture;
  }, [hall.length, maxAnisotropy, width]);

  const floorBumpTexture = useMemo(() => {
    const texture = createWoodFloorBumpTexture({ anisotropy: maxAnisotropy });
    texture.repeat.set(width / 1.8, hall.length / 1.8);
    texture.rotation = Math.PI / 2;
    return texture;
  }, [hall.length, maxAnisotropy, width]);

  useEffect(() => {
    return () => {
      floorTexture.dispose();
      floorBumpTexture.dispose();
    };
  }, [floorBumpTexture, floorTexture]);

  const wallMaterials = useMemo(
    () => ({
      hall: new THREE.MeshStandardMaterial({
        color: fame ? FAME.wall : PALETTE.wall,
        roughness: 0.88,
      }),
      accent: new THREE.MeshStandardMaterial({
        color: fame ? FAME.accentWall : PALETTE.accentWall,
        roughness: 0.82,
      }),
      cinema: new THREE.MeshStandardMaterial({ color: PALETTE.cinemaWall, roughness: 0.95 }),
      baseboard: new THREE.MeshStandardMaterial({
        color: fame ? FAME.baseboard : PALETTE.baseboard,
        roughness: 0.6,
        metalness: fame ? 0.6 : 0,
      }),
      brass: new THREE.MeshStandardMaterial({
        color: PALETTE.brass,
        roughness: 0.3,
        metalness: 0.85,
      }),
    }),
    [fame],
  );
  useEffect(() => {
    return () => {
      Object.values(wallMaterials).forEach((material) => {
        material.dispose();
      });
    };
  }, [wallMaterials]);

  const periodSigns = useMemo(() => {
    const face = ROOM.wall / 2 + 0.01;
    return layout.sections.flatMap((section) =>
      ([-1, 1] as const).map((side) => {
        const label = periodLabel(section.period, { dark: fame });
        label.position.set(side * (hall.maxX - face), 2.35, section.labelZ);
        label.rotation.y = (-side * Math.PI) / 2;
        return label;
      }),
    );
  }, [fame, hall.maxX, layout.sections]);
  useEffect(() => {
    return () => {
      periodSigns.forEach((sign) => {
        disposeCanvasPanel(sign);
      });
    };
  }, [periodSigns]);

  const washLights = useMemo<[number, number, number][]>(() => {
    const lights: [number, number, number][] = [];
    for (let z = hall.minZ + 13; z < hall.maxZ - 2; z += 12) lights.push([0, hall.height - 0.6, z]);
    return lights;
  }, [hall.height, hall.maxZ, hall.minZ]);

  return (
    <group name="declarative-environment">
      <mesh position={[0, 0, centerZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, hall.length]} />
        <meshStandardMaterial
          map={floorTexture}
          bumpMap={floorBumpTexture}
          bumpScale={0.0035}
          roughness={0.36}
          metalness={0.01}
        />
      </mesh>
      <mesh position={[0, hall.height, centerZ]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, hall.length]} />
        <meshStandardMaterial color={fame ? FAME.ceiling : PALETTE.ceiling} roughness={0.95} />
      </mesh>
      {layout.walls.map((wall: WallLayout, index) => {
        const y0 = wall.y0 ?? 0;
        const y1 = wall.y1 ?? ROOM.height;
        const material = wall.accent
          ? wallMaterials.accent
          : wall.room === 'cinema'
            ? wallMaterials.cinema
            : wallMaterials.hall;
        return (
          <group key={index}>
            <mesh position={[wall.x, (y0 + y1) / 2, wall.z]}>
              <boxGeometry args={[wall.w, y1 - y0, wall.d]} />
              <primitive object={material} attach="material" />
            </mesh>
            {wall.room === 'hall' && y0 === 0 && (
              <mesh position={[wall.x, 0.07, wall.z]}>
                <boxGeometry args={[wall.w + 0.04, 0.14, wall.d + 0.04]} />
                <primitive object={wallMaterials.baseboard} attach="material" />
              </mesh>
            )}
          </group>
        );
      })}
      <CeilingFixtures hall={hall} slots={layout.slots} />
      {layout.benches.map((bench) => (
        <Bench key={`${String(bench.x)}:${String(bench.z)}`} bench={bench} />
      ))}
      {periodSigns.map((sign, index) => (
        <primitive key={index} object={sign} />
      ))}
      {!fame &&
        layout.sections.map((section) => (
          <mesh key={section.startZ} position={[0, 0.003, section.startZ]}>
            <boxGeometry args={[width, 0.006, 0.05]} />
            <primitive object={wallMaterials.brass} attach="material" />
          </mesh>
        ))}
      {fame && <HallOfFameDecor layout={layout} />}
      {washLights.map((position) => (
        <pointLight
          key={position[2]}
          position={position}
          color={0xfff1dc}
          intensity={7}
          distance={9.5}
          decay={1.6}
        />
      ))}
    </group>
  );
}
