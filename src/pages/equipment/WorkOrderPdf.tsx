import { Document, Page, Text, View, StyleSheet, Font, pdf } from '@react-pdf/renderer'
import type { WorkOrder, MachineAssignment } from '@/types'

Font.register({
  family: 'NotoSans',
  fonts: [
    { src: '/NotoSans-Regular.ttf', fontWeight: 'normal' },
    { src: '/NotoSans-Bold.ttf',    fontWeight: 'bold'   },
  ],
})

const NAVY   = '#1C1400' // equipment brown-black theme
const BORDER = '#1C1400'

const S = StyleSheet.create({
  page:         { fontFamily: 'NotoSans', fontWeight: 'normal', fontSize: 8, color: '#000', backgroundColor: '#fff', padding: 18 },
  companyName:  { fontSize: 16, fontWeight: 'bold', textAlign: 'center', color: NAVY, marginBottom: 2 },
  docTitle:     { fontSize: 9, fontWeight: 'bold', textAlign: 'center', color: '#555', letterSpacing: 2, marginBottom: 2 },
  divider:      { borderBottom: `1.5pt solid ${BORDER}`, marginVertical: 5 },

  infoRow:      { flexDirection: 'row', gap: 8, marginTop: 8 },
  infoBox:      { flex: 1, border: `1pt solid ${BORDER}`, padding: 6 },
  infoLabel:    { fontSize: 7, color: '#777', marginBottom: 2 },
  infoValue:    { fontSize: 7.5, fontWeight: 'bold', color: NAVY },
  infoValueSm:  { fontSize: 8, fontWeight: 'bold', color: '#000' },

  detailsRow:   { flexDirection: 'row', marginTop: 6, gap: 6, flexWrap: 'wrap' },
  detailBox:    { flex: 1, minWidth: '22%', border: `1pt solid ${BORDER}`, padding: 6 },

  tableTitle:   { fontSize: 8, fontWeight: 'bold', color: NAVY, marginTop: 10, marginBottom: 3 },
  table:        { border: `1pt solid ${BORDER}` },
  thead:        { flexDirection: 'row', backgroundColor: '#F5EFE0', borderBottom: `1pt solid ${BORDER}` },
  tr:           { flexDirection: 'row', borderBottom: `0.5pt solid ${BORDER}` },
  trLast:       { flexDirection: 'row' },
  th:           { fontSize: 7, fontWeight: 'bold', padding: 4, borderRight: `0.5pt solid ${BORDER}`, textAlign: 'center' },
  thLast:       { fontSize: 7, fontWeight: 'bold', padding: 4, textAlign: 'center' },
  td:           { fontSize: 7.5, padding: 4, borderRight: `0.5pt solid ${BORDER}`, textAlign: 'center' },
  tdLeft:       { fontSize: 7.5, padding: 4, borderRight: `0.5pt solid ${BORDER}` },
  tdLast:       { fontSize: 7.5, padding: 4, textAlign: 'center' },

  remarksBox:   { marginTop: 6, border: `1pt solid ${BORDER}`, padding: 6 },
  remarksLabel: { fontSize: 7, color: '#777', marginBottom: 3 },
  remarksText:  { fontSize: 8 },

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

const pct = (n?: number) => (n != null ? `${n}%` : '—')
const num = (n?: number) => (n != null ? Number(n).toLocaleString('en-IN') : '—')

interface Props { wo: WorkOrder; assignments: MachineAssignment[]; companyName: string }

export function WorkOrderPdfDocument({ wo, assignments, companyName }: Props) {
  const shifts = wo.shifts ?? []
  return (
    <Document title={`Work Order Copy — ${wo.woNumber}`} author={companyName}>
      <Page size="A4" style={S.page}>

        <Text style={S.companyName}>{companyName}</Text>
        <Text style={S.docTitle}>WORK ORDER COPY</Text>
        <View style={S.divider} />

        {/* WO info */}
        <View style={S.infoRow}>
          <View style={[S.infoBox, { flex: 1.4 }]}>
            <Text style={S.infoLabel}>Work Order No.</Text>
            <Text style={S.infoValue}>{wo.woNumber}</Text>
          </View>
          <View style={S.infoBox}>
            <Text style={S.infoLabel}>Type</Text>
            <Text style={S.infoValueSm}>{wo.workOrderType === 'JOB' ? 'Job / Contract' : 'Rental'}</Text>
          </View>
          <View style={S.infoBox}>
            <Text style={S.infoLabel}>Status</Text>
            <Text style={S.infoValueSm}>{(wo.status ?? '').replace(/_/g, ' ')}</Text>
          </View>
          <View style={S.infoBox}>
            <Text style={S.infoLabel}>Shift Duty</Text>
            <Text style={S.infoValueSm}>{wo.shiftDuty ? 'Yes' : 'No'}</Text>
          </View>
        </View>

        <View style={[S.infoRow, { marginTop: 6 }]}>
          <View style={[S.infoBox, { flex: 2 }]}>
            <Text style={S.infoLabel}>Client</Text>
            <Text style={S.infoValue}>{wo.clientName}</Text>
          </View>
          <View style={[S.infoBox, { flex: 1.5 }]}>
            <Text style={S.infoLabel}>Site / Location</Text>
            <Text style={S.infoValueSm}>{wo.site ?? '—'}</Text>
          </View>
          <View style={S.infoBox}>
            <Text style={S.infoLabel}>Period</Text>
            <Text style={S.infoValueSm}>{fmt(wo.startDate)} → {wo.endDate ? fmt(wo.endDate) : 'Open'}</Text>
          </View>
        </View>

        {/* Commercial terms */}
        <Text style={S.tableTitle}>Commercial Terms</Text>
        <View style={S.detailsRow}>
          {([
            ['GST', pct(wo.gstPercent)], ['TDS', pct(wo.tdsPercent)], ['Retention', pct(wo.retentionPercent)],
            ['Payment Terms', wo.paymentTermsDays != null ? `${wo.paymentTermsDays} days` : '—'],
            ['Billing Cycle', wo.billingCycleMonths != null ? `${wo.billingCycleMonths} mo` : '—'],
            ['Shift Hrs/Day', wo.workingHoursPerDay != null ? String(wo.workingHoursPerDay) : '—'],
            ['Operator By', wo.operatorByWhom ?? '—'], ['Diesel By', wo.dieselByWhom ?? '—'],
            ['OT Multiplier', wo.overtimeRateMultiplier != null ? `${wo.overtimeRateMultiplier}x` : '—'],
            ['Mobilization', wo.mobilizationCharge != null ? `₹${num(wo.mobilizationCharge)}` : '—'],
            ['Demobilization', wo.demobilizationCharge != null ? `₹${num(wo.demobilizationCharge)}` : '—'],
            ...(wo.workOrderType === 'JOB' ? [['Agreed Job Amount', wo.agreedJobAmount != null ? `₹${num(wo.agreedJobAmount)}` : '—'] as [string, string]] : []),
          ] as [string, string][]).map(([label, val]) => (
            <View key={label} style={S.detailBox}>
              <Text style={S.infoLabel}>{label}</Text>
              <Text style={S.infoValueSm}>{val}</Text>
            </View>
          ))}
        </View>

        {/* Shift windows */}
        {wo.shiftDuty && shifts.length > 0 && (
          <>
            <Text style={S.tableTitle}>Shift Windows</Text>
            <View style={S.table}>
              <View style={S.thead}>
                <Text style={[S.th, { flex: 0.6 }]}>Shift</Text>
                <Text style={[S.th, { flex: 1 }]}>Start</Text>
                <Text style={[S.th, { flex: 1 }]}>End</Text>
                <Text style={[S.th, { flex: 1.2 }]}>Operator Pay</Text>
                <Text style={[S.thLast, { flex: 1.2 }]}>Cleaner Pay</Text>
              </View>
              {shifts.map((sh, i) => (
                <View key={sh.id} style={i === shifts.length - 1 ? S.trLast : S.tr}>
                  <Text style={[S.td, { flex: 0.6 }]}>{sh.shiftNumber}</Text>
                  <Text style={[S.td, { flex: 1 }]}>{sh.startTime}</Text>
                  <Text style={[S.td, { flex: 1 }]}>{sh.endTime}</Text>
                  <Text style={[S.td, { flex: 1.2 }]}>₹{num(sh.operatorPay)}</Text>
                  <Text style={[S.tdLast, { flex: 1.2 }]}>{sh.cleanerPay != null ? `₹${num(sh.cleanerPay)}` : '—'}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Machines */}
        {assignments.length > 0 && (
          <>
            <Text style={S.tableTitle}>Machines ({assignments.length})</Text>
            <View style={S.table}>
              <View style={S.thead}>
                <Text style={[S.th, { flex: 1.5 }]}>Machine</Text>
                <Text style={[S.th, { flex: 1.5 }]}>Type</Text>
                <Text style={[S.th, { flex: 1.5 }]}>Operator</Text>
                <Text style={[S.th, { flex: 1.5 }]}>Cleaner</Text>
                <Text style={[S.th, { flex: 1 }]}>Start</Text>
                <Text style={[S.thLast, { flex: 1 }]}>Rate</Text>
              </View>
              {assignments.map((a, i) => (
                <View key={a.id} style={i === assignments.length - 1 ? S.trLast : S.tr}>
                  <Text style={[S.tdLeft, { flex: 1.5 }]}>{a.registrationNumber || a.serialNumber || '—'}</Text>
                  <Text style={[S.tdLeft, { flex: 1.5 }]}>{a.equipmentTypeName || '—'}</Text>
                  <Text style={[S.tdLeft, { flex: 1.5 }]}>{a.operatorStaffName || a.hiredOperatorName || '—'}</Text>
                  <Text style={[S.tdLeft, { flex: 1.5 }]}>{a.cleanerStaffName || a.clientCleanerName || '—'}</Text>
                  <Text style={[S.td, { flex: 1 }]}>{fmt(a.startDate)}</Text>
                  <Text style={[S.tdLast, { flex: 1 }]}>{a.rateAmount != null ? `₹${num(a.rateAmount)}` : '—'}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Clauses / notes */}
        {(wo.escalationClause || wo.penaltyClause || wo.notes) && (
          <View style={S.remarksBox}>
            {wo.escalationClause && (<><Text style={S.remarksLabel}>Escalation Clause</Text><Text style={S.remarksText}>{wo.escalationClause}</Text></>)}
            {wo.penaltyClause && (<><Text style={[S.remarksLabel, wo.escalationClause ? { marginTop: 5 } : {}]}>Penalty / LD Clause</Text><Text style={S.remarksText}>{wo.penaltyClause}</Text></>)}
            {wo.notes && (<><Text style={[S.remarksLabel, (wo.escalationClause || wo.penaltyClause) ? { marginTop: 5 } : {}]}>Notes</Text><Text style={S.remarksText}>{wo.notes}</Text></>)}
          </View>
        )}

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

export async function openWorkOrderPdf(wo: WorkOrder, assignments: MachineAssignment[], companyName: string) {
  const blob = await pdf(<WorkOrderPdfDocument wo={wo} assignments={assignments} companyName={companyName} />).toBlob()
  const url  = URL.createObjectURL(blob)
  window.open(url, '_blank')
}
