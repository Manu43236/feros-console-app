import {
  Document, Page, Text, View, StyleSheet, Font, pdf,
} from '@react-pdf/renderer'
import type { Lr, LrCheckpost, LrCharge, Order } from '@/types'

Font.register({
  family: 'NotoSans',
  fonts: [
    { src: '/NotoSans-Regular.ttf', fontWeight: 'normal' },
    { src: '/NotoSans-Bold.ttf',    fontWeight: 'bold'   },
  ],
})

const NAVY   = '#1E3A5F'
const BORDER = '#1E3A5F'

export type TenantInfo = {
  companyName: string
  address?: string
  gstin?: string
  panNumber?: string
  ownerName?: string
}

// ── Column flex widths ─────────────────────────────────────────────────────
const C = {
  pkg:       0.65,
  material:  2.2,
  wtActual:  0.85,
  wtCharged: 0.85,
  rate:      1.3,
  frtRs:     0.85,
  frtPs:     0.55,
  remarks:   1.2,
}

// ── Styles ─────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  page: {
    fontFamily: 'NotoSans',
    fontWeight: 'normal',
    fontSize: 8,
    color: '#000',
    backgroundColor: '#fff',
    padding: 14,
  },

  // Header
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  panGstin:     { fontSize: 7, fontWeight: 'bold' },
  companyName:  { fontSize: 15, fontWeight: 'bold', textAlign: 'center', color: NAVY, marginBottom: 2 },
  address:      { fontSize: 7,  textAlign: 'center', color: '#555' },
  divider:      { borderBottom: `1.5pt solid ${BORDER}`, marginVertical: 5 },

  // Info section (consignor/consignee + LR box)
  infoSection: { flexDirection: 'row', border: `1pt solid ${BORDER}`, marginTop: 5 },
  infoLeft:    { flex: 2.2, borderRight: `1pt solid ${BORDER}`, padding: 5 },
  infoRight:   { flex: 1 },

  fieldLabel:  { fontSize: 7.5, fontWeight: 'bold' },
  dotLine:     { borderBottom: '0.8pt dotted #888', marginTop: 10, marginBottom: 3 },
  filledValue: { fontSize: 7.5, fontWeight: 'bold', color: NAVY, marginTop: 2 },
  subValue:    { fontSize: 7, color: '#555', marginTop: 1 },

  fromToRow:   { flexDirection: 'row', marginTop: 7, alignItems: 'flex-end', gap: 3 },
  fromToLabel: { fontSize: 7.5, fontWeight: 'bold' },
  fromToDot:   { flex: 1, borderBottom: '0.8pt dotted #888', marginBottom: 2 },

  // LR No / Date / Vehicle box
  detailRow:      { flexDirection: 'row', borderBottom: `1pt solid ${BORDER}`, padding: 4, alignItems: 'center' },
  detailRowLast:  { flex: 1, padding: 4 },
  detailLabel:    { fontSize: 7, fontWeight: 'bold', width: 28 },
  detailColon:    { fontSize: 7, width: 5 },
  detailValue:    { fontSize: 7.5, fontWeight: 'bold', color: NAVY, flex: 1 },
  vehicleLabel:   { fontSize: 7, fontWeight: 'bold', textAlign: 'center', marginBottom: 4 },
  vehicleValue:   { fontSize: 9, fontWeight: 'bold', color: NAVY, textAlign: 'center' },
  vehicleSubText: { fontSize: 6.5, textAlign: 'center', color: '#555', marginTop: 2 },
  vehicleBlock:   { flex: 1, borderTop: `1pt solid ${BORDER}`, padding: 4 },

  // Main table
  table:      { border: `1pt solid ${BORDER}`, marginTop: 0 },
  th1Row:     { flexDirection: 'row', borderBottom: `0.5pt solid ${BORDER}`, backgroundColor: '#EFF6FF' },
  th2Row:     { flexDirection: 'row', borderBottom: `1pt solid ${BORDER}`, backgroundColor: '#EFF6FF' },
  th:         { fontSize: 6.5, fontWeight: 'bold', textAlign: 'center', padding: 3, borderRight: `0.5pt solid ${BORDER}` },
  thLast:     { fontSize: 6.5, fontWeight: 'bold', textAlign: 'center', padding: 3 },
  dataRow:    { flexDirection: 'row', borderBottom: `0.5pt solid ${BORDER}`, minHeight: 20 },
  td:         { fontSize: 8,   padding: 3, borderRight: `0.5pt solid ${BORDER}`, textAlign: 'center' },
  tdLeft:     { fontSize: 8,   padding: 3, borderRight: `0.5pt solid ${BORDER}` },
  tdLast:     { fontSize: 7.5, padding: 3, textAlign: 'center' },
  totalRow:   { flexDirection: 'row', borderTop: `1pt solid ${BORDER}`, backgroundColor: '#EFF6FF' },

  // Footer
  footerSection: { flexDirection: 'row', border: `1pt solid ${BORDER}`, borderTop: 'none' },
  footerLeft:    { flex: 1.3, padding: 6, borderRight: `1pt solid ${BORDER}` },
  footerRight:   { flex: 1, padding: 6, justifyContent: 'space-between', alignItems: 'flex-end' },
  footerOwner:   { fontSize: 7.5, marginBottom: 8 },
  footerLine:    { flexDirection: 'row', alignItems: 'flex-end', gap: 3, marginBottom: 7 },
  footerLineLabel: { fontSize: 7.5, fontWeight: 'bold' },
  footerDot:     { flex: 1, borderBottom: '0.8pt dotted #888', marginBottom: 2 },
  footerFor:     { fontSize: 7.5, fontWeight: 'bold' },
  footerSig:     { fontSize: 7.5, fontWeight: 'bold', marginTop: 24 },

  poweredBy: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  poweredByText: { fontSize: 6, color: '#bbb' },
})

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmtDate(s?: string | null) {
  if (!s) return ''
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function calcFreight(order?: Order, lr?: Lr) {
  if (!order || !lr) return { rs: 0, ps: 0, total: 0 }
  const billingWeight = order.billingOn === 'LOADED_WEIGHT'
    ? Number(lr.loadedWeight ?? 0)
    : Number(lr.deliveredWeight ?? lr.loadedWeight ?? 0)
  let total = 0
  if (order.freightRateType === 'PER_TON')  total = Number(order.freightRate) * billingWeight
  else if (order.freightRateType === 'PER_TRIP') total = Number(order.freightRate)
  const rs = Math.floor(total)
  const ps = Math.round((total - rs) * 100)
  return { rs, ps, total }
}

// ── PDF Document ─────────────────────────────────────────────────────────────
export function LrPdfDocument({
  lr, order, checkposts, charges, tenant,
}: {
  lr: Lr
  order?: Order
  checkposts: LrCheckpost[]
  charges: LrCharge[]
  tenant: TenantInfo
}) {
  const freight = calcFreight(order, lr)

  const billingWeight = order?.billingOn === 'LOADED_WEIGHT'
    ? lr.loadedWeight
    : (lr.deliveredWeight ?? lr.loadedWeight)

  const rateText = order
    ? `Rs. ${Number(order.freightRate).toLocaleString('en-IN')} / ${order.freightRateType?.replace(/_/g, ' ')}`
    : '—'

  const consignorCity = order
    ? [order.sourceCityName, order.sourceStateName].filter(Boolean).join(', ')
    : ''
  const consigneeCity = order
    ? [order.destinationCityName, order.destinationStateName].filter(Boolean).join(', ')
    : ''

  const totalFines   = checkposts.reduce((s, cp) => s + (cp.fineAmount ?? 0), 0)
  const totalCharges = charges.reduce((s, ch) => s + ch.amount, 0)
  const grandTotal   = freight.total + totalCharges + totalFines

  return (
    <Document title={`LR ${lr.lrNumber}`} author={tenant.companyName}>
      <Page size="A5" style={S.page}>

        {/* ══ HEADER ══ */}
        <View style={S.headerTopRow}>
          <Text style={S.panGstin}>{tenant.panNumber ? `PAN : ${tenant.panNumber}` : ''}</Text>
          <Text style={S.panGstin}>{tenant.gstin    ? `GSTIN : ${tenant.gstin}`    : ''}</Text>
        </View>

        <Text style={S.companyName}>{tenant.companyName}</Text>
        {tenant.address ? <Text style={S.address}>{tenant.address}</Text> : null}

        <View style={S.divider} />

        {/* ══ INFO SECTION ══ */}
        <View style={S.infoSection}>

          {/* Left — consignor / consignee / from-to */}
          <View style={S.infoLeft}>
            <Text style={S.fieldLabel}>Consignor's Name &amp; Address</Text>
            <View style={S.dotLine} />
            {consignorCity ? <Text style={S.filledValue}>{consignorCity}</Text> : null}
            {order?.sourceAddress ? <Text style={S.subValue}>{order.sourceAddress}</Text> : null}

            <View style={{ marginTop: 7 }}>
              <Text style={S.fieldLabel}>Consignee Name &amp; Address</Text>
              <View style={S.dotLine} />
              {lr.clientName ? <Text style={S.filledValue}>{lr.clientName}</Text> : null}
              {consigneeCity  ? <Text style={S.subValue}>{consigneeCity}</Text> : null}
              {order?.destinationAddress ? <Text style={S.subValue}>{order.destinationAddress}</Text> : null}
            </View>

            <View style={S.fromToRow}>
              <Text style={S.fromToLabel}>From</Text>
              <View style={S.fromToDot}>
                {order?.sourceCityName
                  ? <Text style={{ fontSize: 7.5, fontWeight: 'bold', color: NAVY, textAlign: 'center' }}>
                      {order.sourceCityName}
                    </Text>
                  : null}
              </View>
              <Text style={S.fromToLabel}>To</Text>
              <View style={S.fromToDot}>
                {order?.destinationCityName
                  ? <Text style={{ fontSize: 7.5, fontWeight: 'bold', color: NAVY, textAlign: 'center' }}>
                      {order.destinationCityName}
                    </Text>
                  : null}
              </View>
            </View>
          </View>

          {/* Right — LR No / Date / Vehicle */}
          <View style={S.infoRight}>
            <View style={S.detailRow}>
              <Text style={S.detailLabel}>No.</Text>
              <Text style={S.detailColon}>:</Text>
              <Text style={[S.detailValue, { fontSize: 5.5 }]}>{lr.lrNumber}</Text>
            </View>
            <View style={S.detailRow}>
              <Text style={S.detailLabel}>Date</Text>
              <Text style={S.detailColon}>:</Text>
              <Text style={S.detailValue}>{fmtDate(lr.lrDate?.toString())}</Text>
            </View>
            <View style={S.vehicleBlock}>
              <Text style={S.vehicleLabel}>Vehicle No.</Text>
              <Text style={S.vehicleValue}>{lr.vehicleRegistrationNumber}</Text>
              {lr.vehicleTypeName
                ? <Text style={S.vehicleSubText}>{lr.vehicleTypeName}</Text>
                : null}
            </View>
          </View>
        </View>

        {/* ══ MAIN TABLE ══ */}
        <View style={S.table}>

          {/* Header row 1 */}
          <View style={S.th1Row}>
            <Text style={[S.th, { flex: C.pkg }]}>No. of{'\n'}Package</Text>
            <Text style={[S.th, { flex: C.material }]}>Material</Text>
            <Text style={[S.th, { flex: C.wtActual + C.wtCharged }]}>Weight</Text>
            <Text style={[S.th, { flex: C.rate }]}>Rate</Text>
            <Text style={[S.th, { flex: C.frtRs + C.frtPs }]}>Freight</Text>
            <Text style={[S.thLast, { flex: C.remarks }]}>Remarks</Text>
          </View>

          {/* Header row 2 */}
          <View style={S.th2Row}>
            <Text style={[S.th, { flex: C.pkg }]}> </Text>
            <Text style={[S.th, { flex: C.material }]}> </Text>
            <Text style={[S.th, { flex: C.wtActual }]}>Actual</Text>
            <Text style={[S.th, { flex: C.wtCharged }]}>Charged</Text>
            <Text style={[S.th, { flex: C.rate }]}> </Text>
            <Text style={[S.th, { flex: C.frtRs }]}>Rs.</Text>
            <Text style={[S.th, { flex: C.frtPs }]}>Ps.</Text>
            <Text style={[S.thLast, { flex: C.remarks }]}> </Text>
          </View>

          {/* Main data row */}
          <View style={S.dataRow}>
            <Text style={[S.td, { flex: C.pkg }]}>1</Text>
            <Text style={[S.tdLeft, { flex: C.material, fontWeight: 'bold' }]}>
              {order?.materialTypeName ?? '—'}
            </Text>
            <Text style={[S.td, { flex: C.wtActual }]}>
              {lr.loadedWeight != null ? `${lr.loadedWeight} T` : '—'}
            </Text>
            <Text style={[S.td, { flex: C.wtCharged }]}>
              {billingWeight != null ? `${billingWeight} T` : '—'}
            </Text>
            <Text style={[S.td, { flex: C.rate, fontSize: 7 }]}>{rateText}</Text>
            <Text style={[S.td, { flex: C.frtRs, fontWeight: 'bold' }]}>
              {freight.rs > 0 ? freight.rs.toLocaleString('en-IN') : '—'}
            </Text>
            <Text style={[S.td, { flex: C.frtPs }]}>
              {freight.ps > 0 ? String(freight.ps).padStart(2, '0') : '00'}
            </Text>
            <Text style={[S.tdLast, { flex: C.remarks }]}>{lr.remarks ?? ''}</Text>
          </View>

          {/* Extra charges row */}
          {charges.length > 0 && (
            <View style={S.dataRow}>
              <Text style={[S.td, { flex: C.pkg }]}> </Text>
              <Text style={[S.tdLeft, { flex: C.material, fontSize: 7, color: '#555' }]}>
                {charges.map(ch => ch.chargeTypeName).join(', ')}
              </Text>
              <Text style={[S.td, { flex: C.wtActual }]}> </Text>
              <Text style={[S.td, { flex: C.wtCharged }]}> </Text>
              <Text style={[S.td, { flex: C.rate, fontSize: 7, color: '#555' }]}>Extra Charges</Text>
              <Text style={[S.td, { flex: C.frtRs, fontWeight: 'bold' }]}>
                {Math.floor(totalCharges).toLocaleString('en-IN')}
              </Text>
              <Text style={[S.td, { flex: C.frtPs }]}>00</Text>
              <Text style={[S.tdLast, { flex: C.remarks }]}> </Text>
            </View>
          )}

          {/* Checkpost fines row */}
          {totalFines > 0 && (
            <View style={S.dataRow}>
              <Text style={[S.td, { flex: C.pkg }]}> </Text>
              <Text style={[S.tdLeft, { flex: C.material, fontSize: 7, color: '#555' }]}>
                Checkpost Fines ({checkposts.length} checkpost{checkposts.length > 1 ? 's' : ''})
              </Text>
              <Text style={[S.td, { flex: C.wtActual }]}> </Text>
              <Text style={[S.td, { flex: C.wtCharged }]}> </Text>
              <Text style={[S.td, { flex: C.rate, fontSize: 7, color: '#555' }]}>Fines</Text>
              <Text style={[S.td, { flex: C.frtRs, fontWeight: 'bold' }]}>
                {Math.floor(totalFines).toLocaleString('en-IN')}
              </Text>
              <Text style={[S.td, { flex: C.frtPs }]}>00</Text>
              <Text style={[S.tdLast, { flex: C.remarks }]}> </Text>
            </View>
          )}

          {/* Total row */}
          <View style={S.totalRow}>
            <Text style={[S.td, {
              flex: C.pkg + C.material + C.wtActual + C.wtCharged + C.rate,
              fontWeight: 'bold', textAlign: 'right',
            }]}>Total Freight</Text>
            <Text style={[S.td, { flex: C.frtRs, fontWeight: 'bold', color: NAVY }]}>
              {Math.floor(grandTotal).toLocaleString('en-IN')}
            </Text>
            <Text style={[S.td, { flex: C.frtPs }]}>
              {String(Math.round((grandTotal - Math.floor(grandTotal)) * 100)).padStart(2, '0')}
            </Text>
            <Text style={[S.tdLast, { flex: C.remarks }]}> </Text>
          </View>
        </View>

        {/* ══ FOOTER ══ */}
        <View style={S.footerSection}>
          <View style={S.footerLeft}>
            <Text style={S.footerOwner}>Owner M/s. {tenant.companyName}</Text>

            <View style={S.footerLine}>
              <Text style={S.footerLineLabel}>Driver</Text>
              <View style={S.footerDot} />
              <Text style={S.footerLineLabel}>D/L. No.</Text>
              <View style={S.footerDot} />
            </View>

            <View style={S.footerLine}>
              <Text style={S.footerLineLabel}>Declared Value Rs.</Text>
              <View style={S.footerDot} />
            </View>
          </View>

          <View style={S.footerRight}>
            <Text style={S.footerFor}>For {tenant.companyName}</Text>
            <Text style={S.footerSig}>Supervisor</Text>
          </View>
        </View>

        {/* Powered by */}
        <View style={S.poweredBy}>
          <Text style={S.poweredByText}>Generated by FEROS  |  {lr.createdByName}  |  {fmtDate(lr.createdAt?.toString())}</Text>
        </View>

      </Page>
    </Document>
  )
}

// ── Helper: generate blob and open in new tab ──────────────────────────────
export async function openLrPdf(
  lr: Lr,
  order: Order | undefined,
  checkposts: LrCheckpost[],
  charges: LrCharge[],
  tenant: TenantInfo,
) {
  const blob = await pdf(
    <LrPdfDocument
      lr={lr}
      order={order}
      checkposts={checkposts}
      charges={charges}
      tenant={tenant}
    />
  ).toBlob()
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
}
