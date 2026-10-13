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

type DaySummary = {
  date: string
  total: number
  count: number
  soldQty: number
  giftQty: number
}

type SaleRow = {
  sale_date: string
  amount: number
  qty_tamriya: number
  qty_fudge: number
  qty_sultana: number
  qty_snickers_fool: number
  qty_snickers_bunduq: number
  total_qty: number
  notes: string
}

export default function BazaarPage() {
  const router = useRouter()
  const [today, setToday] = useState(BAZAAR_DATES[0])
  const [todayTotal, setTodayTotal] = useState(0)
  const [todayCount, setTodayCount] = useState(0)
  const [todaySold, setTodaySold] = useState(0)
  const [todayGifts, setTodayGifts] = useState(0)
  const [grandTotal, setGrandTotal] = useState(0)
  const [grandCount, setGrandCount] = useState(0)
  const [grandSold, setGrandSold] = useState(0)
  const [grandGifts, setGrandGifts] = useState(0)
  const [daySummaries, setDaySummaries] = useState<DaySummary[]>([])
  const [lastSale, setLastSale] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastSaleId, setLastSaleId] = useState<number | null>(null)

  useEffect(() => {
    const auth = sessionStorage.getItem('jumar_admin')
    if (auth !== 'true') { router.push('/admin/login'); return }
    const now = new Date().toISOString().split('T')[0]
    const nearest = BAZAAR_DATES.find(d => d >= now) || BAZAAR_DATES[2]
    setToday(nearest)
    loadSummary(nearest)
  }, [])

  async function loadSummary(activeDay?: string) {
    const { data } = await supabase
      .from('sales')
      .select('sale_date, amount, total_qty, notes')
      .eq('channel', 'بازار')
      .in('sale_date', BAZAAR_DATES)

    if (!data) return

    // parse qty and gift from notes field: "qty:8|gift:2|..."
    function parseQty(notes: string) {
      const qtyMatch = notes.match(/qty:(\d+)/)
      const giftMatch = notes.match(/gift:(\d+)/)
      return {
        sold: qtyMatch ? parseInt(qtyMatch[1]) : 0,
        gift: giftMatch ? parseInt(giftMatch[1]) : 0,
      }
    }

    const summaries = BAZAAR_DATES.map(date => {
      const rows = data.filter(r => r.sale_date === date)
      let soldQty = 0, giftQty = 0
      rows.forEach(r => {
        const p = parseQty(r.notes || '')
        soldQty += p.sold
        giftQty += p.gift
      })
      return {
        date,
        total: rows.reduce((s, r) => s + Number(r.amount), 0),
        count: rows.length,
        soldQty,
        giftQty,
      }
    })
    setDaySummaries(summaries)

    const cur = activeDay || today
    const todayData = summaries.find(s => s.date === cur)
    setTodayTotal(todayData?.total || 0)
    setTodayCount(todayData?.count || 0)
    setTodaySold(todayData?.soldQty || 0)
    setTodayGifts(todayData?.giftQty || 0)

    setGrandTotal(summaries.reduce((s, r) => s + r.total, 0))
    setGrandCount(summaries.reduce((s, r) => s + r.count, 0))
    setGrandSold(summaries.reduce((s, r) => s + r.soldQty, 0))
    setGrandGifts(summaries.reduce((s, r) => s + r.giftQty, 0))
  }

  function switchDay(date: string) {
    setToday(date)
    const s = daySummaries.find(d => d.date === date)
    if (s) {
      setTodayTotal(s.total)
      setTodayCount(s.count)
      setTodaySold(s.soldQty)
      setTodayGifts(s.giftQty)
    }
  }

  async function recordSale(item: typeof BAZAAR_ITEMS[0]) {
    setLoading(true)
    const desc = item.gift > 0 ? `${item.label} +${item.gift} هدية` : item.label
    const { data } = await supabase.from('sales').insert({
      sale_date: today,
      channel: 'بازار',
      items_desc: desc,
      total_qty: item.qty + item.gift,
      amount: item.price,
      customer_type: 'غريب',
      notes: `qty:${item.qty}|gift:${item.gift}|بازار لوتس أكتوبر 2026`,
    }).select('id').single()
    if (data?.id) setLastSaleId(data.id)
    setLastSale(`${item.label} — ${item.price}ج ✅`)
    await loadSummary()
    setLoading(false)
    setTimeout(() => { setLastSale(null); setLastSaleId(null) }, 8000)
  }

  const dayLabel = (date: string) => ({
    '2026-10-22': 'يوم ١',
    '2026-10-23': 'يوم ٢',
    '2026-10-24': 'يوم ٣',
  }[date] || date)

  return (
    <div className="min-h-screen bg-jumar-cream" dir="rtl">
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
            <button key={date} onClick={() => switchDay(date)}
              className={`py-2 rounded-xl text-sm font-bold transition-all ${
                today === date ? 'bg-jumar-brown text-white' : 'bg-white text-gray-600 border border-gray-200'
              }`}>
              {dayLabel(date)}
            </button>
          ))}
        </div>

        {/* Today stats */}
        <div className="bg-jumar-brown text-white rounded-2xl p-4">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-xs text-white/60 mb-1">{dayLabel(today)} — إيرادات</p>
              <p className="text-3xl font-bold text-jumar-gold">{todayTotal.toLocaleString('ar-EG')} ج</p>
            </div>
            <div className="text-left">
              <p className="text-xs text-white/60 mb-1">إجمالي البازار</p>
              <p className="text-xl font-bold">{grandTotal.toLocaleString('ar-EG')} ج</p>
            </div>
          </div>
          <div className="flex gap-4 border-t border-white/20 pt-3">
            <div className="text-center flex-1">
              <p className="text-2xl font-bold text-jumar-gold">{todaySold}</p>
              <p className="text-xs text-white/60">مباع اليوم</p>
            </div>
            <div className="text-center flex-1">
              <p className="text-2xl font-bold text-white/80">{todayGifts}</p>
              <p className="text-xs text-white/60">هدايا اليوم</p>
            </div>
            <div className="text-center flex-1">
              <p className="text-2xl font-bold text-jumar-gold">{grandSold}</p>
              <p className="text-xs text-white/60">إجمالي مباع</p>
            </div>
            <div className="text-center flex-1">
              <p className="text-2xl font-bold text-white/80">{grandGifts}</p>
              <p className="text-xs text-white/60">إجمالي هدايا</p>
            </div>
          </div>
        </div>

        {/* Last sale feedback + undo */}
        {lastSale && (
          <div className="bg-green-100 text-green-700 rounded-xl p-3 flex items-center justify-between gap-2">
            <span className="font-bold text-sm">{lastSale}</span>
            {lastSaleId && (
              <button
                onClick={async () => {
                  await supabase.from('sales').delete().eq('id', lastSaleId)
                  setLastSale(null)
                  setLastSaleId(null)
                  await loadSummary()
                }}
                className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-lg hover:bg-red-600 active:scale-95 transition-all whitespace-nowrap"
              >
                ↩ تراجع
              </button>
            )}
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
                {item.gift > 0 && <p className="text-xs text-jumar-gold">+{item.gift} هدية</p>}
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
              <div key={s.date} className="p-3">
                <div className="flex justify-between items-center mb-1">
                  <p className="font-semibold text-gray-700">{dayLabel(s.date)}</p>
                  <p className={`font-bold text-lg ${s.total > 0 ? 'text-green-600' : 'text-gray-300'}`}>
                    {s.total > 0 ? `${s.total.toLocaleString('ar-EG')} ج` : '—'}
                  </p>
                </div>
                {s.total > 0 && (
                  <div className="flex gap-3 text-xs text-gray-500">
                    <span>مباع: <span className="font-bold text-jumar-brown">{s.soldQty}</span></span>
                    <span>هدايا: <span className="font-bold text-gray-400">{s.giftQty}</span></span>
                    <span>بيعات: <span className="font-bold">{s.count}</span></span>
                  </div>
                )}
              </div>
            ))}
            <div className="p-3 bg-jumar-cream">
              <div className="flex justify-between items-center mb-1">
                <p className="font-bold text-jumar-brown">الإجمالي</p>
                <p className="font-bold text-xl text-jumar-brown">{grandTotal.toLocaleString('ar-EG')} ج</p>
              </div>
              <div className="flex gap-3 text-xs text-gray-500">
                <span>مباع: <span className="font-bold text-jumar-brown">{grandSold}</span></span>
                <span>هدايا: <span className="font-bold">{grandGifts}</span></span>
              </div>
            </div>
          </div>
        </div>

        {/* Break-even */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center">
          <p className="text-sm text-amber-800 font-semibold">🎯 الهدف: 198 قطعة مباعة (66/يوم) للـ break-even</p>
          <p className="text-xs text-amber-600 mt-1">وصلت: {grandSold} من 198 ({Math.round(grandSold/198*100)}%)</p>
        </div>

      </div>
    </div>
  )
}
