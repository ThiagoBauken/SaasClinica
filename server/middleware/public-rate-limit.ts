import rateLimit from 'express-rate-limit';

// Strict limiter for public token-based endpoints (quotes, confirmations, invites, check-in)
export const publicTokenLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisicoes. Tente novamente em 1 minuto.' },
});

// Stricter limiter for public form submissions (anamnesis, quote approval)
export const publicSubmitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5, // 5 submissions per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas submissoes. Tente novamente em 1 minuto.' },
});

// Lenient read limiter for public booking info/slots endpoints
export const publicReadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 read requests per minute per IP — covers calendar browsing
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas requisicoes. Tente novamente em 1 minuto.' },
});
