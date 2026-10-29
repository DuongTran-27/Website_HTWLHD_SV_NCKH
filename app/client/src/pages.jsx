import { useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  FileText,
  FolderOpen,
  GraduationCap,
  Plus,
  Search,
  ShieldCheck,
  Users,
  Upload,
  FlaskConical,
} from "lucide-react";
import { useUser } from "./shell";
import { api, downloadCsv, params, session } from "./api";
import {
  ActionForm,
  Badge,
  choices,
  date,
  dateInput,
  dateTime,
  asIso,
  Empty,
  ErrorBox,
  Filters,
  labels,
  Loading,
  Modal,
  PageHeading,
  Pagination,
  Panel,
  QueryState,
  reasonField,
  SelectFilter,
  SmartForm,
  TopicTable,
  useAction,
  useApi,
} from "./ui";
const colors = [
  "#3159d7",
  "#94adf5",
  "#39ad99",
  "#edaf50",
  "#a993dc",
  "#ee8e82",
  "#8e9db1",
];
const roleChoices = ["student", "lecturer", "faculty_staff", "admin"].map(
  (value) => ({ value, label: labels[value] }),
);
export function Dashboard() {
  const user = useUser(),
    query = useApi("/dashboard"),
    today = new Intl.DateTimeFormat("vi-VN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date());
  return (
    <>
      <PageHeading
        eyebrow="TỔNG QUAN"
        title="Không gian nghiên cứu"
        description={today}
      >
        <Link className="button secondary" to="/repository">
          <Search size={17} /> Tra cứu đề tài
        </Link>
        {user.roles.includes("student") && (
          <Link className="button primary" to="/topics/new">
            <Plus size={18} /> Đăng ký đề tài
          </Link>
        )}
      </PageHeading>
      <section className="welcome-banner">
        <div>
          <span className="banner-eyebrow">
            <span className="status-dot" /> CÙNG BẠN TRÊN HÀNH TRÌNH KHÁM PHÁ
          </span>
          <h2>
            Chào {user.fullName.split(" ").slice(-2).join(" ")},<br />
            hôm nay bạn nghiên cứu điều gì?
          </h2>
          <p>
            Theo dõi ý tưởng, kết nối nhóm và đưa nghiên cứu tiến thêm một bước.
          </p>
          <Link to="/my-topics" className="banner-link">
            Đến không gian đề tài <ArrowRight size={17} />
          </Link>
        </div>
        <div className="banner-illustration" aria-hidden="true">
          <div className="banner-ring" />
          <div className="banner-flask">
            <FlaskConical size={63} />
          </div>
          <div className="banner-note">
            <span />
            <span />
            <span />
            <CheckCircle2 size={22} />
          </div>
          <div className="banner-spark">✦</div>
        </div>
      </section>
      <QueryState query={query}>
        {(data) => (
          <>
            <div className="stats-grid">
              {data.cards.map((card, i) => {
                const Icon = [FolderOpen, Clock3, CheckCircle2, Bell][i];
                return (
                  <section className="stat-card" key={card.label}>
                    <div>
                      <span>{card.label}</span>
                      <strong>{card.value.toLocaleString("vi-VN")}</strong>
                      <small>Dữ liệu trong phạm vi của bạn</small>
                    </div>
                    <div className={`stat-icon stat-${i}`}>
                      <Icon size={22} />
                    </div>
                  </section>
                );
              })}
            </div>
            <div className="dashboard-grid">
              <Panel
                title="Đề tài gần đây"
                description="Những nghiên cứu bạn đang theo dõi"
                action={
                  <Link className="text-button" to="/my-topics">
                    Xem tất cả <ArrowRight size={15} />
                  </Link>
                }
              >
                {data.recentTopics.length ? (
                  <div className="recent-list">
                    {data.recentTopics.map((t, i) => (
                      <Link
                        to={`/topics/${t.id}`}
                        className="recent-topic"
                        key={t.id}
                      >
                        <span className={`recent-icon color-${i % 3}`}>
                          <FileText size={21} />
                        </span>
                        <div>
                          <small>
                            {t.code} · {t.fieldName}
                          </small>
                          <strong>{t.title}</strong>
                          <span>
                            {t.supervisorName ?? "Chưa phân công giảng viên"}
                          </span>
                        </div>
                        <Badge value={t.status} />
                        <ChevronRight size={17} />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Empty
                    title={
                      data.kind === "admin"
                        ? "Quản trị không gian học thuật"
                        : "Bắt đầu nghiên cứu đầu tiên"
                    }
                    description={
                      data.kind === "admin"
                        ? "Quản lý tài khoản, phân quyền và danh mục từ thanh điều hướng."
                        : "Tạo nhóm, chuẩn bị hồ sơ và kết nối giảng viên hướng dẫn."
                    }
                  />
                )}
              </Panel>
              <Panel
                title="Phân bố trạng thái"
                description="Tình hình đề tài hiện tại"
              >
                {data.breakdown.length ? (
                  <>
                    <div className="donut-chart">
                      <ResponsiveContainer width="100%" height={205}>
                        <PieChart>
                          <Pie
                            isAnimationActive={false}
                            data={data.breakdown}
                            innerRadius={65}
                            outerRadius={87}
                            dataKey="value"
                            paddingAngle={4}
                          >
                            {data.breakdown.map((r, i) => (
                              <Cell
                                key={r.name}
                                fill={colors[i % colors.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(v, n, p) => [
                              v,
                              labels[p.payload.name] ?? p.payload.name,
                            ]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="donut-total">
                        <strong>{data.cards[0].value}</strong>
                        <span>đề tài</span>
                      </div>
                    </div>
                    <div className="chart-legend">
                      {data.breakdown.map((s, i) => (
                        <div key={s.name}>
                          <i
                            style={{ background: colors[i % colors.length] }}
                          />
                          <span>{labels[s.name] ?? s.name}</span>
                          <strong>{s.value}</strong>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <Empty description="Biểu đồ xuất hiện khi có đề tài trong phạm vi." />
                )}
              </Panel>
              <Panel
                title="Mốc thời gian sắp tới"
                description="Sắp đến hạn và các mốc cần hoàn thiện"
                action={<CalendarDays size={19} className="muted" />}
              >
                {data.deadlines.length ? (
                  <div className="deadline-list">
                    {data.deadlines.map((m) => (
                      <Link
                        key={m.id}
                        to={`/topics/${m.topicId}/milestones`}
                        className="deadline-row"
                      >
                        <div
                          className={`deadline-date ${new Date(m.deadline) < new Date() ? "late" : ""}`}
                        >
                          <strong>{new Date(m.deadline).getDate()}</strong>
                          <span>TH{new Date(m.deadline).getMonth() + 1}</span>
                        </div>
                        <div>
                          <strong>{m.name}</strong>
                          <p>
                            {m.topicCode} · {m.topicTitle}
                          </p>
                          <small>
                            {new Date(m.deadline) < new Date()
                              ? "Đã quá hạn"
                              : "Hạn nộp"}{" "}
                            · {dateTime(m.deadline)}
                          </small>
                        </div>
                        <ChevronRight size={17} />
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Empty
                    title="Bạn đã theo kịp kế hoạch"
                    description="Chưa có mốc cần hoàn thiện trong phạm vi hiện tại."
                  />
                )}
              </Panel>
              <Panel
                title="Truy cập nhanh"
                description="Tiếp tục công việc của bạn"
              >
                <div className="quick-links">
                  {[
                    {
                      to: "/periods",
                      icon: CalendarDays,
                      title: "Đợt đăng ký",
                      text: "Xem thời hạn và yêu cầu",
                    },
                    {
                      to: user.roles.includes("faculty_staff")
                        ? "/queue"
                        : user.roles.includes("lecturer")
                          ? "/supervision"
                          : "/teams",
                      icon: Users,
                      title: user.roles.includes("faculty_staff")
                        ? "Hồ sơ chờ duyệt"
                        : user.roles.includes("lecturer")
                          ? "Đề nghị hướng dẫn"
                          : "Nhóm nghiên cứu",
                      text: "Kết nối và cùng nhau thực hiện",
                    },
                    {
                      to: "/notifications",
                      icon: Bell,
                      title: "Thông báo của bạn",
                      text: "Cập nhật phản hồi và nhắc hạn",
                    },
                  ].map((x) => (
                    <Link to={x.to} key={x.to}>
                      <x.icon size={20} />
                      <div>
                        <strong>{x.title}</strong>
                        <small>{x.text}</small>
                      </div>
                      <ArrowUpRight size={17} />
                    </Link>
                  ))}
                </div>
                <div className="insight-note">
                  <span>GÓC NHẮC NHỎ</span>
                  <p>
                    Mỗi bước tiến đều đáng ghi nhận. Đừng quên cập nhật nhật ký
                    nghiên cứu của nhóm.
                  </p>
                </div>
              </Panel>
            </div>
          </>
        )}
      </QueryState>
    </>
  );
}

export function TopicList({ mode = "repository" }) {
  const [searchParams] = useSearchParams(),
    [filters, setFilters] = useState({
      search: searchParams.get("search") ?? "",
      page: 1,
      status: mode === "queue" ? "submitted" : "",
    }),
    fields = useApi("/research-fields"),
    periods = useApi("/research-periods"),
    faculties = useApi("/faculties");
  const query = useApi(
      `${mode === "repository" ? "/topics" : "/me/topics"}?${params(filters)}`,
    ),
    user = useUser();
  return (
    <>
      <PageHeading
        eyebrow={mode === "queue" ? "XÉT DUYỆT HỒ SƠ" : "NGHIÊN CỨU KHOA HỌC"}
        title={
          mode === "repository"
            ? "Kho đề tài nghiên cứu"
            : mode === "queue"
              ? "Hàng chờ xét duyệt"
              : "Đề tài của tôi"
        }
        description={
          mode === "repository"
            ? "Khám phá các nghiên cứu đã được phê duyệt và chia sẻ thông tin học thuật."
            : "Quản lý hồ sơ và theo dõi toàn bộ hành trình thực hiện."
        }
      >
        {mode === "mine" && user.roles.includes("student") && (
          <Link className="button primary" to="/topics/new">
            <Plus size={18} /> Đăng ký đề tài
          </Link>
        )}
      </PageHeading>
      <Panel
        title={mode === "repository" ? "Khám phá tri thức" : "Danh sách đề tài"}
        description="Tìm kiếm và lọc theo phạm vi bạn quan tâm"
      >
        <Filters filters={filters} setFilters={setFilters}>
          <SelectFilter
            label="Trạng thái"
            value={filters.status}
            options={(mode === "repository"
              ? ["approved", "in_progress", "pending_evaluation", "completed"]
              : [
                  "draft",
                  "submitted",
                  "revision_required",
                  "approved",
                  "in_progress",
                  "pending_evaluation",
                  "completed",
                  "rejected",
                  "cancelled",
                ]
            ).map((value) => ({ value, label: labels[value] }))}
            onChange={(status) => setFilters({ ...filters, status, page: 1 })}
          />
          <SelectFilter
            label="Lĩnh vực"
            value={filters.fieldId}
            options={choices(fields.data?.data)}
            onChange={(fieldId) => setFilters({ ...filters, fieldId, page: 1 })}
          />
          <SelectFilter
            label="Đợt nghiên cứu"
            value={filters.periodId}
            options={choices(periods.data?.data)}
            onChange={(periodId) =>
              setFilters({ ...filters, periodId, page: 1 })
            }
          />
          <SelectFilter
            label="Khoa"
            value={filters.facultyId}
            options={choices(faculties.data?.data)}
            onChange={(facultyId) =>
              setFilters({ ...filters, facultyId, page: 1 })
            }
          />
        </Filters>
        <QueryState query={query}>
          {(rows, meta) => (
            <>
              <TopicTable rows={rows} workspace={mode !== "repository"} />
              <Pagination
                meta={meta}
                onPage={(page) => setFilters({ ...filters, page })}
              />
            </>
          )}
        </QueryState>
      </Panel>
    </>
  );
}
export function RepositoryDetail() {
  const { id } = useParams(),
    query = useApi(`/topics/${id}`);
  return (
    <QueryState query={query}>
      {(t) => (
        <>
          <PageHeading
            title={t.title}
            eyebrow={t.code}
            description={`${t.facultyName} · ${t.periodName}`}
          >
            <Badge value={t.status} />
          </PageHeading>
          <Panel title="Thông tin học thuật được chia sẻ">
            <dl className="details-grid">
              <div>
                <dt>Lĩnh vực</dt>
                <dd>{t.fieldName}</dd>
              </div>
              <div>
                <dt>Giảng viên hướng dẫn</dt>
                <dd>{t.supervisorName ?? "Chưa phân công"}</dd>
              </div>
              <div>
                <dt>Ngày phê duyệt</dt>
                <dd>{date(t.approvedAt)}</dd>
              </div>
              <div>
                <dt>Ngày hoàn thành</dt>
                <dd>{date(t.completedAt)}</dd>
              </div>
            </dl>
            <p className="info-note">
              Kho tra cứu chia sẻ thông tin khái quát. Thành viên và người được
              phân công có thể mở không gian làm việc để xem hồ sơ và tài liệu
              theo quyền.
            </p>
            <Link to={`/topics/${id}`} className="button secondary">
              Mở không gian làm việc <ArrowUpRight size={16} />
            </Link>
          </Panel>
        </>
      )}
    </QueryState>
  );
}

export function Periods() {
  const query = useApi("/research-periods"),
    user = useUser();
  return (
    <>
      <PageHeading
        title="Đợt đăng ký nghiên cứu"
        description="Lựa chọn đợt phù hợp và chuẩn bị hồ sơ trước thời hạn."
      >
        {user.roles.includes("faculty_staff") && (
          <Link to="/periods/new" className="button primary">
            <Plus size={18} /> Mở đợt đăng ký
          </Link>
        )}
      </PageHeading>
      <QueryState query={query}>
        {(rows) =>
          rows.length ? (
            <div className="period-grid">
              {rows.map((p) => (
                <Panel
                  key={p.id}
                  title={p.name}
                  action={<Badge value={p.status} />}
                  description={`Năm học ${p.academicYear}`}
                >
                  <dl className="period-details">
                    <div>
                      <CalendarDays size={17} />
                      <span>
                        Đăng ký từ <strong>{date(p.registrationStart)}</strong>
                      </span>
                    </div>
                    <div>
                      <Clock3 size={17} />
                      <span>
                        Hạn đăng ký{" "}
                        <strong>{dateTime(p.registrationEnd)}</strong>
                      </span>
                    </div>
                    <div>
                      <Users size={17} />
                      <span>
                        Quy mô nhóm{" "}
                        <strong>
                          {p.minMembers}–{p.maxMembers} sinh viên
                        </strong>
                      </span>
                    </div>
                  </dl>
                  <div className="period-milestones">
                    {p.milestoneTemplates.map((m) => (
                      <span key={m.code}>
                        <CheckCircle2 size={13} />
                        {m.name}
                      </span>
                    ))}
                  </div>
                  <div className="row-actions">
                    {user.roles.includes("student") &&
                      p.status === "open" &&
                      new Date(p.registrationEnd) > new Date() && (
                        <Link
                          className="button primary"
                          to={`/teams?periodId=${p.id}`}
                        >
                          Tạo nhóm tham gia <ArrowRight size={15} />
                        </Link>
                      )}
                    {user.roles.includes("faculty_staff") &&
                      user.scopes.includes(p.facultyId) && (
                        <Link
                          className="button secondary"
                          to={`/periods/${p.id}/edit`}
                        >
                          Cấu hình đợt
                        </Link>
                      )}
                  </div>
                </Panel>
              ))}
            </div>
          ) : (
            <Empty title="Chưa có đợt đăng ký" />
          )
        }
      </QueryState>
    </>
  );
}
export function PeriodEditor() {
  const { id } = useParams(),
    user = useUser(),
    query = useApi(`/research-periods/${id}`, { enabled: !!id }),
    faculties = useApi("/faculties"),
    navigate = useNavigate();
  if (!user.roles.includes("faculty_staff"))
    return <Empty title="Bạn không có quyền cấu hình đợt" />;
  if (id && !query.data)
    return <QueryState query={query}>{() => null}</QueryState>;
  return (
    <PeriodForm
      key={id ?? "new"}
      period={query.data?.data}
      faculties={faculties.data?.data ?? []}
      onDone={() => navigate("/periods")}
    />
  );
}
function PeriodForm({ period, faculties, onDone }) {
  const user = useUser(),
    base = Date.now(),
    [templates, setTemplates] = useState(
      period?.milestoneTemplates ??
        ["Đề cương nghiên cứu", "Báo cáo giữa kỳ", "Báo cáo tổng kết"].map(
          (name, i) => ({
            code: ["OUTLINE", "MIDTERM", "FINAL"][i],
            name,
            required: true,
            expectedOutput:
              "Báo cáo và kết quả thực hiện của giai đoạn nghiên cứu.",
            deadline: new Date(base + (30 + i * 30) * 86400000).toISOString(),
            sortOrder: i,
          }),
        ),
    ),
    action = useAction(
      period ? `/research-periods/${period.id}` : "/research-periods",
      period ? "PATCH" : "POST",
      onDone,
    );
  const initialTemplates = useRef(JSON.stringify(templates));
  const fields = [
    ...(!period
      ? [
          {
            name: "facultyId",
            label: "Khoa",
            type: "select",
            options: choices(
              faculties.filter((f) => user.scopes.includes(f.id)),
            ),
          },
        ]
      : []),
    { name: "name", label: "Tên đợt", full: true, minLength: 5 },
    { name: "academicYear", label: "Năm học", placeholder: "2026-2027" },
    {
      name: "status",
      label: "Trạng thái",
      type: "select",
      options: ["open", "closed"].map((value) => ({
        value,
        label: labels[value],
      })),
    },
    {
      name: "registrationStart",
      label: "Bắt đầu đăng ký",
      type: "datetime-local",
    },
    {
      name: "registrationEnd",
      label: "Kết thúc đăng ký",
      type: "datetime-local",
    },
    {
      name: "minMembers",
      label: "Thành viên tối thiểu",
      type: "number",
      min: 1,
      max: 20,
    },
    {
      name: "maxMembers",
      label: "Thành viên tối đa",
      type: "number",
      min: 1,
      max: 20,
    },
    ...(period ? [reasonField] : []),
  ];
  return (
    <>
      <PageHeading
        title={period ? "Cấu hình đợt nghiên cứu" : "Mở đợt nghiên cứu"}
        description="Quy định thời hạn, quy mô nhóm và đầu ra cho từng giai đoạn."
      />
      <Panel title="Thông tin đợt">
        <SmartForm
          fields={fields}
          externalDirty={JSON.stringify(templates) !== initialTemplates.current}
          defaults={
            period
              ? {
                  ...period,
                  registrationStart: dateInput(period.registrationStart),
                  registrationEnd: dateInput(period.registrationEnd),
                }
              : {
                  academicYear: "2026-2027",
                  status: "open",
                  minMembers: 1,
                  maxMembers: 3,
                }
          }
          pending={action.isPending}
          error={action.error}
          onSubmit={(values) =>
            action.mutateAsync({
              ...values,
              registrationStart: asIso(values.registrationStart),
              registrationEnd: asIso(values.registrationEnd),
              milestoneTemplates: templates.map((m, index) => ({
                ...m,
                sortOrder: index,
              })),
              ...(period ? { revision: period.revision } : {}),
            })
          }
        >
          <h3 className="form-section-title">Các mốc thực hiện mặc định</h3>
          <div className="template-list">
            {templates.map((m, i) => (
              <div key={m.code} className="template-item">
                <span className="step-number">{i + 1}</span>
                <div>
                  <label>
                    Tên mốc
                    <input
                      aria-label={`Tên mốc ${i + 1}`}
                      value={m.name}
                      onChange={(e) =>
                        setTemplates(
                          templates.map((x, j) =>
                            j === i ? { ...x, name: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Đầu ra dự kiến
                    <textarea
                      aria-label={`Đầu ra mốc ${i + 1}`}
                      value={m.expectedOutput}
                      onChange={(e) =>
                        setTemplates(
                          templates.map((x, j) =>
                            j === i
                              ? { ...x, expectedOutput: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      aria-label={`Bắt buộc mốc ${i + 1}`}
                      checked={m.required}
                      disabled={
                        m.required &&
                        templates.filter((x) => x.required).length <= 3
                      }
                      onChange={(event) =>
                        setTemplates(
                          templates.map((x, j) =>
                            j === i
                              ? { ...x, required: event.target.checked }
                              : x,
                          ),
                        )
                      }
                    />
                    Mốc bắt buộc trước nghiệm thu
                  </label>
                </div>
                <label>
                  Hạn hoàn thành
                  <input
                    aria-label={`Hạn mốc ${i + 1}`}
                    type="datetime-local"
                    value={dateInput(m.deadline)}
                    onChange={(e) =>
                      e.target.value &&
                      setTemplates(
                        templates.map((x, j) =>
                          j === i
                            ? { ...x, deadline: asIso(e.target.value) }
                            : x,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    className="text-button"
                    disabled={
                      templates.length <= 3 ||
                      (m.required &&
                        templates.filter((x) => x.required).length <= 3)
                    }
                    onClick={() =>
                      setTemplates(templates.filter((_, index) => index !== i))
                    }
                  >
                    Bỏ mốc này
                  </button>
                </label>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="button secondary"
            disabled={templates.length >= 20}
            onClick={() =>
              setTemplates([
                ...templates,
                {
                  code: `EXTRA_${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
                  name: "Mốc nghiên cứu bổ sung",
                  required: false,
                  expectedOutput:
                    "Báo cáo và minh chứng của mốc nghiên cứu bổ sung.",
                  deadline: new Date(
                    Date.now() + (templates.length + 1) * 30 * 86400000,
                  ).toISOString(),
                  sortOrder: templates.length,
                },
              ])
            }
          >
            <Plus size={16} /> Thêm mốc mẫu
          </button>
        </SmartForm>
      </Panel>
    </>
  );
}

export function Teams() {
  const user = useUser(),
    query = useApi("/teams"),
    invites = useApi("/team-invitations"),
    periods = useApi("/research-periods"),
    [searchParams] = useSearchParams();
  return (
    <>
      <PageHeading
        title="Nhóm nghiên cứu"
        description="Cùng cộng tác, phân chia công việc và phát triển ý tưởng."
      >
        {user.roles.includes("student") && (
          <ActionForm
            title="Tạo nhóm nghiên cứu"
            button="Tạo nhóm mới"
            path="/teams"
            fields={[
              { name: "name", label: "Tên nhóm", minLength: 3, full: true },
              {
                name: "periodId",
                label: "Đợt nghiên cứu",
                type: "select",
                options: choices(
                  periods.data?.data?.filter(
                    (p) =>
                      p.facultyId === user.facultyId && p.status === "open",
                  ),
                ),
              },
            ]}
            defaults={{ periodId: searchParams.get("periodId") ?? "" }}
          />
        )}
      </PageHeading>
      <QueryState query={invites}>
        {(rows) => {
          const incoming = rows.filter(
            (i) => i.inviteeId === user.id && i.status === "pending",
          );
          return incoming.length ? (
            <Panel
              title="Lời mời dành cho bạn"
              description="Đồng ý lời mời để tham gia nhóm. Lời mời đang chờ chưa giữ chỗ."
            >
              {incoming.map((i) => (
                <div className="invitation-row" key={i.id}>
                  <div>
                    <strong>{i.team?.name}</strong>
                    <small>Hết hạn {dateTime(i.expiresAt)}</small>
                  </div>
                  <ActionForm
                    title="Đồng ý tham gia"
                    path={`/team-invitations/${i.id}/respond`}
                    payload={{ revision: i.revision, decision: "accept" }}
                    description="Hệ thống sẽ kiểm tra lại chỗ tham gia và số thành viên khi bạn đồng ý."
                  />
                  <ActionForm
                    title="Từ chối lời mời"
                    path={`/team-invitations/${i.id}/respond`}
                    payload={{ revision: i.revision, decision: "decline" }}
                    fields={[{ ...reasonField, required: false, minLength: 0 }]}
                  />
                </div>
              ))}
            </Panel>
          ) : null;
        }}
      </QueryState>
      <QueryState query={query}>
        {(rows) =>
          rows.length ? (
            <div className="teams-grid">
              {rows.map((team) => (
                <TeamCard key={team.id} team={team} />
              ))}
            </div>
          ) : (
            <Empty
              title="Bạn chưa tham gia nhóm nào"
              description="Tạo một nhóm trong đợt đang mở hoặc nhận lời mời từ trưởng nhóm."
            />
          )
        }
      </QueryState>
    </>
  );
}
function TeamCard({ team }) {
  const user = useUser(),
    leader = team.leaderId === user.id,
    canEdit =
      leader &&
      team.status === "active" &&
      (!team.topic ||
        ["draft", "revision_required"].includes(team.topic.status)),
    [code, setCode] = useState(""),
    [searchCode, setSearchCode] = useState(""),
    search = useApi(
      `/students/search?accountCode=${encodeURIComponent(searchCode)}`,
      { enabled: searchCode.length >= 3 },
    );
  return (
    <Panel
      title={team.name}
      description={`${team.members.filter((m) => m.active).length} thành viên hiện hành`}
      action={<Badge value={team.status} />}
    >
      <div className="member-list">
        {team.members.map((m) => (
          <div key={m.id}>
            <span className="avatar small">{m.user?.fullName.slice(-2)}</span>
            <div>
              <strong>{m.user?.fullName}</strong>
              <small>
                {m.user?.accountCode} ·{" "}
                {m.active
                  ? m.studentId === team.leaderId
                    ? "Trưởng nhóm"
                    : "Thành viên"
                  : "Đã rời nhóm"}
              </small>
            </div>
            {canEdit && m.active && m.studentId !== user.id && (
              <>
                <ActionForm
                  title="Chuyển trưởng nhóm"
                  button="Chuyển quyền"
                  path={`/teams/${team.id}/transfer-leadership`}
                  payload={{
                    revision: team.revision,
                    newLeaderId: m.studentId,
                  }}
                />
                <ActionForm
                  title="Loại thành viên"
                  button="Loại"
                  path={(v) =>
                    `/teams/${team.id}/members/${m.studentId}?${params({ revision: team.revision, reason: v.reason })}`
                  }
                  method="DELETE"
                  fields={[reasonField]}
                />
              </>
            )}
          </div>
        ))}
      </div>
      {team.topic && (
        <Link className="linked-topic" to={`/topics/${team.topic.id}`}>
          <FileText size={18} />
          {team.topic.title}
          <ArrowUpRight size={16} />
        </Link>
      )}
      {canEdit && (
        <>
          <form
            className="inline-search"
            onSubmit={(e) => {
              e.preventDefault();
              setSearchCode(code);
            }}
          >
            <input
              aria-label={`Mã sinh viên mời vào ${team.name}`}
              placeholder="Nhập chính xác mã sinh viên"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button className="button secondary">Tìm thành viên</button>
          </form>
          {searchCode && (
            <QueryState query={search}>
              {(rows) =>
                rows.length ? (
                  rows.map((s) => (
                    <div className="invitation-row" key={s.id}>
                      <span>
                        {s.fullName} · {s.accountCode}
                      </span>
                      <ActionForm
                        title="Gửi lời mời"
                        path={`/teams/${team.id}/invitations`}
                        payload={{ revision: team.revision, inviteeId: s.id }}
                      />
                    </div>
                  ))
                ) : (
                  <p className="muted">
                    Không tìm thấy sinh viên cùng khoa có mã này.
                  </p>
                )
              }
            </QueryState>
          )}
          {team.invitations
            .filter((i) => i.status === "pending")
            .map((i) => (
              <div key={i.id} className="invitation-row">
                <small>Lời mời đang chờ · {date(i.expiresAt)}</small>
                <ActionForm
                  title="Thu hồi lời mời"
                  button="Thu hồi"
                  path={`/team-invitations/${i.id}/cancel`}
                  payload={{ revision: i.revision }}
                />
              </div>
            ))}
        </>
      )}
      <div className="row-actions">
        {canEdit && (
          <ActionForm
            title="Đổi tên nhóm"
            button="Đổi tên"
            path={`/teams/${team.id}`}
            method="PATCH"
            fields={[{ name: "name", label: "Tên nhóm", minLength: 3 }]}
            defaults={{ name: team.name }}
            payload={{ revision: team.revision }}
          />
        )}
        {canEdit && !team.topic && (
          <>
            <Link
              className="button primary"
              to={`/topics/new?teamId=${team.id}`}
            >
              Tạo hồ sơ đề tài
            </Link>
            <ActionForm
              title="Đóng nhóm"
              path={`/teams/${team.id}/close`}
              payload={{ revision: team.revision }}
              fields={[reasonField]}
              danger
            />
          </>
        )}
        {!leader &&
          team.status === "active" &&
          (!team.topic ||
            ["draft", "revision_required"].includes(team.topic.status)) && (
            <ActionForm
              title="Rời nhóm"
              path={`/teams/${team.id}/leave`}
              payload={{ revision: team.revision }}
              description="Bạn sẽ mất quyền đọc tài liệu riêng của nhóm trước duyệt."
              danger
            />
          )}
      </div>
    </Panel>
  );
}

export function Notifications() {
  const [page, setPage] = useState(1),
    [unread, setUnread] = useState(false),
    query = useApi(
      `/notifications?${params({ page, unread: unread ? "true" : "" })}`,
      { refetchInterval: 60000 },
    ),
    readAll = useAction("/notifications/read-all"),
    read = useAction((v) => `/notifications/${v.id}`, "PATCH");
  return (
    <>
      <PageHeading
        title="Thông báo"
        description="Phản hồi, thay đổi hồ sơ và những mốc thời gian bạn cần biết."
      >
        <button
          className="button secondary"
          disabled={readAll.isPending}
          onClick={() => readAll.mutate({})}
        >
          <Check size={17} /> Đánh dấu tất cả đã đọc
        </button>
      </PageHeading>
      <Panel
        title="Hộp thông báo"
        action={
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={unread}
              onChange={(e) => {
                setUnread(e.target.checked);
                setPage(1);
              }}
            />
            Chỉ chưa đọc
          </label>
        }
      >
        {(read.error || readAll.error) && (
          <ErrorBox error={read.error ?? readAll.error} />
        )}
        <QueryState query={query}>
          {(rows, meta) => (
            <>
              {rows.length ? (
                <div className="notification-list">
                  {rows.map((n) => (
                    <article key={n.id} className={n.readAt ? "" : "unread"}>
                      <span className="notification-icon">
                        <Bell size={19} />
                      </span>
                      <div>
                        <strong>{n.title}</strong>
                        <p>{n.body}</p>
                        <small>{dateTime(n.createdAt)}</small>
                      </div>
                      {!n.readAt && (
                        <button
                          className="text-button"
                          onClick={() => read.mutate({ id: n.id, read: true })}
                        >
                          Đã đọc
                        </button>
                      )}
                      {n.entityType === "topic" && n.entityId && (
                        <Link
                          className="icon-button"
                          aria-label="Mở hồ sơ"
                          to={`/topics/${n.entityId}`}
                        >
                          <ArrowUpRight size={18} />
                        </Link>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <Empty title="Chưa có thông báo" />
              )}
              <Pagination meta={meta} onPage={setPage} />
            </>
          )}
        </QueryState>
      </Panel>
    </>
  );
}
export function Profile() {
  const user = useUser(),
    queryClient = useQueryClient(),
    navigate = useNavigate(),
    action = useAction("/auth/password", "PATCH", () => {
      session.clear();
      queryClient.clear();
      navigate("/login");
    });
  return (
    <>
      <PageHeading
        title="Hồ sơ cá nhân"
        description="Thông tin tài khoản và bảo mật đăng nhập."
      />
      {user.mustChangePassword && (
        <div className="info-note">
          Bạn cần đổi mật khẩu được cấp trước khi sử dụng hệ thống.
        </div>
      )}
      <div className="two-columns">
        <Panel title={user.fullName} description={user.email}>
          <AvatarUpload />
          <dl className="details-grid">
            <div>
              <dt>Mã tài khoản</dt>
              <dd>{user.accountCode}</dd>
            </div>
            <div>
              <dt>Vai trò</dt>
              <dd>
                {user.roles.map((r) => (
                  <Badge key={r} value={r} />
                ))}
              </dd>
            </div>
          </dl>
        </Panel>
        <Panel
          title="Đổi mật khẩu"
          description="Tối thiểu 12 ký tự. Sau khi đổi, bạn cần đăng nhập lại."
        >
          <SmartForm
            fields={[
              {
                name: "currentPassword",
                label: "Mật khẩu hiện tại",
                type: "password",
                autoComplete: "current-password",
              },
              {
                name: "newPassword",
                label: "Mật khẩu mới",
                type: "password",
                minLength: 12,
                maxLength: 128,
                autoComplete: "new-password",
              },
            ]}
            submit="Đổi mật khẩu"
            pending={action.isPending}
            error={action.error}
            onSubmit={(v) => action.mutateAsync(v)}
          />
        </Panel>
      </div>
    </>
  );
}

export function Supervision() {
  const query = useApi("/supervision-requests"),
    user = useUser();
  return (
    <>
      <PageHeading
        title="Hướng dẫn nghiên cứu"
        description="Đề nghị và phản hồi hướng dẫn gắn với nội dung hồ sơ hiện hành."
      />
      <Panel title="Danh sách đề nghị">
        <QueryState query={query}>
          {(rows) =>
            rows.length ? (
              <div className="request-list">
                {rows.map((r) => (
                  <article key={r.id}>
                    <div className="request-heading">
                      <div>
                        <small>
                          {r.topic.code} ·{" "}
                          {r.purpose === "replacement"
                            ? "Thay giảng viên"
                            : "Hướng dẫn ban đầu"}
                        </small>
                        <h3>{r.topic.title}</h3>
                        <p>
                          {r.lecturerName} · {dateTime(r.createdAt)}
                        </p>
                      </div>
                      <Badge value={r.status} />
                    </div>
                    {r.topic.abstract && (
                      <p className="readable-text">{r.topic.abstract}</p>
                    )}
                    <div className="row-actions">
                      {r.lecturerId === user.id && r.status === "pending" && (
                        <>
                          <ActionForm
                            title="Đồng ý hướng dẫn"
                            path={`/supervision-requests/${r.id}/respond`}
                            payload={{
                              revision: r.revision,
                              decision: "accept",
                            }}
                          />
                          <ActionForm
                            title="Từ chối hướng dẫn"
                            path={`/supervision-requests/${r.id}/respond`}
                            payload={{
                              revision: r.revision,
                              decision: "decline",
                            }}
                            fields={[reasonField]}
                          />
                        </>
                      )}
                      {r.requestedBy === user.id && r.status === "pending" && (
                        <ActionForm
                          title="Thu hồi đề nghị"
                          path={`/supervision-requests/${r.id}/cancel`}
                          payload={{ revision: r.revision }}
                        />
                      )}
                      <Link to={`/topics/${r.topicId}`} className="text-button">
                        Xem hồ sơ <ArrowUpRight size={15} />
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <Empty title="Chưa có đề nghị hướng dẫn" />
            )
          }
        </QueryState>
      </Panel>
    </>
  );
}

export function Reports() {
  const user = useUser(),
    [filters, setFilters] = useState({ groupBy: "status" }),
    query = useApi(`/reports/topics?${params(filters)}`),
    fields = useApi("/research-fields"),
    periods = useApi("/research-periods"),
    faculties = useApi("/faculties"),
    lecturers = useApi("/lecturers"),
    [downloadError, setDownloadError] = useState(null),
    [downloading, setDownloading] = useState(false);
  if (!user.roles.some((r) => ["lecturer", "faculty_staff"].includes(r)))
    return <Empty title="Bạn không có quyền xem báo cáo nghiệp vụ" />;
  return (
    <>
      <PageHeading
        title="Thống kê & báo cáo"
        description="Tổng hợp hoạt động nghiên cứu theo đúng phạm vi được phân công."
      >
        <button
          className="button primary"
          disabled={downloading}
          onClick={async () => {
            setDownloading(true);
            setDownloadError(null);
            try {
              await downloadCsv(filters);
            } catch (e) {
              setDownloadError(e);
            } finally {
              setDownloading(false);
            }
          }}
        >
          <Download size={17} /> Xuất báo cáo CSV
        </button>
      </PageHeading>
      {downloadError && <ErrorBox error={downloadError} />}
      <Panel title="Phạm vi báo cáo">
        <Filters filters={filters} setFilters={setFilters}>
          <SelectFilter
            label="Khoa"
            value={filters.facultyId}
            options={choices(faculties.data?.data)}
            onChange={(facultyId) => setFilters({ ...filters, facultyId })}
          />
          <SelectFilter
            label="Đợt"
            value={filters.periodId}
            options={choices(periods.data?.data)}
            onChange={(periodId) => setFilters({ ...filters, periodId })}
          />
          <SelectFilter
            label="Lĩnh vực"
            value={filters.fieldId}
            options={choices(fields.data?.data)}
            onChange={(fieldId) => setFilters({ ...filters, fieldId })}
          />
          <SelectFilter
            label="Giảng viên"
            value={filters.supervisorId}
            options={choices(lecturers.data?.data, "fullName")}
            onChange={(supervisorId) =>
              setFilters({ ...filters, supervisorId })
            }
          />
          <SelectFilter
            label="Kết quả"
            value={filters.result}
            options={["passed", "failed", "unassessed"].map((value) => ({
              value,
              label: labels[value],
            }))}
            onChange={(result) => setFilters({ ...filters, result })}
          />
          <SelectFilter
            label="Trạng thái"
            value={filters.status}
            options={[
              "draft",
              "submitted",
              "revision_required",
              "approved",
              "in_progress",
              "pending_evaluation",
              "completed",
              "rejected",
              "cancelled",
            ].map((value) => ({ value, label: labels[value] }))}
            onChange={(status) => setFilters({ ...filters, status })}
          />
          <input
            aria-label="Năm học"
            placeholder="Năm học, ví dụ 2026-2027"
            value={filters.academicYear ?? ""}
            onChange={(e) =>
              setFilters({ ...filters, academicYear: e.target.value })
            }
          />
          <select
            aria-label="Nhóm thống kê"
            value={filters.groupBy}
            onChange={(e) =>
              setFilters({ ...filters, groupBy: e.target.value })
            }
          >
            {Object.entries({
              status: "Theo trạng thái",
              result: "Theo kết quả",
              faculty: "Theo khoa",
              field: "Theo lĩnh vực",
              period: "Theo đợt",
              supervisor: "Theo giảng viên",
              academicYear: "Theo năm học",
            }).map(([v, l]) => (
              <option value={v} key={v}>
                {l}
              </option>
            ))}
          </select>
        </Filters>
      </Panel>
      <QueryState query={query}>
        {(data) => (
          <Panel
            title={`${data.total} đề tài trong báo cáo`}
            description="Biểu đồ và CSV sử dụng cùng bộ lọc."
          >
            {data.breakdown.length ? (
              <div className="report-chart">
                <ResponsiveContainer width="100%" height={270}>
                  <BarChart
                    data={data.breakdown.map((r) => ({
                      ...r,
                      name: labels[r.name] ?? r.name,
                    }))}
                  >
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar
                      isAnimationActive={false}
                      dataKey="value"
                      name="Đề tài"
                      fill="#3159d7"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={70}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : null}
            <TopicTable rows={data.rows} workspace />
          </Panel>
        )}
      </QueryState>
    </>
  );
}

export function UsersPage() {
  const user = useUser(),
    [filters, setFilters] = useState({ page: 1 }),
    query = useApi(`/users?${params(filters)}`),
    faculties = useApi("/faculties"),
    classes = useApi("/classes"),
    [modal, setModal] = useState(null),
    [csv, setCsv] = useState(""),
    [temporaryPassword, setTemporaryPassword] = useState(null),
    create = useAction("/users", "POST", () => setModal(null)),
    importer = useAction("/users/import", "POST", () => {
      setModal(null);
      setCsv("");
    });
  if (!user.roles.some((r) => ["admin", "faculty_staff"].includes(r)))
    return <Empty title="Bạn không có quyền quản lý tài khoản" />;
  const userFields = [
    { name: "accountCode", label: "Mã tài khoản", minLength: 3 },
    { name: "fullName", label: "Họ và tên", minLength: 2 },
    { name: "email", label: "Email", type: "email" },
    {
      name: "password",
      label: "Mật khẩu cấp ban đầu",
      type: "password",
      minLength: 12,
    },
    {
      name: "facultyId",
      label: "Khoa",
      type: "select",
      options: choices(
        faculties.data?.data?.filter(
          (f) => user.roles.includes("admin") || user.scopes.includes(f.id),
        ),
      ),
      required: false,
    },
    {
      name: "classId",
      label: "Lớp",
      type: "select",
      options: choices(classes.data?.data),
      required: false,
    },
    {
      name: "roles",
      label: "Vai trò",
      type: "multiselect",
      options: user.roles.includes("admin")
        ? roleChoices
        : roleChoices.slice(0, 2),
    },
  ];
  return (
    <>
      <PageHeading
        title="Quản lý tài khoản"
        description="Cấp tài khoản, quản lý trạng thái và nhập danh sách sinh viên."
      >
        <button className="button secondary" onClick={() => setModal("import")}>
          <Upload size={17} /> Nhập CSV
        </button>
        <button className="button primary" onClick={() => setModal("create")}>
          <Plus size={17} /> Tạo tài khoản
        </button>
      </PageHeading>
      <Panel title="Danh sách tài khoản">
        <Filters
          filters={filters}
          setFilters={setFilters}
          searchPlaceholder="Tìm tên, mã hoặc email…"
        >
          <SelectFilter
            label="Vai trò"
            value={filters.role}
            options={roleChoices}
            onChange={(role) => setFilters({ ...filters, role, page: 1 })}
          />
        </Filters>
        <QueryState query={query}>
          {(rows, meta) => (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Tài khoản</th>
                      <th>Vai trò</th>
                      <th>Trạng thái</th>
                      <th>Quản lý</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <strong>{u.fullName}</strong>
                          <small>
                            {u.accountCode} · {u.email}
                          </small>
                        </td>
                        <td>
                          {u.roles.map((r) => (
                            <Badge key={r} value={r} />
                          ))}
                        </td>
                        <td>
                          <Badge value={u.status} />
                        </td>
                        <td>
                          <div className="row-actions">
                            <ActionForm
                              title="Cập nhật tài khoản"
                              button="Sửa"
                              path={`/users/${u.id}`}
                              method="PATCH"
                              fields={[
                                {
                                  name: "fullName",
                                  label: "Họ và tên",
                                  minLength: 2,
                                },
                                {
                                  name: "email",
                                  label: "Email",
                                  type: "email",
                                },
                                {
                                  name: "status",
                                  label: "Trạng thái",
                                  type: "select",
                                  options: ["active", "locked"].map(
                                    (value) => ({
                                      value,
                                      label: labels[value],
                                    }),
                                  ),
                                },
                              ]}
                              defaults={u}
                              payload={{ revision: u.revision }}
                            />
                            <ActionForm
                              title="Đặt lại mật khẩu"
                              button="Đặt lại mật khẩu"
                              path={`/users/${u.id}/reset-password`}
                              fields={[reasonField]}
                              onDone={(v) =>
                                setTemporaryPassword({ name: u.fullName, ...v })
                              }
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                meta={meta}
                onPage={(page) => setFilters({ ...filters, page })}
              />
            </>
          )}
        </QueryState>
      </Panel>
      {modal === "create" && (
        <Modal title="Tạo tài khoản" onClose={() => setModal(null)}>
          <SmartForm
            fields={userFields}
            pending={create.isPending}
            error={create.error}
            submit="Tạo tài khoản"
            onSubmit={(v) =>
              create.mutateAsync({
                ...v,
                facultyId: v.facultyId || null,
                classId: v.classId || null,
              })
            }
          />
        </Modal>
      )}
      {modal === "import" && (
        <Modal title="Nhập tài khoản bằng CSV" onClose={() => setModal(null)}>
          <p className="muted">
            Tối đa 500 dòng. Cột: accountCode, email, fullName, password,
            facultyCode, classCode, roles. Vai trò phân cách bằng dấu |. Nếu có
            lỗi, toàn bộ danh sách chưa được ghi.
          </p>
          <input
            aria-label="Chọn tệp CSV"
            type="file"
            accept=".csv,text/csv"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f && f.size <= 1000000) setCsv(await f.text());
            }}
          />
          <label className="standalone-label">
            Nội dung CSV
            <textarea
              rows={8}
              value={csv}
              onChange={(e) => setCsv(e.target.value)}
            />
          </label>
          {importer.error && <ErrorBox error={importer.error} />}
          <button
            className="button primary"
            disabled={!csv || importer.isPending}
            onClick={() => importer.mutate({ csv })}
          >
            Kiểm tra và nhập tài khoản
          </button>
        </Modal>
      )}
      {temporaryPassword && (
        <Modal
          title={`Mật khẩu mới · ${temporaryPassword.name}`}
          onClose={() => setTemporaryPassword(null)}
        >
          <p>
            Chỉ hiển thị trong lần cấp này. Chuyển riêng cho người dùng qua kênh
            quản lý.
          </p>
          <code className="temporary-password">
            {temporaryPassword.temporaryPassword}
          </code>
          <p className="muted">Người dùng cần đổi mật khẩu khi đăng nhập.</p>
        </Modal>
      )}
    </>
  );
}
export function RolesPage() {
  const user = useUser(),
    [page, setPage] = useState(1),
    query = useApi(`/users?page=${page}`),
    faculties = useApi("/faculties");
  if (!user.roles.includes("admin"))
    return <Empty title="Chỉ quản trị viên được cấp quyền" />;
  return (
    <>
      <PageHeading
        title="Vai trò & phạm vi"
        description="Một tài khoản có thể có nhiều vai trò. Quản trị kỹ thuật không tự có quyền nghiệp vụ."
      />
      <Panel title="Phân quyền tài khoản">
        <QueryState query={query}>
          {(rows, meta) => (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Người dùng</th>
                      <th>Vai trò</th>
                      <th>Phạm vi cán bộ</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <strong>{u.fullName}</strong>
                          <small>{u.accountCode}</small>
                        </td>
                        <td>
                          {u.roles.map((r) => (
                            <Badge key={r} value={r} />
                          ))}
                        </td>
                        <td>
                          {u.scopes
                            .map(
                              (id) =>
                                faculties.data?.data.find((f) => f.id === id)
                                  ?.name,
                            )
                            .join(", ") || "—"}
                        </td>
                        <td>
                          <div className="row-actions">
                            <ActionForm
                              title="Cập nhật vai trò"
                              button="Vai trò"
                              path={`/users/${u.id}/roles`}
                              method="PUT"
                              fields={[
                                {
                                  name: "roles",
                                  label: "Vai trò được cấp",
                                  type: "multiselect",
                                  options: roleChoices,
                                },
                              ]}
                              defaults={{ roles: u.roles }}
                              payload={{ revision: u.revision }}
                            />
                            <ActionForm
                              title="Cập nhật phạm vi"
                              button="Phạm vi"
                              path={`/users/${u.id}/management-scopes`}
                              method="PUT"
                              fields={[
                                {
                                  name: "facultyIds",
                                  label: "Khoa được quản lý",
                                  type: "multiselect",
                                  options: choices(faculties.data?.data),
                                  required: false,
                                },
                              ]}
                              defaults={{ facultyIds: u.scopes }}
                              payload={{ revision: u.revision }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination meta={meta} onPage={setPage} />
            </>
          )}
        </QueryState>
      </Panel>
    </>
  );
}
export function Catalogs() {
  const user = useUser(),
    [kind, setKind] = useState("faculties"),
    query = useApi(`/${kind}?active=all`),
    faculties = useApi("/faculties"),
    majors = useApi("/majors");
  if (!user.roles.includes("admin"))
    return <Empty title="Chỉ quản trị viên được quản lý danh mục" />;
  const names = {
      faculties: "Khoa",
      majors: "Ngành",
      classes: "Lớp",
      "research-fields": "Lĩnh vực nghiên cứu",
    },
    fields = [
      { name: "code", label: "Mã danh mục", minLength: 2 },
      { name: "name", label: "Tên danh mục", minLength: 2 },
      ...(kind === "majors"
        ? [
            {
              name: "facultyId",
              label: "Khoa",
              type: "select",
              options: choices(faculties.data?.data),
            },
          ]
        : []),
      ...(kind === "classes"
        ? [
            {
              name: "majorId",
              label: "Ngành",
              type: "select",
              options: choices(majors.data?.data),
            },
            {
              name: "admissionYear",
              label: "Năm nhập học",
              type: "number",
              min: 2000,
              max: 2100,
            },
          ]
        : []),
    ];
  return (
    <>
      <PageHeading
        title="Danh mục học thuật"
        description="Quản lý tổ chức và các lĩnh vực nghiên cứu."
      >
        <ActionForm
          key={kind}
          title={`Thêm ${names[kind].toLowerCase()}`}
          path={`/${kind}`}
          fields={fields}
        />
      </PageHeading>
      <div className="tabs">
        {Object.entries(names).map(([key, name]) => (
          <button
            key={key}
            className={key === kind ? "active" : ""}
            onClick={() => setKind(key)}
          >
            {name}
          </button>
        ))}
      </div>
      <Panel title={names[kind]}>
        <QueryState query={query}>
          {(rows) =>
            rows.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Mã</th>
                      <th>Tên</th>
                      <th>Trạng thái</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id}>
                        <td className="topic-code">{r.code}</td>
                        <td>{r.name}</td>
                        <td>
                          <Badge value={r.isActive ? "active" : "closed"} />
                        </td>
                        <td>
                          <ActionForm
                            title="Sửa danh mục"
                            button="Sửa"
                            path={`/${kind}/${r.id}`}
                            method="PATCH"
                            payload={{ revision: r.revision }}
                            defaults={r}
                            fields={[
                              { name: "name", label: "Tên", minLength: 2 },
                              {
                                name: "isActive",
                                label: "Sử dụng danh mục",
                                type: "checkbox",
                                hint: "Cho phép chọn trong hồ sơ mới",
                              },
                            ]}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty />
            )
          }
        </QueryState>
      </Panel>
    </>
  );
}
const auditLabels = {
  "topic.created": "Tạo hồ sơ",
  "topic.updated": "Cập nhật hồ sơ",
  "topic.submitted": "Gửi xét duyệt",
  "topic.approved": "Phê duyệt hồ sơ",
  "topic.revision_required": "Yêu cầu chỉnh sửa",
  "topic.rejected": "Từ chối hồ sơ",
  "topic.started": "Bắt đầu thực hiện",
  "topic.evaluated": "Hoàn thành đánh giá",
  "topic.cancelled": "Hủy đề tài",
  "seed.demo_created": "Khởi tạo dữ liệu minh họa",
  "submission.finalized": "Nộp báo cáo",
  "submission.reviewed": "Nhận xét báo cáo",
  "progress.added": "Cập nhật tiến độ",
  "milestone.reopened": "Mở lại mốc",
  "evaluation.corrected": "Sửa sai kết quả",
  "change.requested": "Đề nghị thay đổi",
  "change.approved": "Duyệt thay đổi",
  "cancellation.requested": "Đề nghị hủy",
  "auth.login": "Đăng nhập",
  "user.created": "Tạo tài khoản",
  "user.updated": "Cập nhật tài khoản",
  "user.password_reset": "Đặt lại mật khẩu",
  "user.roles_changed": "Cập nhật vai trò",
  "user.scopes_changed": "Cập nhật phạm vi",
};
export function AuditTimeline({ rows }) {
  return rows.length ? (
    <div className="timeline">
      {rows.map((row) => (
        <div key={row.id}>
          <span className="timeline-dot" />
          <div>
            <strong>
              {auditLabels[row.action] ??
                row.action.replaceAll(".", " · ").replaceAll("_", " ")}
            </strong>
            {row.reason && <p>{row.reason}</p>}
            <small>
              {row.actorName ?? "Hệ thống"} / {dateTime(row.createdAt)}
            </small>
          </div>
        </div>
      ))}
    </div>
  ) : (
    <Empty title="Chưa có lịch sử" />
  );
}
export function AuditPage() {
  const [page, setPage] = useState(1),
    query = useApi(`/audit-logs?page=${page}`);
  return (
    <>
      <PageHeading
        title="Lịch sử hệ thống"
        description="Theo dõi các thao tác trong phạm vi được cấp quyền."
      />
      <Panel title="Nhật ký hoạt động">
        <QueryState query={query}>
          {(rows, meta) => (
            <>
              <AuditTimeline rows={rows} />
              <Pagination meta={meta} onPage={setPage} />
            </>
          )}
        </QueryState>
      </Panel>
    </>
  );
}
export function AvatarUpload() {
  const user = useUser(),
    [pending, setPending] = useState(false),
    [error, setError] = useState(null);
  return (
    <div className="profile-avatar-upload">
      {user.avatarUrl ? (
        <img
          className="avatar profile-avatar"
          src={user.avatarUrl}
          alt="Ảnh đại diện"
        />
      ) : (
        <div className="avatar profile-avatar">
          <GraduationCap size={27} />
        </div>
      )}
      <div>
        <p>Ảnh đại diện hiển thị công khai.</p>
        <small>JPEG, PNG hoặc WebP · tối đa 4 MB.</small>
        <label className="button secondary">
          <Upload size={15} />
          {pending ? "Đang cập nhật…" : "Cập nhật ảnh"}
          <input
            type="file"
            hidden
            accept=".jpg,.jpeg,.png,.webp"
            disabled={pending}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setError(null);
              if (file.size > 4000000) {
                setError(new Error("Ảnh tối đa 4 MB."));
                return;
              }
              const form = new FormData();
              form.append("file", file);
              setPending(true);
              try {
                const result = await api("/profile/avatar", {
                  method: "POST",
                  body: form,
                });
                session.patchUser(result.data);
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
      {error && <ErrorBox error={error} />}
    </div>
  );
}
