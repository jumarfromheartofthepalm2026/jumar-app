'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ── Types ────────────────────────────────────────────────────────────────────
interface Sale { id: string; sale_date: string; channel: string; amount: number; customer_type: string; qty_tamriya?: number; qty_fudge?: number; qty_sultana?: number; qty_snickers_fool?: number; qty_snickers_bunduq?: number }
interface Expense { id: string; expense_date: string; category: string; amount: number }
interface MonthData { month: string; label: string; revenue: number; expenses: number; net: number; units: number }

// ── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n: number) => n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(Math.round(n))
const fmtEGP = (n: number) => `EGP ${n.toLocaleString('en-EG', { maximumFractionDigits: 0 })}`
const pct = (a: number, b: number) => b === 0 ? '—' : `${((a / b) * 100).toFixed(1)}%`
const monthKey = (d: string) => d.slice(0, 7)
const monthLabel = (k: string) => {
  const [y, m] = k.split('-')
  const names = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${names[parseInt(m)]} ${y.slice(2)}`
}
const now = new Date()
const thisMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`
const lastMonth = (() => { const d = new Date(now.getFullYear(), now.getMonth()-1, 1); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` })()

// SVG constants
const W = 480, H = 200
const PAD = { t: 20, r: 16, b: 40, l: 56 }
const iW = W - PAD.l - PAD.r, iH = H - PAD.t - PAD.b

function linePath(pts: {x:number;y:number}[]) {
  if (pts.length < 2) return ''
  let d = `M${pts[0].x},${pts[0].y}`
  for (let i = 1; i < pts.length; i++) {
    const cp1x = pts[i-1].x + (pts[i].x-pts[i-1].x)*0.4
    const cp2x = pts[i].x   - (pts[i].x-pts[i-1].x)*0.4
    d += ` C${cp1x},${pts[i-1].y} ${cp2x},${pts[i].y} ${pts[i].x},${pts[i].y}`
  }
  return d
}

// ── Component ────────────────────────────────────────────────────────────────
export default function BoardPage() {
  const [sales, setSales]       = useState<Sale[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading]   = useState(true)
  const [refreshed, setRefreshed] = useState('')

  async function load() {
    setLoading(true)
    const [s, e] = await Promise.all([
      supabase.from('sales').select('*').order('sale_date'),
      supabase.from('expenses').select('*').order('expense_date'),
    ])
    setSales(s.data || [])
    setExpenses(e.data || [])
    setLoading(false)
    setRefreshed(new Date().toLocaleTimeString('en-EG', { hour: '2-digit', minute: '2-digit' }))
  }

  useEffect(() => { load() }, [])

  // ── Derived metrics ──────────────────────────────────────────────────────
  const totalRevenue  = sales.reduce((s,r) => s + r.amount, 0)
  const totalExpenses = expenses.reduce((s,r) => s + r.amount, 0)
  const netPosition   = totalRevenue - totalExpenses

  // This month vs last month
  const mRev  = (k: string) => sales.filter(r => monthKey(r.sale_date) === k).reduce((s,r) => s+r.amount, 0)
  const mExp  = (k: string) => expenses.filter(r => monthKey(r.expense_date) === k).reduce((s,r) => s+r.amount, 0)
  const thisRevenue  = mRev(thisMonth)
  const lastRevenue  = mRev(lastMonth)
  const thisExpenses = mExp(thisMonth)
  const lastExpenses = mExp(lastMonth)
  const revenueGrowth = lastRevenue > 0 ? ((thisRevenue - lastRevenue) / lastRevenue) * 100 : 0

  // Units sold this month
  const thisUnits = sales
    .filter(r => monthKey(r.sale_date) === thisMonth)
    .reduce((s,r) => s + (r.qty_tamriya||0) + (r.qty_fudge||0) + (r.qty_sultana||0) + (r.qty_snickers_fool||0) + (r.qty_snickers_bunduq||0), 0)

  // AOV this month
  const thisSalesCount = sales.filter(r => monthKey(r.sale_date) === thisMonth).length
  const aov = thisSalesCount > 0 ? thisRevenue / thisSalesCount : 0

  // Channel mix (all time)
  const channelMap: Record<string, number> = {}
  sales.forEach(r => { channelMap[r.channel || 'Other'] = (channelMap[r.channel || 'Other'] || 0) + r.amount })
  const channelEntries = Object.entries(channelMap).sort((a,b) => b[1]-a[1])
  const channelColors: Record<string, string> = {
    'بازار': '#7C4A00', 'مباشر': '#C4922A', 'إنستجرام': '#E8B84B', 'أونلاين': '#4CAF7D',
  }

  // Customer type mix
  const ctMap: Record<string, number> = {}
  sales.forEach(r => { const ct = r.customer_type || 'غير محدد'; ctMap[ct] = (ctMap[ct]||0) + r.amount })

  // Expense breakdown (all time)
  const expMap: Record<string, number> = {}
  expenses.forEach(r => { expMap[r.category] = (expMap[r.category]||0) + r.amount })
  const expEntries = Object.entries(expMap).sort((a,b) => b[1]-a[1])
  const expColors = ['#7C4A00','#C4922A','#E8B84B','#4CAF7D','#2196F3','#9C27B0','#FF5722','#607D8B','#FF9800','#795548']

  // Monthly trend (last 6 months)
  const allMonthsSet: Record<string,1> = {}
  sales.forEach(r => { allMonthsSet[monthKey(r.sale_date)] = 1 })
  expenses.forEach(r => { allMonthsSet[monthKey(r.expense_date)] = 1 })
  const allMonths = Object.keys(allMonthsSet).sort().slice(-6)

  const monthly: MonthData[] = allMonths.map(k => {
    const rev  = mRev(k)
    const exp  = mExp(k)
    const units = sales.filter(r => monthKey(r.sale_date) === k)
      .reduce((s,r) => s+(r.qty_tamriya||0)+(r.qty_fudge||0)+(r.qty_sultana||0)+(r.qty_snickers_fool||0)+(r.qty_snickers_bunduq||0), 0)
    return { month: k, label: monthLabel(k), revenue: rev, expenses: exp, net: rev - exp, units }
  })

  // Product mix (units, all time)
  const productUnits = {
    'Tahini Date Ball':  sales.reduce((s,r) => s+(r.qty_tamriya||0), 0),
    'Cashew Fudge':      sales.reduce((s,r) => s+(r.qty_fudge||0), 0),
    'Pistachio Queen':   sales.reduce((s,r) => s+(r.qty_sultana||0), 0),
    'Peanut Snickers':   sales.reduce((s,r) => s+(r.qty_snickers_fool||0), 0),
    'Hazelnut Snickers': sales.reduce((s,r) => s+(r.qty_snickers_bunduq||0), 0),
  }
  const totalUnits = Object.values(productUnits).reduce((s,v) => s+v, 0)

  // ── Forward-Looking Metrics ─────────────────────────────────────────────
  // Average monthly burn (last 3 months of expense data)
  const last3Months = allMonths.slice(-3)
  const avgMonthlyBurn = last3Months.length > 0
    ? last3Months.reduce((s, k) => s + mExp(k), 0) / last3Months.length
    : thisExpenses || 1

  // Avg monthly revenue (last 3 months)
  const avgMonthlyRevenue = last3Months.length > 0
    ? last3Months.reduce((s, k) => s + mRev(k), 0) / last3Months.length
    : thisRevenue

  // Cash runway: how many months can we sustain at current burn assuming net inflows
  // Net cash burn = avg expenses - avg revenue (if negative = cash positive, if positive = burning cash)
  const netMonthlyCashBurn = avgMonthlyBurn - avgMonthlyRevenue
  const runwayMonths = netMonthlyCashBurn > 0
    ? Math.max(0, Math.abs(netPosition) / netMonthlyCashBurn)
    : null // cash positive, infinite runway

  // Break-even: at current growth rate, when will monthly revenue = monthly expenses?
  // Monthly revenue growth rate (last 2 months)
  const revenueGrowthRate = lastRevenue > 0 ? (thisRevenue - lastRevenue) / lastRevenue : 0
  const breakEvenMonths = (() => {
    if (thisRevenue >= thisExpenses) return 0 // already at or above break-even this month
    if (revenueGrowthRate <= 0) return null   // not growing, can't project
    let rev = thisRevenue
    let months = 0
    while (rev < avgMonthlyBurn && months < 24) {
      rev = rev * (1 + revenueGrowthRate)
      months++
    }
    return months
  })()

  // Channel unit economics: AOV per channel
  const channelEcon: Record<string, { revenue: number; txns: number; units: number }> = {}
  sales.forEach(r => {
    const ch = r.channel || 'Other'
    if (!channelEcon[ch]) channelEcon[ch] = { revenue: 0, txns: 0, units: 0 }
    channelEcon[ch].revenue += r.amount
    channelEcon[ch].txns += 1
    channelEcon[ch].units += (r.qty_tamriya||0)+(r.qty_fudge||0)+(r.qty_sultana||0)+(r.qty_snickers_fool||0)+(r.qty_snickers_bunduq||0)
  })
  const channelEconEntries = Object.entries(channelEcon)
    .map(([ch, d]) => ({ ch, aov: d.txns > 0 ? d.revenue / d.txns : 0, upv: d.txns > 0 ? d.units / d.txns : 0, revenue: d.revenue, txns: d.txns }))
    .sort((a, b) => b.aov - a.aov)

  // Inventory turnover proxy: total units sold / months active
  const monthsActive = allMonths.length || 1
  const avgUnitsPerMonth = totalUnits / monthsActive

  // MoM expense change
  const expenseChange = lastExpenses > 0 ? ((thisExpenses - lastExpenses) / lastExpenses) * 100 : 0

  // ── Q4 Projections ──────────────────────────────────────────────────────────
  // Use MoM growth rate from last 3 months for smoother projection
  const growthRates: number[] = []
  for (let i = 1; i < last3Months.length; i++) {
    const prev = mRev(last3Months[i-1])
    const curr = mRev(last3Months[i])
    if (prev > 0) growthRates.push((curr - prev) / prev)
  }
  if (lastRevenue > 0 && thisRevenue > 0) growthRates.push((thisRevenue - lastRevenue) / lastRevenue)
  const smoothGrowthRate = growthRates.length > 0
    ? growthRates.reduce((s,r) => s+r, 0) / growthRates.length
    : 0.1 // assume 10% if no data

  // Project next 3 months from thisRevenue
  const projMonths = [1, 2, 3].map(offset => {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    const projRev = thisRevenue * Math.pow(1 + smoothGrowthRate, offset)
    const projExp = avgMonthlyBurn // assume expenses stay flat
    return { key, label: monthLabel(key), projRev, projExp, projNet: projRev - projExp }
  })

  // Cumulative cash position projection
  let cumulativeCash = netPosition
  const cashProjection = projMonths.map(m => {
    cumulativeCash += m.projNet
    return { ...m, cumCash: cumulativeCash }
  })

  // Revenue chart
  const maxRev = Math.max(...monthly.map(m => m.revenue), 1)
  const revPts = monthly.map((m,i) => ({
    x: PAD.l + (i/(monthly.length-1 || 1))*iW,
    y: PAD.t + iH - (m.revenue/maxRev)*iH,
  }))
  const netPts = monthly.map((m,i) => ({
    x: PAD.l + (i/(monthly.length-1 || 1))*iW,
    y: PAD.t + iH - (Math.max(m.net,0)/maxRev)*iH,
  }))

  // Donut helper
  function donutArcs(entries: [string,number][], colors: string[], R=60, cx=80, cy=80, thick=24) {
    const total = entries.reduce((s,[,v])=>s+v,0)
    let angle = -Math.PI/2
    return entries.map(([cat, v], i) => {
      const sweep = total > 0 ? (v/total)*2*Math.PI : 0
      const x1=cx+R*Math.cos(angle),y1=cy+R*Math.sin(angle)
      const x2=cx+R*Math.cos(angle+sweep),y2=cy+R*Math.sin(angle+sweep)
      const large=sweep>Math.PI?1:0
      const ir=R-thick
      const ix1=cx+ir*Math.cos(angle+sweep),iy1=cy+ir*Math.sin(angle+sweep)
      const ix2=cx+ir*Math.cos(angle),iy2=cy+ir*Math.sin(angle)
      const path=`M${x1},${y1} A${R},${R} 0 ${large},1 ${x2},${y2} L${ix1},${iy1} A${ir},${ir} 0 ${large},0 ${ix2},${iy2} Z`
      angle+=sweep
      return { path, color: colors[i % colors.length], cat, v, pct: total>0?(v/total*100).toFixed(0):'0' }
    })
  }

  const expArcs = donutArcs(expEntries, expColors)
  const chArcs  = donutArcs(channelEntries, ['#7C4A00','#C4922A','#E8B84B','#4CAF7D'])

  if (loading) return (
    <div className="min-h-screen bg-[#FAFAF7] flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-3">🌿</div>
        <p className="text-[#7C4A00] font-semibold">Loading Board Dashboard…</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#FAFAF7]" style={{ fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* ── Header ── */}
      <header className="bg-[#3B2000] text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🌿</span>
          <div>
            <h1 className="text-lg font-bold tracking-wide">JUMAR</h1>
            <p className="text-xs text-[#C4922A] font-medium tracking-widest uppercase">Board Dashboard</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-white/60">Last updated</p>
          <p className="text-sm font-semibold">{refreshed}</p>
          <button onClick={load} className="mt-1 text-xs text-[#C4922A] hover:text-[#E8B84B] transition-colors">↻ Refresh</button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">

        {/* ── Section label ── */}
        <SectionLabel>Key Performance Indicators</SectionLabel>

        {/* ── KPI Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPICard
            label="Total Revenue"
            value={fmtEGP(totalRevenue)}
            sub={`This month: ${fmtEGP(thisRevenue)}`}
            trend={revenueGrowth}
            icon="💰"
            accent="#7C4A00"
          />
          <KPICard
            label="Net Position"
            value={fmtEGP(netPosition)}
            sub={`Margin: ${pct(netPosition, totalRevenue)}`}
            icon={netPosition >= 0 ? '📈' : '📉'}
            accent={netPosition >= 0 ? '#4CAF7D' : '#E53935'}
            valueColor={netPosition >= 0 ? '#2E7D32' : '#C62828'}
          />
          <KPICard
            label="Units Sold (MTD)"
            value={fmt(thisUnits)}
            sub={`AOV: ${fmtEGP(aov)}`}
            icon="📦"
            accent="#C4922A"
          />
          <KPICard
            label="Total Expenses"
            value={fmtEGP(totalExpenses)}
            sub={`MoM: ${expenseChange >= 0 ? '+' : ''}${expenseChange.toFixed(1)}%`}
            trend={-expenseChange}
            icon="🧾"
            accent="#607D8B"
          />
        </div>

        {/* ── Forward-Looking: Runway + Break-even ── */}
        <SectionLabel>Financial Outlook</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Cash Runway */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#E8D8C4] p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🏦</span>
              <h3 className="font-semibold text-[#3B2000] text-sm uppercase tracking-wide">Cash Runway</h3>
            </div>
            {runwayMonths === null ? (
              <>
                <p className="text-3xl font-black text-green-700">∞</p>
                <p className="text-xs text-gray-500">Revenue exceeds expenses — self-sustaining</p>
              </>
            ) : (
              <>
                <p className="text-3xl font-black" style={{ color: runwayMonths < 3 ? '#C62828' : runwayMonths < 6 ? '#E65100' : '#2E7D32' }}>
                  {runwayMonths < 1 ? '&lt;1' : runwayMonths.toFixed(1)} mo
                </p>
                <div className="w-full bg-[#F0E8DC] rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (runwayMonths / 12) * 100)}%`,
                      background: runwayMonths < 3 ? '#C62828' : runwayMonths < 6 ? '#E65100' : '#4CAF7D'
                    }}
                  />
                </div>
                <p className="text-xs text-gray-500">Based on avg monthly burn of {fmtEGP(avgMonthlyBurn)} vs avg revenue {fmtEGP(avgMonthlyRevenue)}</p>
              </>
            )}
          </div>

          {/* Break-even */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#E8D8C4] p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🎯</span>
              <h3 className="font-semibold text-[#3B2000] text-sm uppercase tracking-wide">Break-even</h3>
            </div>
            {breakEvenMonths === 0 ? (
              <>
                <p className="text-3xl font-black text-green-700">Now ✓</p>
                <p className="text-xs text-gray-500">This month&apos;s revenue covers operating expenses</p>
              </>
            ) : breakEvenMonths === null ? (
              <>
                <p className="text-3xl font-black text-gray-400">—</p>
                <p className="text-xs text-gray-500">Insufficient growth data to project</p>
              </>
            ) : (
              <>
                <p className="text-3xl font-black text-[#7C4A00]">~{breakEvenMonths} mo</p>
                <p className="text-xs text-gray-500">
                  At {(revenueGrowthRate * 100).toFixed(1)}% MoM growth, monthly revenue will cover avg expenses of {fmtEGP(avgMonthlyBurn)}
                </p>
              </>
            )}
          </div>

          {/* Avg Velocity */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#E8D8C4] p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚡</span>
              <h3 className="font-semibold text-[#3B2000] text-sm uppercase tracking-wide">Sales Velocity</h3>
            </div>
            <p className="text-3xl font-black text-[#C4922A]">{Math.round(avgUnitsPerMonth)}</p>
            <p className="text-xs text-gray-500">Avg units/month over {monthsActive} month{monthsActive !== 1 ? 's' : ''}</p>
            <div className="pt-1 border-t border-[#F0E8DC]">
              <p className="text-xs text-gray-400">Avg revenue/month</p>
              <p className="text-sm font-bold text-[#7C4A00]">{fmtEGP(avgMonthlyRevenue)}</p>
            </div>
          </div>
        </div>

        {/* ── Q4 Outlook ── */}
        <SectionLabel>Q4 Outlook &amp; Action Plan</SectionLabel>

        {/* Projection note */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 text-xs text-amber-700 flex items-center gap-2">
          <span>📊</span>
          <span>Projections based on {(smoothGrowthRate * 100).toFixed(1)}% avg MoM revenue growth · Expenses held flat at {fmtEGP(avgMonthlyBurn)}/mo · Not a guarantee</span>
        </div>

        {/* 3-month revenue + cash forecast */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {cashProjection.map((m, i) => (
            <div key={m.key} className="bg-white rounded-2xl shadow-sm border border-[#E8D8C4] p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-[#9E7340] tracking-widest uppercase">{m.label}</span>
                <span className="text-xs bg-[#F5EFE6] text-[#7C4A00] px-2 py-0.5 rounded-full font-semibold">Projected</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Revenue</span>
                  <span className="font-bold text-[#7C4A00]">{fmtEGP(m.projRev)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Expenses</span>
                  <span className="text-gray-600">{fmtEGP(m.projExp)}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-[#F0E8DC] pt-2">
                  <span className="text-gray-500">Monthly Net</span>
                  <span className={`font-bold ${m.projNet >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtEGP(m.projNet)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Cum. Cash</span>
                  <span className={`font-semibold text-xs ${m.cumCash >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmtEGP(m.cumCash)}</span>
                </div>
              </div>
              {/* Progress bar toward break-even */}
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>Rev vs Expenses</span>
                  <span>{Math.min(100, (m.projRev / m.projExp * 100)).toFixed(0)}%</span>
                </div>
                <div className="w-full bg-[#F0E8DC] rounded-full h-1.5">
                  <div
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, (m.projRev / m.projExp) * 100)}%`,
                      background: m.projRev >= m.projExp ? '#4CAF7D' : i === 0 ? '#E65100' : '#C4922A'
                    }}
                  />
                </div>
                {m.projRev >= m.projExp && (
                  <p className="text-xs text-green-600 font-semibold mt-1">✓ Break-even reached</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Action Plan + Risks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Action Plan */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#E8D8C4] p-5">
            <h3 className="font-semibold text-[#3B2000] mb-4 text-sm uppercase tracking-wide flex items-center gap-2">
              <span>🎯</span> Q4 Action Plan
            </h3>
            <div className="space-y-3">
              {[
                { icon: '🏪', title: 'Expand Bazaar Presence', desc: 'Target 2+ new bazaar locations (Wadi Degla, Madinaty) to replicate Lotus Bazaar success', status: 'priority' },
                { icon: '📱', title: 'Activate Online Channel', desc: 'Launch structured Instagram/online ordering to convert existing followers into recurring buyers', status: 'priority' },
                { icon: '🍫', title: 'New SKU Launch', desc: 'Introduce 1–2 new products based on top performers: Cashew Fudge & Pistachio Date variants', status: 'planned' },
                { icon: '📦', title: 'Inventory Optimization', desc: 'Replenish critical stock (Hazelnuts, Coconut, Butter) to avoid lost sales during peak season', status: 'urgent' },
              ].map((item, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <span className="text-lg flex-shrink-0 mt-0.5">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[#3B2000]">{item.title}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                        item.status === 'urgent' ? 'bg-red-100 text-red-700' :
                        item.status === 'priority' ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>{item.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Risks */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#E8D8C4] p-5">
            <h3 className="font-semibold text-[#3B2000] mb-4 text-sm uppercase tracking-wide flex items-center gap-2">
              <span>⚠️</span> Key Risks &amp; Mitigation
            </h3>
            <div className="space-y-4">
              {[
                {
                  risk: 'Raw Material Price Volatility',
                  impact: 'High',
                  detail: 'Dates & nuts prices can spike seasonally — directly compresses margins.',
                  mitigation: 'Lock in bulk purchases before Q4 peak; review pricing quarterly.',
                  color: '#E53935'
                },
                {
                  risk: 'Cash Runway Pressure',
                  impact: 'High',
                  detail: `Current runway ~${runwayMonths !== null ? runwayMonths.toFixed(1) + ' mo' : '∞'} — tight if revenue growth slows.`,
                  mitigation: 'Prioritize high-AOV channels (bazaars); defer non-essential CAPEX.',
                  color: '#E65100'
                },
                {
                  risk: 'Production Capacity',
                  impact: 'Medium',
                  detail: 'Manual production may bottleneck if bazaar orders scale rapidly.',
                  mitigation: 'Map max weekly output now; identify 1 part-time production hire threshold.',
                  color: '#C4922A'
                },
              ].map((r, i) => (
                <div key={i} className="border-l-4 pl-3 py-1" style={{ borderColor: r.color }}>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-[#3B2000]">{r.risk}</p>
                    <span className="text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: r.color + '22', color: r.color }}>{r.impact}</span>
                  </div>
                  <p className="text-xs text-gray-500">{r.detail}</p>
                  <p className="text-xs text-green-700 font-medium mt-1">→ {r.mitigation}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Revenue Trend Chart ── */}
        <SectionLabel>Revenue &amp; Profitability Trend</SectionLabel>
        <div className="bg-white rounded-2xl shadow-sm border border-[#E8D8C4] p-5">
          {monthly.length < 2 ? (
            <p className="text-center text-gray-400 py-8">Not enough data yet</p>
          ) : (
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
              <defs>
                <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#7C4A00" stopOpacity="0.18"/>
                  <stop offset="100%" stopColor="#7C4A00" stopOpacity="0"/>
                </linearGradient>
                <linearGradient id="netFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4CAF7D" stopOpacity="0.15"/>
                  <stop offset="100%" stopColor="#4CAF7D" stopOpacity="0"/>
                </linearGradient>
              </defs>

              {/* Grid lines */}
              {[0,0.25,0.5,0.75,1].map(f => {
                const y = PAD.t + f*iH
                const val = maxRev*(1-f)
                return (
                  <g key={f}>
                    <line x1={PAD.l} y1={y} x2={W-PAD.r} y2={y} stroke="#F0E8DC" strokeWidth="1"/>
                    <text x={PAD.l-6} y={y+4} textAnchor="end" fontSize="9" fill="#9E9E9E">{fmt(val)}</text>
                  </g>
                )
              })}

              {/* Revenue fill */}
              {revPts.length > 1 && (
                <path
                  d={`${linePath(revPts)} L${revPts[revPts.length-1].x},${PAD.t+iH} L${revPts[0].x},${PAD.t+iH} Z`}
                  fill="url(#revFill)"
                />
              )}
              {/* Net fill */}
              {netPts.length > 1 && (
                <path
                  d={`${linePath(netPts)} L${netPts[netPts.length-1].x},${PAD.t+iH} L${netPts[0].x},${PAD.t+iH} Z`}
                  fill="url(#netFill)"
                />
              )}

              {/* Lines */}
              <path d={linePath(revPts)} fill="none" stroke="#7C4A00" strokeWidth="2.5" strokeLinejoin="round"/>
              <path d={linePath(netPts)} fill="none" stroke="#4CAF7D" strokeWidth="2" strokeDasharray="5,3" strokeLinejoin="round"/>

              {/* Dots & labels */}
              {revPts.map((pt,i) => (
                <g key={i}>
                  <circle cx={pt.x} cy={pt.y} r="4" fill="white" stroke="#7C4A00" strokeWidth="2"/>
                  <text x={pt.x} y={pt.y-8} textAnchor="middle" fontSize="8.5" fill="#7C4A00" fontWeight="600">{fmt(monthly[i].revenue)}</text>
                </g>
              ))}

              {/* X labels */}
              {monthly.map((m,i) => {
                const x = PAD.l + (i/(monthly.length-1||1))*iW
                return <text key={i} x={x} y={H-PAD.b+14} textAnchor="middle" fontSize="9" fill="#9E9E9E">{m.label}</text>
              })}

              {/* Legend */}
              <circle cx={PAD.l} cy={12} r={4} fill="#7C4A00"/>
              <text x={PAD.l+8} y={16} fontSize="9" fill="#555">Revenue</text>
              <line x1={PAD.l+70} y1={12} x2={PAD.l+82} y2={12} stroke="#4CAF7D" strokeWidth="2" strokeDasharray="4,2"/>
              <text x={PAD.l+86} y={16} fontSize="9" fill="#555">Net</text>
            </svg>
          )}
        </div>

        {/* ── Monthly Table ── */}
        <SectionLabel>Monthly Breakdown</SectionLabel>
        <div className="bg-white rounded-2xl shadow-sm border border-[#E8D8C4] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F5EFE6] text-[#5C3D11]">
                <th className="px-4 py-3 text-left font-semibold">Month</th>
                <th className="px-4 py-3 text-right font-semibold">Revenue</th>
                <th className="px-4 py-3 text-right font-semibold">Expenses</th>
                <th className="px-4 py-3 text-right font-semibold">Net</th>
                <th className="px-4 py-3 text-right font-semibold">Margin</th>
                <th className="px-4 py-3 text-right font-semibold">Units</th>
              </tr>
            </thead>
            <tbody>
              {[...monthly].reverse().map((m, i) => (
                <tr key={m.month} className={i % 2 === 0 ? 'bg-white' : 'bg-[#FAFAF7]'}>
                  <td className="px-4 py-2.5 font-medium text-[#3B2000]">
                    {m.label}
                    {m.month === thisMonth && <span className="ml-2 text-xs bg-[#E8B84B] text-[#3B2000] px-1.5 py-0.5 rounded-full font-bold">MTD</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-[#7C4A00]">{fmtEGP(m.revenue)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{fmtEGP(m.expenses)}</td>
                  <td className={`px-4 py-2.5 text-right font-semibold ${m.net >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtEGP(m.net)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-500">{pct(m.net, m.revenue)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-500">{m.units > 0 ? m.units : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Channel Unit Economics ── */}
        <SectionLabel>Channel Unit Economics</SectionLabel>
        <div className="bg-white rounded-2xl shadow-sm border border-[#E8D8C4] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#F5EFE6] text-[#5C3D11]">
                <th className="px-4 py-3 text-left font-semibold">Channel</th>
                <th className="px-4 py-3 text-right font-semibold">Total Revenue</th>
                <th className="px-4 py-3 text-right font-semibold">Transactions</th>
                <th className="px-4 py-3 text-right font-semibold">AOV</th>
                <th className="px-4 py-3 text-right font-semibold">Avg Units/Order</th>
                <th className="px-4 py-3 text-right font-semibold">Revenue Share</th>
              </tr>
            </thead>
            <tbody>
              {channelEconEntries.map((row, i) => (
                <tr key={row.ch} className={i % 2 === 0 ? 'bg-white' : 'bg-[#FAFAF7]'}>
                  <td className="px-4 py-2.5 font-medium text-[#3B2000]">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: chArcs[i]?.color || '#ccc' }}/>
                      {row.ch}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-[#7C4A00]">{fmtEGP(row.revenue)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{row.txns}</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-[#3B2000]">{fmtEGP(row.aov)}</td>
                  <td className="px-4 py-2.5 text-right text-gray-500">{row.upv.toFixed(1)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center gap-2 justify-end">
                      <div className="w-16 bg-[#F0E8DC] rounded-full h-1.5">
                        <div className="h-1.5 rounded-full" style={{ width: `${(row.revenue/totalRevenue)*100}%`, background: chArcs[i]?.color || '#ccc' }}/>
                      </div>
                      <span className="text-xs text-gray-500 w-10 text-right">{pct(row.revenue, totalRevenue)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Donuts Row ── */}
        <SectionLabel>Mix Analysis</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* Channel Mix */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#E8D8C4] p-5">
            <h3 className="font-semibold text-[#3B2000] mb-4 text-sm uppercase tracking-wide">Revenue by Channel</h3>
            <div className="flex items-center gap-4">
              <svg viewBox="0 0 160 160" className="w-32 h-32 flex-shrink-0">
                {chArcs.map((a,i) => <path key={i} d={a.path} fill={a.color}/>)}
                <text x="80" y="76" textAnchor="middle" fontSize="11" fill="#3B2000" fontWeight="700">{channelEntries.length}</text>
                <text x="80" y="90" textAnchor="middle" fontSize="8" fill="#9E9E9E">channels</text>
              </svg>
              <div className="flex-1 space-y-2">
                {channelEntries.map(([ch, v], i) => (
                  <div key={ch} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: (chArcs[i]||{color:'#ccc'}).color }}/>
                    <span className="text-xs text-gray-600 flex-1">{ch}</span>
                    <span className="text-xs font-semibold text-[#7C4A00]">{pct(v, totalRevenue)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Expense Mix */}
          <div className="bg-white rounded-2xl shadow-sm border border-[#E8D8C4] p-5">
            <h3 className="font-semibold text-[#3B2000] mb-4 text-sm uppercase tracking-wide">Expense Breakdown</h3>
            <div className="flex items-center gap-4">
              <svg viewBox="0 0 160 160" className="w-32 h-32 flex-shrink-0">
                {expArcs.map((a,i) => <path key={i} d={a.path} fill={a.color}/>)}
                <text x="80" y="76" textAnchor="middle" fontSize="10" fill="#3B2000" fontWeight="700">{fmtEGP(totalExpenses).replace('EGP ','')}</text>
                <text x="80" y="90" textAnchor="middle" fontSize="7.5" fill="#9E9E9E">total</text>
              </svg>
              <div className="flex-1 space-y-2 max-h-36 overflow-y-auto">
                {expEntries.map(([cat, v], i) => (
                  <div key={cat} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: expColors[i % expColors.length] }}/>
                    <span className="text-xs text-gray-600 flex-1 truncate">{cat}</span>
                    <span className="text-xs font-semibold text-gray-700">{pct(v, totalExpenses)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Product Mix ── */}
        <SectionLabel>Product Mix (All Time Units)</SectionLabel>
        <div className="bg-white rounded-2xl shadow-sm border border-[#E8D8C4] p-5">
          <div className="space-y-3">
            {Object.entries(productUnits)
              .sort((a,b) => b[1]-a[1])
              .map(([name, units]) => {
                const share = totalUnits > 0 ? (units/totalUnits)*100 : 0
                return (
                  <div key={name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-[#3B2000]">{name}</span>
                      <span className="text-gray-500">{units} units · {share.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-[#F0E8DC] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${share}%`, background: 'linear-gradient(90deg, #7C4A00, #C4922A)' }}
                      />
                    </div>
                  </div>
                )
              })}
          </div>
        </div>

        {/* ── Footer ── */}
        <footer className="text-center py-4 text-xs text-gray-400">
          JUMAR Board Dashboard · Data from live database · {new Date().toLocaleDateString('en-EG', { year:'numeric', month:'long', day:'numeric' })}
        </footer>
      </main>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-[#E8D8C4]"/>
      <span className="text-xs font-bold text-[#9E7340] tracking-widest uppercase">{children}</span>
      <div className="h-px flex-1 bg-[#E8D8C4]"/>
    </div>
  )
}

function KPICard({ label, value, sub, trend, icon, accent, valueColor }: {
  label: string; value: string; sub: string; trend?: number; icon: string; accent: string; valueColor?: string
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[#E8D8C4] p-4">
      <div className="flex items-start justify-between mb-2">
        <span className="text-lg">{icon}</span>
        {trend !== undefined && (
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${trend >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
            {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-lg font-bold leading-tight" style={{ color: valueColor || accent }}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
      <p className="text-xs text-gray-500 mt-1">{sub}</p>
    </div>
  )
}
