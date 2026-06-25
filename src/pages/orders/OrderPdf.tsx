import { Document, Page, Text, View, StyleSheet, Font, pdf } from '@react-pdf/renderer'
import type { Order } from '@/types'

Font.register({
  family: 'NotoSans',
  fonts: [
    { src: '/NotoSans-Regular.ttf', fontWeight: 'normal' },
    { src: '/NotoSans-Bold.ttf',    fontWeight: 'bold'   },
  ],
})

const NAVY   = '#1E3A5F'
const BORDER = '#1E3A5F'

const S = StyleSheet.create({
  page:         { fontFamily: 'NotoSans', fontWeight: 'normal', fontSize: 8, color: '#000', backgroundColor: '#fff', padding: 18 },
  companyName:  { fontSize: 16, fontWeight: 'bold', textAlign: 'center', color: NAVY, marginBottom: 2 },
  docTitle:     { fontSize: 9, fontWeight: 'bold', textAlign: 'center', color: '#555', letterSpacing: 2, marginBottom: 2 },
  divider:      { borderBottom: `1.5pt solid ${BORDER}`, marginVertical: 5 },

  // Info grid
  infoRow:      { flexDirection: 'row', gap: 8, marginTop: 8 },
  infoBox:      { flex: 1, border: `1pt solid ${BORDER}`, padding: 6 },
  infoLabel:    { fontSize: 7, color: '#777', marginBottom: 2 },
  infoValue:    { fontSize: 8.5, fontWeight: 'bold', color: NAVY },
  infoValueSm:  { fontSize: 8, fontWeight: 'bold', color: '#000' },

  // Route
  routeRow:     { flexDirection: 'row', alignItems: 'center', marginTop: 8, border: `1pt solid ${BORDER}`, padding: 8 },
  routeCity:    { flex: 1 },
  routeCityName:{ fontSize: 11, fontWeight: 'bold', color: NAVY },
  routeAddr:    { fontSize: 7, color: '#555', marginTop: 1 },
  routeArrow:   { fontSize: 14, color: NAVY, marginHorizontal: 8 },
  routeLabel:   { fontSize: 7, color: '#777', marginBottom: 2 },

  // Details row
  detailsRow:   { flexDirection: 'row', marginTop: 6, gap: 6 },
  detailBox:    { flex: 1, border: `1pt solid ${BORDER}`, padding: 6 },

  // Allocations table
  tableTitle:   { fontSize: 8, fontWeight: 'bold', color: NAVY, marginTop: 10, marginBottom: 3 },
  table:        { border: `1pt solid ${BORDER}` },
  thead:        { flexDirection: 'row', backgroundColor: '#EFF6FF', borderBottom: `1pt solid ${BORDER}` },
  tbody:        {},
  tr:           { flexDirection: 'row', borderBottom: `0.5pt solid ${BORDER}` },
  trLast:       { flexDirection: 'row' },
  th:           { fontSize: 7, fontWeight: 'bold', padding: 4, borderRight: `0.5pt solid ${BORDER}`, textAlign: 'center' },
  thLast:       { fontSize: 7, fontWeight: 'bold', padding: 4, textAlign: 'center' },
  td:           { fontSize: 7.5, padding: 4, borderRight: `0.5pt solid ${BORDER}`, textAlign: 'center' },
  tdLeft:       { fontSize: 7.5, padding: 4, borderRight: `0.5pt solid ${BORDER}` },
  tdLast:       { fontSize: 7.5, padding: 4, textAlign: 'center' },

  // Remarks
  remarksBox:   { marginTop: 6, border: `1pt solid ${BORDER}`, padding: 6 },
  remarksLabel: { fontSize: 7, color: '#777', marginBottom: 3 },
  remarksText:  { fontSize: 8 },

  // Footer
  footer:       { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', borderTop: `0.8pt solid #ccc`, paddingTop: 6 },
  footerText:   { fontSize: 7, color: '#888' },
  sigBlock:     { alignItems: 'center' },
  sigLine:      { borderTop: `0.8pt solid #000`, width: 100, marginBottom: 2 },
  sigLabel:     { fontSize: 7 },
})

function fmt(d?: string) {
  if (!d) return '—'
  try {
    const [y, m, day] = d.split('T')[0].split('-')
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${day} ${months[parseInt(m) - 1]} ${y}`
  } catch { return d }
}

function fmtRate(order: Order) {
  const type = order.freightRateType.replace(/_/g, ' ')
  return `₹${order.freightRate.toLocaleString('en-IN')} / ${type}`
}

function statusLabel(s: string) {
  return s.replace(/_/g, ' ')
}

interface Props { order: Order; companyName: string }

export function OrderPdfDocument({ order, companyName }: Props) {
  const allocations = order.vehicleAllocations ?? []

  return (
    <Document title={`Order Copy — ${order.orderNumber}`} author={companyName}>
      <Page size="A4" style={S.page}>

        {/* Header */}
        <Text style={S.companyName}>{companyName}</Text>
        <Text style={S.docTitle}>ORDER COPY</Text>
        <View style={S.divider} />

        {/* Order info + client */}
        <View style={S.infoRow}>
          <View style={S.infoBox}>
            <Text style={S.infoLabel}>Order Number</Text>
            <Text style={S.infoValue}>{order.orderNumber}</Text>
          </View>
          <View style={S.infoBox}>
            <Text style={S.infoLabel}>Order Date</Text>
            <Text style={S.infoValueSm}>{fmt(order.orderDate)}</Text>
          </View>
          <View style={S.infoBox}>
            <Text style={S.infoLabel}>Expected Delivery</Text>
            <Text style={S.infoValueSm}>{fmt(order.expectedDeliveryDate)}</Text>
          </View>
          <View style={S.infoBox}>
            <Text style={S.infoLabel}>Status</Text>
            <Text style={S.infoValueSm}>{statusLabel(order.orderStatus)}</Text>
          </View>
        </View>

        <View style={[S.infoRow, { marginTop: 6 }]}>
          <View style={[S.infoBox, { flex: 2 }]}>
            <Text style={S.infoLabel}>Client</Text>
            <Text style={S.infoValue}>{order.clientName}</Text>
          </View>
          <View style={S.infoBox}>
            <Text style={S.infoLabel}>Billing On</Text>
            <Text style={S.infoValueSm}>{order.billingOn.replace(/_/g, ' ')}</Text>
          </View>
          <View style={S.infoBox}>
            <Text style={S.infoLabel}>Created By</Text>
            <Text style={S.infoValueSm}>{order.createdByName}</Text>
          </View>
        </View>

        {/* Route */}
        <View style={S.routeRow}>
          <View style={S.routeCity}>
            <Text style={S.routeLabel}>FROM</Text>
            <Text style={S.routeCityName}>{order.sourceCityName}</Text>
            <Text style={S.routeAddr}>{order.sourceStateName}{order.sourceAddress ? ` · ${order.sourceAddress}` : ''}</Text>
          </View>
          <Text style={S.routeArrow}>→</Text>
          <View style={[S.routeCity, { alignItems: 'flex-end' }]}>
            <Text style={S.routeLabel}>TO</Text>
            <Text style={S.routeCityName}>{order.destinationCityName}</Text>
            <Text style={S.routeAddr}>{order.destinationStateName}{order.destinationAddress ? ` · ${order.destinationAddress}` : ''}</Text>
          </View>
        </View>

        {/* Material / weight / freight */}
        <View style={S.detailsRow}>
          <View style={S.detailBox}>
            <Text style={S.infoLabel}>Material</Text>
            <Text style={S.infoValueSm}>{order.materialTypeName}</Text>
          </View>
          <View style={S.detailBox}>
            <Text style={S.infoLabel}>Total Weight (MT)</Text>
            <Text style={S.infoValueSm}>{Number(order.totalWeight).toLocaleString('en-IN')}</Text>
          </View>
          <View style={S.detailBox}>
            <Text style={S.infoLabel}>Freight Rate</Text>
            <Text style={S.infoValueSm}>{fmtRate(order)}</Text>
          </View>
          {order.routeName && (
            <View style={S.detailBox}>
              <Text style={S.infoLabel}>Route</Text>
              <Text style={S.infoValueSm}>{order.routeName}</Text>
            </View>
          )}
        </View>

        {/* Vehicle Allocations */}
        {allocations.length > 0 && (
          <>
            <Text style={S.tableTitle}>Vehicle Allocations</Text>
            <View style={S.table}>
              <View style={S.thead}>
                <Text style={[S.th, { flex: 1.5 }]}>Vehicle</Text>
                <Text style={[S.th, { flex: 1.5 }]}>Driver</Text>
                <Text style={[S.th, { flex: 0.8 }]}>Weight (MT)</Text>
                <Text style={[S.th, { flex: 1 }]}>Load Date</Text>
                <Text style={[S.th, { flex: 1 }]}>Delivery Date</Text>
                <Text style={[S.thLast, { flex: 1 }]}>Status</Text>
              </View>
              <View style={S.tbody}>
                {allocations.map((a, i) => {
                  const isLast = i === allocations.length - 1
                  const rowStyle = isLast ? S.trLast : S.tr
                  return (
                    <View key={a.id} style={rowStyle}>
                      <Text style={[S.tdLeft, { flex: 1.5 }]}>{a.registrationNumber || a.vehicleRegistrationNumber || '—'}</Text>
                      <Text style={[S.tdLeft, { flex: 1.5 }]}>{a.currentDriverName ?? '—'}</Text>
                      <Text style={[S.td, { flex: 0.8 }]}>{Number(a.allocatedWeight).toLocaleString('en-IN')}</Text>
                      <Text style={[S.td, { flex: 1 }]}>{fmt(a.expectedLoadDate)}</Text>
                      <Text style={[S.td, { flex: 1 }]}>{fmt(a.expectedDeliveryDate)}</Text>
                      <Text style={[S.tdLast, { flex: 1 }]}>{statusLabel(a.allocationStatus)}</Text>
                    </View>
                  )
                })}
              </View>
            </View>
          </>
        )}

        {/* Remarks / Special Instructions */}
        {(order.specialInstructions || order.remarks) && (
          <View style={S.remarksBox}>
            {order.specialInstructions && (
              <>
                <Text style={S.remarksLabel}>Special Instructions</Text>
                <Text style={S.remarksText}>{order.specialInstructions}</Text>
              </>
            )}
            {order.remarks && (
              <>
                <Text style={[S.remarksLabel, order.specialInstructions ? { marginTop: 5 } : {}]}>Remarks</Text>
                <Text style={S.remarksText}>{order.remarks}</Text>
              </>
            )}
          </View>
        )}

        {/* Footer */}
        <View style={S.footer}>
          <Text style={S.footerText}>Generated by FEROS · {companyName}</Text>
          <View style={S.sigBlock}>
            <View style={S.sigLine} />
            <Text style={S.sigLabel}>Authorised Signatory</Text>
          </View>
        </View>

      </Page>
    </Document>
  )
}

export async function openOrderPdf(order: Order, companyName: string) {
  const blob = await pdf(<OrderPdfDocument order={order} companyName={companyName} />).toBlob()
  const url  = URL.createObjectURL(blob)
  window.open(url, '_blank')
}
