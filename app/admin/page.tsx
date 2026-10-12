'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const BAZAAR_ITEMS = [
  { label: 'قطعة', qty: 1, gift: 0, price: 40 },
  { label: 'قطعتين', qty: 2, gift: 0, price: 70 },
  { label: 'علبة ٥', qty: 5, gift: 0, price: 170 },
  { label: 'علبة ٨', qty: 8, gift: 2, price: 260 },
  { label: 'علبة ١٥', qty: 15, gift: 3, price: 450 },
  { label: 'علبة ٢٤', qty: 24, gift: 4, price: 650 },
]

const BAZAAR_DATES = ['2026-10-22', '2026-10-23', '2026-10-24']

type DaySummary = { date: string; total: number; count: number }

export default function BazaarPage() {
  const router = useRouter()
  const [today, setToday] = useState(BAZAAR_DATES[0])
  const [todayTotal, setTodayTotal] = useState(0)
  const [todayCount, setTodayCount] = useState(0)
  const [grandTotal, setGrandTotal] = useState(0)
  const [grandCount, setGrandCount] = useState(0)
  const [daySummaries, setDaySummaries] = useState<DaySummary[]>([])
  const [lastSale, setLastSale] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const auth = sessionStorage.getItem('jumar_admin')
    if (auth !== 'true') { router.push('/admin/login'); return }
    // set today to nearest bazaar date
    const now = new Date().toISOString().split('T')[0]
    const nearest = BAZAAR_DATES.find(d => d >= now) || BAZAAR_DATES[2]
    setToday(nearest)
    loadSummary()
  }, [])

  async function loadSummary() {
    const { data } = await supabase
      .from('sales')
      .select('sale_date, amount')
      .eq('channel', 'بازار')
      .in('sale_date', BAZAAR_DATES)

    if (!data) return

    const summaries = BAZAAR_DATES.map(date => ({
      date,
      total: data.filter(r => r.sale_date === date).reduce((s, r) => s + Number(r.amount), 0),
      count: data.filter(r => r.sale_date === date).length,
    }))
    setDaySummaries(summaries)

    const now = new Date().toISOString().split('T')[0]
    const nearest = BAZAAR_DATES.find(d => d >= now) || BAZAAR_DATES[2]
    const todayData = summaries.find(s => s.date === nearest)
    setTodayTotal(todayData?.total || 0)
    setTodayCount(todayData?.count || 0)
    setGrandTotal(data.reduce((s, r) => s + Number(r.amount), 0))
    setGrandCount(data.length)
  }

  async function recordSale(item: typeof BAZAAR_ITEMS[0]) {
    setLoading(true)
    const desc = item.gift > 0 ? `علبة ${item.qty}+${item.gift} هدية` : item.label
    await supabase.from('sales').insert({
      sale_date: today,
      channel: 'بازار',
      items_desc: desc,
      total_qty: item.qty + item.gift,
      amount: item.price,
      customer_type: 'غريب',
      notes: 'بازار لوتس أكتوبر 2026',
    })
    setLastSale(`${item.label} — ${item.price}ج ✅`)
    await loadSummary()
    setLoading(false)
    // clear message after 2s
    setTimeout(() => setLastSale(null), 2000)
  }

  const dayLabel = (date: string) => {
    const map: Record<string, string> = {
      '2026-10-22': 'يوم ١',
      '2026-10-23': 'يوم ٢',
      '2026-10-24': 'يوم ٣',
    }
    return map[date] || date
  }

  return (
    <div className="min-h-screen bg-jumar-cream" dir="rtl">
      {/* Header */}
      <div className="bg-jumar-brown text-white p-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">🏪 بازار لوتس</h1>
          <p className="text-xs text-white/60">٢٢-٢٤ أكتوبر ٢٠٢٦</p>
        </div>
        <button onClick={() => router.push('/admin')} className="text-sm text-white/70 hover:text-white">← الرئيسية</button>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">

        {/* Day selector */}
        <div className="grid grid-cols-3 gap-2">
          {BAZAAR_DATES.map(date => (
            <button key={date} onClick={() => setToday(date)}
              className={`py-2 rounded-xl text-sm font-bold transition-all ${
                today === date
                  ? 'bg-jumar-brown text-white'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}>
              {dayLabel(date)}
            </button>
          ))}
        </div>

        {/* Today stats */}
        <div className="bg-jumar-brown text-white rounded-2xl p-4 flex justify-between items-center">
          <div>
            <p className="text-xs text-white/60 mb-1">{dayLabel(today)} — إيرادات</p>
            <p className="text-3xl font-bold text-jumar-gold">{todayTotal.toLocaleString('ar-EG')} ج</p>
            <p className="text-xs text-white/60 mt-1">{todayCount} بيعة</p>
          </div>
          <div className="text-left">
            <p className="text-xs text-white/60 mb-1">إجمالي البازار</p>
            <p className="text-xl font-bold">{grandTotal.toLocaleString('ar-EG')} ج</p>
            <p className="text-xs text-white/60">{grandCount} بيعة</p>
          </div>
        </div>

        {/* Last sale feedback */}
        {lastSale && (
          <div className="bg-green-100 text-green-700 rounded-xl p-3 text-center font-bold text-sm animate-pulse">
            {lastSale}
          </div>
        )}

        {/* Quick sale buttons */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h2 className="font-bold text-jumar-brown mb-3 text-center">اضغط للتسجيل الفوري</h2>
          <div className="grid grid-cols-2 gap-3">
            {BAZAAR_ITEMS.map((item, i) => (
              <button key={i} onClick={() => recordSale(item)} disabled={loading}
                className="bg-jumar-cream border-2 border-jumar-gold/30 hover:border-jumar-gold hover:bg-jumar-gold/10 active:scale-95 transition-all rounded-2xl p-4 text-center disabled:opacity-50">
                <p className="text-lg font-bold text-jumar-brown">{item.label}</p>
                {item.gift > 0 && (
                  <p className="text-xs text-jumar-gold">+{item.gift} هدية</p>
                )}
                <p className="text-2xl font-bold text-jumar-gold mt-1">{item.price}</p>
                <p className="text-xs text-gray-400">جنيه</p>
              </button>
            ))}
          </div>
        </div>

        {/* Day summaries */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-bold text-jumar-brown">📊 ملخص الأيام</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {daySummaries.map(s => (
              <div key={s.date} className="p-3 flex justify-between items-center">
                <div>
                  <p className="font-semibold text-gray-700">{dayLabel(s.date)}</p>
                  <p className="text-xs text-gray-400">{s.count} بيعة</p>
                </div>
                <p className={`font-bold text-lg ${s.total > 0 ? 'text-green-600' : 'text-gray-300'}`}>
                  {s.total > 0 ? `${s.total.toLocaleString('ar-EG')} ج` : '—'}
                </p>
              </div>
            ))}
            <div className="p-3 flex justify-between items-center bg-jumar-cream">
              <p className="font-bold text-jumar-brown">الإجمالي</p>
              <p className="font-bold text-xl text-jumar-brown">{grandTotal.toLocaleString('ar-EG')} ج</p>
            </div>
          </div>
        </div>

        {/* Break-even reminder */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center">
          <p className="text-sm text-amber-800 font-semibold">🎯 الهدف: 198 قطعة (66/يوم) للـ break-even</p>
        </div>

      </div>
    </div>
  )
}
