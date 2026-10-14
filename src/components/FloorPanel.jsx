import React from 'react';
import { floorName } from '../world/lobby.js';

export function FloorPanel({
  isOpen,
  floors,
  currentIndex,
  onSelect,
  onClose,
}) {
  return (
    <aside
      id="floorPanel"
      className={isOpen ? 'open' : ''}
      role="dialog"
      aria-labelledby="floorHeading"
    >
      <button
        className="close"
        id="closeFloors"
        aria-label="Close period directory"
        onClick={onClose}
      >
        ×
      </button>
      <p className="eyebrow">Lobby elevator</p>
      <h2 id="floorHeading">Choose a time period</h2>
      <p className="sub">
        Select a season or the cinema to ride the elevator. Every work has a place; images and films load as you approach.
      </p>
      <div id="floorList">
        {floors.map((floor, index) => (
          <button
            key={floor.key || index}
            className="floor-choice"
            aria-current={index === currentIndex ? 'true' : 'false'}
            onClick={() => onSelect(index)}
          >
            <span className="floor-number">{floorName(index, floors)}</span>
            <span>
              <strong>{floor.label}</strong>
              <small>{floor.range} · {floor.count} works</small>
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
