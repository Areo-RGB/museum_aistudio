import React, { useRef, useEffect } from 'react';

export function CinemaPanel({
  isOpen,
  nowPlaying,
  loading,
  film,
  sections,
  onSelect,
  onClose,
}) {
  const panelRef = useRef(null);
  const current = loading ?? nowPlaying;
  const nowTitle = current?.title ?? 'Nothing showing';
  const nowMeta = film?.status ?? (loading ? 'Threading the projector…' : (nowPlaying ? nowPlaying.meta : 'Pick something below'));
  const youtubeUrl = film?.source?.url || current?.source?.url;

  useEffect(() => {
    if (isOpen && panelRef.current) {
      panelRef.current.scrollTop = 0;
    }
  }, [isOpen]);

  return (
    <aside
      id="cinemaPanel"
      ref={panelRef}
      className={isOpen ? 'open' : ''}
    >
      <button
        className="close"
        id="closeCinema"
        aria-label="Close"
        onClick={onClose}
      >
        ×
      </button>
      <p className="eyebrow">The Little Cinema</p>
      <div className="now">
        <div>
          <h2 id="nowTitle">{nowTitle}</h2>
          <p id="nowMeta">{nowMeta}</p>
        </div>
      </div>
      {youtubeUrl && (
        <a
          id="youtubeLink"
          href={youtubeUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open selected film on YouTube
        </a>
      )}
      <div id="filmList">
        {sections.map(({ heading, films }) => (
          <React.Fragment key={heading}>
            <h3>{heading}</h3>
            <div className="film-grid">
              {films.map((item) => {
                const isPlaying = nowPlaying?.id === item.id;
                const isLoading = loading?.id === item.id;
                return (
                  <button
                    key={item.id}
                    className={`film-card ${isPlaying ? 'playing' : ''} ${isLoading ? 'loading' : ''}`}
                    data-id={item.id}
                    onClick={() => onSelect(item)}
                  >
                    <img
                      className="poster"
                      src={`https://i.ytimg.com/vi/${item.source.videoId}/hqdefault.jpg`}
                      loading="lazy"
                      alt=""
                    />
                    <strong>{item.title}</strong>
                    <span>{item.meta}</span>
                  </button>
                );
              })}
            </div>
          </React.Fragment>
        ))}
      </div>
    </aside>
  );
}
