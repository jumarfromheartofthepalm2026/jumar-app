'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import Image from 'next/image'
import { useSearchParams } from 'next/navigation'

type Lang = 'ar' | 'en' | 'fr'

const t = {
  ar: {
    dir: 'rtl' as const,
    orderOnline: 'اطلب أونلاين',
    cartTitle: 'سلة التسوق',
    cartSub: 'راجع طلبك قبل الإكمال',
    emptyCart: 'السلة فاضية',
    backToMenu: '← رجوع للمنيو',
    pieces: 'قطعة',
    total: 'الإجمالي',
    boxes: 'علبة',
    freeDelivery: '✅ توصيل مجاني!',
    addForFree: (n: number) => `🚚 أضف ${n} ج للتوصيل المجاني`,
    continueOrder: 'إكمال الطلب ←',
    choosePackage: 'اختار الباكج',
    packageSub: 'كلما زاد، كلما وفّرت — وفي هدايا على العلب الكبيرة 🎁',
    giftLabel: (n: number) => `+${n} قطعة هدية 🎁`,
    popular: 'الأكثر طلباً',
    nextFlavors: 'التالي — اختار النكهات ←',
    detailsTitle: 'بياناتك',
    distributeSub: (n: number) => `وزّع ${n} قطعة على النكهات اللي بتحبها`,
    flavorsLabel: 'النكهات — متبقي:',
    nameLabel: 'الاسم',
    namePlaceholder: 'اسمك الكامل',
    phoneLabel: 'رقم التليفون',
    phonePlaceholder: '01xxxxxxxxx',
    addressLabel: 'العنوان',
    addressPlaceholder: 'الحي + الشارع + رقم المبنى',
    notesLabel: 'ملاحظات (اختياري)',
    notesPlaceholder: 'أي تفاصيل إضافية',
    back: '← رجوع',
    reviewOrder: 'مراجعة الطلب ←',
    confirmTitle: 'تأكيد الطلب',
    productsLabel: '🍬 المنتجات',
    giftSuffix: (n: number) => ` + ${n} هدية`,
    deliveryLabel: '📍 بيانات التوصيل',
    deliveryTime: '⏱️ التوصيل خلال ٤ أيام من التأكيد',
    edit: '← تعديل',
    sending: '⏳ جاري الإرسال...',
    confirmBtn: '✅ تأكيد الطلب',
    doneTitle: 'طلبك اتسجّل!',
    orderNum: 'رقم الطلب:',
    doneSub: (phone: string) => `هنتواصل معاك على ${phone} لتأكيد الطلب والموعد · التوصيل خلال ٤ أيام`,
    whatsapp: '💬 تواصل على واتساب',
    home: '🏠 الرئيسية',
    freeDeliveryBadge: '· توصيل مجاني ✅',
    currency: 'ج',
    PACKAGES: [
      { label: 'علبة ٨ قطع', qty: 8, gift: 2, price: 260 },
      { label: 'علبة ١٥ قطعة', qty: 15, gift: 3, price: 450, popular: true },
      { label: 'علبة ٢٤ قطعة', qty: 24, gift: 4, price: 650 },
    ],
  },
  en: {
    dir: 'ltr' as const,
    orderOnline: 'Order Online',
    cartTitle: 'Shopping Cart',
    cartSub: 'Review your order before completing',
    emptyCart: 'Your cart is empty',
    backToMenu: '← Back to Menu',
    pieces: 'pieces',
    total: 'Total',
    boxes: 'box(es)',
    freeDelivery: '✅ Free delivery!',
    addForFree: (n: number) => `🚚 Add ${n} EGP for free delivery`,
    continueOrder: 'Complete Order →',
    choosePackage: 'Choose Package',
    packageSub: 'The more you order, the more you save — gifts included on large boxes 🎁',
    giftLabel: (n: number) => `+${n} gift piece 🎁`,
    popular: 'Most Popular',
    nextFlavors: 'Next — Choose Flavors →',
    detailsTitle: 'Your Details',
    distributeSub: (n: number) => `Distribute ${n} pieces across your favorite flavors`,
    flavorsLabel: 'Flavors — remaining:',
    nameLabel: 'Name',
    namePlaceholder: 'Your full name',
    phoneLabel: 'Phone number',
    phonePlaceholder: '01xxxxxxxxx',
    addressLabel: 'Address',
    addressPlaceholder: 'District + Street + Building number',
    notesLabel: 'Notes (optional)',
    notesPlaceholder: 'Any additional details',
    back: '← Back',
    reviewOrder: 'Review Order →',
    confirmTitle: 'Confirm Order',
    productsLabel: '🍬 Products',
    giftSuffix: (n: number) => ` + ${n} gift`,
    deliveryLabel: '📍 Delivery Details',
    deliveryTime: '⏱️ Delivery within 4 days of confirmation',
    edit: '← Edit',
    sending: '⏳ Sending...',
    confirmBtn: '✅ Confirm Order',
    doneTitle: 'Order Placed!',
    orderNum: 'Order number:',
    doneSub: (phone: string) => `We'll contact you at ${phone} to confirm the order and schedule delivery · Delivery within 4 days`,
    whatsapp: '💬 Chat on WhatsApp',
    home: '🏠 Home',
    freeDeliveryBadge: '· Free delivery ✅',
    currency: 'EGP',
    PACKAGES: [
      { label: 'Box of 8', qty: 8, gift: 2, price: 260 },
      { label: 'Box of 15', qty: 15, gift: 3, price: 450, popular: true },
      { label: 'Box of 24', qty: 24, gift: 4, price: 650 },
    ],
  },
  fr: {
    dir: 'ltr' as const,
    orderOnline: 'Commander en ligne',
    cartTitle: 'Panier',
    cartSub: 'Vérifiez votre commande avant de continuer',
    emptyCart: 'Votre panier est vide',
    backToMenu: '← Retour au menu',
    pieces: 'pièces',
    total: 'Total',
    boxes: 'boîte(s)',
    freeDelivery: '✅ Livraison gratuite !',
    addForFree: (n: number) => `🚚 Ajoutez ${n} EGP pour la livraison gratuite`,
    continueOrder: 'Finaliser la commande →',
    choosePackage: 'Choisir le forfait',
    packageSub: 'Plus vous commandez, plus vous économisez — cadeaux inclus sur les grandes boîtes 🎁',
    giftLabel: (n: number) => `+${n} pièce cadeau 🎁`,
    popular: 'Plus populaire',
    nextFlavors: 'Suivant — Choisir les saveurs →',
    detailsTitle: 'Vos coordonnées',
    distributeSub: (n: number) => `Répartissez ${n} pièces entre vos saveurs préférées`,
    flavorsLabel: 'Saveurs — restant :',
    nameLabel: 'Nom',
    namePlaceholder: 'Votre nom complet',
    phoneLabel: 'Numéro de téléphone',
    phonePlaceholder: '01xxxxxxxxx',
    addressLabel: 'Adresse',
    addressPlaceholder: 'Quartier + rue + numéro du bâtiment',
    notesLabel: 'Notes (facultatif)',
    notesPlaceholder: 'Détails supplémentaires',
    back: '← Retour',
    reviewOrder: 'Vérifier la commande →',
    confirmTitle: 'Confirmer la commande',
    productsLabel: '🍬 Produits',
    giftSuffix: (n: number) => ` + ${n} cadeau`,
    deliveryLabel: '📍 Détails de livraison',
    deliveryTime: '⏱️ Livraison en 4 jours après confirmation',
    edit: '← Modifier',
    sending: '⏳ Envoi en cours...',
    confirmBtn: '✅ Confirmer la commande',
    doneTitle: 'Commande enregistrée !',
    orderNum: 'N° de commande :',
    doneSub: (phone: string) => `Nous vous contacterons au ${phone} pour confirmer la commande · Livraison en 4 jours`,
    whatsapp: '💬 Chat WhatsApp',
    home: '🏠 Accueil',
    freeDeliveryBadge: '· Livraison gratuite ✅',
    currency: 'EGP',
    PACKAGES: [
      { label: 'Boîte de 8', qty: 8, gift: 2, price: 260 },
      { label: 'Boîte de 15', qty: 15, gift: 3, price: 450, popular: true },
      { label: 'Boîte de 24', qty: 24, gift: 4, price: 650 },
    ],
  },
}

