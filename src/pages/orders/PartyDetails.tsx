import { Label } from '@/components/ui/label'
import { SearchableSelect } from '@/components/ui/searchable-select'

// Party details for an order. The order's Client field (rendered by the parent form) is the
// PLACING client. Consignor (sender), Consignee (receiver) and Billing Client are optional
// add-ons. When Billing Client is empty the invoice bills the placing client; when the
// consignor/consignee are empty the LR falls back to legacy behaviour.
export interface PartyDetailsProps {
  options: { value: string; label: string }[]
  consignorClientId?: number
  consigneeClientId?: number
  billingPartyClientId?: number
  onConsignorChange: (id?: number) => void
  onConsigneeChange: (id?: number) => void
  onBillingPartyChange: (id?: number) => void
}

export function PartyDetails({
  options,
  consignorClientId,
  consigneeClientId,
  billingPartyClientId,
  onConsignorChange,
  onConsigneeChange,
  onBillingPartyChange,
}: PartyDetailsProps) {
  const withNone = [{ value: '', label: 'None' }, ...options]
  return (
    <div className="border-t pt-4">
      <p className="text-sm font-medium text-gray-700 mb-1">Party Details</p>
      <p className="text-xs text-gray-400 mb-3">
        Optional. The Client above is who placed the order. Pick the sender/receiver if they differ, and set a
        Billing Client only when a different party pays (otherwise the placing client is billed).
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>Consignor (Sender)</Label>
          <SearchableSelect
            value={consignorClientId ? String(consignorClientId) : ''}
            onValueChange={v => onConsignorChange(v ? Number(v) : undefined)}
            options={withNone}
            placeholder="Select consignor"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Consignee (Receiver)</Label>
          <SearchableSelect
            value={consigneeClientId ? String(consigneeClientId) : ''}
            onValueChange={v => onConsigneeChange(v ? Number(v) : undefined)}
            options={withNone}
            placeholder="Select consignee"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Billing Client</Label>
          <SearchableSelect
            value={billingPartyClientId ? String(billingPartyClientId) : ''}
            onValueChange={v => onBillingPartyChange(v ? Number(v) : undefined)}
            options={withNone}
            placeholder="Defaults to placing client"
          />
        </div>
      </div>
    </div>
  )
}
