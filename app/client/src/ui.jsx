import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Plus,
  X,
  Search,
  RefreshCw,
  ArrowUpRight,
  FileText,
} from "lucide-react";
import { api, params } from "./api";
export const labels = {
  draft: "Bản nháp",
  submitted: "Chờ xét duyệt",
  revision_required: "Cần chỉnh sửa",
  approved: "Đã phê duyệt",
  in_progress: "Đang thực hiện",
  pending_evaluation: "Chờ nghiệm thu",
  completed: "Đã hoàn thành",
  rejected: "Đã từ chối",
  cancelled: "Đã hủy",
  pending: "Đang chờ",
  accepted: "Đã chấp nhận",
  declined: "Đã từ chối",
  expired: "Hết hạn",
  withdrawn: "Đã rút",
  conflicted: "Có xung đột",
  ready: "Sẵn sàng",
  failed: "Không đạt",
  passed: "Đạt",
  pending_review: "Chờ nhận xét",
  changes_requested: "Cần sửa",
  comment_only: "Nhận xét",
  student: "Sinh viên",
  lecturer: "Giảng viên",
  faculty_staff: "Cán bộ khoa",
  admin: "Quản trị viên",
  open: "Đang mở",
  closed: "Đã đóng",
  active: "Hoạt động",
  locked: "Đã khóa",
  unassessed: "Chưa đánh giá",
  academic: "Nội dung",
  members: "Thành viên",
  supervisor: "Giảng viên",
};
export const date = (value) =>
  value
    ? new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "medium",
        timeZone: "Asia/Ho_Chi_Minh",
      }).format(new Date(value))
    : "—";
export const dateTime = (value) =>
  value
    ? new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "Asia/Ho_Chi_Minh",
      }).format(new Date(value))
    : "—";
export const dateInput = (value) => {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const p = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
};
export const asIso = (value) =>
  new Date(
    /(?:Z|[+-]\d{2}:\d{2})$/.test(value)
      ? value
      : `${value.length === 16 ? value + ":00" : value}+07:00`,
  ).toISOString();
export const choices = (rows, name = "name") =>
  (rows ?? []).map((r) => ({ value: r.id, label: r[name] ?? r.code }));
