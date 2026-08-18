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

const S = StyleSheet.create({
  page:       { fontFamily: 'NotoSans', fontSize: 8, color: '#000', backgroundColor: '#fff', padding: 20 },
  row:        { flexDirection: 'row' },
  header:     { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  logo:       { width: 28, height: 28 },
  title:      { fontSize: 16, fontWeight: 'bold', color: NAVY },
  subtitle:   { fontSize: 7, color: '#666', marginTop: 1 },
  divider:    { borderBottom: `1.5pt solid ${NAVY}`, marginVertical: 6 },
  section:    { marginBottom: 8 },
  sectionHead:{ fontSize: 7, fontWeight: 'bold', color: NAVY, textTransform: 'uppercase', marginBottom: 3 },
  kv:         { flexDirection: 'row', marginBottom: 2 },
  key:        { width: 100, fontSize: 7.5, color: '#555' },
  val:        { fontSize: 7.5, fontWeight: 'bold', flex: 1 },
  taskRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2, borderBottom: '0.5pt solid #eee' },
  taskName:   { fontSize: 7.5, flex: 1 },
  taskCost:   { fontSize: 7.5, textAlign: 'right', width: 60 },
  totalRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4, borderTop: `1pt solid ${NAVY}`, marginTop: 2 },
  totalLabel: { fontSize: 8, fontWeight: 'bold' },
  totalVal:   { fontSize: 8, fontWeight: 'bold', color: NAVY },
  costBox:    { border: `1pt solid #ddd`, borderRadius: 4, padding: 6, marginTop: 4 },
  costRow:    { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  costLabel:  { fontSize: 7.5, color: '#555' },
  costVal:    { fontSize: 7.5, fontWeight: 'bold' },
  badge:      { backgroundColor: '#EFF6FF', padding: '2pt 6pt', borderRadius: 3, fontSize: 7, color: NAVY, alignSelf: 'flex-start' },
  docImg:     { width: '100%', maxHeight: 120, objectFit: 'contain', marginTop: 4, borderRadius: 2 },
  noDoc:      { fontSize: 7, color: '#aaa', fontStyle: 'italic' },
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
  const totalTaskCost = s.tasks.reduce((sum, t) => sum + (t.cost ?? 0), 0)
  const displayTotal = s.totalCost ?? (totalTaskCost + (s.estimatedCost ?? 0))

  return (
    <Document title={`Service ${s.serviceNumber}`}>
      <Page size="A4" style={S.page}>
        {/* Header */}
        <View style={S.header}>
          <Image src={ferosLogo} style={S.logo} />
          <View>
            <Text style={S.title}>Service Job Card</Text>
            <Text style={S.subtitle}>{s.serviceNumber} · {s.vehicleRegistrationNumber}</Text>
          </View>
        </View>
        <View style={S.divider} />

        {/* Vehicle + Service Info */}
        <View style={S.section}>
          <Text style={S.sectionHead}>Service Details</Text>
          <View style={S.kv}><Text style={S.key}>Vehicle</Text><Text style={S.val}>{s.vehicleRegistrationNumber}</Text></View>
          <View style={S.kv}><Text style={S.key}>Service No.</Text><Text style={S.val}>{s.serviceNumber}</Text></View>
          <View style={S.kv}><Text style={S.key}>Type</Text>
            <Text style={S.val}>
              {s.serviceType === 'INTERNAL' ? 'Internal' : s.serviceType === 'OEM_CENTER' ? `OEM — ${s.vendorName ?? ''}` : `3rd Party — ${s.vendorName ?? ''}`}
            </Text>
          </View>
          <View style={S.kv}><Text style={S.key}>Triggered By</Text><Text style={S.val}>{s.triggeredBy}</Text></View>
          {s.location && <View style={S.kv}><Text style={S.key}>Location</Text><Text style={S.val}>{s.location}</Text></View>}
          {s.serviceDate && <View style={S.kv}><Text style={S.key}>Service Date</Text><Text style={S.val}>{fmt(s.serviceDate)}</Text></View>}
          {s.odometer && <View style={S.kv}><Text style={S.key}>Odometer</Text><Text style={S.val}>{s.odometer.toLocaleString('en-IN')} km</Text></View>}
          <View style={S.kv}><Text style={S.key}>Status</Text><Text style={S.val}>{s.status}</Text></View>
          {s.completedDate && <View style={S.kv}><Text style={S.key}>Completed</Text><Text style={S.val}>{fmt(s.completedDate)}</Text></View>}
          {s.notes && <View style={S.kv}><Text style={S.key}>Notes</Text><Text style={S.val}>{s.notes}</Text></View>}
        </View>

        {/* Estimate */}
        {s.estimatedCost != null && (
          <View style={S.section}>
            <Text style={S.sectionHead}>Estimated Cost</Text>
            <View style={S.costBox}>
              <View style={S.costRow}>
                <Text style={S.costLabel}>Estimated Cost (Vendor Quote)</Text>
                <Text style={S.costVal}>{inr(s.estimatedCost)}</Text>
              </View>
              {!s.estimateDocUrl && <Text style={S.noDoc}>No estimate document uploaded</Text>}
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

        {/* Cost Summary */}
        <View style={S.section}>
          <Text style={S.sectionHead}>Cost Summary</Text>
          <View style={S.costBox}>
            {totalTaskCost > 0 && (
              <View style={S.costRow}>
                <Text style={S.costLabel}>Task Costs</Text>
                <Text style={S.costVal}>{inr(totalTaskCost)}</Text>
              </View>
            )}
            {(s.estimatedCost ?? 0) > 0 && s.completedCost == null && (
              <View style={S.costRow}>
                <Text style={S.costLabel}>Estimated Cost</Text>
                <Text style={S.costVal}>{inr(s.estimatedCost)}</Text>
              </View>
            )}
            {s.completedCost != null && (
              <View style={S.costRow}>
                <Text style={S.costLabel}>Completed Cost (Final Bill)</Text>
                <Text style={[S.costVal, { color: '#1d4ed8' }]}>{inr(s.completedCost)}</Text>
              </View>
            )}
            <View style={S.totalRow}>
              <Text style={S.totalLabel}>Total</Text>
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
