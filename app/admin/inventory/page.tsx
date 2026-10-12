'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface Ingredient {
  id: string
  name: string
  unit: string
  stock_grams: number
  min_stock: number
  cost_per_gram: number
}

interface Movement {
  id: string
  ingredient_id: string
  type: 'in' | 'out' | 'adjust'
  grams: number
  cost: number
  note: string
  created_at: string
  ingredients?: { name: string }
}

const ADMIN_PASSWORD = 'jumar2026'

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

export default function InventoryPage() {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'stock' | 'add' | 'use' | 'history'>('stock')
  const [seeding, setSeeding] = useState(false)

  // Add stock form
  const [addForm, setAddForm] = useState({ ingredient_id: '', grams: '', cost: '', note: '' })
  // Use stock form
  const [useForm, setUseForm] = useState({ ingredient_id: '', grams: '', note: '' })
  // Adjust form
  const [adjustForm, setAdjustForm] = useState({ ingredient_id: '', grams: '', note: '' })

  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (!authed) return
    fetchAll()
  }, [authed])

  async function fetchAll() {
    setLoading(true)
    const [{ data: ing }, { data: mov }] = await Promise.all([
      supabase.from('ingredients').select('*').order('name'),
      supabase.from('stock_movements').select('*, ingredients(name)').order('created_at', { ascending: false }).limit(50),
    ])
    setIngredients(ing || [])
    setMovements(mov || [])
    setLoading(false)
  }

  async function seedIngredients() {
    setSeeding(true)
    for (const ing of DEFAULT_INGREDIENTS) {
      await supabase.from('ingredients').upsert({ ...ing, unit: 'جرام', stock_grams: 0 }, { onConflict: 'name' })
    }
    await fetchAll()
    setSeeding(false)
    setMsg('تم إضافة الخامات الافتراضية ✅')
  }

  async function handleAddStock(e: React.FormEvent) {
    e.preventDefault()
    if (!addForm.ingredient_id || !addForm.grams) return
    const grams = parseFloat(addForm.grams)
    const cost = parseFloat(addForm.cost) || 0
    const costPerGram = grams > 0 ? cost / grams : 0

    const { error } = await supabase.from('stock_movements').insert({
      ingredient_id: addForm.ingredient_id,
      type: 'in',
      grams,
      cost,
      note: addForm.note,
    })
    if (error) { setMsg('خطأ في الإضافة'); return }

    // Update ingredient stock and cost
    const ing = ingredients.find(i => i.id === addForm.ingredient_id)
    if (ing) {
      const newStock = ing.stock_grams + grams
      const newCostPerGram = cost > 0
        ? (ing.stock_grams * ing.cost_per_gram + cost) / newStock
        : ing.cost_per_gram
      await supabase.from('ingredients').update({
        stock_grams: newStock,
        cost_per_gram: newCostPerGram,
      }).eq('id', addForm.ingredient_id)
    }

    setAddForm({ ingredient_id: '', grams: '', cost: '', note: '' })
    setMsg('تم إضافة المخزون ✅')
    fetchAll()
  }

  async function handleUseStock(e: React.FormEvent) {
    e.preventDefault()
    if (!useForm.ingredient_id || !useForm.grams) return
    const grams = parseFloat(useForm.grams)

    const ing = ingredients.find(i => i.id === useForm.ingredient_id)
    if (!ing) return
    if (ing.stock_grams < grams) { setMsg('المخزون مش كفاية!'); return }

    await supabase.from('stock_movements').insert({
      ingredient_id: useForm.ingredient_id,
      type: 'out',
      grams,
      cost: grams * ing.cost_per_gram,
      note: useForm.note,
    })
    await supabase.from('ingredients').update({
      stock_grams: ing.stock_grams - grams,
    }).eq('id', useForm.ingredient_id)

    setUseForm({ ingredient_id: '', grams: '', note: '' })
    setMsg('تم خصم المخزون ✅')
    fetchAll()
  }

  async function handleAdjust(e: React.FormEvent) {
    e.preventDefault()
    if (!adjustForm.ingredient_id || !adjustForm.grams) return
    const newStock = parseFloat(adjustForm.grams)
    const ing = ingredients.find(i => i.id === adjustForm.ingredient_id)
    if (!ing) return
    const diff = newStock - ing.stock_grams

    await supabase.from('stock_movements').insert({
      ingredient_id: adjustForm.ingredient_id,
      type: 'adjust',
      grams: diff,
      cost: 0,
      note: adjustForm.note || `تصحيح جرد: من ${ing.stock_grams}ج إلى ${newStock}ج`,
    })
    await supabase.from('ingredients').update({ stock_grams: newStock }).eq('id', adjustForm.ingredient_id)

    setAdjustForm({ ingredient_id: '', grams: '', note: '' })
    setMsg('تم تصحيح الجرد ✅')
    fetchAll()
  }

  function login() {
    if (password === ADMIN_PASSWORD) setAuthed(true)
    else alert('كلمة السر غلط')
  }

  if (!authed) return (
    <div className="min-h-screen flex items-center justify-center bg-jumar-cream p-6">
      <div className="bg-white rounded-2xl p-8 shadow-lg w-full max-w-sm text-center">
        <h1 className="text-2xl font-bold text-jumar-brown mb-6">🌿 مخزون جُمار</h1>
        <input type="password" placeholder="كلمة السر" value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && login()}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-center mb-4 focus:outline-none focus:border-jumar-gold" />
        <button onClick={login} className="w-full bg-jumar-brown text-white font-bold py-3 rounded-xl hover:opacity-90">دخول</button>
      </div>
    </div>
  )

  const lowStock = ingredients.filter(i => i.stock_grams < i.min_stock)

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-jumar-brown">📦 مخزون جُمار</h1>
          <a href="/admin" className="text-sm text-gray-500 hover:text-jumar-brown">← لوحة التحكم</a>
        </div>

        {msg && (
          <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 mb-4 text-center text-sm">
            {msg}
            <button onClick={() => setMsg('')} className="mr-2 text-green-500">✕</button>
          </div>
        )}

        {/* Low stock alert */}
        {lowStock.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
            <p className="text-red-700 font-bold text-sm mb-1">⚠️ مخزون منخفض:</p>
            <p className="text-red-600 text-sm">{lowStock.map(i => i.name).join(' · ')}</p>
          </div>
        )}

        {/* Seed button */}
        {ingredients.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-center">
            <p className="text-amber-700 mb-3 text-sm">مفيش خامات مسجلة — ابدأ بإضافة الخامات الأساسية</p>
            <button onClick={seedIngredients} disabled={seeding}
              className="bg-jumar-brown text-white px-6 py-2 rounded-xl font-bold hover:opacity-90 disabled:opacity-50">
              {seeding ? 'جاري الإضافة...' : '🌿 أضف الخامات الأساسية'}
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {[
            { key: 'stock', label: '📊 المخزون الحالي' },
            { key: 'add', label: '➕ إضافة مشتريات' },
            { key: 'use', label: '🔽 خصم استخدام' },
            { key: 'history', label: '📋 السجل' },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all ${
                tab === t.key ? 'bg-jumar-brown text-white' : 'bg-white text-gray-600 border border-gray-200'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-400">جاري التحميل...</div>
        ) : (

          <>
            {/* Stock Overview */}
            {tab === 'stock' && (
              <div className="space-y-2">
                {ingredients.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">لا توجد خامات مسجلة</div>
                ) : ingredients.map(ing => {
                  const pct = Math.min(100, (ing.stock_grams / Math.max(ing.min_stock * 2, 1)) * 100)
                  const low = ing.stock_grams < ing.min_stock
                  return (
                    <div key={ing.id} className="bg-white rounded-xl p-4 shadow-sm">
                      <div className="flex justify-between items-center mb-2">
                        <div>
                          <span className="font-bold text-gray-800">{ing.name}</span>
                          {low && <span className="mr-2 text-xs text-red-500 font-semibold">⚠️ منخفض</span>}
                        </div>
                        <div className="text-left">
                          <span className={`font-bold text-lg ${low ? 'text-red-600' : 'text-jumar-brown'}`}>
                            {ing.stock_grams.toLocaleString('ar-EG')}
                          </span>
                          <span className="text-xs text-gray-400 mr-1">جرام</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className={`h-2 rounded-full transition-all ${low ? 'bg-red-400' : 'bg-jumar-gold'}`}
                          style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-xs text-gray-400">الحد الأدنى: {ing.min_stock}ج</span>
                        <span className="text-xs text-gray-400">{ing.cost_per_gram.toFixed(2)} ج/جرام</span>
                      </div>
                    </div>
                  )
                })}

                {/* Adjust stock */}
                <div className="bg-white rounded-xl p-4 shadow-sm mt-4">
                  <h3 className="font-bold text-jumar-brown mb-3">🔧 تصحيح جرد</h3>
                  <form onSubmit={handleAdjust} className="space-y-3">
                    <select value={adjustForm.ingredient_id}
                      onChange={e => setAdjustForm({ ...adjustForm, ingredient_id: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right focus:outline-none focus:border-jumar-gold">
                      <option value="">اختر الخامة</option>
                      {ingredients.map(i => <option key={i.id} value={i.id}>{i.name} — {i.stock_grams}ج</option>)}
                    </select>
                    <input type="number" placeholder="الكمية الفعلية (جرام)" value={adjustForm.grams}
                      onChange={e => setAdjustForm({ ...adjustForm, grams: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right focus:outline-none focus:border-jumar-gold" />
                    <input placeholder="سبب التصحيح" value={adjustForm.note}
                      onChange={e => setAdjustForm({ ...adjustForm, note: e.target.value })}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right focus:outline-none focus:border-jumar-gold" />
                    <button type="submit" className="w-full bg-jumar-brown text-white font-bold py-3 rounded-xl hover:opacity-90">
                      حفظ الجرد
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* Add Stock */}
            {tab === 'add' && (
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <h2 className="font-bold text-jumar-brown text-lg mb-4">➕ تسجيل مشتريات جديدة</h2>
                <form onSubmit={handleAddStock} className="space-y-3">
                  <select value={addForm.ingredient_id}
                    onChange={e => setAddForm({ ...addForm, ingredient_id: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right focus:outline-none focus:border-jumar-gold">
                    <option value="">اختر الخامة *</option>
                    {ingredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                  <input required type="number" placeholder="الكمية (جرام) *" value={addForm.grams}
                    onChange={e => setAddForm({ ...addForm, grams: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right focus:outline-none focus:border-jumar-gold" />
                  <input type="number" placeholder="التكلفة الإجمالية (جنيه)" value={addForm.cost}
                    onChange={e => setAddForm({ ...addForm, cost: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right focus:outline-none focus:border-jumar-gold" />
                  <input placeholder="ملاحظة (المصدر مثلاً)" value={addForm.note}
                    onChange={e => setAddForm({ ...addForm, note: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right focus:outline-none focus:border-jumar-gold" />
                  {addForm.grams && addForm.cost && (
                    <p className="text-sm text-jumar-gold text-center">
                      سعر الجرام: {(parseFloat(addForm.cost) / parseFloat(addForm.grams)).toFixed(2)} ج
                    </p>
                  )}
                  <button type="submit" className="w-full bg-jumar-gold text-jumar-brown font-bold py-3 rounded-xl hover:opacity-90">
                    ✅ تسجيل المشتريات
                  </button>
                </form>
              </div>
            )}

            {/* Use Stock */}
            {tab === 'use' && (
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <h2 className="font-bold text-jumar-brown text-lg mb-4">🔽 خصم استخدام في الإنتاج</h2>
                <form onSubmit={handleUseStock} className="space-y-3">
                  <select value={useForm.ingredient_id}
                    onChange={e => setUseForm({ ...useForm, ingredient_id: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right focus:outline-none focus:border-jumar-gold">
                    <option value="">اختر الخامة *</option>
                    {ingredients.map(i => (
                      <option key={i.id} value={i.id}>{i.name} — متاح: {i.stock_grams}ج</option>
                    ))}
                  </select>
                  <input required type="number" placeholder="الكمية المستخدمة (جرام) *" value={useForm.grams}
                    onChange={e => setUseForm({ ...useForm, grams: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right focus:outline-none focus:border-jumar-gold" />
                  <input placeholder="الدفعة / المنتج" value={useForm.note}
                    onChange={e => setUseForm({ ...useForm, note: e.target.value })}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-right focus:outline-none focus:border-jumar-gold" />
                  <button type="submit" className="w-full bg-red-500 text-white font-bold py-3 rounded-xl hover:opacity-90">
                    🔽 خصم من المخزون
                  </button>
                </form>
              </div>
            )}

            {/* History */}
            {tab === 'history' && (
              <div className="space-y-2">
                {movements.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">لا توجد حركات مسجلة</div>
                ) : movements.map(m => (
                  <div key={m.id} className="bg-white rounded-xl p-4 shadow-sm flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-gray-800">{m.ingredients?.name}</p>
                      <p className="text-xs text-gray-400">{m.note}</p>
                      <p className="text-xs text-gray-400">{new Date(m.created_at).toLocaleString('ar-EG')}</p>
                    </div>
                    <div className="text-left">
                      <span className={`font-bold text-lg ${
                        m.type === 'in' ? 'text-green-600' :
                        m.type === 'out' ? 'text-red-500' : 'text-blue-500'
                      }`}>
                        {m.type === 'in' ? '+' : m.type === 'out' ? '−' : '~'}
                        {Math.abs(m.grams)}ج
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
    </div>
  )
}
