'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Order, OrderStatus, STATUS_LABELS, STATUS_COLORS } from '@/lib/types'

const ADMIN_PASSWORD = 'jumar2026'
const WHATSAPP_SENDER = '201XXXXXXXXX' // ← غيّر ده لرقم واتساب جُمار

// ── Types ──────────────────────────────────────────────────────────────────
type SalesSummary = {
  totalRevenue: number; totalQty: number; todayRevenue: number
  onlineOrders: number; bazaarRevenue: number
  dailyData: { date: string; amount: number }[]
}
interface Ingredient { id: string; name: string; unit: string; stock_grams: number; min_stock: number; cost_per_gram: number }
interface Movement { id: string; ingredient_id: string; type: 'in'|'out'|'adjust'; grams: number; cost: number; note: string; created_at: string; ingredients?: { name: string } }
type KPIs = { totalRevenue: number; totalExpenses: number; netPosition: number; recoveryPct: number; cashOnHand: number }
type MonthRow = { month: string; revenue: number; expenses: number; net: number }
type Sale = { id: string; sale_date: string; channel: string; items_desc: string; amount: number; customer_type: string; notes: string; qty_tamriya?: number; qty_fudge?: number; qty_sultana?: number; qty_snickers_fool?: number; qty_snickers_bunduq?: number }
type Expense = { id: string; expense_date: string; category: string; description: string; amount: number }
type DaySummary = { date: string; total: number; count: number; soldQty: number; giftQty: number }

// ── Constants ───────────────────────────────────────────────────────────────
const EXPENSE_CATEGORIES = ['خامات','معدات','تغليف','تسويق','رسوم بازار','عمالة','نثريات','بحث وتطوير','أخرى']
const FIXED_EXPENSE_CATEGORIES = ['عمالة','إيجار','معدات'] // مصاريف ثابتة
const CHANNELS = ['بازار','مباشر','إنستجرام','أونلاين']
const PACKAGING_COST_PER_PIECE = 1.5 // جنيه/قطعة تكلفة تغليف

// وصفة كل علبة: كمية كل خامة بالجرام للقطعة الواحدة (22 جرام)
const RECIPES: Record<string, Record<string, number>> = {
  'تمرية الطحينة': { 'تمر مجدول': 17, 'طحينة': 1, 'فول سوداني': 3, 'سمسم': 1 },
  'سلطانة الفستق':  { 'تمر مجدول': 18, 'فستق': 4 },
  'فدج الكاجو':     { 'تمر مجدول': 17, 'كاجو': 5, 'زبدة': 1 },
  'سنيكرز الفول':   { 'تمر مجدول': 16, 'فول سوداني': 3, 'شوكولاتة دارك': 3 },
  'سنيكرز البندق':  { 'تمر مجدول': 16, 'بندق': 3, 'شوكولاتة دارك': 3 },
}

// أحجام العلب
const BOX_SIZES = [
  { label: 'علبة ٢', pieces: 2 },
  { label: 'علبة ٥', pieces: 5 },
  { label: 'علبة ٨', pieces: 8 },
  { label: 'علبة ١٥', pieces: 15 },
  { label: 'علبة ٢٤', pieces: 24 },
]

const DEFAULT_INGREDIENTS = [
  { name: 'تمر مجدول', min_stock: 500, cost_per_gram: 0.20 },
  { name: 'تمر عادي', min_stock: 500, cost_per_gram: 0.139 },
  { name: 'كاجو', min_stock: 200, cost_per_gram: 0.70 },
  { name: 'فستق', min_stock: 200, cost_per_gram: 1.60 },
  { name: 'بندق', min_stock: 200, cost_per_gram: 1.4 },
  { name: 'فول سوداني', min_stock: 200, cost_per_gram: 0.18 },
  { name: 'طحينة', min_stock: 100, cost_per_gram: 0.333 },
  { name: 'شوكولاتة دارك', min_stock: 100, cost_per_gram: 1.1 },
  { name: 'زبدة', min_stock: 100, cost_per_gram: 0.9 },
  { name: 'تين مجفف', min_stock: 100, cost_per_gram: 0.517 },
  { name: 'سمسم', min_stock: 100, cost_per_gram: 0 },
  { name: 'جوز هند', min_stock: 100, cost_per_gram: 0 },
  { name: 'زبيب', min_stock: 100, cost_per_gram: 0 },
  { name: 'كاكاو خام', min_stock: 100, cost_per_gram: 1.4 },
  { name: 'زيت جوز الهند', min_stock: 100, cost_per_gram: 0.74 },
]

const BAZAAR_ITEMS = [
  { label: 'قطعة', qty: 1, gift: 0, price: 40 },
  { label: 'قطعتين', qty: 2, gift: 0, price: 70 },
  { label: 'علبة ٥', qty: 5, gift: 0, price: 170 },
  { label: 'علبة ٨', qty: 8, gift: 2, price: 260 },
  { label: 'علبة ١٥', qty: 15, gift: 3, price: 450 },
  { label: 'علبة ٢٤', qty: 24, gift: 4, price: 650 },
]
const BAZAAR_DATES = ['2026-10-22', '2026-10-23', '2026-10-24']
const dayLabel = (date: string) => ({ '2026-10-22': 'يوم ١', '2026-10-23': 'يوم ٢', '2026-10-24': 'يوم ٣' }[date] || date)

// رسائل واتساب حسب الحالة
const STATUS_WA_MSGS: Record<OrderStatus, string> = {
  pending:   'استلمنا طلبك وبنراجعه دلوقتي — جُمار 🌿',
  new:       'تم استلام طلبك ✅ — جُمار 🌿 شكراً لثقتك فينا!',
  preparing: 'طلبك دلوقتي بيتجهز 👩‍🍳 — جُمار 🌿',
  ready:     'طلبك جاهز ✅ وهيتبعت قريباً — جُمار 🌿',
  shipped:   'طلبك اتشحن 🚚 وفي الطريق إليك — جُمار 🌿',
  delivered: 'تم التوصيل بنجاح 🎉 نتمنى تستمتع بجُمار! شاركنا رأيك 💛',
  cancelled: 'تم إلغاء طلبك — جُمار 🌿 لأي استفسار تواصل معنا.',
}

// ── Language type ───────────────────────────────────────────────────────────
type Lang = 'ar' | 'en'

