import { useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LOBBY } from '../../world/layout.ts';
import type { Interactions, InteractionTarget } from '../../controls/interactions.ts';
import { canvasPanel, disposeCanvasPanel } from '../../world/signage.ts';
import { floorName, Lobby } from '../../world/lobby.ts';
import type { LobbyHandle } from '../../world/lobby.ts';
import type { MuseumFloor } from '../../types.ts';

const { elevator: E, directory: D } = LOBBY;

export interface MuseumLobbyProps {
  floors?: readonly MuseumFloor[];
  currentFloorIndex?: number;
  onOpenFloors?: () => void;
  lobbyRef?: RefObject<LobbyHandle | null>;
  interactions?: Interactions | null;
}

export function MuseumLobby({
  floors = [],
  currentFloorIndex = 0,
  onOpenFloors,
  lobbyRef,
  interactions,
}: MuseumLobbyProps) {
  const [controller] = useState(() => new Lobby(floors));
  const callButtonRef = useRef<THREE.Group>(null);
  const directoryBaseRef = useRef<THREE.Mesh>(null);
  const occluderRefs = useRef<(THREE.Object3D | null)[]>([]);
  const leftDoorRef = useRef<THREE.Mesh>(null);
  const rightDoorRef = useRef<THREE.Mesh>(null);
  useEffect(() => {
    controller.setFloors(floors);
    controller.setCurrent(currentFloorIndex);
  }, [controller, currentFloorIndex, floors]);
  useEffect(() => {
    if (!lobbyRef) return undefined;
    lobbyRef.current = controller;
    return () => {
      if (lobbyRef.current === controller) lobbyRef.current = null;
    };
  }, [controller, lobbyRef]);

  const materials = useMemo(
    () => ({
      steel: new THREE.MeshStandardMaterial({ color: 0xa4b0bc, roughness: 0.32, metalness: 0.78 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x0f2544, roughness: 0.62, metalness: 0.15 }),
      brass: new THREE.MeshStandardMaterial({ color: 0xc8a45c, roughness: 0.26, metalness: 0.86 }),
      ceilingLight: new THREE.MeshBasicMaterial({ color: 0xfff5e0 }),
      callLight: new THREE.MeshBasicMaterial({ color: 0xe6c875 }),
    }),
    [],
  );
  useEffect(() => {
    return () => {
      Object.values(materials).forEach((material) => {
        material.dispose();
      });
    };
  }, [materials]);

  const directoryMesh = useMemo(() => {
    const draw = (context: CanvasRenderingContext2D, width: number, height: number): void => {
      context.fillStyle = '#0c1322';
      context.fillRect(0, 0, width, height);
      context.strokeStyle = 'rgba(212, 175, 55, 0.45)';
      context.lineWidth = width * 0.008;
      context.strokeRect(width * 0.025, height * 0.015, width * 0.95, height * 0.97);
      context.fillStyle = '#d4af37';
      context.font = `600 ${String(width * 0.046)}px "Outfit", sans-serif`;
      context.letterSpacing = '0.24em';
      context.fillText('HERTHA 03 · DIRECTORY', width * 0.08, height * 0.068);
      context.letterSpacing = '0em';
      context.fillStyle = '#f8fafc';
      context.font = `600 ${String(width * 0.12)}px "Cormorant Garamond", Georgia, serif`;
      context.fillText('Seasons & Archive', width * 0.08, height * 0.145);
      const rowHeight = Math.min(height * 0.08, (height * 0.78) / Math.max(1, floors.length));
      floors.forEach((floor, index) => {
        const y = height * 0.2 + index * rowHeight;
        if (index === currentFloorIndex) {
          context.fillStyle = 'rgba(30, 86, 160, 0.38)';
          context.fillRect(width * 0.05, y, width * 0.9, rowHeight * 0.9);
          context.fillStyle = '#d4af37';
          context.fillRect(width * 0.05, y, width * 0.014, rowHeight * 0.9);
        }
        context.fillStyle = index === currentFloorIndex ? '#e6c875' : 'rgba(248,250,252,0.72)';
        context.font = `600 ${String(rowHeight * 0.42)}px "JetBrains Mono", monospace`;
        context.fillText(floorName(index, floors), width * 0.085, y + rowHeight * 0.56);
        context.fillStyle = index === currentFloorIndex ? '#ffffff' : 'rgba(248,250,252,0.82)';
        context.font = `600 ${String(rowHeight * 0.48)}px "Cormorant Garamond", Georgia, serif`;
        context.fillText(floor.label, width * 0.25, y + rowHeight * 0.58);
        context.textAlign = 'right';
        context.fillStyle = index === currentFloorIndex ? '#e6c875' : 'rgba(248,250,252,0.48)';
        context.font = `500 ${String(rowHeight * 0.34)}px "Plus Jakarta Sans", sans-serif`;
        context.fillText(String(floor.count), width * 0.91, y + rowHeight * 0.55);
        context.textAlign = 'left';
      });
    };
    const mesh = canvasPanel(D.width, D.height, draw, { lit: false, resolution: 1536 });
    mesh.position.z = 0.065;
    return mesh;
  }, [currentFloorIndex, floors]);
  useEffect(() => {
    return () => {
      disposeCanvasPanel(directoryMesh);
    };
  }, [directoryMesh]);

  const displayMesh = useMemo(() => {
    const mesh = canvasPanel(
      1.6,
      0.38,
      (context, width, height) => {
        context.fillStyle = '#091220';
        context.fillRect(0, 0, width, height);
        context.strokeStyle = 'rgba(212, 175, 55, 0.55)';
        context.lineWidth = height * 0.04;
        context.strokeRect(
          height * 0.06,
          height * 0.06,
          width - height * 0.12,
          height - height * 0.12,
        );
        context.fillStyle = '#e6c875';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.font = `600 ${String(height * 0.34)}px "Outfit", sans-serif`;
        context.fillText(
          `${floorName(currentFloorIndex, floors)} · ${floors[currentFloorIndex]?.label ?? 'Elevator'}`,
          width / 2,
          height / 2,
        );
      },
      { lit: false, resolution: 1024 },
    );
    mesh.position.set(E.x, 2.9, E.frontZ - 0.095);
    mesh.rotation.y = Math.PI;
    return mesh;
  }, [currentFloorIndex, floors]);
  useEffect(() => {
    return () => {
      disposeCanvasPanel(displayMesh);
    };
  }, [displayMesh]);
  const elevatorTarget = useMemo<InteractionTarget>(
    () => ({
      caption: () => ({ title: 'Elevator', subtitle: 'Click to choose a time period' }),
      activate: () => {
        onOpenFloors?.();
      },
      maxDistance: 8,
    }),
    [onOpenFloors],
  );
  const directoryTarget = useMemo<InteractionTarget>(
    () => ({
      caption: () => ({
        title: 'Floor directory',
        subtitle: `${String(floors.length)} floors · click to choose`,
      }),
      activate: () => {
        onOpenFloors?.();
      },
      maxDistance: 8,
    }),
    [floors.length, onOpenFloors],
  );
  useEffect(() => {
    if (!interactions) return undefined;
    const callButtonMeshes: readonly THREE.Object3D[] = callButtonRef.current?.children ?? [];
    const elevatorMeshes: THREE.Object3D[] = [];
    if (leftDoorRef.current) elevatorMeshes.push(leftDoorRef.current);
    if (rightDoorRef.current) elevatorMeshes.push(rightDoorRef.current);
    for (const mesh of callButtonMeshes) elevatorMeshes.push(mesh);
    elevatorMeshes.push(displayMesh);
    const directoryMeshes: THREE.Object3D[] = [];
    if (directoryBaseRef.current) directoryMeshes.push(directoryBaseRef.current);
    directoryMeshes.push(directoryMesh);
    const occluders: THREE.Object3D[] = [];
    for (const occluder of occluderRefs.current) {
      if (occluder) occluders.push(occluder);
    }
    const removeElevator = interactions.add(elevatorMeshes, elevatorTarget);
    const removeDirectory = interactions.add(directoryMeshes, directoryTarget);
    const removeOccluders = interactions.addOccluders(occluders);
    return () => {
      removeElevator();
      removeDirectory();
      removeOccluders();
    };
  }, [directoryMesh, directoryTarget, displayMesh, elevatorTarget, interactions]);

  useFrame((_, delta) => {
    controller.update(Math.min(delta, 0.05));
    const offset = (controller.doorOpen * E.opening) / 2;
    if (leftDoorRef.current) leftDoorRef.current.position.x = E.x - E.opening / 4 - offset;
    if (rightDoorRef.current) rightDoorRef.current.position.x = E.x + E.opening / 4 + offset;
  });

  const height = E.height;
  const sideWidth = (E.width - E.opening) / 2;
  const openFloors = (): void => {
    onOpenFloors?.();
  };

  return (
    <group name="declarative-lobby">
      <group position={E.placement.position} rotation={[0, E.placement.rotationY, 0]}>
        <mesh
          ref={(mesh) => {
            occluderRefs.current[0] = mesh;
          }}
          position={[E.x - E.width / 2, height / 2, E.frontZ + E.depth / 2]}
        >
          <boxGeometry args={[0.12, height, E.depth]} />
          <primitive object={materials.dark} attach="material" />
        </mesh>
        <mesh
          ref={(mesh) => {
            occluderRefs.current[1] = mesh;
          }}
          position={[E.x + E.width / 2, height / 2, E.frontZ + E.depth / 2]}
        >
          <boxGeometry args={[0.12, height, E.depth]} />
          <primitive object={materials.dark} attach="material" />
        </mesh>
        <mesh
          ref={(mesh) => {
            occluderRefs.current[2] = mesh;
          }}
          position={[E.x, height / 2, E.frontZ + E.depth]}
        >
          <boxGeometry args={[E.width, height, 0.12]} />
          <primitive object={materials.dark} attach="material" />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh
              ref={(mesh) => {
                occluderRefs.current[side < 0 ? 3 : 4] = mesh;
              }}
              position={[E.x + side * (E.opening / 2 + sideWidth / 2), height / 2, E.frontZ]}
            >
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
        <mesh
          ref={(mesh) => {
            occluderRefs.current[5] = mesh;
          }}
          position={[E.x, (height + 2.55) / 2, E.frontZ]}
        >
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
        <pointLight
          position={[E.x, height - 0.3, E.frontZ + E.depth / 2]}
          color={0xfff1dc}
          intensity={4}
          distance={4}
          decay={2}
        />
        <mesh
          ref={leftDoorRef}
          position={[E.x - E.opening / 4, 1.29, E.frontZ + 0.015]}
          onClick={(event) => {
            event.stopPropagation();
            openFloors();
          }}
        >
          <boxGeometry args={[E.opening / 2, 2.5, 0.06]} />
          <primitive object={materials.steel} attach="material" />
        </mesh>
        <mesh
          ref={rightDoorRef}
          position={[E.x + E.opening / 4, 1.29, E.frontZ + 0.015]}
          onClick={(event) => {
            event.stopPropagation();
            openFloors();
          }}
        >
          <boxGeometry args={[E.opening / 2, 2.5, 0.06]} />
          <primitive object={materials.steel} attach="material" />
        </mesh>
        <group
          ref={callButtonRef}
          position={[E.x + E.opening / 2 + 0.25, 1.35, E.frontZ - 0.11]}
          onClick={(event) => {
            event.stopPropagation();
            openFloors();
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
        <primitive object={displayMesh} onClick={openFloors} />
      </group>
      <group position={D.position} rotation={[0, D.rotationY, 0]} onClick={openFloors}>
        <mesh ref={directoryBaseRef}>
          <boxGeometry args={[D.width + 0.1, D.height + 0.1, 0.12]} />
          <meshStandardMaterial color={0x1b1a17} roughness={0.5} metalness={0.3} />
        </mesh>
        <primitive object={directoryMesh} />
      </group>
    </group>
  );
}
