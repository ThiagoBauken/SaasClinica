/**
 * Prometheus Metrics
 * Exposes /metrics endpoint for Prometheus scraping.
 * Tracks HTTP requests, DB pool, queue depths, and business metrics.
 */
import { Registry, collectDefaultMetrics, Histogram, Counter, Gauge } from 'prom-client';

export const register = new Registry();

// Collect Node.js default metrics (CPU, memory, event loop, GC)
collectDefaultMetrics({ register, prefix: 'dental_' });

// --- HTTP Metrics ---

export const httpRequestDuration = new Histogram({
  name: 'dental_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

export const httpRequestsTotal = new Counter({
  name: 'dental_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [register],
});

// --- Database Metrics ---

export const dbPoolTotal = new Gauge({
  name: 'dental_db_pool_total',
  help: 'Total connections in database pool',
  registers: [register],
});

export const dbPoolIdle = new Gauge({
  name: 'dental_db_pool_idle',
  help: 'Idle connections in database pool',
  registers: [register],
});

export const dbPoolWaiting = new Gauge({
  name: 'dental_db_pool_waiting',
  help: 'Waiting requests for database connections',
  registers: [register],
});

// --- Queue Metrics ---

export const queueJobsProcessed = new Counter({
  name: 'dental_queue_jobs_processed_total',
  help: 'Total queue jobs processed',
  labelNames: ['queue', 'status'] as const,
  registers: [register],
});

// --- Business Metrics ---

export const appointmentsCreated = new Counter({
  name: 'dental_appointments_created_total',
  help: 'Total appointments created',
  registers: [register],
});

export const whatsappMessagesSent = new Counter({
  name: 'dental_whatsapp_messages_sent_total',
  help: 'Total WhatsApp messages sent',
  labelNames: ['status'] as const,
  registers: [register],
});

export const tenantsActive = new Gauge({
  name: 'dental_tenants_active',
  help: 'Number of active tenant companies',
  registers: [register],
});

// --- Cache Metrics ---

export const cacheHits = new Counter({
  name: 'dental_cache_hits_total',
  help: 'Total cache hits',
  registers: [register],
});

export const cacheMisses = new Counter({
  name: 'dental_cache_misses_total',
  help: 'Total cache misses',
  registers: [register],
});

// --- Dead Letter Queue ---

export const dlqJobs = new Counter({
  name: 'dental_dlq_jobs_total',
  help: 'Jobs moved to the dead-letter queue after exhausting retries',
  labelNames: ['queue'] as const,
  registers: [register],
});
