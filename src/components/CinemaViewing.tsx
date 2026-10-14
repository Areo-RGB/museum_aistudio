import type { CinemaPlaybackFilm } from './CinemaPanel.tsx';

export interface CinemaViewingProps {
  visible: boolean;
  film: CinemaPlaybackFilm | null;
  loading: CinemaPlaybackFilm | null;
  onTogglePlay: () => void;
  onStop: () => void;
  onProgramme: () => void;
  onWalk: () => void;
}

export function CinemaViewing({
  visible,
  film,
  loading,
  onTogglePlay,
  onStop,
  onProgramme,
  onWalk,
}: CinemaViewingProps) {
  const watchStatus = film?.status ?? 'Choose a film from the programme';
  const isPlaying = Boolean(film && !film.paused);
  const toggleDisabled = !film || Boolean(loading);
  const stopDisabled = !film;

  return (
    <div
      id="cinemaViewing"
      className={visible ? '' : 'hidden'}
      role="toolbar"
      aria-label="Cinema playback"
    >
      <span id="watchStatus" role="status">
        {watchStatus}
      </span>
      <div>
        <button id="watchToggle" className="pill" disabled={toggleDisabled} onClick={onTogglePlay}>
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button id="watchStop" className="pill ghost" disabled={stopDisabled} onClick={onStop}>
          Stop
        </button>
        <button id="watchProgramme" className="pill ghost" onClick={onProgramme}>
          Programme
        </button>
        <button id="watchWalk" className="pill ghost" onClick={onWalk}>
          Walk around
        </button>
      </div>
    </div>
  );
}
