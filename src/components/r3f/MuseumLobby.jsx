import React, { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { LOBBY, elevatorPoint, elevatorLocalPoint } from '../../world/layout.js';
import { canvasPanel } from '../../world/signage.js';
import { floorName } from '../../world/lobby.js';

const { elevator: E, directory: D } = LOBBY;

export function MuseumLobby({
  floors = [],
  currentFloorIndex = 0,
  onOpenFloors,
  lobbyRef,
}) {
  const leftDoorRef = useRef();
  const rightDoorRef = useRef();
  const doorOpenRef = useRef(0);
  const targetOpenRef = useRef(0);

  // Materials
  const materials = useMemo(
    () => ({
      steel: new THREE.MeshStandardMaterial({ color: 0x9ba4ae, roughness: 0.38, metalness: 0.72 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x173a60, roughness: 0.7 }),
      brass: new THREE.MeshStandardMaterial({ color: 0xbba471, roughness: 0.3, metalness: 0.8 }),
      ceilingLight: new THREE.MeshBasicMaterial({ color: 0xfff2d7 }),
      callLight: new THREE.MeshBasicMaterial({ color: 0xb9dbff }),
    }),
    []
  );

  // Directory Canvas Panel
  const directoryMesh = useMemo(() => {
    const draw = (ctx, w, h) => {
      ctx.fillStyle = '#1b1a17';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#c9a873';
      ctx.font = `500 ${w * 0.05}px Inter, sans-serif`;
      ctx.letterSpacing = '0.25em';
      ctx.fillText('FLOOR DIRECTORY', w * 0.08, h * 0.07);
      ctx.letterSpacing = '0em';
      ctx.fillStyle = '#f1e8d8';
      ctx.font = `600 ${w * 0.13}px "Cormorant Garamond", Georgia, serif`;
      ctx.fillText('Floors', w * 0.08, h * 0.15);
      const rowH = Math.min(h * 0.08, (h * 0.78) / Math.max(1, floors.length));
      floors.forEach((floor, i) => {
        const y = h * 0.2 + i * rowH;
        if (i === currentFloorIndex) {
          ctx.fillStyle = 'rgba(201,168,115,0.22)';
          ctx.fillRect(w * 0.04, y, w * 0.92, rowH * 0.9);
          ctx.fillStyle = '#c9a873';
          ctx.fillRect(w * 0.04, y, w * 0.012, rowH * 0.9);
        }
        ctx.fillStyle = i === currentFloorIndex ? '#f1e8d8' : 'rgba(241,232,216,0.7)';
        ctx.font = `600 ${rowH * 0.42}px Inter, sans-serif`;
        ctx.fillText(floorName(i, floors), w * 0.08, y + rowH * 0.55);
        ctx.font = `600 ${rowH * 0.5}px "Cormorant Garamond", Georgia, serif`;
        ctx.fillText(floor.label, w * 0.26, y + rowH * 0.58);
        ctx.textAlign = 'right';
        ctx.fillStyle = 'rgba(241,232,216,0.5)';
        ctx.font = `500 ${rowH * 0.34}px Inter, sans-serif`;
        ctx.fillText(String(floor.count ?? 0), w * 0.92, y + rowH * 0.55);
        ctx.textAlign = 'left';
      });
    };
    const mesh = canvasPanel(D.width, D.height, draw, { lit: false, resolution: 768 });
    mesh.position.z = 0.065;
    return mesh;
  }, [floors, currentFloorIndex]);

  // Elevator Indicator Display Panel
  const displayMesh = useMemo(() => {
    const mesh = canvasPanel(
      1.6,
      0.38,
      (ctx, w, h) => {
        ctx.fillStyle = '#0c1928';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#e5d5ac';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `500 ${h * 0.34}px Inter, sans-serif`;
        ctx.fillText(
          `${floorName(currentFloorIndex, floors)} · ${floors[currentFloorIndex]?.label ?? 'Elevator'}`,
          w / 2,
          h / 2
        );
      },
      { lit: false, resolution: 768 }
    );
    mesh.position.set(E.x, 2.9, E.frontZ - 0.095);
    mesh.rotation.y = Math.PI;
    return mesh;
  }, [currentFloorIndex, floors]);

  // Expose door opening / collision helpers
  if (lobbyRef) {
    lobbyRef.current = {
      openDoors() {
        targetOpenRef.current = 1;
      },
      closeDoors() {
        targetOpenRef.current = 0;
      },
      blocksDoor(position, radius) {
        const local = elevatorLocalPoint(position);
        return (
          doorOpenRef.current < 0.95 &&
          Math.abs(local.x - E.x) < E.opening / 2 + radius &&
          Math.abs(local.z - E.frontZ) < radius + 0.08
        );
      },
      get cabinPosition() {
        const [x, z] = elevatorPoint(E.x, E.frontZ + E.depth / 2);
        return [x, 1.65, z];
      },
      get cabinYaw() {
        return E.placement.rotationY;
      },
    };
  }

  // Smooth sliding doors animation
  useFrame((_, delta) => {
    const step = delta * 1.8;
    const diff = targetOpenRef.current - doorOpenRef.current;
    if (Math.abs(diff) > 0.001) {
      doorOpenRef.current += Math.sign(diff) * Math.min(step, Math.abs(diff));
      if (leftDoorRef.current) {
        leftDoorRef.current.position.x = E.x - (E.opening / 4 + (doorOpenRef.current * E.opening) / 2);
      }
      if (rightDoorRef.current) {
        rightDoorRef.current.position.x = E.x + (E.opening / 4 + (doorOpenRef.current * E.opening) / 2);
      }
    }
  });

  const height = E.height;
  const sideWidth = (E.width - E.opening) / 2;

  return (
    <group name="declarative-lobby">
      {/* Elevator Cabin and Shaft */}
      <group position={E.placement.position} rotation={[0, E.placement.rotationY, 0]}>
        {/* Enclosure walls */}
        <mesh position={[E.x - E.width / 2, height / 2, E.frontZ + E.depth / 2]}>
          <boxGeometry args={[0.12, height, E.depth]} />
          <primitive object={materials.dark} attach="material" />
        </mesh>
        <mesh position={[E.x + E.width / 2, height / 2, E.frontZ + E.depth / 2]}>
          <boxGeometry args={[0.12, height, E.depth]} />
          <primitive object={materials.dark} attach="material" />
        </mesh>
        <mesh position={[E.x, height / 2, E.frontZ + E.depth]}>
          <boxGeometry args={[E.width, height, 0.12]} />
          <primitive object={materials.dark} attach="material" />
        </mesh>

        {/* Portal and front frames */}
        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh position={[E.x + side * (E.opening / 2 + sideWidth / 2), height / 2, E.frontZ]}>
              <boxGeometry args={[sideWidth, height, 0.16]} />
              <primitive object={materials.steel} attach="material" />
            </mesh>
            <mesh position={[E.x + side * (E.opening / 2 + 0.025), 1.275, E.frontZ - 0.1]}>
              <boxGeometry args={[0.045, 2.55, 0.05]} />
              <primitive object={materials.brass} attach="material" />
            </mesh>
            <mesh position={[E.x + side * (E.width / 2 - 0.15), 1.05, E.frontZ + E.depth / 2]}>
              <boxGeometry args={[0.05, 0.05, E.depth - 0.3]} />
              <primitive object={materials.brass} attach="material" />
            </mesh>
          </group>
        ))}

        {/* Lintel, floor, and ceiling */}
        <mesh position={[E.x, (height + 2.55) / 2, E.frontZ]}>
          <boxGeometry args={[E.width, height - 2.55, 0.16]} />
          <primitive object={materials.steel} attach="material" />
        </mesh>
        <mesh position={[E.x, 0.04, E.frontZ + E.depth / 2]}>
          <boxGeometry args={[E.width, 0.08, E.depth]} />
          <primitive object={materials.steel} attach="material" />
        </mesh>
        <mesh position={[E.x, height, E.frontZ + E.depth / 2]}>
          <boxGeometry args={[E.width, 0.12, E.depth]} />
          <primitive object={materials.dark} attach="material" />
        </mesh>
        <mesh position={[E.x, height - 0.07, E.frontZ + E.depth / 2]}>
          <boxGeometry args={[E.width - 0.4, 0.015, E.depth - 0.4]} />
          <primitive object={materials.ceilingLight} attach="material" />
        </mesh>
        <pointLight position={[E.x, height - 0.3, E.frontZ + E.depth / 2]} color={0xfff1dc} intensity={4} distance={4} decay={2} />

        {/* Sliding Doors */}
        <mesh
          ref={leftDoorRef}
          position={[E.x - E.opening / 4, 1.29, E.frontZ + 0.015]}
          onClick={(e) => {
            e.stopPropagation();
            onOpenFloors?.();
          }}
        >
          <boxGeometry args={[E.opening / 2, 2.5, 0.06]} />
          <primitive object={materials.steel} attach="material" />
        </mesh>
        <mesh
          ref={rightDoorRef}
          position={[E.x + E.opening / 4, 1.29, E.frontZ + 0.015]}
          onClick={(e) => {
            e.stopPropagation();
            onOpenFloors?.();
          }}
        >
          <boxGeometry args={[E.opening / 2, 2.5, 0.06]} />
          <primitive object={materials.steel} attach="material" />
        </mesh>

        {/* Call Button */}
        <group
          position={[E.x + E.opening / 2 + 0.25, 1.35, E.frontZ - 0.11]}
          onClick={(e) => {
            e.stopPropagation();
            onOpenFloors?.();
          }}
        >
          <mesh>
            <boxGeometry args={[0.16, 0.28, 0.045]} />
            <primitive object={materials.brass} attach="material" />
          </mesh>
          <mesh position={[0, 0, -0.035]}>
            <boxGeometry args={[0.055, 0.055, 0.025]} />
            <primitive object={materials.callLight} attach="material" />
          </mesh>
        </group>

        {/* Indicator Display */}
        <primitive object={displayMesh} onClick={onOpenFloors} />
      </group>

      {/* Floor Directory Board */}
      <group position={D.position} rotation={[0, D.rotationY, 0]} onClick={onOpenFloors}>
        <mesh>
          <boxGeometry args={[D.width + 0.1, D.height + 0.1, 0.12]} />
          <meshStandardMaterial color={0x1b1a17} roughness={0.5} metalness={0.3} />
        </mesh>
        <primitive object={directoryMesh} />
      </group>
    </group>
  );
}
