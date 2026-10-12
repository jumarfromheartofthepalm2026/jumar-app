'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PRODUCTS, BOXES } from '@/lib/types'

export default function OrderPage() {
  const [boxIdx, setBoxIdx] = useState(0)
  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries(PRODUCTS.map(p => [p.key, 0]))
  )
  const [form, setForm] = useState({ name: '', phone: '', whatsapp: '', area: '', address: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const box = BOXES[boxIdx]
  const totalQty = Object.values(quantities).reduce((a, b) => a + b, 0)
  const remaining = box.qty - totalQty

  function setQty(key: string, val: number) {
    const newQty = { ...quantities, [key]: Math.max(0, val) }
    const total = Object.values(newQty).reduce((a, b) => a + b, 0)
    if (total <= box.qty) setQuantities(newQty)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.phone || !form.area) {
      setError('من فضلك أكملي البيانات المطلوبة')
      return
    }
    if (totalQty !== box.qty) {
      setError(`لازم تختاري ${box.qty} قطعة بالظبط — باقي ${remaining}`)
      return
    }

    setLoading(true)
    setError('')

    try {
      // Insert customer
      const { data: customer, error: custErr } = await supabase
        .from('customers')
        .insert({
          name: form.name,
          phone: form.phone,
          whatsapp: form.whatsapp || form.phone,
          area: form.area,
          address: form.address,
        })
        .select()
        .single()

      if (custErr) throw custErr

      // Insert order
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          customer_id: customer.id,
          status: 'new',
          box_qty: box.qty,
          total_price: box.price,
          notes: form.notes,
        })
        .select()
        .single()

      if (orderErr) throw orderErr

      // Insert order items
      const items = PRODUCTS
        .filter(p => quantities[p.key] > 0)
        .map(p => ({ order_id: order.id, product_name: p.name, quantity: quantities[p.key] }))

      const { error: itemsErr } = await supabase.from('order_items').insert(items)
      if (itemsErr) throw itemsErr

      setSuccess(true)
    } catch (err: any) {
      setError('حصل خطأ، حاولي تاني')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (success) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center bg-white rounded-2xl p-10 shadow-lg max-w-sm w-full">
        <div className="text-6xl mb-4">🌿</div>
        <h2 className="text-2xl font-bold text-jumar-brown mb-2">تم استلام طلبك!</h2>
        <p className="text-gray-600">هنتواصل معاكِ قريباً على واتساب.</p>
        <p className="text-sm text-gray-400 mt-4">جُمار — من قلب النخلة</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-jumar-cream py-8 px-4">
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-jumar-brown">جُمار 🌿</h1>
          <p className="text-jumar-gold mt-1">العجن مش الحشو</p>
          <p className="text-gray-600 mt-2 text-sm">تمريات طبيعية بدون سكر مضاف</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Box Size */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold text-jumar-brown text-lg mb-3">اختاري حجم العلبة</h2>
            <div className="grid grid-cols-3 gap-3">
              {BOXES.map((b, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => { setBoxIdx(i); setQuantities(Object.fromEntries(PRODUCTS.map(p => [p.key, 0]))) }}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    boxIdx === i
                      ? 'border-jumar-gold bg-jumar-gold/10 text-jumar-brown font-bold'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  <div className="text-xl font-bold">{b.qty}</div>
                  <div className="text-xs">قطعة</div>
                  <div className="text-sm font-semibold mt-1">{b.price} ج</div>
                </button>
              ))}
            </div>
          </div>

          {/* Products */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold text-jumar-brown text-lg">وزّعي القطع</h2>
              <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                remaining === 0 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {remaining === 0 ? '✅ اكتملت' : `باقي ${remaining}`}
              </span>
            </div>
            <div className="space-y-3">
              {PRODUCTS.map(p => (
                <div key={p.key} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="font-semibold text-gray-800">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.desc}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setQty(p.key, quantities[p.key] - 1)}
                      className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 font-bold hover:bg-gray-200">−</button>
                    <span className="w-6 text-center font-bold text-jumar-brown">{quantities[p.key]}</span>
                    <button type="button" onClick={() => setQty(p.key, quantities[p.key] + 1)}
                      className="w-8 h-8 rounded-full bg-jumar-gold/20 text-jumar-brown font-bold hover:bg-jumar-gold/40">+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Customer Info */}
          <div className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
            <h2 className="font-bold text-jumar-brown text-lg">بياناتك</h2>
            <input required placeholder="الاسم *" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right focus:outline-none focus:border-jumar-gold" />
            <input required placeholder="رقم الهاتف *" value={form.phone} type="tel"
              onChange={e => setForm({ ...form, phone: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right focus:outline-none focus:border-jumar-gold" />
            <input placeholder="رقم واتساب (لو مختلف)" value={form.whatsapp} type="tel"
              onChange={e => setForm({ ...form, whatsapp: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right focus:outline-none focus:border-jumar-gold" />
            <input required placeholder="المنطقة *" value={form.area}
              onChange={e => setForm({ ...form, area: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right focus:outline-none focus:border-jumar-gold" />
            <input placeholder="العنوان بالتفصيل" value={form.address}
              onChange={e => setForm({ ...form, address: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right focus:outline-none focus:border-jumar-gold" />
            <textarea placeholder="ملاحظات" value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right focus:outline-none focus:border-jumar-gold resize-none h-20" />
          </div>

          {error && <p className="text-red-600 text-center text-sm">{error}</p>}

          {/* Summary & Submit */}
          <div className="bg-jumar-brown text-white rounded-2xl p-5">
            <div className="flex justify-between mb-4">
              <span>علبة {box.qty} قطعة</span>
              <span className="font-bold">{box.price} ج</span>
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-jumar-gold text-jumar-brown font-bold py-4 rounded-xl text-lg hover:opacity-90 transition disabled:opacity-50">
              {loading ? 'جارٍ الإرسال...' : '🌿 اطلبي دلوقتي'}
            </button>
          </div>

        </form>

        <p className="text-center text-xs text-gray-400 mt-6">جُمار — من قلب النخلة 🌴</p>
      </div>
    </div>
  )
}
