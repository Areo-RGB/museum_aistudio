// Declarative description of the building. Each floor is one time period of
// the collection and shows every work from it: one section per month, oldest
// at the entrance, a featured piece at the far end. Every floor shares the
// same lobby (entrance zone) with the elevator. Only the Cinema floor has a
// theatre.
//
// Orientation: the visitor enters at the hall's minimum z and walks towards
// +z, so +x is on their LEFT and -x is on their right.

import type { FrameSlot, MuseumFloor, Vector3Tuple } from '../types.ts';

export type MuseumTheme = 'gallery' | 'fame' | 'cinema';

export interface LayoutPlacement {
  position: Vector3Tuple;
  rotationY: number;
}

export interface PointXZ {
  x: number;
  z: number;
}

export interface CollisionRect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface HallBounds extends CollisionRect {
  length: number;
  height: number;
}

export interface PeriodLabel {
  label: string;
  range: string;
  count: number;
}

export interface MuseumSection {
  period: PeriodLabel;
  startZ: number;
  endZ: number;
  labelZ: number;
}

export interface BenchLayout extends PointXZ {
  w: number;
  d: number;
}

export interface WallLayout extends BenchLayout {
  room: 'hall' | 'cinema';
  accent?: boolean;
  y0?: number;
  y1?: number;
}

export interface MuseumLayout {
  hall: HallBounds;
  sections: MuseumSection[];
  slots: FrameSlot[];
  benches: BenchLayout[];
  walls: WallLayout[];
  colliders: CollisionRect[];
  cinema: LayoutPlacement | null;
  start: { position: Vector3Tuple; yaw: number };
  theme: MuseumTheme;
}

export const ROOM = { width: 14, height: 5.4, wall: 0.24 } as const;

const T = ROOM.wall;
const FACE = T / 2;
const HX = ROOM.width / 2;

/** Opening in the hall wall that leads into the cinema. */
export const DOOR = { halfWidth: 1.1, height: 2.9 } as const;

/** Rhythm of the hall along its length (metres). */
export const SPACING = {
  pitch: 4.4,
  sectionGap: 2.8,
  entrance: 9.5,
  exit: 7,
} as const;

function vector3(x: number, y: number, z: number): Vector3Tuple {
  return [x, y, z];
}

/** Lobby fixtures on the visitor's right (-x) side of the entrance zone. */
export const LOBBY = {
  elevator: {
    x: 0,
    width: 3.2,
    depth: 2.5,
    frontZ: 0,
    height: 3.3,
    opening: 1.6,
    placement: { position: vector3(-HX, 0, 5.8), rotationY: -Math.PI / 2 },
  },
  directory: {
    position: vector3(-HX + FACE + 0.085, 1.65, 2.65),
    rotationY: Math.PI / 2,
    width: 1.1,
    height: 1.9,
  },
} as const;

/** Cinema in local coordinates; createLayout places it in world coordinates. */
export const CINEMA = {
  bounds: { minX: -7, maxX: 7, minZ: 0, maxZ: 16 },
  height: ROOM.height,
  screen: { width: 8.4, height: 3.6, y: 3.0 },
  stage: { depth: 1.3, height: 0.45 },
  rows: [10.5, 9.1, 7.7, 6.3, 4.9],
  seatsPerSide: 7,
  seatPitch: 0.68,
  aisleHalfWidth: 0.75,
} as const;

export interface CinemaSeat extends PointXZ {
  row: number;
}

/** Seats in cinema-local coordinates: cushion centre, all facing the screen (+z). */
export const SEATS: CinemaSeat[] = CINEMA.rows.flatMap((z, row) =>
  [-1, 1].flatMap((side) =>
    Array.from({ length: CINEMA.seatsPerSide }, (_, i) => ({
      row,
      x: side * (CINEMA.aisleHalfWidth + CINEMA.seatPitch * (i + 0.5)),
      z,
    })),
  ),
);

const STANDARD = { maxWidth: 3.1, maxHeight: 2.15, y: 2.3 };
const HERO = { maxWidth: 4.6, maxHeight: 2.9, y: 2.55 };
const FACING = { towardsMinusX: -Math.PI / 2, towardsPlusX: Math.PI / 2, towardsEntrance: Math.PI };

interface BoxLayout extends PointXZ {
  w: number;
  d: number;
}

function toRect({ x, z, w, d }: BoxLayout): CollisionRect {
  return { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 };
}

/** Map a point from a placed room's local space into the world (rotation about Y). */
function placePoint(x: number, z: number, placement: LayoutPlacement): [number, number] {
  const [px, , pz] = placement.position;
  const c = Math.cos(placement.rotationY);
  const s = Math.sin(placement.rotationY);
  return [px + x * c + z * s, pz - x * s + z * c];
}

