import { useEffect, useRef } from 'react';
import type { PlayerHandle } from '../controls/player.ts';

export interface CanvasElementRef {
  readonly current: HTMLCanvasElement | null;
}

export interface TouchControlsProps {
  visible: boolean;
  player: PlayerHandle | null;
  canvasRef?: CanvasElementRef;
  onUse: () => void;
  onTour: () => void;
  onPause: () => void;
}

function setPointerCapture(element: HTMLElement, pointerId: number): void {
  try {
    element.setPointerCapture(pointerId);
  } catch {
    // Pointer capture can fail when the pointer leaves before activation.
  }
}

function releasePointerCapture(element: Element, pointerId: number): void {
  if (!(element instanceof HTMLElement) || !element.hasPointerCapture(pointerId)) return;
  try {
    element.releasePointerCapture(pointerId);
  } catch {
    // Pointer capture may already have been released by the browser.
  }
}

export function TouchControls({
  visible,
  player,
  canvasRef,
  onUse,
  onTour,
  onPause,
}: TouchControlsProps) {
  const stickRef = useRef<HTMLDivElement | null>(null);
  const knobRef = useRef<HTMLSpanElement | null>(null);
  const moveIdRef = useRef<number | null>(null);
  const lookIdRef = useRef<number | null>(null);
  const lookXRef = useRef(0);
  const lookYRef = useRef(0);

  useEffect(() => {
    const stick = stickRef.current;
    const knob = knobRef.current;
    const canvas = canvasRef?.current;
    if (!stick || !knob) return;

    player?.setTouchEnabled(visible);

    const move = (event: PointerEvent): void => {
      if (!player) return;
      const rect = stick.getBoundingClientRect();
      const dx = event.clientX - rect.left - rect.width / 2;
      const dz = event.clientY - rect.top - rect.height / 2;
      const radius = rect.width * 0.34;
      const length = Math.hypot(dx, dz);
      const scale = Math.max(radius, length);
      const moveX = length < 5 ? 0 : dx / scale;
      const moveZ = length < 5 ? 0 : dz / scale;
      player.setTouchMove(moveX, moveZ);
      knob.style.transform = `translate(${String(moveX * radius)}px, ${String(moveZ * radius)}px)`;
    };

    const onStickPointerDown = (event: PointerEvent): void => {
      if (!visible || moveIdRef.current !== null) return;
      moveIdRef.current = event.pointerId;
      setPointerCapture(stick, event.pointerId);
      move(event);
    };

    const onStickPointerMove = (event: PointerEvent): void => {
      if (event.pointerId === moveIdRef.current) move(event);
    };

    const releaseMove = (event: PointerEvent): void => {
      if (event.pointerId !== moveIdRef.current) return;
      releasePointerCapture(stick, event.pointerId);
      moveIdRef.current = null;
      player?.setTouchMove(0, 0);
      knob.style.transform = '';
    };

    const onCanvasPointerDown = (event: PointerEvent): void => {
      if (!canvas || !visible || lookIdRef.current !== null) return;
      lookIdRef.current = event.pointerId;
      lookXRef.current = event.clientX;
      lookYRef.current = event.clientY;
      setPointerCapture(canvas, event.pointerId);
    };

    const onCanvasPointerMove = (event: PointerEvent): void => {
      if (!canvas || !visible || event.pointerId !== lookIdRef.current) return;
      player?.onMouseMove({
        movementX: (event.clientX - lookXRef.current) * 1.7,
        movementY: (event.clientY - lookYRef.current) * 1.7,
      });
      lookXRef.current = event.clientX;
      lookYRef.current = event.clientY;
    };

    const releaseLook = (event: PointerEvent): void => {
      if (event.pointerId !== lookIdRef.current) return;
      if (canvas) releasePointerCapture(canvas, event.pointerId);
      lookIdRef.current = null;
    };

    const reset = (): void => {
      if (moveIdRef.current !== null) releasePointerCapture(stick, moveIdRef.current);
      if (canvas && lookIdRef.current !== null) releasePointerCapture(canvas, lookIdRef.current);
      moveIdRef.current = null;
      lookIdRef.current = null;
      player?.clearInput();
      knob.style.transform = '';
    };

    const onBlur = (): void => {
      reset();
    };
    const onVisibilityChange = (): void => {
      if (document.hidden) reset();
    };

    stick.addEventListener('pointerdown', onStickPointerDown);
    stick.addEventListener('pointermove', onStickPointerMove);
    stick.addEventListener('pointerup', releaseMove);
    stick.addEventListener('pointercancel', releaseMove);
    stick.addEventListener('lostpointercapture', releaseMove);
    canvas?.addEventListener('pointerdown', onCanvasPointerDown);
    canvas?.addEventListener('pointermove', onCanvasPointerMove);
    canvas?.addEventListener('pointerup', releaseLook);
    canvas?.addEventListener('pointercancel', releaseLook);
    canvas?.addEventListener('lostpointercapture', releaseLook);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stick.removeEventListener('pointerdown', onStickPointerDown);
      stick.removeEventListener('pointermove', onStickPointerMove);
      stick.removeEventListener('pointerup', releaseMove);
      stick.removeEventListener('pointercancel', releaseMove);
      stick.removeEventListener('lostpointercapture', releaseMove);
      canvas?.removeEventListener('pointerdown', onCanvasPointerDown);
      canvas?.removeEventListener('pointermove', onCanvasPointerMove);
      canvas?.removeEventListener('pointerup', releaseLook);
      canvas?.removeEventListener('pointercancel', releaseLook);
      canvas?.removeEventListener('lostpointercapture', releaseLook);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      reset();
      player?.setTouchEnabled(false);
    };
  }, [canvasRef, player, visible]);

  return (
    <div id="touchControls" className={visible ? '' : 'hidden'} aria-label="Gallery touch controls">
      <div id="moveStick" ref={stickRef} aria-label="Drag to walk">
        <span id="moveKnob" ref={knobRef}></span>
        <span className="stick-label">Move</span>
      </div>
      <div className="touch-actions">
        <button id="touchUse" className="pill" onClick={onUse}>
          Use
        </button>
        <button id="touchTour" className="pill ghost" onClick={onTour}>
          Tour
        </button>
        <button
          id="touchPause"
          className="pill ghost"
          aria-label="Pause and open menu"
          onClick={onPause}
        >
          Menu
        </button>
      </div>
    </div>
  );
}
