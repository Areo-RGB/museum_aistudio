import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { ROOM, LOBBY } from '../../world/layout.js';
import { canvasPanel, periodLabel } from '../../world/signage.js';
import { createWoodFloorTexture } from '../../world/textures.js';

const PALETTE = {
  wall: 0xebe7df,
  accentWall: 0x163b68,
  baseboard: 0x2a2621,
  ceiling: 0xf4f2ec,
  skylight: 0xd6d0c3,
  coffer: 0xd9d5cc,
  track: 0x1d1c1a,
  benchWood: 0x6b4a2f,
  benchMetal: 0x1e1e1e,
  cinemaWall: 0x161214,
  brass: 0xb08d57,
};

const FAME = {
  wall: 0x12284a,
  accentWall: 0x0b1a33,
  ceiling: 0x1a2537,
  baseboard: 0x8a6a3a,
  carpet: 0x7a1420,
  gold: 0xc9a45c,
};

const PILASTER_OFFSET = 3.1;

function Bench({ bench }) {
  const { x, z, w, d } = bench;
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[w, 0.07, d]} />
        <meshStandardMaterial color={PALETTE.benchWood} roughness={0.5} />
      </mesh>
      {[-d / 2 + 0.2, d / 2 - 0.2].map((lz, i) => (
        <mesh key={i} position={[0, 0.21, lz]}>
          <boxGeometry args={[w - 0.08, 0.42, 0.06]} />
          <meshStandardMaterial color={PALETTE.benchMetal} roughness={0.4} metalness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function CeilingFixtures({ hall, slots }) {
  const y = hall.height;
  const spacing = 6;
  const count = Math.max(1, Math.floor((hall.length - 2) / spacing));
  const first = hall.minZ + (hall.length - (count - 1) * spacing) / 2;

  const trackX = hall.maxX - 2.2;
  const metal = useMemo(() => new THREE.MeshStandardMaterial({ color: PALETTE.track, roughness: 0.45, metalness: 0.6 }), []);

  const spotData = useMemo(() => {
    const dummy = new THREE.Object3D();
    return slots.map((slot) => {
      const [sx, sy, sz] = slot.position;
      const near = slot.hero
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
      {/* Skylight panels */}
      {Array.from({ length: count }, (_, i) => {
        const z = first + i * spacing;
        return (
          <group key={i} position={[0, y, z]}>
            <mesh position={[0, -0.004, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <planeGeometry args={[2.9, 2.9]} />
              <meshStandardMaterial color={PALETTE.coffer} roughness={1} />
            </mesh>
            <mesh position={[0, -0.008, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <planeGeometry args={[2.5, 2.5]} />
              <meshBasicMaterial color={PALETTE.skylight} />
            </mesh>
          </group>
        );
      })}

      {/* Lighting tracks */}
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * trackX, y - 0.04, (hall.minZ + hall.maxZ) / 2]}
        >
          <boxGeometry args={[0.05, 0.035, hall.length - 1]} />
          <primitive object={metal} attach="material" />
        </mesh>
      ))}

      {/* Spot fixtures */}
      {spotData.map((spot, i) => (
        <mesh
          key={i}
          position={spot.position}
          rotation={spot.rotation}
        >
          <cylinderGeometry args={[0.055, 0.075, 0.2, 14]} />
          <primitive object={metal} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

function HallOfFameDecor({ layout }) {
  const { hall, slots } = layout;
  const face = ROOM.wall / 2;
  const carpetLength = hall.length - 3;
  const carpetZ = hall.minZ + 1 + carpetLength / 2;

  const goldMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: FAME.gold, roughness: 0.28, metalness: 0.9 }),
    []
  );

  const titlePanel = useMemo(() => {
    const title = canvasPanel(
      5.2,
      0.75,
      (ctx, w, h) => {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#d8b56a';
        ctx.font = `600 ${h * 0.56}px "Cormorant Garamond", Georgia, serif`;
        ctx.letterSpacing = '0.22em';
        ctx.fillText('HALL OF FAME', w / 2, h * 0.46);
        ctx.letterSpacing = '0em';
        ctx.font = `${h * 0.3}px Georgia, serif`;
        for (const x of [w * 0.04, w * 0.96]) ctx.fillText('★', x, h * 0.46);
        ctx.fillRect(w * 0.2, h * 0.88, w * 0.6, h * 0.025);
      },
      { lit: false, transparent: true }
    );
    title.position.set(0, hall.height - 0.58, hall.maxZ - face - 0.02);
    title.rotation.y = Math.PI;
    return title;
  }, [hall.height, hall.maxZ, face]);

  // Pilaster and dado rail data
  const { pilasters, dadoRails, cornices } = useMemo(() => {
    const pList = [];
    const dList = [];
    const cList = [];

    const sideZs = [...new Set(slots.filter((s) => !s.hero).map((s) => s.position[2]))];
    for (const z of sideZs.flatMap((z) => [z - PILASTER_OFFSET, z + PILASTER_OFFSET])) {
      for (const side of [-1, 1]) {
        pList.push({
          position: [side * (hall.maxX - face - 0.05), (hall.height - 0.6) / 2, z],
          args: [0.1, hall.height - 0.6, 0.32],
        });
      }
    }

    const { directory, elevator } = LOBBY;
    const ez = elevator.placement.position[2];
    const lobbyGap = [directory.position[2] - directory.width / 2 - 0.2, ez + elevator.width / 2 + 0.2];

    for (const side of [-1, 1]) {
      const x = side * (hall.maxX - face - 0.02);
      cList.push({
        position: [x, hall.height - 0.5, (hall.minZ + hall.maxZ) / 2],
        args: [0.04, 0.12, hall.length],
      });

      const gaps = slots
        .filter((s) => !s.hero && Math.sign(s.position[0]) === side)
        .map((s) => [s.position[2] - PILASTER_OFFSET, s.position[2] + PILASTER_OFFSET]);
      if (side < 0) gaps.push(lobbyGap);
      gaps.sort((a, b) => a[0] - b[0]);

      let from = hall.minZ;
      for (const [start, end] of [...gaps, [hall.maxZ, hall.maxZ]]) {
        if (start > from) {
          dList.push({
            position: [x, 1.05, (from + start) / 2],
            args: [0.04, 0.05, start - from],
          });
        }
        from = Math.max(from, end);
      }
    }

    return { pilasters: pList, dadoRails: dList, cornices: cList };
  }, [hall, slots, face]);

  return (
    <group>
      {/* Red Carpet & Gold Edging */}
      <mesh position={[0, 0.004, carpetZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.6, carpetLength]} />
        <meshStandardMaterial color={FAME.carpet} roughness={0.95} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 1.34, 0.004, carpetZ]}>
          <boxGeometry args={[0.08, 0.008, carpetLength]} />
          <primitive object={goldMat} attach="material" />
        </mesh>
      ))}

      {/* Cornices */}
      {cornices.map((c, i) => (
        <mesh key={`cornice-${i}`} position={c.position}>
          <boxGeometry args={c.args} />
          <primitive object={goldMat} attach="material" />
        </mesh>
      ))}

      {/* Dado Rails */}
      {dadoRails.map((d, i) => (
        <mesh key={`dado-${i}`} position={d.position}>
          <boxGeometry args={d.args} />
          <primitive object={goldMat} attach="material" />
        </mesh>
      ))}

      {/* Pilasters */}
      {pilasters.map((p, i) => (
        <mesh key={`pilaster-${i}`} position={p.position}>
          <boxGeometry args={p.args} />
          <primitive object={goldMat} attach="material" />
        </mesh>
      ))}

      {/* Hall of Fame Marquee Title */}
      <primitive object={titlePanel} />
    </group>
  );
}

export function MuseumEnvironment({ layout }) {
  const { gl } = useThree();
  if (!layout) return null;

  const { hall } = layout;
  const fame = layout.theme === 'fame';
  const width = hall.maxX - hall.minX;
  const centerZ = (hall.minZ + hall.maxZ) / 2;

  // Procedural wood floor texture
  const floorTexture = useMemo(() => {
    const tex = createWoodFloorTexture({ anisotropy: gl?.capabilities?.getMaxAnisotropy() || 8 });
    tex.repeat.set(width / 1.8, hall.length / 1.8);
    tex.rotation = Math.PI / 2;
    return tex;
  }, [width, hall.length, gl]);

  // Wall materials
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
      cinema: new THREE.MeshStandardMaterial({
        color: PALETTE.cinemaWall,
        roughness: 0.95,
      }),
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
    [fame]
  );

  // Period label signage panels
  const periodSigns = useMemo(() => {
    const face = ROOM.wall / 2 + 0.01;
    const signs = [];
    for (const section of layout.sections) {
      for (const side of [-1, 1]) {
        const label = periodLabel(section.period, { dark: fame });
        label.position.set(side * (hall.maxX - face), 2.35, section.labelZ);
        label.rotation.y = (-side * Math.PI) / 2;
        signs.push(label);
      }
    }
    return signs;
  }, [layout.sections, hall.maxX, fame]);

  // Ceiling point wash lights
  const washLights = useMemo(() => {
    const lights = [];
    for (let z = hall.minZ + 13; z < hall.maxZ - 2; z += 12) {
      lights.push([0, hall.height - 0.6, z]);
    }
    return lights;
  }, [hall.minZ, hall.maxZ, hall.height]);

  return (
    <group name="declarative-environment">
      {/* Floor */}
      <mesh position={[0, 0, centerZ]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, hall.length]} />
        <meshStandardMaterial map={floorTexture} roughness={0.34} metalness={0.0} />
      </mesh>

      {/* Ceiling */}
      <mesh position={[0, hall.height, centerZ]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, hall.length]} />
        <meshStandardMaterial color={fame ? FAME.ceiling : PALETTE.ceiling} roughness={0.95} />
      </mesh>

      {/* Walls and baseboards */}
      {layout.walls.map((wall, i) => {
        const y0 = wall.y0 ?? 0;
        const y1 = wall.y1 ?? ROOM.height;
        const h = y1 - y0;
        const mat = wall.accent
          ? wallMaterials.accent
          : wallMaterials[wall.room] || wallMaterials.hall;

        return (
          <group key={i}>
            <mesh position={[wall.x, (y0 + y1) / 2, wall.z]}>
              <boxGeometry args={[wall.w, h, wall.d]} />
              <primitive object={mat} attach="material" />
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

      {/* Ceiling lighting fixtures */}
      <CeilingFixtures hall={hall} slots={layout.slots} />

      {/* Benches */}
      {layout.benches.map((bench, i) => (
        <Bench key={i} bench={bench} />
      ))}

      {/* Period Dividers & Wall Labels */}
      {periodSigns.map((sign, i) => (
        <primitive key={i} object={sign} />
      ))}
      {!fame &&
        layout.sections.map((section, i) => (
          <mesh key={i} position={[0, 0.003, section.startZ]}>
            <boxGeometry args={[width, 0.006, 0.05]} />
            <primitive object={wallMaterials.brass} attach="material" />
          </mesh>
        ))}

      {/* Hall of Fame Decor (Pilasters, Carpet, Dado rails, Title) */}
      {fame && <HallOfFameDecor layout={layout} />}

      {/* Ceiling Wash Point Lights */}
      {washLights.map((pos, i) => (
        <pointLight key={i} position={pos} color={0xfff1dc} intensity={7} distance={9.5} decay={1.6} />
      ))}
    </group>
  );
}
