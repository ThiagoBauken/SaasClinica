import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Circle, Type, Undo2, Download, Eraser } from 'lucide-react';

/**
 * Usage:
 * import { ImageAnnotator } from '@/components/clinical/ImageAnnotator';
 *
 * <ImageAnnotator
 *   imageUrl="/uploads/radiograph-123.jpg"
 *   onSave={(annotations, dataUrl) => {
 *     // persist dataUrl or annotations to server
 *   }}
 * />
 */

export type AnnotationTool = 'pencil' | 'circle' | 'text' | 'eraser';

export interface AnnotationPoint {
  x: number;
  y: number;
}

export interface Annotation {
  type: AnnotationTool;
  color: string;
  lineWidth: number;
  points?: AnnotationPoint[];
  center?: AnnotationPoint;
  radius?: number;
  text?: string;
  position?: AnnotationPoint;
}

export interface ImageAnnotatorProps {
  imageUrl: string;
  onSave?: (annotations: Annotation[], dataUrl: string) => void;
  initialAnnotations?: Annotation[];
  readOnly?: boolean;
}

const PALETTE = [
  { value: '#ef4444', label: 'Vermelho' },
  { value: '#22c55e', label: 'Verde' },
  { value: '#3b82f6', label: 'Azul' },
  { value: '#facc15', label: 'Amarelo' },
  { value: '#f97316', label: 'Laranja' },
  { value: '#ffffff', label: 'Branco' },
];

const TOOLS: { id: AnnotationTool; Icon: React.ComponentType<{ className?: string }>; label: string }[] = [
  { id: 'pencil', Icon: Pencil, label: 'Desenhar' },
  { id: 'circle', Icon: Circle, label: 'Circulo' },
  { id: 'text', Icon: Type, label: 'Texto' },
  { id: 'eraser', Icon: Eraser, label: 'Apagar' },
];

