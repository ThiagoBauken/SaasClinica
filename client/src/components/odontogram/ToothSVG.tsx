import React from 'react';

interface ToothSVGProps {
  toothNumber: string;
  group: 'incisivo' | 'canino' | 'premolar' | 'molar';
  position: 'superior' | 'inferior';
  faceColors?: Record<string, string>;
  wholeToothStatus?: string | null;
  selectedFace?: string | null;
  onFaceClick?: (toothNumber: string, faceId: string) => void;
  onToothClick?: (toothNumber: string) => void;
  size?: number;
  showLabel?: boolean;
  isSelected?: boolean;
}

const FACE_DEFAULT = '#FFFFFF';
const FACE_HOVER = '#EBF5FF'; // azul clarinho
const STROKE_COLOR = '#94A3B8'; // Slate 400
const ROOT_FILL = '#F8FAFC'; // Slate 50
const BORDER_WIDTH = 1.2;

function FacePath({
  d, faceId, color, isSelected, onClick, toothNumber
}: {
  d: string; faceId: string; color?: string; isSelected?: boolean;
  onClick?: (tn: string, fid: string) => void; toothNumber: string;
}) {
  const [hovered, setHovered] = React.useState(false);
  const fill = color || (hovered ? FACE_HOVER : FACE_DEFAULT);
  return (
    <path
      d={d}
      fill={fill}
      stroke={isSelected ? '#3B82F6' : STROKE_COLOR}
      strokeWidth={isSelected ? 1.8 : BORDER_WIDTH}
      strokeLinejoin="round"
      style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => { e.stopPropagation(); onClick?.(toothNumber, faceId); }}
    />
  );
}

// Upper teeth: crown top, root bottom pointing down
function IncisorCrown({ position, faceColors, selectedFace, onFaceClick, toothNumber }: {
  position: string; faceColors?: Record<string, string>; selectedFace?: string | null;
  onFaceClick?: (tn: string, fid: string) => void; toothNumber: string;
}) {
  const isUpper = position === 'superior';
  // Incisores: Formato de pá (triângulo invertido/retângulo achatado)
  if (isUpper) {
    return (
      <g>
        {/* Raiz Unica Larga */}
        <path d="M22,34 Q22,70 30,78 Q38,70 38,34" fill={ROOT_FILL} stroke={STROKE_COLOR} strokeWidth={BORDER_WIDTH} />
        {/* Contorno Face Inteira */}
        <path d="M14,6 Q30,-2 46,6 L44,38 Q30,42 16,38 Z" fill="none" stroke={STROKE_COLOR} strokeWidth={BORDER_WIDTH} strokeLinejoin="round" />
        
        {/* Incisal */}
        <FacePath d="M14,6 Q30,-2 46,6 L40,16 L20,16 Z" faceId="incisal" color={faceColors?.incisal} isSelected={selectedFace==='incisal'} onClick={onFaceClick} toothNumber={toothNumber} />
        {/* Vestibular (Centro Maior) */}
        <FacePath d="M20,16 L40,16 L38,28 L22,28 Z" faceId="vestibular" color={faceColors?.vestibular} isSelected={selectedFace==='vestibular'} onClick={onFaceClick} toothNumber={toothNumber} />
        {/* Mesial */}
        <FacePath d="M14,6 L20,16 L22,28 Q18,36 16,38 Z" faceId="mesial" color={faceColors?.mesial} isSelected={selectedFace==='mesial'} onClick={onFaceClick} toothNumber={toothNumber} />
        {/* Distal */}
        <FacePath d="M46,6 L40,16 L38,28 Q42,36 44,38 Z" faceId="distal" color={faceColors?.distal} isSelected={selectedFace==='distal'} onClick={onFaceClick} toothNumber={toothNumber} />
        {/* Lingual */}
        <FacePath d="M22,28 L38,28 Q42,36 44,38 Q30,42 16,38 Q18,36 22,28 Z" faceId="lingual" color={faceColors?.lingual} isSelected={selectedFace==='lingual'} onClick={onFaceClick} toothNumber={toothNumber} />
      </g>
    );
  }
  // Inferior
  return (
    <g>
      <path d="M22,66 Q22,30 30,22 Q38,30 38,66" fill={ROOT_FILL} stroke={STROKE_COLOR} strokeWidth={BORDER_WIDTH} />
      <path d="M16,62 Q30,58 44,62 L46,94 Q30,102 14,94 Z" fill="none" stroke={STROKE_COLOR} strokeWidth={BORDER_WIDTH} strokeLinejoin="round" />
      
      <FacePath d="M16,62 Q30,58 44,62 L38,72 L22,72 Z" faceId="lingual" color={faceColors?.lingual} isSelected={selectedFace==='lingual'} onClick={onFaceClick} toothNumber={toothNumber} />
      <FacePath d="M16,62 L22,72 L20,84 Q16,88 14,94 Z" faceId="mesial" color={faceColors?.mesial} isSelected={selectedFace==='mesial'} onClick={onFaceClick} toothNumber={toothNumber} />
      <FacePath d="M44,62 L38,72 L40,84 Q44,88 46,94 Z" faceId="distal" color={faceColors?.distal} isSelected={selectedFace==='distal'} onClick={onFaceClick} toothNumber={toothNumber} />
      <FacePath d="M22,72 L38,72 L40,84 L20,84 Z" faceId="vestibular" color={faceColors?.vestibular} isSelected={selectedFace==='vestibular'} onClick={onFaceClick} toothNumber={toothNumber} />
      <FacePath d="M20,84 L40,84 Q44,88 46,94 Q30,102 14,94 Q16,88 20,84 Z" faceId="incisal" color={faceColors?.incisal} isSelected={selectedFace==='incisal'} onClick={onFaceClick} toothNumber={toothNumber} />
    </g>
  );
}

