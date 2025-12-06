-- Create notifications table
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" SERIAL PRIMARY KEY,
  "company_id" INTEGER NOT NULL,
  "user_id" INTEGER,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "data" JSONB,
  "read" BOOLEAN DEFAULT false,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "read_at" TIMESTAMP,
  "deleted_at" TIMESTAMP
);

-- Create digitization_history table
CREATE TABLE IF NOT EXISTS "digitization_history" (
  "id" SERIAL PRIMARY KEY,
  "company_id" INTEGER NOT NULL,
  "user_id" INTEGER NOT NULL,
  "total_files" INTEGER NOT NULL,
  "success_count" INTEGER NOT NULL DEFAULT 0,
  "error_count" INTEGER NOT NULL DEFAULT 0,
  "duplicate_count" INTEGER NOT NULL DEFAULT 0,
  "output_format" TEXT NOT NULL,
  "download_url" TEXT,
  "uploaded_files_path" TEXT,
  "processed_files_size" INTEGER,
  "metadata" JSONB,
  "processed_at" TIMESTAMP DEFAULT NOW(),
  "deleted_at" TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "notifications_company_id_idx" ON "notifications" ("company_id");
CREATE INDEX IF NOT EXISTS "notifications_user_id_idx" ON "notifications" ("user_id");
CREATE INDEX IF NOT EXISTS "digitization_history_company_id_idx" ON "digitization_history" ("company_id");
CREATE INDEX IF NOT EXISTS "digitization_history_user_id_idx" ON "digitization_history" ("user_id");
