import React from 'react';

export function CinemaViewing({
  visible,
  film,
  loading,
  onTogglePlay,
  onStop,
  onProgramme,
  onWalk,
}) {
  const watchStatus = film?.status ?? 'Choose a film from the programme';
  const isPlaying = film && !film.paused;
  const toggleDisabled = !film || !!loading;
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
        <button
          id="watchToggle"
          className="pill"
          disabled={toggleDisabled}
          onClick={onTogglePlay}
        >
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button
          id="watchStop"
          className="pill ghost"
          disabled={stopDisabled}
          onClick={onStop}
        >
          Stop
        </button>
        <button
          id="watchProgramme"
          className="pill ghost"
          onClick={onProgramme}
        >
          Programme
        </button>
        <button
          id="watchWalk"
          className="pill ghost"
          onClick={onWalk}
        >
          Walk around
        </button>
      </div>
    </div>
  );
}
