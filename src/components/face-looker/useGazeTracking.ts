import { useState, useEffect, useCallback } from "react";

const P_MIN = -15;
const P_MAX = 15;
const STEP = 3;
const SIZE = 256;

function quantizeToGrid(val: number) {
  const raw = P_MIN + ((val + 1) * (P_MAX - P_MIN)) / 2;
  const snapped = Math.round(raw / STEP) * STEP;
  return Math.max(P_MIN, Math.min(P_MAX, snapped));
}

function gridToFilename(px: number, py: number) {
  const sanitize = (val: number) =>
    val.toFixed(1).replace("-", "m").replace(".", "p");
  return `gaze_px${sanitize(px)}_py${sanitize(py)}_${SIZE}.webp`;
}

export type GazeTile = {
  tileX: number;
  tileY: number;
  px: number;
  py: number;
};

export function useGazeTracking(
  containerRef: React.RefObject<HTMLElement | null>,
  basePath = "/faces/"
) {
  void basePath;

  const [tile, setTile] = useState<GazeTile | null>(null);
  const [isLoading] = useState(false);
  const [error] = useState<Error | null>(null);

  const updateGaze = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const nx = (clientX - centerX) / (rect.width / 2);
      const ny = -(clientY - centerY) / (rect.height / 2);

      const clampedX = Math.max(-1, Math.min(1, nx));
      const clampedY = Math.max(-1, Math.min(1, ny));

      const px = quantizeToGrid(clampedX);
      const py = quantizeToGrid(clampedY);

      const tileX = Math.round((px - P_MIN) / STEP);
      const tileY = Math.round((py - P_MIN) / STEP);

      void gridToFilename(px, py);

      setTile({ tileX, tileY, px, py });
    },
    [containerRef]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      updateGaze(e.clientX, e.clientY);
    },
    [updateGaze]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        updateGaze(touch.clientX, touch.clientY);
      }
    },
    [updateGaze]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });

    const container = containerRef.current;
    if (container) {
      const rect = container.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      updateGaze(centerX, centerY);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, [handleMouseMove, handleTouchMove, updateGaze]);

  return { tile, isLoading, error };
}

export default useGazeTracking;
