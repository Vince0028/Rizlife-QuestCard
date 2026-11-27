/**
 * Supabase-backend checks for lazy columns (EmailDigestLog.htmlPreview), run against an
 * in-memory fake PostgREST: snapshots must not download the column, and reads that
 * need it must fetch it for just the returned rows.
 */
import assert from "node:assert/strict";
import { prisma } from "../db";

type Row = Record<string, unknown>;

const TABLES = ["User", "Section", "Enrollment", "Quest", "Submission", "EmailDigestLog", "SystemSetting"];

function createFakePostgrest(tables: Record<string, Row[]>) {
  const requests: string[] = [];
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const table = decodeURIComponent(url.pathname.split("/").pop() ?? "");
    const method = init?.method ?? "GET";
    requests.push(`${method} ${table}?${decodeURIComponent(url.search.slice(1))}`);
    const rows = tables[table] ?? [];
    const pick = (row: Row, select: string | null) => {
      if (!select || select === "*") return { ...row };
      const out: Row = {};
      for (const c of select.split(",").map((s) => s.replace(/"/g, ""))) out[c] = row[c];
      return out;
    };
    if (method === "POST") {
      const body = JSON.parse(String(init?.body)) as Row;
      rows.push(body);
      tables[table] = rows;
      return Response.json([body], { status: 201 });
    }
    const select = url.searchParams.get("select");
    const idFilter = url.searchParams.get("id");
    let result = rows;
    if (idFilter?.startsWith("in.(")) {
      const ids = idFilter.slice(4, -1).split(",").map((s) => s.replace(/"/g, ""));
      result = rows.filter((r) => ids.includes(String(r.id)));
    }
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Number(url.searchParams.get("limit") ?? result.length);
    const page = result.slice(offset, offset + limit).map((r) => pick(r, select));
    return Response.json(page, {
      headers: { "content-range": `${offset}-${offset + page.length - 1}/${result.length}` },
    });
  };
  return { fetchImpl, requests };
}

export async function runAdapterLazyColumnChecks() {
  const now = new Date().toISOString();
  const tables: Record<string, Row[]> = Object.fromEntries(TABLES.map((t) => [t, []]));
  tables.User.push({
    id: "u_t", firstName: "Lazy", lastName: "Teacher", email: "lazy.teacher@apc.edu.ph",
    role: "TEACHER", mustChangePassword: false, isActive: true, createdAt: now, updatedAt: now,
  });
  tables.Section.push({
    id: "s_lazy", code: "LAZY1", name: "Lazy", term: "T", teacherId: "u_t",
    leaderboardVisible: false, digestThreshold: 20, digestEnabled: true, createdAt: now, updatedAt: now,
  });
  for (const id of ["log_1", "log_2"]) {
    tables.EmailDigestLog.push({
      id, teacherId: "u_t", sectionId: "s_lazy", recipientEmail: "lazy.teacher@apc.edu.ph",
      subject: `Digest ${id}`, submissionCount: 1, triggerType: "MANUAL",
      deliveryStatus: "PREVIEW_ONLY", htmlPreview: `<p>${id}</p>`, errorMessage: null, sentAt: now,
    });
  }

  const fake = createFakePostgrest(tables);
  const realFetch = globalThis.fetch;
  globalThis.fetch = fake.fetchImpl as typeof fetch;
  process.env.SUPABASE_URL = "https://fake-project.supabase.co";
  process.env.SUPABASE_SECRET_KEY = "fake-secret";
  try {
    // A select without htmlPreview never asks for it.
    const listed = await prisma.emailDigestLog.findMany({
      where: { sectionId: "s_lazy" },
      select: { id: true, subject: true },
    });
    assert.equal(listed.length, 2);
    const snapshotReq = fake.requests.find((r) => r.startsWith("GET EmailDigestLog?select="));
    assert.ok(snapshotReq, "snapshot pulled EmailDigestLog");
    assert.ok(!snapshotReq!.includes("htmlPreview"), `snapshot must exclude htmlPreview: ${snapshotReq}`);
    assert.ok(!fake.requests.some((r) => r.includes("htmlPreview")), "no htmlPreview fetched for list");

    // Reading the full row loads htmlPreview for that one row only.
    const one = await prisma.emailDigestLog.findUnique({ where: { id: "log_2" } });
    assert.equal(one?.htmlPreview, "<p>log_2</p>");
    const lazyReqs = fake.requests.filter((r) => r.includes("htmlPreview"));
    assert.equal(lazyReqs.length, 1);
    assert.ok(lazyReqs[0].includes('"log_2"') && !lazyReqs[0].includes('"log_1"'), lazyReqs[0]);

    // A created row is returned in full; the snapshot copy stays without the column.
    const created = await prisma.emailDigestLog.create({
      data: {
        teacherId: "u_t", sectionId: "s_lazy", recipientEmail: "lazy.teacher@apc.edu.ph",
        subject: "New", submissionCount: 2, triggerType: "MANUAL", deliveryStatus: "SENT",
        htmlPreview: "<p>new</p>",
      },
    });
    assert.equal(created.htmlPreview, "<p>new</p>");
    const again = await prisma.emailDigestLog.findUnique({ where: { id: created.id } });
    assert.equal(again?.htmlPreview, "<p>new</p>", "lazy column re-fetched after create");
  } finally {
    globalThis.fetch = realFetch;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SECRET_KEY;
  }
}
