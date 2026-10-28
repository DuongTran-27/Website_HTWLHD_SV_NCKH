import { useState } from "react";
import {
  Link,
  NavLink,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Download,
  FileText,
  FolderOpen,
  Plus,
  Upload,
  Users,
  Clock3,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { useUser } from "./shell";
import { api, params } from "./api";
import {
  ActionForm,
  asIso,
  Badge,
  choices,
  date,
  dateInput,
  dateTime,
  Empty,
  ErrorBox,
  labels,
  Loading,
  Modal,
  PageHeading,
  Panel,
  QueryState,
  reasonField,
  SmartForm,
  useAction,
  useApi,
} from "./ui";
import { AuditTimeline } from "./pages";
const academicFields = [
  {
    name: "title",
    label: "Tên đề tài",
    full: true,
    minLength: 10,
    maxLength: 250,
  },
  { name: "fieldId", label: "Lĩnh vực nghiên cứu", type: "select" },
  ...Object.entries({
    abstract: ["Tóm tắt", 100, 5000],
    objectives: ["Mục tiêu nghiên cứu", 50, 5000],
    researchContent: ["Nội dung nghiên cứu", 200, 20000],
    methodology: ["Phương pháp nghiên cứu", 1, 10000],
    expectedOutcomes: ["Sản phẩm dự kiến", 1, 10000],
  }).map(([name, [label, min, max]]) => ({
    name,
    label,
    type: "textarea",
    required: false,
    maxLength: max,
    hint: `Khi gửi xét duyệt: tối thiểu ${min} ký tự, tối đa ${max.toLocaleString("vi-VN")} ký tự.`,
  })),
];
export function TopicEditor() {
  const { id } = useParams(),
    [search] = useSearchParams(),
    query = useApi(`/topics/${id}/workspace`, { enabled: !!id }),
    teams = useApi("/teams"),
    fields = useApi("/research-fields"),
    lecturers = useApi("/lecturers"),
    navigate = useNavigate();
  if (id && !query.data)
    return <QueryState query={query}>{() => null}</QueryState>;
  const options = academicFields.map((f) =>
      f.name === "fieldId" ? { ...f, options: choices(fields.data?.data) } : f,
    ),
    availableTeams =
      teams.data?.data?.filter((t) => t.status === "active" && !t.topic) ?? [];
  return (
    <TopicForm
      key={id ?? "new"}
      topic={query.data?.data}
      fields={options}
      teams={availableTeams}
      lecturers={lecturers.data?.data ?? []}
      selectedTeam={search.get("teamId")}
      onDone={(t) => navigate(`/topics/${t.id}`)}
    />
  );
}
function TopicForm({ topic, fields, teams, lecturers, selectedTeam, onDone }) {
  const user = useUser(),
    action = useAction(
      topic ? `/topics/${topic.id}` : "/topics",
      topic ? "PATCH" : "POST",
      onDone,
    );
  if (topic && !topic.actions?.edit)
    return (
      <Empty
        title="Hồ sơ hiện không được chỉnh sửa"
        description="Chỉ trưởng nhóm được sửa khi nháp hoặc cần chỉnh sửa."
      />
    );
  if (!topic && !teams.length)
    return (
      <Empty
        title="Cần có nhóm nghiên cứu trước"
        description="Tạo nhóm hoặc nhận lời mời trong đợt đăng ký đang mở."
      >
        <Link className="button primary" to="/teams">
          Đến nhóm nghiên cứu
        </Link>
      </Empty>
    );
  const allFields = [
    ...(!topic
      ? [
          {
            name: "teamId",
            label: "Nhóm thực hiện",
            type: "select",
            options: choices(teams),
          },
        ]
      : []),
    ...fields,
    {
      name: "proposedSupervisorId",
      label: "Giảng viên dự kiến",
      type: "select",
      options: choices(lecturers, "fullName"),
      required: false,
      hint: "Sau khi lưu, gửi đề nghị hướng dẫn để giảng viên xác nhận.",
    },
  ];
  return (
    <>
      <PageHeading
        title={topic ? "Chỉnh sửa hồ sơ" : "Đăng ký đề tài nghiên cứu"}
        description="Bắt đầu từ ý tưởng. Bạn có thể lưu nháp và hoàn thiện trước khi gửi xét duyệt."
      />
      <Panel
        title="Hồ sơ học thuật"
        description="Nội dung thay đổi sẽ cần giảng viên xác nhận hướng dẫn lại."
      >
        <SmartForm
          fields={allFields}
          defaults={topic ?? { teamId: selectedTeam ?? teams[0]?.id }}
          submit="Lưu hồ sơ nháp"
          pending={action.isPending}
          error={action.error}
          onSubmit={(v) => {
            const body = {
              ...v,
              ...(topic ? { revision: topic.revision } : {}),
            };
            if (!body.proposedSupervisorId) delete body.proposedSupervisorId;
            return action.mutateAsync(body);
          }}
        />
      </Panel>
    </>
  );
}
const tabs = [
  ["", "Tổng quan"],
  ["revisions", "Phiên bản hồ sơ"],
  ["similarity", "Đối chiếu"],
  ["milestones", "Mốc & tiến độ"],
  ["submissions", "Tài liệu & báo cáo"],
  ["reviews", "Nhận xét"],
  ["evaluations", "Kết quả"],
  ["requests", "Thay đổi & hủy"],
  ["history", "Lịch sử"],
];
export function Workspace() {
  const { id } = useParams(),
    location = useLocation(),
    query = useApi(`/topics/${id}/workspace`),
    tab = location.pathname.split("/")[3] ?? "";
  return (
    <QueryState query={query}>
      {(topic) => (
        <>
          <Link className="back-link" to="/my-topics">
            <ArrowLeft size={15} /> Danh sách đề tài
          </Link>
          <PageHeading
            eyebrow={topic.code}
            title={topic.title}
            description={`${topic.facultyName} · ${topic.periodName}`}
          >
            <Badge value={topic.status} />
            {topic.actions?.edit && (
              <Link to={`/topics/${id}/edit`} className="button secondary">
                Chỉnh sửa hồ sơ
              </Link>
            )}
          </PageHeading>
          {topic.historicalOnly && (
            <div className="info-note">
              <ShieldCheck size={18} /> Bạn đang xem lịch sử trong khoảng quyền
              được cấp. Nội dung hiện hành có thể khác phiên bản này.
            </div>
          )}
          <div className="workspace-summary">
            <span>
              <FolderOpen size={16} />
              {topic.fieldName}
            </span>
            <span>
              <Users size={16} />
              {topic.team?.name ?? topic.teamName}
            </span>
            <span>
              <ShieldCheck size={16} />
              {topic.supervisorName ?? "Chưa phân công hướng dẫn"}
            </span>
          </div>
          <nav className="tabs workspace-tabs">
            {tabs
              .filter(
                ([path]) =>
                  !(
                    ["similarity", "requests"].includes(path) &&
                    topic.historicalOnly
                  ),
              )
              .map(([path, title]) => (
                <NavLink
                  end
                  key={path}
                  to={`/topics/${id}${path ? "/" + path : ""}`}
                  className={({ isActive }) => (isActive ? "active" : "")}
                >
                  {title}
                </NavLink>
              ))}
          </nav>
          {tab === "" ? (
            <Overview topic={topic} />
          ) : tab === "revisions" ? (
            <Revisions topic={topic} />
          ) : tab === "similarity" ? (
            <Similarity topic={topic} />
          ) : tab === "milestones" ? (
            <Milestones topic={topic} />
          ) : tab === "submissions" ? (
            <Documents topic={topic} />
          ) : tab === "reviews" ? (
            <Reviews topic={topic} />
          ) : tab === "evaluations" ? (
            <Evaluations topic={topic} />
          ) : tab === "requests" ? (
            <Requests topic={topic} />
          ) : tab === "history" ? (
            <History topic={topic} />
          ) : (
            <Empty title="Không tìm thấy mục này" />
          )}
        </>
      )}
    </QueryState>
  );
}
function AcademicRead({ data }) {
  return (
    <div className="academic-content">
      {academicFields
        .filter((f) => !["title", "fieldId"].includes(f.name))
        .map((f) => (
          <section key={f.name}>
            <h3>{f.label}</h3>
            <p>{data[f.name] || "Chưa bổ sung nội dung."}</p>
          </section>
        ))}
    </div>
  );
}
function Overview({ topic }) {
  const user = useUser(),
    lecturers = useApi("/lecturers"),
    requests = useApi("/supervision-requests"),
    currentConsent = requests.data?.data?.find(
      (r) =>
        r.topicId === topic.id &&
        r.purpose === "initial" &&
        ["pending", "accepted"].includes(r.status),
    ),
    leader = topic.isLeader && !topic.historicalOnly,
    staff = topic.actions?.staff,
    lecturer = topic.actions?.lecturer;
  return (
    <div className="workspace-columns">
      <Panel
        title="Nội dung nghiên cứu"
        description={
          topic.historicalOnly
            ? "Phiên bản trong khoảng quyền của bạn"
            : "Hồ sơ học thuật hiện hành"
        }
      >
        <AcademicRead data={topic} />
      </Panel>
      <div className="workspace-side">
        <Panel title="Hành trình nghiên cứu">
          <ol className="journey">
            {[
              ["Chuẩn bị hồ sơ", ["draft", "revision_required"]],
              ["Xét duyệt", ["submitted"]],
              ["Triển khai", ["approved", "in_progress"]],
              ["Nghiệm thu", ["pending_evaluation"]],
              ["Hoàn thành", ["completed"]],
            ].map(([title, states], i) => (
              <li
                key={title}
                className={states.includes(topic.status) ? "current" : ""}
              >
                <span>{i + 1}</span>
                <div>
                  <strong>{title}</strong>
                  {states.includes(topic.status) && (
                    <small>Giai đoạn hiện tại</small>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Panel>
        {!topic.historicalOnly && (
          <Panel title="Thao tác hồ sơ">
            <div className="stack-actions">
              {leader &&
                ["draft", "revision_required"].includes(topic.status) && (
                  <>
                    <p className="muted">
                      Giảng viên cần xác nhận đúng nội dung hiện hành trước khi
                      gửi xét duyệt.
                    </p>
                    {currentConsent && (
                      <Badge value={currentConsent.status}>
                        Hướng dẫn: {labels[currentConsent.status]}
                      </Badge>
                    )}
                    {!currentConsent && (
                      <ActionForm
                        title="Đề nghị hướng dẫn"
                        path={`/topics/${topic.id}/supervision-requests`}
                        payload={{ revision: topic.revision }}
                        defaults={{ lecturerId: topic.proposedSupervisorId }}
                        fields={[
                          {
                            name: "lecturerId",
                            label: "Giảng viên hướng dẫn",
                            type: "select",
                            options: choices(lecturers.data?.data, "fullName"),
                          },
                        ]}
                      />
                    )}
                    <ActionForm
                      title="Gửi xét duyệt"
                      path={`/topics/${topic.id}/submit`}
                      payload={{ revision: topic.revision }}
                      description="Hệ thống kiểm tra dữ liệu, xác nhận hướng dẫn và tương tự; hồ sơ được chụp thành phiên bản bất biến khi gửi thành công."
                    />
                  </>
                )}
              {staff && topic.status === "submitted" && (
                <DecisionPanel topic={topic} />
              )}
              {(lecturer || staff) && topic.status === "approved" && (
                <ActionForm
                  title="Bắt đầu thực hiện"
                  path={`/topics/${topic.id}/start`}
                  payload={{ revision: topic.revision }}
                />
              )}
              {leader && topic.status === "in_progress" && (
                <ActionForm
                  title="Đề nghị nghiệm thu"
                  path={`/topics/${topic.id}/request-evaluation`}
                  payload={{ revision: topic.revision }}
                  description="Mọi mốc bắt buộc cần có bản hiện hành được chấp nhận, không có yêu cầu thay đổi/hủy đang chờ."
                />
              )}
              {lecturer && topic.status === "pending_evaluation" && (
                <ReturnForm topic={topic} />
              )}
              {staff &&
                !["completed", "rejected", "cancelled"].includes(
                  topic.status,
                ) && (
                  <ActionForm
                    title="Quyết định hủy đề tài"
                    path={`/topics/${topic.id}/cancel`}
                    payload={{ revision: topic.revision }}
                    fields={[reasonField]}
                    danger
                  />
                )}
              {!leader && !staff && !lecturer && (
                <p className="muted">
                  Theo dõi hồ sơ, nhật ký và phản hồi qua các mục trong không
                  gian làm việc.
                </p>
              )}
            </div>
          </Panel>
        )}
        {topic.team?.members?.length > 0 && (
          <Panel title="Nhóm thực hiện">
            <div className="member-list">
              {topic.team.members.map((m) => (
                <div key={m.id}>
                  <span className="avatar small">
                    {m.user.fullName.slice(-2)}
                  </span>
                  <div>
                    <strong>{m.user.fullName}</strong>
                    <small>
                      {m.studentId === topic.team.leaderId
                        ? "Trưởng nhóm"
                        : "Thành viên"}{" "}
                      · {m.user.accountCode}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
function DecisionPanel({ topic }) {
  const revisionQuery = useApi(`/topics/${topic.id}/revisions`),
    [reviewed, setReviewed] = useState(false),
    row = revisionQuery.data?.data?.find(
      (r) => r.id === topic.currentRevisionId,
    );
  return (
    <>
      <p className="muted">Quyết định áp dụng cho đúng phiên bản đã xem.</p>
      <QueryState query={revisionQuery}>
        {() =>
          row ? (
            <>
              <details
                className="snapshot-preview"
                onToggle={(e) => {
                  if (e.currentTarget.open) setReviewed(true);
                }}
              >
                <summary>
                  Xem hồ sơ gửi lần {row.version} · {dateTime(row.publishedAt)}
                </summary>
                <AcademicRead data={row.snapshot} />
              </details>
              {reviewed && (
                <>
                  <ActionForm
                    title="Phê duyệt hồ sơ"
                    path={`/topics/${topic.id}/decisions`}
                    payload={{
                      revision: topic.revision,
                      topicRevisionId: row.id,
                      action: "approve",
                    }}
                    fields={[
                      {
                        name: "warningJustification",
                        label: "Lý do chấp thuận nếu có cảnh báo tương tự",
                        type: "textarea",
                        required: false,
                        minLength: 0,
                        maxLength: 2000,
                      },
                    ]}
                    description="Mốc thực hiện được sao chép từ cấu hình đợt. Nếu có cảnh báo tương tự, lý do chấp thuận cần ít nhất 10 ký tự."
                  />
                  <ActionForm
                    title="Yêu cầu chỉnh sửa"
                    path={`/topics/${topic.id}/decisions`}
                    payload={{
                      revision: topic.revision,
                      topicRevisionId: row.id,
                      action: "request_revision",
                    }}
                    fields={[reasonField]}
                  />
                  <ActionForm
                    title="Từ chối hồ sơ"
                    path={`/topics/${topic.id}/decisions`}
                    payload={{
                      revision: topic.revision,
                      topicRevisionId: row.id,
                      action: "reject",
                    }}
                    fields={[reasonField]}
                    danger
                  />
                </>
              )}
            </>
          ) : (
            <p>Chưa có phiên bản để xét duyệt.</p>
          )
        }
      </QueryState>
    </>
  );
}
function ReturnForm({ topic }) {
  const milestones = useApi(`/topics/${topic.id}/milestones`);
  return (
    <ActionForm
      title="Yêu cầu tiếp tục chỉnh sửa"
      path={`/topics/${topic.id}/return-to-progress`}
      payload={{ revision: topic.revision }}
      fields={[
        reasonField,
        {
          name: "reopenMilestoneIds",
          label: "Mốc cần nộp lại",
          type: "multiselect",
          options: choices(milestones.data?.data),
          required: false,
        },
      ]}
    />
  );
}
function Revisions({ topic }) {
  const query = useApi(`/topics/${topic.id}/revisions`),
    [version, setVersion] = useState(null),
    detail = useApi(`/topics/${topic.id}/revisions/${version}`, {
      enabled: !!version,
    });
  return (
    <Panel
      title="Phiên bản hồ sơ"
      description="Mỗi lần gửi hoặc thay đổi đã duyệt tạo một bản chụp được giữ nguyên."
    >
      <QueryState query={query}>
        {(rows) =>
          rows.length ? (
            <div className="version-list">
              {rows.map((r) => (
                <div key={r.id}>
                  <div className="version-mark">V{r.version}</div>
                  <div>
                    <strong>{r.snapshot.title}</strong>
                    <small>
                      {r.kind === "submission"
                        ? "Hồ sơ gửi xét duyệt"
                        : "Thay đổi đã phê duyệt"}{" "}
                      · {dateTime(r.publishedAt)}
                    </small>
                  </div>
                  <button
                    className="button secondary"
                    onClick={() => setVersion(r.version)}
                  >
                    Xem phiên bản
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <Empty title="Chưa gửi hồ sơ" />
          )
        }
      </QueryState>
      {version && (
        <Modal
          title={`Hồ sơ phiên bản ${version}`}
          onClose={() => setVersion(null)}
        >
          <QueryState query={detail}>
            {(r) => (
              <>
                <h3>{r.snapshot.title}</h3>
                <p className="muted">
                  Nhóm: {r.snapshot.teamName} ·{" "}
                  {r.snapshot.members.map((m) => m.fullName).join(", ")}
                </p>
                <AcademicRead data={r.snapshot} />
                {r.files?.map((f) => (
                  <FileRow file={f} key={f.id} />
                ))}
              </>
            )}
          </QueryState>
        </Modal>
      )}
    </Panel>
  );
}
function Similarity({ topic }) {
  const allowed = topic.isLeader || topic.actions?.staff,
    query = useApi(`/topics/${topic.id}/similarity-checks`, {
      enabled: allowed,
    }),
    action = useAction(`/topics/${topic.id}/similarity-checks`);
  if (!allowed)
    return <Empty title="Chức năng dành cho trưởng nhóm và cán bộ khoa" />;
  return (
    <>
      <Panel
        title="Đối chiếu đề tài tương tự"
        description="So tên và nội dung nhập trong hồ sơ với những nghiên cứu đã được phê duyệt."
        action={
          <button
            className="button primary"
            disabled={action.isPending}
            onClick={() => action.mutate({ revision: topic.revision })}
          >
            {action.isPending ? "Đang đối chiếu…" : "Kiểm tra lại"}
          </button>
        }
      >
        <p className="info-note">
          Cảnh báo hỗ trợ người xét duyệt. Điểm tương tự không phải tỷ lệ đạo
          văn và không tự động từ chối đề tài.
        </p>
        {action.error && <ErrorBox error={action.error} />}
        <QueryState query={query}>
          {(rows) =>
            rows.length ? (
              <div className="similarity-history">
                {rows.map((check, index) => (
                  <section key={check.id}>
                    <div className="request-heading">
                      <div>
                        <h3>
                          {index === 0
                            ? "Kết quả gần nhất"
                            : "Lần đối chiếu trước"}
                        </h3>
                        <small>
                          {dateTime(check.createdAt)} ·{" "}
                          {check.purpose === "approve"
                            ? "Khi phê duyệt"
                            : check.purpose === "submit"
                              ? "Khi gửi hồ sơ"
                              : "Đối chiếu hồ sơ"}
                        </small>
                      </div>
                      <Badge
                        value={
                          check.hasWarning ? "changes_requested" : "accepted"
                        }
                      >
                        {check.hasWarning
                          ? "Có nội dung cần xem xét"
                          : "Không có cảnh báo vượt ngưỡng"}
                      </Badge>
                    </div>
                    {check.matches.length ? (
                      <div className="match-list">
                        {check.matches.map((m) => (
                          <div key={m.topicId}>
                            <div>
                              <small>{m.code}</small>
                              <strong>{m.title}</strong>
                            </div>
                            <div className="score-pair">
                              <span>
                                Tên{" "}
                                <strong>
                                  {(m.titleScore * 100).toFixed(1)}%
                                </strong>
                              </span>
                              <span>
                                Nội dung{" "}
                                <strong>
                                  {(m.contentScore * 100).toFixed(1)}%
                                </strong>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="muted">
                        Kho đối chiếu không có đề tài phù hợp để trả kết quả.
                      </p>
                    )}
                  </section>
                ))}
              </div>
            ) : (
              <Empty
                title="Chưa thực hiện đối chiếu"
                description="Kiểm tra trước khi gửi để chủ động rà soát ý tưởng."
              />
            )
          }
        </QueryState>
      </Panel>
    </>
  );
}
function Milestones({ topic }) {
  const user = useUser(),
    milestones = useApi(`/topics/${topic.id}/milestones`),
    progress = useApi(`/topics/${topic.id}/progress-updates`),
    member = topic.team?.members?.some(
      (m) => m.studentId === user.id && m.active,
    ),
    canProgress =
      member && topic.status === "in_progress" && !topic.historicalOnly;
  return (
    <>
      <Panel
        title="Mốc thực hiện"
        description="Tiến độ tự khai giúp theo dõi công việc; kết quả mốc do giảng viên xác nhận."
        action={
          topic.actions?.staff &&
          ["approved", "in_progress"].includes(topic.status) && (
            <ActionForm
              title="Thêm mốc thực hiện"
              button="Thêm mốc"
              path={`/topics/${topic.id}/milestones`}
              payload={{ revision: topic.revision }}
              defaults={{
                required: false,
                sortOrder: milestones.data?.data?.length ?? 3,
              }}
              transform={(values) => ({
                ...values,
                deadline: asIso(values.deadline),
              })}
              fields={[
                { name: "code", label: "Mã mốc", minLength: 2, maxLength: 30 },
                {
                  name: "name",
                  label: "Tên mốc",
                  minLength: 2,
                  maxLength: 200,
                },
                {
                  name: "deadline",
                  label: "Hạn hoàn thành",
                  type: "datetime-local",
                },
                {
                  name: "sortOrder",
                  label: "Thứ tự",
                  type: "number",
                  min: 0,
                  max: 100,
                },
                {
                  name: "required",
                  label: "Mốc bắt buộc",
                  type: "checkbox",
                  hint: "Phải đạt trước khi nghiệm thu",
                },
                {
                  name: "expectedOutput",
                  label: "Đầu ra dự kiến",
                  type: "textarea",
                  minLength: 10,
                  maxLength: 2000,
                },
              ]}
            />
          )
        }
      >
        <QueryState query={milestones}>
          {(rows) =>
            rows.length ? (
              <div className="milestone-list">
                {rows.map((m, i) => (
                  <article key={m.id}>
                    <div className="step-number">{i + 1}</div>
                    <div>
                      <div className="request-heading">
                        <h3>{m.name}</h3>
                        {m.resubmissionAllowed ? (
                          <Badge value="changes_requested">Đã mở lại</Badge>
                        ) : m.currentSubmission ? (
                          <Badge value={m.currentSubmission.status} />
                        ) : (
                          <Badge value="draft">Chưa nộp</Badge>
                        )}
                      </div>
                      <p>{m.expectedOutput}</p>
                      <small>
                        {m.deadline ? `Hạn: ${dateTime(m.deadline)} · ` : ""}
                        {m.required ? "Mốc bắt buộc" : "Mốc bổ sung"}
                      </small>
                      <div className="row-actions">
                        {topic.actions?.lecturer &&
                          topic.status === "in_progress" &&
                          m.currentSubmission?.status === "accepted" &&
                          !m.resubmissionAllowed && (
                            <ActionForm
                              title="Mở lại mốc"
                              path={`/milestones/${m.id}/reopen`}
                              payload={{ revision: m.revision }}
                              fields={[reasonField]}
                            />
                          )}{" "}
                        {topic.actions?.staff &&
                          ["approved", "in_progress"].includes(
                            topic.status,
                          ) && (
                            <ActionForm
                              title="Điều chỉnh mốc"
                              button="Điều chỉnh"
                              path={`/milestones/${m.id}`}
                              method="PATCH"
                              payload={{ revision: m.revision }}
                              defaults={{
                                name: m.name,
                                expectedOutput: m.expectedOutput,
                                deadline: dateInput(m.deadline),
                              }}
                              transform={(v) => ({
                                ...v,
                                deadline: asIso(v.deadline),
                              })}
                              fields={[
                                {
                                  name: "name",
                                  label: "Tên mốc",
                                  minLength: 2,
                                },
                                {
                                  name: "deadline",
                                  label: "Hạn hoàn thành",
                                  type: "datetime-local",
                                },
                                {
                                  name: "expectedOutput",
                                  label: "Đầu ra dự kiến",
                                  type: "textarea",
                                  minLength: 10,
                                },
                                reasonField,
                              ]}
                              onDone={() => {}}
                            />
                          )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <Empty
                title="Chưa có mốc thực hiện"
                description="Các mốc được tạo khi hồ sơ được phê duyệt."
              />
            )
          }
        </QueryState>
      </Panel>
      <Panel
        title="Nhật ký nghiên cứu"
        description="Ghi lại công việc, khó khăn và kế hoạch tiếp theo."
        action={
          canProgress && (
            <ActionForm
              title="Cập nhật tiến độ"
              path={`/topics/${topic.id}/progress-updates`}
              fields={[
                {
                  name: "selfReportedPercent",
                  label: "Tiến độ tự khai (%)",
                  type: "number",
                  min: 0,
                  max: 100,
                },
                {
                  name: "completedWork",
                  label: "Công việc đã hoàn thành",
                  type: "textarea",
                  minLength: 10,
                },
                {
                  name: "difficulties",
                  label: "Khó khăn",
                  type: "textarea",
                  required: false,
                },
                {
                  name: "nextPlan",
                  label: "Kế hoạch tiếp theo",
                  type: "textarea",
                  minLength: 10,
                },
              ]}
            />
          )
        }
      >
        <QueryState query={progress}>
          {(rows) =>
            rows.length ? (
              <div className="progress-list">
                {rows.map((p) => (
                  <article key={p.id}>
                    <div className="progress-meta">
                      <strong>
                        {p.selfReportedPercent}% <small>tự khai</small>
                      </strong>
                      <span>{dateTime(p.createdAt)}</span>
                    </div>
                    <div className="progress-track">
                      <span style={{ width: `${p.selfReportedPercent}%` }} />
                    </div>
                    <h4>Đã hoàn thành</h4>
                    <p>{p.completedWork}</p>
                    {p.difficulties && (
                      <>
                        <h4>Khó khăn</h4>
                        <p>{p.difficulties}</p>
                      </>
                    )}
                    <h4>Kế hoạch tiếp theo</h4>
                    <p>{p.nextPlan}</p>
                  </article>
                ))}
              </div>
            ) : (
              <Empty title="Chưa có nhật ký nghiên cứu" />
            )
          }
        </QueryState>
      </Panel>
    </>
  );
}
function FileRow({ file }) {
  const [error, setError] = useState(null),
    [pending, setPending] = useState(false);
  return (
    <div>
      <div className="file-row">
        <span className="file-icon">
          <FileText size={20} />
        </span>
        <div>
          <strong>{file.originalName}</strong>
          <small>
            {(file.sizeBytes / 1000000).toFixed(2)} MB ·{" "}
            <Badge value={file.status} />
          </small>
        </div>
        {file.status === "ready" && (
          <button
            className="icon-button"
            aria-label={`Tải ${file.originalName}`}
            disabled={pending}
            onClick={async () => {
              setPending(true);
              setError(null);
              try {
                const result = await api(
                  `/attachments/${file.id}/download-links`,
                  { method: "POST", body: {} },
                );
                const a = document.createElement("a");
                a.href = result.data.url;
                a.rel = "noopener noreferrer";
                a.target = "_blank";
                a.click();
              } catch (e) {
                setError(e);
              } finally {
                setPending(false);
              }
            }}
          >
            <Download size={18} />
          </button>
        )}
      </div>
      {error && <ErrorBox error={error} />}
    </div>
  );
}
function Documents({ topic }) {
  const user = useUser(),
    files = useApi(`/topics/${topic.id}/attachments`),
    milestones = useApi(`/topics/${topic.id}/milestones`),
    [purpose, setPurpose] = useState(
      ["draft", "revision_required"].includes(topic.status)
        ? "proposal"
        : "report",
    ),
    [error, setError] = useState(null),
    [pending, setPending] = useState(false),
    [selected, setSelected] = useState([]),
    [note, setNote] = useState(""),
    [milestoneId, setMilestoneId] = useState(""),
    member = topic.team?.members?.some(
      (m) => m.studentId === user.id && m.active,
    ),
    finalize = useAction(
      (v) => `/milestones/${v._milestoneId}/submissions`,
      "POST",
      () => {
        setSelected([]);
        setNote("");
      },
    ),
    proposalSubmit = useAction(`/topics/${topic.id}/submit`);
  const canUpload =
      member &&
      ["draft", "revision_required", "in_progress"].includes(topic.status) &&
      !topic.historicalOnly,
    currentMilestone = milestones.data?.data?.find((m) => m.id === milestoneId),
    readyFiles =
      files.data?.data?.filter(
        (f) =>
          f.status === "ready" &&
          ["report", "private_image"].includes(f.purpose),
      ) ?? [];
  return (
    <>
      <Panel
        title="Kho tài liệu của đề tài"
        description="Upload thành công là bước chuẩn bị. Báo cáo chỉ được ghi nhận khi hoàn tất nộp."
      >
        {canUpload && (
          <div className="upload-area">
            <Upload size={25} />
            <h3>Thêm tài liệu nghiên cứu</h3>
            <p>
              PDF, DOCX, XLSX, PPTX · tối đa 20 MB/tệp. Ảnh riêng tối đa 5 MB.
            </p>
            <div className="row-actions">
              <select
                aria-label="Loại tài liệu"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              >
                {["draft", "revision_required"].includes(topic.status) ? (
                  <option value="proposal">Tài liệu hồ sơ đăng ký</option>
                ) : (
                  <>
                    <option value="report">Báo cáo giai đoạn</option>
                    <option value="private_image">Ảnh nghiên cứu riêng</option>
                  </>
                )}
              </select>
              <label className={`button primary ${pending ? "disabled" : ""}`}>
                <Upload size={16} />
                {pending ? "Đang lưu tài liệu…" : "Chọn tệp để tải lên"}
                <input
                  type="file"
                  accept={
                    purpose === "private_image"
                      ? ".jpg,.jpeg,.png,.webp"
                      : ".pdf,.docx,.xlsx,.pptx"
                  }
                  disabled={pending}
                  hidden
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setError(null);
                    if (
                      file.size >
                      (purpose === "private_image" ? 5000000 : 20000000)
                    ) {
                      setError(new Error("Tệp vượt giới hạn dung lượng."));
                      return;
                    }
                    setPending(true);
                    const data = new FormData();
                    data.append("purpose", purpose);
                    data.append("file", file);
                    try {
                      await api(`/topics/${topic.id}/attachments`, {
                        method: "POST",
                        body: data,
                      });
                      await files.refetch();
                    } catch (err) {
                      setError(err);
                    } finally {
                      setPending(false);
                      e.target.value = "";
                    }
                  }}
                />
              </label>
            </div>
          </div>
        )}
        {error && <ErrorBox error={error} />}
        <QueryState query={files}>
          {(rows) =>
            rows.length ? (
              <div className="file-list">
                {rows.map((f) => (
                  <FileRow key={f.id} file={f} />
                ))}
              </div>
            ) : (
              <Empty
                title="Chưa có tài liệu"
                description="Tài liệu được lưu riêng và chỉ người được cấp quyền có thể tải."
              />
            )
          }
        </QueryState>
      </Panel>
      {canUpload && topic.status === "in_progress" && (
        <Panel
          title="Nộp báo cáo theo mốc"
          description="Chọn 1–5 tài liệu đã sẵn sàng. Nộp lại tạo phiên bản mới."
        >
          <label className="standalone-label">
            Mốc thực hiện
            <select
              value={milestoneId}
              onChange={(e) => setMilestoneId(e.target.value)}
            >
              <option value="">Chọn mốc cần nộp</option>
              {milestones.data?.data?.map((m) => (
                <option value={m.id} key={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <div className="check-list">
            {readyFiles.map((f) => (
              <label key={f.id}>
                <input
                  type="checkbox"
                  checked={selected.includes(f.id)}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, f.id]
                        : selected.filter((id) => id !== f.id),
                    )
                  }
                />
                {f.originalName}
              </label>
            ))}
          </div>
          <label className="standalone-label">
            Ghi chú
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </label>
          {finalize.error && <ErrorBox error={finalize.error} />}
          <button
            className="button primary"
            disabled={
              !currentMilestone ||
              selected.length < 1 ||
              selected.length > 5 ||
              finalize.isPending
            }
            onClick={() =>
              finalize.mutate({
                _milestoneId: milestoneId,
                milestoneRevision: currentMilestone.revision,
                attachmentIds: selected,
                note,
              })
            }
          >
            Hoàn tất nộp báo cáo
          </button>
        </Panel>
      )}
      {topic.isLeader &&
        ["draft", "revision_required"].includes(topic.status) && (
          <Panel
            title="Gửi hồ sơ kèm tài liệu"
            description="Các tài liệu đề xuất sẵn sàng sẽ được chụp cùng phiên bản gửi xét duyệt."
          >
            {proposalSubmit.error && <ErrorBox error={proposalSubmit.error} />}
            <button
              className="button primary"
              disabled={proposalSubmit.isPending}
              onClick={() =>
                proposalSubmit.mutate({
                  revision: topic.revision,
                  attachmentIds:
                    files.data?.data
                      ?.filter(
                        (f) => f.purpose === "proposal" && f.status === "ready",
                      )
                      .map((f) => f.id) ?? [],
                })
              }
            >
              Gửi hồ sơ và tài liệu xét duyệt
            </button>
          </Panel>
        )}
      <Panel title="Lịch sử nộp báo cáo">
        <QueryState query={milestones}>
          {(rows) =>
            rows.some((m) => m.submissions.length) ? (
              <div className="submission-history">
                {rows.map((m) => (
                  <section key={m.id}>
                    {m.submissions.length > 0 && <h3>{m.name}</h3>}
                    {m.submissions.map((s, i) => (
                      <article key={s.id}>
                        <div className="request-heading">
                          <strong>
                            Phiên bản {s.version} {i === 0 ? "· Hiện hành" : ""}
                          </strong>
                          <div>
                            <Badge value={s.status} />
                            {s.isLate && (
                              <Badge value="changes_requested">Nộp muộn</Badge>
                            )}
                          </div>
                        </div>
                        <small>
                          Nộp {dateTime(s.submittedAt)} · Hạn tại thời điểm nộp{" "}
                          {dateTime(s.deadlineSnapshot)}
                        </small>
                        {s.note && <p>{s.note}</p>}
                        {s.files.map((f) => (
                          <FileRow key={f.id} file={f} />
                        ))}
                      </article>
                    ))}
                  </section>
                ))}
              </div>
            ) : (
              <Empty title="Chưa có bản báo cáo được nộp" />
            )
          }
        </QueryState>
      </Panel>
    </>
  );
}
function Reviews({ topic }) {
  const query = useApi(`/topics/${topic.id}/milestones`);
  return (
    <Panel
      title="Nhận xét & phản hồi"
      description="Giảng viên nhận xét trên bản nộp hiện hành; lịch sử phản hồi được giữ nguyên."
    >
      <QueryState query={query}>
        {(rows) =>
          rows.some((m) => m.submissions.length) ? (
            rows.map((m) => (
              <section className="review-section" key={m.id}>
                {m.submissions.length > 0 && <h3>{m.name}</h3>}
                {m.submissions.map((s, i) => (
                  <article key={s.id}>
                    <div className="request-heading">
                      <div>
                        <strong>
                          Phiên bản {s.version}
                          {i === 0 ? " · Hiện hành" : ""}
                        </strong>
                        <small>{dateTime(s.submittedAt)}</small>
                      </div>
                      <Badge value={s.status} />
                    </div>
                    {s.files.map((f) => (
                      <FileRow file={f} key={f.id} />
                    ))}
                    {s.reviews.length ? (
                      <div className="review-list">
                        {s.reviews.map((r) => (
                          <div key={r.id}>
                            <Badge value={r.decision} />
                            <p>{r.comment}</p>
                            <small>{dateTime(r.createdAt)}</small>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="muted">Chưa có phản hồi của giảng viên.</p>
                    )}
                    {i === 0 &&
                      topic.actions?.lecturer &&
                      topic.status === "in_progress" && (
                        <ActionForm
                          title="Gửi nhận xét"
                          path={`/submissions/${s.id}/reviews`}
                          payload={{ submissionRevision: s.revision }}
                          fields={[
                            {
                              name: "decision",
                              label: "Quyết định",
                              type: "select",
                              options: (s.status === "accepted"
                                ? ["comment_only"]
                                : [
                                    "comment_only",
                                    "changes_requested",
                                    "accepted",
                                  ]
                              ).map((value) => ({
                                value,
                                label: labels[value],
                              })),
                            },
                            {
                              name: "comment",
                              label: "Nội dung nhận xét",
                              type: "textarea",
                              minLength: 10,
                            },
                          ]}
                        />
                      )}
                  </article>
                ))}
              </section>
            ))
          ) : (
            <Empty title="Chưa có báo cáo để nhận xét" />
          )
        }
      </QueryState>
    </Panel>
  );
}
function Evaluations({ topic }) {
  const query = useApi(`/topics/${topic.id}/evaluations`),
    evaluationFields = [
      {
        name: "result",
        label: "Kết quả đánh giá",
        type: "select",
        options: [
          { value: "passed", label: "Đạt" },
          { value: "failed", label: "Không đạt" },
        ],
      },
      {
        name: "score",
        label: "Điểm (tùy chọn)",
        type: "number",
        min: 0,
        max: 10,
        step: 0.01,
        required: false,
      },
      {
        name: "comment",
        label: "Nhận xét tổng kết",
        type: "textarea",
        minLength: 10,
      },
    ];
  return (
    <Panel
      title="Kết quả nghiên cứu"
      description="Kết quả do giảng viên lựa chọn; điểm số không tự quyết định đạt hay không đạt."
      action={
        <>
          {topic.actions?.lecturer && topic.status === "pending_evaluation" && (
            <ActionForm
              title="Đánh giá cuối"
              path={`/topics/${topic.id}/evaluations`}
              payload={{ revision: topic.revision }}
              fields={evaluationFields}
            />
          )}{" "}
          {topic.actions?.staff && topic.status === "completed" && (
            <ActionForm
              title="Sửa sai kết quả"
              path={`/topics/${topic.id}/evaluation-corrections`}
              payload={{ revision: topic.revision }}
              fields={[
                ...evaluationFields,
                {
                  ...reasonField,
                  name: "correctionReason",
                  label: "Lý do sửa sai",
                },
              ]}
            />
          )}
        </>
      }
    >
      <QueryState query={query}>
        {(rows) =>
          rows.length ? (
            <div className="evaluation-list">
              {rows.map((e, i) => (
                <article key={e.id}>
                  <div className="request-heading">
                    <div>
                      <small>
                        {i === 0 ? "KẾT QUẢ HIỆN HÀNH" : "LỊCH SỬ KẾT QUẢ"} ·
                        PHIÊN BẢN {e.version}
                      </small>
                      <h2>
                        {e.result === "passed"
                          ? "Đạt yêu cầu"
                          : "Không đạt yêu cầu"}
                      </h2>
                    </div>
                    {e.score !== null && (
                      <div className="evaluation-score">
                        {Number(e.score).toFixed(1)}
                        <small>/ 10</small>
                      </div>
                    )}
                  </div>
                  <p>{e.comment}</p>
                  {e.correctionReason && (
                    <div className="info-note">
                      Lý do sửa sai: {e.correctionReason}
                    </div>
                  )}
                  <small>{dateTime(e.createdAt)}</small>
                </article>
              ))}
            </div>
          ) : (
            <Empty
              title="Đề tài chưa có kết quả cuối"
              description="Kết quả được ghi nhận khi hoàn tất điều kiện nghiệm thu."
            />
          )
        }
      </QueryState>
    </Panel>
  );
}
function Requests({ topic }) {
  const changes = useApi(`/topics/${topic.id}/change-requests`),
    cancellations = useApi(`/topics/${topic.id}/cancellation-requests`),
    lecturers = useApi("/lecturers"),
    user = useUser(),
    [kind, setKind] = useState(null),
    [memberCode, setMemberCode] = useState(""),
    [search, setSearch] = useState(""),
    [added, setAdded] = useState([]),
    [removed, setRemoved] = useState([]),
    memberQuery = useApi(
      `/students/search?accountCode=${encodeURIComponent(search)}`,
      { enabled: search.length >= 3 && topic.isLeader },
    ),
    fields = useApi("/research-fields"),
    action = useAction(`/topics/${topic.id}/change-requests`, "POST", () => {
      setKind(null);
      setAdded([]);
      setRemoved([]);
    }),
    leader = topic.isLeader && !topic.historicalOnly,
    canChange = ["approved", "in_progress"].includes(topic.status),
    allCurrent = topic.team?.members ?? [];
  return (
    <>
      <Panel
        title="Yêu cầu thay đổi"
        description="Thay đổi sau phê duyệt cần cán bộ quyết định; thành viên hoặc giảng viên mới phải đồng ý trước."
        action={
          leader &&
          canChange && (
            <div className="row-actions">
              {["academic", "members", "supervisor"].map((k) => (
                <button
                  key={k}
                  className="button secondary"
                  onClick={() => setKind(k)}
                >
                  Đổi {labels[k].toLowerCase()}
                </button>
              ))}
            </div>
          )
        }
      >
        <QueryState query={changes}>
          {(rows) =>
            rows.length ? (
              <div className="request-list">
                {rows.map((r) => (
                  <article key={r.id}>
                    <div className="request-heading">
                      <h3>Thay đổi {labels[r.type].toLowerCase()}</h3>
                      <Badge value={r.status} />
                    </div>
                    <p>{r.reason}</p>
                    <small>{dateTime(r.createdAt)}</small>
                    {r.decisionReason && (
                      <p className="info-note">Phản hồi: {r.decisionReason}</p>
                    )}
                    {r.type === "academic" && (
                      <details>
                        <summary>Nội dung đề xuất thay đổi</summary>
                        <h3>{r.afterData.title}</h3>
                        <AcademicRead data={r.afterData} />
                      </details>
                    )}
                    {r.type === "members" && (
                      <div className="period-milestones">
                        {r.proposedMembers?.map((member) => (
                          <span key={member.id}>
                            <Users size={14} />
                            {member.fullName} · {member.accountCode}
                            {member.id === r.afterData.leaderId
                              ? " · Trưởng nhóm đề xuất"
                              : ""}
                          </span>
                        ))}
                      </div>
                    )}
                    {r.type === "supervisor" && (
                      <p>
                        Giảng viên đề xuất:{" "}
                        <strong>
                          {r.proposedSupervisor?.fullName ?? "Chưa xác định"}
                        </strong>
                      </p>
                    )}
                    {leader &&
                      r.status === "pending" &&
                      r.type === "supervisor" && (
                        <ActionForm
                          title="Mời giảng viên mới xác nhận"
                          path={`/topics/${topic.id}/supervision-requests`}
                          payload={{
                            revision: topic.revision,
                            lecturerId: r.afterData.supervisorId,
                            changeRequestId: r.id,
                          }}
                        />
                      )}
                    {leader &&
                      r.status === "pending" &&
                      r.type === "members" &&
                      r.afterData.memberIds
                        .filter(
                          (id) => !allCurrent.some((m) => m.studentId === id),
                        )
                        .map((id) => (
                          <ActionForm
                            key={id}
                            title="Gửi lời mời thành viên bổ sung"
                            button={`Mời ${r.proposedMembers?.find((member) => member.id === id)?.fullName ?? "thành viên bổ sung"}`}
                            path={`/teams/${topic.teamId}/invitations`}
                            payload={{
                              revision: topic.team.revision,
                              inviteeId: id,
                              changeRequestId: r.id,
                            }}
                          />
                        ))}
                    <div className="row-actions">
                      {leader &&
                        r.requestedBy === user.id &&
                        r.status === "pending" && (
                          <ActionForm
                            title="Rút yêu cầu"
                            path={`/change-requests/${r.id}/withdraw`}
                            payload={{ revision: r.revision }}
                          />
                        )}
                      {topic.actions?.staff && r.status === "pending" && (
                        <>
                          <ActionForm
                            title="Chấp thuận thay đổi"
                            path={`/change-requests/${r.id}/decisions`}
                            payload={{
                              revision: r.revision,
                              topicRevision: topic.revision,
                              decision: "approve",
                            }}
                            fields={[
                              reasonField,
                              {
                                name: "warningJustification",
                                label: "Giải trình cảnh báo tương tự (nếu có)",
                                type: "textarea",
                                required: false,
                              },
                            ]}
                          />
                          <ActionForm
                            title="Từ chối thay đổi"
                            path={`/change-requests/${r.id}/decisions`}
                            payload={{
                              revision: r.revision,
                              topicRevision: topic.revision,
                              decision: "reject",
                            }}
                            fields={[reasonField]}
                          />
                        </>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <Empty title="Chưa có yêu cầu thay đổi" />
            )
          }
        </QueryState>
      </Panel>
      <Panel
        title="Đề nghị hủy đề tài"
        description="Đề nghị đang chờ chưa đóng nhóm. Quyết định của cán bộ mới có hiệu lực."
        action={
          leader &&
          !["completed", "rejected", "cancelled"].includes(topic.status) && (
            <ActionForm
              title="Đề nghị hủy đề tài"
              path={`/topics/${topic.id}/cancellation-requests`}
              payload={{ revision: topic.revision }}
              fields={[reasonField]}
              danger
            />
          )
        }
      >
        <QueryState query={cancellations}>
          {(rows) =>
            rows.length ? (
              <div className="request-list">
                {rows.map((r) => (
                  <article key={r.id}>
                    <div className="request-heading">
                      <strong>{r.reason}</strong>
                      <Badge value={r.status} />
                    </div>
                    {r.decisionReason && <p>Phản hồi: {r.decisionReason}</p>}
                    <small>{dateTime(r.createdAt)}</small>
                    <div className="row-actions">
                      {leader && r.status === "pending" && (
                        <ActionForm
                          title="Rút đề nghị hủy"
                          path={`/cancellation-requests/${r.id}/withdraw`}
                          payload={{ revision: r.revision }}
                        />
                      )}
                      {topic.actions?.staff && r.status === "pending" && (
                        <>
                          <ActionForm
                            title="Chấp thuận hủy"
                            path={`/cancellation-requests/${r.id}/decisions`}
                            payload={{
                              revision: r.revision,
                              decision: "approve",
                            }}
                            fields={[reasonField]}
                            danger
                          />
                          <ActionForm
                            title="Từ chối đề nghị hủy"
                            path={`/cancellation-requests/${r.id}/decisions`}
                            payload={{
                              revision: r.revision,
                              decision: "reject",
                            }}
                            fields={[reasonField]}
                          />
                        </>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <Empty title="Chưa có đề nghị hủy" />
            )
          }
        </QueryState>
      </Panel>
      {kind && (
        <Modal
          title={`Đề nghị đổi ${labels[kind].toLowerCase()}`}
          onClose={() => setKind(null)}
        >
          {kind === "members" && (
            <>
              <p className="muted">
                Chọn thành viên giữ lại và tìm sinh viên bổ sung bằng mã chính
                xác. Thành viên mới cần nhận lời trước khi cán bộ áp dụng.
              </p>
              <div className="check-list">
                {allCurrent.map((m) => (
                  <label key={m.id}>
                    <input
                      type="checkbox"
                      checked={!removed.includes(m.studentId)}
                      onChange={(e) =>
                        setRemoved(
                          e.target.checked
                            ? removed.filter((id) => id !== m.studentId)
                            : [...removed, m.studentId],
                        )
                      }
                    />
                    {m.user.fullName}
                  </label>
                ))}
              </div>
              <div className="inline-search">
                <input
                  aria-label="Mã sinh viên bổ sung"
                  value={memberCode}
                  placeholder="Mã sinh viên bổ sung"
                  onChange={(e) => setMemberCode(e.target.value)}
                />
                <button
                  className="button secondary"
                  onClick={() => setSearch(memberCode)}
                >
                  Tìm
                </button>
              </div>
              {search && (
                <QueryState query={memberQuery}>
                  {(rows) =>
                    rows.map((s) => (
                      <div className="invitation-row" key={s.id}>
                        <span>
                          {s.fullName} · {s.accountCode}
                        </span>
                        <button
                          className="text-button"
                          disabled={
                            added.some((a) => a.id === s.id) ||
                            allCurrent.some((m) => m.studentId === s.id)
                          }
                          onClick={() => setAdded([...added, s])}
                        >
                          Thêm vào đề xuất
                        </button>
                      </div>
                    ))
                  }
                </QueryState>
              )}
              {added.map((s) => (
                <div className="invitation-row" key={s.id}>
                  <span>{s.fullName}</span>
                  <button
                    className="text-button"
                    onClick={() => setAdded(added.filter((a) => a.id !== s.id))}
                  >
                    Bỏ
                  </button>
                </div>
              ))}
            </>
          )}
          <SmartForm
            key={kind}
            fields={[
              ...(kind === "academic"
                ? academicFields.map((f) =>
                    f.name === "fieldId"
                      ? { ...f, options: choices(fields.data?.data) }
                      : f,
                  )
                : kind === "supervisor"
                  ? [
                      {
                        name: "supervisorId",
                        label: "Giảng viên mới",
                        type: "select",
                        options: choices(
                          lecturers.data?.data?.filter(
                            (l) => l.id !== topic.supervisorId,
                          ),
                          "fullName",
                        ),
                      },
                    ]
                  : [
                      {
                        name: "leaderId",
                        label: "Trưởng nhóm sau thay đổi",
                        type: "select",
                        options: [
                          ...allCurrent
                            .filter((m) => !removed.includes(m.studentId))
                            .map((m) => ({
                              value: m.studentId,
                              label: m.user.fullName,
                            })),
                          ...added.map((a) => ({
                            value: a.id,
                            label: a.fullName,
                          })),
                        ],
                      },
                    ]),
              reasonField,
            ]}
            defaults={
              kind === "academic" ? topic : { leaderId: topic.team?.leaderId }
            }
            pending={action.isPending}
            error={action.error}
            submit="Gửi đề nghị thay đổi"
            onSubmit={(v) => {
              const { reason, ...data } = v;
              return action.mutateAsync({
                revision: topic.revision,
                type: kind,
                reason,
                afterData:
                  kind === "members"
                    ? {
                        memberIds: [
                          ...allCurrent
                            .filter((m) => !removed.includes(m.studentId))
                            .map((m) => m.studentId),
                          ...added.map((a) => a.id),
                        ],
                        leaderId: data.leaderId,
                      }
                    : data,
              });
            }}
          />
        </Modal>
      )}
    </>
  );
}
function History({ topic }) {
  const query = useApi(`/topics/${topic.id}/audit-logs`),
    grants = useApi(`/topics/${topic.id}/access-grants`, {
      enabled: !!topic.actions?.staff,
    });
  return (
    <>
      <Panel
        title="Lịch sử xử lý"
        description="Dấu vết nghiệp vụ và các quyết định trong phạm vi được phép xem."
      >
        <QueryState query={query}>
          {(rows) => <AuditTimeline rows={rows} />}
        </QueryState>
      </Panel>
      {topic.actions?.staff && (
        <Panel
          title="Khoảng quyền đọc lịch sử"
          description="Quyền đọc tài liệu cũ tách khỏi việc chiếm chỗ tham gia nhóm."
        >
          <QueryState query={grants}>
            {(rows) =>
              rows.map((g) => (
                <div className="invitation-row" key={g.id}>
                  <div>
                    <strong>{g.student.fullName}</strong>
                    <small>
                      {dateTime(g.readableFrom)} →{" "}
                      {g.readableUntil
                        ? dateTime(g.readableUntil)
                        : "Hiện hành"}{" "}
                      ·{" "}
                      {g.revokedAt
                        ? "Đã thu hồi"
                        : g.retainedAfterLeave
                          ? "Giữ quyền lịch sử"
                          : "Quyền thành viên"}
                    </small>
                  </div>
                  {!g.revokedAt && (
                    <ActionForm
                      title="Thu hồi quyền lịch sử"
                      button="Thu hồi"
                      path={`/team-access-grants/${g.id}/revoke`}
                      fields={[reasonField]}
                      danger
                    />
                  )}
                </div>
              ))
            }
          </QueryState>
        </Panel>
      )}
    </>
  );
}
