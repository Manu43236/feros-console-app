# FEROS Module Plan: Tyre Inventory List UX Refinement

## Summary
Web-only refinement to the Tyre Inventory list. Trims redundant row action buttons down to a single primary icon-button per status, adds a combined Supplier / Invoice column (client-important), and extends the search to match supplier name and invoice number. No DB, API, or mobile changes — all fields already exist on the Tyre entity, form, and detail sheet.

## Requirements
- **Who**: Office Staff / Admin / Store Keeper (web only)
- **Trigger**: Client wants supplier/invoice at a glance + less button clutter in rows
- **Scope**: `web/src/pages/inventory/TyreInventoryPage.tsx` ONLY
- **Out of scope**: DB/API/mobile; sorting/filtering by new column

## Mirror Module
Self — modifying the existing TyreInventoryPage. Detail sheet (lines 989–999) already holds Edit/Scrap, so removing them from rows loses nothing.

---

## Layer 1: Database
**N/A** — `supplierName` and `invoiceNumber` already on Tyre entity/type.

## Layer 2: API
**N/A** — fields already returned in tyre list response.

## Layer 4: Mobile
**N/A** — web-only request.

---

## Layer 3: Web (the only layer)

**File**: `web/src/pages/inventory/TyreInventoryPage.tsx`

### Change 1 — Trim row actions to one icon-button per status
Replace the row action cluster (lines ~1168–1206) so each status shows ONE ghost icon-button with a `title` tooltip:
- `IN_STOCK`   → **Truck** icon → `setFitTyre(tyre)` — "Fit to Vehicle"
- `FITTED`     → **Unplug** icon (red) → `setRemoveTyre(tyre)` — "Remove from Vehicle"
- `RETREADING` → **Undo2** icon (green) → `setBackToStock(tyre)` — "Back to Stock"
- `SCRAPPED`   → keep the "Scrapped" muted label
- **Remove** Edit + Scrap buttons from rows entirely (still available in detail sheet).

Icons added to the lucide import: `Truck, Unplug, Undo2`.
`stopPropagation` on the cell stays (so the icon click doesn't open the detail sheet).

### Change 2 — Combined "Supplier / Invoice" column
- Add one `<th>` header "Supplier / Invoice" after the "Retreads" column (before the actions `<th>`).
- Add one `<td>`: supplier name in medium gray text, invoice number as `text-xs text-gray-400` subtext below. Falls back to `—` when both empty.
- Bump table `min-w-[700px]` → `min-w-[820px]` to keep spacing comfortable.

### Change 3 — Extend search filter
In the `filtered` predicate (line ~1032), add:
```
(t.supplierName ?? '').toLowerCase().includes(q) ||
(t.invoiceNumber ?? '').toLowerCase().includes(q)
```
Update the search placeholder to mention supplier / invoice.

**Validation**: `npm run build` — zero TypeScript errors.

---

## Step-by-Step Tasks
- Task 3.1: Add `Truck, Unplug, Undo2` to lucide import
- Task 3.2: Extend `filtered` search predicate + placeholder text
- Task 3.3: Add "Supplier / Invoice" `<th>` + `<td>`; bump min-width
- Task 3.4: Replace row action cluster with one icon-button per status
- Task 3.5: `npm run build` clean

## Acceptance Criteria
- [ ] Rows show a single icon-button per status; Edit/Scrap gone from rows, still in sheet
- [ ] Supplier / Invoice column visible with supplier + invoice subtext
- [ ] Search matches supplier name and invoice number
- [ ] Row-click still opens detail sheet; icon-click does not
- [ ] `npm run build` passes with no TS errors
