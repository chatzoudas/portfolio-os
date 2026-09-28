import { useMemo, useRef, useState } from 'react';
import useGazeTracking from './useGazeTracking';
import './FaceTracker.css';

type FaceTrackerProps = {
  className?: string;
  basePath?: string;
  showDebug?: boolean;
};

export default function FaceTracker({
  className = '',
  basePath = `${import.meta.env.BASE_URL}faces/`,
  showDebug = false
}: FaceTrackerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { tile, isLoading, error } = useGazeTracking(containerRef, basePath);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const atlasSrc = useMemo(() => {
    const normalizedBase = basePath.replace(/\\/g, '/').trim();
    const withSlash = normalizedBase.endsWith('/') ? normalizedBase : `${normalizedBase}/`;
    const joined = `${withSlash}atlas.webp`;
    const cleaned = joined.replace(/([^:]\/)\/+/, '$1');
    return encodeURI(cleaned);
  }, [basePath]);

  const cols = 11;
  const rows = 11;
  const tileX = tile?.tileX ?? 0;
  const tileY = tile?.tileY ?? 0;

  const bgPosX = cols <= 1 ? 0 : (tileX / (cols - 1)) * 100;
  const bgPosY = rows <= 1 ? 0 : (tileY / (rows - 1)) * 100;

  if (error) {
    return (
      <div className="face-tracker-error">
        Error loading face images: {error.message}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`face-tracker ${className}`}
      onMouseMove={handleMouseMove}
    >
      <div
        className="face-atlas"
        aria-label="Face following gaze"
        role="img"
        style={{
          backgroundImage: `url(${atlasSrc})`,
          backgroundSize: `${cols * 100}% ${rows * 100}%`,
          backgroundPosition: `${bgPosX}% ${bgPosY}%`
        }}
      />

      {isLoading && (
        <div className="face-loading">
          Loading face...
        </div>
      )}

      {showDebug && (
        <div className="face-debug">
          <div>Mouse: ({Math.round(mousePos.x)}, {Math.round(mousePos.y)})</div>
          <div>tile: {tile ? `(${tile.tileX}, ${tile.tileY})` : 'null'}</div>
          <div>px/py: {tile ? `(${tile.px}, ${tile.py})` : 'n/a'}</div>
          <div>atlasSrc: {String(atlasSrc)}</div>
        </div>
      )}
    </div>
  );
}
