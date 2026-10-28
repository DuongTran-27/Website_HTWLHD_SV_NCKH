-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "faculties" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "faculties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "majors" (
    "id" UUID NOT NULL,
    "faculty_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "majors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classes" (
    "id" UUID NOT NULL,
    "major_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "admission_year" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "classes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "account_code" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "faculty_id" UUID,
    "class_id" UUID,
    "specialization" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "auth_version" INTEGER NOT NULL DEFAULT 1,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id","role")
);

-- CreateTable
CREATE TABLE "management_scopes" (
    "user_id" UUID NOT NULL,
    "faculty_id" UUID NOT NULL,

    CONSTRAINT "management_scopes_pkey" PRIMARY KEY ("user_id","faculty_id")
);

-- CreateTable
CREATE TABLE "refresh_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "absolute_expires_at" TIMESTAMPTZ(3) NOT NULL,
    "rotated_at" TIMESTAMPTZ(3),
    "replaced_by" UUID,
    "revoked_at" TIMESTAMPTZ(3),
    "revoke_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_periods" (
    "id" UUID NOT NULL,
    "faculty_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "academic_year" TEXT NOT NULL,
    "registration_start" TIMESTAMPTZ(3) NOT NULL,
    "registration_end" TIMESTAMPTZ(3) NOT NULL,
    "min_members" INTEGER NOT NULL DEFAULT 1,
    "max_members" INTEGER NOT NULL DEFAULT 3,
    "status" TEXT NOT NULL DEFAULT 'open',
    "milestone_templates" JSONB NOT NULL DEFAULT '[]',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_fields" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "research_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "period_id" UUID NOT NULL,
    "faculty_id" UUID NOT NULL,
    "leader_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "closed_reason" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "period_id" UUID NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "left_at" TIMESTAMPTZ(3),
    "left_reason" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_access_grants" (
    "id" UUID NOT NULL,
    "membership_id" UUID NOT NULL,
    "readable_from" TIMESTAMPTZ(3) NOT NULL,
    "readable_until" TIMESTAMPTZ(3),
    "retained_after_leave" BOOLEAN NOT NULL DEFAULT false,
    "revoked_at" TIMESTAMPTZ(3),
    "granted_by" UUID NOT NULL,
    "revoke_reason" TEXT,

    CONSTRAINT "team_access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_invitations" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "invitee_id" UUID NOT NULL,
    "invited_by" UUID NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'initial',
    "change_request_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "responded_at" TIMESTAMPTZ(3),
    "response_reason" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topics" (
    "id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "period_id" UUID NOT NULL,
    "faculty_id" UUID NOT NULL,
    "field_id" UUID NOT NULL,
    "supervisor_id" UUID,
    "proposed_supervisor_id" UUID,
    "code" TEXT NOT NULL,
    "title" VARCHAR(250) NOT NULL,
    "normalized_title" TEXT NOT NULL,
    "abstract" TEXT NOT NULL DEFAULT '',
    "objectives" TEXT NOT NULL DEFAULT '',
    "research_content" TEXT NOT NULL DEFAULT '',
    "methodology" TEXT NOT NULL DEFAULT '',
    "expected_outcomes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "current_revision_id" UUID,
    "revision_sequence" INTEGER NOT NULL DEFAULT 0,
    "evaluation_sequence" INTEGER NOT NULL DEFAULT 0,
    "submitted_at" TIMESTAMPTZ(3),
    "approved_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic_revisions" (
    "id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'submission',
    "snapshot" JSONB NOT NULL,
    "created_by" UUID NOT NULL,
    "similarity_check_id" UUID,
    "source_change_request_id" UUID,
    "published_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topic_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic_revision_files" (
    "topic_revision_id" UUID NOT NULL,
    "attachment_id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,

    CONSTRAINT "topic_revision_files_pkey" PRIMARY KEY ("topic_revision_id","attachment_id")
);

-- CreateTable
CREATE TABLE "supervision_requests" (
    "id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "lecturer_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'initial',
    "change_request_id" UUID,
    "academic_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMPTZ(3),
    "responded_at" TIMESTAMPTZ(3),
    "response_reason" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supervision_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supervisor_assignments" (
    "id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "lecturer_id" UUID NOT NULL,
    "assigned_by" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(3),
    "reason" TEXT,

    CONSTRAINT "supervisor_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic_decisions" (
    "id" UUID NOT NULL,
    "topic_revision_id" UUID NOT NULL,
    "decided_by" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "similarity_check_id" UUID,
    "warning_justification" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topic_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic_change_requests" (
    "id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "before_data" JSONB NOT NULL,
    "after_data" JSONB NOT NULL,
    "base_revision" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "similarity_check_id" UUID,
    "decided_by" UUID,
    "decision_reason" TEXT,
    "decided_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topic_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "topic_cancellation_requests" (
    "id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decided_by" UUID,
    "decision_reason" TEXT,
    "decided_at" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topic_cancellation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestones" (
    "id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "expected_output" TEXT NOT NULL,
    "deadline" TIMESTAMPTZ(3) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "resubmission_allowed" BOOLEAN NOT NULL DEFAULT false,
    "submission_sequence" INTEGER NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progress_updates" (
    "id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "milestone_id" UUID,
    "author_id" UUID NOT NULL,
    "completed_work" TEXT NOT NULL,
    "difficulties" TEXT NOT NULL,
    "next_plan" TEXT NOT NULL,
    "self_reported_percent" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progress_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "asset_id" TEXT,
    "public_id" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL DEFAULT 'raw',
    "delivery_type" TEXT NOT NULL DEFAULT 'authenticated',
    "sha256" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "verified_at" TIMESTAMPTZ(3),
    "error_code" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "milestone_id" UUID NOT NULL,
    "submitted_by" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending_review',
    "submitted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadline_snapshot" TIMESTAMPTZ(3) NOT NULL,
    "is_late" BOOLEAN NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_files" (
    "submission_id" UUID NOT NULL,
    "attachment_id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,

    CONSTRAINT "submission_files_pkey" PRIMARY KEY ("submission_id","attachment_id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "comment" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "supersedes_review_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evaluations" (
    "id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "evaluator_id" UUID NOT NULL,
    "result" TEXT NOT NULL,
    "score" DECIMAL(4,2),
    "comment" TEXT NOT NULL,
    "correction_reason" TEXT,
    "supersedes_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "similarity_corpora" (
    "id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "algorithm_version" TEXT NOT NULL,
    "normalizer_version" TEXT NOT NULL,
    "stopwords_version" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "corpus_size" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "built_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "similarity_corpora_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "similarity_checks" (
    "id" UUID NOT NULL,
    "topic_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "corpus_id" UUID NOT NULL,
    "input_snapshot" JSONB NOT NULL,
    "input_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'succeeded',
    "exact_title_match" BOOLEAN,
    "title_threshold" DOUBLE PRECISION,
    "content_threshold" DOUBLE PRECISION,
    "has_warning" BOOLEAN,
    "error_code" TEXT,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "similarity_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "similarity_matches" (
    "id" UUID NOT NULL,
    "check_id" UUID NOT NULL,
    "candidate_topic_id" UUID NOT NULL,
    "candidate_revision_id" UUID NOT NULL,
    "rank" INTEGER NOT NULL,
    "title_score" DOUBLE PRECISION NOT NULL,
    "content_score" DOUBLE PRECISION NOT NULL,
    "candidate_metadata" JSONB NOT NULL,

    CONSTRAINT "similarity_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID,
    "event_key" TEXT NOT NULL,
    "read_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "actor_kind" TEXT NOT NULL DEFAULT 'user',
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "faculty_id" UUID,
    "before_data" JSONB,
    "after_data" JSONB,
    "reason" TEXT,
    "request_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "operation" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "response_status" INTEGER NOT NULL,
    "response_data" JSONB NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "faculties_code_key" ON "faculties"("code");

-- CreateIndex
CREATE UNIQUE INDEX "majors_code_key" ON "majors"("code");

-- CreateIndex
CREATE UNIQUE INDEX "classes_code_key" ON "classes"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_account_code_key" ON "users"("account_code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_sessions_token_hash_key" ON "refresh_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_sessions_family_id_idx" ON "refresh_sessions"("family_id");

-- CreateIndex
CREATE UNIQUE INDEX "research_fields_code_key" ON "research_fields"("code");

-- CreateIndex
CREATE UNIQUE INDEX "teams_id_period_id_key" ON "teams"("id", "period_id");

-- CreateIndex
CREATE UNIQUE INDEX "teams_id_period_id_faculty_id_key" ON "teams"("id", "period_id", "faculty_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_team_id_student_id_key" ON "team_members"("team_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "topics_team_id_key" ON "topics"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "topics_code_key" ON "topics"("code");

-- CreateIndex
CREATE INDEX "topics_faculty_id_period_id_status_idx" ON "topics"("faculty_id", "period_id", "status");

-- CreateIndex
CREATE INDEX "topics_field_id_idx" ON "topics"("field_id");

-- CreateIndex
CREATE INDEX "topics_supervisor_id_idx" ON "topics"("supervisor_id");

-- CreateIndex
CREATE UNIQUE INDEX "topics_id_team_id_key" ON "topics"("id", "team_id");

-- CreateIndex
CREATE UNIQUE INDEX "topic_revisions_topic_id_version_key" ON "topic_revisions"("topic_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "topic_revisions_id_topic_id_key" ON "topic_revisions"("id", "topic_id");

-- CreateIndex
CREATE UNIQUE INDEX "milestones_topic_id_code_key" ON "milestones"("topic_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "milestones_id_topic_id_key" ON "milestones"("id", "topic_id");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_asset_id_key" ON "attachments"("asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_public_id_key" ON "attachments"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_id_topic_id_key" ON "attachments"("id", "topic_id");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_milestone_id_version_key" ON "submissions"("milestone_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "submissions_id_topic_id_key" ON "submissions"("id", "topic_id");

-- CreateIndex
CREATE UNIQUE INDEX "submission_files_attachment_id_key" ON "submission_files"("attachment_id");

-- CreateIndex
CREATE UNIQUE INDEX "evaluations_topic_id_version_key" ON "evaluations"("topic_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "similarity_corpora_version_key" ON "similarity_corpora"("version");

-- CreateIndex
CREATE UNIQUE INDEX "similarity_matches_check_id_rank_key" ON "similarity_matches"("check_id", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "similarity_matches_check_id_candidate_topic_id_key" ON "similarity_matches"("check_id", "candidate_topic_id");

-- CreateIndex
CREATE INDEX "notifications_recipient_id_created_at_idx" ON "notifications"("recipient_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_recipient_id_event_key_key" ON "notifications"("recipient_id", "event_key");

-- CreateIndex
CREATE INDEX "audit_logs_faculty_id_created_at_idx" ON "audit_logs"("faculty_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_id_created_at_idx" ON "audit_logs"("entity_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_actor_id_operation_idempotency_key_key" ON "idempotency_records"("actor_id", "operation", "idempotency_key");