// ── Main Component ──────────────────────────────────────────────────────────
export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [activeTab, setActiveTab] = useState<'orders'|'inventory'|'finance'|'bazaar'|'analytics'>('orders')
  const [lang, setLang] = useState<Lang>('ar')

  function login() {
    if (password === ADMIN_PASSWORD) setAuthed(true)
    else alert(lang === 'ar' ? 'كلمة السر غلط' : 'Wrong password')
  }

  const isAr = lang === 'ar'

  if (!authed) return (
    <div className="min-h-screen flex items-center justify-center bg-jumar-cream p-6" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="bg-white rounded-2xl p-8 shadow-lg w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold text-jumar-brown mb-2">🌿 جُمار</h1>
        <p className="text-sm text-gray-400 mb-6">{isAr ? 'لوحة التحكم' : 'Admin Dashboard'}</p>
        <input type="password" placeholder={isAr ? 'كلمة السر' : 'Password'} value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && login()}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-center mb-4 focus:outline-none focus:border-jumar-gold" />
        <button onClick={login} className="w-full bg-jumar-brown text-white font-bold py-3 rounded-xl hover:opacity-90">{isAr ? 'دخول' : 'Login'}</button>
      </div>
    </div>
  )

  const navItems = [
    { key: 'orders',    icon: '📋', label: isAr ? 'الطلبات'  : 'Orders' },
    { key: 'inventory', icon: '📦', label: isAr ? 'المخزون'  : 'Stock' },
    { key: 'finance',   icon: '💰', label: isAr ? 'الماليات' : 'Finance' },
    { key: 'bazaar',    icon: '🏪', label: isAr ? 'البازار'  : 'Bazaar' },
    { key: 'analytics', icon: '📊', label: isAr ? 'تحليلات'  : 'Analytics' },
  ] as const

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="bg-jumar-brown text-white px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <h1 className="text-lg font-bold">🌿 جُمار — {isAr ? 'لوحة التحكم' : 'Dashboard'}</h1>
        <button
          onClick={() => setLang(l => l === 'ar' ? 'en' : 'ar')}
          className="text-xs font-bold px-3 py-1 rounded-full bg-white/20 text-white hover:bg-white/30 transition-all"
        >
          {isAr ? 'EN' : 'ع'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-20">
        {activeTab === 'orders'    && <OrdersTab lang={lang} />}
        {activeTab === 'inventory' && <InventoryTab lang={lang} />}
        {activeTab === 'finance'   && <FinanceTab lang={lang} />}
        {activeTab === 'bazaar'    && <BazaarTab lang={lang} />}
        {activeTab === 'analytics' && <AnalyticsTab lang={lang} />}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20 flex">
        {navItems.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex-1 py-2.5 flex flex-col items-center gap-0.5 text-[11px] font-semibold transition-all relative ${activeTab === t.key ? 'text-jumar-brown' : 'text-gray-400'}`}>
            <span className="text-lg leading-none">{t.icon}</span>
            <span>{t.label}</span>
            {activeTab === t.key && <div className="absolute bottom-0 inset-x-2 h-0.5 bg-jumar-gold rounded-full" />}
          </button>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ORDERS TAB
// ══════════════════════════════════════════════════════════════════════════════
function OrdersTab({ lang }: { lang: Lang }) {
  const ar = lang === 'ar'
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all')
  const [sales, setSales] = useState<SalesSummary | null>(null)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('orders').select('*, customers(*), order_items(*)').order('created_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }, [])

  const fetchSales = useCallback(async () => {
    const { data } = await supabase.from('sales').select('sale_date, amount, qty_tamriya, qty_fudge, qty_sultana, qty_snickers_fool, qty_snickers_bunduq, channel').order('sale_date', { ascending: false }).limit(90)
    if (!data) return
    const today = new Date().toISOString().split('T')[0]
    const byDate: Record<string, number> = {}
    data.forEach(r => { byDate[r.sale_date] = (byDate[r.sale_date] || 0) + Number(r.amount) })
    setSales({
      totalRevenue: data.reduce((s, r) => s + Number(r.amount), 0),
      totalQty: data.reduce((s, r) => s + (Number(r.qty_tamriya)||0)+(Number(r.qty_fudge)||0)+(Number(r.qty_sultana)||0)+(Number(r.qty_snickers_fool)||0)+(Number(r.qty_snickers_bunduq)||0), 0),
      todayRevenue: data.filter(r => r.sale_date === today).reduce((s, r) => s + Number(r.amount), 0),
      onlineOrders: data.filter(r => r.channel === 'أونلاين').length,
      bazaarRevenue: data.filter(r => r.channel === 'بازار').reduce((s, r) => s + Number(r.amount), 0),
      dailyData: Object.entries(byDate).sort(([a],[b]) => a > b ? 1 : -1).slice(-7).map(([date, amount]) => ({ date, amount })),
    })
  }, [])

  useEffect(() => {
    fetchOrders(); fetchSales()
    const channel = supabase.channel('orders').on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders()).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchOrders, fetchSales])

  async function updateStatus(order: Order, status: OrderStatus) {
    await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', order.id)
    fetchOrders()
    // فتح واتساب برسالة جاهزة للعميل
    const phone = (order.customers?.whatsapp || order.customers?.phone || '').replace(/\D/g, '')
    if (phone) {
      const msg = encodeURIComponent(STATUS_WA_MSGS[status])
      window.open(`https://wa.me/2${phone}?text=${msg}`, '_blank')
    }
  }

  // لينك واتساب مع العنوان للمندوب
  function deliveryLink(order: Order) {
    const name = order.customers?.name || ''
    const area = order.customers?.area || ''
    const address = order.customers?.address || ''
    const phone = (order.customers?.phone || '').replace(/\D/g, '')
    const msg = encodeURIComponent(`📦 توصيل جُمار\n👤 ${name}\n📍 ${area} — ${address}\n📞 ${phone}\n💰 ${order.total_price} ج`)
    return `https://wa.me/?text=${msg}`
  }

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter)
  const counts = {
    all: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    new: orders.filter(o => o.status === 'new').length,
    preparing: orders.filter(o => o.status === 'preparing').length,
    ready: orders.filter(o => o.status === 'ready').length,
    shipped: orders.filter(o => o.status === 'shipped').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="bg-orange-50 rounded-xl p-3 shadow-sm text-center"><div className="text-xl font-bold text-orange-500">{counts.pending}</div><div className="text-xs text-gray-500">{ar ? 'انتظار' : 'Pending'}</div></div>
        <div className="bg-white rounded-xl p-3 shadow-sm text-center"><div className="text-xl font-bold text-blue-600">{counts.new}</div><div className="text-xs text-gray-500">{ar ? 'جديد' : 'New'}</div></div>
        <div className="bg-white rounded-xl p-3 shadow-sm text-center"><div className="text-xl font-bold text-yellow-600">{counts.preparing}</div><div className="text-xs text-gray-500">{ar ? 'قيد التحضير' : 'Preparing'}</div></div>
        <div className="bg-white rounded-xl p-3 shadow-sm text-center"><div className="text-xl font-bold text-green-600">{counts.delivered}</div><div className="text-xs text-gray-500">{ar ? 'تم التوصيل' : 'Delivered'}</div></div>
      </div>

      {sales && (
        <div className="mb-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-jumar-brown text-white rounded-xl p-4"><p className="text-xs text-white/60 mb-1">{ar ? 'إجمالي الإيرادات' : 'Total Revenue'}</p><p className="text-xl font-bold text-jumar-gold">{sales.totalRevenue.toLocaleString('ar-EG')} {ar ? 'ج' : 'EGP'}</p></div>
            <div className="bg-white rounded-xl p-4 shadow-sm"><p className="text-xs text-gray-400 mb-1">{ar ? 'اليوم' : 'Today'}</p><p className="text-xl font-bold text-green-600">{sales.todayRevenue.toLocaleString('ar-EG')} {ar ? 'ج' : 'EGP'}</p></div>
          </div>
          {sales.dailyData.length > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-xs font-bold text-gray-500 mb-3">{ar ? `آخر ${sales.dailyData.length} أيام` : `Last ${sales.dailyData.length} days`}</p>
              <div className="flex items-end gap-1.5 h-16">
                {(() => {
                  const max = Math.max(...sales.dailyData.map(d => d.amount), 1)
                  return sales.dailyData.map(d => (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full rounded-t-sm bg-jumar-gold/70" style={{ height: `${Math.round((d.amount / max) * 100)}%`, minHeight: d.amount > 0 ? 4 : 0 }} />
                      <span className="text-[9px] text-gray-400">{d.date.slice(5)}</span>
                    </div>
                  ))
                })()}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {(['all', 'pending', 'new', 'preparing', 'ready', 'shipped', 'delivered', 'cancelled'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all ${filter === s ? 'bg-jumar-brown text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            {s === 'all' ? `${ar ? 'الكل' : 'All'} (${counts.all})` : `${STATUS_LABELS[s]} (${counts[s]})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">{ar ? 'جاري التحميل...' : 'Loading...'}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-gray-400">{ar ? 'مفيش طلبات' : 'No orders'}</div>
      ) : (
        <div className="space-y-4">
          {filtered.map(order => (
            <div key={order.id} className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-bold text-jumar-brown text-lg">{order.customers?.name}</p>
                  <p className="text-sm text-gray-500">{order.customers?.phone} | {order.customers?.area}</p>
                  {order.customers?.address && <p className="text-xs text-gray-400 mt-0.5">📍 {order.customers.address}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(order.created_at).toLocaleString(ar ? 'ar-EG' : 'en-US')}</p>
                </div>
                <div className="text-left">
                  <p className="font-bold text-jumar-brown">{order.total_price} {ar ? 'ج' : 'EGP'}</p>
                  <p className="text-xs text-gray-500">{order.box_qty} {ar ? 'قطعة' : 'pcs'}</p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-3 mb-3">
                {order.order_items?.map(item => (
                  <div key={item.id} className="flex justify-between text-sm py-0.5">
                    <span className="text-gray-700">{item.product_name}</span>
                    <span className="font-semibold text-jumar-brown">× {item.quantity}</span>
                  </div>
                ))}
              </div>

              {order.notes && <p className="text-sm text-gray-500 mb-3 bg-amber-50 rounded-lg p-2">📝 {order.notes}</p>}

              <div className="flex items-center gap-2 flex-wrap mb-3">
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${STATUS_COLORS[order.status]}`}>
                  {STATUS_LABELS[order.status]}
                </span>
                <div className="flex gap-1.5 flex-wrap">
                  {(['new', 'preparing', 'ready', 'shipped', 'delivered', 'cancelled'] as OrderStatus[])
                    .filter(s => s !== order.status)
                    .map(s => (
                      <button key={s} onClick={() => updateStatus(order, s)}
                        className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:border-jumar-gold hover:text-jumar-brown transition-all">
                        {STATUS_LABELS[s]}
                      </button>
                    ))}
                </div>
              </div>

              {/* أزرار التواصل + مسح */}
              <div className="flex gap-2 flex-wrap items-center justify-between">
                <div className="flex gap-2 flex-wrap">
                  <a href={`https://wa.me/2${(order.customers?.whatsapp || order.customers?.phone || '').replace(/\D/g,'')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 bg-green-50 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                    📲 {ar ? 'واتساب العميل' : 'WhatsApp Customer'}
                  </a>
                  <a href={deliveryLink(order)} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                    🚚 {ar ? 'إرسال للمندوب' : 'Send to Courier'}
                  </a>
                </div>
                <button
                  onClick={async () => {
                    if (!confirm(ar ? 'مسح الطلب ده نهائياً؟' : 'Delete this order permanently?')) return
                    await supabase.from('order_items').delete().eq('order_id', order.id)
                    await supabase.from('orders').delete().eq('id', order.id)
                    if (order.order_number) {
                      await supabase.from('sales').delete().like('notes', `order:${order.order_number}|%`)
                    }
                    fetchOrders()
                    fetchSales()
                  }}
                  className="text-xs px-3 py-1.5 rounded-full bg-red-50 text-red-500 hover:bg-red-100 font-semibold transition-all whitespace-nowrap"
                >
                  🗑️ {ar ? 'مسح' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// INVENTORY TAB  (خامات + علب جاهزة + حاسبة إنتاج)
// ══════════════════════════════════════════════════════════════════════════════
function InventoryTab({ lang }: { lang: Lang }) {
  const ar = lang === 'ar'
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'stock'|'boxes'|'calculator'|'add'|'use'|'history'>('stock')
  const [seeding, setSeeding] = useState(false)
  const [addForm, setAddForm] = useState({ ingredient_id: '', grams: '', cost: '', note: '' })
  const [useForm, setUseForm] = useState({ ingredient_id: '', grams: '', note: '' })
  const [adjustForm, setAdjustForm] = useState({ ingredient_id: '', grams: '', note: '' })
  const [msg, setMsg] = useState('')

  // علب جاهزة — load from localStorage immediately on mount
  const [readyBoxes, setReadyBoxes] = useState<Record<number, number>>(() => {
    try {
      const saved = localStorage.getItem('jumar_ready_boxes')
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })
  // حاسبة الإنتاج
  const [calcPlan, setCalcPlan] = useState<Record<string, Record<number, number>>>({})

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [{ data: ing }, { data: mov }] = await Promise.all([
      supabase.from('ingredients').select('*').order('name'),
      supabase.from('stock_movements').select('*, ingredients(name)').order('created_at', { ascending: false }).limit(50),
    ])
    setIngredients(ing || [])
    setMovements(mov || [])
    setLoading(false)
  }, [])

  const fetchBoxes = useCallback(async () => {
    const { data, error } = await supabase.from('ready_boxes').select('box_size, qty')
    if (!error && data && data.length > 0) {
      // DB has data — use it and sync to localStorage
      const map: Record<number, number> = {}
      data.forEach((r: any) => { map[Number(r.box_size)] = Number(r.qty) })
      setReadyBoxes(map)
      try { localStorage.setItem('jumar_ready_boxes', JSON.stringify(map)) } catch {}
    }
    // if DB empty/error: state already initialized from localStorage in useState()
  }, [])

  useEffect(() => { fetchAll(); fetchBoxes() }, [fetchAll, fetchBoxes])

  async function seedIngredients() {
    setSeeding(true)
    for (const ing of DEFAULT_INGREDIENTS) {
      await supabase.from('ingredients').upsert({ ...ing, unit: 'جرام', stock_grams: 0 }, { onConflict: 'name' })
    }
    await fetchAll(); setSeeding(false); setMsg('تم إضافة الخامات الافتراضية ✅')
  }

  async function handleAddStock(e: React.FormEvent) {
    e.preventDefault()
    if (!addForm.ingredient_id || !addForm.grams) return
    const grams = parseFloat(addForm.grams), cost = parseFloat(addForm.cost) || 0
    await supabase.from('stock_movements').insert({ ingredient_id: addForm.ingredient_id, type: 'in', grams, cost, note: addForm.note })
    const ing = ingredients.find(i => i.id === addForm.ingredient_id)
    if (ing) {
      const newStock = ing.stock_grams + grams
      const newCostPerGram = cost > 0 ? (ing.stock_grams * ing.cost_per_gram + cost) / newStock : ing.cost_per_gram
      await supabase.from('ingredients').update({ stock_grams: newStock, cost_per_gram: newCostPerGram }).eq('id', addForm.ingredient_id)
    }
    setAddForm({ ingredient_id: '', grams: '', cost: '', note: '' })
    setMsg('تم إضافة المخزون ✅'); fetchAll()
  }

  async function handleUseStock(e: React.FormEvent) {
    e.preventDefault()
    if (!useForm.ingredient_id || !useForm.grams) return
    const grams = parseFloat(useForm.grams)
    const ing = ingredients.find(i => i.id === useForm.ingredient_id)
    if (!ing) return
    if (ing.stock_grams < grams) { setMsg('المخزون مش كفاية!'); return }
    await supabase.from('stock_movements').insert({ ingredient_id: useForm.ingredient_id, type: 'out', grams, cost: grams * ing.cost_per_gram, note: useForm.note })
    await supabase.from('ingredients').update({ stock_grams: ing.stock_grams - grams }).eq('id', useForm.ingredient_id)
    setUseForm({ ingredient_id: '', grams: '', note: '' })
    setMsg('تم خصم المخزون ✅'); fetchAll()
  }

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault()
    if (!adjustForm.ingredient_id || !adjustForm.grams) return
    const newStock = parseFloat(adjustForm.grams)
    const ing = ingredients.find(i => i.id === adjustForm.ingredient_id)
    if (!ing) return
    const diff = newStock - ing.stock_grams
    await supabase.from('stock_movements').insert({ ingredient_id: adjustForm.ingredient_id, type: 'adjust', grams: diff, cost: 0, note: adjustForm.note || `تصحيح جرد` })
    await supabase.from('ingredients').update({ stock_grams: newStock }).eq('id', adjustForm.ingredient_id)
    setAdjustForm({ ingredient_id: '', grams: '', note: '' })
    setMsg('تم تصحيح الجرد ✅'); fetchAll()
  }

  async function saveBoxQty(size: number, newQty: number) {
    // delete all rows for this size, then insert fresh — avoids duplicate constraint issues
    await supabase.from('ready_boxes').delete().eq('box_size', size)
    await supabase.from('ready_boxes').insert({ box_size: size, qty: newQty })
    setReadyBoxes(prev => {
      const next = { ...prev, [size]: newQty }
      try { localStorage.setItem('jumar_ready_boxes', JSON.stringify(next)) } catch {}
      return next
    })
  }

  async function updateBoxQty(size: number, delta: number) {
    const cur = readyBoxes[size] || 0
    await saveBoxQty(size, Math.max(0, cur + delta))
  }

  async function setBoxQtyDirect(size: number, val: number) {
    await saveBoxQty(size, Math.max(0, val))
  }

  // حاسبة الإنتاج — احسب الخامات المطلوبة
  function calcRequired(): Record<string, number> {
    const totals: Record<string, number> = {}
    Object.entries(calcPlan).forEach(([product, sizes]) => {
      const recipe = RECIPES[product]
      if (!recipe) return
      Object.entries(sizes).forEach(([sizeStr, boxCount]) => {
        const pieces = parseInt(sizeStr) * (boxCount || 0)
        Object.entries(recipe).forEach(([ing, gramsPerPiece]) => {
          totals[ing] = (totals[ing] || 0) + gramsPerPiece * pieces
        })
      })
    })
    return totals
  }

  const calcResult = calcRequired()
  const totalPieces = Object.values(calcPlan).reduce((sum, sizes) =>
    sum + Object.entries(sizes).reduce((s, [sz, cnt]) => s + parseInt(sz) * (cnt || 0), 0), 0)

  const lowStock = ingredients.filter(i => i.stock_grams < i.min_stock)

  const invTabs = [
    ['stock',      ar ? '📊 خامات'      : '📊 Ingredients'],
    ['boxes',      ar ? '📦 علب جاهزة'  : '📦 Ready Boxes'],
    ['calculator', ar ? '🧮 حاسبة'       : '🧮 Calculator'],
    ['add',        ar ? '➕ إضافة'       : '➕ Add Stock'],
    ['use',        ar ? '🔽 خصم'        : '🔽 Deduct'],
    ['history',    ar ? '📋 سجل'        : '📋 History'],
  ] as const

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h2 className="text-xl font-bold text-jumar-brown mb-4">📦 {ar ? 'المخزون' : 'Inventory'}</h2>

      {msg && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 mb-4 text-center text-sm flex justify-between">
          <span>{msg}</span><button onClick={() => setMsg('')} className="text-green-500">✕</button>
        </div>
      )}

      {lowStock.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
          <p className="text-red-700 font-bold text-sm mb-1">⚠️ {ar ? 'مخزون منخفض:' : 'Low stock:'}</p>
          <p className="text-red-600 text-sm">{lowStock.map(i => i.name).join(' · ')}</p>
        </div>
      )}

      {ingredients.length === 0 && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-center">
          <p className="text-amber-700 mb-3 text-sm">{ar ? 'مفيش خامات مسجلة' : 'No ingredients registered'}</p>
          <button onClick={seedIngredients} disabled={seeding}
            className="bg-jumar-brown text-white px-6 py-2 rounded-xl font-bold hover:opacity-90 disabled:opacity-50">
            {seeding ? (ar ? 'جاري الإضافة...' : 'Adding...') : (ar ? '🌿 أضف الخامات الأساسية' : '🌿 Add Default Ingredients')}
          </button>
        </div>
      )}

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {invTabs.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key as any)}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all ${tab === key ? 'bg-jumar-brown text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <div className="text-center py-10 text-gray-400">{ar ? 'جاري التحميل...' : 'Loading...'}</div> : (
        <>
          {/* ─ خامات ─ */}
          {tab === 'stock' && (
            <div className="space-y-2">
              {ingredients.map(ing => {
                const pct = Math.min(100, (ing.stock_grams / Math.max(ing.min_stock * 2, 1)) * 100)
                const low = ing.stock_grams < ing.min_stock
                return (
                  <div key={ing.id} className="bg-white rounded-xl p-4 shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                      <div><span className="font-bold text-gray-800">{ing.name}</span>{low && <span className="mr-2 text-xs text-red-500 font-semibold">⚠️ منخفض</span>}</div>
                      <div className="text-left"><span className={`font-bold text-lg ${low ? 'text-red-600' : 'text-jumar-brown'}`}>{ing.stock_grams.toLocaleString('ar-EG')}</span><span className="text-xs text-gray-400 mr-1">جرام</span></div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2"><div className={`h-2 rounded-full ${low ? 'bg-red-400' : 'bg-jumar-gold'}`} style={{ width: `${pct}%` }} /></div>
                    <div className="flex justify-between mt-1"><span className="text-xs text-gray-400">{ar ? 'الحد الأدنى' : 'Min'}: {ing.min_stock}g</span><span className="text-xs text-gray-400">{ing.cost_per_gram.toFixed(2)} {ar ? 'ج/جرام' : 'EGP/g'}</span></div>
                  </div>
                )
              })}
              <div className="bg-white rounded-xl p-4 shadow-sm mt-4">
                <h3 className="font-bold text-jumar-brown mb-3">🔧 {ar ? 'تصحيح جرد' : 'Stock Adjustment'}</h3>
                <form onSubmit={handleAdjust} className="space-y-3">
                  <select value={adjustForm.ingredient_id} onChange={e => setAdjustForm({ ...adjustForm, ingredient_id: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right focus:outline-none focus:border-jumar-gold">
                    <option value="">{ar ? 'اختر الخامة' : 'Select ingredient'}</option>
                    {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} — {i.stock_grams}g</option>)}
                  </select>
                  <input type="number" placeholder={ar ? 'الكمية الفعلية (جرام)' : 'Actual quantity (grams)'} value={adjustForm.grams} onChange={e => setAdjustForm({ ...adjustForm, grams: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right focus:outline-none focus:border-jumar-gold" />
                  <input placeholder={ar ? 'سبب التصحيح' : 'Reason'} value={adjustForm.note} onChange={e => setAdjustForm({ ...adjustForm, note: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right focus:outline-none focus:border-jumar-gold" />
                  <button type="submit" className="w-full bg-jumar-brown text-white font-bold py-3 rounded-xl hover:opacity-90">{ar ? 'حفظ الجرد' : 'Save Adjustment'}</button>
                </form>
              </div>
            </div>
          )}

          {/* ─ علب جاهزة ─ */}
          {tab === 'boxes' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400 text-center mb-2">{ar ? 'عدد العلب الجاهزة للبيع — اضغط + / − أو اكتب الرقم مباشرة' : 'Ready boxes for sale — tap + / − or type directly'}</p>
              <div className="grid grid-cols-1 gap-3">
                {BOX_SIZES.map(({ label, pieces }) => {
                  const qty = readyBoxes[pieces] || 0
                  return (
                    <div key={pieces} className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="font-bold text-jumar-brown text-lg">{label}</p>
                        <p className="text-xs text-gray-400">{pieces} {ar ? 'قطعة' : 'pcs'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateBoxQty(pieces, -1)} className="w-10 h-10 rounded-xl bg-gray-100 text-gray-600 text-xl font-bold hover:bg-red-50 hover:text-red-600 transition-all">−</button>
                        <input
                          type="number"
                          min="0"
                          value={qty}
                          onChange={e => {
                            const v = parseInt(e.target.value)
                            if (!isNaN(v)) setBoxQtyDirect(pieces, v)
                          }}
                          className={`w-14 text-center text-2xl font-bold border-2 rounded-xl py-1 focus:outline-none focus:border-jumar-gold ${qty === 0 ? 'text-gray-300 border-gray-100' : qty < 3 ? 'text-red-500 border-red-100' : 'text-jumar-brown border-jumar-gold/30'}`}
                        />
                        <button onClick={() => updateBoxQty(pieces, 1)} className="w-10 h-10 rounded-xl bg-jumar-brown text-white text-xl font-bold hover:opacity-90 transition-all">+</button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="bg-jumar-brown text-white rounded-2xl p-4 text-center">
                <p className="text-white/70 text-sm mb-1">{ar ? 'إجمالي العلب' : 'Total Boxes'}</p>
                <p className="text-4xl font-bold text-jumar-gold">{Object.values(readyBoxes).reduce((s, v) => s + v, 0)}</p>
              </div>
            </div>
          )}

          {/* ─ حاسبة الإنتاج ─ */}
          {tab === 'calculator' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-400 text-center">{ar ? 'دخّل عدد العلب اللي عايز تعملها → يطلع المطلوب من كل خامة' : 'Enter box quantities → get required ingredients'}</p>
              {Object.keys(RECIPES).map(product => (
                <div key={product} className="bg-white rounded-2xl p-4 shadow-sm">
                  <p className="font-bold text-jumar-brown mb-3">{product}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {BOX_SIZES.map(({ label, pieces }) => (
                      <div key={pieces}>
                        <p className="text-xs text-gray-400 mb-1">{label}</p>
                        <input type="number" min="0" placeholder="0"
                          value={calcPlan[product]?.[pieces] || ''}
                          onChange={e => setCalcPlan(prev => ({
                            ...prev,
                            [product]: { ...(prev[product] || {}), [pieces]: parseInt(e.target.value) || 0 }
                          }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-center text-sm focus:outline-none focus:border-jumar-gold"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {totalPieces > 0 && (
                <div className="bg-jumar-brown text-white rounded-2xl p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <p className="font-bold text-jumar-gold">🧮 {ar ? 'المطلوب من الخامات' : 'Required Ingredients'}</p>
                    <p className="text-xs text-white/60">{totalPieces} {ar ? 'قطعة إجمالي' : 'pcs total'}</p>
                  </div>
                  {Object.entries(calcResult).sort(([,a],[,b]) => b - a).map(([name, grams]) => {
                    const ing = ingredients.find(i => i.name === name)
                    const enough = ing ? ing.stock_grams >= grams : true
                    return (
                      <div key={name} className="flex justify-between items-center">
                        <span className="text-sm text-white/80">{name}</span>
                        <div className="text-left">
                          <span className={`font-bold ${enough ? 'text-jumar-gold' : 'text-red-300'}`}>{grams.toFixed(0)}ج</span>
                          {ing && <span className={`text-xs mr-2 ${enough ? 'text-white/40' : 'text-red-300'}`}>({enough ? `✓ ${ar ? 'متاح' : 'avail'} ${ing.stock_grams.toFixed(0)}g` : `✗ ${ar ? 'ناقص' : 'short'} ${(grams - ing.stock_grams).toFixed(0)}g`})</span>}
                        </div>
                      </div>
                    )
                  })}
                  <button onClick={() => setCalcPlan({})} className="w-full mt-2 bg-white/10 text-white text-sm py-2 rounded-xl hover:bg-white/20">{ar ? 'مسح الحاسبة' : 'Clear Calculator'}</button>
                </div>
              )}
            </div>
          )}

          {/* ─ إضافة مخزون ─ */}
          {tab === 'add' && (
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h2 className="font-bold text-jumar-brown text-lg mb-4">➕ {ar ? 'تسجيل مشتريات جديدة' : 'Record New Purchase'}</h2>
              <form onSubmit={handleAddStock} className="space-y-3">
                <select value={addForm.ingredient_id} onChange={e => setAddForm({ ...addForm, ingredient_id: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right focus:outline-none focus:border-jumar-gold">
                  <option value="">{ar ? 'اختر الخامة *' : 'Select ingredient *'}</option>
                  {ingredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
                <input required type="number" placeholder={ar ? 'الكمية (جرام) *' : 'Quantity (grams) *'} value={addForm.grams} onChange={e => setAddForm({ ...addForm, grams: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right focus:outline-none focus:border-jumar-gold" />
                <input type="number" placeholder={ar ? 'التكلفة الإجمالية (جنيه)' : 'Total cost (EGP)'} value={addForm.cost} onChange={e => setAddForm({ ...addForm, cost: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right focus:outline-none focus:border-jumar-gold" />
                <input placeholder={ar ? 'ملاحظة' : 'Note'} value={addForm.note} onChange={e => setAddForm({ ...addForm, note: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right focus:outline-none focus:border-jumar-gold" />
                {addForm.grams && addForm.cost && <p className="text-sm text-jumar-gold text-center">{ar ? 'سعر الجرام' : 'Cost/gram'}: {(parseFloat(addForm.cost) / parseFloat(addForm.grams)).toFixed(2)} {ar ? 'ج' : 'EGP'}</p>}
                <button type="submit" className="w-full bg-jumar-gold text-jumar-brown font-bold py-3 rounded-xl hover:opacity-90">✅ {ar ? 'تسجيل المشتريات' : 'Save Purchase'}</button>
              </form>
            </div>
          )}

          {/* ─ خصم استخدام ─ */}
          {tab === 'use' && (
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h2 className="font-bold text-jumar-brown text-lg mb-4">🔽 {ar ? 'خصم استخدام في الإنتاج' : 'Deduct Production Use'}</h2>
              <form onSubmit={handleUseStock} className="space-y-3">
                <select value={useForm.ingredient_id} onChange={e => setUseForm({ ...useForm, ingredient_id: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right focus:outline-none focus:border-jumar-gold">
                  <option value="">{ar ? 'اختر الخامة *' : 'Select ingredient *'}</option>
                  {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} — {ar ? 'متاح' : 'avail'}: {i.stock_grams}g</option>)}
                </select>
                <input required type="number" placeholder={ar ? 'الكمية المستخدمة (جرام) *' : 'Used quantity (grams) *'} value={useForm.grams} onChange={e => setUseForm({ ...useForm, grams: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right focus:outline-none focus:border-jumar-gold" />
                <input placeholder={ar ? 'الدفعة / المنتج' : 'Batch / Product'} value={useForm.note} onChange={e => setUseForm({ ...useForm, note: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right focus:outline-none focus:border-jumar-gold" />
                <button type="submit" className="w-full bg-red-500 text-white font-bold py-3 rounded-xl hover:opacity-90">🔽 {ar ? 'خصم من المخزون' : 'Deduct Stock'}</button>
              </form>
            </div>
          )}

          {/* ─ السجل ─ */}
          {tab === 'history' && (
            <div className="space-y-2">
              {movements.length === 0 ? <div className="text-center py-10 text-gray-400">{ar ? 'لا توجد حركات مسجلة' : 'No movements recorded'}</div>
              : movements.map(m => (
                <div key={m.id} className="bg-white rounded-xl p-4 shadow-sm flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-gray-800">{m.ingredients?.name}</p>
                    <p className="text-xs text-gray-400">{m.note}</p>
                    <p className="text-xs text-gray-400">{new Date(m.created_at).toLocaleString(ar ? 'ar-EG' : 'en-US')}</p>
                  </div>
                  <div className="text-left">
                    <span className={`font-bold text-lg ${m.type === 'in' ? 'text-green-600' : m.type === 'out' ? 'text-red-500' : 'text-blue-500'}`}>
                      {m.type === 'in' ? '+' : m.type === 'out' ? '−' : '~'}{Math.abs(m.grams)}{ar ? 'ج' : 'g'}
                    </span>
                    <p className="text-xs font-medium mt-0.5">{m.type === 'in' ? (ar ? 'وارد' : 'In') : m.type === 'out' ? (ar ? 'صادر' : 'Out') : (ar ? 'تعديل' : 'Adjust')}</p>
                    {m.cost > 0 && <p className="text-xs text-gray-400">{m.cost.toFixed(0)} {ar ? 'ج' : 'EGP'}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// FINANCE TAB
// ══════════════════════════════════════════════════════════════════════════════
type Bazaar = { id: string; name: string; location: string; start_date: string; end_date: string; fixed_cost: number; notes: string }

function FinanceTab({ lang }: { lang: Lang }) {
  const ar = lang === 'ar'
  const [tab, setTab] = useState<'overview'|'pl'|'cogs'|'inventory_turn'|'channels'|'customers'|'bazaar_roi'|'past_bazaars'|'cashflow'|'sales'|'expenses'>('overview')
  const [kpis, setKpis] = useState<KPIs | null>(null)
  const [monthlyData, setMonthlyData] = useState<MonthRow[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [bazaars, setBazaars] = useState<Bazaar[]>([])
  const [loading, setLoading] = useState(true)
  const [saleForm, setSaleForm] = useState({ sale_date: new Date().toISOString().split('T')[0], channel: 'بازار', items_desc: '', qty_tamriya: 0, qty_fudge: 0, qty_sultana: 0, qty_snickers_fool: 0, qty_snickers_bunduq: 0, amount: '', customer_type: 'غريب', notes: '' })
  const [expenseForm, setExpenseForm] = useState({ expense_date: new Date().toISOString().split('T')[0], category: 'خامات', description: '', amount: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: salesData }, { data: expensesData }, { data: ingData }, { data: ordersData }, { data: bazaarsData }] = await Promise.all([
      supabase.from('sales').select('*').order('sale_date', { ascending: false }),
      supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
      supabase.from('ingredients').select('*').order('name'),
      supabase.from('orders').select('*, customers(name, area, phone), order_items(product_name, quantity)').order('created_at', { ascending: false }),
      supabase.from('bazaars').select('*').order('start_date', { ascending: false }),
    ])
    if (salesData) setSales(salesData)
    if (expensesData) setExpenses(expensesData)
    if (ingData) setIngredients(ingData)
    if (ordersData) setOrders(ordersData)
    if (bazaarsData) setBazaars(bazaarsData)

    const totalRevenue = (salesData || []).reduce((s: number, r: Sale) => s + Number(r.amount), 0)
    const totalExpenses = (expensesData || []).reduce((s: number, r: Expense) => s + Number(r.amount), 0)
    const map: Record<string, { revenue: number; expenses: number }> = {}
    ;(salesData || []).forEach((r: Sale) => { const m = r.sale_date.substring(0,7); if (!map[m]) map[m] = { revenue: 0, expenses: 0 }; map[m].revenue += Number(r.amount) })
    ;(expensesData || []).forEach((r: Expense) => { const m = r.expense_date.substring(0,7); if (!map[m]) map[m] = { revenue: 0, expenses: 0 }; map[m].expenses += Number(r.amount) })
    setMonthlyData(Object.entries(map).sort(([a],[b]) => a.localeCompare(b)).map(([month, v]) => ({ month, ...v, net: v.revenue - v.expenses })))
    setKpis({ totalRevenue, totalExpenses, netPosition: totalRevenue - totalExpenses, recoveryPct: totalExpenses > 0 ? (totalRevenue / totalExpenses) * 100 : 0, cashOnHand: totalRevenue - totalExpenses })
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const fmt = (n: number) => n.toLocaleString(ar ? 'ar-EG' : 'en-US', { maximumFractionDigits: 0 })
  const cur = ar ? 'ج' : 'EGP'
  const fmtPct = (n: number) => `${n.toFixed(1)}%`
  const fmtMonth = (m: string) => {
    if (!ar) {
      const [y, mo] = m.split('-'); return new Date(parseInt(y), parseInt(mo)-1).toLocaleString('en-US', {month:'short', year:'numeric'})
    }
    const months: Record<string,string> = {'01':'يناير','02':'فبراير','03':'مارس','04':'أبريل','05':'مايو','06':'يونيو','07':'يوليو','08':'أغسطس','09':'سبتمبر','10':'أكتوبر','11':'نوفمبر','12':'ديسمبر'}
    const [y, mo] = m.split('-'); return `${months[mo]} ${y}`
  }

  // ── حسابات مالية مشتركة ──────────────────────────────────────────────────
  // COGS: تكلفة الخامات لكل قطعة لكل منتج
  function cogPerPiece(product: string): number {
    const recipe = RECIPES[product]
    if (!recipe) return 0
    return Object.entries(recipe).reduce((sum, [ingName, grams]) => {
      const ing = ingredients.find(i => i.name === ingName)
      return sum + (ing ? ing.cost_per_gram * grams : 0)
    }, 0)
  }

  // إجمالي COGS من المبيعات
  const saleQty = (r: Sale) => (r.qty_tamriya||0)+(r.qty_fudge||0)+(r.qty_sultana||0)+(r.qty_snickers_fool||0)+(r.qty_snickers_bunduq||0)
  const totalQtySold = sales.reduce((s, r) => s + saleQty(r), 0)
  const avgCogPerPiece = Object.keys(RECIPES).length > 0
    ? Object.keys(RECIPES).reduce((s, p) => s + cogPerPiece(p), 0) / Object.keys(RECIPES).length
    : 0
  const totalCOGS = totalQtySold * (avgCogPerPiece + PACKAGING_COST_PER_PIECE)

  // P&L
  const totalRevenue = sales.reduce((s, r) => s + Number(r.amount), 0)
  const grossProfit = totalRevenue - totalCOGS
  const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
  const totalOpex = expenses.reduce((s, e) => s + Number(e.amount), 0)
  // هدر: هدايا من notes
  const totalGiftQty = sales.reduce((s, r) => {
    const m = (r.notes || '').match(/gift:(\d+)/); return s + (m ? parseInt(m[1]) : 0)
  }, 0)
  const giftCost = totalGiftQty * (avgCogPerPiece + PACKAGING_COST_PER_PIECE)
  const netProfit = grossProfit - totalOpex - giftCost
  const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

  // مصاريف ثابتة شهرياً
  const fixedExpenses = expenses.filter(e => FIXED_EXPENSE_CATEGORIES.includes(e.category)).reduce((s, e) => s + Number(e.amount), 0)
  const cashBurnMonths = fixedExpenses > 0 && netProfit < 0 ? Math.abs(netProfit) / (fixedExpenses / Math.max(monthlyData.length, 1)) : null

  // break-even
  const avgSalePrice = totalQtySold > 0 ? totalRevenue / totalQtySold : 40
  const avgVarCost = avgCogPerPiece + PACKAGING_COST_PER_PIECE
  const contributionMarginPerPiece = avgSalePrice - avgVarCost
  const monthlyFixedCost = monthlyData.length > 0 ? fixedExpenses / monthlyData.length : fixedExpenses
  const breakEvenPieces = contributionMarginPerPiece > 0 ? Math.ceil(monthlyFixedCost / contributionMarginPerPiece) : 0

  // دوران المخزون
  const inventoryValue = ingredients.reduce((s, i) => s + i.stock_grams * i.cost_per_gram, 0)
  const dailySalesAvg = monthlyData.length > 0 ? totalRevenue / (monthlyData.length * 30) : 0

  // تحليل القنوات
  const byChannel: Record<string, { revenue: number; count: number }> = {}
  sales.forEach(s => {
    if (!byChannel[s.channel]) byChannel[s.channel] = { revenue: 0, count: 0 }
    byChannel[s.channel].revenue += Number(s.amount)
    byChannel[s.channel].count += 1
  })
  const channelEntries = Object.entries(byChannel).sort(([,a],[,b]) => b.revenue - a.revenue)

  // تحليل العملاء
  const customerOrders: Record<string, { name: string; count: number; total: number; area: string }> = {}
  orders.forEach(o => {
    const key = o.customers?.phone || o.id
    if (!customerOrders[key]) customerOrders[key] = { name: o.customers?.name || '—', count: 0, total: 0, area: o.customers?.area || '' }
    customerOrders[key].count += 1
    customerOrders[key].total += Number(o.total_price || 0)
  })
  const repeatCustomers = Object.values(customerOrders).filter(c => c.count > 1)
  const avgOrderValue = orders.length > 0 ? orders.reduce((s, o) => s + Number(o.total_price || 0), 0) / orders.length : 0
  const areaCount: Record<string, number> = {}
  orders.forEach(o => { if (o.customers?.area) areaCount[o.customers.area] = (areaCount[o.customers.area] || 0) + 1 })
  const topAreas = Object.entries(areaCount).sort(([,a],[,b]) => b - a).slice(0, 5)

  // ROI البازار
  const bazaarRevenue = sales.filter(s => s.channel === 'بازار').reduce((sum, s) => sum + Number(s.amount), 0)
  const bazaarCost = expenses.filter(e => e.category === 'رسوم بازار').reduce((sum, e) => sum + Number(e.amount), 0)
  const bazaarProfit = bazaarRevenue - bazaarCost
  const bazaarROI = bazaarCost > 0 ? ((bazaarProfit / bazaarCost) * 100) : null

  async function saveSale(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMsg('')
    const total_qty = saleForm.qty_tamriya + saleForm.qty_fudge + saleForm.qty_sultana + saleForm.qty_snickers_fool + saleForm.qty_snickers_bunduq
    const { error } = await supabase.from('sales').insert({ ...saleForm, total_qty, amount: Number(saleForm.amount) })
    if (error) setMsg('❌ خطأ: ' + error.message)
    else { setMsg('✅ تم تسجيل البيع'); setSaleForm({ sale_date: new Date().toISOString().split('T')[0], channel: 'بازار', items_desc: '', qty_tamriya: 0, qty_fudge: 0, qty_sultana: 0, qty_snickers_fool: 0, qty_snickers_bunduq: 0, amount: '', customer_type: 'غريب', notes: '' }); await loadData() }
    setSaving(false)
  }

  async function saveExpense(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setMsg('')
    const { error } = await supabase.from('expenses').insert({ ...expenseForm, amount: Number(expenseForm.amount) })
    if (error) setMsg('❌ خطأ: ' + error.message)
    else { setMsg('✅ تم تسجيل المصروف'); setExpenseForm({ expense_date: new Date().toISOString().split('T')[0], category: 'خامات', description: '', amount: '', notes: '' }); await loadData() }
    setSaving(false)
  }

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">{ar ? 'جارٍ التحميل...' : 'Loading...'}</div>

  const TABS = [
    ['overview', ar ? '📊 نظرة سريعة' : '📊 Overview'],
    ['pl',       ar ? '📋 P&L'        : '📋 P&L'],
    ['cogs',     ar ? '🏭 تكلفة إنتاج' : '🏭 COGS'],
    ['inventory_turn', ar ? '🔄 دوران مخزون' : '🔄 Inventory'],
    ['channels', ar ? '📡 القنوات'    : '📡 Channels'],
    ['customers',ar ? '👥 العملاء'    : '👥 Customers'],
    ['bazaar_roi',ar ? '🏪 ROI بازار' : '🏪 Bazaar ROI'],
    ['past_bazaars', ar ? '📊 بازارات سابقة' : '📊 Past Bazaars'],
    ['cashflow', ar ? '💵 تدفق نقدي'  : '💵 Cash Flow'],
    ['sales',    ar ? '🛍️ بيعة'       : '🛍️ Add Sale'],
    ['expenses', ar ? '🧾 مصروف'      : '🧾 Add Expense'],
  ] as const

  return (
    <div className="max-w-2xl mx-auto" dir={ar ? 'rtl' : 'ltr'}>
      {/* Tab bar — horizontal scroll */}
      <div className="flex gap-1 overflow-x-auto pb-0 bg-white border-b border-gray-200 px-2 pt-2">
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key as any)}
            className={`px-3 py-2 text-xs font-semibold whitespace-nowrap rounded-t-lg transition-all flex-shrink-0 ${tab === key ? 'bg-jumar-brown text-white' : 'text-gray-500 hover:text-jumar-brown'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="p-4 pt-5 space-y-4">

        {/* ── نظرة سريعة ── */}
        {tab === 'overview' && (
          <>
            {/* KPI tiles */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: ar ? 'إجمالي الإيرادات' : 'Total Revenue', value: fmt(totalRevenue) + ' ' + cur, color: 'text-green-600' },
                { label: ar ? 'صافي الربح' : 'Net Profit', value: (netProfit >= 0 ? '+' : '') + fmt(netProfit) + ' ' + cur, color: netProfit >= 0 ? 'text-green-600' : 'text-red-500' },
                { label: ar ? 'هامش إجمالي' : 'Gross Margin', value: fmtPct(grossMargin), color: 'text-jumar-gold' },
                { label: ar ? 'هامش صافي' : 'Net Margin', value: fmtPct(netMargin), color: netMargin >= 0 ? 'text-jumar-brown' : 'text-red-500' },
              ].map((kpi, i) => (
                <div key={i} className="bg-white rounded-2xl shadow-sm text-center p-4 flex flex-col gap-2 min-h-[90px] justify-center">
                  <p className="text-xs text-gray-500 leading-snug">{kpi.label}</p>
                  <p className={`text-xl font-bold leading-tight ${kpi.color}`}>{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* قيمة المخزون */}
            <div className="bg-jumar-brown text-white rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-white/60">{ar ? 'قيمة المخزون' : 'Inventory Value'}</span>
                <span className="font-bold text-jumar-gold">{fmt(inventoryValue)} {cur}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-white/60">{ar ? 'قطع مباعة' : 'Units Sold'}</span>
                <span className="font-bold">{totalQtySold} {ar ? 'قطعة' : 'pcs'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-white/60">{ar ? 'أيام تشغيل' : 'Active Days'}</span>
                <span className="font-bold">{Object.keys(Object.fromEntries(sales.map(s => [s.sale_date, 1]))).length} {ar ? 'يوم' : 'days'}</span>
              </div>
            </div>

            {/* break-even */}
            {breakEvenPieces > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <p className="text-sm font-bold text-amber-800 mb-1">🎯 {ar ? 'Break-Even الشهري' : 'Monthly Break-Even'}</p>
                <p className="text-2xl font-bold text-amber-700">{breakEvenPieces.toLocaleString(ar ? 'ar-EG' : 'en-US')} {ar ? 'قطعة/شهر' : 'pcs/month'}</p>
                <p className="text-xs text-amber-600 mt-1">({Math.round(breakEvenPieces / 30)} {ar ? 'قطعة/يوم' : 'pcs/day'}) · {ar ? 'هامش مساهمة' : 'Contribution margin'}: {fmt(contributionMarginPerPiece)} {cur}/{ar ? 'قطعة' : 'pc'}</p>
              </div>
            )}

            {/* ملخص شهري */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100"><h2 className="font-bold text-jumar-brown">📅 {ar ? 'ملخص شهري' : 'Monthly Summary'}</h2></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="p-3 text-right text-gray-500 font-medium">{ar ? 'الشهر' : 'Month'}</th>
                      <th className="p-3 text-center text-green-600 font-medium">{ar ? 'إيرادات' : 'Revenue'}</th>
                      <th className="p-3 text-center text-red-500 font-medium">{ar ? 'مصروفات' : 'Expenses'}</th>
                      <th className="p-3 text-center text-jumar-brown font-medium">{ar ? 'صافي' : 'Net'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.map(row => (
                      <tr key={row.month} className="border-t border-gray-50">
                        <td className="p-3 text-right font-medium text-gray-700">{fmtMonth(row.month)}</td>
                        <td className="p-3 text-center text-green-600">{row.revenue > 0 ? fmt(row.revenue) : '—'}</td>
                        <td className="p-3 text-center text-red-500">{row.expenses > 0 ? fmt(row.expenses) : '—'}</td>
                        <td className={`p-3 text-center font-bold ${row.net >= 0 ? 'text-green-600' : 'text-red-500'}`}>{row.net >= 0 ? '+' : ''}{fmt(row.net)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-gray-200 bg-jumar-cream font-bold">
                      <td className="p-3 text-right text-jumar-brown">{ar ? 'الإجمالي' : 'Total'}</td>
                      <td className="p-3 text-center text-green-600">{fmt(totalRevenue)}</td>
                      <td className="p-3 text-center text-red-500">{fmt(totalOpex)}</td>
                      <td className={`p-3 text-center ${netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{netProfit >= 0 ? '+' : ''}{fmt(netProfit)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── P&L Statement ── */}
        {tab === 'pl' && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-jumar-brown text-white">
                <h2 className="font-bold">📋 {ar ? 'قائمة الأرباح والخسائر' : 'Profit & Loss Statement'}</h2>
                <p className="text-xs text-white/60 mt-0.5">{ar ? 'إجمالي منذ البداية' : 'All-time cumulative'}</p>
              </div>
              <div className="divide-y divide-gray-100">
                <div className="flex justify-between items-center px-4 py-3">
                  <span className="font-bold text-gray-800 text-sm">{ar ? 'إجمالي الإيرادات' : 'Total Revenue'}</span>
                  <span className="font-bold text-green-600">{fmt(totalRevenue)} {cur}</span>
                </div>
                <div className="flex justify-between items-center px-4 py-2 bg-gray-50">
                  <span className="text-gray-500 text-sm pr-4">(-) {ar ? 'تكلفة البضاعة (COGS)' : 'Cost of Goods (COGS)'}</span>
                  <span className="font-semibold text-red-500 text-sm">−{fmt(totalCOGS)} {cur}</span>
                </div>
                <div className="px-4 py-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-800 text-sm">= {ar ? 'إجمالي الربح' : 'Gross Profit'}</span>
                    <span className={`font-bold ${grossProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmt(grossProfit)} {cur}</span>
                  </div>
                  <p className="text-xs text-jumar-gold mt-0.5">{ar ? 'هامش إجمالي' : 'Gross margin'}: {fmtPct(grossMargin)}</p>
                </div>
                <div className="flex justify-between items-center px-4 py-2 bg-gray-50">
                  <span className="text-gray-500 text-sm pr-4">(-) {ar ? 'مصاريف التشغيل (OPEX)' : 'Operating Expenses (OPEX)'}</span>
                  <span className="font-semibold text-red-500 text-sm">−{fmt(totalOpex)} {cur}</span>
                </div>
                <div className="flex justify-between items-center px-4 py-2 bg-gray-50">
                  <span className="text-gray-500 text-sm pr-4">(-) {ar ? `تكلفة الهدايا (${totalGiftQty} قطعة)` : `Gift cost (${totalGiftQty} pcs)`}</span>
                  <span className="font-semibold text-orange-500 text-sm">−{fmt(giftCost)} {cur}</span>
                </div>
                <div className={`px-4 py-3 ${netProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-800">= {ar ? 'صافي الربح' : 'Net Profit'}</span>
                    <span className={`font-bold text-lg ${netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{netProfit >= 0 ? '' : '−'}{fmt(Math.abs(netProfit))} {cur}</span>
                  </div>
                  <p className="text-xs text-jumar-gold mt-0.5">{ar ? 'هامش صافي' : 'Net margin'}: {fmtPct(netMargin)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── تكلفة الإنتاج (COGS) ── */}
        {tab === 'cogs' && (
          <div className="space-y-3">
            <div className="bg-jumar-brown text-white rounded-2xl p-4 text-center">
              <p className="text-xs text-white/60 mb-1">{ar ? 'متوسط تكلفة القطعة الواحدة' : 'Avg cost per piece'}</p>
              <p className="text-3xl font-bold text-jumar-gold">{(avgCogPerPiece + PACKAGING_COST_PER_PIECE).toFixed(2)} {cur}</p>
              <p className="text-xs text-white/50 mt-1">{ar ? 'خامات' : 'Ingredients'}: {avgCogPerPiece.toFixed(2)}{cur} + {ar ? 'تغليف' : 'Packaging'}: {PACKAGING_COST_PER_PIECE}{cur}</p>
            </div>
            {Object.keys(RECIPES).map(product => {
              const rawCost = cogPerPiece(product)
              const totalCost = rawCost + PACKAGING_COST_PER_PIECE
              const salePrice = 35 // 35 ج متوسط واقعي للقطعة (مزيج علب)
              const margin = salePrice > 0 ? ((salePrice - totalCost) / salePrice * 100) : 0
              const recipe = RECIPES[product]
              return (
                <div key={product} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-4 bg-jumar-cream">
                    <div className="flex justify-between items-center">
                      <p className="font-bold text-jumar-brown">{product}</p>
                      <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${margin >= 40 ? 'bg-green-100 text-green-700' : margin >= 20 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                        {ar ? 'هامش' : 'Margin'} {fmtPct(margin)}
                      </span>
                    </div>
                  </div>
                  <div className="p-4 space-y-1">
                    {Object.entries(recipe).map(([ing, grams]) => {
                      const ingData = ingredients.find(i => i.name === ing)
                      const cost = ingData ? ingData.cost_per_gram * grams : 0
                      return (
                        <div key={ing} className="flex justify-between text-xs text-gray-600">
                          <span>{ing} ({grams}ج)</span>
                          <span>{cost.toFixed(2)} ج</span>
                        </div>
                      )
                    })}
                    <div className="flex justify-between text-xs text-gray-600 pt-1 border-t border-gray-100">
                      <span>{ar ? 'تغليف' : 'Packaging'}</span><span>{PACKAGING_COST_PER_PIECE.toFixed(2)} {cur}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-200">
                      <span className="text-gray-700">{ar ? 'إجمالي التكلفة' : 'Total Cost'}</span>
                      <span className="text-red-500">{totalCost.toFixed(2)} {cur}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-gray-700">{ar ? 'سعر البيع' : 'Sale Price'}</span>
                      <span className="text-green-600">{salePrice} {cur}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-gray-700">{ar ? 'ربح القطعة' : 'Profit/pc'}</span>
                      <span className={salePrice - totalCost >= 0 ? 'text-jumar-brown' : 'text-red-500'}>{(salePrice - totalCost).toFixed(2)} {cur}</span>
                    </div>
                    {/* علب */}
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <p className="text-xs text-gray-400 mb-1">{ar ? 'هامش ربح العلب:' : 'Box margins:'}</p>
                      <div className="grid grid-cols-3 gap-1">
                        {BOX_SIZES.map(({ label, pieces }) => {
                          const boxSale = pieces === 2 ? 70 : pieces === 5 ? 170 : pieces === 8 ? 260 : pieces === 15 ? 450 : 650
                          const boxCost = totalCost * pieces
                          const boxMargin = boxSale > 0 ? ((boxSale - boxCost) / boxSale * 100) : 0
                          return (
                            <div key={pieces} className="text-center bg-gray-50 rounded-lg p-2">
                              <p className="text-xs text-gray-500">{label}</p>
                              <p className="text-xs font-bold text-jumar-brown">{boxSale}ج</p>
                              <p className={`text-xs font-bold ${boxMargin >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmtPct(boxMargin)}</p>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── دوران المخزون ── */}
        {tab === 'inventory_turn' && (
          <div className="space-y-3">
            <div className="bg-jumar-brown text-white rounded-2xl p-4 grid grid-cols-2 gap-4 text-center">
              <div><p className="text-xs text-white/60 mb-1">{ar ? 'قيمة المخزون الحالي' : 'Current Inventory Value'}</p><p className="text-2xl font-bold text-jumar-gold">{fmt(inventoryValue)} {cur}</p></div>
              <div><p className="text-xs text-white/60 mb-1">{ar ? 'متوسط مبيعات يومي' : 'Daily Sales Avg'}</p><p className="text-2xl font-bold">{fmt(dailySalesAvg)} {cur}</p></div>
            </div>
            <div className="space-y-2">
              {ingredients.map(ing => {
                // كمية يومية مستخدمة بناءً على حركة المخزون
                const daysData = Object.keys(Object.fromEntries(sales.map(s => [s.sale_date, 1]))).length || 1
                // تقدير الاستهلاك اليومي من RECIPES
                let dailyUse = 0
                Object.values(RECIPES).forEach(recipe => {
                  if (recipe[ing.name]) dailyUse += (recipe[ing.name] * totalQtySold) / daysData
                })
                const daysLeft = dailyUse > 0 ? Math.round(ing.stock_grams / dailyUse) : null
                const stockValue = ing.stock_grams * ing.cost_per_gram
                const isLow = ing.stock_grams < ing.min_stock
                const isCritical = daysLeft !== null && daysLeft < 7
                return (
                  <div key={ing.id} className={`bg-white rounded-xl p-4 shadow-sm border-r-4 ${isCritical ? 'border-red-400' : isLow ? 'border-amber-400' : 'border-green-400'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-gray-800">{ing.name}</p>
                        <p className="text-xs text-gray-400">{ing.stock_grams.toLocaleString(ar ? 'ar-EG' : 'en-US')}g · {ing.cost_per_gram.toFixed(2)} {cur}/g</p>
                        <p className="text-xs text-gray-400">{ar ? 'قيمة' : 'Value'}: {fmt(stockValue)} {cur}</p>
                      </div>
                      <div className="text-left">
                        {daysLeft !== null ? (
                          <div className={`text-center px-3 py-1.5 rounded-xl ${isCritical ? 'bg-red-100' : isLow ? 'bg-amber-100' : 'bg-green-100'}`}>
                            <p className={`text-xl font-bold ${isCritical ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-green-600'}`}>{daysLeft}</p>
                            <p className={`text-xs ${isCritical ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-green-500'}`}>{ar ? 'يوم' : 'days'}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">{ar ? 'غير مستخدم' : 'Unused'}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
              ⚠️ {ar ? 'الأرقام تقديرية بناءً على معدل المبيعات الحالي والوصفات المسجلة' : 'Figures are estimated based on current sales rate and recorded recipes'}
            </div>
          </div>
        )}

        {/* ── تحليل القنوات ── */}
        {tab === 'channels' && (
          <div className="space-y-3">
            <div className="bg-jumar-brown text-white rounded-2xl p-4 text-center">
              <p className="text-xs text-white/60 mb-1">{ar ? 'إجمالي الإيرادات' : 'Total Revenue'}</p>
              <p className="text-3xl font-bold text-jumar-gold">{fmt(totalRevenue)} {cur}</p>
            </div>
            {channelEntries.map(([channel, data]) => {
              const pct = totalRevenue > 0 ? (data.revenue / totalRevenue * 100) : 0
              const avg = data.count > 0 ? data.revenue / data.count : 0
              // تقدير الربحية: إيراد - COGS تقديرية
              const estQty = Math.round(data.revenue / (avgSalePrice || 40))
              const estProfit = data.revenue - estQty * (avgCogPerPiece + PACKAGING_COST_PER_PIECE)
              const estMargin = data.revenue > 0 ? (estProfit / data.revenue * 100) : 0
              return (
                <div key={channel} className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex justify-between items-center mb-2">
                    <p className="font-bold text-jumar-brown text-lg">{channel}</p>
                    <p className="text-xl font-bold text-green-600">{fmt(data.revenue)} {cur}</p>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
                    <div className="bg-jumar-gold h-2 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-gray-50 rounded-lg p-3 flex flex-col gap-1"><p className="text-xs text-gray-400 leading-snug">{ar ? 'من الإيرادات' : 'Of Revenue'}</p><p className="text-base font-bold text-gray-700">{fmtPct(pct)}</p></div>
                    <div className="bg-gray-50 rounded-lg p-3 flex flex-col gap-1"><p className="text-xs text-gray-400 leading-snug">{ar ? 'متوسط البيعة' : 'Avg Sale'}</p><p className="text-base font-bold text-gray-700">{fmt(avg)} {cur}</p></div>
                    <div className={`rounded-lg p-3 flex flex-col gap-1 ${estMargin >= 0 ? 'bg-green-50' : 'bg-red-50'}`}><p className="text-xs text-gray-400 leading-snug">{ar ? 'هامش تقديري' : 'Est Margin'}</p><p className={`text-base font-bold ${estMargin >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmtPct(estMargin)}</p></div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── تحليل العملاء ── */}
        {tab === 'customers' && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white rounded-2xl p-3 shadow-sm text-center flex flex-col gap-1"><p className="text-xs text-gray-400 leading-snug">{ar ? 'إجمالي عملاء' : 'Total Customers'}</p><p className="text-xl font-bold text-jumar-brown">{Object.keys(customerOrders).length}</p></div>
              <div className="bg-white rounded-2xl p-3 shadow-sm text-center flex flex-col gap-1"><p className="text-xs text-gray-400 leading-snug">{ar ? 'مكررون' : 'Repeat'}</p><p className="text-xl font-bold text-green-600">{repeatCustomers.length}</p></div>
              <div className="bg-white rounded-2xl p-3 shadow-sm text-center flex flex-col gap-1"><p className="text-xs text-gray-400 leading-snug">{ar ? 'متوسط الطلب' : 'Avg Order'}</p><p className="text-xl font-bold text-jumar-gold">{fmt(avgOrderValue)} {cur}</p></div>
            </div>

            {/* نسبة التكرار */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-sm font-bold text-jumar-brown mb-2">{ar ? 'نسبة العملاء المكررين' : 'Repeat Customer Rate'}</p>
              <div className="w-full bg-gray-100 rounded-full h-3 mb-2">
                <div className="bg-jumar-gold h-3 rounded-full" style={{ width: `${Object.keys(customerOrders).length > 0 ? (repeatCustomers.length / Object.keys(customerOrders).length * 100) : 0}%` }} />
              </div>
              <p className="text-xs text-gray-500">{repeatCustomers.length} {ar ? 'من' : 'of'} {Object.keys(customerOrders).length} {ar ? 'عميل' : 'customers'} ({Object.keys(customerOrders).length > 0 ? fmtPct(repeatCustomers.length / Object.keys(customerOrders).length * 100) : '0%'})</p>
            </div>

            {/* أكثر المناطق */}
            {topAreas.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <p className="text-sm font-bold text-jumar-brown mb-3">📍 {ar ? 'أكثر المناطق طلباً' : 'Top Areas'}</p>
                <div className="space-y-2">
                  {topAreas.map(([area, count]) => (
                    <div key={area} className="flex items-center gap-3">
                      <span className="text-sm text-gray-700 flex-1">{area}</span>
                      <div className="w-20 bg-gray-100 rounded-full h-2">
                        <div className="bg-jumar-brown h-2 rounded-full" style={{ width: `${(count / (topAreas[0]?.[1] || 1)) * 100}%` }} />
                      </div>
                      <span className="text-sm font-bold text-jumar-brown w-6 text-left">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* عملاء مكررون */}
            {repeatCustomers.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100"><p className="font-bold text-jumar-brown">⭐ {ar ? 'عملاء مكررون' : 'Repeat Customers'}</p></div>
                <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                  {repeatCustomers.sort((a,b) => b.count - a.count).slice(0,10).map((c, i) => (
                    <div key={i} className="p-3 flex justify-between items-center">
                      <div><p className="text-sm font-semibold text-gray-800">{c.name}</p><p className="text-xs text-gray-400">{c.area}</p></div>
                      <div className="text-left"><span className="text-jumar-brown font-bold">{c.count} {ar ? 'طلبات' : 'orders'}</span><p className="text-xs text-green-600">{fmt(c.total)} {cur}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ROI البازار ── */}
        {tab === 'bazaar_roi' && (
          <div className="space-y-3">
            {/* بطاقة ROI الرئيسية */}
            <div className={`rounded-2xl p-5 text-center ${bazaarROI !== null && bazaarROI < 0 ? 'bg-red-600' : 'bg-jumar-brown'}`}>
              <p className="text-sm text-white/70 mb-1">{ar ? 'العائد على الاستثمار' : 'Return on Investment'}</p>
              <p className="text-5xl font-bold text-white mb-2">
                {bazaarROI !== null ? `${bazaarROI.toFixed(0)}%` : '—'}
              </p>
              <span className={`text-sm font-bold px-3 py-1 rounded-full ${
                bazaarROI === null ? 'bg-white/20 text-white/70' :
                bazaarROI >= 100 ? 'bg-green-400/30 text-green-100' :
                bazaarROI >= 0 ? 'bg-amber-400/30 text-amber-100' :
                'bg-white/20 text-white'
              }`}>
                {bazaarROI === null ? (ar ? 'لا توجد بيانات' : 'No data') : bazaarROI >= 100 ? (ar ? '✅ مربح جداً' : '✅ Very profitable') : bazaarROI >= 0 ? (ar ? '⚠️ مربح بالكاد' : '⚠️ Barely profitable') : (ar ? '❌ خسارة' : '❌ Loss')}
              </span>
            </div>

            {/* تفاصيل */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {[
                { label: ar ? 'إيراد البازار' : 'Bazaar Revenue', value: fmt(bazaarRevenue) + ' ' + cur, color: 'text-green-600' },
                { label: ar ? 'تكلفة المشاركة' : 'Participation Cost', value: '−' + fmt(bazaarCost) + ' ' + cur, color: 'text-red-500' },
                { label: ar ? 'تكلفة البضاعة (COGS)' : 'COGS (est.)', value: '−' + fmt(bazaarRevenue > 0 ? bazaarRevenue * (totalCOGS / (totalRevenue || 1)) : 0) + ' ' + cur, color: 'text-orange-500' },
              ].map((row, i) => (
                <div key={i} className="flex justify-between items-center px-4 py-3 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-600">{row.label}</span>
                  <span className={`font-bold ${row.color}`}>{row.value}</span>
                </div>
              ))}
              <div className="flex justify-between items-center px-4 py-3 bg-gray-50">
                <span className="font-bold text-gray-800">{ar ? 'صافي ربح البازار' : 'Bazaar Net Profit'}</span>
                <span className={`font-bold text-lg ${bazaarProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {bazaarProfit >= 0 ? '+' : '−'}{fmt(Math.abs(bazaarProfit))} {cur}
                </span>
              </div>
            </div>

            {/* نسبة من الإجمالي */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-xs text-gray-400 mb-1">{ar ? 'البازار من إجمالي الإيرادات' : 'Bazaar share of total revenue'}</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div className="h-2 rounded-full bg-jumar-gold" style={{ width: `${totalRevenue > 0 ? Math.min(100, bazaarRevenue / totalRevenue * 100) : 0}%` }} />
                </div>
                <span className="font-bold text-jumar-brown text-sm w-12 text-left">
                  {totalRevenue > 0 ? fmtPct(bazaarRevenue / totalRevenue * 100) : '—'}
                </span>
              </div>
            </div>

            {bazaarCost === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                {ar ? <>💡 سجّل رسوم البازار في المصروفات تحت فئة <strong>"رسوم بازار"</strong> عشان يتحسب الـ ROI صح</> : <>💡 Record bazaar fees under <strong>"رسوم بازار"</strong> category in expenses to calculate ROI correctly</>}
              </div>
            )}
          </div>
        )}

        {/* ── البازارات السابقة ── */}
        {tab === 'past_bazaars' && (
          <div className="space-y-3">
            <p className="text-xs text-gray-400 px-1">{ar ? 'ROI ونتيجة كل بازار بشكل منفصل' : 'ROI and result per bazaar'}</p>
            {bazaars.map(b => {
              const bSales = sales.filter(s => s.sale_date >= b.start_date && s.sale_date <= b.end_date && s.channel === 'بازار')
              const revenue = bSales.reduce((s, r) => s + Number(r.amount), 0)
              const avgCOGS = (() => {
                const products = Object.entries(RECIPES).filter(([n]) => n !== 'سنيكرز البندق')
                const costs = products.map(([, recipe]) => Object.entries(recipe).reduce((s, [ing, g]) => {
                  const found = ingredients.find(i => i.name === ing)
                  return s + (found ? found.cost_per_gram * g : DEFAULT_INGREDIENTS.find(i => i.name === ing)?.cost_per_gram ?? 0) * g
                }, 0) + PACKAGING_COST_PER_PIECE)
                return costs.length ? costs.reduce((a, x) => a + x, 0) / costs.length : 8.8
              })()
              const estQty = revenue > 0 ? Math.round(revenue / 35) : 0
              const cogs = estQty * avgCOGS
              const netProfit = revenue - b.fixed_cost - cogs
              const roi = b.fixed_cost > 0 ? (netProfit / b.fixed_cost) * 100 : null
              const days = Math.round((new Date(b.end_date).getTime() - new Date(b.start_date).getTime()) / 86400000) + 1
              return (
                <div key={b.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className={`px-4 py-3 flex justify-between items-center ${netProfit >= 0 ? 'bg-jumar-brown' : 'bg-red-600'}`}>
                    <div>
                      <p className="font-bold text-white">{b.name}</p>
                      <p className="text-xs text-white/60">{b.location} · {days} {ar ? 'أيام' : 'days'}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-2xl font-bold text-jumar-gold">{roi !== null ? `${roi.toFixed(0)}%` : '—'}</p>
                      <p className="text-xs text-white/60">ROI</p>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {[
                      { label: ar ? 'الإيراد' : 'Revenue', value: `+${fmt(revenue)} ${cur}`, color: 'text-green-600' },
                      { label: ar ? 'رسوم ثابتة' : 'Fixed Cost', value: `-${fmt(b.fixed_cost)} ${cur}`, color: 'text-red-500' },
                      { label: ar ? 'تكلفة بضاعة (تقديري)' : 'COGS (est.)', value: `-${fmt(cogs)} ${cur}`, color: 'text-orange-500' },
                      { label: ar ? 'صافي الربح' : 'Net Profit', value: `${netProfit >= 0 ? '+' : ''}${fmt(netProfit)} ${cur}`, color: netProfit >= 0 ? 'text-green-600 font-bold' : 'text-red-500 font-bold' },
                    ].map((row, i) => (
                      <div key={i} className="flex justify-between px-4 py-2 text-sm">
                        <span className="text-gray-500">{row.label}</span>
                        <span className={row.color}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                  {b.notes && <p className="text-xs text-gray-400 px-4 py-2 border-t border-gray-100">{b.notes}</p>}
                </div>
              )
            })}
            {bazaars.length === 0 && <p className="text-center text-gray-400 py-8">{ar ? 'لا توجد بازارات مسجلة' : 'No bazaars recorded'}</p>}
          </div>
        )}

        {/* ── التدفق النقدي ── */}
        {tab === 'cashflow' && (
          <div className="space-y-3">
            <div className="bg-jumar-brown text-white rounded-2xl p-4">
              <p className="text-sm text-white/70 mb-1">{ar ? 'المركز النقدي الحالي (تقديري)' : 'Current Cash Position (est.)'}</p>
              <p className={`text-3xl font-bold ${netProfit >= 0 ? 'text-jumar-gold' : 'text-red-300'}`}>{netProfit >= 0 ? '+' : ''}{fmt(netProfit)} {cur}</p>
              <p className="text-xs text-white/50 mt-1">{ar ? 'إيرادات − مصروفات − COGS − هدر' : 'Revenue − Expenses − COGS − Gifts'}</p>
            </div>

            {/* مصاريف ثابتة vs متغيرة */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="font-bold text-jumar-brown mb-3">📊 {ar ? 'تحليل المصروفات' : 'Expense Breakdown'}</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-red-50 rounded-xl p-4 text-center min-h-[80px] flex flex-col justify-center gap-1">
                  <p className="text-xs text-red-600 leading-snug">{ar ? 'مصاريف ثابتة' : 'Fixed Expenses'}</p>
                  <p className="text-xl font-bold text-red-600">{fmt(fixedExpenses)} {cur}</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-4 text-center min-h-[80px] flex flex-col justify-center gap-1">
                  <p className="text-xs text-orange-600 leading-snug">{ar ? 'مصاريف متغيرة' : 'Variable Expenses'}</p>
                  <p className="text-xl font-bold text-orange-600">{fmt(totalOpex - fixedExpenses)} {cur}</p>
                </div>
              </div>
              <div className="space-y-1">
                {EXPENSE_CATEGORIES.map(cat => {
                  const total = expenses.filter(e => e.category === cat).reduce((s, e) => s + Number(e.amount), 0)
                  if (!total) return null
                  const pct = totalOpex > 0 ? (total / totalOpex * 100) : 0
                  const isFixed = FIXED_EXPENSE_CATEGORIES.includes(cat)
                  return (
                    <div key={cat} className="flex items-center gap-2">
                      <span className="text-xs text-gray-600 w-20 flex-shrink-0">{cat}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${isFixed ? 'bg-red-400' : 'bg-orange-400'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-bold text-gray-700 w-16 text-left">{fmt(total)} {cur}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* معدل حرق الكاش */}
            {cashBurnMonths !== null && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <p className="text-sm font-bold text-red-700 mb-1">🔥 {ar ? 'معدل حرق الكاش' : 'Cash Burn Rate'}</p>
                <p className="text-2xl font-bold text-red-600">{cashBurnMonths.toFixed(1)} {ar ? 'شهر' : 'months'}</p>
                <p className="text-xs text-red-500">{ar ? 'يكفي الكاش الحالي للمصاريف الثابتة لو توقفت المبيعات' : 'Current cash covers fixed expenses if sales stop'}</p>
              </div>
            )}
            {cashBurnMonths === null && netProfit >= 0 && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
                <p className="text-green-700 font-bold">✅ {ar ? 'المشروع يغطي مصاريفه' : 'Business covers its expenses'}</p>
                <p className="text-xs text-green-600 mt-1">{ar ? 'مفيش حرق كاش' : 'No cash burn'}</p>
              </div>
            )}
          </div>
        )}

        {/* ── تسجيل بيعة ── */}
        {tab === 'sales' && (
          <>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h2 className="font-bold text-jumar-brown mb-3">➕ {ar ? 'تسجيل بيعة جديدة' : 'Record New Sale'}</h2>
              <form onSubmit={saveSale} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-gray-500 block mb-1">{ar ? 'التاريخ' : 'Date'}</label><input type="date" required value={saleForm.sale_date} onChange={e => setSaleForm({...saleForm, sale_date: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold" /></div>
                  <div><label className="text-xs text-gray-500 block mb-1">{ar ? 'القناة' : 'Channel'}</label><select value={saleForm.channel} onChange={e => setSaleForm({...saleForm, channel: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold">{CHANNELS.map(c => <option key={c}>{c}</option>)}</select></div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">{ar ? 'الكميات (اختياري)' : 'Quantities (optional)'}</label>
                  <div className="grid grid-cols-5 gap-1 text-center text-xs">
                    {[['qty_tamriya','ت'],['qty_fudge','ف'],['qty_sultana','س'],['qty_snickers_fool','سف'],['qty_snickers_bunduq','سب']].map(([key, label]) => (
                      <div key={key}><p className="text-gray-400 mb-1">{label}</p><input type="number" min="0" value={(saleForm as any)[key]} onChange={e => setSaleForm({...saleForm, [key]: Number(e.target.value)})} className="w-full border border-gray-200 rounded-lg px-1 py-1.5 text-center text-sm focus:outline-none focus:border-jumar-gold" /></div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-gray-500 block mb-1">{ar ? 'المبلغ (ج) *' : 'Amount (EGP) *'}</label><input type="number" required min="1" placeholder="0" value={saleForm.amount} onChange={e => setSaleForm({...saleForm, amount: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold" /></div>
                  <div><label className="text-xs text-gray-500 block mb-1">{ar ? 'نوع العميل' : 'Customer Type'}</label><select value={saleForm.customer_type} onChange={e => setSaleForm({...saleForm, customer_type: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold">{['غريب','قريب/معرفة','متنوع','غير محدد'].map(c => <option key={c}>{c}</option>)}</select></div>
                </div>
                <input placeholder={ar ? 'وصف الصنف' : 'Item description'} value={saleForm.items_desc} onChange={e => setSaleForm({...saleForm, items_desc: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold" />
                {msg && <p className={`text-sm text-center ${msg.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>{msg}</p>}
                <button type="submit" disabled={saving} className="w-full bg-jumar-brown text-white font-bold py-3 rounded-xl hover:opacity-90 disabled:opacity-50">{saving ? (ar ? 'جارٍ الحفظ...' : 'Saving...') : (ar ? '💾 سجّل البيعة' : '💾 Save Sale')}</button>
              </form>
            </div>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex justify-between items-center"><h2 className="font-bold text-jumar-brown">📋 {ar ? `سجل المبيعات (${sales.length})` : `Sales Log (${sales.length})`}</h2><span className="text-green-600 font-bold text-sm">{fmt(sales.reduce((s, r) => s + Number(r.amount), 0))} {cur}</span></div>
              <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
                {sales.map(s => (
                  <div key={s.id} className="p-3 flex justify-between items-start">
                    <div className="text-right"><div className="flex items-center gap-2"><span className="text-xs bg-jumar-gold/20 text-jumar-brown px-2 py-0.5 rounded-full">{s.channel}</span><span className="text-xs text-gray-400">{s.sale_date}</span></div>{s.items_desc && <p className="text-xs text-gray-500 mt-0.5">{s.items_desc}</p>}</div>
                    <span className="font-bold text-green-600 text-sm whitespace-nowrap mr-2">{fmt(Number(s.amount))} {cur}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── تسجيل مصروف ── */}
        {tab === 'expenses' && (
          <>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h2 className="font-bold text-jumar-brown mb-3">➕ {ar ? 'تسجيل مصروف جديد' : 'Record New Expense'}</h2>
              <form onSubmit={saveExpense} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-gray-500 block mb-1">{ar ? 'التاريخ' : 'Date'}</label><input type="date" required value={expenseForm.expense_date} onChange={e => setExpenseForm({...expenseForm, expense_date: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold" /></div>
                  <div><label className="text-xs text-gray-500 block mb-1">{ar ? 'الفئة' : 'Category'}</label><select value={expenseForm.category} onChange={e => setExpenseForm({...expenseForm, category: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold">{EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
                </div>
                <input required placeholder={ar ? 'الوصف *' : 'Description *'} value={expenseForm.description} onChange={e => setExpenseForm({...expenseForm, description: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold" />
                <input type="number" required min="1" placeholder={ar ? 'المبلغ (ج) *' : 'Amount (EGP) *'} value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold" />
                <input placeholder={ar ? 'ملاحظات' : 'Notes'} value={expenseForm.notes} onChange={e => setExpenseForm({...expenseForm, notes: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold" />
                {msg && <p className={`text-sm text-center ${msg.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>{msg}</p>}
                <button type="submit" disabled={saving} className="w-full bg-jumar-brown text-white font-bold py-3 rounded-xl hover:opacity-90 disabled:opacity-50">{saving ? (ar ? 'جارٍ الحفظ...' : 'Saving...') : (ar ? '💾 سجّل المصروف' : '💾 Save Expense')}</button>
              </form>
            </div>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100"><h2 className="font-bold text-jumar-brown">📊 {ar ? 'حسب الفئة' : 'By Category'}</h2></div>
              <div className="divide-y divide-gray-50">
                {EXPENSE_CATEGORIES.map(cat => {
                  const total = expenses.filter(e => e.category === cat).reduce((s, e) => s + Number(e.amount), 0)
                  if (!total) return null
                  const pct = totalOpex > 0 ? (total / totalOpex * 100).toFixed(1) : '0'
                  return (
                    <div key={cat} className="p-3 flex justify-between items-center">
                      <div className="flex items-center gap-2 flex-1"><span className="text-sm text-gray-700">{cat}</span><div className="flex-1 bg-gray-100 rounded-full h-1.5 mx-2"><div className="bg-jumar-gold h-1.5 rounded-full" style={{ width: `${pct}%` }} /></div><span className="text-xs text-gray-400">{pct}%</span></div>
                      <span className="font-bold text-red-500 text-sm mr-3">{fmt(total)} ج</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// BAZAAR TAB
// ══════════════════════════════════════════════════════════════════════════════
function BazaarTab({ lang }: { lang: Lang }) {
  const ar = lang === 'ar'
  const [today, setToday] = useState(BAZAAR_DATES[0])
  const [todayTotal, setTodayTotal] = useState(0)
  const [todayCount, setTodayCount] = useState(0)
  const [todaySold, setTodaySold] = useState(0)
  const [todayGifts, setTodayGifts] = useState(0)
  const [grandTotal, setGrandTotal] = useState(0)
  const [grandSold, setGrandSold] = useState(0)
  const [grandGifts, setGrandGifts] = useState(0)
  const [daySummaries, setDaySummaries] = useState<DaySummary[]>([])
  const [lastSale, setLastSale] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastSaleId, setLastSaleId] = useState<string | null>(null)
  const [todaySales, setTodaySales] = useState<{ id: string; items_desc: string; amount: number; created_at: string }[]>([])

  useEffect(() => {
    const now = new Date().toISOString().split('T')[0]
    const nearest = BAZAAR_DATES.find(d => d >= now) || BAZAAR_DATES[2]
    setToday(nearest); loadSummary(nearest)
  }, [])

  async function loadSummary(activeDay?: string) {
    const cur = activeDay || today
    const { data: salesRows } = await supabase.from('sales').select('id, items_desc, amount, created_at').eq('channel', 'بازار').eq('sale_date', cur).order('created_at', { ascending: false })
    setTodaySales(salesRows || [])
    const { data } = await supabase.from('sales').select('sale_date, amount, notes').eq('channel', 'بازار').in('sale_date', BAZAAR_DATES)
    if (!data) return
    function parseQty(notes: string) {
      const qm = notes.match(/qty:(\d+)/), gm = notes.match(/gift:(\d+)/)
      return { sold: qm ? parseInt(qm[1]) : 0, gift: gm ? parseInt(gm[1]) : 0 }
    }
    const summaries = BAZAAR_DATES.map(date => {
      const rows = data.filter(r => r.sale_date === date)
      let soldQty = 0, giftQty = 0
      rows.forEach(r => { const p = parseQty(r.notes || ''); soldQty += p.sold; giftQty += p.gift })
      return { date, total: rows.reduce((s, r) => s + Number(r.amount), 0), count: rows.length, soldQty, giftQty }
    })
    setDaySummaries(summaries)
    const todayData = summaries.find(s => s.date === cur)
    setTodayTotal(todayData?.total || 0); setTodayCount(todayData?.count || 0)
    setTodaySold(todayData?.soldQty || 0); setTodayGifts(todayData?.giftQty || 0)
    setGrandTotal(summaries.reduce((s, r) => s + r.total, 0))
    setGrandSold(summaries.reduce((s, r) => s + r.soldQty, 0))
    setGrandGifts(summaries.reduce((s, r) => s + r.giftQty, 0))
  }

  function switchDay(date: string) {
    setToday(date)
    const s = daySummaries.find(d => d.date === date)
    if (s) { setTodayTotal(s.total); setTodayCount(s.count); setTodaySold(s.soldQty); setTodayGifts(s.giftQty) }
    loadSummary(date)
  }

  async function recordSale(item: typeof BAZAAR_ITEMS[0]) {
    setLoading(true)
    const desc = item.gift > 0 ? `${item.label} +${item.gift} هدية` : item.label
    const { data } = await supabase.from('sales').insert({
      sale_date: today, channel: 'بازار', items_desc: desc, total_qty: item.qty + item.gift,
      amount: item.price, customer_type: 'غريب', notes: `qty:${item.qty}|gift:${item.gift}|بازار لوتس أكتوبر 2026`,
    }).select('id').single()
    if (data?.id) setLastSaleId(String(data.id))
    setLastSale(`${item.label} — ${item.price}${ar ? 'ج' : ' EGP'} ✅`)
    await loadSummary(); setLoading(false)
    setTimeout(() => { setLastSale(null); setLastSaleId(null) }, 8000)
  }

  const cur = ar ? 'ج' : 'EGP'
  const fmt = (n: number) => n.toLocaleString(ar ? 'ar-EG' : 'en-US')
  return (
    <div className="max-w-lg mx-auto p-4 space-y-4" dir={ar ? 'rtl' : 'ltr'}>
      <div className="flex items-center justify-between"><h2 className="text-xl font-bold text-jumar-brown">🏪 {ar ? 'بازار لوتس' : 'Lotus Bazaar'}</h2><p className="text-xs text-gray-400">{ar ? '٢٢-٢٤ أكتوبر ٢٠٢٦' : '22-24 Oct 2026'}</p></div>
      <div className="grid grid-cols-3 gap-2">
        {BAZAAR_DATES.map(date => (
          <button key={date} onClick={() => switchDay(date)} className={`py-2 rounded-xl text-sm font-bold transition-all ${today === date ? 'bg-jumar-brown text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>{dayLabel(date)}</button>
        ))}
      </div>
      <div className="bg-jumar-brown text-white rounded-2xl p-4">
        <div className="flex justify-between items-start mb-3">
          <div><p className="text-xs text-white/60 mb-1">{dayLabel(today)} — {ar ? 'إيرادات' : 'Revenue'}</p><p className="text-3xl font-bold text-jumar-gold">{fmt(todayTotal)} {cur}</p></div>
          <div className={ar ? 'text-left' : 'text-right'}><p className="text-xs text-white/60 mb-1">{ar ? 'إجمالي البازار' : 'Bazaar Total'}</p><p className="text-xl font-bold">{fmt(grandTotal)} {cur}</p></div>
        </div>
        <div className="flex gap-4 border-t border-white/20 pt-3">
          <div className="text-center flex-1"><p className="text-2xl font-bold text-jumar-gold">{todaySold}</p><p className="text-xs text-white/60">{ar ? 'مباع اليوم' : "Today's Sold"}</p></div>
          <div className="text-center flex-1"><p className="text-2xl font-bold text-white/80">{todayGifts}</p><p className="text-xs text-white/60">{ar ? 'هدايا اليوم' : "Today's Gifts"}</p></div>
          <div className="text-center flex-1"><p className="text-2xl font-bold text-jumar-gold">{grandSold}</p><p className="text-xs text-white/60">{ar ? 'إجمالي مباع' : 'Total Sold'}</p></div>
          <div className="text-center flex-1"><p className="text-2xl font-bold text-white/80">{grandGifts}</p><p className="text-xs text-white/60">{ar ? 'إجمالي هدايا' : 'Total Gifts'}</p></div>
        </div>
      </div>
      {lastSale && (
        <div className="bg-green-100 text-green-700 rounded-xl p-3 flex items-center justify-between gap-2">
          <span className="font-bold text-sm">{lastSale}</span>
          {lastSaleId && <button onClick={async () => { await supabase.from('sales').delete().eq('id', lastSaleId); setLastSale(null); setLastSaleId(null); await loadSummary() }} className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-lg hover:bg-red-600 active:scale-95 transition-all whitespace-nowrap">↩ {ar ? 'تراجع' : 'Undo'}</button>}
        </div>
      )}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h2 className="font-bold text-jumar-brown mb-3 text-center">{ar ? 'اضغط للتسجيل الفوري' : 'Tap to Record Sale'}</h2>
        <div className="grid grid-cols-2 gap-3">
          {BAZAAR_ITEMS.map((item, i) => (
            <button key={i} onClick={() => recordSale(item)} disabled={loading} className="bg-jumar-cream border-2 border-jumar-gold/30 hover:border-jumar-gold hover:bg-jumar-gold/10 active:scale-95 transition-all rounded-2xl p-4 text-center disabled:opacity-50">
              <p className="text-lg font-bold text-jumar-brown">{item.label}</p>
              {item.gift > 0 && <p className="text-xs text-jumar-gold">+{item.gift} {ar ? 'هدية' : 'gift'}</p>}
              <p className="text-2xl font-bold text-jumar-gold mt-1">{item.price}</p>
              <p className="text-xs text-gray-400">{ar ? 'جنيه' : 'EGP'}</p>
            </button>
          ))}
        </div>
      </div>
      {/* سجل مبيعات اليوم مع زر مسح */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-jumar-brown">🧾 {ar ? `مبيعات ${dayLabel(today)}` : `${dayLabel(today)} Sales`}</h2>
          <span className="text-xs text-gray-400">{todaySales.length} {ar ? 'بيعة' : 'sales'}</span>
        </div>
        {todaySales.length === 0 ? (
          <p className="text-center text-gray-300 text-sm py-6">{ar ? 'لا مبيعات بعد' : 'No sales yet'}</p>
        ) : (
          <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
            {todaySales.map(s => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3 gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate">{s.items_desc}</p>
                  <p className="text-xs text-gray-400">{new Date(s.created_at).toLocaleTimeString(ar ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-bold text-jumar-brown text-sm">{s.amount} {ar ? 'ج' : 'EGP'}</span>
                  <button
                    onClick={async () => {
                      if (!confirm(ar ? 'مسح البيعة دي؟' : 'Delete this sale?')) return
                      await supabase.from('sales').delete().eq('id', s.id)
                      await loadSummary()
                    }}
                    className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg p-1.5 transition-all"
                    title={ar ? 'مسح' : 'Delete'}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100"><h2 className="font-bold text-jumar-brown">📊 {ar ? 'ملخص الأيام' : 'Day Summary'}</h2></div>
        <div className="divide-y divide-gray-50">
          {daySummaries.map(s => (
            <div key={s.date} className="p-3">
              <div className="flex justify-between items-center mb-1"><p className="font-semibold text-gray-700">{dayLabel(s.date)}</p><p className={`font-bold text-lg ${s.total > 0 ? 'text-green-600' : 'text-gray-300'}`}>{s.total > 0 ? `${fmt(s.total)} ${cur}` : '—'}</p></div>
              {s.total > 0 && <div className="flex gap-3 text-xs text-gray-500"><span>{ar ? 'مباع' : 'Sold'}: <span className="font-bold text-jumar-brown">{s.soldQty}</span></span><span>{ar ? 'هدايا' : 'Gifts'}: <span className="font-bold text-gray-400">{s.giftQty}</span></span><span>{ar ? 'بيعات' : 'Sales'}: <span className="font-bold">{s.count}</span></span></div>}
            </div>
          ))}
          <div className="p-3 bg-jumar-cream">
            <div className="flex justify-between items-center mb-1"><p className="font-bold text-jumar-brown">{ar ? 'الإجمالي' : 'Total'}</p><p className="font-bold text-xl text-jumar-brown">{fmt(grandTotal)} {cur}</p></div>
            <div className="flex gap-3 text-xs text-gray-500"><span>{ar ? 'مباع' : 'Sold'}: <span className="font-bold text-jumar-brown">{grandSold}</span></span><span>{ar ? 'هدايا' : 'Gifts'}: <span className="font-bold">{grandGifts}</span></span></div>
          </div>
        </div>
      </div>
      {(() => {
        // حساب متوسط تكلفة القطعة من الوصفات والأسعار
        // متوسط تكلفة القطعة = خامات + تغليف (بدون سنيكرز البندق)
        const avgCostPerPiece = (() => {
          const bazaarProducts = Object.entries(RECIPES).filter(([name]) => name !== 'سنيكرز البندق')
          const costs = bazaarProducts.map(([, recipe]) =>
            Object.entries(recipe).reduce((sum, [ing, grams]) => {
              const found = DEFAULT_INGREDIENTS.find(i => i.name === ing)
              return sum + (found ? found.cost_per_gram * grams : 0)
            }, 0) + PACKAGING_COST_PER_PIECE
          )
          return costs.reduce((a, b) => a + b, 0) / costs.length
        })()
        // متوسط سعر البيع من BAZAAR_ITEMS (weighted by qty)
        const totalQty = BAZAAR_ITEMS.reduce((s, i) => s + i.qty, 0)
        const avgSalePrice = BAZAAR_ITEMS.reduce((s, i) => s + (i.price / Math.max(i.qty,1)) * i.qty, 0) / totalQty
        const margin = avgSalePrice - avgCostPerPiece
        const BAZAAR_FIXED = 3650  // رسوم البازار فقط (الخامات والتغليف variable)
        const breakEven = margin > 0 ? Math.ceil(BAZAAR_FIXED / margin) : 0
        const perDay = Math.ceil(breakEven / 3)
        const pct = breakEven > 0 ? Math.min(100, Math.round(grandSold / breakEven * 100)) : 0
        return (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center">
            <p className="text-sm text-amber-800 font-semibold">🎯 {ar ? `الهدف: ${breakEven} قطعة (${perDay}/يوم) للـ break-even` : `Goal: ${breakEven} pcs (${perDay}/day) to break-even`}</p>
            <p className="text-xs text-amber-600 mt-1">{ar ? `وصلت: ${grandSold} من ${breakEven} (${pct}%)` : `Reached: ${grandSold} of ${breakEven} (${pct}%)`}</p>
            <p className="text-xs text-amber-500 mt-0.5">{ar ? `هامش/قطعة: ${margin.toFixed(1)} ج · رسوم البازار: ${BAZAAR_FIXED} ج` : `Margin/pc: ${margin.toFixed(1)} EGP · Fixed: ${BAZAAR_FIXED} EGP`}</p>
          </div>
        )
      })()}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ANALYTICS TAB  (أكثر المنتجات مبيعاً + معدل التحويل)
// ══════════════════════════════════════════════════════════════════════════════
function AnalyticsTab({ lang }: { lang: Lang }) {
  const ar = lang === 'ar'
  const [sales, setSales] = useState<Sale[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: s }, { data: o }] = await Promise.all([
        supabase.from('sales').select('*').order('sale_date', { ascending: false }),
        supabase.from('orders').select('id, status, created_at, order_items(product_name, quantity)').order('created_at', { ascending: false }),
      ])
      setSales(s || [])
      setOrders((o || []) as unknown as Order[])
      setLoading(false)
    }
    load()
  }, [])

  const cur = ar ? 'ج' : 'EGP'
  const fmt = (n: number) => n.toLocaleString(ar ? 'ar-EG' : 'en-US')

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">{ar ? 'جارٍ التحميل...' : 'Loading...'}</div>

  // أكثر المنتجات مبيعاً من order_items
  const productCount: Record<string, number> = {}
  orders.forEach(o => {
    o.order_items?.forEach((item: any) => {
      productCount[item.product_name] = (productCount[item.product_name] || 0) + item.quantity
    })
  })
  const topProducts = Object.entries(productCount).sort(([,a],[,b]) => b - a)
  const maxProd = topProducts[0]?.[1] || 1

  // مبيعات من qty columns في sales
  const flavorSales: Record<string, number> = {
    'تمرية الطحينة': sales.reduce((s, r) => s + (r.qty_tamriya || 0), 0),
    'فدج الكاجو':    sales.reduce((s, r) => s + (r.qty_fudge || 0), 0),
    'سلطانة الفستق': sales.reduce((s, r) => s + (r.qty_sultana || 0), 0),
    'سنيكرز فول':    sales.reduce((s, r) => s + (r.qty_snickers_fool || 0), 0),
    'سنيكرز بندق':   sales.reduce((s, r) => s + (r.qty_snickers_bunduq || 0), 0),
  }
  const flavorEntries = Object.entries(flavorSales).filter(([,v]) => v > 0).sort(([,a],[,b]) => b - a)
  const maxFlavor = flavorEntries[0]?.[1] || 1

  // معدل التحويل
  const total = orders.length
  const delivered = orders.filter(o => o.status === 'delivered').length
  const cancelled = orders.filter(o => o.status === 'cancelled').length
  const pending = total - delivered - cancelled
  const conversionRate = total > 0 ? Math.round((delivered / total) * 100) : 0

  // قناة المبيعات
  const byChannel: Record<string, number> = {}
  sales.forEach(s => { byChannel[s.channel] = (byChannel[s.channel] || 0) + Number(s.amount) })
  const channelEntries = Object.entries(byChannel).sort(([,a],[,b]) => b - a)
  const totalRevenue = channelEntries.reduce((s, [,v]) => s + v, 0)

  // تحليل يومي: متوسط البيع
  const byDate: Record<string, number> = {}
  sales.forEach(r => { byDate[r.sale_date] = (byDate[r.sale_date] || 0) + Number(r.amount) })
  const dailyAvg = Object.keys(byDate).length > 0 ? Math.round(Object.values(byDate).reduce((s,v) => s+v, 0) / Object.keys(byDate).length) : 0

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4" dir={ar ? 'rtl' : 'ltr'}>
      <h2 className="text-xl font-bold text-jumar-brown">📊 {ar ? 'التحليلات' : 'Analytics'}</h2>

      {/* معدل التحويل */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h3 className="font-bold text-jumar-brown mb-3">🎯 {ar ? 'معدل التحويل (الطلبات الأونلاين)' : 'Conversion Rate (Online Orders)'}</h3>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center bg-gray-50 rounded-xl p-3"><p className="text-2xl font-bold text-jumar-brown">{total}</p><p className="text-xs text-gray-500">{ar ? 'إجمالي الطلبات' : 'Total Orders'}</p></div>
          <div className="text-center bg-green-50 rounded-xl p-3"><p className="text-2xl font-bold text-green-600">{delivered}</p><p className="text-xs text-gray-500">{ar ? 'تم توصيله' : 'Delivered'}</p></div>
          <div className="text-center bg-red-50 rounded-xl p-3"><p className="text-2xl font-bold text-red-500">{cancelled}</p><p className="text-xs text-gray-500">{ar ? 'ملغي' : 'Cancelled'}</p></div>
        </div>
        <div className="bg-jumar-cream rounded-xl p-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-jumar-brown">{ar ? 'معدل الإتمام' : 'Completion Rate'}</span>
            <span className="text-2xl font-bold text-jumar-brown">{conversionRate}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div className="bg-jumar-gold h-3 rounded-full transition-all" style={{ width: `${conversionRate}%` }} />
          </div>
          {pending > 0 && <p className="text-xs text-amber-600 mt-2">⏳ {pending} {ar ? 'طلب لسه قيد التنفيذ' : 'orders still pending'}</p>}
        </div>
      </div>

      {/* أكثر المنتجات مبيعاً (من الطلبات) */}
      {topProducts.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h3 className="font-bold text-jumar-brown mb-3">🏆 {ar ? 'أكثر المنتجات مبيعاً (طلبات أونلاين)' : 'Top Products (Online Orders)'}</h3>
          <div className="space-y-2">
            {topProducts.map(([name, count], i) => (
              <div key={name} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                <span className="text-sm text-gray-700 flex-1 min-w-0 truncate">{name}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-gray-100 rounded-full h-2">
                    <div className="bg-jumar-gold h-2 rounded-full" style={{ width: `${(count / maxProd) * 100}%` }} />
                  </div>
                  <span className="text-sm font-bold text-jumar-brown w-8 text-left">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* أكثر الفلايفر مبيعاً (من البيعات اليدوية) */}
      {flavorEntries.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h3 className="font-bold text-jumar-brown mb-3">🌟 {ar ? 'الفلايفر الأكثر مبيعاً (كل القنوات)' : 'Best-Selling Flavors (All Channels)'}</h3>
          <div className="space-y-2">
            {flavorEntries.map(([name, count], i) => (
              <div key={name} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-4">{i + 1}</span>
                <span className="text-sm text-gray-700 flex-1">{name}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-gray-100 rounded-full h-2"><div className="bg-jumar-brown h-2 rounded-full" style={{ width: `${(count / maxFlavor) * 100}%` }} /></div>
                  <span className="text-sm font-bold text-jumar-brown w-8 text-left">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* قنوات المبيعات */}
      {channelEntries.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h3 className="font-bold text-jumar-brown mb-3">📡 {ar ? 'الإيرادات حسب القناة' : 'Revenue by Channel'}</h3>
          <div className="space-y-2">
            {channelEntries.map(([channel, amount]) => (
              <div key={channel} className="flex items-center gap-3">
                <span className="text-sm text-gray-700 flex-1">{channel}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-gray-100 rounded-full h-2"><div className="bg-jumar-gold h-2 rounded-full" style={{ width: `${(amount / totalRevenue) * 100}%` }} /></div>
                  <span className="text-sm font-bold text-green-600 w-16 text-left">{fmt(amount)} {cur}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* متوسط اليومي */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-jumar-brown text-white rounded-2xl p-4 text-center">
          <p className="text-xs text-white/60 mb-1">{ar ? 'متوسط المبيعات اليومي' : 'Daily Sales Avg'}</p>
          <p className="text-2xl font-bold text-jumar-gold">{fmt(dailyAvg)} {cur}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
          <p className="text-xs text-gray-500 mb-1">{ar ? 'أيام نشاط مسجلة' : 'Recorded Active Days'}</p>
          <p className="text-2xl font-bold text-jumar-brown">{Object.keys(byDate).length}</p>
        </div>
      </div>
    </div>
  )
}
