'use client';

export type AudioPlayerProps = {
  src?: string;
  downloadUrl?: string;
  durationString?: string;
  meetingDate?: string;
  playbackFormat?: string;
  originalFilename?: string;
  originalFormat?: string;
  originalSize?: string;
  isAvailable?: boolean;
  provenanceNotice?: string;
};

export function AudioPlayer({
  src,
  downloadUrl,
  durationString,
  meetingDate,
  playbackFormat = 'M4A',
  originalFormat,
  originalSize,
  isAvailable = false,
  provenanceNotice,
}: AudioPlayerProps) {
  if (!isAvailable || !src) {
    return (
      <div className="px-recording-card">
        <div className="px-recording-header">
          <span className="px-recording-badge">Audio Status</span>
          <span className="px-recording-badge" style={{ color: 'var(--ink45)' }}>
            No recording yet
          </span>
        </div>
        <p className="px-recording-desc">
          No audio recording is associated with this record.
        </p>
        <div className="px-audio-disabled-row">
          <button type="button" className="px-btn-audio-disabled" disabled>
            Audio playback unavailable
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-recording-card">
      <div className="px-recording-header">
        <span className="px-recording-badge is-cobalt">Audio Recording</span>
        <span className="px-recording-badge" style={{ color: 'var(--px-lime-ink)' }}>
          {durationString ? `${durationString} · ` : ''}{playbackFormat}
        </span>
      </div>

      {meetingDate && (
        <p className="px-recording-desc">
          Session recording from {meetingDate}.
        </p>
      )}

      <div style={{ margin: '16px 0' }}>
        <audio
          controls
          src={src}
          preload="metadata"
          style={{ width: '100%', height: '40px', outline: 'none' }}
          aria-label={`Meeting audio recording${meetingDate ? ` from ${meetingDate}` : ''}${durationString ? `, duration ${durationString}` : ''}`}
        >
          Your browser does not support the audio element.
        </audio>
      </div>

      <div className="px-audio-disabled-row" style={{ justifyContent: 'space-between' }}>
        {downloadUrl ? (
          <a
            href={downloadUrl}
            download
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              textTransform: 'uppercase',
              color: 'var(--px-cobalt-ink)',
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
            }}
          >
            Download Original {originalFormat || playbackFormat}{originalSize ? ` (${originalSize})` : ''} &darr;
          </a>
        ) : (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--ink45)' }}>
            Original audio
          </span>
        )}

        {provenanceNotice && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', color: 'var(--ink45)' }}>
            {provenanceNotice}
          </span>
        )}
      </div>
    </div>
  );
}
