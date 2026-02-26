/**
 * Creates one travel request via the app API (login + POST /api/travel/requests)
 * and writes the response to docs/travel-request-test-data.json for verification.
 * Run with: node scripts/create-travel-request-test.mjs
 * Requires: dev server running on http://localhost:3000
 */

const BASE = "http://localhost:3000";

const LOGIN_BODY = {
  email: "admin@enterprise.local",
  password: "Admin@12345",
};

const TRAVEL_REQUEST_BODY = {
  employeeName: "Admin User",
  employeeEmail: "admin@enterprise.local",
  employeeGrade: "staff",
  department: "Operations",
  costCenter: "CC-100",
  tripType: "domestic",
  origin: "Riyadh",
  destination: "Jeddah",
  departureDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  returnDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  purpose: "Test travel request for verification",
  travelClass: "economy",
  estimatedCost: 1500,
  currency: "SAR",
  linkedServiceBookingIds: [],
};

async function main() {
  console.log("Logging in...");
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(LOGIN_BODY),
    redirect: "manual",
  });

  if (!loginRes.ok) {
    const t = await loginRes.text();
    console.error("Login failed:", loginRes.status, t);
    process.exit(1);
  }

  const setCookie = loginRes.headers.get("set-cookie");
  if (!setCookie) {
    console.error("No Set-Cookie in login response");
    process.exit(1);
  }
  const sessionCookie = setCookie.split(";")[0];
  console.log("Login OK, creating travel request...");

  const createRes = await fetch(`${BASE}/api/travel/requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: sessionCookie,
    },
    body: JSON.stringify(TRAVEL_REQUEST_BODY),
  });

  if (!createRes.ok) {
    const err = await createRes.json().catch(() => ({}));
    console.error("Create travel request failed:", createRes.status, err);
    process.exit(1);
  }

  const request = await createRes.json();
  const fs = await import("fs");
  const path = await import("path");
  const docsDir = path.join(process.cwd(), "docs");
  const jsonPath = path.join(docsDir, "travel-request-test-data.json");
  const mdPath = path.join(docsDir, "travel-request-test-data.md");

  fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(request, null, 2), "utf8");
  console.log("Wrote", jsonPath);

  const md = `# بيانات طلب السفر للتحقق (Travel Request Test Data)

تم إنشاء الطلب عبر السكربت \`scripts/create-travel-request-test.mjs\` (تسجيل دخول + POST /api/travel/requests).

## بيانات مُسجّلة للتحقق

| الحقل | القيمة |
|-------|--------|
| **id** | ${request.id} |
| **status** | ${request.status} |
| **employeeName** | ${request.employeeName} |
| **employeeEmail** | ${request.employeeEmail} |
| **origin** | ${request.origin} |
| **destination** | ${request.destination} |
| **departureDate** | ${request.departureDate} |
| **returnDate** | ${request.returnDate} |
| **purpose** | ${request.purpose} |
| **estimatedCost** | ${request.estimatedCost} ${request.currency} |
| **createdAt** | ${request.createdAt} |
| **createdBy** | ${request.createdBy} |

## التحقق في الواجهة

1. افتح مركز العمليات: \`/en/operations\` أو \`/ar/operations\`.
2. اختر فلتر النوع "Travel" إن وُجد.
3. ابحث عن الطلب بالـ ID: **${request.id}** أو بالرحلة (${request.origin} → ${request.destination}).
4. انقر على الصف لفتح لوحة التفاصيل والتحقق من تبويبات Overview و Workflow.

الاستجابة الكاملة (JSON) محفوظة في \`travel-request-test-data.json\`.
`;

  fs.writeFileSync(mdPath, md, "utf8");
  console.log("Wrote", mdPath);
  console.log("Created travel request id:", request.id);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
