import { useState, useEffect, useRef } from 'react'
import ferosLogo from '@/assets/feros_transperant_logo.png'
import { Truck, ClipboardList, FileText, Receipt, Users, BarChart3 } from 'lucide-react'

const SLIDES = [
  {
    icon: Truck,
    title: 'Fleet Management',
    desc: 'Track 150+ vehicles in real time. Monitor status, documents, and maintenance schedules.',
  },
  {
    icon: ClipboardList,
    title: 'Order Management',
    desc: 'From client call to vehicle dispatch — manage every order with full visibility.',
  },
  {
    icon: FileText,
    title: 'LR Management',
    desc: 'Generate and track Lorry Receipts digitally. No more paper-based chaos.',
  },
  {
    icon: Receipt,
    title: 'Smart Invoicing',
    desc: 'Auto-calculate freight, generate invoices, and track payments effortlessly.',
  },
  {
    icon: Users,
    title: 'Staff & Payroll',
    desc: 'Manage drivers, attendance, advances, and salary — all in one place.',
  },
  {
    icon: BarChart3,
    title: 'Real-time Dashboard',
    desc: 'Live insights on fleet performance, revenue, and operations at a glance.',
  },
]

function FeatureCarousel() {
  const [current, setCurrent] = useState(0)
  const [visible, setVisible] = useState(true)
  const paused = useRef(false)

  useEffect(() => {
    const interval = setInterval(() => {
      if (!paused.current) advance()
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  function advance(idx?: number) {
    setVisible(false)
    setTimeout(() => {
      setCurrent(idx !== undefined ? idx : prev => (prev + 1) % SLIDES.length)
      setVisible(true)
    }, 250)
  }

  function goTo(idx: number) {
    if (idx === current) return
    advance(idx)
  }

  const slide = SLIDES[current]
  const Icon  = slide.icon

  return (
    <div
      className="flex flex-col items-center text-center"
      onMouseEnter={() => { paused.current = true }}
      onMouseLeave={() => { paused.current = false }}
    >
      {/* Slide content */}
      <div
        className="transition-all duration-300"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(12px)' }}
      >
        {/* Icon circle */}
        <div className="w-20 h-20 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-6">
          <Icon size={36} className="text-white" strokeWidth={1.5} />
        </div>

        <h2 className="text-white text-2xl font-bold mb-3 leading-tight">
          {slide.title}
        </h2>
        <p className="text-blue-200 text-base leading-relaxed max-w-xs mx-auto">
          {slide.desc}
        </p>
      </div>

      {/* Dot indicators */}
      <div className="flex gap-2 mt-10">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className="transition-all duration-300 rounded-full"
            style={{
              width:           i === current ? '24px' : '8px',
              height:          '8px',
              backgroundColor: i === current ? 'white' : 'rgba(255,255,255,0.3)',
            }}
          />
        ))}
      </div>
    </div>
  )
}

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(to right, #000000, #1E293B)' }}>
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[52%] flex-col bg-transparent">
        {/* Logo + Carousel grouped and centered together */}
        <div className="flex-1 flex items-center justify-center px-12">
          <div className="flex flex-col items-center gap-10 w-full">
            <img src={ferosLogo} alt="FEROS" className="w-64 object-contain" />
            <FeatureCarousel />
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-blue-400/60 text-xs pb-8">
          © {new Date().getFullYear()} FEROS. All rights reserved.
        </p>
      </div>

      {/* Right panel — login form */}
      <div className="w-full lg:w-[48%] flex items-center justify-center bg-transparent p-8">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  )
}
