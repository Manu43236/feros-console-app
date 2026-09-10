import { Document, Page, Text, View, StyleSheet, Font, Image, pdf } from '@react-pdf/renderer'
import type { Order, Lr } from '@/types'
import ferosLogo from '@/assets/feros_solo_logo.png'

Font.register({
  family: 'NotoSans',
  fonts: [
    { src: '/NotoSans-Regular.ttf', fontWeight: 'normal' },
    { src: '/NotoSans-Bold.ttf',    fontWeight: 'bold'   },
  ],
})

const NAVY = '#1E3A5F'

const S = StyleSheet.create({
  page: { fontFamily: 'NotoSans', fontSize: 8, color: '#000', backgroundColor: '#fff', padding: 22 },
  watermark: { position: 'absolute', top: 280, left: 170, width: 210, opacity: 0.06 },

  title:    { fontSize: 13, fontWeight: 'bold', color: NAVY, textAlign: 'center' },
  subtitle: { fontSize: 8.5, textAlign: 'center', color: '#555', marginTop: 2 },
  divider:  { borderBottom: `1.5pt solid ${NAVY}`, marginVertical: 6 },
  thinDiv:  { borderBottom: `0.5pt solid #ccc`, marginVertical: 4 },

  // Order header grid
  headerGrid: { flexDirection: 'row', gap: 6, marginTop: 6 },
  headerBox:  { flex: 1, border: `1pt solid #d0d7e3`, borderRadius: 2, padding: '5 7' },
  hLabel:     { fontSize: 6.5, color: '#888', marginBottom: 2, textTransform: 'uppercase' },
  hValue:     { fontSize: 8, fontWeight: 'bold', color: NAVY },
  hValueSm:   { fontSize: 7.5, color: '#222' },

  // Route bar
  routeBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', border: `1pt solid #c7d9f0`, borderRadius: 2, padding: '5 10', marginTop: 6 },
  routeCity: { flex: 1 },
  routeName: { fontSize: 10, fontWeight: 'bold', color: NAVY },
  routeState:{ fontSize: 7, color: '#666', marginTop: 1 },
  routeArrow:{ fontSize: 16, color: NAVY, marginHorizontal: 10 },

  // Status badge inline
  badge: { fontSize: 7, fontWeight: 'bold', color: '#fff', backgroundColor: NAVY, borderRadius: 2, paddingHorizontal: 4, paddingVertical: 1 },

  // Section header
  sectionTitle: { fontSize: 9, fontWeight: 'bold', color: NAVY, marginTop: 12, marginBottom: 4 },

  // Vehicle block
  vehicleBlock: { border: `1pt solid #c7d9f0`, borderRadius: 2, marginBottom: 8, padding: '6 8' },
  vehicleHeader:{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  vehicleReg:   { fontSize: 10, fontWeight: 'bold', color: NAVY },
  vehicleType:  { fontSize: 7, color: '#666', marginLeft: 6, marginTop: 2 },

  // Staff row
  staffRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  staffBox: { flex: 1, backgroundColor: '#f8fafc', border: `0.5pt solid #dde5ef`, borderRadius: 2, padding: '4 6' },
  staffRole:{ fontSize: 6.5, color: '#888', marginBottom: 1, textTransform: 'uppercase' },
  staffName:{ fontSize: 7.5, fontWeight: 'bold', color: '#222' },
  staffPh:  { fontSize: 7, color: '#555', marginTop: 1 },

  // Timeline table inside vehicle block
  tlRow:    { flexDirection: 'row', borderBottom: `0.5pt solid #e5ecf4`, paddingVertical: 3 },
  tlEvent:  { width: '38%', fontSize: 7.5, color: '#333' },
  tlDate:   { width: '35%', fontSize: 7.5, color: '#555' },
  tlDur:    { width: '27%', fontSize: 7.5, color: NAVY, fontWeight: 'bold', textAlign: 'right' },
  tlRowHead:{ flexDirection: 'row', paddingBottom: 3, marginBottom: 2, borderBottom: `1pt solid #c7d9f0` },
  tlHEvent: { width: '38%', fontSize: 6.5, fontWeight: 'bold', color: '#888', textTransform: 'uppercase' },
  tlHDate:  { width: '35%', fontSize: 6.5, fontWeight: 'bold', color: '#888', textTransform: 'uppercase' },
  tlHDur:   { width: '27%', fontSize: 6.5, fontWeight: 'bold', color: '#888', textTransform: 'uppercase', textAlign: 'right' },

  // LR sub-block
  lrBlock:  { backgroundColor: '#f0f5fb', borderRadius: 2, padding: '4 6', marginTop: 4 },
  lrNum:    { fontSize: 7.5, fontWeight: 'bold', color: NAVY, marginBottom: 2 },

  footer: { marginTop: 10, fontSize: 6.5, color: '#aaa', textAlign: 'right' },
})

// ── helpers ────────────────────────────────────────────────────────────────────

function fmt(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function fmtDate(iso?: string | null): string {
  if (!iso) return '—'
  const [y, m, day] = (iso.split('T')[0]).split('-')
  return `${day}-${m}-${y}`
}

function duration(from?: string | null, to?: string | null): string {
  if (!from || !to) return '—'
  const ms = new Date(to).getTime() - new Date(from).getTime()
  if (isNaN(ms) || ms < 0) return '—'
  const totalMins = Math.floor(ms / 60000)
  const d = Math.floor(totalMins / 1440)
  const h = Math.floor((totalMins % 1440) / 60)
  const m = totalMins % 60
  const parts = []
  if (d) parts.push(`${d}d`)
  if (h) parts.push(`${h}h`)
  if (m || parts.length === 0) parts.push(`${m}m`)
  return parts.join(' ')
}

function statusColor(s?: string): string {
  const map: Record<string, string> = {
    PENDING: '#6b7280', PARTIALLY_ASSIGNED: '#2563eb', FULLY_ASSIGNED: '#1d4ed8',
    IN_TRANSIT: '#d97706', PARTIALLY_DELIVERED: '#ea580c', DELIVERED: '#16a34a',
    COMPLETED: '#15803d', CANCELLED: '#dc2626',
  }
  return map[s ?? ''] ?? NAVY
}

// ── PDF Document ───────────────────────────────────────────────────────────────

function OrderSummaryDoc({ order, lrs }: { order: Order; lrs: Lr[] }) {
  const lrByAlloc = new Map<number, Lr>()
  lrs.forEach(lr => lrByAlloc.set(lr.vehicleAllocationId, lr))

  const allocs = order.vehicleAllocations ?? []

  return (
    <Document>
      <Page size="A4" style={S.page}>
        <Image src={ferosLogo} style={S.watermark} />

        {/* Title */}
        <Text style={S.title}>Order Summary</Text>
        <Text style={S.subtitle}>Generated {fmt(new Date().toISOString())}</Text>
        <View style={S.divider} />

        {/* Order Header */}
        <View style={S.headerGrid}>
          <View style={S.headerBox}>
            <Text style={S.hLabel}>Order No.</Text>
            <Text style={S.hValue}>{order.orderNumber}</Text>
          </View>
          <View style={S.headerBox}>
            <Text style={S.hLabel}>Status</Text>
            <Text style={[S.hValue, { color: statusColor(order.orderStatus) }]}>
              {(order.orderStatus ?? '').replace(/_/g, ' ')}
            </Text>
          </View>
          <View style={S.headerBox}>
            <Text style={S.hLabel}>Client</Text>
            <Text style={S.hValueSm}>{order.clientName}</Text>
          </View>
          <View style={S.headerBox}>
            <Text style={S.hLabel}>Order Created</Text>
            <Text style={S.hValueSm}>{fmt(order.createdAt)}</Text>
          </View>
        </View>

        <View style={[S.headerGrid, { marginTop: 4 }]}>
          <View style={S.headerBox}>
            <Text style={S.hLabel}>Material</Text>
            <Text style={S.hValueSm}>{order.materialTypeName}</Text>
          </View>
          <View style={S.headerBox}>
            <Text style={S.hLabel}>Total Weight</Text>
            <Text style={S.hValueSm}>{order.totalWeight} MT</Text>
          </View>
          <View style={S.headerBox}>
            <Text style={S.hLabel}>Expected Delivery</Text>
            <Text style={S.hValueSm}>{fmtDate(order.expectedDeliveryDate)}</Text>
          </View>
          <View style={S.headerBox}>
            <Text style={S.hLabel}>Created By</Text>
            <Text style={S.hValueSm}>{order.createdByName}</Text>
          </View>
        </View>

        {/* Route */}
        <View style={S.routeBar}>
          <View style={S.routeCity}>
            <Text style={S.routeName}>{order.sourceCityName}</Text>
            <Text style={S.routeState}>{order.sourceStateName}</Text>
          </View>
          <Text style={S.routeArrow}>→</Text>
          <View style={[S.routeCity, { alignItems: 'flex-end' }]}>
            <Text style={S.routeName}>{order.destinationCityName}</Text>
            <Text style={S.routeState}>{order.destinationStateName}</Text>
          </View>
        </View>

        {/* Vehicle Assignments */}
        <Text style={S.sectionTitle}>Vehicle Assignments &amp; Timeline</Text>

        {allocs.length === 0 && (
          <Text style={{ fontSize: 8, color: '#888' }}>No vehicles assigned to this order yet.</Text>
        )}

        {allocs.map((alloc, idx) => {
          const lr = lrByAlloc.get(alloc.id)
          const regNum = alloc.vehicleRegistrationNumber ?? alloc.registrationNumber ?? '—'
          const assignedAt = alloc.createdAt
          const lrCreatedAt = lr?.createdAt
          const tripStartAt = lr?.loadedAt
          const tripEndAt   = lr?.deliveredAt

          return (
            <View key={alloc.id} style={S.vehicleBlock} wrap={false}>
              {/* Vehicle header */}
              <View style={S.vehicleHeader}>
                <Text style={S.vehicleReg}>{regNum}</Text>
                {alloc.vehicleTypeName && (
                  <Text style={S.vehicleType}>({alloc.vehicleTypeName})</Text>
                )}
                <View style={{ flex: 1 }} />
                <Text style={{ fontSize: 7, color: '#555' }}>
                  Alloc. Weight: {alloc.allocatedWeight} MT
                </Text>
              </View>

              {/* Staff */}
              <View style={S.staffRow}>
                <View style={S.staffBox}>
                  <Text style={S.staffRole}>Driver</Text>
                  <Text style={S.staffName}>{alloc.currentDriverName ?? '—'}</Text>
                  {alloc.currentDriverPhone && (
                    <Text style={S.staffPh}>{alloc.currentDriverPhone}</Text>
                  )}
                </View>
                <View style={S.staffBox}>
                  <Text style={S.staffRole}>Cleaner / Helper</Text>
                  <Text style={S.staffName}>{alloc.currentCleanerName ?? '—'}</Text>
                  {alloc.currentCleanerPhone && (
                    <Text style={S.staffPh}>{alloc.currentCleanerPhone}</Text>
                  )}
                </View>
                {lr && (
                  <View style={S.staffBox}>
                    <Text style={S.staffRole}>LR No.</Text>
                    <Text style={S.staffName}>{lr.lrNumber}</Text>
                    {lr.paperLrNumber && (
                      <Text style={S.staffPh}>Paper: {lr.paperLrNumber}</Text>
                    )}
                  </View>
                )}
              </View>

              {/* Timeline */}
              <View style={S.thinDiv} />
              <View style={S.tlRowHead}>
                <Text style={S.tlHEvent}>Event</Text>
                <Text style={S.tlHDate}>Date &amp; Time</Text>
                <Text style={S.tlHDur}>Duration to next</Text>
              </View>

              <View style={S.tlRow}>
                <Text style={S.tlEvent}>Vehicle Assigned</Text>
                <Text style={S.tlDate}>{fmt(assignedAt)}</Text>
                <Text style={S.tlDur}>{duration(assignedAt, lrCreatedAt)}</Text>
              </View>
              <View style={S.tlRow}>
                <Text style={S.tlEvent}>LR Created</Text>
                <Text style={S.tlDate}>{fmt(lrCreatedAt)}</Text>
                <Text style={S.tlDur}>{duration(lrCreatedAt, tripStartAt)}</Text>
              </View>
              <View style={S.tlRow}>
                <Text style={S.tlEvent}>Trip Started</Text>
                <Text style={S.tlDate}>{fmt(tripStartAt)}</Text>
                <Text style={S.tlDur}>{duration(tripStartAt, tripEndAt)}</Text>
              </View>
              <View style={[S.tlRow, { borderBottom: 0 }]}>
                <Text style={S.tlEvent}>Trip Ended</Text>
                <Text style={S.tlDate}>{fmt(tripEndAt)}</Text>
                <Text style={[S.tlDur, { color: '#16a34a' }]}>
                  Total: {duration(assignedAt, tripEndAt)}
                </Text>
              </View>
            </View>
          )
        })}

        <Text style={S.footer}>
          FEROS — Order Summary Report • {order.orderNumber} • {fmt(new Date().toISOString())}
        </Text>
      </Page>
    </Document>
  )
}

export async function downloadOrderSummaryPdf(order: Order, lrs: Lr[]) {
  const blob = await pdf(<OrderSummaryDoc order={order} lrs={lrs} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `order-summary-${order.orderNumber}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
