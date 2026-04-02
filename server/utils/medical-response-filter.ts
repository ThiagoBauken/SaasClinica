/**
 * Medical Response Post-Filter
 *
 * Validates AI responses before sending to patients.
 * Detects and filters potentially harmful medical content
 * that the AI should never provide (prescriptions, diagnoses, etc.).
 *
 * This is a safety net — the system prompt already instructs the AI
 * not to provide medical advice, but this catches edge cases.
 */

import { logger } from '../logger';

const log = logger.child({ module: 'medical-filter' });

/** Patterns that indicate the AI is giving medical advice it shouldn't */
const MEDICAL_PATTERNS: { pattern: RegExp; name: string }[] = [
  // Prescrição de medicamentos com dosagem
  { pattern: /tome?\s+\d+\s*(?:mg|ml|g|comprimido|gotas|cápsula)/i, name: 'prescription_dosage' },
  { pattern: /prescrev[eo]\s/i, name: 'prescription_verb' },
  { pattern: /recomendo\s+(?:tomar|usar|aplicar)\s+(?:\w+\s+)?(?:amoxicilina|ibuprofeno|paracetamol|nimesulida|dipirona|azitromicina|clindamicina|metronidazol|cefalexina|dexametasona|prednisolona)/i, name: 'specific_medication_recommendation' },
  { pattern: /(?:compre|adquira|peça)\s+(?:na farmácia|em qualquer farmácia)/i, name: 'pharmacy_direction' },

  // Diagnósticos definitivos
  { pattern: /(?:seu|sua)\s+diagnóstico\s+é\s/i, name: 'definitive_diagnosis' },
  { pattern: /você\s+(?:tem|está\s+com)\s+(?:periodontite|gengivite|cárie|abscesso|pulpite|pericoronarite|bruxismo|disfunção\s+temporomandibular|ATM)/i, name: 'definitive_condition' },
  { pattern: /(?:certamente|definitivamente|claramente)\s+(?:é|trata-se\s+de)\s+(?:um[a]?\s+)?(?:infecção|inflamação|cárie|fratura|necrose)/i, name: 'certain_diagnosis' },

  // Interpretação de exames
  { pattern: /(?:pela|na|da)\s+radiografia\s+(?:mostra|indica|revela|confirma)/i, name: 'xray_interpretation' },
  { pattern: /(?:o|seu)\s+exame\s+(?:mostra|indica|revela|confirma)\s+(?:que|um)/i, name: 'exam_interpretation' },

  // Orientações de tratamento específicas
  { pattern: /(?:faça|realize)\s+(?:bochechos?|gargarejos?)\s+com\s+(?:água\s+oxigenada|peróxido|clorexidina)/i, name: 'specific_treatment' },
  { pattern: /(?:aplique|passe|coloque)\s+(?:\w+\s+)?(?:no|na|sobre)\s+(?:o\s+)?(?:dente|gengiva|ferida|lesão)/i, name: 'topical_treatment' },
];

/** Safe fallback response when medical content is detected */
const SAFE_FALLBACK = 'Para questões clínicas e orientações sobre tratamento, é importante consultar nosso dentista pessoalmente. Posso agendar uma consulta para você?';

export interface FilterResult {
  /** Whether the response was filtered */
  filtered: boolean;
  /** The safe response to send (original if not filtered) */
  safeResponse: string;
  /** Names of matched patterns (for logging) */
  matchedPatterns: string[];
}

/**
 * Checks an AI response for potentially harmful medical content.
 * If detected, returns a safe replacement response.
 */
export function filterMedicalResponse(response: string): FilterResult {
  const matchedPatterns: string[] = [];

  for (const { pattern, name } of MEDICAL_PATTERNS) {
    if (pattern.test(response)) {
      matchedPatterns.push(name);
    }
  }

  if (matchedPatterns.length > 0) {
    log.warn({ patterns: matchedPatterns, responsePreview: response.substring(0, 200) }, 'Medical content detected in AI response');

    return {
      filtered: true,
      safeResponse: SAFE_FALLBACK,
      matchedPatterns,
    };
  }

  return {
    filtered: false,
    safeResponse: response,
    matchedPatterns: [],
  };
}
