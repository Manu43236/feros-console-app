import { createContext, useContext } from 'react'

interface SubscriptionContextValue {
  locked: boolean
  isEquipmentMode: boolean
}

export const SubscriptionContext = createContext<SubscriptionContextValue>({ locked: false, isEquipmentMode: false })

export function useSubscription() {
  return useContext(SubscriptionContext)
}