/** Shared transforms for elevator meshes, collision checks and arrival camera. */
export function elevatorPoint(x: number, z: number): [number, number] {
  return placePoint(x, z, LOBBY.elevator.placement);
}

export function elevatorLocalPoint({ x, z }: PointXZ): PointXZ {
  const [px, , pz] = LOBBY.elevator.placement.position;
  const { rotationY } = LOBBY.elevator.placement;
  const c = Math.cos(rotationY);
  const s = Math.sin(rotationY);
  return { x: (x - px) * c - (z - pz) * s, z: (x - px) * s + (z - pz) * c };
}

/** Map a local axis-aligned rectangle into world coordinates. */
function placeRect(rect: CollisionRect, placement: LayoutPlacement): CollisionRect {
  const corners = [
    placePoint(rect.minX, rect.minZ, placement),
    placePoint(rect.maxX, rect.maxZ, placement),
  ];
  const xs = corners.map(([x]) => x);
  const zs = corners.map(([, z]) => z);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
  };
}

function placeBox(box: BoxLayout, placement: LayoutPlacement): BoxLayout {
  const r = placeRect(toRect(box), placement);
  return {
    ...box,
    x: (r.minX + r.maxX) / 2,
    z: (r.minZ + r.maxZ) / 2,
    w: r.maxX - r.minX,
    d: r.maxZ - r.minZ,
  };
}