function CanineCrown({ position, faceColors, selectedFace, onFaceClick, toothNumber }: {
  position: string; faceColors?: Record<string, string>; selectedFace?: string | null;
  onFaceClick?: (tn: string, fid: string) => void; toothNumber: string;
}) {
  const isUpper = position === 'superior';
  // Canino: Pontiagudo (pentagonal em cima)
  if (isUpper) {
    return (
      <g>
        <path d="M23,38 Q24,55 30,85 Q36,55 37,38" fill={ROOT_FILL} stroke={STROKE_COLOR} strokeWidth={BORDER_WIDTH} />
        <path d="M14,10 L30,0 L46,10 L44,40 Q30,44 16,40 Z" fill="none" stroke={STROKE_COLOR} strokeWidth={BORDER_WIDTH} strokeLinejoin="round" />
        
        <FacePath d="M14,10 L30,0 L46,10 L38,18 L22,18 Z" faceId="incisal" color={faceColors?.incisal} isSelected={selectedFace==='incisal'} onClick={onFaceClick} toothNumber={toothNumber} />
        <FacePath d="M22,18 L38,18 L36,30 L24,30 Z" faceId="vestibular" color={faceColors?.vestibular} isSelected={selectedFace==='vestibular'} onClick={onFaceClick} toothNumber={toothNumber} />
        <FacePath d="M14,10 L22,18 L24,30 Q18,36 16,40 Z" faceId="mesial" color={faceColors?.mesial} isSelected={selectedFace==='mesial'} onClick={onFaceClick} toothNumber={toothNumber} />
        <FacePath d="M46,10 L38,18 L36,30 Q42,36 44,40 Z" faceId="distal" color={faceColors?.distal} isSelected={selectedFace==='distal'} onClick={onFaceClick} toothNumber={toothNumber} />
        <FacePath d="M24,30 L36,30 Q42,36 44,40 Q30,44 16,40 Q18,36 24,30 Z" faceId="lingual" color={faceColors?.lingual} isSelected={selectedFace==='lingual'} onClick={onFaceClick} toothNumber={toothNumber} />
      </g>
    );
  }
  return (
    <g>
      <path d="M23,62 Q24,45 30,15 Q36,45 37,62" fill={ROOT_FILL} stroke={STROKE_COLOR} strokeWidth={BORDER_WIDTH} />
      <path d="M16,60 Q30,56 44,60 L46,90 L30,100 L14,90 Z" fill="none" stroke={STROKE_COLOR} strokeWidth={BORDER_WIDTH} strokeLinejoin="round" />
      
      <FacePath d="M16,60 Q30,56 44,60 L36,70 L24,70 Z" faceId="lingual" color={faceColors?.lingual} isSelected={selectedFace==='lingual'} onClick={onFaceClick} toothNumber={toothNumber} />
      <FacePath d="M16,60 L24,70 L22,82 L14,90 Z" faceId="mesial" color={faceColors?.mesial} isSelected={selectedFace==='mesial'} onClick={onFaceClick} toothNumber={toothNumber} />
      <FacePath d="M44,60 L36,70 L38,82 L46,90 Z" faceId="distal" color={faceColors?.distal} isSelected={selectedFace==='distal'} onClick={onFaceClick} toothNumber={toothNumber} />
      <FacePath d="M24,70 L36,70 L38,82 L22,82 Z" faceId="vestibular" color={faceColors?.vestibular} isSelected={selectedFace==='vestibular'} onClick={onFaceClick} toothNumber={toothNumber} />
      <FacePath d="M22,82 L38,82 L46,90 L30,100 L14,90 Z" faceId="incisal" color={faceColors?.incisal} isSelected={selectedFace==='incisal'} onClick={onFaceClick} toothNumber={toothNumber} />
    </g>
  );
}

