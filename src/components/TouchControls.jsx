import React, { useEffect, useRef } from 'react';

export function TouchControls({
  visible,
  player,
  canvasRef,
  onUse,
  onTour,
  onPause,
}) {
  const stickRef = useRef(null);
  const knobRef = useRef(null);
  const moveIdRef = useRef(null);
  const lookIdRef = useRef(null);
  const lookCoordsRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const stick = stickRef.current;
    const knob = knobRef.current;
    const canvas = canvasRef?.current;
    if (!stick || !knob) return;

    const move = (e) => {
      if (!player) return;
      const rect = stick.getBoundingClientRect();
      const dx = e.clientX - rect.left - rect.width / 2;
      const dz = e.clientY - rect.top - rect.height / 2;
      const radius = rect.width * 0.34;
      const length = Math.hypot(dx, dz);
      const scale = Math.max(radius, length);
      player.touchMove.x = length < 5 ? 0 : dx / scale;
      player.touchMove.z = length < 5 ? 0 : dz / scale;
      knob.style.transform = `translate(${player.touchMove.x * radius}px, ${player.touchMove.z * radius}px)`;
    };

    const onStickPointerDown = (e) => {
      if (!visible || moveIdRef.current != null) return;
      moveIdRef.current = e.pointerId;
      try { stick.setPointerCapture(e.pointerId); } catch {}
      move(e);
    };

    const onStickPointerMove = (e) => {
      if (e.pointerId === moveIdRef.current) move(e);
    };

    const releaseMove = (e) => {
      if (e.pointerId !== moveIdRef.current) return;
      moveIdRef.current = null;
      if (player) {
        player.touchMove.x = 0;
        player.touchMove.z = 0;
      }
      knob.style.transform = '';
    };

    stick.addEventListener('pointerdown', onStickPointerDown);
    stick.addEventListener('pointermove', onStickPointerMove);
    stick.addEventListener('pointerup', releaseMove);
    stick.addEventListener('pointercancel', releaseMove);
    stick.addEventListener('lostpointercapture', releaseMove);

    let onCanvasPointerDown, onCanvasPointerMove, releaseLook;
    if (canvas) {
      onCanvasPointerDown = (e) => {
        if (!visible || lookIdRef.current != null) return;
        lookIdRef.current = e.pointerId;
        lookCoordsRef.current = { x: e.clientX, y: e.clientY };
        try { canvas.setPointerCapture(e.pointerId); } catch {}
      };

      onCanvasPointerMove = (e) => {
        if (!visible || e.pointerId !== lookIdRef.current) return;
        if (player) {
          player.onMouseMove({
            movementX: (e.clientX - lookCoordsRef.current.x) * 1.7,
            movementY: (e.clientY - lookCoordsRef.current.y) * 1.7,
          });
        }
        lookCoordsRef.current = { x: e.clientX, y: e.clientY };
      };

      releaseLook = (e) => {
        if (e.pointerId === lookIdRef.current) lookIdRef.current = null;
      };

      canvas.addEventListener('pointerdown', onCanvasPointerDown);
      canvas.addEventListener('pointermove', onCanvasPointerMove);
      canvas.addEventListener('pointerup', releaseLook);
      canvas.addEventListener('pointercancel', releaseLook);
      canvas.addEventListener('lostpointercapture', releaseLook);
    }

    const reset = () => {
      if (moveIdRef.current != null) {
        try { stick.releasePointerCapture(moveIdRef.current); } catch {}
      }
      if (canvas && lookIdRef.current != null) {
        try { canvas.releasePointerCapture(lookIdRef.current); } catch {}
      }
      moveIdRef.current = null;
      lookIdRef.current = null;
      if (player) player.clearInput();
      knob.style.transform = '';
    };

    const onBlur = () => reset();
    const onVisibilityChange = () => { if (document.hidden) reset(); };

    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      stick.removeEventListener('pointerdown', onStickPointerDown);
      stick.removeEventListener('pointermove', onStickPointerMove);
      stick.removeEventListener('pointerup', releaseMove);
      stick.removeEventListener('pointercancel', releaseMove);
      stick.removeEventListener('lostpointercapture', releaseMove);

      if (canvas) {
        canvas.removeEventListener('pointerdown', onCanvasPointerDown);
        canvas.removeEventListener('pointermove', onCanvasPointerMove);
        canvas.removeEventListener('pointerup', releaseLook);
        canvas.removeEventListener('pointercancel', releaseLook);
        canvas.removeEventListener('lostpointercapture', releaseLook);
      }

      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      reset();
    };
  }, [visible, player, canvasRef]);

  return (
    <div
      id="touchControls"
      className={visible ? '' : 'hidden'}
      aria-label="Gallery touch controls"
    >
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
        <button id="touchPause" className="pill ghost" aria-label="Pause and open menu" onClick={onPause}>
          Menu
        </button>
      </div>
    </div>
  );
}
