-- Reconstructed from authorized metadata observed 2026-10-06 12:19 UTC.
-- No production rows; NOT a backup. Isolated PostgreSQL compatibility fixture.
CREATE TABLE companies(id text PRIMARY KEY, name text NOT NULL);
CREATE TABLE people(id text PRIMARY KEY, name text NOT NULL, role text NOT NULL, avatar text NOT NULL, company_id text REFERENCES companies(id) ON DELETE SET NULL);
CREATE TABLE email_templates(id text PRIMARY KEY,name text NOT NULL,subject text NOT NULL,body text NOT NULL);
CREATE TABLE smtp_config(id text PRIMARY KEY DEFAULT 'default',host text NOT NULL,port integer NOT NULL,secure boolean NOT NULL,auth_user text NOT NULL,auth_pass text NOT NULL);
CREATE TABLE tasks(id text PRIMARY KEY,title text NOT NULL,description text NOT NULL,type text NOT NULL,repeat_pattern text,steps jsonb NOT NULL DEFAULT '[]',company_id text REFERENCES companies(id) ON DELETE SET NULL,assignee_id text REFERENCES people(id) ON DELETE SET NULL,assignee_ids text[] DEFAULT '{}',status text NOT NULL,priority text NOT NULL,origin text NOT NULL,due_date timestamptz NOT NULL,attachments jsonb NOT NULL DEFAULT '[]',activity_log jsonb NOT NULL DEFAULT '[]',created_at timestamptz DEFAULT now());
CREATE TABLE users(id text PRIMARY KEY,person_id text REFERENCES people(id) ON DELETE CASCADE,email text NOT NULL UNIQUE,password_hash text NOT NULL,salt text NOT NULL,is_active boolean NOT NULL DEFAULT true,created_at timestamptz DEFAULT now());
CREATE TABLE agent_queue(id text PRIMARY KEY,task_id text NOT NULL,command text NOT NULL,payload jsonb NOT NULL DEFAULT '{}',status text NOT NULL,timestamp timestamptz NOT NULL DEFAULT now());
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE smtp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_queue ENABLE ROW LEVEL SECURITY;
-- Equivalent behavior of observed rls_auto_enable; actual event-trigger bindings not supplied.
CREATE FUNCTION fixture_enable_rls() RETURNS event_trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO pg_catalog AS $$
DECLARE cmd record; BEGIN
 FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands() WHERE command_tag IN ('CREATE TABLE','CREATE TABLE AS','SELECT INTO') AND object_type IN ('table','partitioned table') LOOP
  IF cmd.schema_name='public' THEN EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY',cmd.object_identity); END IF;
 END LOOP;
END; $$;
CREATE EVENT TRIGGER fixture_rls_on_create ON ddl_command_end EXECUTE FUNCTION fixture_enable_rls();
