#!/bin/bash
# =============================================================================
# PostgreSQL Automated Backup Script
# =============================================================================
# Usage:
#   ./backup-database.sh                    # Full backup to local ./backups/
#   ./backup-database.sh --upload-s3        # Full backup + upload to S3
#   ./backup-database.sh --tables patients  # Single table backup
#
# Environment variables (from .env):
#   DATABASE_URL          - PostgreSQL connection string (required)
#   BACKUP_S3_BUCKET      - S3 bucket name (for --upload-s3)
#   S3_ENDPOINT           - S3/MinIO endpoint
#   S3_ACCESS_KEY_ID      - S3 access key
#   S3_SECRET_ACCESS_KEY  - S3 secret key
#   BACKUP_RETENTION_DAYS - Days to keep local backups (default: 30)
# =============================================================================

set -euo pipefail

# Load .env if present
if [ -f "$(dirname "$0")/../../.env" ]; then
  export $(grep -v '^#' "$(dirname "$0")/../../.env" | xargs)
fi

# Configuration
BACKUP_DIR="${BACKUP_DIR:-$(dirname "$0")/../../backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backup_${TIMESTAMP}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

echo "=== PostgreSQL Backup ==="
echo "Time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL not set"
  exit 1
fi

# Parse table flag
TABLES=""
UPLOAD_S3=false
for arg in "$@"; do
  case $arg in
    --tables)
      shift
      TABLES="--table=$1"
      BACKUP_FILE="backup_${1}_${TIMESTAMP}.sql.gz"
      BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"
      ;;
    --upload-s3)
      UPLOAD_S3=true
      ;;
  esac
done

# Run pg_dump
echo "Running pg_dump..."
pg_dump "${DATABASE_URL}" \
  --format=plain \
  --no-owner \
  --no-privileges \
  --if-exists \
  --clean \
  ${TABLES} \
  2>/dev/null | gzip > "${BACKUP_PATH}"

SIZE=$(du -h "${BACKUP_PATH}" | cut -f1)
echo "Backup created: ${BACKUP_PATH} (${SIZE})"

# Upload to S3 if requested
if [ "$UPLOAD_S3" = true ] && [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  echo "Uploading to S3: s3://${BACKUP_S3_BUCKET}/db-backups/${BACKUP_FILE}"

  S3_ARGS=""
  if [ -n "${S3_ENDPOINT:-}" ]; then
    S3_ARGS="--endpoint-url ${S3_ENDPOINT}"
  fi

  aws s3 cp ${S3_ARGS} \
    "${BACKUP_PATH}" \
    "s3://${BACKUP_S3_BUCKET}/db-backups/${BACKUP_FILE}" \
    --storage-class STANDARD_IA

  echo "S3 upload complete"
fi

# Clean up old local backups
if [ -d "${BACKUP_DIR}" ]; then
  DELETED=$(find "${BACKUP_DIR}" -name "backup_*.sql.gz" -mtime +${RETENTION_DAYS} -delete -print | wc -l)
  if [ "$DELETED" -gt 0 ]; then
    echo "Cleaned up ${DELETED} backups older than ${RETENTION_DAYS} days"
  fi
fi

echo "=== Backup Complete ==="
