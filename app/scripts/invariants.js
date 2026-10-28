import { mkdirSync, writeFileSync } from "node:fs";
const directory = "app/server/prisma/migrations/202610220002_invariants";
mkdirSync(directory, { recursive: true });
let sql = `CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE SEQUENCE topic_code_sequence;
CREATE INDEX topic_title_trgm_idx ON topics USING gin(normalized_title gin_trgm_ops);
CREATE UNIQUE INDEX active_member_per_period ON team_members(period_id, student_id) WHERE active;
CREATE UNIQUE INDEX active_supervisor_per_topic ON supervisor_assignments(topic_id) WHERE ended_at IS NULL;
CREATE UNIQUE INDEX pending_invitation ON team_invitations(team_id,invitee_id) WHERE status='pending';
CREATE UNIQUE INDEX pending_supervision ON supervision_requests(topic_id) WHERE status='pending';
CREATE UNIQUE INDEX pending_change ON topic_change_requests(topic_id) WHERE status='pending';
CREATE UNIQUE INDEX pending_cancellation ON topic_cancellation_requests(topic_id) WHERE status='pending';
CREATE UNIQUE INDEX active_corpus ON similarity_corpora(is_active) WHERE is_active;
ALTER TABLE team_access_grants ADD CONSTRAINT non_overlapping_access EXCLUDE USING gist (membership_id WITH =, tstzrange(readable_from, readable_until, '[)') WITH &&) WHERE (revoked_at IS NULL);
`;
const fk = (table, column, target, targetColumn = "id") => {
  sql += `ALTER TABLE ${table} ADD CONSTRAINT ${table}_${column}_fk FOREIGN KEY (${column}) REFERENCES ${target}(${targetColumn}) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;\n`;
};
for (const [table, fields] of Object.entries({
  majors: { faculty_id: "faculties" },
  classes: { major_id: "majors" },
  users: { faculty_id: "faculties", class_id: "classes" },
  user_roles: { user_id: "users" },
  management_scopes: { user_id: "users", faculty_id: "faculties" },
  refresh_sessions: { user_id: "users", replaced_by: "refresh_sessions" },
  research_periods: { faculty_id: "faculties" },
  teams: {
    period_id: "research_periods",
    faculty_id: "faculties",
    leader_id: "users",
  },
  team_members: {
    team_id: "teams",
    student_id: "users",
    period_id: "research_periods",
  },
  team_access_grants: { membership_id: "team_members", granted_by: "users" },
  team_invitations: {
    team_id: "teams",
    invitee_id: "users",
    invited_by: "users",
    change_request_id: "topic_change_requests",
  },
  topics: {
    team_id: "teams",
    period_id: "research_periods",
    faculty_id: "faculties",
    field_id: "research_fields",
    supervisor_id: "users",
    proposed_supervisor_id: "users",
    current_revision_id: "topic_revisions",
  },
  topic_revisions: {
    topic_id: "topics",
    created_by: "users",
    similarity_check_id: "similarity_checks",
    source_change_request_id: "topic_change_requests",
  },
  topic_revision_files: {
    topic_revision_id: "topic_revisions",
    attachment_id: "attachments",
    topic_id: "topics",
  },
  supervision_requests: {
    topic_id: "topics",
    lecturer_id: "users",
    requested_by: "users",
    change_request_id: "topic_change_requests",
  },
  supervisor_assignments: {
    topic_id: "topics",
    lecturer_id: "users",
    assigned_by: "users",
  },
  topic_decisions: {
    topic_revision_id: "topic_revisions",
    decided_by: "users",
    similarity_check_id: "similarity_checks",
  },
  topic_change_requests: {
    topic_id: "topics",
    requested_by: "users",
    decided_by: "users",
    similarity_check_id: "similarity_checks",
  },
  topic_cancellation_requests: {
    topic_id: "topics",
    requested_by: "users",
    decided_by: "users",
  },
  milestones: { topic_id: "topics" },
  progress_updates: {
    topic_id: "topics",
    milestone_id: "milestones",
    author_id: "users",
  },
  attachments: { topic_id: "topics", uploaded_by: "users" },
  submissions: {
    topic_id: "topics",
    milestone_id: "milestones",
    submitted_by: "users",
  },
  submission_files: {
    submission_id: "submissions",
    attachment_id: "attachments",
    topic_id: "topics",
  },
  reviews: {
    submission_id: "submissions",
    reviewer_id: "users",
    supersedes_review_id: "reviews",
  },
  evaluations: {
    topic_id: "topics",
    evaluator_id: "users",
    supersedes_id: "evaluations",
  },
  similarity_checks: {
    topic_id: "topics",
    requested_by: "users",
    corpus_id: "similarity_corpora",
  },
  similarity_matches: {
    check_id: "similarity_checks",
    candidate_topic_id: "topics",
    candidate_revision_id: "topic_revisions",
  },
  notifications: { recipient_id: "users" },
  audit_logs: { actor_id: "users", faculty_id: "faculties" },
  idempotency_records: { actor_id: "users" },
}))
  for (const [column, target] of Object.entries(fields))
    fk(table, column, target);
