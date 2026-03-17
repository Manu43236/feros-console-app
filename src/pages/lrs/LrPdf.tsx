import {
  Document, Page, Text, View, StyleSheet, Font, pdf,
} from '@react-pdf/renderer'
import type { Lr, LrCheckpost, LrCharge, Order } from '@/types'

// ── Register NotoSans (supports ₹ and all Indian text) ────────────────────
Font.register({
  family: 'NotoSans',
  fonts: [
    { src: '/NotoSans-Regular.ttf', fontWeight: 'normal' },
    { src: '/NotoSans-Bold.ttf',    fontWeight: 'bold'   },
  ],
})

// ── Brand colors ──────────────────────────────────────────────────────────
const C = {
  navy:       '#1E40AF',
  navyDark:   '#1e3a8a',
  navyLight:  '#EFF6FF',
  navyBorder: '#BFDBFE',
  orange:     '#EA580C',
  orangeLight:'#FFF7ED',
  green:      '#16a34a',
  greenLight: '#F0FDF4',
  red:        '#DC2626',
  redLight:   '#FEF2F2',
  gray:       '#6B7280',
  grayLight:  '#F9FAFB',
  border:     '#E5E7EB',
  text:       '#111827',
  muted:      '#6B7280',
}

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  CREATED:    { label: 'CREATED',    color: '#1D4ED8', bg: '#DBEAFE' },
  IN_TRANSIT: { label: 'IN TRANSIT', color: '#C2410C', bg: '#FED7AA' },
  DELIVERED:  { label: 'DELIVERED',  color: '#15803D', bg: '#BBF7D0' },
  CANCELLED:  { label: 'CANCELLED',  color: '#B91C1C', bg: '#FECACA' },
}

