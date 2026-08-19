import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Document, Page, Text, View, StyleSheet, Font, Image, PDFViewer,
} from '@react-pdf/renderer'
import { vehicleServicesApi } from '@/api/vehicles'
import ferosLogo from '@/assets/feros_solo_logo.png'
import type { VehicleServiceRecord } from '@/types'

Font.register({
  family: 'NotoSans',
  fonts: [
    { src: '/NotoSans-Regular.ttf', fontWeight: 'normal' },
    { src: '/NotoSans-Bold.ttf',    fontWeight: 'bold'   },
  ],
})

const NAVY = '#1E3A5F'
const BLUE = '#1d4ed8'

const S = StyleSheet.create({
  page:        { fontFamily: 'NotoSans', fontSize: 8, color: '#000', backgroundColor: '#fff', padding: 22 },
  header:      { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 },
  logo:        { width: 30, height: 30 },
  title:       { fontSize: 17, fontWeight: 'bold', color: NAVY },
  subtitle:    { fontSize: 7, color: '#666', marginTop: 2 },
  divider:     { borderBottom: `1.5pt solid ${NAVY}`, marginVertical: 6 },
  section:     { marginBottom: 10 },
  sectionHead: { fontSize: 7, fontWeight: 'bold', color: NAVY, textTransform: 'uppercase', marginBottom: 4 },
  kv:          { flexDirection: 'row', marginBottom: 2.5 },
  key:         { width: 110, fontSize: 7.5, color: '#555' },
  val:         { fontSize: 7.5, fontWeight: 'bold', flex: 1 },
  taskRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2.5, borderBottom: '0.5pt solid #eee' },
  taskName:    { fontSize: 7.5, flex: 1 },
  taskCost:    { fontSize: 7.5, textAlign: 'right', width: 60 },
  // cost comparison box
  compBox:     { border: `1pt solid #ddd`, borderRadius: 4, overflow: 'hidden', marginTop: 2 },
  compRow:     { flexDirection: 'row', borderBottom: '0.5pt solid #eee' },
  compCell:    { flex: 1, padding: 6 },
  compLabel:   { fontSize: 7, color: '#888', marginBottom: 2 },
  compVal:     { fontSize: 11, fontWeight: 'bold' },
  compDivider: { width: '0.5pt', backgroundColor: '#ddd' },
  totalBox:    { backgroundColor: NAVY, padding: 6, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel:  { fontSize: 8, fontWeight: 'bold', color: '#fff' },
  totalVal:    { fontSize: 12, fontWeight: 'bold', color: '#fff' },
  noteBox:     { backgroundColor: '#f9fafb', border: '0.5pt solid #e5e7eb', borderRadius: 3, padding: 6 },
  noteText:    { fontSize: 7.5, color: '#374151', lineHeight: 1.4 },
})

function fmt(d?: string | null) {
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) }
  catch { return d }
}

function inr(v?: number | null) {
  if (v == null) return '—'
  return '₹' + v.toLocaleString('en-IN')
}

