import { useState, useRef, useCallback } from 'react'
import { Printer } from 'lucide-react'

// ── Amount helpers ─────────────────────────────────────────────────────────────
const ONES = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
  'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen']
const TENS = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']

function below100(n: number): string {
  if (n < 20) return ONES[n]
  return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '')
}
function below1000(n: number): string {
  if (n < 100) return below100(n)
  return ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + below100(n % 100) : '')
}
function amountInWords(n: number): string {
  if (!n || isNaN(n)) return ''
  const crore = Math.floor(n / 10_000_000)
  const lakh  = Math.floor((n % 10_000_000) / 100_000)
  const thous = Math.floor((n % 100_000) / 1_000)
  const rem   = n % 1_000
  const parts: string[] = []
  if (crore) parts.push(below1000(crore) + ' Crore')
  if (lakh)  parts.push(below1000(lakh)  + ' Lakh')
  if (thous) parts.push(below1000(thous) + ' Thousand')
  if (rem)   parts.push(below1000(rem))
  return 'Rupees ' + (parts.join(' ') || 'Zero') + ' Only'
}
function inr(n: number): string {
  return '₹' + n.toLocaleString('en-IN')
}
function formatDate(d: string): string {
  if (!d) return '_____ day of __________________, 2026'
  const dt = new Date(d)
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ── State type ─────────────────────────────────────────────────────────────────
interface MouState {
  clientName: string; clientAddress: string; clientPerson: string; clientDesig: string
  mouDate: string; govState: string
  vehicles: string; rate: string; onboardingFee: string; gstRate: string
  modOps: boolean; modLr: boolean; modFin: boolean; modClient: boolean
  modFleet: boolean; modBreakdown: boolean; modService: boolean; modFuel: boolean
  modInventory: boolean; modHr: boolean; modAttendance: boolean; modPayroll: boolean
  modReports: boolean; modMobile: boolean; modNotifications: boolean; modGps: boolean
  obMigration: boolean; obConfig: boolean; obTraining: boolean; obGolive: boolean
  trainingSessions: string; goliveDays: string
  aoGps: boolean; aoEpod: boolean; aoPriority: boolean; aoApi: boolean
  specialTerms: string
}

const INIT: MouState = {
  clientName: '', clientAddress: '', clientPerson: '', clientDesig: '',
  mouDate: '', govState: 'Andhra Pradesh',
  vehicles: '', rate: '', onboardingFee: '29999', gstRate: '18',
  modOps: true, modLr: true, modFin: true, modClient: true,
  modFleet: true, modBreakdown: true, modService: true, modFuel: true,
  modInventory: true, modHr: true, modAttendance: true, modPayroll: true,
  modReports: true, modMobile: true, modNotifications: true, modGps: true,
  obMigration: true, obConfig: true, obTraining: true, obGolive: true,
  trainingSessions: '3', goliveDays: '7 days',
  aoGps: false, aoEpod: false, aoPriority: false, aoApi: false,
  specialTerms: '',
}

// ── MOU document styles (inline, print-safe) ───────────────────────────────────
const D = {
  doc:    { fontFamily: 'Georgia, serif', fontSize: 12.5, color: '#1a1a1a', lineHeight: 1.7, padding: '18mm 20mm', background: '#fff', maxWidth: 760, margin: '0 auto' } as React.CSSProperties,
  hdr:    { textAlign: 'center' as const, borderBottom: '3px solid #1a3a5c', paddingBottom: 14, marginBottom: 20 },
  brand:  { fontSize: 26, fontWeight: 'bold', color: '#1a3a5c', letterSpacing: 4 },
  tag:    { fontSize: 10, color: '#1a3a5c', letterSpacing: 2, textTransform: 'uppercase' as const, marginTop: 3 },
  title:  { textAlign: 'center' as const, margin: '18px 0 8px' },
  h1:     { fontSize: 16, fontWeight: 'bold', color: '#1a3a5c', textTransform: 'uppercase' as const, letterSpacing: 2 },
  sub:    { fontSize: 11.5, color: '#555', marginTop: 6 },
  hr:     { border: 'none', borderTop: '1px solid #ddd', margin: '14px 0' },
  parties:{ background: '#f7f9fc', border: '1px solid #d0dbe8', borderRadius: 6, padding: '14px 18px', marginBottom: 18 },
  ptag:   { display: 'inline-block', marginTop: 5, fontSize: 10, background: '#1a3a5c', color: '#fff', padding: '2px 8px', borderRadius: 3, letterSpacing: 1 },
  andLine:{ textAlign: 'center' as const, fontSize: 10, color: '#bbb', letterSpacing: 2, margin: '8px 0', textTransform: 'uppercase' as const },
  clause: { marginBottom: 18 },
  cTitle: { fontSize: 12, fontWeight: 'bold', color: '#1a3a5c', textTransform: 'uppercase' as const, letterSpacing: 1, borderLeft: '4px solid #e67e22', paddingLeft: 10, marginBottom: 8 },
  cNum:   { color: '#e67e22', marginRight: 4 },
  p:      { fontSize: 12, color: '#333', marginBottom: 6, lineHeight: 1.75 },
  li:     { fontSize: 12, color: '#333', marginBottom: 4, lineHeight: 1.75 },
  notice: { background: '#fff8e1', border: '1px solid #f0c040', borderRadius: 5, padding: '9px 13px', margin: '10px 0', fontSize: 11.5, color: '#7a5c00', lineHeight: 1.7 },
  sigGrid:{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 14, pageBreakInside: 'avoid' as const },
  sigBlk: { border: '1px solid #d0dbe8', borderRadius: 6, padding: 14, background: '#f7f9fc' },
  sigHdr: { fontSize: 10, fontWeight: 'bold', color: '#1a3a5c', textTransform: 'uppercase' as const, letterSpacing: 1, borderBottom: '1px solid #d0dbe8', paddingBottom: 7, marginBottom: 10 },
  sigLbl: { fontSize: 10, color: '#999', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  sigVal: { fontSize: 12, fontWeight: 'bold', color: '#222', marginTop: 1 },
  sigLne: { borderBottom: '1px solid #aaa', height: 26, marginTop: 3, marginBottom: 8 },
  seal:   { border: '1px dashed #bbb', height: 55, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: 10, letterSpacing: 1, textTransform: 'uppercase' as const, marginTop: 10 },
  footer: { marginTop: 24, paddingTop: 10, borderTop: '2px solid #1a3a5c', textAlign: 'center' as const, fontSize: 10, color: '#999' },
} as const

const TH: React.CSSProperties = { background: '#1a3a5c', color: '#fff', padding: '8px 12px', textAlign: 'left', fontSize: 12 }
const TD: React.CSSProperties = { padding: '7px 12px', borderBottom: '1px solid #e5e5e5', fontSize: 12 }
const TDtotal: React.CSSProperties = { ...TD, fontWeight: 'bold', background: '#eaf0f8', color: '#1a3a5c' }

// ── Main component ─────────────────────────────────────────────────────────────
export function SAMouPage() {
  const [f, setF] = useState<MouState>(INIT)
  const docRef = useRef<HTMLDivElement>(null)

  const set = useCallback(<K extends keyof MouState>(k: K, v: MouState[K]) =>
    setF(prev => ({ ...prev, [k]: v })), [])

  const vehicles     = parseInt(f.vehicles)     || 0
  const rate         = parseInt(f.rate)         || 0
  const onboardingFee= parseInt(f.onboardingFee)|| 0
  const gstRate      = parseFloat(f.gstRate)    || 0
  const monthly      = vehicles * rate
  const annual       = monthly * 12
  const subtotal     = annual + onboardingFee
  const gstAmount    = Math.round(subtotal * gstRate / 100)
  const year1Total   = subtotal + gstAmount

  const modules = [
    { key: 'modOps',           label: 'Operations, Orders & Trip Management' },
    { key: 'modLr',            label: 'LR (Lorry Receipt) Management' },
    { key: 'modFin',           label: 'Finance & Billing — Invoices, Payments, Credit Notes, Service Invoices' },
    { key: 'modClient',        label: 'Client Management & Client Advances' },
    { key: 'modFleet',         label: 'Fleet Management — Vehicles, Documents, Meter Readings' },
    { key: 'modBreakdown',     label: 'Breakdown Management & Recovery Tracking' },
    { key: 'modService',       label: 'Vehicle Services & Service Manager Portal' },
    { key: 'modFuel',          label: 'Fuel Logs & Mileage Tracking' },
    { key: 'modInventory',     label: 'Inventory — Spare Parts, Tyres, Part & Tyre Requests' },
    { key: 'modHr',            label: 'HR & Staff Management' },
    { key: 'modAttendance',    label: 'Attendance Management' },
    { key: 'modPayroll',       label: 'Payroll & Payslips' },
    { key: 'modReports',       label: 'Reports — 11 sub-modules (Trips, Invoices, Attendance, Expenses, P&L, Payroll, Inventory & more)' },
    { key: 'modMobile',        label: 'Mobile Application — Dedicated apps for Drivers, Supervisors & Office Staff' },
    { key: 'modNotifications', label: 'Notifications & Alerts' },
    { key: 'modGps',           label: 'GPS Tracking Integration*' },
  ] as const

  const selectedModules = modules.filter(m => f[m.key])
  const hasGps          = f.modGps

  const onboardingServices = [
    { key: 'obMigration', label: `Data Migration — Import of existing vehicle data, client records, and staff information from Excel or existing systems` },
    { key: 'obConfig',    label: `System Configuration — Setup of roles, designations, masters, and company-specific configurations` },
    { key: 'obTraining',  label: `Team Training — ${f.trainingSessions || '3'} training session(s) covering all relevant roles` },
    { key: 'obGolive',    label: `Go-Live Support — Dedicated support for ${f.goliveDays || '7 days'} post go-live to ensure smooth transition` },
  ] as const

  const selectedOnboarding = onboardingServices.filter(o => f[o.key])

  const addons = [
    { key: 'aoGps',      label: 'Real-time GPS Advanced Tracking', price: `${inr(149)} per vehicle per month` },
    { key: 'aoEpod',     label: 'ePOD (Electronic Proof of Delivery)', price: `${inr(99)} per vehicle per month` },
    { key: 'aoPriority', label: 'Priority Support (4-hour SLA, dedicated manager)', price: `${inr(2499)} per month` },
    { key: 'aoApi',      label: 'API Access (third-party integrations)', price: `${inr(2999)} per month` },
  ] as const

  const selectedAddons = addons.filter(a => f[a.key])

  function handlePrint() {
    const content = docRef.current
    if (!content) return
    const win = window.open('', '_blank', 'width=900,height=800')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>FEROS MOU — ${f.clientName || 'Draft'}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Georgia, serif; font-size: 12.5px; color: #1a1a1a; }
  @page { margin: 15mm 18mm; }
  @media print { body { margin: 0; } }
  .mou-table { width:100%; border-collapse:collapse; margin:10px 0; font-size:12px; }
  .mou-table thead tr { background:#1a3a5c; color:#fff; }
  .mou-table thead th { padding:8px 12px; text-align:left; }
  .mou-table tbody tr:nth-child(even) { background:#f4f7fb; }
  .mou-table tbody td { padding:7px 12px; border-bottom:1px solid #e5e5e5; }
  .mou-table tbody tr.total-row td { font-weight:bold; background:#eaf0f8; color:#1a3a5c; }
  .clause { margin-bottom:18px; page-break-inside:avoid; }
  .sig-grid { display:grid; grid-template-columns:1fr 1fr; gap:24px; margin-top:14px; page-break-inside:avoid; }
  .sig-block { border:1px solid #d0dbe8; border-radius:6px; padding:14px; background:#f7f9fc; }
  .seal-box { border:1px dashed #bbb; height:55px; border-radius:4px; display:flex; align-items:center; justify-content:center; color:#bbb; font-size:10px; letter-spacing:1px; text-transform:uppercase; margin-top:10px; }
</style>
</head><body>`)
    win.document.write(content.innerHTML)
    win.document.write('</body></html>')
    win.document.close()
    win.focus()
    setTimeout(() => { win.print(); win.close() }, 400)
  }

  // ── Form field helpers ───────────────────────────────────────────────────────
  const FLabel = ({ children }: { children: React.ReactNode }) => (
    <span style={{ display: 'block', fontSize: 11, color: '#8fb3d4', marginBottom: 4, letterSpacing: 0.5 }}>{children}</span>
  )
  const inputCls = 'w-full bg-[#0f2840] border border-[#2d5a8a] text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:border-orange-400'
  const SecTitle = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: 10, fontWeight: 'bold', color: '#e67e22', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid #2d5a8a' }}>{children}</div>
  )
  const Chk = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ width: 14, height: 14, accentColor: '#e67e22', cursor: 'pointer' }} />
      <span style={{ fontSize: 11, color: '#c0d8f0' }}>{label}</span>
    </label>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', minHeight: 'calc(100vh - 60px)' }}>

      {/* ── Form Panel ── */}
      <div style={{ background: '#1a3a5c', padding: '24px 20px', overflowY: 'auto', position: 'sticky', top: 0, height: 'calc(100vh - 60px)' }}>
        <div style={{ fontSize: 20, fontWeight: 'bold', color: '#fff', letterSpacing: 3, marginBottom: 2 }}>
          FER<span style={{ color: '#e67e22' }}>O</span>S
        </div>
        <div style={{ fontSize: 10, color: '#8fb3d4', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 20 }}>MOU Generator</div>

        {/* Client Details */}
        <div style={{ marginBottom: 18 }}>
          <SecTitle>Client Details</SecTitle>
          <div style={{ marginBottom: 8 }}><FLabel>Company Name *</FLabel>
            <input className={inputCls} value={f.clientName} onChange={e => set('clientName', e.target.value)} placeholder="e.g. Ashlar Building Solutions India Pvt Ltd" />
          </div>
          <div style={{ marginBottom: 8 }}><FLabel>Registered Address</FLabel>
            <textarea className={inputCls} value={f.clientAddress} onChange={e => set('clientAddress', e.target.value)} placeholder="Full registered address" rows={2} style={{ resize: 'vertical' }} />
          </div>
          <div style={{ marginBottom: 8 }}><FLabel>Contact Person *</FLabel>
            <input className={inputCls} value={f.clientPerson} onChange={e => set('clientPerson', e.target.value)} placeholder="e.g. Neelash Agarwal" />
          </div>
          <div><FLabel>Designation *</FLabel>
            <input className={inputCls} value={f.clientDesig} onChange={e => set('clientDesig', e.target.value)} placeholder="e.g. Managing Director" />
          </div>
        </div>

        {/* MOU Details */}
        <div style={{ marginBottom: 18 }}>
          <SecTitle>MOU Details</SecTitle>
          <div style={{ marginBottom: 8 }}><FLabel>MOU Date</FLabel>
            <input type="date" className={inputCls} value={f.mouDate} onChange={e => set('mouDate', e.target.value)} />
          </div>
          <div><FLabel>Governing State</FLabel>
            <input className={inputCls} value={f.govState} onChange={e => set('govState', e.target.value)} />
          </div>
        </div>

        {/* Pricing */}
        <div style={{ marginBottom: 18 }}>
          <SecTitle>Pricing</SecTitle>
          <div style={{ marginBottom: 8 }}><FLabel>Number of Vehicles *</FLabel>
            <input type="number" className={inputCls} value={f.vehicles} onChange={e => set('vehicles', e.target.value)} placeholder="e.g. 100" min={1} />
          </div>
          <div style={{ marginBottom: 8 }}><FLabel>Rate per Vehicle / Month (₹) *</FLabel>
            <input type="number" className={inputCls} value={f.rate} onChange={e => set('rate', e.target.value)} placeholder="e.g. 700" />
          </div>
          <div style={{ marginBottom: 8 }}><FLabel>Onboarding Fee (₹)</FLabel>
            <input type="number" className={inputCls} value={f.onboardingFee} onChange={e => set('onboardingFee', e.target.value)} />
          </div>
          <div style={{ marginBottom: 8 }}><FLabel>GST Rate (%)</FLabel>
            <input type="number" className={inputCls} value={f.gstRate} onChange={e => set('gstRate', e.target.value)} placeholder="e.g. 18" min={0} max={100} />
          </div>
          {(monthly > 0 || onboardingFee > 0) && (
            <div style={{ background: '#0f2840', border: '1px solid #2d5a8a', borderRadius: 5, padding: '10px 12px' }}>
              {[
                { l: 'Monthly Value', v: monthly > 0 ? inr(monthly) : '—' },
                { l: 'Annual Subscription', v: annual > 0 ? inr(annual) : '—' },
                { l: 'Onboarding Fee', v: onboardingFee > 0 ? inr(onboardingFee) : '—' },
                { l: `GST (${gstRate}%)`, v: gstAmount > 0 ? inr(gstAmount) : '—' },
              ].map(r => (
                <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8fb3d4', marginBottom: 4 }}>
                  <span>{r.l}</span><span>{r.v}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#e67e22', fontWeight: 'bold', borderTop: '1px solid #2d5a8a', paddingTop: 6, marginTop: 4 }}>
                <span>Year 1 Total (incl. GST)</span><span>{year1Total > 0 ? inr(year1Total) : '—'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Modules */}
        <div style={{ marginBottom: 18 }}>
          <SecTitle>Modules Included</SecTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <Chk label="Operations & Trips"    checked={f.modOps}           onChange={v => set('modOps', v)} />
            <Chk label="LR Management"         checked={f.modLr}            onChange={v => set('modLr', v)} />
            <Chk label="Finance & Billing"     checked={f.modFin}           onChange={v => set('modFin', v)} />
            <Chk label="Client Management"     checked={f.modClient}        onChange={v => set('modClient', v)} />
            <Chk label="Fleet Management"      checked={f.modFleet}         onChange={v => set('modFleet', v)} />
            <Chk label="Breakdown Mgmt"        checked={f.modBreakdown}     onChange={v => set('modBreakdown', v)} />
            <Chk label="Vehicle Services"      checked={f.modService}       onChange={v => set('modService', v)} />
            <Chk label="Fuel & Mileage"        checked={f.modFuel}          onChange={v => set('modFuel', v)} />
            <Chk label="Spare Parts & Tyres"   checked={f.modInventory}     onChange={v => set('modInventory', v)} />
            <Chk label="HR & Staff"            checked={f.modHr}            onChange={v => set('modHr', v)} />
            <Chk label="Attendance"            checked={f.modAttendance}    onChange={v => set('modAttendance', v)} />
            <Chk label="Payroll & Payslips"    checked={f.modPayroll}       onChange={v => set('modPayroll', v)} />
            <Chk label="Reports (11 modules)"  checked={f.modReports}       onChange={v => set('modReports', v)} />
            <Chk label="Mobile App"            checked={f.modMobile}        onChange={v => set('modMobile', v)} />
            <Chk label="Notifications"         checked={f.modNotifications} onChange={v => set('modNotifications', v)} />
            <Chk label="GPS Tracking*"         checked={f.modGps}           onChange={v => set('modGps', v)} />
          </div>
        </div>

        {/* Onboarding */}
        <div style={{ marginBottom: 18 }}>
          <SecTitle>Onboarding Services</SecTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
            <Chk label="Data Migration"      checked={f.obMigration} onChange={v => set('obMigration', v)} />
            <Chk label="System Config"       checked={f.obConfig}    onChange={v => set('obConfig', v)} />
            <Chk label="Team Training"       checked={f.obTraining}  onChange={v => set('obTraining', v)} />
            <Chk label="Go-Live Support"     checked={f.obGolive}    onChange={v => set('obGolive', v)} />
          </div>
          <div style={{ marginBottom: 8 }}><FLabel>Training Sessions (days)</FLabel>
            <input type="number" className={inputCls} value={f.trainingSessions} onChange={e => set('trainingSessions', e.target.value)} min={1} />
          </div>
          <div><FLabel>Go-Live Support Duration</FLabel>
            <input className={inputCls} value={f.goliveDays} onChange={e => set('goliveDays', e.target.value)} />
          </div>
        </div>

        {/* Add-Ons */}
        <div style={{ marginBottom: 18 }}>
          <SecTitle>Add-On Services</SecTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <Chk label="GPS (₹149/veh/mo)"  checked={f.aoGps}      onChange={v => set('aoGps', v)} />
            <Chk label="ePOD (₹99/veh/mo)"  checked={f.aoEpod}     onChange={v => set('aoEpod', v)} />
            <Chk label="Priority Support"    checked={f.aoPriority} onChange={v => set('aoPriority', v)} />
            <Chk label="API Access"          checked={f.aoApi}      onChange={v => set('aoApi', v)} />
          </div>
        </div>

        {/* Special Terms */}
        <div style={{ marginBottom: 18 }}>
          <SecTitle>Additional Notes (optional)</SecTitle>
          <FLabel>Special Terms / Notes</FLabel>
          <textarea className={inputCls} value={f.specialTerms} onChange={e => set('specialTerms', e.target.value)} placeholder="Any special terms for this client..." rows={3} style={{ resize: 'vertical' }} />
        </div>

        <button
          onClick={handlePrint}
          style={{ width: '100%', background: '#e67e22', color: '#fff', border: 'none', borderRadius: 6, padding: '11px', fontSize: 13, fontWeight: 'bold', cursor: 'pointer', letterSpacing: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <Printer size={16} /> Print / Save as PDF
        </button>
      </div>

      {/* ── Preview Panel ── */}
      <div style={{ background: '#e8ecf0', padding: '32px 24px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: 2 }}>
            Live Preview — fill form on left to update
          </div>
          <button
            onClick={handlePrint}
            style={{ background: '#1a3a5c', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', fontSize: 11, fontWeight: 'bold', cursor: 'pointer', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase' }}
          >
            <Printer size={13} /> Download PDF
          </button>
        </div>

        {/* MOU Document */}
        <div ref={docRef} style={D.doc}>

          {/* Header */}
          <div style={D.hdr}>
            <div style={D.brand}>FER<span style={{ color: '#e67e22' }}>O</span>S</div>
            <div style={D.tag}>Fleet Equipment Rental Operating System</div>
          </div>

          {/* Title */}
          <div style={D.title}>
            <h1 style={D.h1}>Memorandum of Understanding</h1>
            <p style={D.sub}>This MOU is entered into on this&nbsp;
              <strong>{formatDate(f.mouDate)}</strong>
            </p>
          </div>
          <hr style={D.hr} />

          {/* Parties */}
          <div style={D.parties}>
            <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Between</div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 'bold', color: '#1a3a5c', fontSize: 13 }}>MandM Technologies</div>
              <div style={{ fontSize: 11.5, color: '#444', marginTop: 2 }}>15-13-07, Gavarapalem, Anakapalle, Andhra Pradesh, India<br />Present Office: Visakhapatnam (Vizag), Andhra Pradesh</div>
              <div style={{ fontSize: 11.5, color: '#333', marginTop: 3 }}>Represented by: <strong>Manikanta Chadaram</strong> (Director) &amp; <strong>Shaik Madeena</strong> (Director)</div>
              <span style={D.ptag}>Service Provider</span>
            </div>
            <div style={D.andLine}>— AND —</div>
            <div>
              <div style={{ fontWeight: 'bold', color: '#1a3a5c', fontSize: 13 }}>{f.clientName || '________________________'}</div>
              <div style={{ fontSize: 11.5, color: '#444', marginTop: 2 }}>{f.clientAddress || '________________________'}</div>
              <div style={{ fontSize: 11.5, color: '#333', marginTop: 3 }}>Represented by: <strong>{f.clientPerson || '________________________'}</strong> ({f.clientDesig || '________________________'})</div>
              <span style={D.ptag}>Client</span>
            </div>
          </div>

          {/* Clause 1 — Purpose */}
          <div style={D.clause}>
            <div style={D.cTitle}><span style={D.cNum}>1.</span> Purpose</div>
            <p style={D.p}>This MOU sets out the terms and mutual understanding between the Parties for the provision of <strong>FEROS</strong> — a cloud-based Transport and Fleet Management Software developed by MandM Technologies — to the Client for managing their transport operations, fleet, finance, HR, inventory, and reporting.</p>
          </div>

          {/* Clause 2 — Scope */}
          <div style={D.clause}>
            <div style={D.cTitle}><span style={D.cNum}>2.</span> Scope of Services</div>
            <p style={D.p}>The Service Provider agrees to provide the Client full access to the FEROS platform. The following services and modules are included in the subscription:</p>
            <ul style={{ paddingLeft: 18, margin: '6px 0' }}>
              {selectedModules.map(m => <li key={m.key} style={D.li}>{m.label}</li>)}
            </ul>
            {hasGps && (
              <p style={{ ...D.p, marginTop: 8, fontStyle: 'italic', color: '#555' }}>
                * GPS Tracking is included in the platform. However, GPS hardware and third-party GPS API integrations (such as Tata Fleet Edge, BlackBuck, Ashok Leyland GPS, etc.) must be arranged and provided by the Client at their own cost. FEROS will integrate with the Client's chosen GPS provider upon receiving the required API credentials.
              </p>
            )}
            <p style={{ ...D.p, marginTop: 8 }}>All modules listed above are included in the subscription at no additional cost unless specified under Add-On Services (Clause 5).</p>
          </div>

          {/* Clause 3 — Pricing */}
          <div style={D.clause}>
            <div style={D.cTitle}><span style={D.cNum}>3.</span> Subscription Terms &amp; Pricing</div>

            <p style={D.p}><strong>3.1 Pricing</strong></p>
            <table className="mou-table" style={{ width: '100%', borderCollapse: 'collapse', margin: '10px 0', fontSize: 12 }}>
              <thead><tr><th style={TH}>Description</th><th style={TH}>Details</th></tr></thead>
              <tbody>
                <tr><td style={TD}>Active Vehicles</td><td style={TD}>{vehicles > 0 ? `${vehicles} Vehicles` : '—'}</td></tr>
                <tr style={{ background: '#f4f7fb' }}><td style={TD}>Rate per Vehicle per Month</td><td style={TD}>{rate > 0 ? `${inr(rate)} per vehicle per month` : '—'}</td></tr>
                <tr><td style={TD}>Annual Subscription</td><td style={TD}>{annual > 0 ? `${inr(annual)} (${amountInWords(annual)})` : '—'}</td></tr>
                <tr style={{ background: '#f4f7fb' }}><td style={TD}>Onboarding Fee (One-time, Non-refundable)</td><td style={TD}>{onboardingFee > 0 ? `${inr(onboardingFee)} (${amountInWords(onboardingFee)})` : '—'}</td></tr>
                <tr><td style={TD}>Sub-Total</td><td style={TD}>{subtotal > 0 ? `${inr(subtotal)} (${amountInWords(subtotal)})` : '—'}</td></tr>
                <tr style={{ background: '#f4f7fb' }}><td style={TD}>GST @ {gstRate}%</td><td style={TD}>{gstAmount > 0 ? `${inr(gstAmount)} (${amountInWords(gstAmount)})` : '—'}</td></tr>
                <tr className="total-row"><td style={TDtotal}>Year 1 Total Payable (incl. GST)</td><td style={TDtotal}>{year1Total > 0 ? `${inr(year1Total)} (${amountInWords(year1Total)})` : '—'}</td></tr>
                <tr><td style={TD}>Year 2 Onwards (excl. GST)</td><td style={TD}>{annual > 0 ? `${inr(annual)} per year + GST as applicable (subject to revision with 60 days notice)` : '—'}</td></tr>
              </tbody>
            </table>

            <p style={{ ...D.p, marginTop: 10 }}><strong>3.2 Payment Terms</strong></p>
            <ul style={{ paddingLeft: 18, margin: '6px 0' }}>
              <li style={D.li}>The <strong>Onboarding Fee</strong> is payable prior to commencement of onboarding and is <strong>non-refundable</strong>.</li>
              <li style={D.li}>The <strong>Annual Subscription</strong> is payable <strong>upfront</strong> for the full year at the time of signing this MOU.</li>
              <li style={D.li}>All payments to be made via NEFT / RTGS / UPI to the bank account details provided by the Service Provider.</li>
              <li style={D.li}>GST as applicable will be charged additionally on all amounts.</li>
              <li style={D.li}>If the annual renewal payment is delayed beyond <strong>15 days</strong> from the renewal date, the Service Provider reserves the right to suspend access until payment is received.</li>
            </ul>

            <p style={{ ...D.p, marginTop: 10 }}><strong>3.3 Subscription Period</strong></p>
            <ul style={{ paddingLeft: 18, margin: '6px 0' }}>
              <li style={D.li}>The subscription period is <strong>12 months</strong> from the date of go-live.</li>
              <li style={D.li}>The subscription <strong>auto-renews annually</strong> unless either Party provides written notice of non-renewal at least <strong>30 days</strong> before the renewal date.</li>
              <li style={D.li}>Subscription price for Year 2 onwards is subject to revision with a minimum of <strong>60 days' prior written notice</strong>.</li>
            </ul>

            <p style={{ ...D.p, marginTop: 10 }}><strong>3.4 Vehicle Addition</strong></p>
            <ul style={{ paddingLeft: 18, margin: '6px 0' }}>
              <li style={D.li}>If the Client adds vehicles beyond the agreed count during the subscription period, additional vehicles will be billed at the same agreed rate per vehicle per month, prorated for the remaining months.</li>
            </ul>

            <p style={{ ...D.p, marginTop: 10 }}><strong>3.5 New Modules &amp; Custom Requirements</strong></p>
            <ul style={{ paddingLeft: 18, margin: '6px 0' }}>
              <li style={D.li}>Any new module, feature, or custom requirement requested by the Client after signing this MOU will be separately scoped, estimated, and priced by the Service Provider.</li>
              <li style={D.li}>The pricing agreed in this MOU covers only the modules and services listed in Clause 2. Additional development work is not included.</li>
            </ul>
          </div>

          {/* Clause 4 — Onboarding */}
          <div style={D.clause}>
            <div style={D.cTitle}><span style={D.cNum}>4.</span> Onboarding &amp; Implementation</div>
            <p style={D.p}>The Service Provider agrees to provide the following as part of the onboarding fee:</p>
            <ul style={{ paddingLeft: 18, margin: '6px 0' }}>
              {selectedOnboarding.map(o => <li key={o.key} style={D.li}>{o.label}</li>)}
            </ul>
            <div style={D.notice}>
              Estimated go-live timeline: <strong>7–14 working days</strong> from receipt of onboarding fee and required data from the Client.
            </div>
            <p style={{ ...D.p, marginTop: 8 }}>Any additional training sessions requested by the Client after the initial onboarding is complete will be charged separately at a rate agreed upon at the time of the request.</p>
          </div>

          {/* Clause 5 — Add-Ons */}
          <div style={D.clause}>
            <div style={D.cTitle}><span style={D.cNum}>5.</span> Add-On Services (Optional)</div>
            <p style={D.p}>The following services are available at additional cost and can be activated at any time during the subscription period:</p>
            <table className="mou-table" style={{ width: '100%', borderCollapse: 'collapse', margin: '10px 0', fontSize: 12 }}>
              <thead><tr><th style={TH}>Service</th><th style={TH}>Price</th></tr></thead>
              <tbody>
                {(selectedAddons.length > 0 ? selectedAddons : addons).map((a, i) => (
                  <tr key={a.key} style={i % 2 === 1 ? { background: '#f4f7fb' } : {}}>
                    <td style={TD}>{a.label}</td><td style={TD}>{a.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Clause 6 — GPS */}
          <div style={D.clause}>
            <div style={D.cTitle}><span style={D.cNum}>6.</span> GPS Integration</div>
            <p style={D.p}>FEROS supports integration with third-party GPS providers including but not limited to Tata Fleet Edge, BlackBuck, and Ashok Leyland GPS systems.</p>
            <ul style={{ paddingLeft: 18, margin: '6px 0' }}>
              <li style={D.li}>GPS hardware procurement and installation is the sole responsibility of the Client.</li>
              <li style={D.li}>The Client must provide valid API credentials from their chosen GPS provider to enable integration.</li>
              <li style={D.li}>The Service Provider will integrate the GPS data into the FEROS platform at no additional charge, provided the GPS provider offers a standard API.</li>
              <li style={D.li}>The Service Provider is not responsible for GPS data accuracy, connectivity issues, or third-party GPS provider downtime.</li>
            </ul>
          </div>

          {/* Clause 7 — Support */}
          <div style={D.clause}>
            <div style={D.cTitle}><span style={D.cNum}>7.</span> Support &amp; Service Levels</div>
            <ul style={{ paddingLeft: 18, margin: '6px 0' }}>
              <li style={D.li}><strong>Standard Support</strong> — Email and WhatsApp support, response within 24 business hours</li>
              <li style={D.li}><strong>Platform Availability</strong> — 99% uptime guaranteed, excluding scheduled maintenance windows</li>
              <li style={D.li}><strong>Scheduled Maintenance</strong> — Communicated at least 24 hours in advance</li>
              <li style={D.li}><strong>Critical Bug Fixes</strong> — Resolved within 48 hours of reporting</li>
              <li style={D.li}><strong>Non-Critical Issues</strong> — Resolved within 7 working days</li>
              <li style={D.li}><strong>Feature Updates</strong> — Regular platform updates included at no additional cost</li>
              <li style={D.li}><strong>Force Majeure</strong> — The Service Provider shall not be liable for downtime caused by internet outages, power failures, natural disasters, or cloud infrastructure issues outside the Service Provider's direct control.</li>
            </ul>
          </div>

          {/* Clause 8 — Data */}
          <div style={D.clause}>
            <div style={D.cTitle}><span style={D.cNum}>8.</span> Data Ownership, Security &amp; Confidentiality</div>
            <p style={D.p}><strong>8.1 Data Ownership</strong><br />All data entered into the FEROS platform by the Client remains the <strong>sole property of the Client</strong>. The Service Provider shall not use, share, or sell Client data to any third party.</p>
            <p style={D.p}><strong>8.2 Data Accuracy</strong><br />The accuracy of data entered into the FEROS platform is the sole responsibility of the Client and their staff. The Service Provider is not liable for any business or financial decisions made based on incorrectly entered data.</p>
            <p style={D.p}><strong>8.3 Data Security &amp; Backups</strong><br />The Service Provider maintains automated data backups. The Client is advised to periodically export critical reports. The Service Provider's liability for data loss is limited to restoration from the most recent available backup.</p>
            <p style={D.p}><strong>8.4 Account Security</strong><br />The Client is responsible for keeping all login credentials secure. The Service Provider is not liable for unauthorized access resulting from the Client's failure to protect credentials.</p>
            <p style={D.p}><strong>8.5 Data Export</strong><br />The Client may request a full export of their data at any time. Data will be provided in CSV/Excel format within 7 working days of the request, at no charge.</p>
            <p style={D.p}><strong>8.6 Confidentiality</strong><br />Both Parties agree to keep the terms of this MOU, pricing, and all business information exchanged between them strictly confidential and shall not disclose the same to any third party without prior written consent.</p>
          </div>

          {/* Clause 9 — Staff */}
          <div style={D.clause}>
            <div style={D.cTitle}><span style={D.cNum}>9.</span> Staff &amp; User Responsibility</div>
            <ul style={{ paddingLeft: 18, margin: '6px 0' }}>
              <li style={D.li}>The Client is responsible for all actions performed on the FEROS platform by their staff and users.</li>
              <li style={D.li}>The Client must ensure their staff are adequately trained before using the platform for live operations.</li>
              <li style={D.li}>Any data deletion, modification, or misuse by the Client's staff is the Client's sole responsibility.</li>
              <li style={D.li}>The Service Provider reserves the right to suspend access if the platform is found to be misused or if activity is detected that causes harm to other users or the platform infrastructure.</li>
            </ul>
          </div>

          {/* Clause 10 — IP */}
          <div style={D.clause}>
            <div style={D.cTitle}><span style={D.cNum}>10.</span> Intellectual Property</div>
            <ul style={{ paddingLeft: 18, margin: '6px 0' }}>
              <li style={D.li}>The FEROS software, platform, design, codebase, and all related intellectual property remain the exclusive property of <strong>MandM Technologies</strong>.</li>
              <li style={D.li}>The Client is granted a non-exclusive, non-transferable licence to use the FEROS platform for their own internal business operations during the subscription period.</li>
              <li style={D.li}>The Client shall not copy, reverse engineer, resell, sublicense, or attempt to replicate any part of the FEROS platform.</li>
            </ul>
          </div>

          {/* Clause 11 — Updates */}
          <div style={D.clause}>
            <div style={D.cTitle}><span style={D.cNum}>11.</span> Software Updates &amp; Changes</div>
            <ul style={{ paddingLeft: 18, margin: '6px 0' }}>
              <li style={D.li}>The Service Provider may update, improve, or modify the FEROS platform at any time to enhance functionality, security, or performance.</li>
              <li style={D.li}>Core functionality agreed upon in this MOU will not be removed without prior written notice of at least <strong>30 days</strong>.</li>
              <li style={D.li}>The Client will be notified of significant changes via email or in-app notification.</li>
            </ul>
          </div>

          {/* Clause 12 — Cancellation */}
          <div style={D.clause}>
            <div style={D.cTitle}><span style={D.cNum}>12.</span> Cancellation &amp; Termination</div>
            <p style={D.p}><strong>12.1 No Mid-Term Cancellation</strong><br />The subscription is for a fixed annual term. No refund will be provided for unused months in the event of early termination by the Client.</p>
            <p style={D.p}><strong>12.2 Termination by Service Provider</strong><br />The Service Provider reserves the right to suspend or terminate access with <strong>30 days' written notice</strong> in the event of non-payment, misuse, or material breach of this MOU.</p>
            <p style={D.p}><strong>12.3 Renewal Opt-Out</strong><br />Either Party may choose not to renew by providing written notice at least <strong>30 days before</strong> the subscription renewal date.</p>
            <p style={D.p}><strong>12.4 Trial Period</strong><br />If a trial period was offered prior to this MOU, it does not carry over or extend the paid subscription period. The subscription term begins from the go-live date.</p>
          </div>

          {/* Clause 13 — Liability */}
          <div style={D.clause}>
            <div style={D.cTitle}><span style={D.cNum}>13.</span> Limitation of Liability</div>
            <ul style={{ paddingLeft: 18, margin: '6px 0' }}>
              <li style={D.li}>The Service Provider's total liability under this MOU shall not exceed the <strong>total annual subscription fee paid</strong> by the Client.</li>
              <li style={D.li}>The Service Provider shall not be liable for any indirect, consequential, or incidental losses arising from use or inability to use the platform.</li>
              <li style={D.li}>The Service Provider is not responsible for losses due to incorrect data, third-party GPS failures, internet disruptions, or force majeure events.</li>
            </ul>
          </div>

          {/* Clause 14 — Governing Law */}
          <div style={D.clause}>
            <div style={D.cTitle}><span style={D.cNum}>14.</span> Governing Law &amp; Dispute Resolution</div>
            <p style={D.p}>This MOU shall be governed by the laws of <strong>{f.govState || 'Andhra Pradesh'}</strong>, India. Disputes shall first be resolved amicably within 30 days. If unresolved, disputes shall be subject to the exclusive jurisdiction of the courts of <strong>{f.govState || 'Andhra Pradesh'}</strong>, India.</p>
          </div>

          {/* Clause 15 — General */}
          <div style={D.clause}>
            <div style={D.cTitle}><span style={D.cNum}>15.</span> General Terms</div>
            <ul style={{ paddingLeft: 18, margin: '6px 0' }}>
              <li style={D.li}>This MOU constitutes the entire understanding between the Parties and supersedes all prior discussions or agreements.</li>
              <li style={D.li}>Any amendments must be made in writing and signed by authorised representatives of both Parties.</li>
              <li style={D.li}>All official communication will be in English.</li>
              <li style={D.li}>If any provision is found invalid, remaining provisions continue in full force.</li>
              <li style={D.li}>This MOU is executed in two (2) originals, one retained by each Party.</li>
            </ul>
            {f.specialTerms && (
              <div style={{ marginTop: 10 }}>
                <p style={D.p}><strong>Special Terms:</strong></p>
                <p style={{ ...D.p, fontStyle: 'italic', color: '#444' }}>{f.specialTerms}</p>
              </div>
            )}
          </div>

          {/* Clause 16 — Signatures */}
          <div style={D.clause}>
            <div style={D.cTitle}><span style={D.cNum}>16.</span> Signatures</div>
            <div style={D.sigGrid}>
              {/* Service Provider */}
              <div style={D.sigBlk}>
                <div style={D.sigHdr}>MandM Technologies — Service Provider</div>
                <div style={{ marginBottom: 8 }}><div style={D.sigLbl}>Name</div><div style={D.sigVal}>Manikanta Chadaram</div></div>
                <div style={{ marginBottom: 8 }}><div style={D.sigLbl}>Designation</div><div style={D.sigVal}>Director</div></div>
                <div style={{ marginBottom: 8 }}><div style={D.sigLbl}>Signature</div><div style={D.sigLne} /></div>
                <div style={{ borderTop: '1px dashed #ccc', paddingTop: 10, marginTop: 10 }}>
                  <div style={{ marginBottom: 8 }}><div style={D.sigLbl}>Name</div><div style={D.sigVal}>Shaik Madeena</div></div>
                  <div style={{ marginBottom: 8 }}><div style={D.sigLbl}>Designation</div><div style={D.sigVal}>Director</div></div>
                  <div style={{ marginBottom: 8 }}><div style={D.sigLbl}>Signature</div><div style={D.sigLne} /></div>
                </div>
                <div style={{ marginBottom: 8 }}><div style={D.sigLbl}>Date</div><div style={D.sigLne} /></div>
                <div style={{ marginBottom: 8 }}><div style={D.sigLbl}>Place</div><div style={D.sigVal}>Visakhapatnam, Andhra Pradesh</div></div>
                <div style={D.seal}>Company Seal</div>
              </div>

              {/* Client */}
              <div style={D.sigBlk}>
                <div style={D.sigHdr}>{f.clientName || 'Client'}</div>
                <div style={{ marginBottom: 8 }}><div style={D.sigLbl}>Name</div><div style={D.sigVal}>{f.clientPerson || '________________________'}</div></div>
                <div style={{ marginBottom: 8 }}><div style={D.sigLbl}>Designation</div><div style={D.sigVal}>{f.clientDesig || '________________________'}</div></div>
                <div style={{ marginBottom: 8 }}><div style={D.sigLbl}>Signature</div><div style={D.sigLne} /></div>
                <div style={{ marginBottom: 8 }}><div style={D.sigLbl}>Date</div><div style={D.sigLne} /></div>
                <div style={{ marginBottom: 8 }}><div style={D.sigLbl}>Place</div><div style={D.sigLne} /></div>
                <div style={D.seal}>Company Seal</div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={D.footer}>
            <p>This document is confidential and intended solely for the Parties named herein.</p>
            <p style={{ marginTop: 3 }}>FEROS is a product of <strong>MandM Technologies</strong> &nbsp;|&nbsp; Visakhapatnam, Andhra Pradesh, India</p>
          </div>

        </div>{/* end mou doc */}
      </div>{/* end preview panel */}
    </div>
  )
}