function PremolarCrown({ position, faceColors, selectedFace, onFaceClick, toothNumber }: {
  position: string; faceColors?: Record<string, string>; selectedFace?: string | null;
  onFaceClick?: (tn: string, fid: string) => void; toothNumber: string;
}) {
  const isUpper = position === 'superior';
  // Pré-molar: Duas cúspides (quadrado arredondado + círculo interno centralizado)
  if (isUpper) {
    return (
      <g>
        {/* Raiz Dupla */}
        <path d="M20,38 Q18,60 26,80 Q28,60 26,38" fill={ROOT_FILL} stroke={STROKE_COLOR} strokeWidth={BORDER_WIDTH} />
        <path d="M40,38 Q42,60 34,80 Q32,60 34,38" fill={ROOT_FILL} stroke={STROKE_COLOR} strokeWidth={BORDER_WIDTH} />
        
        {/* Contorno Geral Cúspides */}
        <path d="M12,6 Q30,-2 48,6 L46,38 Q30,44 14,38 Z" fill="none" stroke={STROKE_COLOR} strokeWidth={BORDER_WIDTH} strokeLinejoin="round" />
        
        <FacePath d="M12,6 Q30,-2 48,6 L40,16 L20,16 Z" faceId="oclusal" color={faceColors?.oclusal} isSelected={selectedFace==='oclusal'} onClick={onFaceClick} toothNumber={toothNumber} />
        <FacePath d="M20,16 L40,16 L38,28 L22,28 Z" faceId="vestibular" color={faceColors?.vestibular} isSelected={selectedFace==='vestibular'} onClick={onFaceClick} toothNumber={toothNumber} />
        <FacePath d="M12,6 L20,16 L22,28 Q16,35 14,38 Z" faceId="mesial" color={faceColors?.mesial} isSelected={selectedFace==='mesial'} onClick={onFaceClick} toothNumber={toothNumber} />
        <FacePath d="M48,6 L40,16 L38,28 Q44,35 46,38 Z" faceId="distal" color={faceColors?.distal} isSelected={selectedFace==='distal'} onClick={onFaceClick} toothNumber={toothNumber} />
        <FacePath d="M22,28 L38,28 Q44,35 46,38 Q30,44 14,38 Q16,35 22,28 Z" faceId="lingual" color={faceColors?.lingual} isSelected={selectedFace==='lingual'} onClick={onFaceClick} toothNumber={toothNumber} />
      </g>
    );
  }
  return (
    <g>
      <path d="M20,62 Q18,40 26,20 Q28,40 26,62" fill={ROOT_FILL} stroke={STROKE_COLOR} strokeWidth={BORDER_WIDTH} />
      <path d="M40,62 Q42,40 34,20 Q32,40 34,62" fill={ROOT_FILL} stroke={STROKE_COLOR} strokeWidth={BORDER_WIDTH} />
      
      <path d="M14,62 Q30,56 46,62 L48,94 Q30,102 12,94 Z" fill="none" stroke={STROKE_COLOR} strokeWidth={BORDER_WIDTH} strokeLinejoin="round" />
      
      <FacePath d="M14,62 Q30,56 46,62 L38,72 L22,72 Z" faceId="lingual" color={faceColors?.lingual} isSelected={selectedFace==='lingual'} onClick={onFaceClick} toothNumber={toothNumber} />
      <FacePath d="M14,62 L22,72 L20,84 Q16,90 12,94 Z" faceId="mesial" color={faceColors?.mesial} isSelected={selectedFace==='mesial'} onClick={onFaceClick} toothNumber={toothNumber} />
      <FacePath d="M46,62 L38,72 L40,84 Q44,90 48,94 Z" faceId="distal" color={faceColors?.distal} isSelected={selectedFace==='distal'} onClick={onFaceClick} toothNumber={toothNumber} />
      <FacePath d="M22,72 L38,72 L40,84 L20,84 Z" faceId="vestibular" color={faceColors?.vestibular} isSelected={selectedFace==='vestibular'} onClick={onFaceClick} toothNumber={toothNumber} />
      <FacePath d="M20,84 L40,84 Q44,90 48,94 Q30,102 12,94 Q16,90 20,84 Z" faceId="oclusal" color={faceColors?.oclusal} isSelected={selectedFace==='oclusal'} onClick={onFaceClick} toothNumber={toothNumber} />
    </g>
  );
}

