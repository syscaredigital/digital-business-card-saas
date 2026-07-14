CREATE TABLE IF NOT EXISTS saved_reports (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  report_type VARCHAR(30) NOT NULL
    CHECK (report_type IN ('revenue', 'subscriptions', 'platform', 'coupons', 'affiliates')),
  date_range_days INTEGER NOT NULL DEFAULT 30 CHECK (date_range_days BETWEEN 1 AND 3650),
  status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  last_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_runs (
  id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES saved_reports(id) ON DELETE CASCADE,
  generated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  format VARCHAR(20) NOT NULL DEFAULT 'csv' CHECK (format IN ('csv')),
  status VARCHAR(30) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'failed')),
  row_count INTEGER NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  report_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_reports_type_status ON saved_reports(report_type, status);
CREATE INDEX IF NOT EXISTS idx_report_runs_report_date ON report_runs(report_id, generated_at DESC);
