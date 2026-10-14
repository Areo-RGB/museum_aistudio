import React from 'react';

export function Hud({
  hoverCaption,
  loadingProgress,
  isTouring,
  toastMessage,
  isTouch,
}) {
  const pending = loadingProgress?.pending ?? 0;
  const done = loadingProgress?.done ?? 0;
  const total = pending + done;
  const scale = total ? done / total : 1;

  return (
    <div id="hud">
      <div id="crosshair" className={hoverCaption ? 'active' : ''}></div>
      <div id="hoverCaption" className={hoverCaption ? 'show' : ''}>
        <strong id="hoverTitle">{hoverCaption?.title || ''}</strong>
        <span id="hoverSub">{hoverCaption?.subtitle || ''}</span>
      </div>
      <div id="loading" className={pending > 0 ? 'show' : ''}>
        <div
          id="loadingBar"
          style={{ transform: `scaleX(${scale})` }}
        ></div>
      </div>
      <div id="tourBadge" className={isTouring ? 'show' : ''}>
        {isTouch ? 'Guided tour · tap the gallery to take over' : 'Guided tour · press C or click to take over'}
      </div>
      <div id="toast" className={toastMessage ? 'show' : ''}>
        {toastMessage}
      </div>
    </div>
  );
}