function MolarCrown({ position, faceColors, selectedFace, onFaceClick, toothNumber }: {
  position: string; faceColors?: Record<string, string>; selectedFace?: string | null;
  onFaceClick?: (tn: string, fid: string) => void; toothNumber: string;
}) {
  const isUpper = position === 'superior';
  // Molar: Coroa reta com cantos vivos e 4 cúspides bem definidas centralizando na oclusal.
  if (isUpper) {
    return (
      <g>
        {/* Raiz Tripla Superior */}
        <path d="M14,40 Q14,65 20,80 Q24,65 24,40" fill={ROOT_FILL} stroke={STROKE_COLOR} strokeWidth={BORDER_WIDTH} />
        <path d="M26,40 Q30,70 30,85 Q30,70 34,40" fill={ROOT_FILL} stroke={STROKE_COLOR} strokeWidth={BORDER_WIDTH} />
        <path d="M36,40 Q36,65 40,80 Q46,65 46,40" fill={ROOT_FILL} stroke={STROKE_COLOR} strokeWidth={BORDER_WIDTH} />
        
        {/* Contorno Quadrado Molar */}
        <path d="M8,4 L52,4 L50,42 L10,42 Z" fill="none" stroke={STROKE_COLOR} strokeWidth={BORDER_WIDTH} strokeLinejoin="round" strokeLinecap="round" />
        
        <FacePath d="M8,4 L52,4 L42,14 L18,14 Z" faceId="oclusal" color={faceColors?.oclusal} isSelected={selectedFace==='oclusal'} onClick={onFaceClick} toothNumber={toothNumber} />
        <FacePath d="M18,14 L42,14 L40,32 L20,32 Z" faceId="vestibular" color={faceColors?.vestibular} isSelected={selectedFace==='vestibular'} onClick={onFaceClick} toothNumber={toothNumber} />
        <FacePath d="M8,4 L18,14 L20,32 L10,42 Z" faceId="mesial" color={faceColors?.mesial} isSelected={selectedFace==='mesial'} onClick={onFaceClick} toothNumber={toothNumber} />
        <FacePath d="M52,4 L42,14 L40,32 L50,42 Z" faceId="distal" color={faceColors?.distal} isSelected={selectedFace==='distal'} onClick={onFaceClick} toothNumber={toothNumber} />
        <FacePath d="M20,32 L40,32 L50,42 L10,42 Z" faceId="lingual" color={faceColors?.lingual} isSelected={selectedFace==='lingual'} onClick={onFaceClick} toothNumber={toothNumber} />
      </g>
    );
  }
  return (
    <g>
      {/* Raiz Dupla Inferior */}
      <path d="M14,60 Q14,35 20,20 Q24,35 24,60" fill={ROOT_FILL} stroke={STROKE_COLOR} strokeWidth={BORDER_WIDTH} />
      <path d="M36,60 Q36,35 40,20 Q46,35 46,60" fill={ROOT_FILL} stroke={STROKE_COLOR} strokeWidth={BORDER_WIDTH} />
      
      <path d="M10,58 L50,58 L52,96 L8,96 Z" fill="none" stroke={STROKE_COLOR} strokeWidth={BORDER_WIDTH} strokeLinejoin="round" strokeLinecap="round" />
      
      <FacePath d="M10,58 L50,58 L40,68 L20,68 Z" faceId="lingual" color={faceColors?.lingual} isSelected={selectedFace==='lingual'} onClick={onFaceClick} toothNumber={toothNumber} />
      <FacePath d="M10,58 L20,68 L18,86 L8,96 Z" faceId="mesial" color={faceColors?.mesial} isSelected={selectedFace==='mesial'} onClick={onFaceClick} toothNumber={toothNumber} />
      <FacePath d="M50,58 L40,68 L42,86 L52,96 Z" faceId="distal" color={faceColors?.distal} isSelected={selectedFace==='distal'} onClick={onFaceClick} toothNumber={toothNumber} />
      <FacePath d="M20,68 L40,68 L42,86 L18,86 Z" faceId="vestibular" color={faceColors?.vestibular} isSelected={selectedFace==='vestibular'} onClick={onFaceClick} toothNumber={toothNumber} />
      <FacePath d="M18,86 L42,86 L52,96 L8,96 Z" faceId="oclusal" color={faceColors?.oclusal} isSelected={selectedFace==='oclusal'} onClick={onFaceClick} toothNumber={toothNumber} />
    </g>
  );
}

