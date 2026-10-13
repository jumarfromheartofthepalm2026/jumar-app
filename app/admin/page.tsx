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
  'تمرية الطحينة': { 'تمر مجدول': 13, 'طحينة': 6, 'سمسم': 3 },
  'سلطانة الفستق':  { 'تمر مجدول': 16, 'فستق': 5, 'جوز هند': 1 },
  'فدج الكاجو':     { 'تمر مجدول': 14, 'كاجو': 6, 'زبدة': 2 },
  'سنيكرز الفول':   { 'تمر عادي': 12, 'فول سوداني': 6, 'شوكولاتة دارك': 4 },
  'سنيكرز البندق':  { 'تمر عادي': 12, 'بندق': 6, 'شوكولاتة دارك': 4 },
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
  { name: 'تمر مجدول', min_stock: 500, cost_per_gram: 0.221 },
  { name: 'تمر عادي', min_stock: 500, cost_per_gram: 0.139 },
  { name: 'كاجو', min_stock: 200, cost_per_gram: 0.9 },
  { name: 'فستق', min_stock: 200, cost_per_gram: 1.347 },
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
  new:       'تم استلام طلبك ✅ — جُمار 🌿 شكراً لثقتك فينا!',
  preparing: 'طلبك دلوقتي بيتجهز 👩‍🍳 — جُمار 🌿',
  ready:     'طلبك جاهز ✅ وهيتبعت قريباً — جُمار 🌿',
  shipped:   'طلبك اتشحن 🚚 وفي الطريق إليك — جُمار 🌿',
  delivered: 'تم التوصيل بنجاح 🎉 نتمنى تستمتع بجُمار! شاركنا رأيك 💛',
  cancelled: 'تم إلغاء طلبك — جُمار 🌿 لأي استفسار تواصل معنا.',
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [activeTab, setActiveTab] = useState<'orders'|'inventory'|'finance'|'bazaar'|'analytics'>('orders')

  function login() {
    if (password === ADMIN_PASSWORD) setAuthed(true)
    else alert('كلمة السر غلط')
  }

  if (!authed) return (
    <div className="min-h-screen flex items-center justify-center bg-jumar-cream p-6" dir="rtl">
      <div className="bg-white rounded-2xl p-8 shadow-lg w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold text-jumar-brown mb-2">🌿 جُمار</h1>
        <p className="text-sm text-gray-400 mb-6">لوحة التحكم</p>
        <input type="password" placeholder="كلمة السر" value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && login()}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-center mb-4 focus:outline-none focus:border-jumar-gold" />
        <button onClick={login} className="w-full bg-jumar-brown text-white font-bold py-3 rounded-xl hover:opacity-90">دخول</button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" dir="rtl">
      <div className="bg-jumar-brown text-white px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <h1 className="text-lg font-bold">🌿 جُمار — لوحة التحكم</h1>
        <span className="text-xs text-white/50">admin</span>
      </div>

      <div className="flex-1 overflow-y-auto pb-20">
        {activeTab === 'orders'    && <OrdersTab />}
        {activeTab === 'inventory' && <InventoryTab />}
        {activeTab === 'finance'   && <FinanceTab />}
        {activeTab === 'bazaar'    && <BazaarTab />}
        {activeTab === 'analytics' && <AnalyticsTab />}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20 flex">
        {([
          { key: 'orders',    icon: '📋', label: 'الطلبات' },
          { key: 'inventory', icon: '📦', label: 'المخزون' },
          { key: 'finance',   icon: '💰', label: 'الماليات' },
          { key: 'bazaar',    icon: '🏪', label: 'البازار' },
          { key: 'analytics', icon: '📊', label: 'تحليلات' },
        ] as const).map(t => (
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
function OrdersTab() {
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
    new: orders.filter(o => o.status === 'new').length,
    preparing: orders.filter(o => o.status === 'preparing').length,
    ready: orders.filter(o => o.status === 'ready').length,
    shipped: orders.filter(o => o.status === 'shipped').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white rounded-xl p-3 shadow-sm text-center"><div className="text-xl font-bold text-blue-600">{counts.new}</div><div className="text-xs text-gray-500">جديد</div></div>
        <div className="bg-white rounded-xl p-3 shadow-sm text-center"><div className="text-xl font-bold text-yellow-600">{counts.preparing}</div><div className="text-xs text-gray-500">قيد التحضير</div></div>
        <div className="bg-white rounded-xl p-3 shadow-sm text-center"><div className="text-xl font-bold text-green-600">{counts.delivered}</div><div className="text-xs text-gray-500">تم التوصيل</div></div>
      </div>

      {sales && (
        <div className="mb-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-jumar-brown text-white rounded-xl p-4"><p className="text-xs text-white/60 mb-1">إجمالي الإيرادات</p><p className="text-xl font-bold text-jumar-gold">{sales.totalRevenue.toLocaleString('ar-EG')} ج</p></div>
            <div className="bg-white rounded-xl p-4 shadow-sm"><p className="text-xs text-gray-400 mb-1">اليوم</p><p className="text-xl font-bold text-green-600">{sales.todayRevenue.toLocaleString('ar-EG')} ج</p></div>
          </div>
          {sales.dailyData.length > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-sm">
              <p className="text-xs font-bold text-gray-500 mb-3">آخر {sales.dailyData.length} أيام</p>
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
        {(['all', 'new', 'preparing', 'ready', 'shipped', 'delivered', 'cancelled'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all ${filter === s ? 'bg-jumar-brown text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            {s === 'all' ? `الكل (${counts.all})` : `${STATUS_LABELS[s]} (${counts[s]})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10 text-gray-400">مفيش طلبات</div>
      ) : (
        <div className="space-y-4">
          {filtered.map(order => (
            <div key={order.id} className="bg-white rounded-2xl p-5 shadow-sm">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-bold text-jumar-brown text-lg">{order.customers?.name}</p>
                  <p className="text-sm text-gray-500">{order.customers?.phone} | {order.customers?.area}</p>
                  {order.customers?.address && <p className="text-xs text-gray-400 mt-0.5">📍 {order.customers.address}</p>}
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(order.created_at).toLocaleString('ar-EG')}</p>
                </div>
                <div className="text-left">
                  <p className="font-bold text-jumar-brown">{order.total_price} ج</p>
                  <p className="text-xs text-gray-500">{order.box_qty} قطعة</p>
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

              {/* أزرار التواصل */}
              <div className="flex gap-2 flex-wrap">
                <a href={`https://wa.me/2${(order.customers?.whatsapp || order.customers?.phone || '').replace(/\D/g,'')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-green-50 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                  📲 واتساب العميل
                </a>
                <a href={deliveryLink(order)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full">
                  🚚 إرسال للمندوب
                </a>
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
function InventoryTab() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'stock'|'boxes'|'calculator'|'add'|'use'|'history'>('stock')
  const [seeding, setSeeding] = useState(false)
  const [addForm, setAddForm] = useState({ ingredient_id: '', grams: '', cost: '', note: '' })
  const [useForm, setUseForm] = useState({ ingredient_id: '', grams: '', note: '' })
  const [adjustForm, setAdjustForm] = useState({ ingredient_id: '', grams: '', note: '' })
  const [msg, setMsg] = useState('')

  // علب جاهزة — عدد لكل حجم فقط
  const [readyBoxes, setReadyBoxes] = useState<Record<number, number>>({})
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
    const { data } = await supabase.from('ready_boxes').select('*')
    if (!data) return
    const map: Record<number, number> = {}
    data.forEach((r: any) => { map[r.box_size] = (map[r.box_size] || 0) + r.qty })
    setReadyBoxes(map)
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

  async function updateBoxQty(size: number, delta: number) {
    const cur = readyBoxes[size] || 0
    const newQty = Math.max(0, cur + delta)
    await supabase.from('ready_boxes').update({ qty: newQty }).eq('box_size', size)
    setReadyBoxes(prev => ({ ...prev, [size]: newQty }))
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

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h2 className="text-xl font-bold text-jumar-brown mb-4">📦 المخزون</h2>

      {msg && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 mb-4 text-center text-sm flex justify-between">
          <span>{msg}</span><button onClick={() => setMsg('')} className="text-green-500">✕</button>
        </div>
      )}

      {lowStock.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
          <p className="text-red-700 font-bold text-sm mb-1">⚠️ مخزون منخفض:</p>
          <p className="text-red-600 text-sm">{lowStock.map(i => i.name).join(' · ')}</p>
        </div>
      )}

      {ingredients.length === 0 && !loading && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-center">
          <p className="text-amber-700 mb-3 text-sm">مفيش خامات مسجلة</p>
          <button onClick={seedIngredients} disabled={seeding}
            className="bg-jumar-brown text-white px-6 py-2 rounded-xl font-bold hover:opacity-90 disabled:opacity-50">
            {seeding ? 'جاري الإضافة...' : '🌿 أضف الخامات الأساسية'}
          </button>
        </div>
      )}

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {([
          ['stock','📊 خامات'],['boxes','📦 علب جاهزة'],['calculator','🧮 حاسبة'],
          ['add','➕ إضافة'],['use','🔽 خصم'],['history','📋 سجل']
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all ${tab === key ? 'bg-jumar-brown text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <div className="text-center py-10 text-gray-400">جاري التحميل...</div> : (
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
                    <div className="flex justify-between mt-1"><span className="text-xs text-gray-400">الحد الأدنى: {ing.min_stock}ج</span><span className="text-xs text-gray-400">{ing.cost_per_gram.toFixed(2)} ج/جرام</span></div>
                  </div>
                )
              })}
              <div className="bg-white rounded-xl p-4 shadow-sm mt-4">
                <h3 className="font-bold text-jumar-brown mb-3">🔧 تصحيح جرد</h3>
                <form onSubmit={handleAdjust} className="space-y-3">
                  <select value={adjustForm.ingredient_id} onChange={e => setAdjustForm({ ...adjustForm, ingredient_id: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right focus:outline-none focus:border-jumar-gold">
                    <option value="">اختر الخامة</option>
                    {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} — {i.stock_grams}ج</option>)}
                  </select>
                  <input type="number" placeholder="الكمية الفعلية (جرام)" value={adjustForm.grams} onChange={e => setAdjustForm({ ...adjustForm, grams: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right focus:outline-none focus:border-jumar-gold" />
                  <input placeholder="سبب التصحيح" value={adjustForm.note} onChange={e => setAdjustForm({ ...adjustForm, note: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right focus:outline-none focus:border-jumar-gold" />
                  <button type="submit" className="w-full bg-jumar-brown text-white font-bold py-3 rounded-xl hover:opacity-90">حفظ الجرد</button>
                </form>
              </div>
            </div>
          )}

          {/* ─ علب جاهزة ─ */}
          {tab === 'boxes' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400 text-center mb-2">عدد العلب الجاهزة للبيع — اضغط + / − لتحديث الرقم</p>
              <div className="grid grid-cols-1 gap-3">
                {BOX_SIZES.map(({ label, pieces }) => {
                  const qty = readyBoxes[pieces] || 0
                  return (
                    <div key={pieces} className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="font-bold text-jumar-brown text-lg">{label}</p>
                        <p className="text-xs text-gray-400">{pieces} قطعة</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={() => updateBoxQty(pieces, -1)} className="w-10 h-10 rounded-xl bg-gray-100 text-gray-600 text-xl font-bold hover:bg-red-50 hover:text-red-600 transition-all">−</button>
                        <span className={`text-3xl font-bold w-12 text-center ${qty === 0 ? 'text-gray-300' : qty < 3 ? 'text-red-500' : 'text-jumar-brown'}`}>{qty}</span>
                        <button onClick={() => updateBoxQty(pieces, 1)} className="w-10 h-10 rounded-xl bg-jumar-brown text-white text-xl font-bold hover:opacity-90 transition-all">+</button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="bg-jumar-brown text-white rounded-2xl p-4 text-center">
                <p className="text-white/70 text-sm mb-1">إجمالي العلب</p>
                <p className="text-4xl font-bold text-jumar-gold">{Object.values(readyBoxes).reduce((s, v) => s + v, 0)}</p>
              </div>
            </div>
          )}

          {/* ─ حاسبة الإنتاج ─ */}
          {tab === 'calculator' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-400 text-center">دخّل عدد العلب اللي عايز تعملها → يطلع المطلوب من كل خامة</p>
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
                    <p className="font-bold text-jumar-gold">🧮 المطلوب من الخامات</p>
                    <p className="text-xs text-white/60">{totalPieces} قطعة إجمالي</p>
                  </div>
                  {Object.entries(calcResult).sort(([,a],[,b]) => b - a).map(([name, grams]) => {
                    const ing = ingredients.find(i => i.name === name)
                    const enough = ing ? ing.stock_grams >= grams : true
                    return (
                      <div key={name} className="flex justify-between items-center">
                        <span className="text-sm text-white/80">{name}</span>
                        <div className="text-left">
                          <span className={`font-bold ${enough ? 'text-jumar-gold' : 'text-red-300'}`}>{grams.toFixed(0)}ج</span>
                          {ing && <span className={`text-xs mr-2 ${enough ? 'text-white/40' : 'text-red-300'}`}>({enough ? `✓ متاح ${ing.stock_grams.toFixed(0)}ج` : `✗ ناقص ${(grams - ing.stock_grams).toFixed(0)}ج`})</span>}
                        </div>
                      </div>
                    )
                  })}
                  <button onClick={() => setCalcPlan({})} className="w-full mt-2 bg-white/10 text-white text-sm py-2 rounded-xl hover:bg-white/20">مسح الحاسبة</button>
                </div>
              )}
            </div>
          )}

          {/* ─ إضافة مخزون ─ */}
          {tab === 'add' && (
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h2 className="font-bold text-jumar-brown text-lg mb-4">➕ تسجيل مشتريات جديدة</h2>
              <form onSubmit={handleAddStock} className="space-y-3">
                <select value={addForm.ingredient_id} onChange={e => setAddForm({ ...addForm, ingredient_id: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right focus:outline-none focus:border-jumar-gold">
                  <option value="">اختر الخامة *</option>
                  {ingredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
                <input required type="number" placeholder="الكمية (جرام) *" value={addForm.grams} onChange={e => setAddForm({ ...addForm, grams: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right focus:outline-none focus:border-jumar-gold" />
                <input type="number" placeholder="التكلفة الإجمالية (جنيه)" value={addForm.cost} onChange={e => setAddForm({ ...addForm, cost: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right focus:outline-none focus:border-jumar-gold" />
                <input placeholder="ملاحظة" value={addForm.note} onChange={e => setAddForm({ ...addForm, note: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right focus:outline-none focus:border-jumar-gold" />
                {addForm.grams && addForm.cost && <p className="text-sm text-jumar-gold text-center">سعر الجرام: {(parseFloat(addForm.cost) / parseFloat(addForm.grams)).toFixed(2)} ج</p>}
                <button type="submit" className="w-full bg-jumar-gold text-jumar-brown font-bold py-3 rounded-xl hover:opacity-90">✅ تسجيل المشتريات</button>
              </form>
            </div>
          )}

          {/* ─ خصم استخدام ─ */}
          {tab === 'use' && (
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h2 className="font-bold text-jumar-brown text-lg mb-4">🔽 خصم استخدام في الإنتاج</h2>
              <form onSubmit={handleUseStock} className="space-y-3">
                <select value={useForm.ingredient_id} onChange={e => setUseForm({ ...useForm, ingredient_id: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right focus:outline-none focus:border-jumar-gold">
                  <option value="">اختر الخامة *</option>
                  {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} — متاح: {i.stock_grams}ج</option>)}
                </select>
                <input required type="number" placeholder="الكمية المستخدمة (جرام) *" value={useForm.grams} onChange={e => setUseForm({ ...useForm, grams: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right focus:outline-none focus:border-jumar-gold" />
                <input placeholder="الدفعة / المنتج" value={useForm.note} onChange={e => setUseForm({ ...useForm, note: e.target.value })} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right focus:outline-none focus:border-jumar-gold" />
                <button type="submit" className="w-full bg-red-500 text-white font-bold py-3 rounded-xl hover:opacity-90">🔽 خصم من المخزون</button>
              </form>
            </div>
          )}

          {/* ─ السجل ─ */}
          {tab === 'history' && (
            <div className="space-y-2">
              {movements.length === 0 ? <div className="text-center py-10 text-gray-400">لا توجد حركات مسجلة</div>
              : movements.map(m => (
                <div key={m.id} className="bg-white rounded-xl p-4 shadow-sm flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-gray-800">{m.ingredients?.name}</p>
                    <p className="text-xs text-gray-400">{m.note}</p>
                    <p className="text-xs text-gray-400">{new Date(m.created_at).toLocaleString('ar-EG')}</p>
                  </div>
                  <div className="text-left">
                    <span className={`font-bold text-lg ${m.type === 'in' ? 'text-green-600' : m.type === 'out' ? 'text-red-500' : 'text-blue-500'}`}>
                      {m.type === 'in' ? '+' : m.type === 'out' ? '−' : '~'}{Math.abs(m.grams)}ج
                    </span>
                    {m.cost > 0 && <p className="text-xs text-gray-400">{m.cost.toFixed(0)} ج</p>}
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
function FinanceTab() {
  const [tab, setTab] = useState<'overview'|'pl'|'cogs'|'inventory_turn'|'channels'|'customers'|'bazaar_roi'|'cashflow'|'sales'|'expenses'>('overview')
  const [kpis, setKpis] = useState<KPIs | null>(null)
  const [monthlyData, setMonthlyData] = useState<MonthRow[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [saleForm, setSaleForm] = useState({ sale_date: new Date().toISOString().split('T')[0], channel: 'بازار', items_desc: '', qty_tamriya: 0, qty_fudge: 0, qty_sultana: 0, qty_snickers_fool: 0, qty_snickers_bunduq: 0, amount: '', customer_type: 'غريب', notes: '' })
  const [expenseForm, setExpenseForm] = useState({ expense_date: new Date().toISOString().split('T')[0], category: 'خامات', description: '', amount: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: salesData }, { data: expensesData }, { data: ingData }, { data: ordersData }] = await Promise.all([
      supabase.from('sales').select('*').order('sale_date', { ascending: false }),
      supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
      supabase.from('ingredients').select('*').order('name'),
      supabase.from('orders').select('*, customers(name, area, phone), order_items(product_name, quantity)').order('created_at', { ascending: false }),
    ])
    if (salesData) setSales(salesData)
    if (expensesData) setExpenses(expensesData)
    if (ingData) setIngredients(ingData)
    if (ordersData) setOrders(ordersData)

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

  const fmt = (n: number) => n.toLocaleString('ar-EG', { maximumFractionDigits: 0 })
  const fmtPct = (n: number) => `${n.toFixed(1)}%`
  const fmtMonth = (m: string) => {
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

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">جارٍ التحميل...</div>

  const TABS = [
    ['overview','📊 نظرة سريعة'],
    ['pl','📋 P&L'],
    ['cogs','🏭 تكلفة الإنتاج'],
    ['inventory_turn','🔄 دوران المخزون'],
    ['channels','📡 القنوات'],
    ['customers','👥 العملاء'],
    ['bazaar_roi','🏪 ROI البازار'],
    ['cashflow','💵 التدفق النقدي'],
    ['sales','🛍️ تسجيل بيعة'],
    ['expenses','🧾 تسجيل مصروف'],
  ] as const

  return (
    <div className="max-w-2xl mx-auto">
      {/* Tab bar — horizontal scroll */}
      <div className="flex gap-1 overflow-x-auto pb-0 bg-white border-b border-gray-200 sticky top-[52px] z-10 px-2 pt-2">
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key as any)}
            className={`px-3 py-2 text-xs font-semibold whitespace-nowrap rounded-t-lg transition-all flex-shrink-0 ${tab === key ? 'bg-jumar-brown text-white' : 'text-gray-500 hover:text-jumar-brown'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-4">

        {/* ── نظرة سريعة ── */}
        {tab === 'overview' && (
          <>
            {/* KPI tiles */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
                <p className="text-xs text-gray-500 mb-1">إجمالي الإيرادات</p>
                <p className="text-2xl font-bold text-green-600">{fmt(totalRevenue)} ج</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
                <p className="text-xs text-gray-500 mb-1">صافي الربح</p>
                <p className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{netProfit >= 0 ? '+' : ''}{fmt(netProfit)} ج</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
                <p className="text-xs text-gray-500 mb-1">هامش الربح الإجمالي</p>
                <p className="text-2xl font-bold text-jumar-gold">{fmtPct(grossMargin)}</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
                <p className="text-xs text-gray-500 mb-1">هامش الربح الصافي</p>
                <p className={`text-2xl font-bold ${netMargin >= 0 ? 'text-jumar-brown' : 'text-red-500'}`}>{fmtPct(netMargin)}</p>
              </div>
            </div>

            {/* قيمة المخزون */}
            <div className="bg-jumar-brown text-white rounded-2xl p-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div><p className="text-xs text-white/60 mb-1">قيمة المخزون</p><p className="text-xl font-bold text-jumar-gold">{fmt(inventoryValue)} ج</p></div>
                <div><p className="text-xs text-white/60 mb-1">قطع مباعة</p><p className="text-xl font-bold">{totalQtySold}</p></div>
                <div><p className="text-xs text-white/60 mb-1">أيام بيانات</p><p className="text-xl font-bold">{Object.keys(Object.fromEntries(sales.map(s => [s.sale_date, 1]))).length}</p></div>
              </div>
            </div>

            {/* break-even */}
            {breakEvenPieces > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <p className="text-sm font-bold text-amber-800 mb-1">🎯 Break-Even الشهري</p>
                <p className="text-2xl font-bold text-amber-700">{breakEvenPieces.toLocaleString('ar-EG')} قطعة/شهر</p>
                <p className="text-xs text-amber-600 mt-1">({Math.round(breakEvenPieces / 30)} قطعة/يوم) · هامش مساهمة: {fmt(contributionMarginPerPiece)} ج/قطعة</p>
              </div>
            )}

            {/* ملخص شهري */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100"><h2 className="font-bold text-jumar-brown">📅 ملخص شهري</h2></div>
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
                        <td className={`p-3 text-center font-bold ${row.net >= 0 ? 'text-green-600' : 'text-red-500'}`}>{row.net >= 0 ? '+' : ''}{fmt(row.net)}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-gray-200 bg-jumar-cream font-bold">
                      <td className="p-3 text-right text-jumar-brown">الإجمالي</td>
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
                <h2 className="font-bold">📋 قائمة الأرباح والخسائر</h2>
                <p className="text-xs text-white/60 mt-0.5">إجمالي منذ البداية</p>
              </div>
              <div className="divide-y divide-gray-100">
                {/* إيرادات */}
                <div className="flex justify-between items-center px-4 py-3">
                  <span className="font-bold text-gray-800 text-sm">إجمالي الإيرادات</span>
                  <span className="font-bold text-green-600">{fmt(totalRevenue)} ج</span>
                </div>
                <div className="flex justify-between items-center px-4 py-2 bg-gray-50">
                  <span className="text-gray-500 text-sm pr-4">(-) تكلفة البضاعة (COGS)</span>
                  <span className="font-semibold text-red-500 text-sm">−{fmt(totalCOGS)} ج</span>
                </div>
                {/* gross profit */}
                <div className="px-4 py-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-800 text-sm">= إجمالي الربح</span>
                    <span className={`font-bold ${grossProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmt(grossProfit)} ج</span>
                  </div>
                  <p className="text-xs text-jumar-gold mt-0.5">هامش إجمالي: {fmtPct(grossMargin)}</p>
                </div>
                <div className="flex justify-between items-center px-4 py-2 bg-gray-50">
                  <span className="text-gray-500 text-sm pr-4">(-) مصاريف التشغيل (OPEX)</span>
                  <span className="font-semibold text-red-500 text-sm">−{fmt(totalOpex)} ج</span>
                </div>
                <div className="flex justify-between items-center px-4 py-2 bg-gray-50">
                  <span className="text-gray-500 text-sm pr-4">(-) تكلفة الهدايا ({totalGiftQty} قطعة)</span>
                  <span className="font-semibold text-orange-500 text-sm">−{fmt(giftCost)} ج</span>
                </div>
                {/* net profit */}
                <div className={`px-4 py-3 ${netProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-800">= صافي الربح</span>
                    <span className={`font-bold text-lg ${netProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{netProfit >= 0 ? '' : '−'}{fmt(Math.abs(netProfit))} ج</span>
                  </div>
                  <p className="text-xs text-jumar-gold mt-0.5">هامش صافي: {fmtPct(netMargin)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── تكلفة الإنتاج (COGS) ── */}
        {tab === 'cogs' && (
          <div className="space-y-3">
            <div className="bg-jumar-brown text-white rounded-2xl p-4 text-center">
              <p className="text-xs text-white/60 mb-1">متوسط تكلفة القطعة الواحدة</p>
              <p className="text-3xl font-bold text-jumar-gold">{(avgCogPerPiece + PACKAGING_COST_PER_PIECE).toFixed(2)} ج</p>
              <p className="text-xs text-white/50 mt-1">خامات: {avgCogPerPiece.toFixed(2)}ج + تغليف: {PACKAGING_COST_PER_PIECE}ج</p>
            </div>
            {Object.keys(RECIPES).map(product => {
              const rawCost = cogPerPiece(product)
              const totalCost = rawCost + PACKAGING_COST_PER_PIECE
              const salePrice = 40 // 40 ج للقطعة
              const margin = salePrice > 0 ? ((salePrice - totalCost) / salePrice * 100) : 0
              const recipe = RECIPES[product]
              return (
                <div key={product} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-4 bg-jumar-cream">
                    <div className="flex justify-between items-center">
                      <p className="font-bold text-jumar-brown">{product}</p>
                      <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${margin >= 40 ? 'bg-green-100 text-green-700' : margin >= 20 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>
                        هامش {fmtPct(margin)}
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
                      <span>تغليف</span><span>{PACKAGING_COST_PER_PIECE.toFixed(2)} ج</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold pt-2 border-t border-gray-200">
                      <span className="text-gray-700">إجمالي التكلفة</span>
                      <span className="text-red-500">{totalCost.toFixed(2)} ج</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-gray-700">سعر البيع</span>
                      <span className="text-green-600">{salePrice} ج</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-gray-700">ربح القطعة</span>
                      <span className={salePrice - totalCost >= 0 ? 'text-jumar-brown' : 'text-red-500'}>{(salePrice - totalCost).toFixed(2)} ج</span>
                    </div>
                    {/* علب */}
                    <div className="mt-2 pt-2 border-t border-gray-100">
                      <p className="text-xs text-gray-400 mb-1">هامش ربح العلب:</p>
                      <div className="grid grid-cols-3 gap-1">
                        {BOX_SIZES.map(({ label, pieces }) => {
                          const boxSale = pieces === 8 ? 260 : pieces === 15 ? 450 : 650
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
              <div><p className="text-xs text-white/60 mb-1">قيمة المخزون الحالي</p><p className="text-2xl font-bold text-jumar-gold">{fmt(inventoryValue)} ج</p></div>
              <div><p className="text-xs text-white/60 mb-1">متوسط مبيعات يومي</p><p className="text-2xl font-bold">{fmt(dailySalesAvg)} ج</p></div>
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
                        <p className="text-xs text-gray-400">{ing.stock_grams.toLocaleString('ar-EG')} جرام · {ing.cost_per_gram.toFixed(2)} ج/ج</p>
                        <p className="text-xs text-gray-400">قيمة: {fmt(stockValue)} ج</p>
                      </div>
                      <div className="text-left">
                        {daysLeft !== null ? (
                          <div className={`text-center px-3 py-1.5 rounded-xl ${isCritical ? 'bg-red-100' : isLow ? 'bg-amber-100' : 'bg-green-100'}`}>
                            <p className={`text-xl font-bold ${isCritical ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-green-600'}`}>{daysLeft}</p>
                            <p className={`text-xs ${isCritical ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-green-500'}`}>يوم</p>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">غير مستخدم</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
              ⚠️ الأرقام تقديرية بناءً على معدل المبيعات الحالي والوصفات المسجلة
            </div>
          </div>
        )}

        {/* ── تحليل القنوات ── */}
        {tab === 'channels' && (
          <div className="space-y-3">
            <div className="bg-jumar-brown text-white rounded-2xl p-4 text-center">
              <p className="text-xs text-white/60 mb-1">إجمالي الإيرادات</p>
              <p className="text-3xl font-bold text-jumar-gold">{fmt(totalRevenue)} ج</p>
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
                    <p className="text-xl font-bold text-green-600">{fmt(data.revenue)} ج</p>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
                    <div className="bg-jumar-gold h-2 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-gray-50 rounded-lg p-2"><p className="text-lg font-bold text-gray-700">{fmtPct(pct)}</p><p className="text-xs text-gray-400">من الإيرادات</p></div>
                    <div className="bg-gray-50 rounded-lg p-2"><p className="text-lg font-bold text-gray-700">{fmt(avg)} ج</p><p className="text-xs text-gray-400">متوسط البيعة</p></div>
                    <div className={`rounded-lg p-2 ${estMargin >= 0 ? 'bg-green-50' : 'bg-red-50'}`}><p className={`text-lg font-bold ${estMargin >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmtPct(estMargin)}</p><p className="text-xs text-gray-400">هامش تقديري</p></div>
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
              <div className="bg-white rounded-2xl p-3 shadow-sm text-center"><p className="text-xl font-bold text-jumar-brown">{Object.keys(customerOrders).length}</p><p className="text-xs text-gray-400">إجمالي عملاء</p></div>
              <div className="bg-white rounded-2xl p-3 shadow-sm text-center"><p className="text-xl font-bold text-green-600">{repeatCustomers.length}</p><p className="text-xs text-gray-400">عملاء مكررون</p></div>
              <div className="bg-white rounded-2xl p-3 shadow-sm text-center"><p className="text-xl font-bold text-jumar-gold">{fmt(avgOrderValue)} ج</p><p className="text-xs text-gray-400">متوسط الطلب</p></div>
            </div>

            {/* نسبة التكرار */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-sm font-bold text-jumar-brown mb-2">نسبة العملاء المكررين</p>
              <div className="w-full bg-gray-100 rounded-full h-3 mb-2">
                <div className="bg-jumar-gold h-3 rounded-full" style={{ width: `${Object.keys(customerOrders).length > 0 ? (repeatCustomers.length / Object.keys(customerOrders).length * 100) : 0}%` }} />
              </div>
              <p className="text-xs text-gray-500">{repeatCustomers.length} من {Object.keys(customerOrders).length} عميل ({Object.keys(customerOrders).length > 0 ? fmtPct(repeatCustomers.length / Object.keys(customerOrders).length * 100) : '0%'})</p>
            </div>

            {/* أكثر المناطق */}
            {topAreas.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <p className="text-sm font-bold text-jumar-brown mb-3">📍 أكثر المناطق طلباً</p>
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
                <div className="p-4 border-b border-gray-100"><p className="font-bold text-jumar-brown">⭐ عملاء مكررون</p></div>
                <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                  {repeatCustomers.sort((a,b) => b.count - a.count).slice(0,10).map((c, i) => (
                    <div key={i} className="p-3 flex justify-between items-center">
                      <div><p className="text-sm font-semibold text-gray-800">{c.name}</p><p className="text-xs text-gray-400">{c.area}</p></div>
                      <div className="text-left"><span className="text-jumar-brown font-bold">{c.count} طلبات</span><p className="text-xs text-green-600">{fmt(c.total)} ج</p></div>
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
            <div className="bg-jumar-brown text-white rounded-2xl p-5 text-center">
              <p className="text-sm text-white/70 mb-2">ROI البازار</p>
              <p className={`text-4xl font-bold ${bazaarROI !== null && bazaarROI >= 0 ? 'text-jumar-gold' : 'text-red-300'}`}>
                {bazaarROI !== null ? `${bazaarROI.toFixed(0)}%` : '—'}
              </p>
              {bazaarROI !== null && <p className="text-xs text-white/50 mt-1">{bazaarROI >= 100 ? '✅ مربح جداً' : bazaarROI >= 0 ? '⚠️ مربح بالكاد' : '❌ خسارة'}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-4 shadow-sm text-center"><p className="text-xs text-gray-400 mb-1">إيراد البازار</p><p className="text-2xl font-bold text-green-600">{fmt(bazaarRevenue)} ج</p></div>
              <div className="bg-white rounded-2xl p-4 shadow-sm text-center"><p className="text-xs text-gray-400 mb-1">تكلفة البازار</p><p className="text-2xl font-bold text-red-500">{fmt(bazaarCost)} ج</p></div>
              <div className="bg-white rounded-2xl p-4 shadow-sm text-center"><p className="text-xs text-gray-400 mb-1">صافي ربح البازار</p><p className={`text-2xl font-bold ${bazaarProfit >= 0 ? 'text-jumar-brown' : 'text-red-500'}`}>{bazaarProfit >= 0 ? '+' : ''}{fmt(bazaarProfit)} ج</p></div>
              <div className="bg-white rounded-2xl p-4 shadow-sm text-center"><p className="text-xs text-gray-400 mb-1">% من إجمالي الإيرادات</p><p className="text-2xl font-bold text-jumar-gold">{totalRevenue > 0 ? fmtPct(bazaarRevenue / totalRevenue * 100) : '—'}</p></div>
            </div>
            {bazaarCost === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                💡 سجّل تكاليف البازار (رسوم الاشتراك) في المصروفات تحت فئة "رسوم بازار" عشان يتحسب الـ ROI صح
              </div>
            )}
          </div>
        )}

        {/* ── التدفق النقدي ── */}
        {tab === 'cashflow' && (
          <div className="space-y-3">
            <div className="bg-jumar-brown text-white rounded-2xl p-4">
              <p className="text-sm text-white/70 mb-1">المركز النقدي الحالي (تقديري)</p>
              <p className={`text-3xl font-bold ${netProfit >= 0 ? 'text-jumar-gold' : 'text-red-300'}`}>{netProfit >= 0 ? '+' : ''}{fmt(netProfit)} ج</p>
              <p className="text-xs text-white/50 mt-1">إيرادات − مصروفات − COGS − هدر</p>
            </div>

            {/* مصاريف ثابتة vs متغيرة */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="font-bold text-jumar-brown mb-3">📊 تحليل المصروفات</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-red-600 mb-1">مصاريف ثابتة</p>
                  <p className="text-xl font-bold text-red-600">{fmt(fixedExpenses)} ج</p>
                </div>
                <div className="bg-orange-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-orange-600 mb-1">مصاريف متغيرة</p>
                  <p className="text-xl font-bold text-orange-600">{fmt(totalOpex - fixedExpenses)} ج</p>
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
                      <span className="text-xs font-bold text-gray-700 w-16 text-left">{fmt(total)} ج</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* معدل حرق الكاش */}
            {cashBurnMonths !== null && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                <p className="text-sm font-bold text-red-700 mb-1">🔥 معدل حرق الكاش</p>
                <p className="text-2xl font-bold text-red-600">{cashBurnMonths.toFixed(1)} شهر</p>
                <p className="text-xs text-red-500">يكفي الكاش الحالي للمصاريف الثابتة لو توقفت المبيعات</p>
              </div>
            )}
            {cashBurnMonths === null && netProfit >= 0 && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
                <p className="text-green-700 font-bold">✅ المشروع يغطي مصاريفه</p>
                <p className="text-xs text-green-600 mt-1">مفيش حرق كاش</p>
              </div>
            )}
          </div>
        )}

        {/* ── تسجيل بيعة ── */}
        {tab === 'sales' && (
          <>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h2 className="font-bold text-jumar-brown mb-3">➕ تسجيل بيعة جديدة</h2>
              <form onSubmit={saveSale} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-gray-500 block mb-1">التاريخ</label><input type="date" required value={saleForm.sale_date} onChange={e => setSaleForm({...saleForm, sale_date: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold" /></div>
                  <div><label className="text-xs text-gray-500 block mb-1">القناة</label><select value={saleForm.channel} onChange={e => setSaleForm({...saleForm, channel: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold">{CHANNELS.map(c => <option key={c}>{c}</option>)}</select></div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">الكميات (اختياري)</label>
                  <div className="grid grid-cols-5 gap-1 text-center text-xs">
                    {[['qty_tamriya','ت'],['qty_fudge','ف'],['qty_sultana','س'],['qty_snickers_fool','سف'],['qty_snickers_bunduq','سب']].map(([key, label]) => (
                      <div key={key}><p className="text-gray-400 mb-1">{label}</p><input type="number" min="0" value={(saleForm as any)[key]} onChange={e => setSaleForm({...saleForm, [key]: Number(e.target.value)})} className="w-full border border-gray-200 rounded-lg px-1 py-1.5 text-center text-sm focus:outline-none focus:border-jumar-gold" /></div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-gray-500 block mb-1">المبلغ (ج) *</label><input type="number" required min="1" placeholder="0" value={saleForm.amount} onChange={e => setSaleForm({...saleForm, amount: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold" /></div>
                  <div><label className="text-xs text-gray-500 block mb-1">نوع العميل</label><select value={saleForm.customer_type} onChange={e => setSaleForm({...saleForm, customer_type: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold">{['غريب','قريب/معرفة','متنوع','غير محدد'].map(c => <option key={c}>{c}</option>)}</select></div>
                </div>
                <input placeholder="وصف الصنف" value={saleForm.items_desc} onChange={e => setSaleForm({...saleForm, items_desc: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold" />
                {msg && <p className={`text-sm text-center ${msg.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>{msg}</p>}
                <button type="submit" disabled={saving} className="w-full bg-jumar-brown text-white font-bold py-3 rounded-xl hover:opacity-90 disabled:opacity-50">{saving ? 'جارٍ الحفظ...' : '💾 سجّل البيعة'}</button>
              </form>
            </div>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex justify-between items-center"><h2 className="font-bold text-jumar-brown">📋 سجل المبيعات ({sales.length})</h2><span className="text-green-600 font-bold text-sm">{fmt(sales.reduce((s, r) => s + Number(r.amount), 0))} ج</span></div>
              <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
                {sales.map(s => (
                  <div key={s.id} className="p-3 flex justify-between items-start">
                    <div className="text-right"><div className="flex items-center gap-2"><span className="text-xs bg-jumar-gold/20 text-jumar-brown px-2 py-0.5 rounded-full">{s.channel}</span><span className="text-xs text-gray-400">{s.sale_date}</span></div>{s.items_desc && <p className="text-xs text-gray-500 mt-0.5">{s.items_desc}</p>}</div>
                    <span className="font-bold text-green-600 text-sm whitespace-nowrap mr-2">{fmt(Number(s.amount))} ج</span>
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
              <h2 className="font-bold text-jumar-brown mb-3">➕ تسجيل مصروف جديد</h2>
              <form onSubmit={saveExpense} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-gray-500 block mb-1">التاريخ</label><input type="date" required value={expenseForm.expense_date} onChange={e => setExpenseForm({...expenseForm, expense_date: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold" /></div>
                  <div><label className="text-xs text-gray-500 block mb-1">الفئة</label><select value={expenseForm.category} onChange={e => setExpenseForm({...expenseForm, category: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold">{EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
                </div>
                <input required placeholder="الوصف *" value={expenseForm.description} onChange={e => setExpenseForm({...expenseForm, description: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold" />
                <input type="number" required min="1" placeholder="المبلغ (ج) *" value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold" />
                <input placeholder="ملاحظات" value={expenseForm.notes} onChange={e => setExpenseForm({...expenseForm, notes: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold" />
                {msg && <p className={`text-sm text-center ${msg.startsWith('✅') ? 'text-green-600' : 'text-red-600'}`}>{msg}</p>}
                <button type="submit" disabled={saving} className="w-full bg-jumar-brown text-white font-bold py-3 rounded-xl hover:opacity-90 disabled:opacity-50">{saving ? 'جارٍ الحفظ...' : '💾 سجّل المصروف'}</button>
              </form>
            </div>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100"><h2 className="font-bold text-jumar-brown">📊 حسب الفئة</h2></div>
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
function BazaarTab() {
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
  const [lastSaleId, setLastSaleId] = useState<number | null>(null)

  useEffect(() => {
    const now = new Date().toISOString().split('T')[0]
    const nearest = BAZAAR_DATES.find(d => d >= now) || BAZAAR_DATES[2]
    setToday(nearest); loadSummary(nearest)
  }, [])

  async function loadSummary(activeDay?: string) {
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
    const cur = activeDay || today
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
  }

  async function recordSale(item: typeof BAZAAR_ITEMS[0]) {
    setLoading(true)
    const desc = item.gift > 0 ? `${item.label} +${item.gift} هدية` : item.label
    const { data } = await supabase.from('sales').insert({
      sale_date: today, channel: 'بازار', items_desc: desc, total_qty: item.qty + item.gift,
      amount: item.price, customer_type: 'غريب', notes: `qty:${item.qty}|gift:${item.gift}|بازار لوتس أكتوبر 2026`,
    }).select('id').single()
    if (data?.id) setLastSaleId(data.id)
    setLastSale(`${item.label} — ${item.price}ج ✅`)
    await loadSummary(); setLoading(false)
    setTimeout(() => { setLastSale(null); setLastSaleId(null) }, 8000)
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between"><h2 className="text-xl font-bold text-jumar-brown">🏪 بازار لوتس</h2><p className="text-xs text-gray-400">٢٢-٢٤ أكتوبر ٢٠٢٦</p></div>
      <div className="grid grid-cols-3 gap-2">
        {BAZAAR_DATES.map(date => (
          <button key={date} onClick={() => switchDay(date)} className={`py-2 rounded-xl text-sm font-bold transition-all ${today === date ? 'bg-jumar-brown text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>{dayLabel(date)}</button>
        ))}
      </div>
      <div className="bg-jumar-brown text-white rounded-2xl p-4">
        <div className="flex justify-between items-start mb-3">
          <div><p className="text-xs text-white/60 mb-1">{dayLabel(today)} — إيرادات</p><p className="text-3xl font-bold text-jumar-gold">{todayTotal.toLocaleString('ar-EG')} ج</p></div>
          <div className="text-left"><p className="text-xs text-white/60 mb-1">إجمالي البازار</p><p className="text-xl font-bold">{grandTotal.toLocaleString('ar-EG')} ج</p></div>
        </div>
        <div className="flex gap-4 border-t border-white/20 pt-3">
          <div className="text-center flex-1"><p className="text-2xl font-bold text-jumar-gold">{todaySold}</p><p className="text-xs text-white/60">مباع اليوم</p></div>
          <div className="text-center flex-1"><p className="text-2xl font-bold text-white/80">{todayGifts}</p><p className="text-xs text-white/60">هدايا اليوم</p></div>
          <div className="text-center flex-1"><p className="text-2xl font-bold text-jumar-gold">{grandSold}</p><p className="text-xs text-white/60">إجمالي مباع</p></div>
          <div className="text-center flex-1"><p className="text-2xl font-bold text-white/80">{grandGifts}</p><p className="text-xs text-white/60">إجمالي هدايا</p></div>
        </div>
      </div>
      {lastSale && (
        <div className="bg-green-100 text-green-700 rounded-xl p-3 flex items-center justify-between gap-2">
          <span className="font-bold text-sm">{lastSale}</span>
          {lastSaleId && <button onClick={async () => { await supabase.from('sales').delete().eq('id', lastSaleId); setLastSale(null); setLastSaleId(null); await loadSummary() }} className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-lg hover:bg-red-600 active:scale-95 transition-all whitespace-nowrap">↩ تراجع</button>}
        </div>
      )}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h2 className="font-bold text-jumar-brown mb-3 text-center">اضغط للتسجيل الفوري</h2>
        <div className="grid grid-cols-2 gap-3">
          {BAZAAR_ITEMS.map((item, i) => (
            <button key={i} onClick={() => recordSale(item)} disabled={loading} className="bg-jumar-cream border-2 border-jumar-gold/30 hover:border-jumar-gold hover:bg-jumar-gold/10 active:scale-95 transition-all rounded-2xl p-4 text-center disabled:opacity-50">
              <p className="text-lg font-bold text-jumar-brown">{item.label}</p>
              {item.gift > 0 && <p className="text-xs text-jumar-gold">+{item.gift} هدية</p>}
              <p className="text-2xl font-bold text-jumar-gold mt-1">{item.price}</p>
              <p className="text-xs text-gray-400">جنيه</p>
            </button>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100"><h2 className="font-bold text-jumar-brown">📊 ملخص الأيام</h2></div>
        <div className="divide-y divide-gray-50">
          {daySummaries.map(s => (
            <div key={s.date} className="p-3">
              <div className="flex justify-between items-center mb-1"><p className="font-semibold text-gray-700">{dayLabel(s.date)}</p><p className={`font-bold text-lg ${s.total > 0 ? 'text-green-600' : 'text-gray-300'}`}>{s.total > 0 ? `${s.total.toLocaleString('ar-EG')} ج` : '—'}</p></div>
              {s.total > 0 && <div className="flex gap-3 text-xs text-gray-500"><span>مباع: <span className="font-bold text-jumar-brown">{s.soldQty}</span></span><span>هدايا: <span className="font-bold text-gray-400">{s.giftQty}</span></span><span>بيعات: <span className="font-bold">{s.count}</span></span></div>}
            </div>
          ))}
          <div className="p-3 bg-jumar-cream">
            <div className="flex justify-between items-center mb-1"><p className="font-bold text-jumar-brown">الإجمالي</p><p className="font-bold text-xl text-jumar-brown">{grandTotal.toLocaleString('ar-EG')} ج</p></div>
            <div className="flex gap-3 text-xs text-gray-500"><span>مباع: <span className="font-bold text-jumar-brown">{grandSold}</span></span><span>هدايا: <span className="font-bold">{grandGifts}</span></span></div>
          </div>
        </div>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 text-center">
        <p className="text-sm text-amber-800 font-semibold">🎯 الهدف: 198 قطعة مباعة (66/يوم) للـ break-even</p>
        <p className="text-xs text-amber-600 mt-1">وصلت: {grandSold} من 198 ({Math.round(grandSold/198*100)}%)</p>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// ANALYTICS TAB  (أكثر المنتجات مبيعاً + معدل التحويل)
// ══════════════════════════════════════════════════════════════════════════════
function AnalyticsTab() {
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

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">جارٍ التحميل...</div>

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
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h2 className="text-xl font-bold text-jumar-brown">📊 التحليلات</h2>

      {/* معدل التحويل */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h3 className="font-bold text-jumar-brown mb-3">🎯 معدل التحويل (الطلبات الأونلاين)</h3>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center bg-gray-50 rounded-xl p-3"><p className="text-2xl font-bold text-jumar-brown">{total}</p><p className="text-xs text-gray-500">إجمالي الطلبات</p></div>
          <div className="text-center bg-green-50 rounded-xl p-3"><p className="text-2xl font-bold text-green-600">{delivered}</p><p className="text-xs text-gray-500">تم توصيله</p></div>
          <div className="text-center bg-red-50 rounded-xl p-3"><p className="text-2xl font-bold text-red-500">{cancelled}</p><p className="text-xs text-gray-500">ملغي</p></div>
        </div>
        <div className="bg-jumar-cream rounded-xl p-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-jumar-brown">معدل الإتمام</span>
            <span className="text-2xl font-bold text-jumar-brown">{conversionRate}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div className="bg-jumar-gold h-3 rounded-full transition-all" style={{ width: `${conversionRate}%` }} />
          </div>
          {pending > 0 && <p className="text-xs text-amber-600 mt-2">⏳ {pending} طلب لسه قيد التنفيذ</p>}
        </div>
      </div>

      {/* أكثر المنتجات مبيعاً (من الطلبات) */}
      {topProducts.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h3 className="font-bold text-jumar-brown mb-3">🏆 أكثر المنتجات مبيعاً (طلبات أونلاين)</h3>
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
          <h3 className="font-bold text-jumar-brown mb-3">🌟 الفلايفر الأكثر مبيعاً (كل القنوات)</h3>
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
          <h3 className="font-bold text-jumar-brown mb-3">📡 الإيرادات حسب القناة</h3>
          <div className="space-y-2">
            {channelEntries.map(([channel, amount]) => (
              <div key={channel} className="flex items-center gap-3">
                <span className="text-sm text-gray-700 flex-1">{channel}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 bg-gray-100 rounded-full h-2"><div className="bg-jumar-gold h-2 rounded-full" style={{ width: `${(amount / totalRevenue) * 100}%` }} /></div>
                  <span className="text-sm font-bold text-green-600 w-16 text-left">{amount.toLocaleString('ar-EG')}ج</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* متوسط اليومي */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-jumar-brown text-white rounded-2xl p-4 text-center">
          <p className="text-xs text-white/60 mb-1">متوسط المبيعات اليومي</p>
          <p className="text-2xl font-bold text-jumar-gold">{dailyAvg.toLocaleString('ar-EG')} ج</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
          <p className="text-xs text-gray-500 mb-1">أيام نشاط مسجلة</p>
          <p className="text-2xl font-bold text-jumar-brown">{Object.keys(byDate).length}</p>
        </div>
      </div>
    </div>
  )
}