/** Layout for one floor. */
export function createLayout(floor: MuseumFloor | null): MuseumLayout {
  const isCinema = floor?.kind === 'cinema';
  const isFame = floor?.kind === 'fame';
  const frameSize = isFame ? { ...HERO, y: 2.45 } : STANDARD;
  const pitch = isFame ? 7 : SPACING.pitch;
  const months = isCinema
    ? []
    : floor && floor.months.length > 0
      ? floor.months
      : [{ key: 'empty', label: 'The Collection', items: [] }];
  const floorKey = floor?.key ?? 'empty';

  const plan = months.map((month) => {
    const frames = month.items.length || 2;
    const perSide = Math.ceil(frames / 2);
    const label: PeriodLabel = {
      label: month.label,
      range: floor?.label ?? '',
      count: month.items.length,
    };
    return { month, label, frames, perSide, length: SPACING.sectionGap + perSide * pitch };
  });
  const length =
    SPACING.entrance + plan.reduce((sum, section) => sum + section.length, 0) + SPACING.exit;
  const minZ = 0;
  const maxZ = length;
  const hall: HallBounds = { minX: -HX, maxX: HX, minZ, maxZ, length, height: ROOM.height };

  const cinemaHalfWidth = (CINEMA.bounds.maxX - CINEMA.bounds.minX) / 2;
  const doorZ = minZ + cinemaHalfWidth + 0.2;
  const cinema: LayoutPlacement | null = isCinema
    ? { position: [HX, 0, doorZ], rotationY: Math.PI / 2 }
    : null;

  const sections: MuseumSection[] = [];
  const allItems = months.flatMap((month) => month.items);
  const featured = allItems[Math.floor(Math.random() * allItems.length)];
  const slots: FrameSlot[] = isCinema
    ? []
    : [
        {
          id: `${floorKey}:hero`,
          ...HERO,
          position: [0, isFame ? 2.3 : HERO.y, maxZ - FACE],
          rotationY: FACING.towardsEntrance,
          hero: true,
          period: floorKey,
          itemId: floor?.featured?.id ?? featured?.id ?? null,
          pinned: Boolean(floor?.featured),
        },
      ];
  const benches: BenchLayout[] = [];

  let z = minZ + SPACING.entrance;
  for (const { month, label, frames, perSide, length: sectionLength } of plan) {
    const section: MuseumSection = {
      period: label,
      startZ: z,
      endZ: z + sectionLength,
      labelZ: z + SPACING.sectionGap / 2,
    };
    sections.push(section);
    for (let i = 0; i < frames; i += 1) {
      const side = i % 2 === 0 ? 'left' : 'right';
      const index = Math.floor(i / 2);
      const item = month.items[i];
      const fz = z + SPACING.sectionGap + pitch * (index + 0.5);
      slots.push({
        id: `${floorKey}:${month.key}:${String(i + 1)}`,
        ...frameSize,
        period: floorKey,
        itemId: item?.id ?? null,
        position: [side === 'left' ? HX - FACE : -HX + FACE, frameSize.y, fz],
        rotationY: side === 'left' ? FACING.towardsMinusX : FACING.towardsPlusX,
      });
    }
    const benchCount = Math.max(1, Math.round(perSide / 3));
    const framesStart = z + SPACING.sectionGap;
    for (let b = 0; b < benchCount; b += 1) {
      benches.push({
        x: 0,
        z: framesStart + (perSide * pitch * (b + 0.5)) / benchCount,
        w: 0.62,
        d: 2.6,
      });
    }
    z += sectionLength;
  }

  const C = CINEMA.bounds;
  let cinemaWalls: WallLayout[] = [];
  if (cinema) {
    cinemaWalls = [
      { room: 'cinema', x: C.minX, z: (C.minZ + C.maxZ) / 2, w: T, d: C.maxZ - C.minZ },
      { room: 'cinema', x: C.maxX, z: (C.minZ + C.maxZ) / 2, w: T, d: C.maxZ - C.minZ },
      { room: 'cinema', x: 0, z: C.maxZ, w: C.maxX - C.minX + T, d: T },
    ].map((wall) => ({ ...placeBox(wall, cinema), room: 'cinema' }));
  }

  const doorLow = doorZ - DOOR.halfWidth;
  const doorHigh = doorZ + DOOR.halfWidth;
  const { elevator: e, directory } = LOBBY;
  const elevatorZ = e.placement.position[2];
  const elevatorLow = elevatorZ - e.width / 2;
  const elevatorHigh = elevatorZ + e.width / 2;
  const walls: WallLayout[] = [
    { room: 'hall', x: 0, z: minZ, w: ROOM.width + T, d: T },
    { room: 'hall', accent: true, x: 0, z: maxZ, w: ROOM.width + T, d: T },
    { room: 'hall', x: -HX, z: (minZ + elevatorLow) / 2, w: T, d: elevatorLow - minZ },
    { room: 'hall', x: -HX, z: (elevatorHigh + maxZ) / 2, w: T, d: maxZ - elevatorHigh },
    { room: 'hall', x: -HX, z: elevatorZ, w: T, d: e.width, y0: e.height },
    ...(!isCinema
      ? [{ room: 'hall' as const, x: HX, z: length / 2, w: T, d: length }]
      : [
          { room: 'hall' as const, x: HX, z: (minZ + doorLow) / 2, w: T, d: doorLow - minZ },
          { room: 'hall' as const, x: HX, z: (doorHigh + maxZ) / 2, w: T, d: maxZ - doorHigh },
          { room: 'hall' as const, x: HX, z: doorZ, w: T, d: DOOR.halfWidth * 2, y0: DOOR.height },
        ]),
    ...cinemaWalls,
  ];

  const seatBlockOuter = CINEMA.aisleHalfWidth + CINEMA.seatPitch * CINEMA.seatsPerSide;
  let cinemaColliders: CollisionRect[] = [];
  if (cinema) {
    cinemaColliders = [
      ...CINEMA.rows.flatMap((rz) =>
        [-1, 1].map((side) => ({
          minX: side < 0 ? -seatBlockOuter : CINEMA.aisleHalfWidth,
          maxX: side < 0 ? -CINEMA.aisleHalfWidth : seatBlockOuter,
          minZ: rz - 0.45,
          maxZ: rz + 0.35,
        })),
      ),
      { minX: C.minX, maxX: C.maxX, minZ: C.maxZ - CINEMA.stage.depth, maxZ: C.maxZ },
    ].map((rect) => placeRect(rect, cinema));
  }

  const elevatorColliders = [
    ...[-1, 1].map((side) =>
      toRect({ x: e.x + (side * e.width) / 2, z: e.frontZ + e.depth / 2, w: 0.12, d: e.depth }),
    ),
    toRect({ x: e.x, z: e.frontZ + e.depth, w: e.width, d: 0.12 }),
    ...[-1, 1].map((side) =>
      toRect({
        x: e.x + side * (e.opening / 2 + (e.width - e.opening) / 4),
        z: e.frontZ,
        w: (e.width - e.opening) / 2,
        d: 0.16,
      }),
    ),
  ].map((rect) => placeRect(rect, e.placement));

  const colliders: CollisionRect[] = [
    ...walls.filter((wall) => wall.y0 === undefined).map(toRect),
    ...benches.map(toRect),
    ...cinemaColliders,
    ...elevatorColliders,
    toRect({
      x: directory.position[0],
      z: directory.position[2],
      w: 0.14,
      d: directory.width + 0.1,
    }),
  ];

  return {
    hall,
    sections,
    slots,
    benches,
    walls,
    colliders,
    cinema,
    start: { position: [0, 1.65, minZ + 3.2], yaw: Math.PI },
    theme: isFame ? 'fame' : isCinema ? 'cinema' : 'gallery',
  };
}