function StatusOverlay({ status, position }: { status: string; position: string }) {
  switch (status) {
    case 'ausente':
      return (
        <g>
          <line x1="8" y1="8" x2="52" y2="92" stroke="#EF4444" strokeWidth="3" strokeLinecap="round"/>
          <line x1="52" y1="8" x2="8" y2="92" stroke="#EF4444" strokeWidth="3" strokeLinecap="round"/>
        </g>
      );
    case 'implante':
      return (
        <g>
          <line x1="30" y1="15" x2="30" y2="85" stroke="#3B82F6" strokeWidth="2.5" strokeDasharray="4,3"/>
          <circle cx="30" cy="15" r="3" fill="#3B82F6"/>
          <circle cx="30" cy="85" r="3" fill="#3B82F6"/>
          <circle cx="30" cy="50" r="2" fill="#3B82F6"/>
        </g>
      );
    case 'tratamento-canal':
      return (
        <g>
          {position === 'superior' ? (
            <line x1="30" y1="42" x2="30" y2="85" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"/>
          ) : (
            <line x1="30" y1="15" x2="30" y2="58" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"/>
          )}
        </g>
      );
    case 'coroa':
      return (
        <g>
          {position === 'superior' ? (
            <rect x="12" y="2" width="36" height="42" rx="4" fill="none" stroke="#F59E0B" strokeWidth="2"/>
          ) : (
            <rect x="12" y="54" width="36" height="44" rx="4" fill="none" stroke="#F59E0B" strokeWidth="2"/>
          )}
        </g>
      );
    case 'protese':
      return (
        <g>
          <rect x="8" y="4" width="44" height="92" rx="6" fill="none" stroke="#6366F1" strokeWidth="1.5" strokeDasharray="4,3"/>
        </g>
      );
    // Aesthetic statuses
    case 'faceta': {
      // Semi-transparent white overlay on vestibular face (front strip) - veneer effect
      const vestibY1 = position === 'superior' ? 14 : 68;
      const vestibY2 = position === 'superior' ? 30 : 84;
      return (
        <g>
          <rect x="14" y={vestibY1} width="32" height={vestibY2 - vestibY1} rx="2"
            fill="rgba(255,255,255,0.55)" stroke="#E8D5B7" strokeWidth="1.2"/>
          {/* Thin shine line to suggest veneer surface */}
          <line x1="18" y1={vestibY1 + 3} x2="18" y2={vestibY2 - 3}
            stroke="rgba(255,255,255,0.9)" strokeWidth="1.5" strokeLinecap="round"/>
        </g>
      );
    }
    case 'clareamento': {
      // Subtle white glow / shimmer over the entire crown
      const crownY = position === 'superior' ? 0 : 52;
      const crownH = 48;
      return (
        <g>
          <rect x="9" y={crownY} width="42" height={crownH} rx="6"
            fill="rgba(240,248,255,0.45)" stroke="rgba(200,230,255,0.7)" strokeWidth="1"/>
          {/* Shine streaks */}
          <line x1="20" y1={crownY + 6} x2="14" y2={crownY + 20}
            stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="28" y1={crownY + 4} x2="22" y2={crownY + 16}
            stroke="rgba(255,255,255,0.6)" strokeWidth="1" strokeLinecap="round"/>
        </g>
      );
    }
    case 'gengivoplastia': {
      // Pink line along the gum line (crown base for upper, crown top for lower)
      const gumY = position === 'superior' ? 42 : 58;
      return (
        <g>
          <line x1="10" y1={gumY} x2="50" y2={gumY}
            stroke="#FFB6C1" strokeWidth="3" strokeLinecap="round"/>
          <line x1="10" y1={gumY} x2="50" y2={gumY}
            stroke="#FF69B4" strokeWidth="1" strokeLinecap="round"/>
          {/* Small arc to indicate gum reshaping */}
          <path d={position === 'superior'
            ? 'M10,42 Q30,36 50,42'
            : 'M10,58 Q30,64 50,58'}
            fill="none" stroke="#FF69B4" strokeWidth="1" strokeDasharray="3,2" opacity="0.7"/>
        </g>
      );
    }
    case 'protese-estetica': {
      // Peach dashed outline around the entire tooth
      return (
        <g>
          <rect x="8" y="4" width="44" height="92" rx="6"
            fill="rgba(255,218,185,0.2)" stroke="#FFDAB9" strokeWidth="1.8" strokeDasharray="5,3"/>
          {/* Small star/sparkle at top right */}
          <text x="44" y="14" fontSize="8" fill="#F59E0B" opacity="0.9">✦</text>
        </g>
      );
    }
    default:
      return null;
  }
}

