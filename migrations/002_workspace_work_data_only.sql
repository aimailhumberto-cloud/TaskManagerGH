BEGIN;
ALTER TABLE public.tm_workspace_v1 ADD CONSTRAINT tm_workspace_work_only CHECK (NOT (document ?| ARRAY['users','smtpConfig','aiConfig']));
ALTER TABLE public.tm_workspace_history_v1 ADD CONSTRAINT tm_history_work_only CHECK (NOT (document ?| ARRAY['users','smtpConfig','aiConfig']));
CREATE OR REPLACE FUNCTION public.tm_workspace_commit_v1(p_expected_revision bigint, p_document jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, public AS $$
DECLARE current_row public.tm_workspace_v1%ROWTYPE;
BEGIN
  IF p_expected_revision IS NULL OR p_document IS NULL OR jsonb_typeof(p_document) <> 'object'
    OR jsonb_typeof(p_document->'companies') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_document->'people') IS DISTINCT FROM 'array'
    OR jsonb_typeof(p_document->'tasks') IS DISTINCT FROM 'array'
    OR p_document ?| ARRAY['users','smtpConfig','aiConfig']
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
COMMIT;