sql += `
ALTER TABLE research_periods ADD CONSTRAINT period_faculty_key UNIQUE(id,faculty_id);
ALTER TABLE teams ADD CONSTRAINT team_period_faculty_fk FOREIGN KEY(period_id,faculty_id) REFERENCES research_periods(id,faculty_id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE team_members ADD CONSTRAINT membership_period_fk FOREIGN KEY(team_id,period_id) REFERENCES teams(id,period_id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE topics ADD CONSTRAINT topic_team_scope_fk FOREIGN KEY(team_id,period_id,faculty_id) REFERENCES teams(id,period_id,faculty_id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE topics ADD CONSTRAINT current_revision_topic_fk FOREIGN KEY(current_revision_id,id) REFERENCES topic_revisions(id,topic_id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE topic_revision_files ADD CONSTRAINT revision_file_topic_fk FOREIGN KEY(topic_revision_id,topic_id) REFERENCES topic_revisions(id,topic_id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE topic_revision_files ADD CONSTRAINT revision_attachment_topic_fk FOREIGN KEY(attachment_id,topic_id) REFERENCES attachments(id,topic_id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE submissions ADD CONSTRAINT submission_milestone_topic_fk FOREIGN KEY(milestone_id,topic_id) REFERENCES milestones(id,topic_id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE submission_files ADD CONSTRAINT submission_file_topic_fk FOREIGN KEY(submission_id,topic_id) REFERENCES submissions(id,topic_id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE submission_files ADD CONSTRAINT submission_attachment_topic_fk FOREIGN KEY(attachment_id,topic_id) REFERENCES attachments(id,topic_id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE progress_updates ADD CONSTRAINT progress_milestone_topic_fk FOREIGN KEY(milestone_id,topic_id) REFERENCES milestones(id,topic_id) DEFERRABLE INITIALLY DEFERRED;
`;
const check = (table, name, expression) => {
  sql += `ALTER TABLE ${table} ADD CONSTRAINT ${name} CHECK(${expression});\n`;
};
const enumCheck = (table, column, values) =>
  check(
    table,
    `${table}_${column}_enum`,
    `${column} IN (${values.map((v) => `'${v}'`).join(",")})`,
  );
enumCheck("users", "status", ["active", "locked"]);
enumCheck("user_roles", "role", [
  "student",
  "lecturer",
  "faculty_staff",
  "admin",
]);
enumCheck("teams", "status", ["active", "closed"]);
enumCheck("research_periods", "status", ["open", "closed"]);
for (const table of ["team_invitations", "supervision_requests"])
  enumCheck(table, "status", [
    "pending",
    "accepted",
    "declined",
    "cancelled",
    "expired",
  ]);
enumCheck("topics", "status", [
  "draft",
  "submitted",
  "revision_required",
  "approved",
  "in_progress",
  "pending_evaluation",
  "completed",
  "rejected",
  "cancelled",
]);
for (const table of ["topic_change_requests", "topic_cancellation_requests"])
  enumCheck(table, "status", [
    "pending",
    "approved",
    "rejected",
    "withdrawn",
    "conflicted",
  ]);
