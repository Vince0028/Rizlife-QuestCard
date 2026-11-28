/**
 * End-to-end smoke tests: sign-in on each portal, portal role isolation, and the core
 * quest lifecycle (teacher creates → student submits → teacher stamps → student sees it).
 * Accounts are the fictional demo users seeded into the fresh local JSON DB.
 */
import { expect, test, type Page } from "@playwright/test";

const STUDENT = { url: "http://localhost:3001", email: "jdelacruz@student.apc.edu.ph", password: "Student@2026" };
const TEACHER = { url: "http://localhost:3002", email: "teacher@apc.edu.ph", password: "Teacher@RizLife2026" };
const ADMIN = { url: "http://localhost:3003", email: "admin@apc.edu.ph", password: "Admin@RizLife2026" };
const SEEDED_SECTION_ID = "sec_bsit_t2";

async function signIn(page: Page, who: { url: string; email: string; password: string }) {
  await page.goto(`${who.url}/login`);
  await page.locator('input[type="email"]').fill(who.email);
  await page.locator('input[type="password"]').fill(who.password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
}

test.describe("portal sign-in", () => {
  for (const who of [STUDENT, TEACHER, ADMIN]) {
    test(`${who.email} signs in on ${who.url}`, async ({ page }) => {
      await signIn(page, who);
      await expect(page).toHaveURL(`${who.url}/dashboard`);
    });
  }

  test("a teacher account is refused on the student portal", async ({ page }) => {
    await signIn(page, { ...TEACHER, url: STUDENT.url });
    await expect(page.getByText(/restricted to STUDENT accounts/i)).toBeVisible();
    await expect(page).toHaveURL(`${STUDENT.url}/login`);
  });

  test("workspace APIs reject anonymous callers", async ({ request }) => {
    const res = await request.get(`${TEACHER.url}/api/workspace/sections`);
    expect(res.status()).toBe(401);
  });
});

test("quest lifecycle: create → submit → stamp", async ({ browser }) => {
  const questTitle = `E2E Smoke Quest ${Date.now()}`;
  const submissionUrl = "https://www.openlearning.com/apc/courses/rizlife/e2e-smoke/post-1";

  // 1. Teacher creates a quest in the seeded section, with their real session cookie.
  const teacherCtx = await browser.newContext();
  const teacher = await teacherCtx.newPage();
  await signIn(teacher, TEACHER);
  await expect(teacher).toHaveURL(`${TEACHER.url}/dashboard`);
  const created = await teacher.evaluate(
    async ({ sectionId, title }) => {
      const res = await fetch("/api/workspace/quests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId,
          title,
          description: "Smoke-test quest created by Playwright.",
          category: "REFLECTION",
        }),
      });
      return { status: res.status, body: await res.json() };
    },
    { sectionId: SEEDED_SECTION_ID, title: questTitle }
  );
  expect(created.status, JSON.stringify(created.body)).toBe(201);

  // 2. Student finds it on the To-Do List and submits a link.
  const studentCtx = await browser.newContext();
  const student = await studentCtx.newPage();
  await signIn(student, STUDENT);
  await expect(student).toHaveURL(`${STUDENT.url}/dashboard`);
  await student.getByRole("button", { name: /To-Do List/ }).first().click();
  const row = student.locator("div.border", { hasText: questTitle }).last();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Open & Submit" }).click();
  await student.locator('input[type="url"]').fill(submissionUrl);
  await student.getByRole("button", { name: "Submit & Notify Teacher" }).click();
  await student.getByRole("button", { name: "Yes, Submit & Notify Teacher" }).click();
  await expect(student.getByText(/Submitted! Your request has been queued/)).toBeVisible();

  // 3. Teacher stamps it from the review queue.
  await teacher.reload();
  const pending = teacher.locator("div", { hasText: questTitle }).filter({
    has: teacher.getByRole("button", { name: /Approve & Stamp!/ }),
  }).last();
  await pending.getByRole("button", { name: /Approve & Stamp!/ }).click();
  await teacher.getByRole("button", { name: "Yes, Stamp Quest!" }).click();
  await expect(teacher.getByText(/Stamped Task #\d+/).first()).toBeVisible();

  // 4. Student sees the stamp.
  await student.keyboard.press("Escape");
  await student.reload();
  await student.getByRole("button", { name: /To-Do List/ }).first().click();
  const stampedRow = student.locator("div.border", { hasText: questTitle }).last();
  await expect(stampedRow.getByRole("button", { name: "View Stamp" })).toBeVisible();

  await teacherCtx.close();
  await studentCtx.close();
});
