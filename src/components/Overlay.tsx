import { useState } from 'react';
import { photoCache } from '../media/cache.ts';

export interface OverlayProps {
  visible: boolean;
  enterLabel: string;
  collectionSize: number | null;
  hasCinema: boolean;
  onEnter: () => void;
  onTour: () => void;
  onChooseFloors: () => void;
  onWatchCinema: () => void;
}

export function Overlay({
  visible,
  enterLabel,
  collectionSize,
  hasCinema,
  onEnter,
  onTour,
  onChooseFloors,
  onWatchCinema,
}: OverlayProps) {
  const [cacheStatus, setCacheStatus] = useState('');
  const [cacheClearing, setCacheClearing] = useState(false);
  const supportsCache = typeof globalThis !== 'undefined' && 'caches' in globalThis;

  const handleClearCache = async () => {
    setCacheClearing(true);
    try {
      const cleared = await photoCache.clear();
      setCacheStatus(cleared ? 'Downloaded photos cleared.' : 'Photo cache is unavailable.');
    } catch {
      setCacheStatus('Error clearing cache.');
    } finally {
      setCacheClearing(false);
    }
  };

  return (
    <div id="overlay" className={visible ? '' : 'hidden'}>
      <div className="panel">
        <img className="club-logo" src="/media/logo.svg" alt="Hertha 03 Zehlendorf" />
        <p className="eyebrow">F.C. Hertha 03 Zehlendorf · 2014er</p>
        <h1>
          Our memories,
          <br />
          one season at a time.
        </h1>
        <p className="sub">
          Explore every photograph and film from the archive. Start in the Hall of Fame, choose a
          season at the lobby elevator, wander its monthly galleries, or take the elevator to the
          cinema.
        </p>
        <p className="count" id="collectionCount">
          {collectionSize !== null
            ? collectionSize
              ? `${String(collectionSize)} works in the collection`
              : 'Collection offline — showing placeholders'
            : 'Loading collection…'}
        </p>
        <div className="actions">
          <button className="primary" id="enter" onClick={onEnter}>
            {enterLabel}
          </button>
          <button className="secondary" id="startTour" onClick={onTour}>
            Guided tour
          </button>
          <button className="secondary" id="chooseFloors" onClick={onChooseFloors}>
            Choose a time period
          </button>
          {hasCinema && (
            <button className="secondary" id="watchCinema" onClick={onWatchCinema}>
              Cinema programme
            </button>
          )}
        </div>
        <dl className="keys">
          <div>
            <dt>WASD</dt>
            <dd>walk · Shift to hurry</dd>
          </div>
          <div>
            <dt>Click</dt>
            <dd>curate a frame</dd>
          </div>
          <div>
            <dt>C</dt>
            <dd>guided tour</dd>
          </div>
          <div>
            <dt>M</dt>
            <dd>choose a time period</dd>
          </div>
          <div>
            <dt>R</dt>
            <dd>rehang the gallery</dd>
          </div>
          <div>
            <dt>Space</dt>
            <dd>pause the film</dd>
          </div>
          <div>
            <dt>B</dt>
            <dd>play / stop music</dd>
          </div>
          <div>
            <dt>Seat</dt>
            <dd>click to sit, move to stand</dd>
          </div>
        </dl>
        <p className="touch-help">
          Use the left stick to walk. Drag the gallery to look around, then tap Use to interact. Tap
          the gallery to leave a guided tour.
        </p>
        {supportsCache && (
          <div className="cache-settings" id="cacheSettings">
            <button
              className="secondary"
              id="clearCache"
              disabled={cacheClearing}
              onClick={() => {
                void handleClearCache();
              }}
            >
              Clear downloaded photos
            </button>
            <span id="cacheStatus" role="status">
              {cacheStatus}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