enumCheck("topic_change_requests", "type", [
  "academic",
  "members",
  "supervisor",
]);
enumCheck("topic_revisions", "kind", ["submission", "approved_change"]);
enumCheck("topic_decisions", "action", [
  "approve",
  "request_revision",
  "reject",
]);
enumCheck("team_invitations", "purpose", ["initial", "approved_change"]);
enumCheck("supervision_requests", "purpose", ["initial", "replacement"]);
enumCheck("attachments", "status", ["pending", "ready", "failed"]);
enumCheck("attachments", "purpose", ["proposal", "report", "private_image"]);
enumCheck("attachments", "resource_type", ["raw", "image"]);
enumCheck("attachments", "delivery_type", ["authenticated"]);
enumCheck("submissions", "status", [
  "pending_review",
  "changes_requested",
  "accepted",
]);
enumCheck("reviews", "decision", [
  "comment_only",
  "changes_requested",
  "accepted",
]);
enumCheck("evaluations", "result", ["passed", "failed"]);
enumCheck("similarity_checks", "status", ["pending", "succeeded", "failed"]);
enumCheck("similarity_checks", "purpose", [
  "preview",
  "submit",
  "approve",
  "change",
]);
enumCheck("audit_logs", "actor_kind", ["user", "system"]);
enumCheck("idempotency_records", "status", ["processing", "completed"]);
check(
  "users",
  "normalized_user",
  "email=lower(email) AND account_code=lower(account_code)",
);
check(
  "research_periods",
  "period_dates",
  "registration_start<registration_end AND min_members>=1 AND min_members<=max_members AND max_members<=20",
);
check(
  "team_access_grants",
  "access_dates",
  "readable_until IS NULL OR readable_until>=readable_from",
);
check(
  "supervisor_assignments",
  "assignment_dates",
  "ended_at IS NULL OR ended_at>=started_at",
);
check(
  "progress_updates",
  "percent_range",
  "self_reported_percent BETWEEN 0 AND 100",
);
check("evaluations", "score_range", "score IS NULL OR score BETWEEN 0 AND 10");
check(
  "attachments",
  "file_size",
  "size_bytes>0 AND size_bytes<=20000000 AND (resource_type<>'image' OR size_bytes<=5000000)",
);
check(
  "attachments",
  "ready_asset",
  "status<>'ready' OR (asset_id IS NOT NULL AND sha256 IS NOT NULL AND verified_at IS NOT NULL)",
);
check(
  "submissions",
  "late_consistency",
  "is_late=(submitted_at>deadline_snapshot)",
);
check(
  "similarity_matches",
  "scores_range",
  "title_score BETWEEN 0 AND 1 AND content_score BETWEEN 0 AND 1 AND rank BETWEEN 1 AND 5",
);
check(
  "topics",
  "approved_supervisor",
  "status NOT IN ('approved','in_progress','pending_evaluation','completed') OR (supervisor_id IS NOT NULL AND current_revision_id IS NOT NULL AND approved_at IS NOT NULL)",
);
check(
  "topic_decisions",
  "decision_reason",
  "action='approve' OR length(reason)>=10",
);
check(
  "evaluations",
  "correction_reason",
  "version=1 OR (supersedes_id IS NOT NULL AND length(correction_reason)>=10)",
);
for (const table of [
  "users",
  "teams",
  "team_members",
  "team_invitations",
  "topics",
  "supervision_requests",
  "topic_change_requests",
  "topic_cancellation_requests",
  "milestones",
  "submissions",
  "faculties",
  "majors",
  "classes",
  "research_fields",
  "research_periods",
])
  check(table, `${table}_positive_revision`, "revision>0");
for (const table of [
  "topic_revisions",
  "submissions",
  "evaluations",
  "similarity_corpora",
])
  check(table, `${table}_positive_version`, "version>0");
sql += `
CREATE FUNCTION protect_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Historical rows are append-only' USING ERRCODE='23514'; END $$;
`;
for (const table of [
  "topic_revisions",
  "topic_revision_files",
  "topic_decisions",
  "submission_files",
  "reviews",
  "evaluations",
  "audit_logs",
  "progress_updates",
  "similarity_matches",
])
  sql += `CREATE TRIGGER immutable_${table} BEFORE UPDATE OR DELETE ON ${table} FOR EACH ROW EXECUTE FUNCTION protect_history();\n`;
