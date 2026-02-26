# بيانات طلب السفر للتحقق (Travel Request Test Data)

تم إنشاء الطلب عبر السكربت `scripts/create-travel-request-test.mjs` (تسجيل دخول + POST /api/travel/requests).

## بيانات مُسجّلة للتحقق

| الحقل | القيمة |
|-------|--------|
| **id** | TRV-1001 |
| **status** | draft |
| **employeeName** | Admin User |
| **employeeEmail** | admin@enterprise.local |
| **origin** | Riyadh |
| **destination** | Jeddah |
| **departureDate** | 2026-03-02 |
| **returnDate** | 2026-03-04 |
| **purpose** | Test travel request for verification |
| **estimatedCost** | 1500 SAR |
| **createdAt** | 2026-02-25T21:18:40.918Z |
| **createdBy** | System Administrator |

## التحقق في الواجهة

1. افتح مركز العمليات: `/en/operations` أو `/ar/operations`.
2. اختر فلتر النوع "Travel" إن وُجد.
3. ابحث عن الطلب بالـ ID: **TRV-1001** أو بالرحلة (Riyadh → Jeddah).
4. انقر على الصف لفتح لوحة التفاصيل والتحقق من تبويبات Overview و Workflow.

الاستجابة الكاملة (JSON) محفوظة في `travel-request-test-data.json`.
