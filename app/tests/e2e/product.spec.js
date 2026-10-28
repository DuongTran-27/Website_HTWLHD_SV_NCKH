import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
const shots = "app/docs/screenshots";
mkdirSync(shots, { recursive: true });
async function signIn(page, account) {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill(`${account}@demo.test`);
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill(process.env.DEMO_PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập vào hệ thống" }).click();
  await expect(
    page.getByRole("heading", { name: "Không gian nghiên cứu", exact: true }),
  ).toBeVisible();
}
function errors(page) {
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  return failures;
}
test("Sinh viên: dashboard, kho đề tài, lọc, workspace và trạng thái kho tài liệu", async ({
  page,
}) => {
  const failures = errors(page);
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Đăng nhập", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: `${shots}/01-dang-nhap.png`, fullPage: true });
  await signIn(page, "student5");
  await expect(
    page.getByText("Nền tảng chia sẻ tài liệu học tập theo học phần", {
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: `${shots}/02-tong-quan-sinh-vien.png`,
    fullPage: true,
  });
  await page.getByRole("link", { name: "Kho đề tài", exact: true }).click();
  await page.getByLabel("Tìm kiếm", { exact: true }).fill("không khí");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(
    page.getByText(
      "Phân tích chất lượng không khí trong khuôn viên trường học",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("link", { name: "Đề tài của tôi", exact: true }).click();
  await page
    .getByRole("link", {
      name: "Nền tảng chia sẻ tài liệu học tập theo học phần",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Nội dung nghiên cứu",
      exact: true,
      level: 2,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Mốc & tiến độ", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Nhật ký nghiên cứu", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Cập nhật tiến độ", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Tiến độ tự khai (%)").fill("55");
  await dialog
    .getByLabel("Công việc đã hoàn thành")
    .fill("Hoàn thiện giao diện và kiểm tra các luồng trong trình duyệt.");
  await dialog
    .getByLabel("Kế hoạch tiếp theo")
    .fill("Tích hợp kho tài liệu và hoàn thiện báo cáo nghiên cứu.");
  await dialog
    .getByRole("button", { name: "Cập nhật tiến độ", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByText(
      "Hoàn thiện giao diện và kiểm tra các luồng trong trình duyệt.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("link", { name: "Thay đổi & hủy", exact: true }).click();
  await expect(
    page.locator(".period-milestones").filter({ hasText: "Sinh viên Demo 10" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Mời Sinh viên Demo 10", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Tài liệu & báo cáo", exact: true })
    .click();
  await page.locator("input[type=file]").setInputFiles({
    name: "report.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.7\n%%EOF"),
  });
  await expect(page.getByRole("alert")).toContainText(
    "Kho tài liệu chưa được cấu hình",
  );
  await page.screenshot({
    path: `${shots}/03-kho-tai-lieu-chua-cau-hinh.png`,
    fullPage: true,
  });
  expect(failures).toEqual([]);
});
test("Sinh viên: tạo nhóm, lưu/sửa đề tài, đề nghị hướng dẫn và đối chiếu thật", async ({
  page,
}) => {
  const failures = errors(page);
  await signIn(page, "student11");
  await page
    .getByRole("link", { name: "Nhóm nghiên cứu", exact: true })
    .click();
  await page.getByRole("button", { name: "Tạo nhóm mới" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Tên nhóm").fill("Nhóm E2E hành trình ý tưởng");
  await dialog
    .getByLabel("Đợt nghiên cứu")
    .selectOption({ label: "Đợt nghiên cứu sinh viên 2026–2027 · CNTT" });
  await dialog
    .getByRole("button", { name: "Tạo nhóm nghiên cứu", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByText("Nhóm E2E hành trình ý tưởng", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Tạo hồ sơ đề tài", exact: true })
    .click();
  await page
    .getByLabel("Tên đề tài", { exact: true })
    .fill("Nghiên cứu xây dựng trợ lý học tập theo học phần thử nghiệm");
  await page
    .getByLabel("Lĩnh vực nghiên cứu")
    .selectOption({ label: "Công nghệ phần mềm" });
  await page
    .getByLabel("Tóm tắt", { exact: true })
    .fill(
      "Nghiên cứu xây dựng không gian theo dõi quá trình học tập cho sinh viên. Giải pháp hỗ trợ quản lý kế hoạch, lưu trữ học liệu và đánh giá tiến bộ trong học phần bằng các tình huống thử nghiệm có kiểm soát.",
    );
  await page
    .getByLabel("Mục tiêu nghiên cứu", { exact: true })
    .fill(
      "Xây dựng hệ thống và đánh giá khả năng hỗ trợ theo dõi tiến độ học tập của sinh viên theo từng học phần.",
    );
  await page
    .getByLabel("Nội dung nghiên cứu", { exact: true })
    .fill(
      "Khảo sát nhu cầu của sinh viên và giảng viên trong quá trình học tập. Phân tích yêu cầu quản lý kế hoạch, thiết kế cơ sở dữ liệu và xây dựng nguyên mẫu. Kiểm thử các chức năng trên dữ liệu hư cấu, đánh giá kết quả, xác định giới hạn và đề xuất các hướng phát triển tiếp theo trong phạm vi học phần.",
    );
  await page
    .getByLabel("Phương pháp nghiên cứu", { exact: true })
    .fill("Khảo sát, phân tích yêu cầu và kiểm thử thực nghiệm.");
  await page
    .getByLabel("Sản phẩm dự kiến", { exact: true })
    .fill("Nguyên mẫu website và báo cáo đánh giá.");
  await page
    .getByRole("button", { name: "Lưu hồ sơ nháp", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Nội dung nghiên cứu",
      exact: true,
      level: 2,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Đối chiếu", exact: true }).click();
  await page.getByRole("button", { name: "Kiểm tra lại", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Kết quả gần nhất", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `${shots}/04-doi-chieu-tuong-tu.png`,
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Tổng quan", exact: true })
    .last()
    .click();
  await page
    .getByRole("button", { name: "Đề nghị hướng dẫn", exact: true })
    .click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Giảng viên hướng dẫn")
    .selectOption({ label: "TS. Giảng viên Minh họa A" });
  await dialog
    .getByRole("button", { name: "Đề nghị hướng dẫn", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByText("Hướng dẫn: Đang chờ", { exact: true }),
  ).toBeVisible();
  expect(failures).toEqual([]);
});
test("Giảng viên: phản hồi hướng dẫn, sinh viên gửi, cán bộ xem snapshot và phê duyệt", async ({
  browser,
}) => {
  const lecturer = await browser.newContext(),
    student = await browser.newContext(),
    staff = await browser.newContext();
  const l = await lecturer.newPage(),
    s = await student.newPage(),
    f = await staff.newPage();
  await signIn(l, "lecturer1");
  await l
    .getByRole("link", { name: "Hướng dẫn nghiên cứu", exact: true })
    .click();
  const card = l.locator(".request-list article").filter({
    hasText: "Nghiên cứu xây dựng trợ lý học tập theo học phần thử nghiệm",
  });
  await card
    .getByRole("button", { name: "Đồng ý hướng dẫn", exact: true })
    .click();
  await l
    .getByRole("dialog")
    .getByRole("button", { name: "Đồng ý hướng dẫn", exact: true })
    .click();
  await expect(l.getByRole("dialog")).toBeHidden();
  await signIn(s, "student11");
  await s.getByRole("link", { name: "Đề tài của tôi", exact: true }).click();
  await s
    .getByRole("link", {
      name: "Nghiên cứu xây dựng trợ lý học tập theo học phần thử nghiệm",
      exact: true,
    })
    .click();
  await s.getByRole("button", { name: "Gửi xét duyệt", exact: true }).click();
  await s
    .getByRole("dialog")
    .getByRole("button", { name: "Gửi xét duyệt", exact: true })
    .click();
  await expect(s.getByRole("dialog")).toBeHidden();
  await expect(
    s.getByText("Chờ xét duyệt", { exact: true }).first(),
  ).toBeVisible();
  await signIn(f, "staff");
  await f
    .getByRole("link", { name: "Hàng chờ xét duyệt", exact: true })
    .click();
  await f
    .getByRole("link", {
      name: "Nghiên cứu xây dựng trợ lý học tập theo học phần thử nghiệm",
      exact: true,
    })
    .click();
  await f.getByText(/Xem hồ sơ gửi lần 1/).click();
  await f.getByRole("button", { name: "Phê duyệt hồ sơ", exact: true }).click();
  const dialog = f.getByRole("dialog");
  await dialog
    .getByLabel("Lý do chấp thuận nếu có cảnh báo tương tự")
    .fill(
      "Hồ sơ đã được xem xét trong kiểm thử trình duyệt và chấp thuận theo phạm vi.",
    );
  await dialog
    .getByRole("button", { name: "Phê duyệt hồ sơ", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await expect(
    f.getByText("Đã phê duyệt", { exact: true }).first(),
  ).toBeVisible();
  await f.screenshot({
    path: `${shots}/05-can-bo-phe-duyet.png`,
    fullPage: true,
  });
  await lecturer.close();
  await student.close();
  await staff.close();
});
test("Cán bộ: thống kê, bộ lọc và tải CSV", async ({ page }) => {
  await signIn(page, "staff");
  await page
    .getByRole("link", { name: "Thống kê & báo cáo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /đề tài trong báo cáo/ }),
  ).toBeVisible();
  await page.getByLabel("Trạng thái", { exact: true }).selectOption("approved");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Xuất báo cáo CSV", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe("bao-cao-nckh.csv");
  await page.screenshot({
    path: `${shots}/06-thong-ke-bao-cao.png`,
    fullPage: true,
  });
});
test("Quản trị: danh mục, tài khoản, phạm vi và không có hàng chờ duyệt", async ({
  page,
}) => {
  const failures = errors(page);
  await signIn(page, "admin");
  await expect(
    page.getByRole("link", { name: "Hàng chờ xét duyệt", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Danh mục", exact: true }).click();
  await page.getByRole("button", { name: "Thêm khoa", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Mã danh mục").fill("E2E");
  await dialog.getByLabel("Tên danh mục").fill("Khoa kiểm thử trình duyệt");
  await dialog.getByRole("button", { name: "Thêm khoa", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByText("Khoa kiểm thử trình duyệt", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Tài khoản", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Quản lý tài khoản", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Vai trò & phạm vi", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Phân quyền tài khoản", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: `${shots}/07-quan-tri-phan-quyen.png`,
    fullPage: true,
  });
  expect(failures).toEqual([]);
});
test("Điện thoại: bố cục responsive và điều hướng", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "student1");
  await expect(
    page.getByRole("button", { name: "Mở điều hướng" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Mở điều hướng" }).click();
  await page.getByRole("link", { name: "Đợt đăng ký", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Đợt đăng ký nghiên cứu", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: `${shots}/08-mobile.png`, fullPage: true });
});
test("Phiên: reload, hai tab refresh đồng thời và logout", async ({
  page,
  context,
}) => {
  await signIn(page, "student1");
  const second = await context.newPage();
  await Promise.all([page.reload(), second.goto("/")]);
  await expect(
    page.getByRole("heading", { name: "Không gian nghiên cứu", exact: true }),
  ).toBeVisible();
  await expect(
    second.getByRole("heading", { name: "Không gian nghiên cứu", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Đăng nhập", exact: true }),
  ).toBeVisible();
  await expect(
    second.getByRole("heading", { name: "Đăng nhập", exact: true }),
  ).toBeVisible();
});
test("Cán bộ: cấu hình đợt, mốc mẫu và thêm mốc thực hiện qua form", async ({
  page,
}) => {
  await signIn(page, "staff");
  await page.getByRole("link", { name: "Đợt đăng ký", exact: true }).click();
  await page.getByRole("link", { name: "Mở đợt đăng ký", exact: true }).click();
  const now = Date.now(),
    start = now - 86400000,
    end = now + 20 * 86400000,
    vn = (value) => new Date(value + 7 * 3600000).toISOString().slice(0, 16);
  await page
    .getByLabel("Khoa", { exact: true })
    .selectOption({ label: "Khoa Công nghệ thông tin" });
  await page
    .getByLabel("Tên đợt", { exact: true })
    .fill("Đợt E2E cấu hình mốc nghiên cứu");
  await page.getByLabel("Bắt đầu đăng ký", { exact: true }).fill(vn(start));
  await page.getByLabel("Kết thúc đăng ký", { exact: true }).fill(vn(end));
  await page.getByRole("button", { name: "Thêm mốc mẫu", exact: true }).click();
  await page
    .getByLabel("Tên mốc 4", { exact: true })
    .fill("Mốc kiểm tra bổ sung");
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/research-periods") &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  const created = await (await response).json();
  expect(created.data.milestoneTemplates).toHaveLength(4);
  expect(created.data.registrationStart).toBe(
    new Date(Math.floor(start / 60000) * 60000).toISOString(),
  );
  await expect(
    page.getByRole("heading", {
      name: "Đợt E2E cấu hình mốc nghiên cứu",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Đề tài của tôi", exact: true }).click();
  await page
    .getByRole("link", {
      name: "Nền tảng chia sẻ tài liệu học tập theo học phần",
      exact: true,
    })
    .click();
  await page.getByRole("link", { name: "Mốc & tiến độ", exact: true }).click();
  await page.getByRole("button", { name: "Thêm mốc", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Mã mốc", { exact: true }).fill("E2E_STAGE");
  await dialog
    .getByLabel("Tên mốc", { exact: true })
    .fill("Kiểm tra tích hợp trình duyệt");
  await dialog
    .getByLabel("Hạn hoàn thành", { exact: true })
    .fill(vn(now + 35 * 86400000));
  await dialog
    .getByLabel("Đầu ra dự kiến", { exact: true })
    .fill("Báo cáo kết quả kiểm tra các chức năng trên trình duyệt.");
  await dialog
    .getByRole("button", { name: "Thêm mốc thực hiện", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("heading", {
      name: "Kiểm tra tích hợp trình duyệt",
      exact: true,
    }),
  ).toBeVisible();
});
