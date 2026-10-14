import React, { useRef } from 'react';

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
}) {
  const fileInputRef = useRef(null);

  if (!frame && !isOpen) {
    return (
      <aside id="editor" className="hidden">
        <button className="close" id="closeEditor" aria-label="Close">×</button>
      </aside>
    );
  }

  const title = frame?.item?.title ?? 'Empty frame';
  const sourceName = {
    upload: 'Your upload',
    collection: 'From the collection',
    fallback: 'Placeholder',
  }[frame?.item?.source] ?? '';
  const meta = frame ? `${frame.slot.id} · ${sourceName}` : '';
  const isUpload = frame?.item?.source === 'upload';
  const fit = frame?.fit || 'auto';

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      onUpload(file);
    }
  };

  return (
    <aside
      id="editor"
      className={`${isOpen ? 'open' : ''} ${isBusy ? 'busy' : ''}`}
    >
      <button
        className="close"
        id="closeEditor"
        aria-label="Close"
        onClick={onClose}
      >
        ×
      </button>
      <p className="eyebrow" id="editorMeta">{meta}</p>
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
            onClick={() => onFit('auto')}
          >
            Fit frame
          </button>
          <button
            className={fit === 'contain' ? 'selected' : ''}
            data-fit="contain"
            onClick={() => onFit('contain')}
          >
            Matted
          </button>
          <button
            className={fit === 'cover' ? 'selected' : ''}
            data-fit="cover"
            onClick={() => onFit('cover')}
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
      <p className="status" id="editorStatus">{statusMessage}</p>
    </aside>
  );
}
