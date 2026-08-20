import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface Props {
  open: boolean
  serviceId: number
  serviceNumber?: string
  meterLabel?: string
  currentOdometer?: number
  existingBillDocUrl?: string
  onComplete: (data: { completedDate: string; odometer?: number; completedCost?: number }) => Promise<void>
  onUploadBill?: (serviceId: number, file: File) => Promise<string | undefined>
  onClose: () => void
}

export function CompleteServiceDialog({
  open, serviceId, serviceNumber, meterLabel = 'Odometer',
  currentOdometer, existingBillDocUrl,
  onComplete, onUploadBill, onClose,
}: Props) {
  const billRef = useRef<HTMLInputElement>(null)
  const today = new Date().toISOString().split('T')[0]
  const [completedDate, setCompletedDate] = useState(today)
  const [odometer, setOdometer]           = useState(currentOdometer ? String(currentOdometer) : '')
  const [completedCost, setCompletedCost] = useState('')
  const [uploadingBill, setUploadingBill] = useState(false)
  const [billDocUrl, setBillDocUrl]       = useState<string | undefined>(undefined)

  function handleClose() {
    setCompletedDate(today)
    setOdometer(currentOdometer ? String(currentOdometer) : '')
    setCompletedCost('')
    setBillDocUrl(undefined)
    onClose()
  }

  async function handleBillUpload(file: File) {
    if (!onUploadBill) return
    setUploadingBill(true)
    try {
      const url = await onUploadBill(serviceId, file)
      if (url) setBillDocUrl(url)
      toast.success('Bill document uploaded')
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploadingBill(false)
    }
  }

  const mutation = useMutation({
    mutationFn: () => onComplete({
      completedDate,
      odometer: odometer ? Number(odometer) : undefined,
      completedCost: completedCost ? Number(completedCost) : undefined,
    }),
    onSuccess: () => { toast.success('Service marked complete!'); handleClose() },
    onError: () => toast.error('Failed to complete service'),
  })

  const billUrl = billDocUrl ?? existingBillDocUrl
  const isBillImage = billUrl && /\.(png|jpe?g|gif|webp)(\?|$)/i.test(billUrl)

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Complete Service</DialogTitle></DialogHeader>
        {serviceNumber && <p className="text-sm text-gray-500">{serviceNumber}</p>}
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label>Completed Date *</Label>
            <Input type="date" value={completedDate} onChange={e => setCompletedDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{meterLabel} at Completion</Label>
            <Input type="number" placeholder={currentOdometer?.toString() ?? '0'} value={odometer} onChange={e => setOdometer(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Completed Cost ₹ <span className="text-gray-400 font-normal">(total bill from vendor)</span></Label>
            <Input type="number" placeholder="0" value={completedCost} onChange={e => setCompletedCost(e.target.value)} />
          </div>
          {onUploadBill && (
            <div className="space-y-1.5">
              <Label>Final Bill Document <span className="text-gray-400 font-normal">(optional)</span></Label>
              <input ref={billRef} type="file" accept="image/*,.pdf" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleBillUpload(f); e.target.value = '' }} />
              {billUrl ? (
                <div className="space-y-1.5">
                  {isBillImage
                    ? <img src={billUrl} alt="Bill" className="w-full rounded max-h-32 object-contain bg-gray-50 border" />
                    : <a href={billUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline">
                        Bill document uploaded ↗
                      </a>
                  }
                  <button onClick={() => billRef.current?.click()} disabled={uploadingBill}
                    className="text-xs text-gray-400 hover:text-gray-600">
                    {uploadingBill ? 'Uploading…' : 'Replace'}
                  </button>
                </div>
              ) : (
                <button onClick={() => billRef.current?.click()} disabled={uploadingBill}
                  className="w-full border-2 border-dashed border-gray-200 rounded-lg py-2.5 text-xs text-gray-400 hover:border-gray-300 flex items-center justify-center gap-1.5">
                  {uploadingBill ? 'Uploading…' : 'Upload Bill (image or PDF)'}
                </button>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !completedDate}
            className="bg-green-600 hover:bg-green-700 text-white">
            {mutation.isPending ? 'Saving…' : 'Mark Complete'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