export default function ToothSVG({
  toothNumber, group, position, faceColors, wholeToothStatus,
  selectedFace, onFaceClick, onToothClick, size = 48, showLabel = true, isSelected = false,
}: ToothSVGProps) {
  const CrownComponent = {
    incisivo: IncisorCrown,
    canino: CanineCrown,
    premolar: PremolarCrown,
    molar: MolarCrown,
  }[group];

  return (
    <div
      className={`inline-flex flex-col items-center gap-0.5 ${isSelected ? 'ring-2 ring-blue-400 rounded' : ''}`}
      style={{ width: size }}
      onClick={() => onToothClick?.(toothNumber)}
    >
      {showLabel && position === 'inferior' && (
        <span className="text-[10px] font-bold text-gray-600 leading-none">{toothNumber}</span>
      )}
      <svg
        viewBox="0 0 60 100"
        width={size}
        height={size * 1.67}
        style={{ overflow: 'visible' }}
      >
        <CrownComponent
          position={position}
          faceColors={faceColors}
          selectedFace={selectedFace}
          onFaceClick={onFaceClick}
          toothNumber={toothNumber}
        />
        {wholeToothStatus && (
          <StatusOverlay status={wholeToothStatus} position={position} />
        )}
      </svg>
      {showLabel && position === 'superior' && (
        <span className="text-[10px] font-bold text-gray-600 leading-none">{toothNumber}</span>
      )}
    </div>
  );
}