sql += `
CREATE FUNCTION verify_team_invariants() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE t teams; member_count integer; max_size integer; team_uuid uuid;
BEGIN
  IF TG_TABLE_NAME='teams' THEN team_uuid:=NEW.id; ELSE team_uuid:=NEW.team_id; END IF;
  SELECT * INTO t FROM teams WHERE id=team_uuid;
  IF NOT FOUND THEN RETURN NULL; END IF;
  PERFORM 1 FROM team_members WHERE team_id=t.id AND student_id=t.leader_id AND (active OR t.status='closed');
  IF NOT FOUND THEN RAISE EXCEPTION 'Team requires a valid leader' USING ERRCODE='23514'; END IF;
  SELECT count(*) INTO member_count FROM team_members WHERE team_id=t.id AND active;
  SELECT max_members INTO max_size FROM research_periods WHERE id=t.period_id;
  IF member_count>max_size OR (t.status='closed' AND member_count>0) THEN RAISE EXCEPTION 'Team capacity invariant' USING ERRCODE='23514'; END IF;
  IF EXISTS(SELECT 1 FROM team_members m JOIN users u ON u.id=m.student_id WHERE m.team_id=t.id AND m.active AND (u.faculty_id<>t.faculty_id OR NOT EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=u.id AND r.role='student'))) THEN RAISE EXCEPTION 'Team faculty or student role mismatch' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER team_integrity AFTER INSERT OR UPDATE ON teams DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verify_team_invariants();
CREATE CONSTRAINT TRIGGER member_integrity AFTER INSERT OR UPDATE ON team_members DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verify_team_invariants();
CREATE FUNCTION verify_file_binding() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a attachments; n integer;
BEGIN
  SELECT * INTO a FROM attachments WHERE id=NEW.attachment_id;
  IF a.status<>'ready' THEN RAISE EXCEPTION 'Only ready attachments may be bound' USING ERRCODE='23514'; END IF;
  IF TG_TABLE_NAME='submission_files' THEN
    IF a.purpose<>'report' THEN RAISE EXCEPTION 'Report purpose required' USING ERRCODE='23514'; END IF;
    SELECT count(*) INTO n FROM submission_files WHERE submission_id=NEW.submission_id;
    IF n>5 THEN RAISE EXCEPTION 'Maximum five files' USING ERRCODE='23514'; END IF;
  ELSE
    IF a.purpose<>'proposal' THEN RAISE EXCEPTION 'Proposal purpose required' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER submission_ready AFTER INSERT ON submission_files DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verify_file_binding();
CREATE CONSTRAINT TRIGGER proposal_ready AFTER INSERT ON topic_revision_files DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verify_file_binding();
CREATE FUNCTION verify_submission_has_files() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM submission_files WHERE submission_id=NEW.id) THEN RAISE EXCEPTION 'Submission needs files' USING ERRCODE='23514'; END IF; RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER submission_has_files AFTER INSERT ON submissions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verify_submission_has_files();
CREATE FUNCTION verify_user_class() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.class_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM classes c JOIN majors m ON m.id=c.major_id WHERE c.id=NEW.class_id AND m.faculty_id=NEW.faculty_id) THEN RAISE EXCEPTION 'User class faculty mismatch' USING ERRCODE='23514'; END IF;
 IF EXISTS(SELECT 1 FROM team_members tm JOIN teams t ON t.id=tm.team_id WHERE tm.student_id=NEW.id AND tm.active AND t.faculty_id<>NEW.faculty_id) THEN RAISE EXCEPTION 'Active member faculty mismatch' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER user_class_consistency AFTER INSERT OR UPDATE ON users DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verify_user_class();
CREATE FUNCTION verify_supervisor() RETURNS trigger LANGUAGE plpgsql AS $$ DECLARE t topics; BEGIN
 SELECT * INTO t FROM topics WHERE id=NEW.id;
 IF t.status IN ('approved','in_progress','pending_evaluation','completed') AND NOT EXISTS(SELECT 1 FROM supervisor_assignments a WHERE a.topic_id=t.id AND a.lecturer_id=t.supervisor_id AND a.ended_at IS NULL) THEN RAISE EXCEPTION 'Current supervisor assignment mismatch' USING ERRCODE='23514'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER supervisor_consistency AFTER INSERT OR UPDATE ON topics DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION verify_supervisor();
`;
writeFileSync(`${directory}/migration.sql`, sql);
