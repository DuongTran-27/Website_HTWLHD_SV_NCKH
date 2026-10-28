ALTER TABLE milestones ADD COLUMN deadline_version INTEGER NOT NULL DEFAULT 1 CHECK(deadline_version>0);
CREATE FUNCTION update_deadline_version() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF NEW.deadline IS DISTINCT FROM OLD.deadline THEN NEW.deadline_version:=OLD.deadline_version+1;
  ELSE NEW.deadline_version:=OLD.deadline_version; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER milestone_deadline_version BEFORE UPDATE OF deadline,deadline_version ON milestones FOR EACH ROW EXECUTE FUNCTION update_deadline_version();
