'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Order, OrderStatus, STATUS_LABELS, STATUS_LABELS_EN, STATUS_COLORS } from '@/lib/types'

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
const EXPENSE_CATEGORIES = ['خامات','معدات','تغليف','تسويق','رسوم بازار','عمالة','نثريات','بحث وتطوير','تسوية COGS','أخرى']
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
  { label: 'علبة ٢', labelEn: 'Box 2', pieces: 2 },
  { label: 'علبة ٥', labelEn: 'Box 5', pieces: 5 },
  { label: 'علبة ٨', labelEn: 'Box 8', pieces: 8 },
  { label: 'علبة ١٥', labelEn: 'Box 15', pieces: 15 },
  { label: 'علبة ٢٤', labelEn: 'Box 24', pieces: 24 },
]
const BOX_PRICE_MAP: Record<number, number> = { 2: 70, 5: 170, 8: 260, 15: 450, 24: 650 }

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

// ── Translation maps ────────────────────────────────────────────────────────
const PRODUCT_EN: Record<string, string> = {
  'تمرية الطحينة': 'Tahini Date Ball',
  'سلطانة الفستق': 'Pistachio Queen',
  'فدج الكاجو':    'Cashew Fudge',
  'سنيكرز الفول':  'Peanut Snickers',
  'سنيكرز البندق': 'Hazelnut Snickers',
  // short forms used in flavor analytics
  'سنيكرز فول':   'Peanut Snickers',
  'سنيكرز بندق':  'Hazelnut Snickers',
}
const CATEGORY_EN: Record<string, string> = {
  'خامات':       'Raw Materials',
  'معدات':       'Equipment',
  'تغليف':       'Packaging',
  'تسويق':       'Marketing',
  'رسوم بازار':  'Bazaar Fees',
  'عمالة':       'Labor',
  'نثريات':      'Miscellaneous',
  'بحث وتطوير':  'R&D',
  'تسوية COGS':  'COGS Adjustment',
  'أخرى':        'Other',
}
const CHANNEL_EN: Record<string, string> = {
  'بازار':     'Bazaar',
  'مباشر':     'Direct',
  'إنستجرام':  'Instagram',
  'أونلاين':   'Online',
}
const INGREDIENT_EN: Record<string, string> = {
  'تمر مجدول':      'Medjool Dates',
  'تمر عادي':       'Regular Dates',
  'كاجو':           'Cashews',
  'فستق':           'Pistachios',
  'بندق':           'Hazelnuts',
  'فول سوداني':     'Peanuts',
  'طحينة':          'Tahini',
  'شوكولاتة دارك':  'Dark Chocolate',
  'زبدة':           'Butter',
  'تين مجفف':       'Dried Figs',
  'سمسم':           'Sesame',
  'جوز هند':        'Coconut',
  'زبيب':           'Raisins',
  'كاكاو خام':      'Raw Cacao',
  'زيت جوز الهند':  'Coconut Oil',
  'مشمش مجفف':      'Dried Apricots',
  'مشمش':           'Apricots',
  'توت بري':        'Blueberries',
  'توت':            'Berries',
  'عسل':            'Honey',
  'قرفة':           'Cinnamon',
  'هيل':            'Cardamom',
  'لوز':            'Almonds',
  'جوز':            'Walnuts',
  'بذور شيا':       'Chia Seeds',
  'دقيق لوز':       'Almond Flour',
  'دقيق قمح':       'Wheat Flour',
  'دقيق جوز الهند': 'Coconut Flour',
  'بروتين':         'Protein Powder',
  'فانيليا':        'Vanilla',
  'ملح':            'Salt',
  'شوكولاتة حليب':  'Milk Chocolate',
  'شوكولاتة بيضاء': 'White Chocolate',
  'وديس تمر':       'Date Paste',
  'معجون تمر':      'Date Paste',
  'دبس تمر':        'Date Molasses',
  'خل تفاح':        'Apple Cider Vinegar',
  'زيت زيتون':      'Olive Oil',
  'زيت جوز':        'Walnut Oil',
  'مكسرات مشكلة':   'Mixed Nuts',
  'شوكولاتة':        'Chocolate',
  'كريمة':           'Cream',
  'حليب':            'Milk',
  'بيض':             'Eggs',
  'سكر':             'Sugar',
  'عسل نحل':         'Raw Honey',
  'زنجبيل':          'Ginger',
  'كركم':            'Turmeric',
  'يانسون':          'Anise',
  'نعناع':           'Mint',
  'لوز مطحون':       'Ground Almonds',
  'بذور كتان':       'Flaxseeds',
  'بذور عباد الشمس': 'Sunflower Seeds',
  'بذور قرع':        'Pumpkin Seeds',
  'تمر سكري':        'Sukkari Dates',
  'تمر خلاص':        'Khlas Dates',
  'قهوة':            'Coffee',
  'شاي أخضر':        'Green Tea',
  'نشا':             'Starch',
  'بكينج باودر':     'Baking Powder',
  'صودا الخبز':      'Baking Soda',
}
const BAZAAR_EN: Record<string, string> = {
  'بازار لوتس': 'Lotus Bazaar',
}
const BAZAAR_LOCATION_EN: Record<string, string> = {
  'لوتس': 'Lotus',
  'الجاردينيا': 'Gardenia',
  'التجمع': 'Fifth Settlement',
  'مدينتي': 'Madinaty',
  'القاهرة الجديدة': 'New Cairo',
}

const CUSTOMER_TYPE_EN: Record<string, string> = {
  'غريب':          'New',
  'عارف':          'Returning',
  'متحمس':         'Loyal',
  'قريب/معرفة':    'Friend/Referral',
  'متنوع':         'Mixed',
  'غير محدد':      'Unspecified',
}