const FLAVORS = [
  { key: 'tamriya', labelAr: 'تمرية الطحينة', labelEn: 'Tahini Tamriya', labelFr: 'Tamriya Tahini' },
  { key: 'fudge', labelAr: 'فدج الكاجو', labelEn: 'Cashew Fudge', labelFr: 'Fudge Cajou' },
  { key: 'sultana', labelAr: 'سلطانة الفستق', labelEn: 'Pistachio Sultana', labelFr: 'Sultane Pistache' },
  { key: 'snickers_fool', labelAr: 'سنيكرز الفول السوداني', labelEn: 'Peanut Snickers', labelFr: 'Snickers Cacahuète' },
  { key: 'snickers_bunduq', labelAr: 'سنيكرز البندق', labelEn: 'Hazelnut Snickers', labelFr: 'Snickers Noisette' },
]

function flavorLabel(f: typeof FLAVORS[0], lang: Lang) {
  return lang === 'ar' ? f.labelAr : lang === 'en' ? f.labelEn : f.labelFr
}

type CartItem = {
  key: string
  boxLabelKey: string
  nameAr: string
  qty: number
  price: number
  piecesPerBox: number
  flavors: Record<string, number>
}
type Step = 'package' | 'cart' | 'details' | 'confirm' | 'done'

