'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Order, OrderStatus, STATUS_LABELS, STATUS_COLORS } from '@/lib/types'

const ADMIN_PASSWORD = 'jumar2026'

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all')

  useEffect(() => {
    if (!authed) return
    fetchOrders()

    // Real-time updates
    const channel = supabase
      .channel('orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchOrders())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [authed])

  async function fetchOrders() {
    setLoading(true)
    const { data } = await supabase
      .from('orders')
      .select('*, customers(*), order_items(*)')
      .order('created_at', { ascending: false })

    setOrders(data || [])
    setLoading(false)
  }

  async function updateStatus(orderId: string, status: OrderStatus) {
    await supabase.from('orders').update({ status, updated_at: new Date().toISOString() }).eq('id', orderId)
    fetchOrders()
  }

  function login() {
    if (password === ADMIN_PASSWORD) setAuthed(true)
    else alert('كلمة السر غلط')
  }

  if (!authed) return (
    <div className="min-h-screen flex items-center justify-center bg-jumar-cream p-6">
      <div className="bg-white rounded-2xl p-8 shadow-lg w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold text-jumar-brown mb-6">🌿 لوحة تحكم جُمار</h1>
        <input type="password" placeholder="كلمة السر" value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && login()}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-center mb-4 focus:outline-none focus:border-jumar-gold" />
        <button onClick={login}
          className="w-full bg-jumar-brown text-white font-bold py-3 rounded-xl hover:opacity-90">
          دخول
        </button>
      </div>
    </div>
  )

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
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-jumar-brown">🌿 لوحة تحكم جُمار</h1>
          <div className="text-sm text-gray-500">
            {orders.length} طلب إجمالي
          </div>
        </div>

        {/* Quick nav */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <a href="/admin/inventory"
            className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-3 hover:border hover:border-jumar-gold transition-all">
            <span className="text-2xl">📦</span>
            <div>
              <p className="font-bold text-jumar-brown text-sm">المخزون</p>
              <p className="text-xs text-gray-400">الخامات والأرصدة</p>
            </div>
          </a>
          <a href="/admin/finance"
            className="bg-white rounded-xl p-4 shadow-sm flex items-center gap-3 hover:border hover:border-jumar-gold transition-all">
            <span className="text-2xl">💰</span>
            <div>
              <p className="font-bold text-jumar-brown text-sm">الماليات</p>
              <p className="text-xs text-gray-400">إيرادات ومصروفات</p>
            </div>
          </a>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <div className="text-2xl font-bold text-blue-600">{counts.new}</div>
            <div className="text-xs text-gray-500">جديد</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <div className="text-2xl font-bold text-yellow-600">{counts.preparing}</div>
            <div className="text-xs text-gray-500">قيد التحضير</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <div className="text-2xl font-bold text-green-600">{counts.delivered}</div>
            <div className="text-xs text-gray-500">تم التوصيل</div>
          </div>
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {(['all', 'new', 'preparing', 'ready', 'shipped', 'delivered', 'cancelled'] as const).map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all ${
                filter === s ? 'bg-jumar-brown text-white' : 'bg-white text-gray-600 border border-gray-200'
              }`}>
              {s === 'all' ? `الكل (${counts.all})` : `${STATUS_LABELS[s]} (${counts[s]})`}
            </button>
          ))}
        </div>

        {/* Orders */}
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
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(order.created_at).toLocaleString('ar-EG')}
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="font-bold text-jumar-brown">{order.total_price} ج</p>
                    <p className="text-xs text-gray-500">{order.box_qty} قطعة</p>
                  </div>
                </div>

                {/* Items */}
                <div className="bg-gray-50 rounded-xl p-3 mb-3">
                  {order.order_items?.map(item => (
                    <div key={item.id} className="flex justify-between text-sm py-0.5">
                      <span className="text-gray-700">{item.product_name}</span>
                      <span className="font-semibold text-jumar-brown">× {item.quantity}</span>
                    </div>
                  ))}
                </div>

                {order.notes && (
                  <p className="text-sm text-gray-500 mb-3 bg-amber-50 rounded-lg p-2">
                    📝 {order.notes}
                  </p>
                )}

                {/* Status */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold ${STATUS_COLORS[order.status]}`}>
                    {STATUS_LABELS[order.status]}
                  </span>
                  <div className="flex gap-1.5 flex-wrap">
                    {(['new', 'preparing', 'ready', 'shipped', 'delivered', 'cancelled'] as OrderStatus[])
                      .filter(s => s !== order.status)
                      .map(s => (
                        <button key={s} onClick={() => updateStatus(order.id, s)}
                          className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:border-jumar-gold hover:text-jumar-brown transition-all">
                          {STATUS_LABELS[s]}
                        </button>
                      ))}
                  </div>
                </div>

                {/* WhatsApp */}
                <a href={`https://wa.me/${order.customers?.whatsapp || order.customers?.phone}`}
                  target="_blank" rel="noopener noreferrer"
                  className="mt-3 flex items-center gap-2 text-green-600 text-sm font-semibold">
                  📲 واتساب العميل
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
