import { createContext, useContext } from 'react'

interface SubscriptionContextValue {
  locked: boolean
}

export const SubscriptionContext = createContext<SubscriptionContextValue>({ locked: false })

export function useSubscription() {
  return useContext(SubscriptionContext)
}
