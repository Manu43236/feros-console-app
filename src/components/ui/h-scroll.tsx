import { useEffect, useRef } from 'react'

/**
 * Wraps a wide table and mirrors its horizontal scrollbar at the TOP, so a user
 * doesn't have to scroll to the bottom of a tall table to find the scrollbar.
 * The top bar only appears when the content actually overflows.
 */
export function HScroll({ children, className }: { children: React.ReactNode; className?: string }) {
  const topRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const mirrorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const top = topRef.current
    const bottom = bottomRef.current
    const mirror = mirrorRef.current
    if (!top || !bottom || !mirror) return

    const ro = new ResizeObserver(() => {
      mirror.style.width = `${bottom.scrollWidth}px`
    })
    ro.observe(bottom)
    if (bottom.firstElementChild) ro.observe(bottom.firstElementChild)

    let syncing = false
    const onTop = () => { if (!syncing) { syncing = true; bottom.scrollLeft = top.scrollLeft; syncing = false } }
    const onBottom = () => { if (!syncing) { syncing = true; top.scrollLeft = bottom.scrollLeft; syncing = false } }

    top.addEventListener('scroll', onTop)
    bottom.addEventListener('scroll', onBottom)
    return () => {
      ro.disconnect()
      top.removeEventListener('scroll', onTop)
      bottom.removeEventListener('scroll', onBottom)
    }
  }, [])

  return (
    <>
      <div ref={topRef} className="overflow-x-auto border-b bg-gray-50" style={{ height: 14 }}>
        <div ref={mirrorRef} style={{ height: 1 }} />
      </div>
      <div ref={bottomRef} className={className ?? 'overflow-auto'}>
        {children}
      </div>
    </>
  )
}