export function ImageAnnotator({
  imageUrl,
  onSave,
  initialAnnotations = [],
  readOnly = false,
}: ImageAnnotatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const isDrawingRef = useRef(false);
  const startPointRef = useRef<AnnotationPoint>({ x: 0, y: 0 });
  const currentPathRef = useRef<AnnotationPoint[]>([]);

  const [tool, setTool] = useState<AnnotationTool>('pencil');
  const [color, setColor] = useState('#ef4444');
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);
  // Tracks a live path for pencil/eraser so canvas redraws each frame
  const [livePathTick, setLivePathTick] = useState(0);

  // ---------------------------------------------------------------
  // Canvas helpers
  // ---------------------------------------------------------------

  const getCanvasCoords = useCallback((e: React.MouseEvent): AnnotationPoint => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }, []);

  const drawAnnotations = useCallback(
    (ctx: CanvasRenderingContext2D, list: Annotation[]) => {
      list.forEach((ann) => {
        ctx.strokeStyle = ann.color;
        ctx.fillStyle = ann.color;
        ctx.lineWidth = ann.lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if ((ann.type === 'pencil' || ann.type === 'eraser') && ann.points && ann.points.length > 1) {
          if (ann.type === 'eraser') {
            ctx.globalCompositeOperation = 'destination-out';
          }
          ctx.beginPath();
          ann.points.forEach((p, i) => {
            if (i === 0) ctx.moveTo(p.x, p.y);
            else ctx.lineTo(p.x, p.y);
          });
          ctx.stroke();
          ctx.globalCompositeOperation = 'source-over';
        } else if (ann.type === 'circle' && ann.center && ann.radius) {
          ctx.beginPath();
          ctx.arc(ann.center.x, ann.center.y, ann.radius, 0, Math.PI * 2);
          ctx.stroke();
        } else if (ann.type === 'text' && ann.position && ann.text) {
          ctx.font = `bold 16px system-ui, sans-serif`;
          // Shadow for readability
          ctx.shadowColor = 'rgba(0,0,0,0.6)';
          ctx.shadowBlur = 3;
          ctx.fillText(ann.text, ann.position.x, ann.position.y);
          ctx.shadowBlur = 0;
        }
      });
    },
    [],
  );

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const img = imageRef.current;
    if (!canvas || !ctx || !img) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    drawAnnotations(ctx, annotations);

    // Draw in-progress live path
    const livePath = currentPathRef.current;
    if (livePath.length > 1 && (tool === 'pencil' || tool === 'eraser')) {
      if (tool === 'eraser') ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = color;
      ctx.lineWidth = tool === 'eraser' ? 16 : 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      livePath.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
  }, [annotations, color, tool, drawAnnotations, livePathTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------
  // Load image
  // ---------------------------------------------------------------

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageRef.current = img;
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
      }
      redraw();
    };
    img.src = imageUrl;
  }, [imageUrl]); // redraw intentionally excluded — will fire after imageRef is set

  useEffect(() => {
    redraw();
  }, [redraw]);

  // ---------------------------------------------------------------
  // Pointer events
  // ---------------------------------------------------------------

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (readOnly) return;
      const pos = getCanvasCoords(e);

      if (tool === 'text') {
        // Use a prompt for simplicity; a proper inline input could be added later
        const text = window.prompt('Digite o texto da anotacao:');
        if (text?.trim()) {
          setAnnotations((prev) => [
            ...prev,
            { type: 'text', text: text.trim(), position: pos, color, lineWidth: 2 },
          ]);
        }
        return;
      }

      isDrawingRef.current = true;
      startPointRef.current = pos;
      currentPathRef.current = [pos];
    },
    [readOnly, tool, color, getCanvasCoords],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawingRef.current) return;
      const pos = getCanvasCoords(e);

      if (tool === 'pencil' || tool === 'eraser') {
        currentPathRef.current = [...currentPathRef.current, pos];
        setLivePathTick((t) => t + 1);
      } else if (tool === 'circle') {
        // Preview circle: store start only — drawn live on next redraw
        currentPathRef.current = [startPointRef.current, pos];
        setLivePathTick((t) => t + 1);
      }
    },
    [tool, getCanvasCoords],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      const pos = getCanvasCoords(e);

      if (tool === 'pencil' || tool === 'eraser') {
        const path = currentPathRef.current;
        if (path.length > 1) {
          setAnnotations((prev) => [
            ...prev,
            {
              type: tool,
              points: path,
              color,
              lineWidth: tool === 'eraser' ? 16 : 2,
            },
          ]);
        }
      } else if (tool === 'circle') {
        const start = startPointRef.current;
        const dx = pos.x - start.x;
        const dy = pos.y - start.y;
        const radius = Math.sqrt(dx * dx + dy * dy);
        if (radius > 3) {
          setAnnotations((prev) => [
            ...prev,
            { type: 'circle', center: start, radius, color, lineWidth: 2 },
          ]);
        }
      }

      currentPathRef.current = [];
      setLivePathTick((t) => t + 1);
    },
    [tool, color, getCanvasCoords],
  );

  // ---------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------

  const handleUndo = useCallback(() => {
    setAnnotations((prev) => prev.slice(0, -1));
  }, []);

  const handleSave = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !onSave) return;
    onSave(annotations, canvas.toDataURL('image/png'));
  }, [annotations, onSave]);

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      {!readOnly && (
        <div
          className="flex items-center gap-2 flex-wrap"
          role="toolbar"
          aria-label="Ferramentas de anotacao"
        >
          {/* Tool selector */}
          <div className="flex gap-1 border rounded-md p-1 bg-background" role="group" aria-label="Tipo de ferramenta">
            {TOOLS.map(({ id, Icon, label }) => (
              <Button
                key={id}
                variant={tool === id ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setTool(id)}
                aria-label={label}
                aria-pressed={tool === id}
                title={label}
              >
                <Icon className="h-4 w-4" />
              </Button>
            ))}
          </div>

          {/* Color palette */}
          <div
            className="flex gap-1.5 items-center"
            role="group"
            aria-label="Cor da anotacao"
          >
            {PALETTE.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                aria-label={label}
                aria-pressed={color === value}
                title={label}
                className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  color === value ? 'border-foreground scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: value }}
                onClick={() => setColor(value)}
              />
            ))}
          </div>

          <div className="flex gap-1 ml-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUndo}
              disabled={annotations.length === 0}
              aria-label="Desfazer ultima anotacao"
            >
              <Undo2 className="h-4 w-4 mr-1" />
              Desfazer
            </Button>
            {onSave && (
              <Button
                variant="default"
                size="sm"
                onClick={handleSave}
                aria-label="Salvar anotacoes"
              >
                <Download className="h-4 w-4 mr-1" />
                Salvar
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Imagem clinica com anotacoes"
        className="w-full border rounded-lg max-h-[520px] object-contain bg-black"
        style={{ cursor: readOnly ? 'default' : tool === 'eraser' ? 'cell' : 'crosshair' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
}

export default ImageAnnotator;
