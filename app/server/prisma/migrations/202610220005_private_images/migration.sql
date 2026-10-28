ALTER TABLE attachments ADD CONSTRAINT attachment_purpose_resource CHECK (
  (purpose='private_image' AND resource_type='image' AND size_bytes<=5000000)
  OR (purpose IN ('proposal','report') AND resource_type='raw')
);
CREATE OR REPLACE FUNCTION verify_file_binding() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a attachments; n integer;
BEGIN
  SELECT * INTO a FROM attachments WHERE id=NEW.attachment_id;
  IF a.status<>'ready' THEN RAISE EXCEPTION 'Only ready attachments may be bound' USING ERRCODE='23514'; END IF;
  IF TG_TABLE_NAME='submission_files' THEN
    IF a.purpose NOT IN ('report','private_image') THEN RAISE EXCEPTION 'Report or private image purpose required' USING ERRCODE='23514'; END IF;
    SELECT count(*) INTO n FROM submission_files WHERE submission_id=NEW.submission_id;
    IF n>5 THEN RAISE EXCEPTION 'Maximum five files' USING ERRCODE='23514'; END IF;
  ELSE
    IF a.purpose<>'proposal' THEN RAISE EXCEPTION 'Proposal purpose required' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION verify_submission_has_files() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM submission_files sf JOIN attachments a ON a.id=sf.attachment_id WHERE sf.submission_id=NEW.id AND a.purpose='report') THEN RAISE EXCEPTION 'Submission needs at least one report document' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;
