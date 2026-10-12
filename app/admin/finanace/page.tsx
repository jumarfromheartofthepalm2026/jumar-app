'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const EXPENSE_CATEGORIES = ['خامات','معدات','تغليف','تسويق','رسوم بازار','عمالة','نثريات','بحث وتطوير','أخرى']
const CHANNELS = ['بازار','مباشر','إنستجرام','أونلاين']

type KPIs = {
  totalRevenue: number
  totalExpenses: number
  netPosition: number
  recoveryPct: number
  cashOnHand: number
}

type MonthRow = {
  month: string
  revenue: number
  expenses: number
  net: number
}

type Sale = {
  id: string
  sale_date: string
  channel: string
  items_desc: string
  amount: number
  customer_type: string
  notes: string
}

type Expense = {
  id: string
  expense_date: string
  category: string
  description: string
  amount: number
}

export default function FinancePage() {
  const router = useRouter()
  const [tab, setTab] = useState<'dashboard'|'sales'|'expenses'>('dashboard')
  const [kpis, setKpis] = useState<KPIs | null>(null)
  const [monthlyData, setMonthlyData] = useState<MonthRow[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)

  // Forms
  const [saleForm, setSaleForm] = useState({
    sale_date: new Date().toISOString().split('T')[0],
    channel: 'بازار',
    items_desc: '',
    qty_tamriya: 0,
    qty_fudge: 0,
    qty_sultana: 0,
    qty_snickers_fool: 0,
    qty_snickers_bunduq: 0,
    amount: '',
    customer_type: 'غريب',
    notes: '',
  })
  const [expenseForm, setExpenseForm] = useState({
    expense_date: new Date().toISOString().split('T')[0],
    category: 'خامات',
    description: '',
    amount: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    // Auth check
    const auth = sessionStorage.getItem('jumar_admin')
    if (auth !== 'true') { router.push('/admin/login'); return }
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: salesData }, { data: expensesData }] = await Promise.all([
      supabase.from('sales').select('*').order('sale_date', { ascending: false }),
      supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
    ])

    if (salesData) setSales(salesData)
    if (expensesData) setExpenses(expensesData)

    const totalRevenue = (salesData || []).reduce((s: number, r: Sale) => s + Number(r.amount), 0)
    const totalExpenses = (expensesData || []).reduce((s: number, r: Expense) => s + Number(r.amount), 0)
    const netPosition = totalRevenue - totalExpenses
    const recoveryPct = totalExpenses > 0 ? (totalRevenue / totalExpenses) * 100 : 0

    // Monthly aggregation
    const map: Record<string, { revenue: number; expenses: number }> = {}
    ;(salesData || []).forEach((r: Sale) => {
      const m = r.sale_date.substring(0, 7)
      if (!map[m]) map[m] = { revenue: 0, expenses: 0 }
      map[m].revenue += Number(r.amount)
    })
    ;(expensesData || []).forEach((r: Expense) => {
      const m = r.expense_date.substring(0, 7)
      if (!map[m]) map[m] = { revenue: 0, expenses: 0 }
      map[m].expenses += Number(r.amount)
    })
    const monthly = Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, ...v, net: v.revenue - v.expenses }))
    setMonthlyData(monthly)

    setKpis({
      totalRevenue,
      totalExpenses,
      netPosition,
      recoveryPct,
      cashOnHand: 690, // tracked manually for now
    })
    setLoading(false)
  }

  async function saveSale(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setMsg('')
    const total_qty = saleForm.qty_tamriya + saleForm.qty_fudge + saleForm.qty_sultana + saleForm.qty_snickers_fool + saleForm.qty_snickers_bunduq
    const { error } = await supabase.from('sales').insert({
      ...saleForm,
      total_qty,
      amount: Number(saleForm.amount),
    })
    if (error) { setMsg('❌ خطأ: ' + error.message) }
    else {
      setMsg('✅ تم تسجيل البيع')
      setSaleForm({ sale_date: new Date().toISOString().split('T')[0], channel: 'بازار', items_desc: '', qty_tamriya: 0, qty_fudge: 0, qty_sultana: 0, qty_snickers_fool: 0, qty_snickers_bunduq: 0, amount: '', customer_type: 'غريب', notes: '' })
      await loadData()
    }
    setSaving(false)
  }

  async function saveExpense(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setMsg('')
    const { error } = await supabase.from('expenses').insert({
      ...expenseForm,
      amount: Number(expenseForm.amount),
    })
    if (error) { setMsg('❌ خطأ: ' + error.message) }
    else {
      setMsg('✅ تم تسجيل المصروف')
      setExpenseForm({ expense_date: new Date().toISOString().split('T')[0], category: 'خامات', description: '', amount: '', notes: '' })
      await loadData()
    }
    setSaving(false)
  }

  const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 0 })
  const fmtMonth = (m: string) => {
    const months: Record<string, string> = { '01':'يناير','02':'فبراير','03':'مارس','04':'أبريل','05':'مايو','06':'يونيو','07':'يوليو','08':'أغسطس','09':'سبتمبر','10':'أكتوبر','11':'نوفمبر','12':'ديسمبر' }
    const [y, mo] = m.split('-')
    return `${months[mo]} ${y}`
  }

  if (loading) return <div className="min-h-screen bg-jumar-cream flex items-center justify-center text-jumar-brown text-xl">جارٍ التحميل...</div>

  return (
    <div className="min-h-screen bg-jumar-cream" dir="rtl">
      {/* Header */}
      <div className="bg-jumar-brown text-white p-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">💰 الماليات — جُمار</h1>
        <button onClick={() => router.push('/admin')} className="text-sm text-white/70 hover:text-white">← الرئيسية</button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white sticky top-0 z-10">
        {[['dashboard','📊 ملخص'],['sales','🛍️ مبيعات'],['expenses','🧾 مصروفات']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key as any)}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === key ? 'text-jumar-brown border-b-2 border-jumar-gold' : 'text-gray-500'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">

        {/* DASHBOARD TAB */}
        {tab === 'dashboard' && kpis && (
          <>
            {/* KPI tiles */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
                <p className="text-xs text-gray-500 mb-1">إجمالي الإيرادات</p>
                <p className="text-2xl font-bold text-green-600">{fmt(kpis.totalRevenue)} ج</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
                <p className="text-xs text-gray-500 mb-1">إجمالي الاستثمار</p>
                <p className="text-2xl font-bold text-red-500">{fmt(kpis.totalExpenses)} ج</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
                <p className="text-xs text-gray-500 mb-1">المركز المالي</p>
                <p className={`text-2xl font-bold ${kpis.netPosition >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {kpis.netPosition >= 0 ? '+' : ''}{fmt(kpis.netPosition)} ج
                </p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
                <p className="text-xs text-gray-500 mb-1">نسبة الاسترداد</p>
                <p className="text-2xl font-bold text-jumar-gold">{kpis.recoveryPct.toFixed(1)}%</p>
              </div>
            </div>

            {/* Cash on hand */}
            <div className="bg-jumar-brown text-white rounded-2xl p-4 flex justify-between items-center">
              <div>
                <p className="text-sm text-white/70">كاش في الإيد</p>
                <p className="text-3xl font-bold text-jumar-gold">{fmt(kpis.cashOnHand)} ج</p>
              </div>
              <div className="text-4xl">💵</div>
            </div>

            {/* Monthly P&L */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h2 className="font-bold text-jumar-brown">📅 ملخص شهري</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-3 text-right text-gray-500 font-medium">الشهر</th>
                      <th className="p-3 text-center text-green-600 font-medium">إيرادات</th>
                      <th className="p-3 text-center text-red-500 font-medium">مصروفات</th>
                      <th className="p-3 text-center text-jumar-brown font-medium">صافي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.map(row => (
                      <tr key={row.month} className="border-t border-gray-50">
                        <td className="p-3 text-right font-medium text-gray-700">{fmtMonth(row.month)}</td>
                        <td className="p-3 text-center text-green-600">{row.revenue > 0 ? fmt(row.revenue) : '—'}</td>
                        <td className="p-3 text-center text-red-500">{row.expenses > 0 ? fmt(row.expenses) : '—'}</td>
                        <td className={`p-3 text-center font-bold ${row.net >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {row.net >= 0 ? '+' : ''}{fmt(row.net)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-gray-200 bg-jumar-cream font-bold">
                      <td className="p-3 text-right text-jumar-brown">الإجمالي</td>
                      <td className="p-3 text-center text-green-600">{fmt(kpis.totalRevenue)}</td>
                      <td className="p-3 text-center text-red-500">{fmt(kpis.totalExpenses)}</td>
                      <td className={`p-3 text-center ${kpis.netPosition >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {kpis.netPosition >= 0 ? '+' : ''}{fmt(kpis.netPosition)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* بازار لوتس countdown */}
            <div className="bg-jumar-gold/20 border border-jumar-gold rounded-2xl p-4 text-center">
              <p className="text-sm text-jumar-brown font-semibold mb-1">🏪 بازار لوتس — 22-24 أكتوبر</p>
              <p className="text-xs text-gray-600">للوصول للـ break-even تحتاجي بيع 198 قطعة (66/يوم)</p>
              <p className="text-xs text-gray-500 mt-1">هامش ربح تقريبي: 75-80% للقطعة</p>
            </div>
          </>
        )}

        {/* SALES TAB */}
        {tab === 'sales' && (
          <>
            {/* Add sale form */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h2 className="font-bold text-jumar-brown mb-3">➕ تسجيل بيعة جديدة</h2>
              <form onSubmit={saveSale} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">التاريخ</label>
                    <input type="date" required value={saleForm.sale_date}
                      onChange={e => setSaleForm({...saleForm, sale_date: e.target.value})}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">القناة</label>
                    <select value={saleForm.channel} onChange={e => setSaleForm({...saleForm, channel: e.target.value})}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold">
                      {CHANNELS.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-500 block mb-1">الكميات (اختياري)</label>
                  <div className="grid grid-cols-5 gap-1 text-center text-xs">
                    {[
                      ['qty_tamriya','ت'],
                      ['qty_fudge','ف'],
                      ['qty_sultana','س'],
                      ['qty_snickers_fool','سف'],
                      ['qty_snickers_bunduq','سب'],
                    ].map(([key, label]) => (
                      <div key={key}>
                        <p className="text-gray-400 mb-1">{label}</p>
                        <input type="number" min="0" value={(saleForm as any)[key]}
                          onChange={e => setSaleForm({...saleForm, [key]: Number(e.target.value)})}
                          className="w-full border border-gray-200 rounded-lg px-1 py-1.5 text-center text-sm focus:outline-none focus:border-jumar-gold" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">المبلغ (ج) *</label>
                    <input type="number" required min="1" placeholder="0" value={saleForm.amount}
                      onChange={e => setSaleForm({...saleForm, amount: e.target.value})}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">نوع العميل</label>
                    <select value={saleForm.customer_type} onChange={e => setSaleForm({...saleForm, customer_type: e.target.value})}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold">
                      {['غريب','قريب/معرفة','متنوع','غير محدد'].map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <input placeholder="وصف الصنف (ت3 ف2 س1...)" value={saleForm.items_desc}
                  onChange={e => setSaleForm({...saleForm, items_desc: e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold" />

                <input placeholder="ملاحظات" value={saleForm.notes}
                  onChange={e => setSaleForm({...saleForm, notes: e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold" />

                {msg && <p className={`text-sm text-center ${msg.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>{msg}</p>}

                <button type="submit" disabled={saving}
                  className="w-full bg-jumar-brown text-white font-bold py-3 rounded-xl hover:opacity-90 disabled:opacity-50">
                  {saving ? 'جارٍ الحفظ...' : '💾 سجّل البيعة'}
                </button>
              </form>
            </div>

            {/* Sales history */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                <h2 className="font-bold text-jumar-brown">📋 سجل المبيعات ({sales.length})</h2>
                <span className="text-green-600 font-bold text-sm">{fmt(sales.reduce((s, r) => s + Number(r.amount), 0))} ج</span>
              </div>
              <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
                {sales.map(s => (
                  <div key={s.id} className="p-3 flex justify-between items-start">
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-jumar-gold/20 text-jumar-brown px-2 py-0.5 rounded-full">{s.channel}</span>
                        <span className="text-xs text-gray-400">{s.sale_date}</span>
                      </div>
                      {s.items_desc && <p className="text-xs text-gray-500 mt-0.5">{s.items_desc}</p>}
                      {s.notes && <p className="text-xs text-gray-400">{s.notes}</p>}
                    </div>
                    <span className="font-bold text-green-600 text-sm whitespace-nowrap mr-2">{fmt(Number(s.amount))} ج</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* EXPENSES TAB */}
        {tab === 'expenses' && (
          <>
            {/* Add expense form */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h2 className="font-bold text-jumar-brown mb-3">➕ تسجيل مصروف جديد</h2>
              <form onSubmit={saveExpense} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">التاريخ</label>
                    <input type="date" required value={expenseForm.expense_date}
                      onChange={e => setExpenseForm({...expenseForm, expense_date: e.target.value})}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">الفئة</label>
                    <select value={expenseForm.category} onChange={e => setExpenseForm({...expenseForm, category: e.target.value})}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold">
                      {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <input required placeholder="الوصف *" value={expenseForm.description}
                  onChange={e => setExpenseForm({...expenseForm, description: e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold" />

                <input type="number" required min="1" placeholder="المبلغ (ج) *" value={expenseForm.amount}
                  onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold" />

                <input placeholder="ملاحظات" value={expenseForm.notes}
                  onChange={e => setExpenseForm({...expenseForm, notes: e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold" />

                {msg && <p className={`text-sm text-center ${msg.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>{msg}</p>}

                <button type="submit" disabled={saving}
                  className="w-full bg-jumar-brown text-white font-bold py-3 rounded-xl hover:opacity-90 disabled:opacity-50">
                  {saving ? 'جارٍ الحفظ...' : '💾 سجّل المصروف'}
                </button>
              </form>
            </div>

            {/* By category summary */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h2 className="font-bold text-jumar-brown">📊 حسب الفئة</h2>
              </div>
              <div className="divide-y divide-gray-50">
                {EXPENSE_CATEGORIES.map(cat => {
                  const total = expenses.filter(e => e.category === cat).reduce((s, e) => s + Number(e.amount), 0)
                  if (!total) return null
                  const pct = kpis ? (total / kpis.totalExpenses * 100).toFixed(1) : '0'
                  return (
                    <div key={cat} className="p-3 flex justify-between items-center">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-sm text-gray-700">{cat}</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5 mx-2">
                          <div className="bg-jumar-gold h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-400">{pct}%</span>
                      </div>
                      <span className="font-bold text-red-500 text-sm mr-3">{fmt(total)} ج</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Expenses history */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                <h2 className="font-bold text-jumar-brown">📋 سجل المصروفات ({expenses.length})</h2>
                <span className="text-red-500 font-bold text-sm">{kpis ? fmt(kpis.totalExpenses) : 0} ج</span>
              </div>
              <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
                {expenses.map(e => (
                  <div key={e.id} className="p-3 flex justify-between items-start">
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">{e.category}</span>
                        <span className="text-xs text-gray-400">{e.expense_date}</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">{e.description}</p>
                    </div>
                    <span className="font-bold text-red-500 text-sm whitespace-nowrap mr-2">{fmt(Number(e.amount))} ج</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
