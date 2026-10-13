'use client'

import { useState, useEffect, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'

const PACKAGES = [
  { label: 'قطعة واحدة', qty: 1, gift: 0, price: 40 },
  { label: 'قطعتين', qty: 2, gift: 0, price: 70 },
  { label: 'علبة ٥ قطع', qty: 5, gift: 0, price: 170 },
  { label: 'علبة ٨ قطع', qty: 8, gift: 2, price: 260 },
  { label: 'علبة ١٥ قطعة', qty: 15, gift: 3, price: 450, popular: true },
  { label: 'علبة ٢٤ قطعة', qty: 24, gift: 4, price: 650 },
]

const FLAVORS = [
  { key: 'tamriya', label: 'تمرية الطحينة' },
  { key: 'fudge', label: 'فدج الكاجو' },
  { key: 'sultana', label: 'سلطانة الفستق' },
  { key: 'snickers_fool', label: 'سنيكرز الفول السوداني' },
  { key: 'snickers_bunduq', label: 'سنيكرز البندق' },
]

type CartItem = { key: string; nameAr: string; qty: number; price: number }
type Step = 'package' | 'cart' | 'details' | 'confirm' | 'done'

function OrderPageInner() {
  const searchParams = useSearchParams()
  const fromCart = searchParams.get('cart') === '1'

  const [step, setStep] = useState<Step>(fromCart ? 'cart' : 'package')
  const [selectedPkg, setSelectedPkg] = useState<typeof PACKAGES[0] | null>(null)
  const [flavors, setFlavors] = useState<Record<string, number>>({})
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [form, setForm] = useState({ name: '', phone: '', address: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const [orderNum, setOrderNum] = useState('')

  useEffect(() => {
    if (fromCart) {
      try {
        const saved = JSON.parse(localStorage.getItem('jumar_cart') || '[]') as CartItem[]
        setCartItems(saved)
      } catch {}
    }
  }, [fromCart])

  const totalFlavors = Object.values(flavors).reduce((a, b) => a + b, 0)
  const remainingFlavors = (selectedPkg?.qty || 0) - totalFlavors

  const cartTotal = cartItems.reduce((s, i) => s + i.qty * i.price, 0)
  const cartCount = cartItems.reduce((s, i) => s + i.qty, 0)
  const freeDelivery = cartTotal >= 1500

  function setFlavor(key: string, val: number) {
    setFlavors(prev => ({ ...prev, [key]: Math.max(0, val) }))
  }

  function adjustCartItem(key: string, delta: number) {
    setCartItems(prev => {
      const next = prev.map(i => i.key === key ? { ...i, qty: i.qty + delta } : i).filter(i => i.qty > 0)
      try { localStorage.setItem('jumar_cart', JSON.stringify(next)) } catch {}
      return next
    })
  }

  async function submitOrder() {
    setLoading(true)
    const num = `JM-${Date.now().toString().slice(-6)}`

    if (fromCart && cartItems.length > 0) {
      // Cart order
      const itemsDesc = cartItems.map(i => `${i.nameAr} x${i.qty}`).join(' · ')
      await supabase.from('sales').insert({
        sale_date: new Date().toISOString().split('T')[0],
        channel: 'أونلاين',
        items_desc: itemsDesc,
        total_qty: cartCount,
        amount: cartTotal,
        customer_type: 'غريب',
        customer_name: form.name,
        customer_phone: form.phone,
        customer_address: form.address,
        notes: `order:${num}|cart|${form.notes}`,
      })
      try { localStorage.removeItem('jumar_cart') } catch {}
      const msg = encodeURIComponent(
        `🛒 طلب جديد ${num}\n👤 ${form.name}\n📱 ${form.phone}\n📍 ${form.address}\n` +
        cartItems.map(i => `🍬 ${i.nameAr} x${i.qty} — ${i.qty * i.price}ج`).join('\n') +
        `\n💰 الإجمالي: ${cartTotal}ج` +
        (freeDelivery ? '\n🚚 توصيل مجاني' : '') +
        (form.notes ? `\n📝 ${form.notes}` : '')
      )
      window.open(`https://wa.me/201110330052?text=${msg}`, '_blank')
    } else if (selectedPkg) {
      // Package order
      const flavorDesc = Object.entries(flavors).filter(([,q]) => q > 0).map(([k, q]) => `${FLAVORS.find(f => f.key === k)?.label} x${q}`).join(' · ')
      await supabase.from('sales').insert({
        sale_date: new Date().toISOString().split('T')[0],
        channel: 'أونلاين',
        items_desc: `${selectedPkg.label}${selectedPkg.gift > 0 ? ` +${selectedPkg.gift} هدية` : ''} — ${flavorDesc}`,
        total_qty: selectedPkg.qty + selectedPkg.gift,
        amount: selectedPkg.price,
        customer_type: 'غريب',
        customer_name: form.name,
        customer_phone: form.phone,
        customer_address: form.address,
        notes: `order:${num}|${flavorDesc}|${form.notes}`,
      })
      const flavorLine = Object.entries(flavors).filter(([,q]) => q > 0).map(([k, q]) => `${FLAVORS.find(f => f.key === k)?.label} x${q}`).join(' | ')
      const msg = encodeURIComponent(
        `🛒 طلب جديد ${num}\n👤 ${form.name}\n📱 ${form.phone}\n📍 ${form.address}\n📦 ${selectedPkg.label} — ${selectedPkg.price}ج\n🍬 ${flavorLine}` +
        (form.notes ? `\n📝 ${form.notes}` : '')
      )
      window.open(`https://wa.me/201110330052?text=${msg}`, '_blank')
    }

    setOrderNum(num)
    setStep('done')
    setLoading(false)
  }

  const brown = '#3D2310'
  const gold = '#C9A84C'
  const cream = '#FAF5EB'

  return (
    <div style={{ minHeight: '100vh', background: cream, fontFamily: "'Cairo', 'Segoe UI', sans-serif" }} dir="rtl">
      {/* Header */}
      <div style={{ background: brown, padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/">
          <Image src="/logo.jpg" alt="جُمار" width={100} height={50} style={{ height: 42, width: 'auto', objectFit: 'contain' }} />
        </Link>
        <span style={{ color: gold, fontWeight: 700, fontSize: '0.9rem' }}>اطلب أونلاين</span>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '1.5rem' }}>

        {/* Progress */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
          {(fromCart ? ['cart','details','confirm'] : ['package','details','confirm']).map((s, i) => {
            const steps = fromCart ? ['cart','details','confirm','done'] : ['package','details','confirm','done']
            return <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: steps.indexOf(step) >= i ? gold : 'rgba(201,168,76,0.2)' }} />
          })}
        </div>

        {/* ── CART REVIEW ── */}
        {step === 'cart' && (
          <div>
            <h1 style={{ color: brown, fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.4rem' }}>سلة التسوق</h1>
            <p style={{ color: '#7A5C3A', fontSize: '0.85rem', marginBottom: '1.5rem' }}>راجع طلبك قبل الإكمال</p>
            {cartItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🛒</div>
                <p style={{ color: '#7A5C3A' }}>السلة فاضية</p>
                <Link href="/" style={{ display: 'inline-block', marginTop: '1rem', color: gold, fontWeight: 700, textDecoration: 'none' }}>← رجوع للمنيو</Link>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                  {cartItems.map(item => (
                    <div key={item.key} style={{ background: '#fff', borderRadius: '1rem', padding: '0.9rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(201,168,76,0.2)' }}>
                      <div>
                        <p style={{ fontWeight: 700, color: brown, fontSize: '0.9rem', margin: 0 }}>{item.nameAr}</p>
                        <p style={{ color: gold, fontWeight: 700, fontSize: '0.85rem', margin: '0.15rem 0 0' }}>{item.price * item.qty} ج</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button onClick={() => adjustCartItem(item.key, -1)} style={{ width: 28, height: 28, border: `1.5px solid ${gold}`, borderRadius: '50%', background: 'transparent', color: brown, fontWeight: 700, cursor: 'pointer', fontSize: '1rem' }}>−</button>
                        <span style={{ fontWeight: 700, color: brown, minWidth: 20, textAlign: 'center' }}>{item.qty}</span>
                        <button onClick={() => adjustCartItem(item.key, 1)} style={{ width: 28, height: 28, border: `1.5px solid ${gold}`, borderRadius: '50%', background: gold, color: brown, fontWeight: 700, cursor: 'pointer', fontSize: '1rem' }}>+</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ background: '#fff', borderRadius: '1rem', padding: '1rem', border: '1px solid rgba(201,168,76,0.2)', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: brown, fontWeight: 700 }}>الإجمالي ({cartCount} قطعة)</span>
                    <span style={{ color: gold, fontWeight: 900, fontSize: '1.1rem' }}>{cartTotal} ج</span>
                  </div>
                  <p style={{ fontSize: '0.78rem', padding: '0.4rem 0.6rem', borderRadius: '0.5rem', margin: 0, background: freeDelivery ? 'rgba(0,180,0,0.08)' : 'rgba(201,168,76,0.1)', color: freeDelivery ? '#2A7A2A' : '#7A5C3A' }}>
                    {freeDelivery ? '✅ توصيل مجاني!' : `🚚 أضف ${1500 - cartTotal} ج للتوصيل المجاني`}
                  </p>
                </div>
                <button onClick={() => setStep('details')} style={{ width: '100%', background: brown, color: gold, border: 'none', borderRadius: '2rem', padding: '0.9rem', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                  إكمال الطلب ←
                </button>
              </>
            )}
          </div>
        )}

        {/* ── STEP 1: Choose package ── */}
        {step === 'package' && (
          <div>
            <h1 style={{ color: brown, fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.4rem' }}>اختار الباكج</h1>
            <p style={{ color: '#7A5C3A', fontSize: '0.85rem', marginBottom: '1.5rem' }}>كلما زاد، كلما وفّرت — وفي هدايا على العلب الكبيرة 🎁</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {PACKAGES.map(pkg => (
                <button key={pkg.label} onClick={() => setSelectedPkg(pkg)}
                  style={{
                    border: `2px solid ${selectedPkg?.label === pkg.label ? gold : 'rgba(201,168,76,0.25)'}`,
                    background: selectedPkg?.label === pkg.label ? 'rgba(201,168,76,0.08)' : '#fff',
                    borderRadius: '1rem', padding: '1rem 1.25rem',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    cursor: 'pointer', transition: 'all 0.15s', textAlign: 'right',
                    position: 'relative',
                  }}>
                  {pkg.popular && (
                    <span style={{ position: 'absolute', top: -10, right: 16, background: gold, color: brown, fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.6rem', borderRadius: '1rem' }}>الأكثر طلباً</span>
                  )}
                  <div>
                    <p style={{ fontWeight: 700, color: brown, fontSize: '1rem', margin: 0 }}>{pkg.label}</p>
                    {pkg.gift > 0 && <p style={{ color: gold, fontSize: '0.78rem', margin: '0.1rem 0 0' }}>+{pkg.gift} قطعة هدية 🎁</p>}
                  </div>
                  <p style={{ fontWeight: 800, color: gold, fontSize: '1.3rem', margin: 0 }}>{pkg.price}<span style={{ fontSize: '0.75rem', color: '#7A5C3A' }}> ج</span></p>
                </button>
              ))}
            </div>
            <button onClick={() => selectedPkg && setStep('details')}
              disabled={!selectedPkg}
              style={{ width: '100%', marginTop: '1.5rem', background: selectedPkg ? brown : '#ccc', color: gold, border: 'none', borderRadius: '2rem', padding: '0.9rem', fontWeight: 700, fontSize: '1rem', cursor: selectedPkg ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
              التالي — اختار النكهات ←
            </button>
          </div>
        )}

        {/* ── STEP 2: Details (+ flavors if package mode) ── */}
        {step === 'details' && (
          <div>
            <h1 style={{ color: brown, fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>بياناتك</h1>
            {!fromCart && selectedPkg && (
              <p style={{ color: '#7A5C3A', fontSize: '0.85rem', marginBottom: '1rem' }}>وزّع {selectedPkg.qty} قطعة على النكهات اللي بتحبها</p>
            )}
            {!fromCart && selectedPkg && (
              <div style={{ background: '#fff', borderRadius: '1rem', padding: '1rem', marginBottom: '1rem', border: '1px solid rgba(201,168,76,0.2)' }}>
                <p style={{ fontWeight: 700, color: brown, marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                  النكهات — متبقي: <span style={{ color: remainingFlavors < 0 ? 'red' : gold }}>{remainingFlavors}</span> قطعة
                </p>
                {FLAVORS.map(f => (
                  <div key={f.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                    <span style={{ fontSize: '0.88rem', color: '#3D2310' }}>{f.label}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <button onClick={() => setFlavor(f.key, (flavors[f.key] || 0) - 1)} style={{ width: 28, height: 28, border: `1.5px solid ${gold}`, borderRadius: '50%', background: 'transparent', color: brown, fontWeight: 700, cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                      <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 700, color: brown }}>{flavors[f.key] || 0}</span>
                      <button onClick={() => remainingFlavors > 0 && setFlavor(f.key, (flavors[f.key] || 0) + 1)} style={{ width: 28, height: 28, border: `1.5px solid ${gold}`, borderRadius: '50%', background: remainingFlavors > 0 ? gold : '#ddd', color: remainingFlavors > 0 ? brown : '#999', fontWeight: 700, cursor: remainingFlavors > 0 ? 'pointer' : 'not-allowed', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: '0.5rem' }}>
              {[
                { key: 'name', label: 'الاسم', placeholder: 'اسمك الكامل', type: 'text' },
                { key: 'phone', label: 'رقم التليفون', placeholder: '01xxxxxxxxx', type: 'tel' },
                { key: 'address', label: 'العنوان', placeholder: 'الحي + الشارع + رقم المبنى', type: 'text' },
                { key: 'notes', label: 'ملاحظات (اختياري)', placeholder: 'أي تفاصيل إضافية', type: 'text' },
              ].map(({ key, label, placeholder, type }) => (
                <div key={key} style={{ marginBottom: '0.75rem' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, color: brown, marginBottom: '0.3rem' }}>{label}</label>
                  <input type={type} placeholder={placeholder} value={form[key as keyof typeof form]}
                    onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                    style={{ width: '100%', border: '1.5px solid rgba(201,168,76,0.35)', borderRadius: '0.75rem', padding: '0.65rem 0.9rem', fontSize: '0.9rem', fontFamily: 'inherit', background: '#fff', color: brown, boxSizing: 'border-box', outline: 'none' }} />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button onClick={() => setStep(fromCart ? 'cart' : 'package')} style={{ flex: 1, background: 'transparent', border: `1.5px solid ${gold}`, color: brown, borderRadius: '2rem', padding: '0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>← رجوع</button>
              <button
                onClick={() => setStep('confirm')}
                disabled={(!fromCart && remainingFlavors !== 0) || !form.name || !form.phone || !form.address}
                style={{ flex: 2, background: (fromCart || remainingFlavors === 0) && form.name && form.phone && form.address ? brown : '#ccc', color: gold, border: 'none', borderRadius: '2rem', padding: '0.8rem', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                مراجعة الطلب ←
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Confirm ── */}
        {step === 'confirm' && (
          <div>
            <h1 style={{ color: brown, fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>تأكيد الطلب</h1>

            <div style={{ background: '#fff', borderRadius: '1rem', padding: '1.25rem', border: '1px solid rgba(201,168,76,0.2)', marginBottom: '1rem' }}>
              <p style={{ fontWeight: 700, color: brown, marginBottom: '0.75rem' }}>🍬 المنتجات</p>
              {fromCart ? cartItems.map(i => (
                <p key={i.key} style={{ color: '#555', fontSize: '0.88rem', margin: '0.2rem 0' }}>{i.nameAr} × {i.qty} — {i.qty * i.price}ج</p>
              )) : selectedPkg && (
                <>
                  <p style={{ color: '#555', fontSize: '0.9rem' }}>{selectedPkg.label}{selectedPkg.gift > 0 ? ` + ${selectedPkg.gift} هدية` : ''}</p>
                  {Object.entries(flavors).filter(([,q]) => q > 0).map(([k, q]) => (
                    <p key={k} style={{ color: '#555', fontSize: '0.88rem', margin: '0.2rem 0' }}>{FLAVORS.find(f => f.key === k)?.label} × {q}</p>
                  ))}
                </>
              )}
              <p style={{ color: gold, fontWeight: 800, fontSize: '1.2rem', marginTop: '0.75rem' }}>
                {fromCart ? cartTotal : selectedPkg?.price} جنيه
                {fromCart && freeDelivery && <span style={{ fontSize: '0.78rem', color: '#2A7A2A', marginRight: '0.5rem' }}>· توصيل مجاني ✅</span>}
              </p>
            </div>

            <div style={{ background: '#fff', borderRadius: '1rem', padding: '1.25rem', border: '1px solid rgba(201,168,76,0.2)', marginBottom: '1.5rem' }}>
              <p style={{ fontWeight: 700, color: brown, marginBottom: '0.75rem' }}>📍 بيانات التوصيل</p>
              <p style={{ color: '#555', fontSize: '0.88rem', margin: '0.2rem 0' }}>👤 {form.name}</p>
              <p style={{ color: '#555', fontSize: '0.88rem', margin: '0.2rem 0' }}>📱 {form.phone}</p>
              <p style={{ color: '#555', fontSize: '0.88rem', margin: '0.2rem 0' }}>📍 {form.address}</p>
              {form.notes && <p style={{ color: '#555', fontSize: '0.88rem', margin: '0.2rem 0' }}>📝 {form.notes}</p>}
              <p style={{ color: '#7A5C3A', fontSize: '0.78rem', marginTop: '0.5rem' }}>⏱️ التوصيل خلال ٤ أيام من التأكيد</p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setStep('details')} style={{ flex: 1, background: 'transparent', border: `1.5px solid ${gold}`, color: brown, borderRadius: '2rem', padding: '0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>← تعديل</button>
              <button onClick={submitOrder} disabled={loading}
                style={{ flex: 2, background: brown, color: gold, border: 'none', borderRadius: '2rem', padding: '0.8rem', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}>
                {loading ? '⏳ جاري الإرسال...' : '✅ تأكيد الطلب'}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Done ── */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', paddingTop: '2rem' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
            <h1 style={{ color: brown, fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.5rem' }}>طلبك اتسجّل!</h1>
            <p style={{ color: '#7A5C3A', fontSize: '0.9rem', marginBottom: '0.5rem' }}>رقم الطلب: <strong style={{ color: gold }}>{orderNum}</strong></p>
            <p style={{ color: '#7A5C3A', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '2rem' }}>
              هنتواصل معاك على {form.phone} لتأكيد الطلب والموعد · التوصيل خلال ٤ أيام
            </p>
            <a href={`https://wa.me/201110330052?text=طلبي رقم ${orderNum} — ${form.name}`}
              target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', background: '#25D366', color: '#fff', borderRadius: '2rem', padding: '0.9rem 1.5rem', fontWeight: 700, textDecoration: 'none', marginBottom: '0.75rem', fontSize: '0.95rem' }}>
              💬 تواصل على واتساب
            </a>
            <Link href="/" style={{ display: 'block', background: brown, color: gold, borderRadius: '2rem', padding: '0.9rem 1.5rem', fontWeight: 700, textDecoration: 'none', fontSize: '0.95rem' }}>
              🏠 الرئيسية
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default function OrderPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cairo', sans-serif", color: '#3D2310' }}>جاري التحميل...</div>}>
      <OrderPageInner />
    </Suspense>
  )
}
