import { LOBBY, elevatorLocalPoint, elevatorPoint } from './layout.ts';
import type { PointXZ } from './layout.ts';

export interface ElevatorFloor {
  key?: string;
  label: string;
  count?: number;
  kind?: string;
}

export type ElevatorCallback = () => void;

export interface LobbyHandle {
  readonly current: number;
  readonly doorOpen: number;
  readonly cabinPosition: [number, number, number];
  readonly cabinYaw: number;
  openDoors(): void;
  closeDoors(): void;
  travelTo(index: number, onArrive?: ElevatorCallback, onFinished?: ElevatorCallback): boolean;
  blocksDoor(position: PointXZ, radius: number): boolean;
}

export type ElevatorRidePhase = 'closing' | 'riding' | 'opening';

export interface ElevatorRide {
  readonly index: number;
  elapsed: number;
  phase: ElevatorRidePhase;
  arrived: boolean;
  readonly onArrive?: ElevatorCallback;
  readonly onFinished?: ElevatorCallback;
}

const { elevator: E } = LOBBY;

/** Pure, frame-driven elevator door and ride state machine. */
export class Lobby implements LobbyHandle {
  private floors: readonly ElevatorFloor[];
  private doorValue = 0;
  private targetValue = 0;
  private currentIndex = 0;
  private activeRide: ElevatorRide | null = null;

  public constructor(floors: readonly ElevatorFloor[] = []) {
    this.floors = floors;
  }
  public setFloors(floors: readonly ElevatorFloor[]): void {
    // The scene keeps one controller while React replaces the floor collection.
    this.floors = floors;
  }

  public setCurrent(index: number): void {
    if (this.floors[index]) this.currentIndex = index;
  }

  public get current(): number {
    return this.currentIndex;
  }

  public get doorOpen(): number {
    return this.doorValue;
  }

  public get cabinPosition(): [number, number, number] {
    const [x, z] = elevatorPoint(E.x, E.frontZ + E.depth / 2);
    return [x, 1.65, z];
  }

  public get cabinYaw(): number {
    return E.placement.rotationY;
  }

  public openDoors(): void {
    if (!this.activeRide) this.targetValue = 1;
  }

  public closeDoors(): void {
    this.targetValue = 0;
  }

  public travelTo(
    index: number,
    onArrive?: ElevatorCallback,
    onFinished?: ElevatorCallback,
  ): boolean {
    if (this.activeRide || !this.floors[index]) return false;
    this.targetValue = 0;
    this.activeRide = { index, elapsed: 0, phase: 'closing', arrived: false, onArrive, onFinished };
    return true;
  }

  public blocksDoor(position: PointXZ, radius: number): boolean {
    const local = elevatorLocalPoint(position);
    return (
      this.doorValue < 0.95 &&
      Math.abs(local.x - E.x) < E.opening / 2 + radius &&
      Math.abs(local.z - E.frontZ) < radius + 0.08
    );
  }

  public update(deltaSeconds: number): void {
    const delta = Math.max(0, deltaSeconds);
    const step = delta * 1.8;
    const difference = this.targetValue - this.doorValue;
    if (Math.abs(difference) > 0.0001) {
      this.doorValue += Math.sign(difference) * Math.min(step, Math.abs(difference));
    } else {
      this.doorValue = this.targetValue;
    }

    const ride = this.activeRide;
    if (!ride) return;
    ride.elapsed += delta;
    if (ride.phase === 'closing' && this.doorValue <= 0.0001) ride.phase = 'riding';
    if (!ride.arrived && ride.elapsed >= 1) {
      ride.arrived = true;
      ride.phase = 'riding';
      this.currentIndex = ride.index;
      ride.onArrive?.();
    }
    if (ride.arrived && ride.elapsed >= 1.5) {
      ride.phase = 'opening';
      this.targetValue = 1;
    }
    if (ride.arrived && ride.phase === 'opening' && this.doorValue >= 0.9999) {
      this.doorValue = 1;
      this.activeRide = null;
      ride.onFinished?.();
    }
  }

  public get ride(): ElevatorRide | null {
    return this.activeRide;
  }
}

/** "G" for the Hall of Fame, "1", "2", … for dated floors; archive is basement. */
export function floorName(index: number, floors: readonly ElevatorFloor[]): string {
  const floor = floors[index];
  if (floor?.kind === 'cinema') return 'C';
  if (floor?.kind === 'fame') return 'G';
  if (floor?.key === 'undated') return 'B';
  return String(floors.slice(0, index).filter((entry) => !entry.kind).length + 1);
}
