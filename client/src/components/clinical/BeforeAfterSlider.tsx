import { useState, useRef, useCallback } from 'react';

/**
 * Usage:
 * import { BeforeAfterSlider } from '@/components/clinical/BeforeAfterSlider';
 *
 * <BeforeAfterSlider
 *   beforeImage="/uploads/patient-42-before.jpg"
 *   afterImage="/uploads/patient-42-after.jpg"
 *   beforeLabel="Antes"
 *   afterLabel="Depois"
 * />
 */

export interface BeforeAfterSliderProps {
  beforeImage: string;
  afterImage: string;
  beforeLabel?: string;
  afterLabel?: string;
  /** Accessible description for screen readers */
  ariaLabel?: string;
}

export function BeforeAfterSlider({
  beforeImage,
  afterImage,
  beforeLabel = 'Antes',
  afterLabel = 'Depois',
  ariaLabel = 'Comparativo antes e depois do tratamento',
}: BeforeAfterSliderProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const updatePosition = useCallback((clientX: number) => {
    if (!containerRef.current || !isDragging.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setSliderPosition((x / rect.width) * 100);
  }, []);

  const handleMouseDown = useCallback(() => {
    isDragging.current = true;
  }, []);

  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => updatePosition(e.clientX),
    [updatePosition],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging.current) return;
      updatePosition(e.touches[0].clientX);
    },
    [updatePosition],
  );

  const handleTouchStart = useCallback(() => {
    isDragging.current = true;
  }, []);

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Keyboard support: left/right arrow keys adjust position by 1%
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      setSliderPosition((prev) => Math.max(0, prev - 1));
    } else if (e.key === 'ArrowRight') {
      setSliderPosition((prev) => Math.min(100, prev + 1));
    }
  }, []);

  return (
    <div
      ref={containerRef}
      role="slider"
      aria-label={ariaLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(sliderPosition)}
      aria-valuetext={`${Math.round(sliderPosition)}% ${beforeLabel}`}
      tabIndex={0}
      className="relative w-full aspect-video overflow-hidden rounded-lg cursor-ew-resize select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onKeyDown={handleKeyDown}
    >
      {/* After image — full-width background */}
      <img
        src={afterImage}
        alt={afterLabel}
        draggable={false}
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Before image — clipped to slider position */}
      <div
        aria-hidden="true"
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${sliderPosition}%` }}
      >
        <img
          src={beforeImage}
          alt={beforeLabel}
          draggable={false}
          className="absolute inset-0 h-full object-cover"
          style={{ width: containerRef.current ? `${containerRef.current.offsetWidth}px` : '100%' }}
        />
      </div>

      {/* Divider line */}
      <div
        aria-hidden="true"
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_4px_rgba(0,0,0,0.6)] z-10 pointer-events-none"
        style={{ left: `${sliderPosition}%` }}
      >
        {/* Handle knob */}
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 bg-white rounded-full shadow-md flex items-center justify-center">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M5 3L2 8L5 13M11 3L14 8L11 13"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* Labels */}
      <span
        aria-hidden="true"
        className="absolute top-2 left-2 bg-black/60 text-white text-xs font-medium px-2 py-1 rounded pointer-events-none"
      >
        {beforeLabel}
      </span>
      <span
        aria-hidden="true"
        className="absolute top-2 right-2 bg-black/60 text-white text-xs font-medium px-2 py-1 rounded pointer-events-none"
      >
        {afterLabel}
      </span>

      {/* Screen-reader hint visible only on focus */}
      <span className="sr-only">
        Use as setas do teclado para ajustar a comparacao
      </span>
    </div>
  );
}

export default BeforeAfterSlider;