const brown = '#3D2310'
const gold = '#C9A84C'
const cream = '#FAF5EB'

function OrderPageInner() {
  const searchParams = useSearchParams()
  const fromCart = searchParams.get('cart') === '1'

  const [lang, setLang] = useState<Lang>('ar')
  const [step, setStep] = useState<Step>(fromCart ? 'cart' : 'package')
  const [selectedPkg, setSelectedPkg] = useState<{ label: string; qty: number; gift: number; price: number; popular?: boolean } | null>(null)
  const [flavors, setFlavors] = useState<Record<string, number>>({})
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [form, setForm] = useState({ name: '', phone: '', address: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const [orderNum, setOrderNum] = useState('')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('jumar_lang') as Lang | null
      if (saved && ['ar','en','fr'].includes(saved)) setLang(saved)
    } catch {}
    if (fromCart) {
      try {
        const saved = JSON.parse(localStorage.getItem('jumar_cart') || '[]') as CartItem[]
        setCartItems(saved)
      } catch {}
    }
  }, [fromCart])

  function changeLang(l: Lang) {
    setLang(l)
    try { localStorage.setItem('jumar_lang', l) } catch {}
  }

  const T = t[lang]

  const totalFlavors = Object.values(flavors).reduce((a, b) => a + b, 0)
  const remainingFlavors = (selectedPkg?.qty || 0) - totalFlavors

  const cartTotal = cartItems.reduce((s, i) => s + i.qty * i.price, 0)
  const cartCount = cartItems.length
  const freeDelivery = cartTotal >= 1500

  function setFlavor(key: string, val: number) {
    setFlavors(prev => ({ ...prev, [key]: Math.max(0, val) }))
  }

  function removeCartItem(key: string) {
    setCartItems(prev => {
      const next = prev.filter(i => i.key !== key)
      try { localStorage.setItem('jumar_cart', JSON.stringify(next)) } catch {}
      return next
    })
  }

  // Display name for a cart item in current lang
  function cartItemName(item: CartItem) {
    if (lang === 'ar') return item.nameAr
    const pkg = T.PACKAGES.find(p => p.qty === item.piecesPerBox)
    return pkg ? pkg.label : item.nameAr
  }

  async function submitOrder() {
    setLoading(true)
    const num = `JM-${Date.now().toString().slice(-6)}`

    if (fromCart && cartItems.length > 0) {
      const itemsDesc = cartItems.map(i => {
        const flavorLine = Object.entries(i.flavors).filter(([,n]) => n > 0).map(([k,n]) => `${FLAVORS.find(f=>f.key===k)?.labelAr}×${n}`).join('+')
        return `${i.nameAr}(${flavorLine})`
      }).join(' · ')
      await supabase.from('sales').insert({
        sale_date: new Date().toISOString().split('T')[0],
        channel: 'أونلاين',
        items_desc: itemsDesc,
        total_qty: cartItems.reduce((s,i) => s + i.piecesPerBox, 0),
        amount: cartTotal,
        customer_type: 'غريب',
        customer_name: form.name,
        customer_phone: form.phone,
        customer_address: form.address,
        notes: `order:${num}|cart|${form.notes}`,
      })
      try { localStorage.removeItem('jumar_cart') } catch {}
      const boxLines = cartItems.map(i => {
        const flavorLine = Object.entries(i.flavors).filter(([,n]) => n > 0).map(([k,n]) => `${FLAVORS.find(f=>f.key===k)?.labelAr} ×${n}`).join(' | ')
        return `📦 ${i.nameAr} — ${i.price}ج\n   🍬 ${flavorLine}`
      }).join('\n')
      const msg = encodeURIComponent(
        `🛒 طلب جديد ${num}\n👤 ${form.name}\n📱 ${form.phone}\n📍 ${form.address}\n` +
        boxLines +
        `\n💰 الإجمالي: ${cartTotal}ج` +
        (freeDelivery ? '\n🚚 توصيل مجاني' : '') +
        (form.notes ? `\n📝 ${form.notes}` : '')
      )
      window.open(`https://wa.me/201110330052?text=${msg}`, '_blank')
    } else if (selectedPkg) {
      const flavorDesc = Object.entries(flavors).filter(([,q]) => q > 0).map(([k, q]) => `${FLAVORS.find(f => f.key === k)?.labelAr} x${q}`).join(' · ')
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
      const flavorLine = Object.entries(flavors).filter(([,q]) => q > 0).map(([k, q]) => `${FLAVORS.find(f => f.key === k)?.labelAr} x${q}`).join(' | ')
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

  return (
    <div style={{ minHeight: '100vh', background: cream, fontFamily: "'Cairo', 'Segoe UI', sans-serif" }} dir={T.dir}>
      {/* Header */}
      <div style={{ background: brown, padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/">
          <Image src="/logo.jpg" alt="جُمار" width={100} height={50} style={{ height: 42, width: 'auto', objectFit: 'contain' }} />
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ color: gold, fontWeight: 700, fontSize: '0.85rem', marginInlineEnd: '0.5rem' }}>{T.orderOnline}</span>
          {(['ar','en','fr'] as Lang[]).map(l => (
            <button key={l} onClick={() => changeLang(l)} style={{
              padding: '0.2rem 0.5rem', borderRadius: '1rem', border: '1.5px solid',
              borderColor: lang === l ? gold : 'rgba(201,168,76,0.35)',
              background: lang === l ? gold : 'transparent',
              color: lang === l ? brown : 'rgba(201,168,76,0.7)',
              fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.05em',
            }}>{l.toUpperCase()}</button>
          ))}
        </div>
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
            <h1 style={{ color: brown, fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.4rem' }}>{T.cartTitle}</h1>
            <p style={{ color: '#7A5C3A', fontSize: '0.85rem', marginBottom: '1.5rem' }}>{T.cartSub}</p>
            {cartItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 0' }}>
                <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🛒</div>
                <p style={{ color: '#7A5C3A' }}>{T.emptyCart}</p>
                <Link href="/" style={{ display: 'inline-block', marginTop: '1rem', color: gold, fontWeight: 700, textDecoration: 'none' }}>{T.backToMenu}</Link>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                  {cartItems.map(item => (
                    <div key={item.key} style={{ background: '#fff', borderRadius: '1rem', padding: '1rem', border: '1px solid rgba(201,168,76,0.2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                        <div>
                          <p style={{ fontWeight: 700, color: brown, fontSize: '0.9rem', margin: 0 }}>{cartItemName(item)}</p>
                          <p style={{ color: '#7A5C3A', fontSize: '0.72rem', margin: '0.1rem 0 0' }}>{item.piecesPerBox} {T.pieces}</p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ color: gold, fontWeight: 900, fontSize: '0.95rem' }}>{item.price} {T.currency}</span>
                          <button onClick={() => removeCartItem(item.key)} style={{ background: 'rgba(200,0,0,0.07)', border: 'none', color: '#c00', width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🗑</button>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {Object.entries(item.flavors).filter(([,n]) => n > 0).map(([k,n]) => {
                          const f = FLAVORS.find(f => f.key === k)
                          return f ? (
                            <span key={k} style={{ background: 'rgba(201,168,76,0.1)', color: '#5C3D1E', fontSize: '0.68rem', fontWeight: 600, padding: '0.15rem 0.45rem', borderRadius: '1rem', border: '1px solid rgba(201,168,76,0.2)' }}>
                              {flavorLabel(f, lang)} ×{n}
                            </span>
                          ) : null
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ background: '#fff', borderRadius: '1rem', padding: '1rem', border: '1px solid rgba(201,168,76,0.2)', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ color: brown, fontWeight: 700 }}>{T.total} ({cartCount} {T.boxes})</span>
                    <span style={{ color: gold, fontWeight: 900, fontSize: '1.1rem' }}>{cartTotal} {T.currency}</span>
                  </div>
                  <p style={{ fontSize: '0.78rem', padding: '0.4rem 0.6rem', borderRadius: '0.5rem', margin: 0, background: freeDelivery ? 'rgba(0,180,0,0.08)' : 'rgba(201,168,76,0.1)', color: freeDelivery ? '#2A7A2A' : '#7A5C3A' }}>
                    {freeDelivery ? T.freeDelivery : T.addForFree(1500 - cartTotal)}
                  </p>
                </div>
                <button onClick={() => setStep('details')} style={{ width: '100%', background: brown, color: gold, border: 'none', borderRadius: '2rem', padding: '0.9rem', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                  {T.continueOrder}
                </button>
              </>
            )}
          </div>
        )}

        {/* ── STEP 1: Choose package ── */}
        {step === 'package' && (
          <div>
            <h1 style={{ color: brown, fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.4rem' }}>{T.choosePackage}</h1>
            <p style={{ color: '#7A5C3A', fontSize: '0.85rem', marginBottom: '1.5rem' }}>{T.packageSub}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {T.PACKAGES.map(pkg => (
                <button key={pkg.label} onClick={() => setSelectedPkg(pkg)}
                  style={{
                    border: `2px solid ${selectedPkg?.qty === pkg.qty ? gold : 'rgba(201,168,76,0.25)'}`,
                    background: selectedPkg?.qty === pkg.qty ? 'rgba(201,168,76,0.08)' : '#fff',
                    borderRadius: '1rem', padding: '1rem 1.25rem',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    cursor: 'pointer', transition: 'all 0.15s', textAlign: lang === 'ar' ? 'right' : 'left',
                    position: 'relative',
                  }}>
                  {'popular' in pkg && pkg.popular && (
                    <span style={{ position: 'absolute', top: -10, right: 16, background: gold, color: brown, fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.6rem', borderRadius: '1rem' }}>{T.popular}</span>
                  )}
                  <div>
                    <p style={{ fontWeight: 700, color: brown, fontSize: '1rem', margin: 0 }}>{pkg.label}</p>
                    {pkg.gift > 0 && <p style={{ color: gold, fontSize: '0.78rem', margin: '0.1rem 0 0' }}>{T.giftLabel(pkg.gift)}</p>}
                  </div>
                  <p style={{ fontWeight: 800, color: gold, fontSize: '1.3rem', margin: 0 }}>{pkg.price}<span style={{ fontSize: '0.75rem', color: '#7A5C3A' }}> {T.currency}</span></p>
                </button>
              ))}
            </div>
            <button onClick={() => selectedPkg && setStep('details')}
              disabled={!selectedPkg}
              style={{ width: '100%', marginTop: '1.5rem', background: selectedPkg ? brown : '#ccc', color: gold, border: 'none', borderRadius: '2rem', padding: '0.9rem', fontWeight: 700, fontSize: '1rem', cursor: selectedPkg ? 'pointer' : 'not-allowed', fontFamily: 'inherit' }}>
              {T.nextFlavors}
            </button>
          </div>
        )}

        {/* ── STEP 2: Details ── */}
        {step === 'details' && (
          <div>
            <h1 style={{ color: brown, fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>{T.detailsTitle}</h1>
            {!fromCart && selectedPkg && (
              <p style={{ color: '#7A5C3A', fontSize: '0.85rem', marginBottom: '1rem' }}>{T.distributeSub(selectedPkg.qty)}</p>
            )}
            {!fromCart && selectedPkg && (
              <div style={{ background: '#fff', borderRadius: '1rem', padding: '1rem', marginBottom: '1rem', border: '1px solid rgba(201,168,76,0.2)' }}>
                <p style={{ fontWeight: 700, color: brown, marginBottom: '0.75rem', fontSize: '0.9rem' }}>
                  {T.flavorsLabel} <span style={{ color: remainingFlavors < 0 ? 'red' : gold }}>{remainingFlavors}</span>
                </p>
                {FLAVORS.map(f => (
                  <div key={f.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                    <span style={{ fontSize: '0.88rem', color: brown }}>{flavorLabel(f, lang)}</span>
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
                { key: 'name', label: T.nameLabel, placeholder: T.namePlaceholder, type: 'text' },
                { key: 'phone', label: T.phoneLabel, placeholder: T.phonePlaceholder, type: 'tel' },
                { key: 'address', label: T.addressLabel, placeholder: T.addressPlaceholder, type: 'text' },
                { key: 'notes', label: T.notesLabel, placeholder: T.notesPlaceholder, type: 'text' },
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
              <button onClick={() => setStep(fromCart ? 'cart' : 'package')} style={{ flex: 1, background: 'transparent', border: `1.5px solid ${gold}`, color: brown, borderRadius: '2rem', padding: '0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{T.back}</button>
              <button
                onClick={() => setStep('confirm')}
                disabled={(!fromCart && remainingFlavors !== 0) || !form.name || !form.phone || !form.address}
                style={{ flex: 2, background: (fromCart || remainingFlavors === 0) && form.name && form.phone && form.address ? brown : '#ccc', color: gold, border: 'none', borderRadius: '2rem', padding: '0.8rem', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                {T.reviewOrder}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Confirm ── */}
        {step === 'confirm' && (
          <div>
            <h1 style={{ color: brown, fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>{T.confirmTitle}</h1>

            <div style={{ background: '#fff', borderRadius: '1rem', padding: '1.25rem', border: '1px solid rgba(201,168,76,0.2)', marginBottom: '1rem' }}>
              <p style={{ fontWeight: 700, color: brown, marginBottom: '0.75rem' }}>{T.productsLabel}</p>
              {fromCart ? cartItems.map(i => (
                <div key={i.key} style={{ marginBottom: '0.75rem' }}>
                  <p style={{ color: brown, fontSize: '0.88rem', fontWeight: 700, margin: 0 }}>{cartItemName(i)} — {i.price} {T.currency}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.3rem' }}>
                    {Object.entries(i.flavors).filter(([,n]) => n > 0).map(([k,n]) => {
                      const f = FLAVORS.find(f => f.key === k)
                      return f ? <span key={k} style={{ background: 'rgba(201,168,76,0.1)', color: '#5C3D1E', fontSize: '0.68rem', fontWeight: 600, padding: '0.15rem 0.45rem', borderRadius: '1rem' }}>{flavorLabel(f, lang)} ×{n}</span> : null
                    })}
                  </div>
                </div>
              )) : selectedPkg && (
                <>
                  <p style={{ color: '#555', fontSize: '0.9rem' }}>{selectedPkg.label}{selectedPkg.gift > 0 ? T.giftSuffix(selectedPkg.gift) : ''}</p>
                  {Object.entries(flavors).filter(([,q]) => q > 0).map(([k, q]) => {
                    const f = FLAVORS.find(f => f.key === k)
                    return f ? <p key={k} style={{ color: '#555', fontSize: '0.88rem', margin: '0.2rem 0' }}>{flavorLabel(f, lang)} × {q}</p> : null
                  })}
                </>
              )}
              <p style={{ color: gold, fontWeight: 800, fontSize: '1.2rem', marginTop: '0.75rem' }}>
                {fromCart ? cartTotal : selectedPkg?.price} {T.currency}
                {fromCart && freeDelivery && <span style={{ fontSize: '0.78rem', color: '#2A7A2A', marginInlineStart: '0.5rem' }}>{T.freeDeliveryBadge}</span>}
              </p>
            </div>

            <div style={{ background: '#fff', borderRadius: '1rem', padding: '1.25rem', border: '1px solid rgba(201,168,76,0.2)', marginBottom: '1.5rem' }}>
              <p style={{ fontWeight: 700, color: brown, marginBottom: '0.75rem' }}>{T.deliveryLabel}</p>
              <p style={{ color: '#555', fontSize: '0.88rem', margin: '0.2rem 0' }}>👤 {form.name}</p>
              <p style={{ color: '#555', fontSize: '0.88rem', margin: '0.2rem 0' }}>📱 {form.phone}</p>
              <p style={{ color: '#555', fontSize: '0.88rem', margin: '0.2rem 0' }}>📍 {form.address}</p>
              {form.notes && <p style={{ color: '#555', fontSize: '0.88rem', margin: '0.2rem 0' }}>📝 {form.notes}</p>}
              <p style={{ color: '#7A5C3A', fontSize: '0.78rem', marginTop: '0.5rem' }}>{T.deliveryTime}</p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setStep('details')} style={{ flex: 1, background: 'transparent', border: `1.5px solid ${gold}`, color: brown, borderRadius: '2rem', padding: '0.8rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>{T.edit}</button>
              <button onClick={submitOrder} disabled={loading}
                style={{ flex: 2, background: brown, color: gold, border: 'none', borderRadius: '2rem', padding: '0.8rem', fontWeight: 700, fontSize: '1rem', cursor: 'pointer', fontFamily: 'inherit', opacity: loading ? 0.7 : 1 }}>
                {loading ? T.sending : T.confirmBtn}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Done ── */}
        {step === 'done' && (
          <div style={{ textAlign: 'center', paddingTop: '2rem' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
            <h1 style={{ color: brown, fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.5rem' }}>{T.doneTitle}</h1>
            <p style={{ color: '#7A5C3A', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{T.orderNum} <strong style={{ color: gold }}>{orderNum}</strong></p>
            <p style={{ color: '#7A5C3A', fontSize: '0.88rem', lineHeight: 1.7, marginBottom: '2rem' }}>
              {T.doneSub(form.phone)}
            </p>
            <a href={`https://wa.me/201110330052?text=طلبي رقم ${orderNum} — ${form.name}`}
              target="_blank" rel="noopener noreferrer"
              style={{ display: 'block', background: '#25D366', color: '#fff', borderRadius: '2rem', padding: '0.9rem 1.5rem', fontWeight: 700, textDecoration: 'none', marginBottom: '0.75rem', fontSize: '0.95rem' }}>
              {T.whatsapp}
            </a>
            <Link href="/" style={{ display: 'block', background: brown, color: gold, borderRadius: '2rem', padding: '0.9rem 1.5rem', fontWeight: 700, textDecoration: 'none', fontSize: '0.95rem' }}>
              {T.home}
            </Link>
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
      `}</style>
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
