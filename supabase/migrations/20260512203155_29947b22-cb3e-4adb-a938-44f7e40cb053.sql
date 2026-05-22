
-- 1. Add country & Katılım flag to assets
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS country text DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS katilim_compliant boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_assets_country ON public.assets(country);
CREATE INDEX IF NOT EXISTS idx_assets_katilim ON public.assets(katilim_compliant) WHERE katilim_compliant = true;

-- 2. Extend market_regime enum with try_crisis
ALTER TYPE public.market_regime ADD VALUE IF NOT EXISTS 'try_crisis';

-- 3. Seed BIST indices & Turkish blue chips
INSERT INTO public.assets (ticker, name, asset_class, exchange, sector, currency, country, katilim_compliant, metadata)
VALUES
  ('XU100', 'BIST 100 Index', 'index', 'BIST', 'Index', 'TRY', 'TR', false, '{"benchmark":true}'),
  ('XU030', 'BIST 30 Index', 'index', 'BIST', 'Index', 'TRY', 'TR', false, '{"benchmark":true}'),
  ('XKTUM', 'BIST Katılım Index', 'index', 'BIST', 'Index', 'TRY', 'TR', true, '{"benchmark":true,"sharia":true}'),
  ('THYAO', 'Türk Hava Yolları', 'equity', 'BIST', 'Airlines', 'TRY', 'TR', false, '{}'),
  ('ASELS', 'Aselsan Elektronik', 'equity', 'BIST', 'Defense', 'TRY', 'TR', true, '{}'),
  ('KCHOL', 'Koç Holding', 'equity', 'BIST', 'Holding', 'TRY', 'TR', false, '{}'),
  ('GARAN', 'Garanti BBVA', 'equity', 'BIST', 'Banking', 'TRY', 'TR', false, '{}'),
  ('AKBNK', 'Akbank', 'equity', 'BIST', 'Banking', 'TRY', 'TR', false, '{}'),
  ('BIMAS', 'BİM Birleşik Mağazalar', 'equity', 'BIST', 'Retail', 'TRY', 'TR', true, '{}'),
  ('EREGL', 'Ereğli Demir Çelik', 'equity', 'BIST', 'Steel', 'TRY', 'TR', true, '{}'),
  ('SISE', 'Şişecam', 'equity', 'BIST', 'Industrial', 'TRY', 'TR', true, '{}'),
  ('KOZAL', 'Koza Altın', 'equity', 'BIST', 'Mining', 'TRY', 'TR', true, '{}'),
  ('TUPRS', 'Tüpraş', 'equity', 'BIST', 'Energy', 'TRY', 'TR', true, '{}'),
  ('USDTRY', 'US Dollar / Turkish Lira', 'fx', 'FX', 'Currency', 'TRY', 'TR', false, '{"pair":"USD/TRY"}')
ON CONFLICT DO NOTHING;

-- 4. Seed TR macro indicator placeholders (will be refreshed by edge function)
INSERT INTO public.macro_indicators (series_id, label, value, unit, observed_at)
VALUES
  ('TCMB_POLICY_RATE', 'TCMB Politika Faizi', 50.00, '%', now()),
  ('TUIK_TUFE_YOY',    'TÜFE (CPI YoY)',     49.38, '%', now()),
  ('TUIK_UFE_YOY',     'ÜFE (PPI YoY)',      32.05, '%', now()),
  ('TCMB_USDTRY',      'USD/TRY',            34.50, 'TRY', now()),
  ('TCMB_RESERVES',    'TCMB Brüt Rezervler', 155.0, 'B USD', now()),
  ('TCMB_KKM_RATIO',   'KKM Payı (Mevduat %)', 18.5, '%', now())
ON CONFLICT DO NOTHING;

-- 5. Stress scenario: TRY shock
INSERT INTO public.stress_scenarios (name, description, shocks)
VALUES (
  'TRY Shock -15%',
  'Sudden 15% TRY devaluation vs USD; BIST 100 -8%; banking sector -12%',
  '{"FX:USDTRY": 0.15, "INDEX:XU100": -0.08, "SECTOR:Banking": -0.12}'
)
ON CONFLICT DO NOTHING;
