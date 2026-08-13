-- =============================================================================
-- Reference data: the professional domains the AI is allowed to classify into.
--
-- Kept in a table rather than a hardcoded list so the admin can add a domain in
-- Milestone 2 without a deploy. The AI is given these codes as a closed set —
-- a free-text domain would make the candidate lists impossible to filter, which
-- is exactly the manual-checking problem Milestone 1 exists to remove.
-- =============================================================================

CREATE TABLE domains (
  code        text PRIMARY KEY,
  label_en    text NOT NULL,
  label_de    text NOT NULL,
  label_fr    text NOT NULL,
  description text,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true
);

INSERT INTO domains (code, label_en, label_de, label_fr, description, sort_order) VALUES
  ('it',           'IT & Software',        'IT & Software',           'Informatique & logiciel',
   'Software engineering, data, infrastructure, security, QA, product', 1),
  ('health',       'Healthcare & Care',    'Gesundheit & Pflege',     'Santé & soins',
   'Nursing, elderly care, medical practice, therapy, medical technicians', 2),
  ('engineering',  'Engineering',          'Ingenieurwesen',          'Ingénierie',
   'Mechanical, electrical, automotive, industrial and process engineering', 3),
  ('logistics',    'Logistics & Transport','Logistik & Transport',    'Logistique & transport',
   'Warehousing, supply chain, freight, driving, dispatch', 4),
  ('finance',      'Finance & Accounting', 'Finanzen & Buchhaltung',  'Finance & comptabilité',
   'Accounting, controlling, audit, tax, banking, insurance', 5),
  ('construction', 'Construction & Trades','Bau & Handwerk',          'Construction & artisanat',
   'Site work, electricians, plumbers, welders, carpenters, technicians', 6),
  ('hospitality',  'Hospitality & Tourism','Gastronomie & Tourismus', 'Hôtellerie & tourisme',
   'Hotels, restaurants, kitchen, service, events, tourism', 7),
  ('sales',        'Sales & Marketing',    'Vertrieb & Marketing',    'Ventes & marketing',
   'Sales, account management, marketing, communications, e-commerce', 8),
  ('education',    'Education & Training', 'Bildung & Ausbildung',    'Éducation & formation',
   'Teaching, training, childcare, academic and vocational education', 9),
  ('science',      'Science & Research',   'Wissenschaft & Forschung','Sciences & recherche',
   'Laboratory, chemistry, biology, pharma, R&D', 10),
  ('admin',        'Administration & HR',  'Verwaltung & Personal',   'Administration & RH',
   'Office administration, HR, legal support, customer service', 11),
  ('agriculture',  'Agriculture & Food',   'Landwirtschaft & Lebensmittel', 'Agriculture & agroalimentaire',
   'Farming, food production, food technology, veterinary support', 12),
  ('other',        'Other',                'Sonstiges',               'Autre',
   'Anything the classifier could not place with confidence', 99);

-- Soft reference: classifications keep working if a domain is later retired.
ALTER TABLE profile_classifications
  ADD CONSTRAINT profile_classifications_domain_fkey
  FOREIGN KEY (domain) REFERENCES domains(code) ON UPDATE CASCADE ON DELETE SET DEFAULT;

ALTER TABLE profile_classifications ALTER COLUMN domain SET DEFAULT 'other';