export function Badge({ value, children }) {
  return (
    <span className={`badge badge-${value}`}>
      {children ?? labels[value] ?? value}
    </span>
  );
}
export function Icon({ name: Component, ...props }) {
  return <Component size={18} strokeWidth={1.8} {...props} />;
}
export function PageHeading({
  eyebrow = "KHÔNG GIAN NGHIÊN CỨU",
  title,
  description,
  children,
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
export function ErrorBox({ error, retry }) {
  return (
    <div className="error-box" role="alert">
      <AlertCircle size={20} />
      <div>
        <strong>{error?.message ?? "Không tải được dữ liệu."}</strong>
        {error?.code === "REVISION_CONFLICT" && (
          <p>
            Tải lại trang để làm việc với phiên bản mới nhất.{" "}
            <button
              type="button"
              className="text-button"
              onClick={() => window.location.reload()}
            >
              Tải lại dữ liệu
            </button>
          </p>
        )}
        {error?.details?.rows && (
          <ul>
            {error.details.rows.map((r) => (
              <li key={r.row}>
                Dòng {r.row}: {r.message}
              </li>
            ))}
          </ul>
        )}
        {error?.requestId && <small>Mã yêu cầu: {error.requestId}</small>}
        {retry && (
          <button type="button" className="text-button" onClick={retry}>
            <RefreshCw size={14} /> Thử lại
          </button>
        )}
      </div>
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={22} /> Đang tải dữ liệu…
    </div>
  );
}
export function Empty({
  title = "Chưa có dữ liệu",
  description = "Dữ liệu sẽ xuất hiện tại đây khi có hoạt động mới.",
  children,
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <FileText size={25} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function QueryState({ query, children }) {
  if (query.isPending) return <Loading />;
  if (query.isError)
    return <ErrorBox error={query.error} retry={query.refetch} />;
  return children(query.data?.data, query.data?.meta);
}
export function useApi(path, options = {}) {
  return useQuery({ queryKey: [path], queryFn: () => api(path), ...options });
}
export function useAction(path, method = "POST", onSuccess) {
  const queryClient = useQueryClient(),
    last = useRef(null);
  return useMutation({
    mutationFn: (input) => {
      const body = Object.fromEntries(
        Object.entries(input ?? {}).filter(
          ([k, v]) =>
            !k.startsWith("_") &&
            !(typeof path === "function" && k === "id") &&
            !(
              v === "" &&
              ["reason", "warningJustification", "score"].includes(k)
            ),
        ),
      );
      const fingerprint = JSON.stringify({
        path: typeof path === "function" ? path(input) : path,
        body,
      });
      if (last.current?.fingerprint !== fingerprint)
        last.current = { fingerprint, key: crypto.randomUUID() };
      return api(typeof path === "function" ? path(input) : path, {
        method,
        body,
        key: last.current.key,
      });
    },
    onSuccess: async (result) => {
      last.current = null;
      await queryClient.invalidateQueries();
      onSuccess?.(result?.data);
    },
  });
}
export function Modal({ title, children, onClose }) {
  const ref = useRef(null),
    closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.querySelector("button,input,select,textarea")?.focus();
    const handler = (event) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key === "Tab") {
        const nodes = [
            ...ref.current.querySelectorAll(
              "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
            ),
          ].filter((n) => n.offsetParent !== null),
          first = nodes[0],
          last = nodes.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal"
      >
        <header>
          <h2>{title}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Đóng"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
function formSchema(fields) {
  const shape = {};
  for (const field of fields) {
    if (field.type === "display") continue;
    let rule = field.schema;
    if (!rule) {
      if (field.type === "checkbox") rule = z.boolean();
      else if (field.type === "multiselect")
        rule = z.array(z.string()).min(field.required === false ? 0 : 1);
      else if (field.type === "number") {
        const number = z
          .number()
          .min(field.min ?? 0)
          .max(field.max ?? 100000);
        rule =
          field.required === false
            ? z.preprocess(
                (v) => (v === "" ? undefined : Number(v)),
                number.optional(),
              )
            : z.coerce
                .number()
                .min(field.min ?? 0)
                .max(field.max ?? 100000);
      } else
        rule = z
          .string()
          .trim()
          .min(
            field.required === false ? 0 : (field.minLength ?? 1),
            `${field.label} là bắt buộc`,
          )
          .max(field.maxLength ?? 20000);
      if (field.type === "email") rule = z.email("Email chưa đúng định dạng");
    }
    shape[field.name] = rule;
  }
  return z.object(shape);
}
export function SmartForm({
  fields,
  defaults = {},
  submit = "Lưu thay đổi",
  onSubmit,
  pending = false,
  error,
  children,
  success,
  externalDirty = false,
}) {
  const form = useForm({
    resolver: zodResolver(formSchema(fields)),
    defaultValues: Object.fromEntries(
      fields
        .filter((f) => f.type !== "display")
        .map((f) => [
          f.name,
          defaults[f.name] ??
            f.default ??
            (f.type === "checkbox"
              ? false
              : f.type === "multiselect"
                ? []
                : ""),
        ]),
    ),
  });
  const handle = async (values) => {
    try {
      await onSubmit(values, form);
    } catch {
      /* mutation error rendered below */
    }
  };
  const [destination, setDestination] = useState(null),
    navigate = useNavigate();
  useEffect(() => {
    for (const issue of error?.details?.fields ?? [])
      if (fields.some((f) => f.name === issue.path))
        form.setError(issue.path, { type: "server", message: issue.message });
  }, [error]);
  useEffect(() => {
    if (!form.formState.isDirty && !externalDirty) return;
    const before = (event) => {
        event.preventDefault();
        event.returnValue = "";
      },
      link = (event) => {
        const anchor = event.target.closest("a[href]");
        if (
          !anchor ||
          event.defaultPrevented ||
          event.ctrlKey ||
          event.metaKey ||
          anchor.target === "_blank"
        )
          return;
        const url = new URL(anchor.href);
        if (
          url.origin === location.origin &&
          url.pathname !== location.pathname
        ) {
          event.preventDefault();
          setDestination(url.pathname + url.search);
        }
      };
    window.addEventListener("beforeunload", before);
    document.addEventListener("click", link, true);
    return () => {
      window.removeEventListener("beforeunload", before);
      document.removeEventListener("click", link, true);
    };
  }, [form.formState.isDirty, externalDirty]);
  return (
    <form
      className="smart-form"
      onSubmit={form.handleSubmit(handle)}
      noValidate
    >
      <div className="form-grid">
        {fields.map((f) =>
          f.type === "display" ? (
            <div key={f.name} className="full">
              {f.content}
            </div>
          ) : (
            <div
              key={f.name}
              className={`form-field ${f.full || f.type === "textarea" || f.type === "multiselect" ? "full" : ""}`}
            >
              <label htmlFor={`field-${f.name}`}>
                {f.label}
                {f.required !== false && f.type !== "checkbox" && (
                  <span className="required"> *</span>
                )}
              </label>
              {f.type === "textarea" ? (
                <textarea
                  aria-label={f.label}
                  id={`field-${f.name}`}
                  rows={f.rows ?? 4}
                  {...form.register(f.name)}
                  placeholder={f.placeholder}
                />
              ) : f.type === "select" ? (
                <select
                  aria-label={f.label}
                  id={`field-${f.name}`}
                  {...form.register(f.name)}
                >
                  <option value="">{f.placeholder ?? "Chọn một mục"}</option>
                  {f.options?.map((o) => (
                    <option value={o.value} key={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "multiselect" ? (
                <div className="check-list">
                  {f.options?.map((o) => (
                    <label key={o.value}>
                      <input
                        type="checkbox"
                        value={o.value}
                        {...form.register(f.name)}
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              ) : f.type === "checkbox" ? (
                <label className="checkbox-row">
                  <input
                    aria-label={f.label}
                    id={`field-${f.name}`}
                    type="checkbox"
                    {...form.register(f.name)}
                  />
                  {f.hint}
                </label>
              ) : (
                <input
                  aria-label={f.label}
                  id={`field-${f.name}`}
                  type={f.type ?? "text"}
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  autoComplete={f.autoComplete}
                  {...form.register(f.name)}
                  placeholder={f.placeholder}
                />
              )}
              {f.hint && f.type !== "checkbox" && <small>{f.hint}</small>}
              {form.formState.errors[f.name] && (
                <span className="field-error" role="alert">
                  {form.formState.errors[f.name].message}
                </span>
              )}
            </div>
          ),
        )}
      </div>
      {children}
      {error && <ErrorBox error={error} />}
      {success && (
        <div className="success-box">
          <CheckCircle2 size={18} />
          {success}
        </div>
      )}
      <div className="form-actions">
        <button
          type="submit"
          className="button primary"
          disabled={pending || form.formState.isSubmitting}
        >
          {pending ? <LoaderCircle size={17} className="spin" /> : null}
          {submit}
        </button>
      </div>
      {destination && (
        <Modal
          title="Thay đổi chưa được lưu"
          onClose={() => setDestination(null)}
        >
          <p>
            Bạn đang chỉnh sửa thông tin. Rời trang sẽ bỏ các thay đổi chưa lưu.
          </p>
          <div className="row-actions">
            <button
              type="button"
              className="button secondary"
              onClick={() => setDestination(null)}
            >
              Tiếp tục chỉnh sửa
            </button>
            <button
              type="button"
              className="button danger"
              onClick={() => {
                form.reset();
                setDestination(null);
                navigate(destination);
              }}
            >
              Bỏ thay đổi và rời trang
            </button>
          </div>
        </Modal>
      )}
    </form>
  );
}
export function ActionForm({
  title,
  button = title,
  path,
  method = "POST",
  fields = [],
  defaults = {},
  payload = {},
  onDone,
  description,
  danger = false,
  transform = (v) => v,
}) {
  const [open, setOpen] = useState(false),
    action = useAction(path, method, (data) => {
      setOpen(false);
      onDone?.(data);
    });
  return (
    <>
      <button
        className={`button ${danger ? "danger" : "secondary"}`}
        onClick={() => {
          action.reset();
          setOpen(true);
        }}
      >
        {button}
      </button>
      {open && (
        <Modal title={title} onClose={() => setOpen(false)}>
          {description && <p className="muted">{description}</p>}
          <SmartForm
            fields={fields}
            defaults={defaults}
            submit={title}
            pending={action.isPending}
            error={action.error}
            onSubmit={(values) =>
              action.mutateAsync(transform({ ...payload, ...values }))
            }
          />
        </Modal>
      )}
    </>
  );
}
export function Filters({
  filters,
  setFilters,
  children,
  searchPlaceholder = "Tìm theo tên hoặc mã đề tài…",
}) {
  return (
    <div className="filters">
      <div className="search-input">
        <Search size={17} />
        <input
          aria-label="Tìm kiếm"
          value={filters.search ?? ""}
          placeholder={searchPlaceholder}
          onChange={(e) =>
            setFilters({ ...filters, search: e.target.value, page: 1 })
          }
        />
      </div>
      {children}
    </div>
  );
}
export function SelectFilter({ label, value, onChange, options }) {
  return (
    <select
      aria-label={label}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
export function Pagination({ meta, onPage }) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <div className="pagination">
      <span>
        {meta.totalItems} kết quả · Trang {meta.page}/{meta.totalPages}
      </span>
      <div>
        <button
          className="icon-button"
          aria-label="Trang trước"
          disabled={meta.page <= 1}
          onClick={() => onPage(meta.page - 1)}
        >
          <ChevronLeft size={18} />
        </button>
        <button
          className="icon-button"
          aria-label="Trang sau"
          disabled={meta.page >= meta.totalPages}
          onClick={() => onPage(meta.page + 1)}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
export function TopicTable({ rows, workspace = false }) {
  if (!rows?.length)
    return (
      <Empty
        title="Chưa tìm thấy đề tài"
        description="Thử thay đổi từ khóa hoặc bộ lọc của bạn."
      />
    );
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Đề tài nghiên cứu</th>
            <th>Lĩnh vực / Khoa</th>
            <th>Giảng viên</th>
            <th>Trạng thái</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <small className="topic-code">{row.code}</small>
                <Link
                  className="topic-title"
                  to={workspace ? `/topics/${row.id}` : `/repository/${row.id}`}
                >
                  {row.title}
                </Link>
                <small>{row.periodName}</small>
              </td>
              <td>
                <span>{row.fieldName}</span>
                <small>{row.facultyName}</small>
              </td>
              <td>
                {row.supervisorName ?? (
                  <span className="muted">Chưa phân công</span>
                )}
              </td>
              <td>
                <Badge value={row.status} />
              </td>
              <td>
                <Link
                  className="icon-button"
                  aria-label={`Xem ${row.title}`}
                  to={workspace ? `/topics/${row.id}` : `/repository/${row.id}`}
                >
                  <ArrowUpRight size={18} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Panel({
  title,
  description,
  children,
  action,
  className = "",
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export const reasonField = {
  name: "reason",
  label: "Lý do",
  type: "textarea",
  minLength: 10,
  maxLength: 2000,
};
