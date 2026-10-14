import type { ChangeEvent } from 'react';
import { useRef } from 'react';
import type { FitMode } from '../types.ts';
import type { ArtworkFrameController } from '../world/frame.ts';

export interface EditorPanelProps {
  isOpen: boolean;
  isBusy: boolean;
  frame: ArtworkFrameController | null;
  statusMessage: string;
  onUpload: (file: File) => void;
  onShuffle: () => void;
  onReset: () => void;
  onFit: (fit: FitMode) => void;
  onClose: () => void;
}

export function EditorPanel({
  isOpen,
  isBusy,
  frame,
  statusMessage,
  onUpload,
  onShuffle,
  onReset,
  onFit,
  onClose,
}: EditorPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!frame && !isOpen) {
    return (
      <aside id="editor" className="hidden">
        <button className="close" id="closeEditor" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </aside>
    );
  }

  const title = frame?.item?.title ?? 'Empty frame';
  const sourceName =
    frame?.item?.source === 'upload'
      ? 'Your upload'
      : frame?.item?.source === 'collection'
        ? 'From the collection'
        : frame?.item?.source === 'fallback'
          ? 'Placeholder'
          : '';
  const meta = frame ? `${frame.slot.id} · ${sourceName}` : '';
  const isUpload = frame?.item?.source === 'upload';
  const fit = frame?.fit ?? 'auto';

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onUpload(file);
  };

  return (
    <aside id="editor" className={`${isOpen ? 'open' : ''} ${isBusy ? 'busy' : ''}`}>
      <button className="close" id="closeEditor" aria-label="Close" onClick={onClose}>
        ×
      </button>
      <p className="eyebrow" id="editorMeta">
        {meta}
      </p>
      <h2 id="editorTitle">{title}</h2>
      <button className="primary" id="shuffleFrame" onClick={onShuffle}>
        Hang another piece
      </button>
      <label className="upload">
        Upload your own image or video
        <input
          ref={fileInputRef}
          id="mediaInput"
          type="file"
          accept="image/*,video/*"
          onChange={handleFileChange}
        />
      </label>
      <div className="field">
        <span>Framing</span>
        <div className="segmented">
          <button
            className={fit === 'auto' ? 'selected' : ''}
            data-fit="auto"
            onClick={() => {
              onFit('auto');
            }}
          >
            Fit frame
          </button>
          <button
            className={fit === 'contain' ? 'selected' : ''}
            data-fit="contain"
            onClick={() => {
              onFit('contain');
            }}
          >
            Matted
          </button>
          <button
            className={fit === 'cover' ? 'selected' : ''}
            data-fit="cover"
            onClick={() => {
              onFit('cover');
            }}
          >
            Fill
          </button>
        </div>
      </div>
      {isUpload && (
        <button className="secondary danger" id="resetFrame" onClick={onReset}>
          Remove upload
        </button>
      )}
      <p className="status" id="editorStatus">
        {statusMessage}
      </p>
    </aside>
  );
}
