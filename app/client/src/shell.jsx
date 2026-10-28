import { createContext, useContext, useEffect, useState } from "react";
import {
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronDown,
  FlaskConical,
  FolderOpen,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings2,
  ShieldCheck,
  Users,
  X,
  ClipboardCheck,
  UserRound,
  History,
  LibraryBig,
} from "lucide-react";
import { api, bootstrap, session } from "./api";
import {
  Badge,
  ErrorBox,
  Loading,
  SmartForm,
  useAction,
  useApi,
  labels,
} from "./ui";
import {
  Dashboard,
  TopicList,
  RepositoryDetail,
  Periods,
  PeriodEditor,
  Teams,
  Notifications,
  Profile,
  Reports,
  Supervision,
  UsersPage,
  RolesPage,
  Catalogs,
  AuditPage,
} from "./pages";
import { TopicEditor, Workspace } from "./workspace";
const UserContext = createContext(null);
export const useUser = () => useContext(UserContext);
const menu = [
  { label: "Tổng quan", to: "/", icon: LayoutDashboard },
  {
    label: "Đề tài của tôi",
    to: "/my-topics",
    icon: FolderOpen,
    roles: ["student", "lecturer", "faculty_staff"],
  },
  {
    label: "Nhóm nghiên cứu",
    to: "/teams",
    icon: Users,
    roles: ["student", "faculty_staff"],
  },
  { label: "Đợt đăng ký", to: "/periods", icon: CalendarDays },
  {
    label: "Hướng dẫn nghiên cứu",
    to: "/supervision",
    icon: GraduationCap,
    roles: ["student", "lecturer", "faculty_staff"],
  },
  {
    label: "Hàng chờ xét duyệt",
    to: "/queue",
    icon: ClipboardCheck,
    roles: ["faculty_staff"],
  },
  { label: "Kho đề tài", to: "/repository", icon: LibraryBig },
  {
    label: "Thống kê & báo cáo",
    to: "/reports",
    icon: ChartNoAxesCombined,
    roles: ["lecturer", "faculty_staff"],
  },
  { label: "Thông báo", to: "/notifications", icon: Bell },
  {
    label: "Tài khoản",
    to: "/users",
    icon: UserRound,
    roles: ["admin", "faculty_staff"],
    group: "QUẢN LÝ HỆ THỐNG",
  },
  {
    label: "Vai trò & phạm vi",
    to: "/roles",
    icon: ShieldCheck,
    roles: ["admin"],
  },
  { label: "Danh mục", to: "/catalogs", icon: Settings2, roles: ["admin"] },
  {
    label: "Lịch sử hệ thống",
    to: "/audit",
    icon: History,
    roles: ["admin", "faculty_staff"],
  },
];
function Login() {
  const navigate = useNavigate(),
    action = useAction("/auth/login", "POST", (data) => {
      session.set(data);
      navigate("/");
    });
  return (
    <main className="login-page">
      <section className="login-story">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <FlaskConical size={25} />
          </span>
          <div>
            Research Hub<small>NGHIÊN CỨU KHOA HỌC SINH VIÊN</small>
          </div>
        </Link>
        <div className="login-story-content">
          <span className="pill">KHỞI ĐẦU TỪ MỘT Ý TƯỞNG</span>
          <h1>
            Kết nối tri thức.
            <br />
            Kiến tạo tương lai.
          </h1>
          <p>
            Một không gian chung để mỗi ý tưởng nghiên cứu được theo dõi, phát
            triển và ghi nhận.
          </p>
          <div className="research-graphic" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="graphic-center">
              <FlaskConical size={56} />
            </div>
            <div className="graphic-tag tag-one">
              <BookOpen size={19} /> Tri thức
            </div>
            <div className="graphic-tag tag-two">
              <Users size={19} /> Cộng tác
            </div>
            <div className="graphic-tag tag-three">
              <Activity size={19} /> Tiến bộ mỗi ngày
            </div>
          </div>
        </div>
        <p className="login-foot">
          Từ ý tưởng đầu tiên đến kết quả nghiên cứu.
        </p>
      </section>
      <section className="login-form">
        <div className="login-form-inner">
          <div className="eyebrow">CHÀO MỪNG BẠN TRỞ LẠI</div>
          <h2>Đăng nhập</h2>
          <p className="muted">Tiếp tục hành trình nghiên cứu của bạn.</p>
          <SmartForm
            fields={[
              {
                name: "email",
                label: "Email",
                type: "email",
                placeholder: "ten@truong.edu.vn",
                autoComplete: "username",
              },
              {
                name: "password",
                label: "Mật khẩu",
                type: "password",
                autoComplete: "current-password",
              },
            ]}
            submit="Đăng nhập vào hệ thống"
            pending={action.isPending}
            error={action.error}
            onSubmit={(v) => action.mutateAsync(v)}
          />
          <p className="login-help">
            <ShieldCheck size={18} /> Tài khoản do nhà trường cấp. Liên hệ cán
            bộ khoa nếu bạn cần đặt lại mật khẩu.
          </p>
        </div>
        <small>
          Hệ thống hỗ trợ quản lý hoạt động nghiên cứu khoa học sinh viên
        </small>
      </section>
    </main>
  );
}
function Layout() {
  const user = useUser(),
    location = useLocation(),
    navigate = useNavigate(),
    queryClient = useQueryClient(),
    [mobile, setMobile] = useState(false),
    [search, setSearch] = useState("");
  const notification = useApi("/notifications?unread=true&pageSize=1", {
      refetchInterval: 60000,
    }),
    count = notification.data?.meta?.totalItems ?? 0;
  const visible = menu.filter(
      (m) => !m.roles || m.roles.some((r) => user.roles.includes(r)),
    ),
    active = visible.find((m) =>
      m.to === "/"
        ? location.pathname === "/"
        : location.pathname.startsWith(m.to),
    );
  const logout = useAction("/auth/logout", "POST", () => {
    session.clear();
    queryClient.clear();
    navigate("/login");
  });
  useEffect(() => setMobile(false), [location.pathname]);
  return (
    <div className="app-shell">
      {mobile && (
        <div className="sidebar-overlay" onClick={() => setMobile(false)} />
      )}
      <aside className={`sidebar ${mobile ? "is-open" : ""}`}>
        <Link to="/" className="brand">
          <span className="brand-mark">
            <FlaskConical size={24} />
          </span>
          <div>
            Research Hub<small>NGHIÊN CỨU SINH VIÊN</small>
          </div>
        </Link>
        <div className="sidebar-label">KHÔNG GIAN LÀM VIỆC</div>
        <nav>
          {visible.map((item) => (
            <div key={item.to}>
              {item.group && (
                <div className="sidebar-label secondary-label">
                  {item.group}
                </div>
              )}
              <NavLink
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `nav-item ${isActive ? "active" : ""}`
                }
              >
                <item.icon size={19} />
                <span>{item.label}</span>
                {item.to === "/notifications" && count > 0 && (
                  <span className="nav-count">{count}</span>
                )}
              </NavLink>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="status-dot" /> Không gian học thuật số
            <small>Ý tưởng hôm nay, giá trị ngày mai.</small>
          </div>
          <Link to="/profile" className="sidebar-profile">
            {user.avatarUrl ? (
              <img className="avatar" src={user.avatarUrl} alt="" />
            ) : (
              <div className="avatar">
                {user.fullName
                  .split(" ")
                  .slice(-1)[0]
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
            )}
            <div>
              <strong>{user.fullName}</strong>
              <small>{user.roles.map((r) => labels[r]).join(" · ")}</small>
            </div>
            <Settings2 size={16} />
          </Link>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Mở điều hướng"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={22} />
            </button>
            <span>Nghiên cứu khoa học</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{active?.label ?? "Không gian đề tài"}</strong>
          </div>
          <div className="topbar-actions">
            <form
              className="top-search"
              onSubmit={(e) => {
                e.preventDefault();
                navigate(`/repository?search=${encodeURIComponent(search)}`);
              }}
            >
              <Search size={17} />
              <input
                aria-label="Tra cứu đề tài"
                placeholder="Tra cứu đề tài…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </form>
            <Link
              className="notification-button icon-button"
              aria-label={`Thông báo, ${count} chưa đọc`}
              to="/notifications"
            >
              <Bell size={20} />
              {count > 0 && <span />}
            </Link>
            <button
              className="icon-button"
              aria-label="Đăng xuất"
              onClick={() => logout.mutate({})}
              disabled={logout.isPending}
            >
              <LogOut size={19} />
            </button>
          </div>
        </header>
        {logout.error && <ErrorBox error={logout.error} />}
        <main className="page-content">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>Research Hub · Không gian nghiên cứu sinh viên</span>
          <span>Học hỏi. Khám phá. Sáng tạo.</span>
        </footer>
      </div>
    </div>
  );
}
export function App() {
  const [user, setUser] = useState(session.user),
    [ready, setReady] = useState(false),
    queryClient = useQueryClient();
  useEffect(() => {
    const unsub = session.subscribe((value) => {
      setUser(value);
      if (!value) queryClient.clear();
    });
    bootstrap().finally(() => setReady(true));
    return unsub;
  }, [queryClient]);
  if (!ready)
    return (
      <div className="boot">
        <FlaskConical size={36} />
        <Loading />
      </div>
    );
  return (
    <UserContext.Provider value={user}>
      <Routes>
        <Route
          path="/login"
          element={user ? <Navigate to="/" replace /> : <Login />}
        />
        <Route element={user ? <Layout /> : <Navigate to="/login" replace />}>
          <Route
            index
            element={
              user?.mustChangePassword ? (
                <Navigate to="/profile" replace />
              ) : (
                <Dashboard />
              )
            }
          />
          <Route path="profile" element={<Profile />} />
          <Route
            path="my-topics"
            element={<TopicList key="mine" mode="mine" />}
          />
          <Route
            path="queue"
            element={<TopicList key="queue" mode="queue" />}
          />
          <Route
            path="repository"
            element={<TopicList key="repository" mode="repository" />}
          />
          <Route path="repository/:id" element={<RepositoryDetail />} />
          <Route path="periods" element={<Periods />} />
          <Route path="periods/new" element={<PeriodEditor />} />
          <Route path="periods/:id/edit" element={<PeriodEditor />} />
          <Route path="teams" element={<Teams />} />
          <Route path="topics/new" element={<TopicEditor />} />
          <Route path="topics/:id/edit" element={<TopicEditor />} />
          <Route path="topics/:id/*" element={<Workspace />} />
          <Route path="supervision" element={<Supervision />} />
          <Route path="reports" element={<Reports />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="roles" element={<RolesPage />} />
          <Route path="catalogs" element={<Catalogs />} />
          <Route path="audit" element={<AuditPage />} />
          <Route
            path="*"
            element={
              <div className="empty">
                <h1>Không tìm thấy trang</h1>
                <Link className="button primary" to="/">
                  Về trang tổng quan
                </Link>
              </div>
            }
          />
        </Route>
      </Routes>
    </UserContext.Provider>
  );
}