function t(ar: boolean, arText: string, enMap: Record<string, string>): string {
  return ar ? arText : (enMap[arText] || arText)
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
            <div className="bg-jumar-brown text-white rounded-xl p-4"><p className="text-xs text-white/60 mb-1">{ar ? 'إجمالي الإيرادات' : 'Total Revenue'}</p><p className="text-xl font-bold text-jumar-gold">{sales.totalRevenue.toLocaleString(ar ? 'ar-EG' : 'en-US')} {ar ? 'ج' : 'EGP'}</p></div>
            <div className="bg-white rounded-xl p-4 shadow-sm"><p className="text-xs text-gray-400 mb-1">{ar ? 'اليوم' : 'Today'}</p><p className="text-xl font-bold text-green-600">{sales.todayRevenue.toLocaleString(ar ? 'ar-EG' : 'en-US')} {ar ? 'ج' : 'EGP'}</p></div>
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
            {s === 'all' ? `${ar ? 'الكل' : 'All'} (${counts.all})` : `${ar ? STATUS_LABELS[s] : STATUS_LABELS_EN[s]} (${counts[s]})`}
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
                  {ar ? STATUS_LABELS[order.status] : STATUS_LABELS_EN[order.status]}
                </span>
                <div className="flex gap-1.5 flex-wrap">
                  {(['new', 'preparing', 'ready', 'shipped', 'delivered', 'cancelled'] as OrderStatus[])
                    .filter(s => s !== order.status)
                    .map(s => (
                      <button key={s} onClick={() => updateStatus(order, s)}
                        className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:border-jumar-gold hover:text-jumar-brown transition-all">
                        {ar ? STATUS_LABELS[s] : STATUS_LABELS_EN[s]}
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
          <p className="text-red-600 text-sm">{lowStock.map(i => ar ? i.name : (INGREDIENT_EN[i.name] || i.name)).join(' · ')}</p>
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
                      <div><span className="font-bold text-gray-800">{ar ? ing.name : (INGREDIENT_EN[ing.name] || ing.name)}</span>{low && <span className="mr-2 text-xs text-red-500 font-semibold">{ar ? '⚠️ منخفض' : '⚠️ Low'}</span>}</div>
                      <div className="text-left"><span className={`font-bold text-lg ${low ? 'text-red-600' : 'text-jumar-brown'}`}>{ing.stock_grams.toLocaleString(ar ? 'ar-EG' : 'en-US')}</span><span className="text-xs text-gray-400 mr-1">{ar ? 'جرام' : 'g'}</span></div>
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
                    {ingredients.map(i => <option key={i.id} value={i.id}>{ar ? i.name : (INGREDIENT_EN[i.name] || i.name)} — {i.stock_grams}g</option>)}
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
                {BOX_SIZES.map(({ label, labelEn, pieces }) => {
                  const qty = readyBoxes[pieces] || 0
                  return (
                    <div key={pieces} className="bg-white rounded-2xl p-4 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="font-bold text-jumar-brown text-lg">{ar ? label : labelEn}</p>
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
                  <p className="font-bold text-jumar-brown mb-3">{ar ? product : (PRODUCT_EN[product] || product)}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {BOX_SIZES.map(({ label, labelEn, pieces }) => (
                      <div key={pieces}>
                        <p className="text-xs text-gray-400 mb-1">{ar ? label : labelEn}</p>
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
                        <span className="text-sm text-white/80">{ar ? name : (INGREDIENT_EN[name] || name)}</span>
                        <div className="text-left">
                          <span className={`font-bold ${enough ? 'text-jumar-gold' : 'text-red-300'}`}>{grams.toFixed(0)}{ar ? 'ج' : 'g'}</span>
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
                  {ingredients.map(i => <option key={i.id} value={i.id}>{ar ? i.name : (INGREDIENT_EN[i.name] || i.name)}</option>)}
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
                  {ingredients.map(i => <option key={i.id} value={i.id}>{ar ? i.name : (INGREDIENT_EN[i.name] || i.name)} — {ar ? 'متاح' : 'avail'}: {i.stock_grams}g</option>)}
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
type Bazaar = { id: string; name: string; location: string; start_date: string; end_date: string; fixed_cost: number; qty_sold: number; revenue_actual: number; notes: string }

function BoxMarginsPanel({ ar, cur, avgCogPerPiece, cogPerPiece, boxSalesCount, totalRevenue, fmt }: {
  ar: boolean; cur: string; avgCogPerPiece: number; cogPerPiece: (p: string) => number
  boxSalesCount: Record<number, number>; totalRevenue: number; fmt: (n: number) => string
}) {
  const [viewMode, setViewMode] = useState<'avg'|'max'>('avg')

  const maxCogPerPiece = Math.max(...Object.keys(RECIPES).map(p => cogPerPiece(p)))
  const maxCogProduct = Object.keys(RECIPES).find(p => cogPerPiece(p) === maxCogPerPiece) || ''
  const maxCostPerPiece = maxCogPerPiece + PACKAGING_COST_PER_PIECE
  const costPerPieceUsed = viewMode === 'avg' ? (avgCogPerPiece + PACKAGING_COST_PER_PIECE) : maxCostPerPiece

  const boxData = BOX_SIZES.map(({ label, labelEn, pieces }) => {
    const price = BOX_PRICE_MAP[pieces] || 0
    const totalCost = costPerPieceUsed * pieces
    const profit = price - totalCost
    const margin = price > 0 ? (profit / price) * 100 : 0
    const salesCount = boxSalesCount[pieces] || 0
    const totalRevForBox = salesCount * price
    const shareOfTotal = totalRevenue > 0 ? (totalRevForBox / totalRevenue) * 100 : 0
    return { label, labelEn, pieces, price, totalCost, profit, margin, salesCount, totalRevForBox, shareOfTotal }
  }).sort((a, b) => b.margin - a.margin)

  const bestBox = boxData[0]
  const mostSold = [...boxData].sort((a, b) => b.salesCount - a.salesCount)[0]
  const totalBoxSales = Object.values(boxSalesCount).reduce((s, n) => s + n, 0)

  return (
    <div className="space-y-4">
      {/* سويتش متوسط / أغلى قطعة */}
      <div className="bg-white rounded-2xl shadow-sm p-1 flex gap-1">
        <button
          onClick={() => setViewMode('avg')}
          className={`flex-1 py-2 px-3 rounded-xl text-sm font-bold transition-all ${viewMode === 'avg' ? 'bg-jumar-brown text-white' : 'text-gray-400'}`}
        >{ar ? '📊 متوسط القطع' : '📊 Avg Piece'}</button>
        <button
          onClick={() => setViewMode('max')}
          className={`flex-1 py-2 px-3 rounded-xl text-sm font-bold transition-all ${viewMode === 'max' ? 'bg-jumar-brown text-white' : 'text-gray-400'}`}
        >{ar ? '💎 أغلى قطعة' : '💎 Costliest Piece'}</button>
      </div>

      {/* معلومة التكلفة المستخدمة */}
      <div className={`rounded-xl p-3 text-xs ${viewMode === 'avg' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
        {viewMode === 'avg'
          ? `📊 ${ar ? 'تكلفة متوسط كل القطع' : 'Average across all products'}: ${(avgCogPerPiece + PACKAGING_COST_PER_PIECE).toFixed(2)} ${cur} / ${ar ? 'قطعة' : 'pc'}`
          : `💎 ${ar ? `أغلى قطعة: ${maxCogProduct}` : `Costliest: ${maxCogProduct}`} — ${maxCostPerPiece.toFixed(2)} ${cur} / ${ar ? 'قطعة' : 'pc'} ${ar ? '(الهامش الأدنى المضمون)' : '(worst-case margin)'}`
        }
      </div>

      {/* ملخص */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
          <p className="text-xs text-green-600 mb-1">{ar ? 'أعلى هامش ربح' : 'Best Margin'}</p>
          <p className="text-xl font-bold text-green-700">{ar ? bestBox.label : bestBox.labelEn}</p>
          <p className="text-sm text-green-600">{bestBox.margin.toFixed(1)}%</p>
        </div>
        {mostSold.salesCount > 0 && (
          <div className="bg-jumar-brown text-white rounded-2xl p-4 text-center">
            <p className="text-xs text-white/60 mb-1">{ar ? 'الأكثر مبيعاً' : 'Best Seller'}</p>
            <p className="text-xl font-bold text-jumar-gold">{ar ? mostSold.label : mostSold.labelEn}</p>
            <p className="text-sm text-white/80">{mostSold.salesCount} {ar ? 'بيعة' : 'sales'}</p>
          </div>
        )}
      </div>

      {/* جدول العلب */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="font-bold text-jumar-brown">{ar ? 'تفاصيل كل حجم علبة' : 'Box Size Breakdown'}</p>
          <p className="text-xs text-gray-400 mt-0.5">{ar ? `تكلفة القطعة: ${costPerPieceUsed.toFixed(2)} ج` : `Cost/pc: ${costPerPieceUsed.toFixed(2)} ${cur}`}</p>
        </div>
        <div className="divide-y divide-gray-50">
          {boxData.map(box => (
            <div key={box.pieces} className="p-4">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-800">{ar ? box.label : box.labelEn}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${box.margin >= 50 ? 'bg-green-100 text-green-700' : box.margin >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600'}`}>{box.margin.toFixed(1)}%</span>
                </div>
                <span className="font-bold text-jumar-brown">{fmt(box.price)} {cur}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2 mb-2 overflow-hidden">
                <div className={`h-2 rounded-full ${box.margin >= 50 ? 'bg-green-500' : box.margin >= 40 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${Math.min(100, Math.max(0, box.margin))}%` }} />
              </div>
              <div className="grid grid-cols-4 gap-1 text-center text-xs text-gray-500">
                <div><p className="text-gray-400">{ar ? 'تكلفة' : 'Cost'}</p><p className="font-bold text-red-500">{box.totalCost.toFixed(0)}{cur}</p></div>
                <div><p className="text-gray-400">{ar ? 'ربح' : 'Profit'}</p><p className="font-bold text-green-600">{box.profit.toFixed(0)}{cur}</p></div>
                <div><p className="text-gray-400">{ar ? 'مبيع' : 'Sold'}</p><p className="font-bold text-jumar-brown">{box.salesCount > 0 ? box.salesCount : '—'}</p></div>
                <div><p className="text-gray-400">{ar ? 'من الإيراد' : 'Share'}</p><p className="font-bold">{box.salesCount > 0 ? `${box.shareOfTotal.toFixed(1)}%` : '—'}</p></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {totalBoxSales === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
          💡 {ar ? 'الأرقام في عمود "مبيع" بتيجي من items_desc في المبيعات. لو مكتوبة بشكل مختلف هتظهر صفر.' : 'Sales counts come from items_desc field. If descriptions differ, counts show zero.'}
        </div>
      )}
    </div>
  )
}

function FinanceTab({ lang }: { lang: Lang }) {
  const ar = lang === 'ar'
  const [tab, setTab] = useState<'overview'|'pl'|'charts'|'comparison'|'cogs'|'inventory_turn'|'channels'|'customers'|'bazaar_roi'|'past_bazaars'|'cashflow'|'monthly_report'|'ltv'|'box_margins'|'stock_alert'|'sales'|'expenses'>('overview')
  const [reportMonth, setReportMonth] = useState(() => new Date().toISOString().substring(0, 7))
  const [kpis, setKpis] = useState<KPIs | null>(null)
  const [monthlyData, setMonthlyData] = useState<MonthRow[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [priceHistory, setPriceHistory] = useState<{ingredient_name: string; cost_per_gram: number; effective_date: string}[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [bazaars, setBazaars] = useState<Bazaar[]>([])
  const [loading, setLoading] = useState(true)
  const [saleForm, setSaleForm] = useState({ sale_date: new Date().toISOString().split('T')[0], channel: 'بازار', items_desc: '', qty_tamriya: 0, qty_fudge: 0, qty_sultana: 0, qty_snickers_fool: 0, qty_snickers_bunduq: 0, amount: '', customer_type: 'غريب', notes: '' })
  const [expenseForm, setExpenseForm] = useState({ expense_date: new Date().toISOString().split('T')[0], category: 'خامات', description: '', amount: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [priceForm, setPriceForm] = useState({ ingredient_name: '', cost_per_gram: '', effective_date: new Date().toISOString().split('T')[0] })

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: salesData }, { data: expensesData }, { data: ingData }, { data: ordersData }, { data: bazaarsData }, { data: priceHistoryData }] = await Promise.all([
      supabase.from('sales').select('*').order('sale_date', { ascending: false }),
      supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
      supabase.from('ingredients').select('*').order('name'),
      supabase.from('orders').select('*, customers(name, area, phone), order_items(product_name, quantity)').order('created_at', { ascending: false }),
      supabase.from('bazaars').select('*').order('start_date', { ascending: false }),
      supabase.from('ingredient_price_history').select('*').order('effective_date', { ascending: false }),
    ])
    if (salesData) setSales(salesData)
    if (expensesData) setExpenses(expensesData)
    if (ingData) setIngredients(ingData)
    if (ordersData) setOrders(ordersData)
    if (bazaarsData) setBazaars(bazaarsData)
    if (priceHistoryData) setPriceHistory(priceHistoryData)

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

  // جيب سعر الخامة في شهر معين من price history
  function getCostForMonth(ingName: string, month: string): number {
    // جيب كل الأسعار للخامة دي اللي تاريخها <= الشهر ده
    const relevant = priceHistory
      .filter(p => p.ingredient_name === ingName && p.effective_date.substring(0, 7) <= month)
      .sort((a, b) => b.effective_date.localeCompare(a.effective_date))
    if (relevant.length > 0) return relevant[0].cost_per_gram
    // fallback: السعر الحالي من ingredients
    const ing = ingredients.find(i => i.name === ingName)
    if (ing) return ing.cost_per_gram
    return DEFAULT_INGREDIENTS.find(i => i.name === ingName)?.cost_per_gram || 0
  }

  // COGS: تكلفة الخامات لكل قطعة لكل منتج (للشهر الحالي)
  function cogPerPiece(product: string): number {
    const recipe = RECIPES[product]
    if (!recipe) return 0
    return Object.entries(recipe).reduce((sum, [ingName, grams]) => {
      const ing = ingredients.find(i => i.name === ingName)
      return sum + (ing ? ing.cost_per_gram * grams : 0)
    }, 0)
  }

  // COGS لشهر معين من price history
  function cogPerPieceForMonth(product: string, month: string): number {
    const recipe = RECIPES[product]
    if (!recipe) return 0
    return Object.entries(recipe).reduce((sum, [ingName, grams]) => {
      return sum + getCostForMonth(ingName, month) * grams
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

  // ── استرداد رأس المال ──────────────────────────────────────────────────────
  const totalInvested = totalOpex  // إجمالي كل المصروفات = رأس المال المستثمر
  const capitalRecoveryPct = totalInvested > 0 ? (totalRevenue / totalInvested) * 100 : 0
  const capitalRemaining = totalInvested - totalRevenue  // المتبقي للاسترداد
  // فترة الاسترداد: بناءً على متوسط الربح الشهري
  const avgMonthlyNetProfit = monthlyData.length > 0
    ? monthlyData.slice(-3).reduce((s, m) => s + m.net, 0) / Math.min(monthlyData.slice(-3).length, 3)
    : 0
  const paybackMonths = avgMonthlyNetProfit > 0 && capitalRemaining > 0
    ? Math.ceil(capitalRemaining / avgMonthlyNetProfit)
    : null

  // ── LTV (قيمة العميل على المدى) ────────────────────────────────────────────
  // بناءً على orders فقط (العملاء المسجلين)
  const customerMap: Record<string, { count: number; total: number }> = {}
  orders.forEach(o => {
    const key = o.customers?.phone || o.id
    if (!customerMap[key]) customerMap[key] = { count: 0, total: 0 }
    customerMap[key].count += 1
    customerMap[key].total += Number(o.total_price || 0)
  })
  const customerList = Object.values(customerMap)
  const avgLTV = customerList.length > 0
    ? customerList.reduce((s, c) => s + c.total, 0) / customerList.length
    : 0
  const repeatLTV = customerList.filter(c => c.count > 1).length > 0
    ? customerList.filter(c => c.count > 1).reduce((s, c) => s + c.total, 0) / customerList.filter(c => c.count > 1).length
    : 0
  const repeatRate = customerList.length > 0
    ? (customerList.filter(c => c.count > 1).length / customerList.length) * 100
    : 0

  // ── هامش ربح حسب حجم العلبة ────────────────────────────────────────────────
  const BOX_PRICE_MAP: Record<number, number> = { 2: 70, 5: 170, 8: 260, 15: 450, 24: 650 }
  // استخراج المبيعات الفعلية من items_desc
  const boxSalesCount: Record<number, number> = { 2: 0, 5: 0, 8: 0, 15: 0, 24: 0 }
  sales.forEach(s => {
    if (!s.items_desc) return
    if (s.items_desc.includes('علبة ٢') || s.items_desc.includes('قطعتين')) boxSalesCount[2]++
    else if (s.items_desc.includes('علبة ٥')) boxSalesCount[5]++
    else if (s.items_desc.includes('علبة ٨')) boxSalesCount[8]++
    else if (s.items_desc.includes('علبة ١٥')) boxSalesCount[15]++
    else if (s.items_desc.includes('علبة ٢٤')) boxSalesCount[24]++
  })
  const totalBoxSales = Object.values(boxSalesCount).reduce((a, b) => a + b, 0)

  // ── مخزون آمن وفرصة ضايعة ──────────────────────────────────────────────────
  // أيام المخزون المتبقية لكل خامة (min across all)
  const daysActive = Object.keys(Object.fromEntries(sales.map(s => [s.sale_date, 1]))).length || 1
  // الاستهلاك الفعلي لكل خامة بناءً على qty كل منتج
  const PRODUCT_QTY_KEY: Record<string, keyof Sale> = {
    'تمرية الطحينة': 'qty_tamriya', 'فدج الكاجو': 'qty_fudge',
    'سلطانة الفستق': 'qty_sultana', 'سنيكرز الفول': 'qty_snickers_fool',
    'سنيكرز البندق': 'qty_snickers_bunduq',
  }
  const totalIngUse: Record<string, number> = {}
  sales.forEach(s => {
    Object.entries(RECIPES).forEach(([product, recipe]) => {
      const qtyKey = PRODUCT_QTY_KEY[product]
      const qty = qtyKey ? Number(s[qtyKey] || 0) : 0
      Object.entries(recipe).forEach(([ingName, grams]) => {
        totalIngUse[ingName] = (totalIngUse[ingName] || 0) + qty * grams
      })
    })
  })
  let minDaysLeft = Infinity
  let criticalIngredient = ''
  ingredients.forEach(ing => {
    const totalUsed = totalIngUse[ing.name] || 0
    const dailyUse = totalUsed / daysActive
    if (dailyUse > 0) {
      const days = ing.stock_grams / dailyUse
      if (days < minDaysLeft) { minDaysLeft = days; criticalIngredient = ing.name }
    }
  })
  const stockDaysLeft = minDaysLeft === Infinity ? null : Math.round(minDaysLeft)
  // فرص ضايعة: أي يوم وصل المخزون صفر (نستخدم حركة notes)
  const zeroStockDays = sales.filter(s => (s.notes || '').includes('نفد المخزون')).length

  // ── ROI البازار الحالي (أحدث بازار في الـ bazaars table) ───────────────────
  const currentBazaar = bazaars.length > 0 ? bazaars.find(b => b.end_date >= new Date().toISOString().split('T')[0]) || bazaars[0] : null
  const bazaarRevenue = currentBazaar
    ? (currentBazaar.revenue_actual || sales.filter(s => s.channel === 'بازار' && s.sale_date >= currentBazaar.start_date && s.sale_date <= currentBazaar.end_date).reduce((sum, s) => sum + Number(s.amount), 0))
    : sales.filter(s => s.channel === 'بازار').reduce((sum, s) => sum + Number(s.amount), 0)
  const bazaarCost = currentBazaar ? currentBazaar.fixed_cost : expenses.filter(e => e.category === 'رسوم بازار').reduce((sum, e) => sum + Number(e.amount), 0)
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
    ['charts',   ar ? '📈 رسوم بيانية' : '📈 Charts'],
    ['comparison', ar ? '🗓️ مقارنة شهرية' : '🗓️ Monthly Comparison'],
    ['cogs',     ar ? '🏭 تكلفة إنتاج' : '🏭 COGS'],
    ['inventory_turn', ar ? '🔄 دوران مخزون' : '🔄 Inventory'],
    ['channels', ar ? '📡 القنوات'    : '📡 Channels'],
    ['customers',ar ? '👥 العملاء'    : '👥 Customers'],
    ['bazaar_roi',ar ? '🏪 ROI بازار' : '🏪 Bazaar ROI'],
    ['past_bazaars', ar ? '📊 بازارات سابقة' : '📊 Past Bazaars'],
    ['cashflow', ar ? '💵 تدفق نقدي'  : '💵 Cash Flow'],
    ['monthly_report', ar ? '📄 تقرير شهري' : '📄 Monthly Report'],
    ['ltv',      ar ? '👤 LTV عملاء'  : '👤 Customer LTV'],
    ['box_margins', ar ? '📦 هامش العلب' : '📦 Box Margins'],
    ['stock_alert', ar ? '🚨 تنبيه مخزون' : '🚨 Stock Alert'],
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

            {/* استرداد رأس المال */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <h2 className="font-bold text-jumar-brown">💰 {ar ? 'استرداد رأس المال' : 'Capital Recovery'}</h2>
              </div>
              <div className="p-4">
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">{ar ? 'إجمالي المستثمر' : 'Total Invested'}</p>
                    <p className="text-lg font-bold text-red-500">{fmt(totalInvested)} {cur}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-xs text-gray-400 mb-0.5">{ar ? 'تم استرداده' : 'Recovered'}</p>
                    <p className="text-lg font-bold text-green-600">{fmt(totalRevenue)} {cur}</p>
                  </div>
                </div>
                <div className="w-full bg-red-100 rounded-full h-3 mb-2 overflow-hidden">
                  <div className="bg-green-500 h-3 rounded-full transition-all" style={{ width: `${Math.min(100, capitalRecoveryPct)}%` }} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold text-green-600">{capitalRecoveryPct.toFixed(1)}% {ar ? 'مسترد' : 'recovered'}</span>
                  {capitalRemaining > 0
                    ? <span className="text-xs text-red-400">{ar ? 'متبقي' : 'Remaining'}: {fmt(capitalRemaining)} {cur}</span>
                    : <span className="text-xs text-green-600 font-bold">✅ {ar ? 'تم الاسترداد الكامل' : 'Fully recovered'}</span>
                  }
                </div>
                {paybackMonths !== null && (
                  <div className="mt-3 bg-amber-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-amber-600 mb-0.5">{ar ? 'فترة الاسترداد المتوقعة' : 'Est. Payback Period'}</p>
                    <p className="text-xl font-bold text-amber-700">{paybackMonths} {ar ? 'شهر' : 'months'}</p>
                    <p className="text-xs text-amber-500">{ar ? `بناءً على متوسط آخر ${Math.min(monthlyData.slice(-3).length,3)} شهور` : `Based on last ${Math.min(monthlyData.slice(-3).length,3)} months avg`}</p>
                  </div>
                )}
              </div>
            </div>

            {/* تنبيه المخزون */}
            {stockDaysLeft !== null && stockDaysLeft <= 14 && (
              <div className={`rounded-2xl p-4 border ${stockDaysLeft <= 5 ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                <p className={`text-sm font-bold mb-1 ${stockDaysLeft <= 5 ? 'text-red-700' : 'text-amber-700'}`}>
                  {stockDaysLeft <= 5 ? '🚨' : '⚠️'} {ar ? 'تحذير المخزون' : 'Stock Warning'}
                </p>
                <p className={`text-xs ${stockDaysLeft <= 5 ? 'text-red-600' : 'text-amber-600'}`}>
                  {ar ? `${criticalIngredient} يكفي ~${stockDaysLeft} يوم بالمعدل الحالي` : `${INGREDIENT_EN[criticalIngredient] || criticalIngredient} covers ~${stockDaysLeft} days at current rate`}
                </p>
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

        {/* ── Charts ── */}
        {tab === 'charts' && (() => {
          const sorted = [...monthlyData].sort((a, b) => a.month.localeCompare(b.month))
          if (sorted.length === 0) return (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center text-amber-700 text-sm">
              {ar ? 'لا توجد بيانات كافية' : 'Not enough data yet'}
            </div>
          )

          // COGS per month
          const monthCogs = sorted.map(m => {
            const mSales = sales.filter(s => s.sale_date.startsWith(m.month))
            const qty = mSales.reduce((s, r) => s + (r.qty_tamriya||0)+(r.qty_fudge||0)+(r.qty_sultana||0)+(r.qty_snickers_fool||0)+(r.qty_snickers_bunduq||0), 0)
            const avgCog = Object.keys(RECIPES).reduce((s, p) => s + cogPerPieceForMonth(p, m.month), 0) / Object.keys(RECIPES).length
            return qty > 0 ? qty * (avgCog + PACKAGING_COST_PER_PIECE) : m.revenue * 0.30
          })

          const maxRev = Math.max(...sorted.map(m => m.revenue), 1)
          const W = 320
          const H = 180
          const PAD = { t: 16, r: 12, b: 36, l: 44 }
          const innerW = W - PAD.l - PAD.r
          const innerH = H - PAD.t - PAD.b
          const n = sorted.length
          const barW = Math.max(18, Math.min(48, innerW / n - 8))
          const gap = (innerW - barW * n) / Math.max(n - 1, 1)

          const xPos = (i: number) => PAD.l + i * (barW + (n > 1 ? gap : 0)) + barW / 2
          const yRev = (v: number) => PAD.t + innerH - (v / maxRev) * innerH

          // smooth line path
          const linePath = (pts: {x:number,y:number}[]) => {
            if (pts.length < 2) return pts.length === 1 ? `M${pts[0].x},${pts[0].y}` : ''
            let d = `M${pts[0].x},${pts[0].y}`
            for (let i = 1; i < pts.length; i++) {
              const cp1x = pts[i-1].x + (pts[i].x - pts[i-1].x) * 0.4
              const cp2x = pts[i].x - (pts[i].x - pts[i-1].x) * 0.4
              d += ` C${cp1x},${pts[i-1].y} ${cp2x},${pts[i].y} ${pts[i].x},${pts[i].y}`
            }
            return d
          }

          const shortLabel = (m: string) => {
            const months: Record<string,string> = { '01': ar?'ي':'Jan','02': ar?'ف':'Feb','03': ar?'م':'Mar','04': ar?'أ':'Apr','05': ar?'مي':'May','06': ar?'يو':'Jun','07': ar?'يل':'Jul','08': ar?'أغ':'Aug','09': ar?'س':'Sep','10': ar?'أك':'Oct','11': ar?'ن':'Nov','12': ar?'د':'Dec' }
            return months[m.split('-')[1]] || m
          }

          // chart colors
          const BROWN = '#8B4513'
          const GOLD = '#D4A017'
          const GREEN = '#16a34a'
          const RED = '#ef4444'

          // revenue points
          const revPts = sorted.map((m, i) => ({ x: xPos(i), y: yRev(m.revenue) }))
          const netPts = sorted.map((m, i) => ({ x: xPos(i), y: yRev(Math.max(0, m.net)) }))

          // area fill for revenue line
          const areaPath = revPts.length > 1
            ? `${linePath(revPts)} L${revPts[revPts.length-1].x},${PAD.t+innerH} L${revPts[0].x},${PAD.t+innerH} Z`
            : ''

          const gridVals = [0, 0.25, 0.5, 0.75, 1]

          // margin data
          const margins = sorted.map((m, i) => m.revenue > 0 ? Math.max(0, (m.revenue - monthCogs[i]) / m.revenue * 100) : 0)

          // expense donut data
          const lastMonth = sorted[sorted.length - 1]?.month || ''
          const mExp = expenses.filter(e => e.expense_date.startsWith(lastMonth))
          const bycat: Record<string, number> = {}
          mExp.forEach(e => { bycat[e.category] = (bycat[e.category] || 0) + Number(e.amount) })
          const expTotal = Object.values(bycat).reduce((s, v) => s + v, 0)
          const SLICE_COLORS = ['#8B4513','#D4A017','#16a34a','#7c3aed','#0891b2','#db2777','#f97316','#65a30d']
          const expEntries = Object.entries(bycat).sort(([,a],[,b]) => b - a)

          // donut arcs
          const donutArcs = (() => {
            if (expTotal === 0) return []
            const R = 52, cx = 80, cy = 72, thickness = 22
            let angle = -Math.PI / 2
            return expEntries.map(([cat, v], i) => {
              const sweep = (v / expTotal) * 2 * Math.PI
              const x1 = cx + R * Math.cos(angle)
              const y1 = cy + R * Math.sin(angle)
              const x2 = cx + R * Math.cos(angle + sweep)
              const y2 = cy + R * Math.sin(angle + sweep)
              const large = sweep > Math.PI ? 1 : 0
              const ir = R - thickness
              const ix1 = cx + ir * Math.cos(angle + sweep)
              const iy1 = cy + ir * Math.sin(angle + sweep)
              const ix2 = cx + ir * Math.cos(angle)
              const iy2 = cy + ir * Math.sin(angle)
              const path = `M${x1.toFixed(1)},${y1.toFixed(1)} A${R},${R} 0 ${large},1 ${x2.toFixed(1)},${y2.toFixed(1)} L${ix1.toFixed(1)},${iy1.toFixed(1)} A${ir},${ir} 0 ${large},0 ${ix2.toFixed(1)},${iy2.toFixed(1)} Z`
              const result = { path, color: SLICE_COLORS[i % SLICE_COLORS.length], cat, v, pct: (v/expTotal*100).toFixed(0) }
              angle += sweep
              return result
            })
          })()

          return (
            <div className="space-y-4">

              {/* ١. Revenue + Net Profit — area line chart */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-jumar-brown text-sm">📈 {ar ? 'الإيرادات الشهرية' : 'Monthly Revenue'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{ar ? 'إجمالي' : 'Total'}: {fmt(sorted.reduce((s,m)=>s+m.revenue,0))} {cur}</p>
                  </div>
                  <div className="flex gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><span className="w-6 h-0.5 rounded bg-jumar-brown inline-block" />{ar?'إيرادات':'Revenue'}</span>
                    <span className="flex items-center gap-1"><span className="w-6 h-0.5 rounded bg-green-500 inline-block" />{ar?'صافي':'Net'}</span>
                  </div>
                </div>
                <div className="px-2 pb-3 overflow-x-auto">
                  <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block w-full" style={{minWidth: 240}}>
                    <defs>
                      <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={BROWN} stopOpacity="0.18" />
                        <stop offset="100%" stopColor={BROWN} stopOpacity="0.01" />
                      </linearGradient>
                      <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={GREEN} stopOpacity="0.15" />
                        <stop offset="100%" stopColor={GREEN} stopOpacity="0.01" />
                      </linearGradient>
                    </defs>
                    {/* grid */}
                    {gridVals.map(pct => {
                      const y = PAD.t + innerH - pct * innerH
                      return (
                        <g key={pct}>
                          <line x1={PAD.l} y1={y} x2={PAD.l+innerW} y2={y} stroke="#f0f0f0" strokeWidth={1} />
                          <text x={PAD.l-4} y={y+3.5} textAnchor="end" fontSize={8} fill="#bbb">{Math.round(maxRev*pct/1000)}k</text>
                        </g>
                      )
                    })}
                    {/* revenue area */}
                    {areaPath && <path d={areaPath} fill="url(#revGrad)" />}
                    {/* net area */}
                    {netPts.length > 1 && (
                      <path d={`${linePath(netPts)} L${netPts[netPts.length-1].x},${PAD.t+innerH} L${netPts[0].x},${PAD.t+innerH} Z`} fill="url(#netGrad)" />
                    )}
                    {/* revenue line */}
                    {revPts.length > 1 && <path d={linePath(revPts)} fill="none" stroke={BROWN} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />}
                    {/* net line */}
                    {netPts.length > 1 && <path d={linePath(netPts)} fill="none" stroke={GREEN} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5,3" />}
                    {/* dots + labels */}
                    {sorted.map((m, i) => {
                      const x = xPos(i)
                      const yr = yRev(m.revenue)
                      const label = shortLabel(m.month)
                      return (
                        <g key={m.month}>
                          <circle cx={x} cy={yr} r={4} fill="white" stroke={BROWN} strokeWidth={2} />
                          {m.revenue > 0 && <text x={x} y={yr - 8} textAnchor="middle" fontSize={8} fill={BROWN} fontWeight="bold">{Math.round(m.revenue/1000)}k</text>}
                          <text x={x} y={H - 4} textAnchor="middle" fontSize={9} fill="#888">{label}</text>
                        </g>
                      )
                    })}
                    {/* axes */}
                    <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t+innerH} stroke="#e5e7eb" strokeWidth={1} />
                    <line x1={PAD.l} y1={PAD.t+innerH} x2={PAD.l+innerW} y2={PAD.t+innerH} stroke="#e5e7eb" strokeWidth={1} />
                  </svg>
                </div>
              </div>

              {/* ٢. Gross Margin — gradient bars */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 pt-4 pb-2">
                  <p className="font-bold text-jumar-brown text-sm">📊 {ar ? 'هامش الربح الإجمالي' : 'Gross Margin %'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{ar ? 'الخط المتقطع = هدف ٤٠٪' : 'Dashed line = 40% target'}</p>
                </div>
                <div className="px-2 pb-3 overflow-x-auto">
                  <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block w-full" style={{minWidth: 240}}>
                    <defs>
                      {margins.map((pct, i) => {
                        const c = pct >= 50 ? ['#4ade80','#16a34a'] : pct >= 35 ? ['#fde68a','#f59e0b'] : ['#fca5a5','#ef4444']
                        return (
                          <linearGradient key={i} id={`mg${i}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={c[0]} />
                            <stop offset="100%" stopColor={c[1]} />
                          </linearGradient>
                        )
                      })}
                    </defs>
                    {/* grid 0/25/50/75/100 */}
                    {[0,25,50,75,100].map(p => {
                      const y = PAD.t + innerH - (p/100) * innerH
                      return (
                        <g key={p}>
                          <line x1={PAD.l} y1={y} x2={PAD.l+innerW} y2={y} stroke={p===40?'transparent':'#f0f0f0'} strokeWidth={1} />
                          <text x={PAD.l-4} y={y+3.5} textAnchor="end" fontSize={8} fill="#bbb">{p}%</text>
                        </g>
                      )
                    })}
                    {/* target 40% dashed */}
                    <line x1={PAD.l} y1={PAD.t + innerH * 0.6} x2={PAD.l+innerW} y2={PAD.t + innerH * 0.6} stroke={GOLD} strokeWidth={1.5} strokeDasharray="5,3" />
                    <text x={PAD.l+innerW} y={PAD.t + innerH * 0.6 - 4} textAnchor="end" fontSize={8} fill={GOLD} fontWeight="bold">40%</text>
                    {/* bars */}
                    {sorted.map((m, i) => {
                      const mg = margins[i]
                      const barHeight = (mg / 100) * innerH
                      const x = PAD.l + i * (barW + (n > 1 ? gap : 0))
                      const y = PAD.t + innerH - barHeight
                      return (
                        <g key={m.month}>
                          <rect x={x} y={y} width={barW} height={barHeight} fill={`url(#mg${i})`} rx={6} />
                          {barHeight > 20 && <text x={x+barW/2} y={y-5} textAnchor="middle" fontSize={8} fill={mg>=50?'#16a34a':mg>=35?'#f59e0b':'#ef4444'} fontWeight="bold">{mg.toFixed(0)}%</text>}
                          <text x={x+barW/2} y={H-4} textAnchor="middle" fontSize={9} fill="#888">{shortLabel(m.month)}</text>
                        </g>
                      )
                    })}
                    <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t+innerH} stroke="#e5e7eb" strokeWidth={1} />
                    <line x1={PAD.l} y1={PAD.t+innerH} x2={PAD.l+innerW} y2={PAD.t+innerH} stroke="#e5e7eb" strokeWidth={1} />
                  </svg>
                </div>
              </div>

              {/* ٣. Expense Donut */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-jumar-brown text-sm">💸 {ar ? 'توزيع المصروفات' : 'Expense Breakdown'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{fmtMonth(lastMonth)}</p>
                  </div>
                  {expTotal > 0 && <p className="text-sm font-bold text-red-500">{fmt(expTotal)} {cur}</p>}
                </div>
                {expTotal === 0
                  ? <p className="text-xs text-gray-400 text-center py-6">{ar ? 'لا توجد مصروفات' : 'No expenses'}</p>
                  : (
                    <div className="flex gap-2 px-3 pb-4 items-start">
                      {/* donut */}
                      <svg width={160} height={144} viewBox="0 0 160 144" className="flex-shrink-0">
                        {donutArcs.map((arc, i) => (
                          <path key={i} d={arc.path} fill={arc.color} opacity={0.9} />
                        ))}
                        <text x={80} y={68} textAnchor="middle" fontSize={10} fill="#555" fontWeight="bold">{expEntries.length}</text>
                        <text x={80} y={80} textAnchor="middle" fontSize={8} fill="#aaa">{ar?'فئات':'cats'}</text>
                      </svg>
                      {/* legend */}
                      <div className="flex-1 space-y-1.5 pt-1 min-w-0">
                        {expEntries.map(([cat, v], i) => {
                          const pct = expTotal > 0 ? (v / expTotal * 100) : 0
                          const catLabel = ar ? cat : (CATEGORY_EN[cat] || cat)
                          return (
                            <div key={cat} className="flex items-center gap-1.5 min-w-0">
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: SLICE_COLORS[i % SLICE_COLORS.length] }} />
                              <span className="text-xs text-gray-600 truncate flex-1">{catLabel}</span>
                              <span className="text-xs font-bold text-gray-700 flex-shrink-0">{pct.toFixed(0)}%</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                }
              </div>

              {/* ٤. Revenue vs Expenses stacked */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 pt-4 pb-2">
                  <p className="font-bold text-jumar-brown text-sm">⚖️ {ar ? 'الإيرادات مقابل المصروفات' : 'Revenue vs Expenses'}</p>
                </div>
                <div className="px-2 pb-3 overflow-x-auto">
                  {(() => {
                    const maxVal = Math.max(...sorted.map(m => Math.max(m.revenue, m.expenses)), 1)
                    const BH = 160
                    const bPad = { t: 12, r: 12, b: 32, l: 44 }
                    const bInnerW = W - bPad.l - bPad.r
                    const bInnerH = BH - bPad.t - bPad.b
                    const bBarW = Math.max(14, Math.min(36, bInnerW / n / 2 - 4))
                    const slot = bInnerW / n
                    return (
                      <svg width={W} height={BH} viewBox={`0 0 ${W} ${BH}`} className="block w-full" style={{minWidth: 240}}>
                        <defs>
                          <linearGradient id="revBar" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#a0522d" />
                            <stop offset="100%" stopColor="#8B4513" />
                          </linearGradient>
                          <linearGradient id="expBar" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#fca5a5" />
                            <stop offset="100%" stopColor="#ef4444" />
                          </linearGradient>
                        </defs>
                        {[0,0.25,0.5,0.75,1].map(p => {
                          const y = bPad.t + bInnerH - p * bInnerH
                          return (
                            <g key={p}>
                              <line x1={bPad.l} y1={y} x2={bPad.l+bInnerW} y2={y} stroke="#f0f0f0" strokeWidth={1} />
                              <text x={bPad.l-4} y={y+3.5} textAnchor="end" fontSize={8} fill="#bbb">{Math.round(maxVal*p/1000)}k</text>
                            </g>
                          )
                        })}
                        {sorted.map((m, i) => {
                          const cx = bPad.l + i * slot + slot / 2
                          const rH = (m.revenue / maxVal) * bInnerH
                          const eH = (m.expenses / maxVal) * bInnerH
                          return (
                            <g key={m.month}>
                              <rect x={cx - bBarW - 2} y={bPad.t + bInnerH - rH} width={bBarW} height={rH} fill="url(#revBar)" rx={4} />
                              <rect x={cx + 2} y={bPad.t + bInnerH - eH} width={bBarW} height={eH} fill="url(#expBar)" rx={4} />
                              <text x={cx} y={BH - 4} textAnchor="middle" fontSize={9} fill="#888">{shortLabel(m.month)}</text>
                            </g>
                          )
                        })}
                        <line x1={bPad.l} y1={bPad.t} x2={bPad.l} y2={bPad.t+bInnerH} stroke="#e5e7eb" strokeWidth={1} />
                        <line x1={bPad.l} y1={bPad.t+bInnerH} x2={bPad.l+bInnerW} y2={bPad.t+bInnerH} stroke="#e5e7eb" strokeWidth={1} />
                      </svg>
                    )
                  })()}
                </div>
                <div className="flex gap-4 px-4 pb-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-jumar-brown inline-block" />{ar?'إيرادات':'Revenue'}</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400 inline-block" />{ar?'مصروفات':'Expenses'}</span>
                </div>
              </div>

            </div>
          )
        })()}

        {/* ── Monthly Comparison ── */}
        {tab === 'comparison' && (() => {
          const sorted = [...monthlyData].sort((a, b) => a.month.localeCompare(b.month))
          if (sorted.length < 2) return (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center text-amber-700 text-sm">
              {ar ? 'تحتاج شهرين على الأقل للمقارنة' : 'Need at least 2 months to compare'}
            </div>
          )

          // حساب بيانات كل شهر
          const monthStats = sorted.map(m => {
            const mSales = sales.filter(s => s.sale_date.startsWith(m.month))
            const mExp = expenses.filter(e => e.expense_date.startsWith(m.month))
            const qty = mSales.reduce((s, r) => s + (r.qty_tamriya||0)+(r.qty_fudge||0)+(r.qty_sultana||0)+(r.qty_snickers_fool||0)+(r.qty_snickers_bunduq||0), 0)
            const avgCog = Object.keys(RECIPES).reduce((s, p) => s + cogPerPieceForMonth(p, m.month), 0) / Object.keys(RECIPES).length
            const expBycat: Record<string, number> = {}
            mExp.forEach(e => { expBycat[e.category] = (expBycat[e.category] || 0) + Number(e.amount) })
            const cogsAdj = expBycat['تسوية COGS'] || 0
            const cogs = qty > 0 ? qty * (avgCog + PACKAGING_COST_PER_PIECE) + cogsAdj : m.revenue * 0.30
            const grossProfit = m.revenue - cogs
            const grossMarginPct = m.revenue > 0 ? (grossProfit / m.revenue) * 100 : 0
            const netMarginPct = m.revenue > 0 ? (m.net / m.revenue) * 100 : 0
            const orders = mSales.length
            const aov = orders > 0 ? m.revenue / orders : 0
            return { month: m.month, revenue: m.revenue, expenses: m.expenses, net: m.net, cogs, grossProfit, grossMarginPct, netMarginPct, qty, orders, aov }
          })

          const delta = (curr: number, prev: number) => {
            if (prev === 0) return null
            const pct = ((curr - prev) / Math.abs(prev)) * 100
            return pct
          }

          return (
            <div className="space-y-4">
              <p className="text-xs text-gray-400 text-center">{ar ? 'مقارنة كل الأشهر — الأحدث على اليمين' : 'All months compared — newest on right'}</p>

              {/* جدول مقارنة */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-jumar-brown text-white">
                        <th className="px-3 py-2 text-right font-bold sticky left-0 bg-jumar-brown">{ar ? 'المؤشر' : 'Metric'}</th>
                        {monthStats.map(m => (
                          <th key={m.month} className="px-3 py-2 text-center font-bold whitespace-nowrap">{fmtMonth(m.month)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {[
                        { label: ar ? '💰 الإيرادات' : '💰 Revenue', key: 'revenue' as const, fmt: (v: number) => `${fmt(v)} ${cur}`, color: 'text-green-600' },
                        { label: ar ? '🏭 COGS' : '🏭 COGS', key: 'cogs' as const, fmt: (v: number) => `${fmt(v)} ${cur}`, color: 'text-orange-500' },
                        { label: ar ? '📊 إجمالي ربح' : '📊 Gross Profit', key: 'grossProfit' as const, fmt: (v: number) => `${fmt(v)} ${cur}`, color: 'text-blue-600' },
                        { label: ar ? '% هامش إجمالي' : '% Gross Margin', key: 'grossMarginPct' as const, fmt: (v: number) => `${v.toFixed(1)}%`, color: 'text-jumar-gold' },
                        { label: ar ? '💸 مصروفات' : '💸 Expenses', key: 'expenses' as const, fmt: (v: number) => `${fmt(v)} ${cur}`, color: 'text-red-500' },
                        { label: ar ? '✅ صافي ربح' : '✅ Net Profit', key: 'net' as const, fmt: (v: number) => `${v >= 0 ? '+' : ''}${fmt(v)} ${cur}`, color: (v: number) => v >= 0 ? 'text-green-600' : 'text-red-500' },
                        { label: ar ? '% هامش صافي' : '% Net Margin', key: 'netMarginPct' as const, fmt: (v: number) => `${v.toFixed(1)}%`, color: (v: number) => v >= 0 ? 'text-green-600' : 'text-red-500' },
                        { label: ar ? '📦 قطع مباعة' : '📦 Units Sold', key: 'qty' as const, fmt: (v: number) => v > 0 ? `${v}` : '—', color: 'text-jumar-brown' },
                        { label: ar ? '🛍️ أوردرات' : '🛍️ Orders', key: 'orders' as const, fmt: (v: number) => `${v}`, color: 'text-jumar-brown' },
                        { label: 'AOV', key: 'aov' as const, fmt: (v: number) => v > 0 ? `${fmt(v)} ${cur}` : '—', color: 'text-jumar-brown' },
                      ].map(({ label, key, fmt: fmtFn, color }) => (
                        <tr key={key} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium text-gray-600 sticky left-0 bg-white whitespace-nowrap">{label}</td>
                          {monthStats.map((m, i) => {
                            const val = m[key]
                            const prev = i > 0 ? monthStats[i-1][key] : null
                            const d = prev !== null ? delta(val as number, prev as number) : null
                            const colorClass = typeof color === 'function' ? color(val as number) : color
                            return (
                              <td key={m.month} className="px-3 py-2 text-center">
                                <span className={`font-bold ${colorClass}`}>{fmtFn(val as number)}</span>
                                {d !== null && Math.abs(d) > 0.5 && (
                                  <span className={`block text-center text-xs mt-0.5 ${d >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                                    {d >= 0 ? '▲' : '▼'}{Math.abs(d).toFixed(0)}%
                                  </span>
                                )}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Best month highlight */}
              {(() => {
                const bestRevMonth = monthStats.reduce((best, m) => m.revenue > best.revenue ? m : best, monthStats[0])
                const bestNetMonth = monthStats.reduce((best, m) => m.net > best.net ? m : best, monthStats[0])
                return (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-green-50 border border-green-200 rounded-2xl p-3 text-center">
                      <p className="text-xs text-green-600 mb-1">🏆 {ar ? 'أعلى إيراد' : 'Top Revenue'}</p>
                      <p className="font-bold text-green-700 text-sm">{fmtMonth(bestRevMonth.month)}</p>
                      <p className="text-xs text-green-600">{fmt(bestRevMonth.revenue)} {cur}</p>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 text-center">
                      <p className="text-xs text-blue-600 mb-1">💎 {ar ? 'أعلى ربح صافي' : 'Best Net Profit'}</p>
                      <p className="font-bold text-blue-700 text-sm">{fmtMonth(bestNetMonth.month)}</p>
                      <p className="text-xs text-blue-600">{fmt(bestNetMonth.net)} {cur}</p>
                    </div>
                  </div>
                )
              })()}
            </div>
          )
        })()}

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
                      <p className="font-bold text-jumar-brown">{ar ? product : (PRODUCT_EN[product] || product)}</p>
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
                          <span>{ar ? ing : (INGREDIENT_EN[ing] || ing)} ({grams}{ar ? 'ج' : 'g'})</span>
                          <span>{cost.toFixed(2)} {cur}</span>
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
                        {BOX_SIZES.map(({ label, labelEn, pieces }) => {
                          const boxSale = pieces === 2 ? 70 : pieces === 5 ? 170 : pieces === 8 ? 260 : pieces === 15 ? 450 : 650
                          const boxCost = totalCost * pieces
                          const boxMargin = boxSale > 0 ? ((boxSale - boxCost) / boxSale * 100) : 0
                          return (
                            <div key={pieces} className="text-center bg-gray-50 rounded-lg p-2">
                              <p className="text-xs text-gray-500">{ar ? label : labelEn}</p>
                              <p className="text-xs font-bold text-jumar-brown">{boxSale}{cur}</p>
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
                // تقدير الاستهلاك اليومي من RECIPES بناءً على qty فعلي
                const dailyUse = (totalIngUse[ing.name] || 0) / daysData
                const daysLeft = dailyUse > 0 ? Math.round(ing.stock_grams / dailyUse) : null
                const stockValue = ing.stock_grams * ing.cost_per_gram
                const isLow = ing.stock_grams < ing.min_stock
                const isCritical = daysLeft !== null && daysLeft < 7
                return (
                  <div key={ing.id} className={`bg-white rounded-xl p-4 shadow-sm border-r-4 ${isCritical ? 'border-red-400' : isLow ? 'border-amber-400' : 'border-green-400'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-gray-800">{ar ? ing.name : (INGREDIENT_EN[ing.name] || ing.name)}</p>
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
                    <p className="font-bold text-jumar-brown text-lg">{ar ? channel : (CHANNEL_EN[channel] || channel)}</p>
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
              const revenue = b.revenue_actual || bSales.reduce((s, r) => s + Number(r.amount), 0)
              const avgCOGS = (() => {
                const products = Object.entries(RECIPES).filter(([n]) => n !== 'سنيكرز البندق')
                const costs = products.map(([, recipe]) => Object.entries(recipe).reduce((sum, [ing, g]) => {
                  const found = ingredients.find(i => i.name === ing) || DEFAULT_INGREDIENTS.find(i => i.name === ing)
                  return sum + (found ? found.cost_per_gram * g : 0)
                }, 0) + PACKAGING_COST_PER_PIECE)
                return costs.length ? costs.reduce((a, x) => a + x, 0) / costs.length : 8.8
              })()
              const estQty = b.qty_sold || (revenue > 0 ? Math.round(revenue / 35) : 0)
              const cogs = estQty * avgCOGS
              const netProfit = revenue - b.fixed_cost - cogs
              const roi = b.fixed_cost > 0 ? (netProfit / b.fixed_cost) * 100 : null
              const days = Math.round((new Date(b.end_date).getTime() - new Date(b.start_date).getTime()) / 86400000) + 1
              return (
                <div key={b.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className={`px-4 py-3 flex justify-between items-center ${netProfit >= 0 ? 'bg-jumar-brown' : 'bg-red-600'}`}>
                    <div>
                      <p className="font-bold text-white">{ar ? b.name : (BAZAAR_EN[b.name] || b.name)}</p>
                      <p className="text-xs text-white/60">{ar ? b.location : (BAZAAR_LOCATION_EN[b.location] || b.location)} · {days} {ar ? 'أيام' : 'days'}</p>
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
                      <span className="text-xs text-gray-600 w-20 flex-shrink-0">{ar ? cat : (CATEGORY_EN[cat] || cat)}</span>
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

        {/* ── التقرير المالي الشهري ── */}
        {tab === 'monthly_report' && (() => {
          // بيانات الشهر المختار
          const mSales = sales.filter(s => s.sale_date.startsWith(reportMonth))
          const mExpenses = expenses.filter(e => e.expense_date.startsWith(reportMonth))

          // إيرادات
          const mRevenue = mSales.reduce((s, r) => s + Number(r.amount), 0)
          const byChannel: Record<string, number> = {}
          mSales.forEach(s => { byChannel[s.channel] = (byChannel[s.channel] || 0) + Number(s.amount) })
          const byCustomerType: Record<string, number> = {}
          mSales.forEach(s => { if (s.customer_type) byCustomerType[s.customer_type] = (byCustomerType[s.customer_type] || 0) + Number(s.amount) })

          // كميات
          const mQtySold = mSales.reduce((s, r) => s + (r.qty_tamriya||0)+(r.qty_fudge||0)+(r.qty_sultana||0)+(r.qty_snickers_fool||0)+(r.qty_snickers_bunduq||0), 0)
          const mGiftQty = mSales.reduce((s, r) => { const m = (r.notes||'').match(/gift:(\d+)/); return s + (m ? parseInt(m[1]) : 0) }, 0)
          const mOrderCount = mSales.length
          const mAOV = mOrderCount > 0 ? mRevenue / mOrderCount : 0

          // COGS — بيستخدم أسعار الشهر من ingredient_price_history
          const mAvgCOG = (() => {
            const products = Object.keys(RECIPES).filter(n => n !== 'سنيكرز البندق')
            const costs = products.map(p => cogPerPieceForMonth(p, reportMonth))
            return costs.length ? costs.reduce((a, x) => a + x, 0) / costs.length : 7.3
          })()
          // مصروفات
          const mTotalExpenses = mExpenses.reduce((s, e) => s + Number(e.amount), 0)
          const mExpByCategory: Record<string, number> = {}
          mExpenses.forEach(e => { mExpByCategory[e.category] = (mExpByCategory[e.category] || 0) + Number(e.amount) })

          const mCOGSIngredients = mQtySold > 0 ? mQtySold * mAvgCOG : (mRevenue * 0.54)
          const mCOGSAdjustment = mExpByCategory['تسوية COGS'] || 0
          const mCOGS = mCOGSIngredients + mCOGSAdjustment
          const mGrossProfit = mRevenue - mCOGS
          const mGrossMargin = mRevenue > 0 ? (mGrossProfit / mRevenue) * 100 : 0

          // تصنيف المصروفات
          const mMarketing = (mExpByCategory['تسويق'] || 0)
          const mBazaarFees = (mExpByCategory['رسوم بازار'] || 0)
          const mPackaging = (mExpByCategory['تغليف'] || 0)
          const mFixed = (mExpByCategory['عمالة'] || 0) + (mExpByCategory['إيجار'] || 0) + (mExpByCategory['معدات'] || 0)

          // صافي الربح
          const mNetProfit = mGrossProfit - mTotalExpenses
          const mNetMargin = mRevenue > 0 ? (mNetProfit / mRevenue) * 100 : 0

          // KPIs
          const mROAS = mMarketing > 0 ? (mRevenue / mMarketing) * 100 : null
          const mCAC = mOrderCount > 0 && mMarketing > 0 ? mMarketing / mOrderCount : null

          // بازار الشهر
          const mBazaar = bazaars.find(b => b.start_date.startsWith(reportMonth) || b.end_date.startsWith(reportMonth))
          const mBazaarRevenue = mBazaar?.revenue_actual || byChannel['بازار'] || 0
          const mBazaarCost = mBazaar?.fixed_cost || mBazaarFees
          const mBazaarNet = mBazaarRevenue - mBazaarCost
          const mBazaarROI = mBazaarCost > 0 ? (mBazaarNet / mBazaarCost) * 100 : null

          // حسابات مخزون
          const inventoryVal = ingredients.reduce((s, i) => s + i.stock_grams * i.cost_per_gram, 0)

          // اشتقاق تاريخ نهاية الشهر
          const [y, mo] = reportMonth.split('-').map(Number)
          const lastDay = new Date(y, mo, 0).toLocaleDateString(ar ? 'ar-EG' : 'en-US', { day:'numeric', month:'long', year:'numeric' })

          const arMonths: Record<string,string> = {'01':'يناير','02':'فبراير','03':'مارس','04':'أبريل','05':'مايو','06':'يونيو','07':'يوليو','08':'أغسطس','09':'سبتمبر','10':'أكتوبر','11':'نوفمبر','12':'ديسمبر'}
          const monthLabel = ar ? `${arMonths[reportMonth.split('-')[1]]} ${reportMonth.split('-')[0]}` : new Date(y, mo-1).toLocaleString('en-US', {month:'long', year:'numeric'})

          const Row = ({ label, value, color='text-gray-800', bold=false, indent=false }: { label: string; value: string; color?: string; bold?: boolean; indent?: boolean }) => (
            <div className={`flex justify-between items-center px-4 py-2 ${indent ? 'bg-gray-50' : ''}`}>
              <span className={`text-sm ${indent ? 'text-gray-500 pr-4' : 'text-gray-700'} ${bold ? 'font-bold' : ''}`}>{label}</span>
              <span className={`text-sm font-semibold ${color}`}>{value}</span>
            </div>
          )

          return (
            <div className="space-y-4" id="monthly-report-print">
              {/* اختيار الشهر + PDF */}
              <div className="flex items-center gap-2 bg-white rounded-2xl p-3 shadow-sm">
                <span className="text-sm font-bold text-jumar-brown flex-shrink-0">{ar ? 'الشهر:' : 'Month:'}</span>
                <input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold" />
                <button
                  onClick={() => {
                    const printContent = document.getElementById('monthly-report-print')
                    if (!printContent) return
                    const win = window.open('', '_blank')
                    if (!win) return
                    win.document.write(`<!DOCTYPE html><html dir="${ar ? 'rtl' : 'ltr'}"><head>
                      <meta charset="utf-8"><title>JUMAR – ${monthLabel}</title>
                      <style>
                        body{font-family:Arial,sans-serif;padding:24px;color:#222;direction:${ar ? 'rtl' : 'ltr'}}
                        h1{color:#8B4513;margin-bottom:4px}
                        .section{margin-bottom:20px;border:1px solid #eee;border-radius:8px;overflow:hidden}
                        .section-header{background:#f5f0eb;padding:8px 12px;font-weight:bold;color:#8B4513;font-size:13px}
                        .row{display:flex;justify-content:space-between;padding:6px 12px;border-bottom:1px solid #f5f5f5;font-size:12px}
                        .row.indent{padding-right:24px;color:#666}
                        .row.total{font-weight:bold;background:#f9f9f9}
                        .green{color:#16a34a}.red{color:#dc2626}.gold{color:#d97706}
                        .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
                        .tile{border:1px solid #eee;border-radius:8px;padding:12px;text-align:center}
                        .tile .val{font-size:18px;font-weight:bold;margin-top:4px}
                        .tile .lbl{font-size:10px;color:#888}
                        @media print{body{padding:12px}}
                      </style>
                    </head><body>
                      <h1>جُمار — JUMAR</h1>
                      <p style="color:#888;font-size:12px;margin-bottom:16px">${ar ? 'التقرير المالي الشهري' : 'Monthly Financial Report'} · ${monthLabel}</p>
                      ${printContent.innerHTML}
                      <p style="font-size:10px;color:#aaa;margin-top:24px;text-align:center">Generated ${new Date().toLocaleDateString()}</p>
                    </body></html>`)
                    win.document.close()
                    win.focus()
                    setTimeout(() => win.print(), 400)
                  }}
                  className="flex-shrink-0 bg-jumar-brown text-white text-xs px-3 py-2 rounded-xl font-bold hover:bg-jumar-brown/80 transition-all"
                >⬇️ PDF</button>
              </div>

              {mRevenue === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 text-center">
                  {ar ? 'لا توجد مبيعات مسجلة لهذا الشهر' : 'No sales recorded for this month'}
                </div>
              )}

              {/* ملخص تنفيذي */}
              <div className="bg-jumar-brown text-white rounded-2xl p-5">
                <p className="text-xs text-white/60 mb-1">{ar ? 'التقرير المالي' : 'Financial Report'}</p>
                <h2 className="text-xl font-bold text-jumar-gold mb-3">{monthLabel}</h2>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: ar ? 'إجمالي الإيرادات' : 'Total Revenue', value: `${fmt(mRevenue)} ${cur}`, color: 'text-jumar-gold' },
                    { label: ar ? 'صافي الربح' : 'Net Profit', value: `${mNetProfit >= 0 ? '+' : ''}${fmt(mNetProfit)} ${cur}`, color: mNetProfit >= 0 ? 'text-green-300' : 'text-red-300' },
                    { label: ar ? 'هامش إجمالي' : 'Gross Margin', value: `${mGrossMargin.toFixed(1)}%`, color: 'text-white' },
                    { label: ar ? 'قطع مباعة' : 'Units Sold', value: `${mQtySold} ${ar ? 'قطعة' : 'pcs'}`, color: 'text-white' },
                  ].map((kpi, i) => (
                    <div key={i} className="bg-white/10 rounded-xl p-3 text-center">
                      <p className="text-xs text-white/60 mb-1 leading-snug">{kpi.label}</p>
                      <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ١. الإيرادات */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-green-50">
                  <h3 className="font-bold text-green-700">{ar ? '١' : '1'}. {ar ? 'الإيرادات' : 'Revenue'}</h3>
                </div>
                <div className="divide-y divide-gray-50">
                  <Row label={ar ? 'إجمالي الإيرادات' : 'Total Revenue'} value={`${fmt(mRevenue)} ${cur}`} color="text-green-600" bold />
                  {Object.entries(byChannel).sort(([,a],[,b]) => b-a).map(([ch, v]) => (
                    <Row key={ch} label={ar ? ch : (CHANNEL_EN[ch] || ch)} value={`${fmt(v)} ${cur} (${mRevenue > 0 ? ((v/mRevenue)*100).toFixed(0) : 0}%)`} color="text-green-600" indent />
                  ))}
                  <div className="px-4 py-2 bg-gray-50">
                    <div className="flex justify-between text-xs text-gray-400">
                      <span>{ar ? 'من دائرة قريبة (قريب/معرفة)' : 'Close circle'}</span>
                      <span>{fmt(byCustomerType['قريب/معرفة'] || 0)} {cur} ({mRevenue > 0 ? (((byCustomerType['قريب/معرفة']||0)/mRevenue)*100).toFixed(0) : 0}%)</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>{ar ? 'من عملاء خارجيين (غريب)' : 'External customers'}</span>
                      <span>{fmt(byCustomerType['غريب'] || 0)} {cur} ({mRevenue > 0 ? (((byCustomerType['غريب']||0)/mRevenue)*100).toFixed(0) : 0}%)</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-gray-100 text-center">
                    <div className="p-3"><p className="text-xs text-gray-400">{ar ? 'أوردرات' : 'Orders'}</p><p className="font-bold text-jumar-brown">{mOrderCount}</p></div>
                    <div className="p-3"><p className="text-xs text-gray-400">{ar ? 'قطع مباعة' : 'Sold'}</p><p className="font-bold text-jumar-brown">{mQtySold > 0 ? mQtySold : '—'}</p></div>
                    <div className="p-3"><p className="text-xs text-gray-400">AOV</p><p className="font-bold text-jumar-brown">{fmt(mAOV)} {cur}</p></div>
                  </div>
                </div>
              </div>

              {/* ٢. P&L */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-blue-50">
                  <h3 className="font-bold text-blue-700">{ar ? '٢' : '2'}. {ar ? 'قائمة الأرباح والخسائر' : 'Profit & Loss'}</h3>
                </div>
                <div className="divide-y divide-gray-50">
                  <Row label={ar ? 'إجمالي الإيرادات' : 'Revenue'} value={`${fmt(mRevenue)} ${cur}`} color="text-green-600" bold />
                  <Row label={`(-) ${ar ? 'تكلفة البضاعة (COGS)' : 'COGS'}`} value={`−${fmt(mCOGS)} ${cur}`} color="text-red-500" indent />
                  <div className="px-4 py-3 bg-green-50">
                    <div className="flex justify-between"><span className="font-bold text-sm text-gray-700">= {ar ? 'إجمالي الربح' : 'Gross Profit'}</span><span className="font-bold text-green-600">{fmt(mGrossProfit)} {cur}</span></div>
                    <p className="text-xs text-jumar-gold mt-0.5">{ar ? 'هامش إجمالي' : 'Gross margin'}: {mGrossMargin.toFixed(1)}% {mGrossMargin >= 40 ? '✅' : mGrossMargin >= 30 ? '⚠️' : '❌'}</p>
                  </div>
                  {Object.entries(mExpByCategory).filter(([,v]) => v > 0).sort(([,a],[,b]) => b-a).map(([cat, v]) => (
                    <Row key={cat} label={`(-) ${ar ? cat : (CATEGORY_EN[cat] || cat)}`} value={`−${fmt(v)} ${cur}`} color="text-red-400" indent />
                  ))}
                  {mGiftQty > 0 && <Row label={`(-) ${ar ? `هدايا (${mGiftQty} قطعة)` : `Gifts (${mGiftQty} pcs)`}`} value={`−${fmt(mGiftQty * (mAvgCOG + PACKAGING_COST_PER_PIECE))} ${cur}`} color="text-orange-400" indent />}
                  <div className={`px-4 py-3 ${mNetProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                    <div className="flex justify-between"><span className="font-bold text-gray-800">= {ar ? 'صافي الربح' : 'Net Profit'}</span><span className={`font-bold text-lg ${mNetProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{mNetProfit >= 0 ? '+' : '−'}{fmt(Math.abs(mNetProfit))} {cur}</span></div>
                    <p className="text-xs text-gray-500 mt-0.5">{ar ? 'هامش صافي' : 'Net margin'}: {mNetMargin.toFixed(1)}%</p>
                  </div>
                </div>
              </div>

              {/* ٣. تفاصيل المصروفات */}
              {mTotalExpenses > 0 && (
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 bg-red-50">
                    <h3 className="font-bold text-red-700">{ar ? '٣' : '3'}. {ar ? 'تفاصيل المصروفات' : 'Expense Breakdown'}</h3>
                    <p className="text-xs text-red-400 mt-0.5">{ar ? `الإجمالي: ${fmt(mTotalExpenses)} ${cur}` : `Total: ${fmt(mTotalExpenses)} ${cur}`}</p>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {Object.entries(mExpByCategory).filter(([,v]) => v > 0).sort(([,a],[,b]) => b-a).map(([cat, v]) => {
                      const pct = mTotalExpenses > 0 ? (v / mTotalExpenses * 100) : 0
                      const mExpItems = mExpenses.filter(e => e.category === cat)
                      return (
                        <div key={cat} className="px-4 py-3">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-semibold text-gray-700">{ar ? cat : (CATEGORY_EN[cat] || cat)}</span>
                            <span className="text-sm font-bold text-red-500">{fmt(v)} {cur}</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5 mb-1">
                            <div className="bg-red-400 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          {mExpItems.map(e => (
                            <p key={e.id} className="text-xs text-gray-400 mt-0.5">· {e.description} ({fmt(Number(e.amount))} {cur})</p>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ٤. KPIs التسويق */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-purple-50">
                  <h3 className="font-bold text-purple-700">٤. {ar ? 'مؤشرات الأداء' : 'KPIs'}</h3>
                </div>
                <div className="divide-y divide-gray-50">
                  {[
                    { label: 'ROAS', value: mROAS !== null ? `${mROAS.toFixed(0)}%` : '—', note: ar ? 'المقبول ≥ 200%' : 'Acceptable ≥ 200%', ok: mROAS !== null && mROAS >= 200 },
                    { label: ar ? 'CAC (تكلفة اكتساب عميل)' : 'CAC', value: mCAC !== null ? `${fmt(mCAC)} ${cur}` : '—', note: `AOV: ${fmt(mAOV)} ${cur}`, ok: mCAC !== null && mCAC < mAOV },
                    { label: ar ? 'هامش إجمالي' : 'Gross Margin', value: `${mGrossMargin.toFixed(1)}%`, note: ar ? 'المعتاد في قطاع الأغذية 30–40%' : 'Food sector avg 30–40%', ok: mGrossMargin >= 40 },
                    { label: ar ? 'متوسط قيمة الأوردر (AOV)' : 'AOV', value: `${fmt(mAOV)} ${cur}`, note: '', ok: mAOV >= 200 },
                  ].map((kpi, i) => (
                    <div key={i} className="flex justify-between items-center px-4 py-3">
                      <div><p className="text-sm text-gray-700">{kpi.label}</p>{kpi.note && <p className="text-xs text-gray-400">{kpi.note}</p>}</div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-800">{kpi.value}</span>
                        {kpi.value !== '—' && <span>{kpi.ok ? '✅' : '❌'}</span>}
                      </div>
                    </div>
                  ))}
                  {mBazaarROI !== null && (
                    <div className="flex justify-between items-center px-4 py-3">
                      <div><p className="text-sm text-gray-700">{ar ? 'ROI بازار الشهر' : 'Bazaar ROI'}</p><p className="text-xs text-gray-400">{ar ? 'إيراد − رسوم ÷ رسوم' : 'Net ÷ cost'}</p></div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-800">{mBazaarROI.toFixed(0)}%</span>
                        <span>{mBazaarROI >= 50 ? '✅' : mBazaarROI >= 0 ? '⚠️' : '❌'}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ٥. المركز النقدي */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-amber-50">
                  <h3 className="font-bold text-amber-700">٥. {ar ? 'المركز الحالي' : 'Current Position'}</h3>
                </div>
                <div className="divide-y divide-gray-50">
                  <Row label={ar ? 'قيمة مخزون الخامات' : 'Raw Material Inventory'} value={`${fmt(inventoryVal)} ${cur}`} color="text-jumar-brown" />
                  {mGiftQty > 0 && <Row label={ar ? `عينات مجانية (${mGiftQty} قطعة)` : `Free samples (${mGiftQty} pcs)`} value={`${fmt(mGiftQty * (mAvgCOG + PACKAGING_COST_PER_PIECE))} ${cur}`} color="text-orange-500" />}
                </div>
              </div>

              {/* ٦. ملاحظة ختامية */}
              <div className={`rounded-2xl p-4 ${mNetProfit >= 0 ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                <p className={`text-sm font-bold mb-1 ${mNetProfit >= 0 ? 'text-green-700' : 'text-amber-700'}`}>
                  {mNetProfit >= 0 ? '✅' : '💡'} {ar ? 'ملاحظة ختامية' : 'Summary'}
                </p>
                <p className={`text-xs leading-relaxed ${mNetProfit >= 0 ? 'text-green-600' : 'text-amber-600'}`}>
                  {ar
                    ? mNetProfit >= 0
                      ? `أغلق ${monthLabel} بصافي ربح ${fmt(mNetProfit)} ج وهامش إجمالي ${mGrossMargin.toFixed(1)}٪.`
                      : `سجّل ${monthLabel} خسارة صافية ${fmt(Math.abs(mNetProfit))} ج. السبب الرئيسي: ${
                          mMarketing > mBazaarFees ? 'إنفاق تسويقي مرتفع' :
                          mBazaarFees > 0 ? `رسوم بازار ${fmt(mBazaarFees)} ج` : 'مصروفات التشغيل'
                        }.`
                    : mNetProfit >= 0
                      ? `${monthLabel} closed with net profit of ${fmt(mNetProfit)} ${cur} and gross margin ${mGrossMargin.toFixed(1)}%.`
                      : `${monthLabel} recorded a net loss of ${fmt(Math.abs(mNetProfit))} ${cur}.`
                  }
                </p>
              </div>
            </div>
          )
        })()}

        {/* ── LTV العملاء ── */}
        {tab === 'ltv' && (
          <div className="space-y-4">
            {/* بطاقات رئيسية */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: ar ? 'متوسط LTV (كل العملاء)' : 'Avg LTV (all)', value: `${fmt(avgLTV)} ${cur}`, color: 'text-jumar-brown', sub: `${customerList.length} ${ar ? 'عميل' : 'customers'}` },
                { label: ar ? 'LTV العميل المكرر' : 'Repeat Customer LTV', value: repeatLTV > 0 ? `${fmt(repeatLTV)} ${cur}` : '—', color: 'text-green-600', sub: ar ? 'أعلى بكتير' : 'much higher' },
                { label: ar ? 'نسبة التكرار' : 'Repeat Rate', value: `${repeatRate.toFixed(1)}%`, color: repeatRate >= 20 ? 'text-green-600' : 'text-amber-600', sub: `${customerList.filter(c => c.count > 1).length} ${ar ? 'مكرر' : 'repeat'}` },
                { label: ar ? 'متوسط الطلب (AOV)' : 'AOV', value: `${fmt(avgOrderValue)} ${cur}`, color: 'text-jumar-gold', sub: `${orders.length} ${ar ? 'طلب' : 'orders'}` },
              ].map((kpi, i) => (
                <div key={i} className="bg-white rounded-2xl p-4 shadow-sm text-center">
                  <p className="text-xs text-gray-400 leading-snug mb-1">{kpi.label}</p>
                  <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
                  <p className="text-xs text-gray-300 mt-0.5">{kpi.sub}</p>
                </div>
              ))}
            </div>

            {/* مقارنة: عميل جديد vs مكرر */}
            {repeatLTV > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <p className="text-sm font-bold text-jumar-brown mb-3">📊 {ar ? 'جديد مقابل مكرر' : 'New vs Repeat'}</p>
                <div className="space-y-3">
                  {[
                    { label: ar ? 'عميل جديد (مرة واحدة)' : 'One-time customer', value: customerList.filter(c => c.count === 1).length > 0 ? customerList.filter(c=>c.count===1).reduce((s,c)=>s+c.total,0)/customerList.filter(c=>c.count===1).length : 0, color: 'bg-gray-300' },
                    { label: ar ? 'عميل مكرر (أكثر من مرة)' : 'Repeat customer', value: repeatLTV, color: 'bg-green-500' },
                  ].map((row, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs text-gray-500 mb-1"><span>{row.label}</span><span className="font-bold text-gray-700">{fmt(row.value)} {cur}</span></div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className={`${row.color} h-2 rounded-full`} style={{ width: `${Math.min(100, repeatLTV > 0 ? (row.value / repeatLTV) * 100 : 0)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-green-600 mt-3 font-semibold">
                  {repeatLTV > 0 && customerList.filter(c=>c.count===1).length > 0
                    ? `${ar ? '⬆️ العميل المكرر يساوي' : '⬆️ Repeat customer worth'} ${(repeatLTV / (customerList.filter(c=>c.count===1).reduce((s,c)=>s+c.total,0)/customerList.filter(c=>c.count===1).length || 1)).toFixed(1)}x ${ar ? 'العميل الجديد' : 'a new customer'}`
                    : ''
                  }
                </p>
              </div>
            )}

            {/* توزيع قيمة العملاء */}
            {customerList.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-100"><p className="font-bold text-jumar-brown">🏆 {ar ? 'أعلى عملاء بالقيمة' : 'Top Customers by Value'}</p></div>
                <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                  {Object.entries(customerMap).sort(([,a],[,b]) => b.total - a.total).slice(0, 10).map(([key, c], i) => {
                    const order = orders.find(o => (o.customers?.phone || o.id) === key)
                    return (
                      <div key={i} className="p-3 flex justify-between items-center">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{order?.customers?.name || `${ar ? 'عميل' : 'Customer'} #${i+1}`}</p>
                          <p className="text-xs text-gray-400">{order?.customers?.area || ''} · {c.count} {ar ? 'طلبات' : 'orders'}</p>
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-green-600 text-sm">{fmt(c.total)} {cur}</p>
                          {c.count > 1 && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{ar ? 'مكرر' : 'Repeat'}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {customerList.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">{ar ? 'سجّل طلبات بأسماء عملاء لحساب LTV' : 'Record orders with customer names to calculate LTV'}</div>
            )}
          </div>
        )}

        {/* ── هامش ربح العلب ── */}
        {tab === 'box_margins' && (
          <BoxMarginsPanel ar={ar} cur={cur} avgCogPerPiece={avgCogPerPiece} cogPerPiece={cogPerPiece} boxSalesCount={boxSalesCount} totalRevenue={totalRevenue} fmt={fmt} />
        )}

        {/* ── تنبيه المخزون المتقدم ── */}
        {tab === 'stock_alert' && (
          <div className="space-y-4">
            {/* شريط خطر */}
            {stockDaysLeft !== null && stockDaysLeft <= 14 && (
              <div className={`rounded-2xl p-4 ${stockDaysLeft <= 5 ? 'bg-red-600 text-white' : 'bg-amber-50 border border-amber-300'}`}>
                <p className={`font-bold text-lg mb-1 ${stockDaysLeft <= 5 ? 'text-white' : 'text-amber-800'}`}>
                  {stockDaysLeft <= 5 ? '🚨' : '⚠️'} {ar ? `المخزون يكفي ${stockDaysLeft} يوم فقط` : `Stock covers only ${stockDaysLeft} days`}
                </p>
                <p className={`text-sm ${stockDaysLeft <= 5 ? 'text-red-100' : 'text-amber-600'}`}>
                  {ar ? `أقل خامة: ${criticalIngredient}` : `Lowest: ${INGREDIENT_EN[criticalIngredient] || criticalIngredient}`}
                </p>
              </div>
            )}
            {stockDaysLeft !== null && stockDaysLeft > 14 && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
                <p className="text-green-700 font-bold text-lg">✅ {ar ? `المخزون يكفي ~${stockDaysLeft} يوم` : `Stock covers ~${stockDaysLeft} days`}</p>
                <p className="text-xs text-green-500 mt-1">{ar ? `أقل خامة: ${criticalIngredient}` : `Critical: ${INGREDIENT_EN[criticalIngredient] || criticalIngredient}`}</p>
              </div>
            )}

            {/* تفصيل كل خامة */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="font-bold text-jumar-brown">{ar ? 'تفصيل المخزون' : 'Stock Detail'}</p>
                <p className="text-xs text-gray-400 mt-0.5">{ar ? `بناءً على معدل ${totalQtySold} قطعة في ${daysActive} يوم` : `Based on ${totalQtySold} pcs over ${daysActive} days`}</p>
              </div>
              <div className="divide-y divide-gray-50">
                {ingredients.filter(ing => Object.values(RECIPES).some(r => r[ing.name])).map(ing => {
                  const dailyUse = (totalIngUse[ing.name] || 0) / daysActive
                  const daysLeft = dailyUse > 0 ? Math.round(ing.stock_grams / dailyUse) : null
                  const isCritical = daysLeft !== null && daysLeft <= 5
                  const isLow = daysLeft !== null && daysLeft <= 14
                  const pctLeft = ing.min_stock > 0 ? Math.min(100, (ing.stock_grams / ing.min_stock) * 100) : 100
                  return (
                    <div key={ing.id} className={`p-4 ${isCritical ? 'bg-red-50' : isLow ? 'bg-amber-50' : ''}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className={`font-semibold ${isCritical ? 'text-red-700' : 'text-gray-800'}`}>{ar ? ing.name : (INGREDIENT_EN[ing.name] || ing.name)}</p>
                          <p className="text-xs text-gray-400">{ing.stock_grams.toLocaleString()}g {ar ? 'متاح' : 'available'} · {ar ? 'حد أدنى' : 'min'}: {ing.min_stock}g</p>
                        </div>
                        <div className={`text-center px-3 py-1 rounded-xl ${isCritical ? 'bg-red-100' : isLow ? 'bg-amber-100' : 'bg-green-100'}`}>
                          <p className={`text-xl font-bold ${isCritical ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-green-600'}`}>{daysLeft ?? '∞'}</p>
                          <p className={`text-xs ${isCritical ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-green-500'}`}>{ar ? 'يوم' : 'days'}</p>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${isCritical ? 'bg-red-500' : isLow ? 'bg-amber-400' : 'bg-green-500'}`} style={{ width: `${Math.min(100, pctLeft)}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* نصيحة */}
            <div className="bg-jumar-brown text-white rounded-2xl p-4">
              <p className="text-sm font-bold text-jumar-gold mb-2">💡 {ar ? 'خامات تحتاج شراء الشهر الجاي' : 'Needs reorder this month'}</p>
              <div className="space-y-1">
                {ingredients.filter(ing => {
                  const dailyUse = (totalIngUse[ing.name] || 0) / daysActive
                  return dailyUse > 0 && ing.stock_grams / dailyUse <= 14
                }).map(ing => {
                  const dailyUse = (totalIngUse[ing.name] || 0) / daysActive
                  const needed = Math.ceil(dailyUse * 30)
                  return (
                    <div key={ing.id} className="flex justify-between text-sm">
                      <span className="text-white/80">{ar ? ing.name : (INGREDIENT_EN[ing.name] || ing.name)}</span>
                      <span className="text-jumar-gold font-bold">{needed.toLocaleString()}g {ar ? 'لشهر' : 'for 1 mo.'}</span>
                    </div>
                  )
                })}
                {ingredients.filter(ing => {
                  const dailyUse = (totalIngUse[ing.name] || 0) / daysActive
                  return dailyUse > 0 && ing.stock_grams / dailyUse <= 14
                }).length === 0 && (
                  <p className="text-white/60 text-sm">{ar ? 'مفيش خامات تحتاج شراء دلوقتي ✅' : 'No reorders needed now ✅'}</p>
                )}
              </div>
            </div>

            {/* تحديث سعر خامة */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h2 className="font-bold text-jumar-brown mb-3">💰 {ar ? 'تسجيل سعر خامة جديد' : 'Update Ingredient Price'}</h2>
              <form onSubmit={async e => {
                e.preventDefault()
                setSaving(true)
                await supabase.from('ingredient_price_history').insert({
                  ingredient_name: priceForm.ingredient_name,
                  cost_per_gram: Number(priceForm.cost_per_gram),
                  effective_date: priceForm.effective_date,
                })
                await loadData()
                setMsg(ar ? '✅ تم تسجيل السعر الجديد' : '✅ Price updated')
                setPriceForm({ ingredient_name: '', cost_per_gram: '', effective_date: new Date().toISOString().split('T')[0] })
                setSaving(false)
                setTimeout(() => setMsg(''), 3000)
              }} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">{ar ? 'الخامة' : 'Ingredient'}</label>
                    <select required value={priceForm.ingredient_name} onChange={e => setPriceForm({...priceForm, ingredient_name: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold">
                      <option value="">{ar ? 'اختار خامة' : 'Select'}</option>
                      {DEFAULT_INGREDIENTS.map(i => <option key={i.name} value={i.name}>{ar ? i.name : (INGREDIENT_EN[i.name] || i.name)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">{ar ? 'السعر (ج/جرام)' : 'Cost/gram'}</label>
                    <input type="number" required step="0.001" min="0" placeholder="0.000" value={priceForm.cost_per_gram} onChange={e => setPriceForm({...priceForm, cost_per_gram: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">{ar ? 'تاريخ التطبيق' : 'Effective Date'}</label>
                  <input type="date" required value={priceForm.effective_date} onChange={e => setPriceForm({...priceForm, effective_date: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold" />
                </div>
                <button type="submit" disabled={saving} className="w-full bg-jumar-gold text-white rounded-xl py-2.5 font-bold text-sm disabled:opacity-50">
                  {saving ? '...' : ar ? 'حفظ السعر' : 'Save Price'}
                </button>
                {msg && <p className="text-center text-green-600 text-sm">{msg}</p>}
              </form>
              {/* سجل الأسعار */}
              {priceHistory.length > 0 && (
                <div className="mt-4 border-t pt-3">
                  <p className="text-xs text-gray-500 font-bold mb-2">{ar ? 'آخر تحديثات الأسعار' : 'Recent Price Updates'}</p>
                  <div className="space-y-1">
                    {priceHistory.slice(0, 8).map(p => (
                      <div key={p.effective_date + p.ingredient_name} className="flex justify-between text-xs text-gray-600">
                        <span>{p.ingredient_name}</span>
                        <span className="text-jumar-gold font-bold">{p.cost_per_gram} {ar ? 'ج/ج' : 'EGP/g'}</span>
                        <span className="text-gray-400">{p.effective_date.substring(0, 7)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
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
                  <div><label className="text-xs text-gray-500 block mb-1">{ar ? 'القناة' : 'Channel'}</label><select value={saleForm.channel} onChange={e => setSaleForm({...saleForm, channel: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold">{CHANNELS.map(c => <option key={c} value={c}>{ar ? c : (CHANNEL_EN[c] || c)}</option>)}</select></div>
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
                  <div><label className="text-xs text-gray-500 block mb-1">{ar ? 'نوع العميل' : 'Customer Type'}</label><select value={saleForm.customer_type} onChange={e => setSaleForm({...saleForm, customer_type: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold">{['غريب','قريب/معرفة','متنوع','غير محدد'].map(c => <option key={c} value={c}>{ar ? c : (CUSTOMER_TYPE_EN[c] || c)}</option>)}</select></div>
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
                  <div><label className="text-xs text-gray-500 block mb-1">{ar ? 'الفئة' : 'Category'}</label><select value={expenseForm.category} onChange={e => setExpenseForm({...expenseForm, category: e.target.value})} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-jumar-gold">{EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{ar ? c : (CATEGORY_EN[c] || c)}</option>)}</select></div>
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
                      <div className="flex items-center gap-2 flex-1"><span className="text-sm text-gray-700">{ar ? cat : (CATEGORY_EN[cat] || cat)}</span><div className="flex-1 bg-gray-100 rounded-full h-1.5 mx-2"><div className="bg-jumar-gold h-1.5 rounded-full" style={{ width: `${pct}%` }} /></div><span className="text-xs text-gray-400">{pct}%</span></div>
                      <span className="font-bold text-red-500 text-sm mr-3">{fmt(total)} {cur}</span>
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
                <span className="text-sm text-gray-700 flex-1 min-w-0 truncate">{ar ? name : (PRODUCT_EN[name] || name)}</span>
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
                <span className="text-sm text-gray-700 flex-1">{ar ? name : (PRODUCT_EN[name] || name)}</span>
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
                <span className="text-sm text-gray-700 flex-1">{ar ? channel : (CHANNEL_EN[channel] || channel)}</span>
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
