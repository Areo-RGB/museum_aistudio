import { Fragment, useEffect, useRef } from 'react';
import type { CinemaFilm as PlaybackFilm } from '../cinema/films.ts';
import type { FilmEntry } from '../cinema/programme.ts';

export type CinemaFilm = FilmEntry;
export type CinemaPlaybackFilm = Pick<PlaybackFilm, 'paused'> & { readonly status?: string };

export interface ProgrammeSection {
  heading: string;
  films: readonly CinemaFilm[];
}

export interface CinemaPanelProps {
  isOpen: boolean;
  nowPlaying: CinemaFilm | null;
  loading: CinemaFilm | null;
  film: CinemaPlaybackFilm | null;
  sections: readonly ProgrammeSection[];
  onSelect: (film: CinemaFilm) => void;
  onClose: () => void;
}

export function CinemaPanel({
  isOpen,
  nowPlaying,
  loading,
  film,
  sections,
  onSelect,
  onClose,
}: CinemaPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const current = loading ?? nowPlaying;
  const nowTitle = current?.title ?? 'Nothing showing';
  const nowMeta =
    film?.status ??
    (loading ? 'Threading the projector…' : (nowPlaying?.meta ?? 'Pick something below'));
  const youtubeUrl = current?.source.type === 'youtube' ? current.source.url : undefined;

  useEffect(() => {
    if (isOpen && panelRef.current) panelRef.current.scrollTop = 0;
  }, [isOpen]);

  return (
    <aside id="cinemaPanel" ref={panelRef} className={isOpen ? 'open' : ''}>
      <button className="close" id="closeCinema" aria-label="Close" onClick={onClose}>
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
        <a id="youtubeLink" href={youtubeUrl} target="_blank" rel="noopener noreferrer">
          Open selected film on YouTube
        </a>
      )}
      <div id="filmList">
        {sections.map(({ heading, films }) => (
          <Fragment key={heading}>
            <h3>{heading}</h3>
            <div className="film-grid">
              {films.map((item) => {
                const isPlaying = nowPlaying?.id === item.id;
                const isLoading = loading?.id === item.id;
                const videoId = item.source.type === 'youtube' ? item.source.videoId : '';
                return (
                  <button
                    key={item.id}
                    className={`film-card ${isPlaying ? 'playing' : ''} ${isLoading ? 'loading' : ''}`}
                    data-id={item.id}
                    onClick={() => {
                      onSelect(item);
                    }}
                  >
                    <img
                      className="poster"
                      src={videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : ''}
                      loading="lazy"
                      alt=""
                    />
                    <strong>{item.title}</strong>
                    <span>{item.meta}</span>
                  </button>
                );
              })}
            </div>
          </Fragment>
        ))}
      </div>
    </aside>
  );
}
