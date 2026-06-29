-- charter plugin initial schema
-- namespace: plugin_charter_8399e57405 (sha256("charter").hex[:10])

CREATE TABLE IF NOT EXISTS plugin_charter_8399e57405.charter (
  project_id       uuid        PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  goal             text,
  designation      text,
  owner            text,
  company_key      text,
  secrets_path     text,
  repo_url         text,
  deploy_archetype text,
  env_ladder       jsonb       NOT NULL DEFAULT '[]'::jsonb,
  status           text        NOT NULL DEFAULT 'draft',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plugin_charter_8399e57405.deploy_targets (
  id               uuid        PRIMARY KEY,
  project_id       uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name             text        NOT NULL,
  stage            text        NOT NULL CHECK (stage IN ('dev', 'test', 'preprod', 'prod')),
  substrate        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  url              text,
  branch           text,
  status           text        NOT NULL DEFAULT 'undeclared' CHECK (status IN ('declared', 'pending', 'undeclared')),
  last_verified_at timestamptz,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, stage)
);

CREATE TABLE IF NOT EXISTS plugin_charter_8399e57405.web_surfaces (
  id         uuid        PRIMARY KEY,
  project_id uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  repo       text,
  subdir     text,
  framework  text,
  kind       text,
  output_dir text,
  url        text,
  worker     jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