// ── Styles ────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    fontFamily: 'NotoSans', fontWeight: 'normal',
    fontSize: 9, color: C.text, backgroundColor: '#fff',
    paddingTop: 0, paddingBottom: 28, paddingHorizontal: 0,
  },

  // ── Top header band ──
  headerBand: {
    backgroundColor: C.navy,
    paddingHorizontal: 24, paddingTop: 18, paddingBottom: 16,
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
  },
  logoBox: {
    width: 44, height: 44, borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    border: '1pt solid rgba(255,255,255,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  logoText:    { fontSize: 14, fontWeight: 'bold', color: '#fff', letterSpacing: 1 },
  companyName: { fontSize: 18, fontWeight: 'bold', color: '#fff', letterSpacing: 0.3, marginBottom: 2 },
  companyTag:  { fontSize: 8,  color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5 },
  lrTag: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    border: '0.5pt solid rgba(255,255,255,0.4)',
    borderRadius: 4, paddingHorizontal: 10, paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  lrTagText: { fontSize: 11, fontWeight: 'bold', color: '#fff', letterSpacing: 1.5 },

  // ── Sub-header strip (LR number + status) ──
  subHeader: {
    backgroundColor: C.navyDark, paddingHorizontal: 24, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  lrNumber: { fontSize: 20, fontWeight: 'bold', color: '#fff', letterSpacing: 1 },
  lrDate:   { fontSize: 8.5, color: 'rgba(255,255,255,0.65)', marginTop: 1 },

  // ── Main content area ──
  body: { paddingHorizontal: 24, paddingTop: 16 },

  // ── Section ──
  section:      { marginBottom: 12 },
  sectionHeader: {
    backgroundColor: C.navyLight, borderLeft: '3pt solid ' + C.navy,
    paddingHorizontal: 8, paddingVertical: 4,
    marginBottom: 6,
  },
  sectionTitle: { fontSize: 7.5, fontWeight: 'bold', color: C.navy, textTransform: 'uppercase', letterSpacing: 1 },

  // ── Card ──
  card: { border: '0.5pt solid ' + C.border, borderRadius: 4, padding: 8 },

  // ── Grid helpers ──
  row2:  { flexDirection: 'row', gap: 10 },
  row3:  { flexDirection: 'row', gap: 10 },
  col:   { flex: 1 },
  col2:  { flex: 2 },

  // ── Field ──
  fieldLabel: { fontSize: 7, fontWeight: 'bold', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  fieldValue: { fontSize: 9.5, color: C.text },
  fieldValueBold: { fontSize: 9.5, fontWeight: 'bold', color: C.text },
  fieldItem: { marginBottom: 7 },

  // ── Weight stat cards ──
  weightGrid: { flexDirection: 'row', gap: 8 },
  weightCard: {
    flex: 1, borderRadius: 4, padding: 8,
    alignItems: 'center', border: '0.5pt solid ' + C.border,
  },
  weightLabel: { fontSize: 7, fontWeight: 'bold', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 },
  weightValue: { fontSize: 18, fontWeight: 'bold' },
  weightUnit:  { fontSize: 7.5, color: C.muted, marginTop: 1 },

  // ── Table ──
  table:       { borderRadius: 4, border: '0.5pt solid ' + C.border, overflow: 'hidden' },
  thead:       { flexDirection: 'row', backgroundColor: C.navy, paddingVertical: 5, paddingHorizontal: 8 },
  theadText:   { fontSize: 7.5, fontWeight: 'bold', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 },
  trow:        { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, borderTop: '0.5pt solid ' + C.border },
  trowAlt:     { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, borderTop: '0.5pt solid ' + C.border, backgroundColor: C.grayLight },
  td:          { fontSize: 8.5 },
  tdBold:      { fontSize: 8.5, fontWeight: 'bold' },
  tfoot:       { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, borderTop: '1pt solid ' + C.border, backgroundColor: '#F0F4FF' },

  // ── Status badge ──
  statusBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },

  // ── Overload warning ──
  alertBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.redLight, border: '0.5pt solid #FCA5A5',
    borderRadius: 4, padding: 6, marginTop: 6,
  },

  // ── Divider ──
  divider: { borderBottom: '0.5pt solid ' + C.border, marginVertical: 10 },

  // ── Signatures ──
  sigSection: { marginTop: 14, paddingHorizontal: 24 },
  sigGrid: { flexDirection: 'row', gap: 12 },
  sigBox: {
    flex: 1, border: '1pt solid ' + C.border, borderRadius: 4,
    padding: 8,
  },
  sigSpace:  { height: 48, marginBottom: 6 },
  sigDivide: { borderBottom: '0.5pt solid ' + C.border, marginBottom: 6 },
  sigLabel:  { fontSize: 8, fontWeight: 'bold', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center' },
  sigSub:    { fontSize: 7, color: C.muted, textAlign: 'center', marginTop: 2 },

  // ── Footer ──
  footer: {
    marginTop: 14, paddingHorizontal: 24, paddingTop: 8,
    borderTop: '1pt solid ' + C.border,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  footerText: { fontSize: 7.5, color: C.muted },
  footerBrand: { fontSize: 7.5, fontWeight: 'bold', color: C.navy },
})

// ── Helpers ───────────────────────────────────────────────────────────────
function fmtDate(s?: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtDateTime(s?: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ── PDF Document ──────────────────────────────────────────────────────────
export function LrPdfDocument({
  lr, order, checkposts, charges, companyName,
}: {
  lr: Lr
  order?: Order
  checkposts: LrCheckpost[]
  charges: LrCharge[]
  companyName: string
}) {
  const status     = STATUS[lr.lrStatus] ?? { label: lr.lrStatus, color: C.gray, bg: C.grayLight }
  const totalFines = checkposts.reduce((s, cp) => s + (cp.fineAmount ?? 0), 0)
  const totalCharges = charges.reduce((s, c) => s + c.amount, 0)
  const initials   = companyName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()

  return (
    <Document title={`LR ${lr.lrNumber}`} author={companyName}>
      <Page size="A4" style={S.page}>

        {/* ════════ HEADER BAND ════════ */}
        <View style={S.headerBand}>
          {/* Logo placeholder */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={S.logoBox}>
              <Text style={S.logoText}>{initials}</Text>
            </View>
            <View>
              <Text style={S.companyName}>{companyName}</Text>
              <Text style={S.companyTag}>TRANSPORT SERVICES</Text>
            </View>
          </View>
          {/* LR tag */}
          <View style={S.lrTag}>
            <Text style={S.lrTagText}>LORRY RECEIPT</Text>
          </View>
        </View>

        {/* ════════ SUB-HEADER (LR# + STATUS) ════════ */}
        <View style={S.subHeader}>
          <View>
            <Text style={S.lrNumber}>{lr.lrNumber}</Text>
            <Text style={S.lrDate}>Date: {fmtDate(lr.lrDate)}   |   Order: {lr.orderNumber}</Text>
          </View>
          <View style={[S.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={{ fontSize: 9, fontWeight: 'bold', color: status.color, letterSpacing: 0.8 }}>
              {status.label}
            </Text>
          </View>
        </View>

        {/* ════════ BODY ════════ */}
        <View style={S.body}>

          {/* ── Party Details ── */}
          <View style={S.section}>
            <View style={S.sectionHeader}>
              <Text style={S.sectionTitle}>Party Details</Text>
            </View>
            <View style={S.row2}>
              {/* Consignor (Source) */}
              <View style={[S.card, S.col]}>
                <Text style={[S.fieldLabel, { marginBottom: 4 }]}>Consignor (From)</Text>
                <Text style={S.fieldValueBold}>{order ? `${order.sourceCityName}, ${order.sourceStateName}` : '—'}</Text>
                {order?.sourceAddress
                  ? <Text style={[S.fieldValue, { color: C.muted, marginTop: 2 }]}>{order.sourceAddress}</Text>
                  : null}
              </View>
              {/* Arrow */}
              <View style={{ justifyContent: 'center', alignItems: 'center', width: 18 }}>
                <Text style={{ fontSize: 16, color: C.navy }}>→</Text>
              </View>
              {/* Consignee (Destination / Client) */}
              <View style={[S.card, S.col]}>
                <Text style={[S.fieldLabel, { marginBottom: 4 }]}>Consignee (To)</Text>
                <Text style={S.fieldValueBold}>{lr.clientName ?? '—'}</Text>
                {order
                  ? <Text style={[S.fieldValue, { color: C.muted, marginTop: 2 }]}>
                      {order.destinationCityName}, {order.destinationStateName}
                    </Text>
                  : null}
                {order?.destinationAddress
                  ? <Text style={[S.fieldValue, { color: C.muted, marginTop: 1 }]}>{order.destinationAddress}</Text>
                  : null}
              </View>
            </View>
          </View>

          {/* ── Vehicle Details ── */}
          <View style={S.section}>
            <View style={S.sectionHeader}>
              <Text style={S.sectionTitle}>Vehicle Details</Text>
            </View>
            <View style={[S.card, S.row3]}>
              <View style={[S.col, S.fieldItem]}>
                <Text style={S.fieldLabel}>Registration No.</Text>
                <Text style={S.fieldValueBold}>{lr.vehicleRegistrationNumber}</Text>
              </View>
              <View style={[S.col, S.fieldItem]}>
                <Text style={S.fieldLabel}>Vehicle Type</Text>
                <Text style={S.fieldValue}>{lr.vehicleTypeName ?? '—'}</Text>
              </View>
              <View style={[S.col, S.fieldItem]}>
                <Text style={S.fieldLabel}>Capacity</Text>
                <Text style={S.fieldValue}>{lr.vehicleCapacity} Tons</Text>
              </View>
              <View style={[S.col, S.fieldItem]}>
                <Text style={S.fieldLabel}>LR Date</Text>
                <Text style={S.fieldValue}>{fmtDate(lr.lrDate)}</Text>
              </View>
            </View>
          </View>

          {/* ── Material & Freight ── */}
          <View style={S.section}>
            <View style={S.sectionHeader}>
              <Text style={S.sectionTitle}>Material &amp; Freight</Text>
            </View>
            <View style={[S.card, S.row3]}>
              <View style={[S.col2, S.fieldItem]}>
                <Text style={S.fieldLabel}>Material</Text>
                <Text style={S.fieldValueBold}>{order?.materialTypeName ?? '—'}</Text>
              </View>
              <View style={[S.col, S.fieldItem]}>
                <Text style={S.fieldLabel}>Freight Rate</Text>
                <Text style={S.fieldValueBold}>
                  {order ? `Rs. ${Number(order.freightRate).toLocaleString('en-IN')}` : '—'}
                </Text>
              </View>
              <View style={[S.col, S.fieldItem]}>
                <Text style={S.fieldLabel}>Rate Type</Text>
                <Text style={S.fieldValue}>{order?.freightRateType?.replace(/_/g, ' ') ?? '—'}</Text>
              </View>
              <View style={[S.col, S.fieldItem]}>
                <Text style={S.fieldLabel}>Billing On</Text>
                <Text style={S.fieldValue}>{order?.billingOn?.replace(/_/g, ' ') ?? '—'}</Text>
              </View>
            </View>
          </View>

          {/* ── Weight Details ── */}
          <View style={S.section}>
            <View style={S.sectionHeader}>
              <Text style={S.sectionTitle}>Weight Details</Text>
            </View>
            <View style={S.weightGrid}>
              {/* Allocated */}
              <View style={[S.weightCard, { backgroundColor: C.navyLight, borderColor: C.navyBorder }]}>
                <Text style={[S.weightLabel, { color: C.navy }]}>Allocated</Text>
                <Text style={[S.weightValue, { color: C.navy }]}>{lr.allocatedWeight}</Text>
                <Text style={S.weightUnit}>Tons</Text>
              </View>
              {/* Loaded */}
              <View style={[S.weightCard, { backgroundColor: lr.loadedWeight != null ? '#FFF7ED' : C.grayLight, borderColor: lr.loadedWeight != null ? '#FED7AA' : C.border }]}>
                <Text style={[S.weightLabel, { color: lr.loadedWeight != null ? C.orange : C.muted }]}>Loaded</Text>
                {lr.loadedWeight != null
                  ? <Text style={[S.weightValue, { color: C.orange }]}>{lr.loadedWeight}</Text>
                  : <Text style={[S.weightValue, { fontSize: 14, color: C.muted }]}>—</Text>}
                <Text style={S.weightUnit}>{lr.loadedWeight != null ? 'Tons' : 'Not yet'}</Text>
              </View>
              {/* Delivered */}
              <View style={[S.weightCard, { backgroundColor: lr.deliveredWeight != null ? C.greenLight : C.grayLight, borderColor: lr.deliveredWeight != null ? '#86EFAC' : C.border }]}>
                <Text style={[S.weightLabel, { color: lr.deliveredWeight != null ? C.green : C.muted }]}>Delivered</Text>
                {lr.deliveredWeight != null
                  ? <Text style={[S.weightValue, { color: C.green }]}>{lr.deliveredWeight}</Text>
                  : <Text style={[S.weightValue, { fontSize: 14, color: C.muted }]}>—</Text>}
                <Text style={S.weightUnit}>{lr.deliveredWeight != null ? 'Tons' : 'Not yet'}</Text>
              </View>
              {/* Variance */}
              {lr.weightVariance != null ? (
                <View style={[S.weightCard, { backgroundColor: lr.isOverloaded ? C.redLight : C.greenLight, borderColor: lr.isOverloaded ? '#FCA5A5' : '#86EFAC' }]}>
                  <Text style={[S.weightLabel, { color: lr.isOverloaded ? C.red : C.green }]}>Variance</Text>
                  <Text style={[S.weightValue, { color: lr.isOverloaded ? C.red : C.green, fontSize: 14 }]}>
                    {lr.weightVariance > 0 ? '+' : ''}{lr.weightVariance}
                  </Text>
                  <Text style={[S.weightUnit, { color: lr.isOverloaded ? C.red : C.green }]}>
                    {lr.isOverloaded ? 'OVERLOADED' : 'Tons'}
                  </Text>
                </View>
              ) : (
                <View style={[S.weightCard, { backgroundColor: C.grayLight }]}>
                  <Text style={S.weightLabel}>Variance</Text>
                  <Text style={[S.weightValue, { fontSize: 14, color: C.muted }]}>—</Text>
                  <Text style={S.weightUnit}>Pending</Text>
                </View>
              )}
            </View>
            {lr.isOverloaded && (
              <View style={S.alertBox}>
                <Text style={{ fontSize: 9, fontWeight: 'bold', color: C.red }}>WARNING:</Text>
                <Text style={{ fontSize: 8.5, color: C.red }}>
                  Vehicle is overloaded by {lr.overloadWeight} tons above capacity ({lr.vehicleCapacity} T)
                </Text>
              </View>
            )}
          </View>

          {/* ── Timeline ── */}
          {(lr.loadedAt || lr.deliveredAt) && (
            <View style={S.section}>
              <View style={S.sectionHeader}>
                <Text style={S.sectionTitle}>Timeline</Text>
              </View>
              <View style={[S.card, S.row2]}>
                {lr.loadedAt && (
                  <View style={[S.col, S.fieldItem]}>
                    <Text style={S.fieldLabel}>Loaded At</Text>
                    <Text style={S.fieldValue}>{fmtDateTime(lr.loadedAt)}</Text>
                  </View>
                )}
                {lr.deliveredAt && (
                  <View style={[S.col, S.fieldItem]}>
                    <Text style={S.fieldLabel}>Delivered At</Text>
                    <Text style={S.fieldValue}>{fmtDateTime(lr.deliveredAt)}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* ── Checkposts ── */}
          {checkposts.length > 0 && (
            <View style={S.section}>
              <View style={S.sectionHeader}>
                <Text style={S.sectionTitle}>Checkposts ({checkposts.length})</Text>
              </View>
              <View style={S.table}>
                <View style={S.thead}>
                  <Text style={[S.theadText, { width: 22 }]}>#</Text>
                  <Text style={[S.theadText, { flex: 2.5 }]}>Checkpost</Text>
                  <Text style={[S.theadText, { flex: 2 }]}>Location</Text>
                  <Text style={[S.theadText, { flex: 1.5 }]}>Fine</Text>
                  <Text style={[S.theadText, { flex: 2 }]}>Receipt No.</Text>
                </View>
                {checkposts.map((cp, i) => (
                  <View key={cp.id ?? i} style={i % 2 === 0 ? S.trow : S.trowAlt}>
                    <Text style={[S.td, { width: 22 }]}>{i + 1}</Text>
                    <Text style={[S.tdBold, { flex: 2.5 }]}>{cp.checkpostName}</Text>
                    <Text style={[S.td, { flex: 2, color: C.muted }]}>{cp.location ?? '—'}</Text>
                    <Text style={[S.td, { flex: 1.5, color: cp.fineAmount ? C.red : C.text }]}>
                      {cp.fineAmount ? `Rs. ${cp.fineAmount.toLocaleString('en-IN')}` : '—'}
                    </Text>
                    <Text style={[S.td, { flex: 2, color: C.muted }]}>{cp.fineReceiptNumber ?? '—'}</Text>
                  </View>
                ))}
                {totalFines > 0 && (
                  <View style={[S.tfoot, { backgroundColor: '#FFF5F5' }]}>
                    <Text style={[S.tdBold, { flex: 1, color: C.red }]}>Total Fines</Text>
                    <Text style={[S.tdBold, { color: C.red }]}>Rs. {totalFines.toLocaleString('en-IN')}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* ── Additional Charges ── */}
          {charges.length > 0 && (
            <View style={S.section}>
              <View style={S.sectionHeader}>
                <Text style={S.sectionTitle}>Additional Charges ({charges.length})</Text>
              </View>
              <View style={S.table}>
                <View style={S.thead}>
                  <Text style={[S.theadText, { flex: 3 }]}>Charge Type</Text>
                  <Text style={[S.theadText, { flex: 3 }]}>Remarks</Text>
                  <Text style={[S.theadText, { flex: 1.5, textAlign: 'right' }]}>Amount</Text>
                </View>
                {charges.map((ch, i) => (
                  <View key={ch.id ?? i} style={i % 2 === 0 ? S.trow : S.trowAlt}>
                    <Text style={[S.tdBold, { flex: 3 }]}>{ch.chargeTypeName}</Text>
                    <Text style={[S.td, { flex: 3, color: C.muted }]}>{ch.remarks ?? '—'}</Text>
                    <Text style={[S.tdBold, { flex: 1.5, textAlign: 'right', color: C.navy }]}>
                      Rs. {ch.amount.toLocaleString('en-IN')}
                    </Text>
                  </View>
                ))}
                {charges.length > 1 && (
                  <View style={S.tfoot}>
                    <Text style={[S.tdBold, { flex: 1, color: C.navy }]}>Total Charges</Text>
                    <Text style={[S.tdBold, { color: C.navy }]}>Rs. {totalCharges.toLocaleString('en-IN')}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* ── Remarks ── */}
          {(lr.remarks || order?.specialInstructions || order?.remarks) && (
            <View style={S.section}>
              <View style={S.sectionHeader}>
                <Text style={S.sectionTitle}>Remarks</Text>
              </View>
              <View style={S.card}>
                {lr.remarks && (
                  <View style={S.fieldItem}>
                    <Text style={S.fieldLabel}>LR Remarks</Text>
                    <Text style={S.fieldValue}>{lr.remarks}</Text>
                  </View>
                )}
                {order?.specialInstructions && (
                  <View style={S.fieldItem}>
                    <Text style={S.fieldLabel}>Special Instructions</Text>
                    <Text style={S.fieldValue}>{order.specialInstructions}</Text>
                  </View>
                )}
                {order?.remarks && (
                  <View>
                    <Text style={S.fieldLabel}>Order Remarks</Text>
                    <Text style={S.fieldValue}>{order.remarks}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

        </View>{/* end body */}

        {/* ════════ SIGNATURES ════════ */}
        <View style={S.sigSection}>
          <View style={S.sectionHeader}>
            <Text style={S.sectionTitle}>Acknowledgement</Text>
          </View>
          <View style={S.sigGrid}>
            {/* Driver */}
            <View style={S.sigBox}>
              <View style={S.sigSpace} />
              <View style={S.sigDivide} />
              <Text style={S.sigLabel}>Driver Signature</Text>
              <Text style={S.sigSub}>{lr.vehicleRegistrationNumber}</Text>
            </View>
            {/* Company Seal */}
            <View style={S.sigBox}>
              <View style={{ height: 48, border: '0.5pt dashed ' + C.border, borderRadius: 4, marginBottom: 6, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 7.5, color: C.muted, textAlign: 'center' }}>COMPANY SEAL</Text>
              </View>
              <View style={S.sigDivide} />
              <Text style={S.sigLabel}>Authorized Signatory</Text>
              <Text style={S.sigSub}>{companyName}</Text>
            </View>
            {/* Receiver */}
            <View style={S.sigBox}>
              <View style={S.sigSpace} />
              <View style={S.sigDivide} />
              <Text style={S.sigLabel}>Receiver Signature</Text>
              <Text style={S.sigSub}>{lr.clientName ?? ''}</Text>
            </View>
          </View>
        </View>

        {/* ════════ FOOTER ════════ */}
        <View style={S.footer}>
          <Text style={S.footerText}>
            This is a system-generated document. Not valid without company seal.
          </Text>
          <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}>
            <Text style={S.footerText}>
              Created by {lr.createdByName}  |  {fmtDate(lr.createdAt)}
            </Text>
            <Text style={{ fontSize: 7.5, color: C.muted }}>  |  Powered by </Text>
            <Text style={S.footerBrand}>FEROS</Text>
          </View>
        </View>

      </Page>
    </Document>
  )
}

// ── Helper: generate blob and open in new tab ─────────────────────────────
export async function openLrPdf(
  lr: Lr,
  order: Order | undefined,
  checkposts: LrCheckpost[],
  charges: LrCharge[],
  companyName: string,
) {
  const blob = await pdf(
    <LrPdfDocument
      lr={lr}
      order={order}
      checkposts={checkposts}
      charges={charges}
      companyName={companyName}
    />
  ).toBlob()
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
}
