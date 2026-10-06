-- REVIEW ONLY. Run on an isolated restored copy first, after schema/backup validation.
-- Additive: legacy tables and their contents are NEVER read, altered or seeded here.
BEGIN;
CREATE TABLE public.tm_workspace_v1 (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  version integer NOT NULL DEFAULT 1 CHECK (version = 1),
  revision bigint NOT NULL CHECK (revision > 0 AND revision < 9007199254740991),
  document jsonb NOT NULL CHECK (jsonb_typeof(document) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tm_workspace_history_v1 (
  revision bigint PRIMARY KEY,
  document jsonb NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tm_workspace_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tm_workspace_history_v1 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tm_workspace_v1, public.tm_workspace_history_v1 FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.tm_workspace_v1 TO service_role;
GRANT SELECT, INSERT ON public.tm_workspace_history_v1 TO service_role;

CREATE FUNCTION public.tm_workspace_read_v1() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog, public
AS $$ SELECT jsonb_build_object('version', version, 'revision', revision, 'data', document)
      FROM public.tm_workspace_v1 WHERE singleton = true $$;

CREATE FUNCTION public.tm_workspace_commit_v1(p_expected_revision bigint, p_document jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE current_row public.tm_workspace_v1%ROWTYPE;
BEGIN
  IF p_expected_revision IS NULL OR p_document IS NULL OR jsonb_typeof(p_document) <> 'object'
    OR jsonb_typeof(p_document->'companies') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_document->'people') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_document->'tasks') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_document->'users') IS DISTINCT FROM 'array'
  THEN RAISE EXCEPTION 'Invalid workspace document'; END IF;
  SELECT * INTO current_row FROM public.tm_workspace_v1 WHERE singleton = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Explicit verified import required'; END IF;
  IF current_row.revision <> p_expected_revision THEN
    RETURN jsonb_build_object('committed', false, 'revision', current_row.revision);
  END IF;
  INSERT INTO public.tm_workspace_history_v1(revision, document) VALUES(current_row.revision, current_row.document);
  UPDATE public.tm_workspace_v1 SET document = p_document, revision = current_row.revision + 1, updated_at = now()
    WHERE singleton = true;
  RETURN jsonb_build_object('committed', true, 'revision', current_row.revision + 1);
END $$;

-- Restore is a NEW revision, never history deletion. Explicit revision check prevents lost updates.
CREATE FUNCTION public.tm_workspace_restore_v1(p_expected_revision bigint, p_restore_revision bigint) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE saved_document jsonb;
BEGIN
  SELECT document INTO saved_document FROM public.tm_workspace_history_v1 WHERE revision = p_restore_revision;
  IF NOT FOUND THEN RAISE EXCEPTION 'Historical revision not found'; END IF;
  RETURN public.tm_workspace_commit_v1(p_expected_revision, saved_document);
END $$;
REVOKE ALL ON FUNCTION public.tm_workspace_read_v1(), public.tm_workspace_commit_v1(bigint,jsonb), public.tm_workspace_restore_v1(bigint,bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tm_workspace_read_v1(), public.tm_workspace_commit_v1(bigint,jsonb), public.tm_workspace_restore_v1(bigint,bigint) TO service_role;
COMMIT;
