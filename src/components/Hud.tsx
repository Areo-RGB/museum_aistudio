import type { LoadingProgress } from '../types.ts';

export interface HoverCaption {
  title: string;
  subtitle: string;
}
export interface HudProps {
  hoverCaption: HoverCaption | null;
  loadingProgress: LoadingProgress;
  isTouring: boolean;
  toastMessage: string;
  isTouch: boolean;
}

export function Hud({ hoverCaption, loadingProgress, isTouring, toastMessage, isTouch }: HudProps) {
  const { pending, done } = loadingProgress;
  const total = pending + done;
  const scale = total ? done / total : 1;
  return (
    <div id="hud">
      <div id="crosshair" className={hoverCaption ? 'active' : ''} />
      <div id="hoverCaption" className={hoverCaption ? 'show' : ''}>
        <strong id="hoverTitle">{hoverCaption?.title ?? ''}</strong>
        <span id="hoverSub">{hoverCaption?.subtitle ?? ''}</span>
      </div>
      <div id="loading" className={pending > 0 ? 'show' : ''}>
        <div id="loadingBar" style={{ transform: `scaleX(${String(scale)})` }} />
      </div>
      <div id="tourBadge" className={isTouring ? 'show' : ''}>
        {isTouch
          ? 'Guided tour · tap the gallery to take over'
          : 'Guided tour · press C or click to take over'}
      </div>
      <div id="toast" className={toastMessage ? 'show' : ''}>
        {toastMessage}
      </div>
    </div>
  );
}