function ServiceDoc({ s }: { s: VehicleServiceRecord }) {
  const totalTaskCost   = s.tasks.reduce((sum, t) => sum + (t.cost ?? 0), 0)
  const totalVendorCost = (s.vendorItems ?? []).reduce((sum, i) => sum + (i.cost ?? 0), 0)
  const isCompleted     = s.status === 'COMPLETED'
  const isThirdParty    = s.serviceType === 'THIRD_PARTY' || s.serviceType === 'OEM_CENTER'
  const estimationTotal = (s.estimatedCost ?? 0) + totalTaskCost + totalVendorCost
  // backend now includes vendor items in totalCost; use completedCost as final when available
  const displayTotal    = isCompleted && s.completedCost != null ? s.completedCost : (s.totalCost ?? estimationTotal)

  return (
    <Document title={`Service ${s.serviceNumber}`}>
      <Page size="A4" style={S.page}>

        {/* Header */}
        <View style={S.header}>
          <Image src={ferosLogo} style={S.logo} />
          <View>
            <Text style={S.title}>Service Cost Est.</Text>
            <Text style={S.subtitle}>{s.serviceNumber} · {s.vehicleRegistrationNumber}</Text>
          </View>
        </View>
        <View style={S.divider} />

        {/* Service details */}
        <View style={S.section}>
          <Text style={S.sectionHead}>Service Details</Text>
          <View style={S.kv}><Text style={S.key}>Vehicle</Text><Text style={S.val}>{s.vehicleRegistrationNumber}</Text></View>
          <View style={S.kv}><Text style={S.key}>Service No.</Text><Text style={S.val}>{s.serviceNumber}</Text></View>
          <View style={S.kv}><Text style={S.key}>Type</Text>
            <Text style={S.val}>
              {s.serviceType === 'INTERNAL' ? 'Internal'
                : s.serviceType === 'OEM_CENTER' ? `OEM — ${s.vendorName ?? ''}`
                : `3rd Party — ${s.vendorName ?? ''}`}
            </Text>
          </View>
          <View style={S.kv}><Text style={S.key}>Triggered By</Text><Text style={S.val}>{s.triggeredBy}</Text></View>
          {s.location   && <View style={S.kv}><Text style={S.key}>Location</Text><Text style={S.val}>{s.location}</Text></View>}
          {s.serviceDate && <View style={S.kv}><Text style={S.key}>Service Date</Text><Text style={S.val}>{fmt(s.serviceDate)}</Text></View>}
          {s.odometer   && <View style={S.kv}><Text style={S.key}>Odometer</Text><Text style={S.val}>{s.odometer.toLocaleString('en-IN')} km</Text></View>}
          <View style={S.kv}><Text style={S.key}>Status</Text><Text style={S.val}>{s.status}</Text></View>
          {s.completedDate && <View style={S.kv}><Text style={S.key}>Completed Date</Text><Text style={S.val}>{fmt(s.completedDate)}</Text></View>}
        </View>

        {/* Notes */}
        {s.notes && (
          <View style={S.section}>
            <Text style={S.sectionHead}>Notes</Text>
            <View style={S.noteBox}>
              <Text style={S.noteText}>{s.notes}</Text>
            </View>
          </View>
        )}

        {/* Tasks */}
        {s.tasks.length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionHead}>Tasks</Text>
            {s.tasks.map((t, i) => (
              <View key={i} style={S.taskRow}>
                <Text style={S.taskName}>{t.displayName ?? t.taskTypeName}</Text>
                <Text style={S.taskCost}>{t.cost ? inr(t.cost) : '—'}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Vendor parts — only for 3rd party / OEM */}
        {isThirdParty && (s.vendorItems ?? []).length > 0 && (
          <View style={S.section}>
            <Text style={S.sectionHead}>Parts / Items (Vendor Quote)</Text>
            {(s.vendorItems ?? []).map((item, i) => (
              <View key={i} style={S.taskRow}>
                <Text style={S.taskName}>{item.description}</Text>
                <Text style={S.taskCost}>{item.cost != null ? inr(item.cost) : '—'}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Cost summary */}
        <View style={S.section}>
          <Text style={S.sectionHead}>Cost Summary</Text>
          <View style={S.compBox}>
            {/* Breakdown rows */}
            <View style={{ padding: '5pt 6pt', borderBottom: '0.5pt solid #eee', flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 7.5, color: '#555' }}>Service Labor Charges</Text>
              <Text style={{ fontSize: 7.5, fontWeight: 'bold' }}>{s.estimatedCost != null ? inr(s.estimatedCost) : '₹0.00'}</Text>
            </View>
            {isThirdParty && (
              <View style={{ padding: '5pt 6pt', borderBottom: '0.5pt solid #eee', flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 7.5, color: '#555' }}>Parts / Items (Vendor Quote)</Text>
                <Text style={{ fontSize: 7.5, fontWeight: 'bold' }}>{totalVendorCost > 0 ? inr(totalVendorCost) : '₹0.00'}</Text>
              </View>
            )}
            <View style={{ padding: '5pt 6pt', borderBottom: '0.5pt solid #eee', flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 7.5, color: '#555' }}>Task Costs</Text>
              <Text style={{ fontSize: 7.5, fontWeight: 'bold' }}>{totalTaskCost > 0 ? inr(totalTaskCost) : '₹0.00'}</Text>
            </View>

            {/* Side-by-side estimation vs actual when completed */}
            {isCompleted && (
              <View style={S.compRow}>
                <View style={S.compCell}>
                  <Text style={S.compLabel}>EST. TOTAL (LABOR + PARTS + TASKS)</Text>
                  <Text style={[S.compVal, { color: NAVY }]}>
                    {inr(estimationTotal)}
                  </Text>
                </View>
                <View style={S.compDivider} />
                <View style={S.compCell}>
                  <Text style={S.compLabel}>ACTUAL BILL</Text>
                  <Text style={[S.compVal, { color: s.completedCost != null ? BLUE : '#aaa' }]}>
                    {s.completedCost != null ? inr(s.completedCost) : '—'}
                  </Text>
                </View>
              </View>
            )}

            <View style={S.totalBox}>
              <Text style={S.totalLabel}>TOTAL COST</Text>
              <Text style={S.totalVal}>{inr(displayTotal)}</Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={S.divider} />
        <Text style={{ fontSize: 6.5, color: '#aaa', textAlign: 'center' }}>
          Generated by FEROS · {new Date().toLocaleDateString('en-IN')}
        </Text>

      </Page>
    </Document>
  )
}

export function ServicePdfPage() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['vehicle-service', Number(id)],
    queryFn: () => vehicleServicesApi.getById(Number(id)),
    enabled: !!id,
  })

  if (isLoading) return <div className="flex items-center justify-center h-screen text-gray-500 text-sm">Loading…</div>
  if (isError || !data?.data) return <div className="flex items-center justify-center h-screen text-red-500 text-sm">Service not found</div>

  return (
    <PDFViewer style={{ width: '100%', height: '100vh', border: 'none' }}>
      <ServiceDoc s={data.data} />
    </PDFViewer>
  )
}
