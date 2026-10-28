let token = null,
  expiresAt = 0,
  user = null,
  refreshPromise = null;
const listeners = new Set();
const channel =
  typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("nckh-auth")
    : null;
function publish(data, broadcast = true) {
  token = data?.accessToken ?? null;
  expiresAt = data ? Date.now() + data.expiresIn * 1000 : 0;
  user = data?.user ?? null;
  for (const fn of listeners) fn(user);
  if (broadcast) channel?.postMessage({ type: "session", data });
}
channel?.addEventListener("message", (event) => {
  if (event.data.type === "session") publish(event.data.data, false);
});
export const session = {
  get user() {
    return user;
  },
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  set: publish,
  patchUser(patch) {
    publish({
      accessToken: token,
      expiresIn: Math.max(0, (expiresAt - Date.now()) / 1000),
      user: { ...user, ...patch },
    });
  },
  clear() {
    publish(null);
  },
};
export class ApiError extends Error {
  constructor(response, status) {
    super(response?.error?.message ?? "Không kết nối được dịch vụ.");
    this.code = response?.error?.code;
    this.details = response?.error?.details;
    this.requestId = response?.requestId;
    this.status = status;
  }
}
async function refresh() {
  if (refreshPromise) return refreshPromise;
  const operation = async () => {
    // A previous tab's message may be queued when this tab acquires the lock.
    await new Promise((resolve) => setTimeout(resolve, 25));
    if (token && expiresAt > Date.now() + 30000) return token;
    const res = await fetch("/api/v1/auth/refresh", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "X-CSRF-Protection": "1",
          "Content-Type": "application/json",
        },
        body: "{}",
      }),
      body = await res.json();
    if (!res.ok) {
      publish(null);
      throw new ApiError(body, res.status);
    }
    publish(body.data);
    return token;
  };
  refreshPromise = (
    navigator.locks
      ? navigator.locks.request("nckh-auth-refresh", operation)
      : operation()
  ).finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}
export async function api(
  path,
  { method = "GET", body, key, raw = false, skipRefresh = false } = {},
) {
  if (
    !skipRefresh &&
    path !== "/auth/login" &&
    (!token || expiresAt < Date.now() + 30000)
  )
    await refresh();
  const headers = {
    "X-CSRF-Protection": "1",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  if (body !== undefined && !(body instanceof FormData))
    headers["Content-Type"] = "application/json";
  if (key) headers["Idempotency-Key"] = key;
  let res;
  try {
    res = await fetch(`/api/v1${path}`, {
      method,
      credentials: "same-origin",
      headers,
      body:
        body instanceof FormData
          ? body
          : body === undefined
            ? undefined
            : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      {
        error: {
          message:
            "Mất kết nối. Dữ liệu chưa được xác nhận lưu; bạn có thể thử lại.",
        },
      },
      0,
    );
  }
  if (res.status === 204) return null;
  if (raw) {
    if (!res.ok) throw new ApiError(await res.json(), res.status);
    return res.blob();
  }
  const result = await res.json();
  if (!res.ok) {
    if (res.status === 401 && !skipRefresh) publish(null);
    throw new ApiError(result, res.status);
  }
  return result;
}
export async function bootstrap() {
  try {
    await refresh();
    return user;
  } catch {
    return null;
  }
}
export const params = (values) => {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== "" && value !== undefined && value !== null)
      q.set(key, value);
  return q.toString();
};
export async function downloadCsv(query) {
  const blob = await api(`/reports/topics/export?${params(query)}`, {
      raw: true,
    }),
    url = URL.createObjectURL(blob),
    link = document.createElement("a");
  link.href = url;
  link.download = "bao-cao-nckh.csv";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
