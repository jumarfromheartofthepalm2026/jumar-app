'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

// ── Translations ────────────────────────────────────────────
const t = {
  ar: {
    ticker: ['🚚 توصيل مجاني من ١٥٠٠ جنيه داخل التجمع الخامس حتى ٣١ أكتوبر', '🏪 بازار لوتس ٢٢–٢٤ أكتوبر', '✨ هدايا مميزة للعلب الكبيرة', '⏱️ التوصيل خلال ٤ أيام من الطلب'],
    nav: { story: 'قصتنا', menu: 'المنيو', pricing: 'الأسعار', order: 'اطلب الآن' },
    heroTag: '🌴 من قلب النخلة',
    heroTitle: ['سناك فاخر'],
    heroSub: 'بدون سكر مضاف · بدون ألوان صناعية · بدون مواد حافظة\nفقط التمر المصري الأصيل في أبهى صوره',
    orderNow: 'اطلب الآن',
    viewMenu: 'شاهد المنيو',
    badge1: '100% طبيعي',
    badge2: 'شوجر فري',
    badge3: 'صنع يدوي',
    badge4: 'توصيل سريع',
    deliveryBanner: '🚚 توصيل مجاني داخل التجمع الخامس حتى ٣١ أكتوبر',
    menuTitle: 'المنيو',
    menuSub: 'خمس نكهات، كل واحدة قصة',
    price: '٤٠ جنيه / قطعة',
    seasonal: 'قريباً · نكهات موسمية',
    seasonalDesc: 'نكهات حصرية بمناسبة المواسم والأعياد — ترقّبونا!',
    storyTitle: 'قصة جُمار',
    storySub: 'من أيدينا إلى بيتك',
    storyQ1: 'ليه صعب تلاقي حاجة حلوة وصحية في نفس الوقت؟',
    storyQ2: 'ليه كل ما تقرأ المكونات تلاقي سكر وألوان ومواد حافظة؟',
    storyQ3: 'ليه الحلويات الطبيعية دايماً إما غالية أوي أو مش لذيذة؟',
    storyText: 'جُمار جاء إجابة لكل الأسئلة دي.',
    storyMeaning: 'ليه جُمار؟',
    storyMeaningText: 'جُمار هو قلب النخلة — أطيب ما فيها وأنظفه. ودي بالظبط فلسفتنا: نوصّلك أحسن ما في التمر. كل قطعة معمولة بإيدينا في التجمع الخامس — وبتلاقينا في البازارات وأونلاين ستور نوصلك على بيتك مباشرة.',
    pricingTitle: 'الأسعار',
    pricingSub: 'كلما زاد، كلما وفّرت',
    piece: 'قطعة',
    pieces2: 'قطعتين',
    box5: 'علبة ٥',
    box8: 'علبة ٨',
    box15: 'علبة ١٥',
    box24: 'علبة ٢٤',
    gift: '+{n} هدية',
    popular: 'الأكثر طلبًا',
    reviewsTitle: 'ماذا قالوا؟',
    reviewsSub: 'آراء حقيقية من عملاء جُمار',
    ctaTitle: 'جاهز تجرب جُمار؟',
    ctaSub: 'اطلب دلوقتي وهنوصّلك على بيتك',
    ctaBtn: 'اطلب الآن',
    ctaWa: 'تواصل عبر واتساب',
    footerTagline: 'من قلب النخلة · من أيدينا إلى بيتك',
    footerLinks: ['قصتنا', 'المنيو', 'الأسعار', 'اطلب الآن', 'الأسئلة الشائعة'],
    faq: 'الأسئلة الشائعة',
    footerContact: 'تواصل معنا',
    footerLocation: 'أونلاين ستور · التجمع الخامس · القاهرة',
    footerDelivery: '🚚 توصيل مجاني داخل التجمع حتى ٣١/١٠',
    footerBazaar: '🏪 بازار لوتس ٢٢-٢٤ أكتوبر ٢٠٢٦',
    copyright: '© ٢٠٢٦ جُمار · جميع الحقوق محفوظة',
    dir: 'rtl',
  },
  en: {
    ticker: ['🚚 Free delivery from 1500 EGP inside Fifth Settlement until Oct 31', '🏪 Lotus Bazaar Oct 22–24', '✨ Gift extras on large boxes', '⏱️ Delivery within 4 days of order'],
    nav: { story: 'Our Story', menu: 'Menu', pricing: 'Pricing', order: 'Order Now' },
    heroTag: '🌴 From the Heart of the Palm',
    heroTitle: ['Premium Snack'],
    heroSub: 'No added sugar · No artificial colors · No preservatives\nOnly authentic Egyptian dates at their finest',
    orderNow: 'Order Now',
    viewMenu: 'View Menu',
    badge1: '100% Natural',
    badge2: 'Sugar Free',
    badge3: 'Handmade',
    badge4: 'Fast Delivery',
    deliveryBanner: '🚚 Free delivery inside Fifth Settlement until Oct 31',
    menuTitle: 'Menu',
    menuSub: 'Five flavors, each a story',
    price: '40 EGP / piece',
    seasonal: 'Coming Soon · Seasonal Flavors',
    seasonalDesc: 'Exclusive flavors for special occasions and holidays — stay tuned!',
    storyTitle: 'The Jumar Story',
    storySub: 'From our hands to your home',
    storyQ1: 'Why is it so hard to find something sweet and healthy at once?',
    storyQ2: 'Why does every ingredient list contain sugar, colors, and preservatives?',
    storyQ3: 'Why are natural sweets always either too expensive or not tasty?',
    storyText: 'Jumar was born as the answer to all these questions.',
    storyMeaning: 'Why Jumar?',
    storyMeaningText: 'Jumar is the heart of the palm tree — its purest, most precious part. That is exactly our philosophy: to bring you the best the date has to offer. Every piece is handmade in Fifth Settlement — find us at bazaars or order online for home delivery.',
    pricingTitle: 'Pricing',
    pricingSub: 'The more you order, the more you save',
    piece: '1 piece',
    pieces2: '2 pieces',
    box5: 'Box of 5',
    box8: 'Box of 8',
    box15: 'Box of 15',
    box24: 'Box of 24',
    gift: '+{n} gift',
    popular: 'Most Popular',
    reviewsTitle: 'What They Said',
    reviewsSub: 'Real reviews from Jumar customers',
    ctaTitle: 'Ready to Try Jumar?',
    ctaSub: 'Order now and we\'ll deliver to your door',
    ctaBtn: 'Order Now',
    ctaWa: 'Chat on WhatsApp',
    footerTagline: 'From the heart of the palm · From our hands to your home',
    footerLinks: ['Our Story', 'Menu', 'Pricing', 'Order Now', 'FAQ'],
    faq: 'FAQ',
    footerContact: 'Contact Us',
    footerLocation: 'Online Store · Fifth Settlement · Cairo',
    footerDelivery: '🚚 Free delivery in Fifth Settlement until 31/10',
    footerBazaar: '🏪 Lotus Bazaar Oct 22–24, 2026',
    copyright: '© 2026 Jumar · All rights reserved',
    dir: 'ltr',
  },
  fr: {
    ticker: ['🚚 Livraison gratuite dès 1500 EGP au Fifth Settlement jusqu\'au 31 oct', '🏪 Bazar Lotus 22–24 oct', '✨ Cadeaux offerts sur les grandes boîtes', '⏱️ Livraison en 4 jours après commande'],
    nav: { story: 'Notre histoire', menu: 'Menu', pricing: 'Tarifs', order: 'Commander' },
    heroTag: '🌴 Du Cœur du Palmier',
    heroTitle: ['Snack Premium'],
    heroSub: 'Sans sucre ajouté · Sans colorants artificiels · Sans conservateurs\nSeulement les meilleures dattes égyptiennes',
    orderNow: 'Commander',
    viewMenu: 'Voir le menu',
    badge1: '100% Naturel',
    badge2: 'Sans sucre',
    badge3: 'Fait main',
    badge4: 'Livraison rapide',
    deliveryBanner: '🚚 Livraison gratuite au Fifth Settlement jusqu\'au 31 octobre',
    menuTitle: 'Menu',
    menuSub: 'Cinq saveurs, chacune une histoire',
    price: '40 EGP / pièce',
    seasonal: 'Bientôt · Saveurs Saisonnières',
    seasonalDesc: 'Saveurs exclusives pour les occasions spéciales — restez à l\'écoute !',
    storyTitle: 'L\'histoire de Jumar',
    storySub: 'De nos mains à votre maison',
    storyQ1: 'Pourquoi est-il si difficile de trouver quelque chose de sucré et sain à la fois ?',
    storyQ2: 'Pourquoi chaque liste d\'ingrédients contient du sucre, des colorants et des conservateurs ?',
    storyQ3: 'Pourquoi les douceurs naturelles sont-elles toujours trop chères ou pas assez savoureuses ?',
    storyText: 'Jumar est né comme réponse à toutes ces questions.',
    storyMeaning: 'Pourquoi Jumar ?',
    storyMeaningText: 'Jumar est le cœur du palmier — sa partie la plus pure et la plus précieuse. C\'est exactement notre philosophie : vous apporter le meilleur de la datte. Chaque pièce est faite à la main au Fifth Settlement — trouvez-nous aux bazars ou commandez en ligne.',
    pricingTitle: 'Tarifs',
    pricingSub: 'Plus vous commandez, plus vous économisez',
    piece: '1 pièce',
    pieces2: '2 pièces',
    box5: 'Boîte de 5',
    box8: 'Boîte de 8',
    box15: 'Boîte de 15',
    box24: 'Boîte de 24',
    gift: '+{n} cadeau',
    popular: 'Plus populaire',
    reviewsTitle: 'Ce qu\'ils ont dit',
    reviewsSub: 'Vrais avis de clients Jumar',
    ctaTitle: 'Prêt à essayer Jumar ?',
    ctaSub: 'Commandez maintenant et nous livrons chez vous',
    ctaBtn: 'Commander',
    ctaWa: 'WhatsApp',
    footerTagline: 'Du cœur du palmier · De nos mains à votre maison',
    footerLinks: ['Notre histoire', 'Menu', 'Tarifs', 'Commander', 'FAQ'],
    faq: 'FAQ',
    footerContact: 'Contactez-nous',
    footerLocation: 'Boutique en ligne · Fifth Settlement · Le Caire',
    footerDelivery: '🚚 Livraison gratuite au Fifth Settlement jusqu\'au 31/10',
    footerBazaar: '🏪 Bazar Lotus 22–24 octobre 2026',
    copyright: '© 2026 Jumar · Tous droits réservés',
    dir: 'ltr',
  },
}

type Lang = 'ar' | 'en' | 'fr'

const PRODUCTS = [
  { key: 'tamriya', nameAr: 'تمرية الطحينة', nameEn: 'Tahini Tamriya', nameFr: 'Tamriya Tahini', ingAr: 'تمر مجدول + طحينة ناعمة + سمسم محمّص', ingEn: 'Medjool dates + smooth tahini + toasted sesame', ingFr: 'Dattes Medjool + tahini + sésame grillé', img: '/products/chocolate.jpg' },
  { key: 'fudge', nameAr: 'فدج الكاجو', nameEn: 'Cashew Fudge', nameFr: 'Fudge Cajou', ingAr: 'تمر مجدول + كاجو مطحون + زبدة طبيعية', ingEn: 'Medjool dates + ground cashew + natural butter', ingFr: 'Dattes Medjool + noix de cajou + beurre naturel', img: '/products/cashew.jpg' },
  { key: 'sultana', nameAr: 'سلطانة الفستق', nameEn: 'Pistachio Sultana', nameFr: 'Sultane Pistache', ingAr: 'تمر مجدول + فستق حلبي مختار', ingEn: 'Medjool dates + selected pistachio', ingFr: 'Dattes Medjool + pistache sélectionnée', img: '/products/pistachio.jpg' },
  { key: 'snickers_fool', nameAr: 'سنيكرز الفول السوداني', nameEn: 'Peanut Snickers', nameFr: 'Snickers Cacahuète', ingAr: 'تمر مجدول + فول سوداني محمّص + شوكولاتة دارك بلجيكية شوجر فري', ingEn: 'Medjool dates + roasted peanuts + Belgian dark chocolate sugar-free', ingFr: 'Dattes Medjool + cacahuètes grillées + chocolat belge noir sans sucre', img: '/products/box-pieces.jpg' },
  { key: 'snickers_bunduq', nameAr: 'سنيكرز البندق', nameEn: 'Hazelnut Snickers', nameFr: 'Snickers Noisette', ingAr: 'تمر مجدول + بندق + شوكولاتة دارك بلجيكية شوجر فري', ingEn: 'Medjool dates + hazelnuts + Belgian dark chocolate sugar-free', ingFr: 'Dattes Medjool + noisettes + chocolat belge noir sans sucre', img: '/products/branded-box.jpg' },
]

const PRICING = [
  { labelKey: 'piece' as const, qty: 1, gift: 0, price: 40, featured: false },
  { labelKey: 'pieces2' as const, qty: 2, gift: 0, price: 70, featured: false },
  { labelKey: 'box8' as const, qty: 8, gift: 2, price: 260, featured: false },
  { labelKey: 'box15' as const, qty: 15, gift: 3, price: 450, featured: true },
  { labelKey: 'box24' as const, qty: 24, gift: 4, price: 650, featured: false },
]

const REVIEWS = [
  { text: 'علبة تمر jumar مشكل تحفة الطعم جربت تمرية الطحينة والفدج وسنيكرز والكل لذيذ', author: 'عميلة جُمار', source: 'واتساب' },
  { text: 'خطير كله والله عجبني جدا وباكل فيهم كل يوم على الريق', author: 'عميل جُمار', source: 'واتساب' },
  { text: 'ابني حب المنتج جدا بشكركم صراحه تحفه · الكاجو بجد اكتر من رائعه · Top taste', author: 'عميلة جُمار', source: 'فيسبوك' },
]

type CartItem = { key: string; nameAr: string; qty: number; price: number }

function getCart(): CartItem[] {
  try { return JSON.parse(localStorage.getItem('jumar_cart') || '[]') } catch { return [] }
}
function saveCart(c: CartItem[]) {
  try { localStorage.setItem('jumar_cart', JSON.stringify(c)) } catch {}
}
function getSessionId(): string {
  try {
    let sid = localStorage.getItem('jumar_sid')
    if (!sid) { sid = `s_${Date.now()}_${Math.random().toString(36).slice(2,8)}`; localStorage.setItem('jumar_sid', sid) }
    return sid
  } catch { return `s_${Date.now()}` }
}
async function syncCartToSupabase(c: CartItem[]) {
  try {
    const { supabase } = await import('@/lib/supabase')
    const sid = getSessionId()
    await supabase.from('carts').upsert({
      session_id: sid,
      items: c,
      total_amount: c.reduce((s, i) => s + i.qty * i.price, 0),
      item_count: c.reduce((s, i) => s + i.qty, 0),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'session_id' })
  } catch {}
}

export default function HomePage() {
  const router = useRouter()
  const [lang, setLang] = useState<Lang>('ar')
  const [menuOpen, setMenuOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])
  const T = t[lang]
  const isRtl = lang === 'ar'

  useEffect(() => { setCart(getCart()) }, [])

  function addToCart(p: typeof PRODUCTS[0]) {
    setCart(prev => {
      const exists = prev.find(i => i.key === p.key)
      const next = exists
        ? prev.map(i => i.key === p.key ? { ...i, qty: i.qty + 1 } : i)
        : [...prev, { key: p.key, nameAr: p.nameAr, qty: 1, price: 40 }]
      saveCart(next)
      syncCartToSupabase(next)
      return next
    })
  }

  function removeFromCart(key: string) {
    setCart(prev => {
      const next = prev
        .map(i => i.key === key ? { ...i, qty: i.qty - 1 } : i)
        .filter(i => i.qty > 0)
      saveCart(next)
      syncCartToSupabase(next)
      return next
    })
  }

  function clearCart() {
    const empty: CartItem[] = []
    setCart(empty)
    saveCart(empty)
    syncCartToSupabase(empty)
  }

  const cartTotal = cart.reduce((s, i) => s + i.qty * i.price, 0)
  const cartCount = cart.reduce((s, i) => s + i.qty, 0)

  function goCheckout() {
    setCartOpen(false)
    router.push('/order?cart=1')
  }

  const productName = (p: typeof PRODUCTS[0]) =>
    lang === 'ar' ? p.nameAr : lang === 'en' ? p.nameEn : p.nameFr
  const productIng = (p: typeof PRODUCTS[0]) =>
    lang === 'ar' ? p.ingAr : lang === 'en' ? p.ingEn : p.ingFr

  return (
    <div dir={T.dir} style={{ fontFamily: "'Cairo', 'Noto Sans Arabic', system-ui, sans-serif" }}>

      {/* ── TICKER ─────────────────────────────────────── */}
      <div style={{
        background: '#3D2310', color: '#C9A84C',
        padding: '0.55rem 0',
        fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.05em',
        overflow: 'hidden', whiteSpace: 'nowrap',
      }}>
        <span style={{ display: 'inline-block', animation: isRtl ? 'ticker-rtl 28s linear infinite' : 'ticker-ltr 28s linear infinite' }}>
          {T.ticker.join('   ·   ')}  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;  {T.ticker.join('   ·   ')}
        </span>
      </div>

      {/* ── NAV ─────────────────────────────────────────── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 200,
        background: 'rgba(250,245,235,0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(201,168,76,0.18)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 1.5rem', height: 64,
      }}>
        <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
          <Image src="/logo.jpg" alt="جُمار" width={110} height={55} style={{ height: 48, width: 'auto', objectFit: 'contain' }} priority />
        </a>

        {/* Desktop links */}
        <ul style={{ display: 'flex', gap: '1.5rem', listStyle: 'none', alignItems: 'center', margin: 0, padding: 0 }}
          className="nav-desktop">
          <li><a href="#story" style={navLinkStyle}>{T.nav.story}</a></li>
          <li><a href="#menu" style={navLinkStyle}>{T.nav.menu}</a></li>
          <li><a href="#pricing" style={navLinkStyle}>{T.nav.pricing}</a></li>
          <li><a href="/faq" style={navLinkStyle}>{T.faq}</a></li>
          <li>
            <Link href="/order" style={{ background: '#3D2310', color: '#C9A84C', padding: '0.45rem 1.2rem', borderRadius: '2rem', textDecoration: 'none', fontSize: '0.88rem', fontWeight: 700 }}>
              {T.nav.order}
            </Link>
          </li>
        </ul>

        {/* Language switcher + cart */}
        <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
          {(['ar', 'en', 'fr'] as Lang[]).map(l => (
            <button key={l} onClick={() => setLang(l)} style={{
              padding: '0.2rem 0.55rem', borderRadius: '1rem', border: '1.5px solid',
              borderColor: lang === l ? '#C9A84C' : 'rgba(201,168,76,0.3)',
              background: lang === l ? '#3D2310' : 'transparent',
              color: lang === l ? '#C9A84C' : '#7A5C3A',
              fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.05em',
            }}>
              {l.toUpperCase()}
            </button>
          ))}
          {/* Cart icon */}
          <button onClick={() => setCartOpen(o => !o)} style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.3rem', color: '#3D2310', padding: '0.3rem', marginInlineStart: '0.25rem' }}>
            🛒
            {cartCount > 0 && (
              <span style={{ position: 'absolute', top: 0, right: 0, background: '#C9A84C', color: '#3D2310', fontSize: '0.6rem', fontWeight: 900, width: 16, height: 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{cartCount}</span>
            )}
          </button>
          {/* Mobile hamburger */}
          <button onClick={() => setMenuOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.4rem', color: '#3D2310', padding: '0.3rem', marginInlineStart: '0.25rem' }}
            className="nav-mobile-btn">
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {/* ── CART DRAWER ─────────────────────────────────── */}
      {cartOpen && (
        <>
          <div onClick={() => setCartOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 300 }} />
          <div style={{
            position: 'fixed', top: 0, bottom: 0,
            [isRtl ? 'left' : 'right']: 0,
            width: 'min(360px, 100vw)',
            background: '#FAF5EB', zIndex: 301,
            display: 'flex', flexDirection: 'column',
            boxShadow: '-4px 0 24px rgba(0,0,0,0.18)',
          }} dir="rtl">
            {/* Drawer header */}
            <div style={{ background: '#3D2310', padding: '1rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#C9A84C', fontWeight: 700, fontSize: '1rem' }}>🛒 سلة التسوق</span>
              <button onClick={() => setCartOpen(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: '1.3rem', cursor: 'pointer' }}>✕</button>
            </div>

            {/* Items */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', paddingTop: '3rem', color: '#7A5C3A' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🛒</div>
                  <p style={{ fontWeight: 700 }}>السلة فاضية</p>
                  <p style={{ fontSize: '0.85rem', marginTop: '0.4rem' }}>ضيف منتجات من المنيو</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {cart.map(item => (
                    <div key={item.key} style={{ background: '#fff', borderRadius: '1rem', padding: '0.9rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(201,168,76,0.2)' }}>
                      <div>
                        <p style={{ fontWeight: 700, color: '#3D2310', fontSize: '0.9rem', margin: 0 }}>{item.nameAr}</p>
                        <p style={{ color: '#C9A84C', fontWeight: 700, fontSize: '0.85rem', margin: '0.2rem 0 0' }}>{item.price * item.qty} ج</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <button onClick={() => removeFromCart(item.key)} style={{ width: 28, height: 28, border: '1.5px solid #C9A84C', borderRadius: '50%', background: 'transparent', color: '#3D2310', fontWeight: 700, cursor: 'pointer', fontSize: '1rem' }}>−</button>
                        <span style={{ fontWeight: 700, color: '#3D2310', minWidth: 20, textAlign: 'center' }}>{item.qty}</span>
                        <button onClick={() => addToCart(PRODUCTS.find(p => p.key === item.key)!)} style={{ width: 28, height: 28, border: '1.5px solid #C9A84C', borderRadius: '50%', background: '#C9A84C', color: '#3D2310', fontWeight: 700, cursor: 'pointer', fontSize: '1rem' }}>+</button>
                      </div>
                    </div>
                  ))}
                  <button onClick={clearCart} style={{ background: 'none', border: 'none', color: '#999', fontSize: '0.78rem', cursor: 'pointer', textAlign: 'right', padding: '0.25rem 0' }}>🗑 إفراغ السلة</button>
                </div>
              )}
            </div>

            {/* Drawer footer */}
            {cart.length > 0 && (
              <div style={{ padding: '1rem', borderTop: '1px solid rgba(201,168,76,0.2)', background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span style={{ fontWeight: 700, color: '#3D2310' }}>الإجمالي ({cartCount} قطعة)</span>
                  <span style={{ fontWeight: 900, color: '#C9A84C', fontSize: '1.1rem' }}>{cartTotal} ج</span>
                </div>
                {cartTotal < 1500 && (
                  <p style={{ fontSize: '0.75rem', color: '#7A5C3A', marginBottom: '0.75rem', background: 'rgba(201,168,76,0.1)', padding: '0.4rem 0.6rem', borderRadius: '0.5rem' }}>
                    🚚 أضف {1500 - cartTotal} ج للوصول للتوصيل المجاني
                  </p>
                )}
                {cartTotal >= 1500 && (
                  <p style={{ fontSize: '0.75rem', color: '#2A7A2A', marginBottom: '0.75rem', background: 'rgba(0,180,0,0.08)', padding: '0.4rem 0.6rem', borderRadius: '0.5rem' }}>
                    ✅ تهانينا! طلبك يستحق توصيل مجاني
                  </p>
                )}
                <button onClick={goCheckout} style={{ width: '100%', background: '#3D2310', color: '#C9A84C', border: 'none', borderRadius: '2rem', padding: '0.85rem', fontWeight: 700, fontSize: '0.95rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                  إتمام الطلب ←
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{
          position: 'fixed', top: 64, right: 0, left: 0, zIndex: 199,
          background: '#FAF5EB', borderBottom: '1px solid rgba(201,168,76,0.18)',
          padding: '1rem 1.5rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem',
        }}>
          {[['#story', T.nav.story], ['#menu', T.nav.menu], ['#pricing', T.nav.pricing], ['/faq', T.faq]].map(([href, label]) => (
            <a key={href} href={href} onClick={() => setMenuOpen(false)} style={{ ...navLinkStyle, fontSize: '1rem' }}>{label}</a>
          ))}
          <Link href="/order" onClick={() => setMenuOpen(false)} style={{ background: '#3D2310', color: '#C9A84C', padding: '0.7rem 1.2rem', borderRadius: '2rem', textDecoration: 'none', fontSize: '1rem', fontWeight: 700, textAlign: 'center' }}>
            {T.nav.order}
          </Link>
        </div>
      )}

      {/* ── HERO ────────────────────────────────────────── */}
      <section style={{
        position: 'relative', minHeight: '92vh',
        display: 'flex', alignItems: 'center',
        overflow: 'hidden',
        background: '#FAF5EB',
      }}>
        {/* Hero image — right side on desktop, full bg on mobile */}
        <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
          <Image
            src="/products/hero-box.jpg"
            alt="جُمار — علبة منتجات"
            fill
            style={{ objectFit: 'cover', objectPosition: isRtl ? 'left center' : 'right center', opacity: 0.18 }}
            priority
          />
          <div style={{ position: 'absolute', inset: 0, background: isRtl
            ? 'linear-gradient(to left, rgba(250,245,235,0.0) 0%, rgba(250,245,235,0.85) 45%, rgba(250,245,235,1) 70%)'
            : 'linear-gradient(to right, rgba(250,245,235,0.0) 0%, rgba(250,245,235,0.85) 45%, rgba(250,245,235,1) 70%)'
          }} />
        </div>

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', width: '100%', maxWidth: 1200, margin: '0 auto', padding: '4rem 1.5rem', gap: '3rem', flexWrap: 'wrap' }}>
          {/* Text side */}
          <div style={{ flex: '1 1 340px', textAlign: isRtl ? 'right' : 'left' }}>
            <span style={{
              display: 'inline-block', fontSize: '0.7rem', fontWeight: 700,
              letterSpacing: '0.25em', textTransform: 'uppercase', color: '#C9A84C',
              border: '1.5px solid rgba(201,168,76,0.4)', padding: '0.35rem 1rem',
              borderRadius: '2rem', marginBottom: '1.5rem',
            }}>{T.heroTag}</span>

            <div style={{ marginBottom: '1.5rem' }}>
              <Image src="/logo.jpg" alt="جُمار" width={120} height={60} style={{ height: 52, width: 'auto', objectFit: 'contain' }} priority />
            </div>

            <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(2.8rem,7vw,5rem)', fontWeight: 700, color: '#3D2310', lineHeight: 1.1, marginBottom: '1.25rem' }}>
              {T.heroTitle[0]}
            </h1>

            <p style={{ fontSize: 'clamp(0.95rem,2vw,1.1rem)', color: '#7A5C3A', lineHeight: 1.9, marginBottom: '2rem', whiteSpace: 'pre-line' }}>
              {T.heroSub}
            </p>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: isRtl ? 'flex-start' : 'flex-start' }}>
              <Link href="/order" style={btnPrimaryStyle}>{T.orderNow}</Link>
              <a href="#menu" style={btnSecondaryStyle}>{T.viewMenu}</a>
            </div>
          </div>

          {/* Product image — visible on desktop */}
          <div style={{ flex: '1 1 320px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: 'min(420px, 90vw)', aspectRatio: '1/1', borderRadius: '2rem', overflow: 'hidden', boxShadow: '0 32px 80px rgba(61,35,16,0.22)', border: '3px solid rgba(201,168,76,0.25)' }}>
              <Image
                src="/products/hero-box.jpg"
                alt="علبة جُمار"
                fill
                style={{ objectFit: 'cover' }}
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── BADGES ──────────────────────────────────────── */}
      <div style={{ background: '#EDE0C8', padding: '0.8rem 1rem', display: 'flex', justifyContent: 'center', gap: 'clamp(1rem,4vw,3rem)', flexWrap: 'wrap' }}>
        {[T.badge1, T.badge2, T.badge3, T.badge4].map(b => (
          <span key={b} style={{ fontSize: '0.78rem', fontWeight: 700, color: '#3D2310', letterSpacing: '0.1em', textTransform: 'uppercase' }}>✦ {b}</span>
        ))}
      </div>

      {/* ── DELIVERY BANNER ─────────────────────────────── */}
      <div style={{ background: 'linear-gradient(135deg,#3D2310,#5C3D1E)', color: '#C9A84C', textAlign: 'center', padding: '1rem', fontSize: '0.9rem', fontWeight: 700, letterSpacing: '0.05em' }}>
        {T.deliveryBanner}
      </div>

      {/* ── MENU ────────────────────────────────────────── */}
      <section id="menu" style={{ padding: 'clamp(3rem,6vw,5rem) 1.5rem', background: '#FAF5EB' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={sectionTagStyle}>🌿 {T.menuTitle}</p>
          <h2 style={sectionTitleStyle}>{T.menuSub}</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '1.5rem', marginTop: '2.5rem' }}>
            {PRODUCTS.map(p => {
              const inCart = cart.find(i => i.key === p.key)
              return (
              <div key={p.key} style={{ background: '#fff', borderRadius: '1.5rem', overflow: 'hidden', boxShadow: '0 4px 20px rgba(61,35,16,0.08)', border: `1.5px solid ${inCart ? '#C9A84C' : 'rgba(201,168,76,0.15)'}`, transition: 'transform 0.2s, box-shadow 0.2s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 32px rgba(61,35,16,0.14)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 20px rgba(61,35,16,0.08)' }}>
                <div style={{ position: 'relative', height: 180 }}>
                  <Image src={p.img} alt={productName(p)} fill style={{ objectFit: 'cover' }} />
                </div>
                <div style={{ padding: '1.2rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#3D2310', marginBottom: '0.4rem' }}>{productName(p)}</h3>
                  <p style={{ fontSize: '0.75rem', color: '#7A5C3A', lineHeight: 1.6 }}>{productIng(p)}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.8rem' }}>
                    <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#C9A84C', margin: 0 }}>{T.price}</p>
                    {inCart ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <button onClick={() => removeFromCart(p.key)} style={{ width: 26, height: 26, border: '1.5px solid #C9A84C', borderRadius: '50%', background: 'transparent', color: '#3D2310', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                        <span style={{ fontWeight: 700, color: '#3D2310', fontSize: '0.9rem', minWidth: 16, textAlign: 'center' }}>{inCart.qty}</span>
                        <button onClick={() => addToCart(p)} style={{ width: 26, height: 26, border: '1.5px solid #C9A84C', borderRadius: '50%', background: '#C9A84C', color: '#3D2310', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                      </div>
                    ) : (
                      <button onClick={() => { addToCart(p); setCartOpen(true) }} style={{ background: '#3D2310', color: '#C9A84C', border: 'none', borderRadius: '2rem', padding: '0.35rem 0.85rem', fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                        + أضف
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )})}

            {/* Seasonal coming soon */}
            <div style={{ background: 'linear-gradient(135deg,#3D2310,#5C3D1E)', borderRadius: '1.5rem', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem 1.2rem', textAlign: 'center', minHeight: 300 }}>
              <span style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🌙</span>
              <h3 style={{ color: '#C9A84C', fontWeight: 700, fontSize: '1rem', marginBottom: '0.6rem' }}>{T.seasonal}</h3>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.78rem', lineHeight: 1.6 }}>{T.seasonalDesc}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── STORY ────────────────────────────────────────── */}
      <section id="story" style={{ padding: 'clamp(3rem,6vw,5rem) 1.5rem', background: '#EDE0C8' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '3rem', alignItems: 'center' }}>
          {/* Photo grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'auto auto', gap: '0.75rem' }}>
            {['/products/pistachio.jpg', '/products/chocolate.jpg', '/products/hero.jpg', '/products/branded-box.jpg'].map((src, i) => (
              <div key={i} style={{ borderRadius: '1rem', overflow: 'hidden', aspectRatio: i === 2 ? '2/1' : '1/1', gridColumn: i === 2 ? '1 / -1' : undefined, position: 'relative', height: i === 2 ? 160 : 140 }}>
                <Image src={src} alt="" fill style={{ objectFit: 'cover' }} />
              </div>
            ))}
          </div>

          {/* Text */}
          <div>
            <p style={sectionTagStyle}>✨ {T.storyTitle}</p>
            <h2 style={{ ...sectionTitleStyle, textAlign: isRtl ? 'right' : 'left' }}>{T.storySub}</h2>
            <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[T.storyQ1, T.storyQ2, T.storyQ3].map((q, i) => (
                <p key={i} style={{ color: '#5C3D1E', fontStyle: 'italic', fontSize: '0.95rem', paddingInlineStart: '1rem', borderInlineStart: '3px solid #C9A84C' }}>{q}</p>
              ))}
            </div>
            <p style={{ marginTop: '1.5rem', fontSize: '1.05rem', fontWeight: 700, color: '#3D2310' }}>{T.storyText}</p>
            <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#7A5C3A', lineHeight: 1.8 }}>
              <strong style={{ color: '#3D2310' }}>{T.storyMeaning} </strong>{T.storyMeaningText}
            </p>
          </div>
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────── */}
      <section id="pricing" style={{ padding: 'clamp(3rem,6vw,5rem) 1.5rem', background: '#2A1A0A' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto' }}>
          <p style={{ ...sectionTagStyle, color: 'rgba(201,168,76,0.7)' }}>💰 {T.pricingTitle}</p>
          <h2 style={{ ...sectionTitleStyle, color: '#C9A84C', textAlign: 'center' }}>{T.pricingSub}</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '1rem', marginTop: '2.5rem' }}>
            {PRICING.map(item => (
              <div key={item.labelKey} style={{
                background: item.featured ? 'linear-gradient(135deg,#C9A84C,#E8C96A)' : 'rgba(255,255,255,0.06)',
                borderRadius: '1.5rem', padding: '1.5rem 1rem', textAlign: 'center',
                border: item.featured ? 'none' : '1px solid rgba(201,168,76,0.18)',
                position: 'relative',
              }}>
                {item.featured && (
                  <span style={{ position: 'absolute', top: '-0.7rem', left: '50%', transform: 'translateX(-50%)', background: '#3D2310', color: '#C9A84C', fontSize: '0.65rem', fontWeight: 700, padding: '0.2rem 0.75rem', borderRadius: '1rem', whiteSpace: 'nowrap' }}>
                    {T.popular}
                  </span>
                )}
                <p style={{ fontSize: '0.9rem', fontWeight: 700, color: item.featured ? '#3D2310' : '#C9A84C', marginBottom: '0.5rem' }}>{T[item.labelKey]}</p>
                {item.gift > 0 && <p style={{ fontSize: '0.72rem', color: item.featured ? '#5C3D1E' : 'rgba(201,168,76,0.7)', marginBottom: '0.5rem' }}>{T.gift.replace('{n}', String(item.gift))}</p>}
                <p style={{ fontSize: '2rem', fontWeight: 900, color: item.featured ? '#3D2310' : '#fff' }}>{item.price}</p>
                <p style={{ fontSize: '0.7rem', color: item.featured ? '#5C3D1E' : 'rgba(255,255,255,0.5)' }}>EGP</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── REVIEWS ──────────────────────────────────────── */}
      <section style={{ padding: 'clamp(3rem,6vw,5rem) 1.5rem', background: '#FAF5EB' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <p style={sectionTagStyle}>⭐ {T.reviewsTitle}</p>
          <h2 style={{ ...sectionTitleStyle, textAlign: 'center' }}>{T.reviewsSub}</h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '1.5rem', marginTop: '2.5rem' }}>
            {REVIEWS.map((r, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: '1.5rem', padding: '1.5rem', boxShadow: '0 4px 16px rgba(61,35,16,0.07)', border: '1px solid rgba(201,168,76,0.12)' }}>
                <div style={{ color: '#C9A84C', fontSize: '0.9rem', marginBottom: '0.75rem' }}>★★★★★</div>
                <p style={{ fontSize: '0.9rem', color: '#5C3D1E', lineHeight: 1.7, marginBottom: '1rem' }}>"{r.text}"</p>
                <div style={{ borderTop: '1px solid rgba(201,168,76,0.15)', paddingTop: '0.75rem' }}>
                  <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#3D2310' }}>{r.author}</p>
                  <p style={{ fontSize: '0.72rem', color: '#7A5C3A' }}>{r.source}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section id="order" style={{ padding: 'clamp(3rem,6vw,5rem) 1.5rem', background: 'linear-gradient(135deg,#3D2310,#5C3D1E)', textAlign: 'center' }}>
        <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(2rem,5vw,3rem)', color: '#C9A84C', marginBottom: '1rem' }}>{T.ctaTitle}</h2>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1rem', marginBottom: '2rem' }}>{T.ctaSub}</p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/order" style={{ ...btnPrimaryStyle, background: '#C9A84C', color: '#3D2310' }}>{T.ctaBtn}</Link>
          <a href="https://wa.me/201110330052" target="_blank" rel="noopener noreferrer" style={{ ...btnSecondaryStyle, borderColor: 'rgba(201,168,76,0.4)', color: '#C9A84C' }}>
            💬 {T.ctaWa}
          </a>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────── */}
      <footer style={{ background: '#1A0E05', color: 'rgba(255,255,255,0.6)', padding: '3rem 1.5rem 2rem' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '2rem', marginBottom: '2rem' }}>
          <div>
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '0.75rem', display: 'inline-block', padding: '0.35rem 0.6rem', marginBottom: '0.5rem' }}>
              <Image src="/logo.jpg" alt="جُمار" width={120} height={60} style={{ height: 52, width: 'auto', objectFit: 'contain', display: 'block' }} />
            </div>

            <p style={{ fontSize: '0.8rem', lineHeight: 1.7 }}>{T.footerTagline}</p>
          </div>
          <div>
            <p style={{ fontWeight: 700, color: '#fff', marginBottom: '0.75rem', fontSize: '0.85rem' }}>{T.nav.menu}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {(['#story', '#menu', '#pricing', '/order', '/faq'] as const).map((href, i) => (
                <a key={i} href={href} style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontSize: '0.82rem' }}>{T.footerLinks[i]}</a>
              ))}
            </div>
          </div>
          <div>
            <p style={{ fontWeight: 700, color: '#fff', marginBottom: '0.75rem', fontSize: '0.85rem' }}>{T.footerContact}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.82rem' }}>
              <span>📱 01110330052</span>
              <span>✉️ jumarfromheartofthepalm2026@gmail.com</span>
              <span>💳 InstaPay: 01110330052</span>
              <span>📍 {T.footerLocation}</span>
              <span style={{ color: '#C9A84C' }}>{T.footerDelivery}</span>
              <span style={{ color: '#C9A84C' }}>{T.footerBazaar}</span>
            </div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '1.5rem', textAlign: 'center', fontSize: '0.75rem' }}>
          {T.copyright}
        </div>
      </footer>

      {/* Fonts + animations */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Cairo:wght@300;400;600;700;900&display=swap');
        .nav-mobile-btn { display: none !important; }
        @media (max-width: 640px) {
          .nav-desktop { display: none !important; }
          .nav-mobile-btn { display: inline-block !important; }
        }
        @keyframes ticker-rtl {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes ticker-ltr {
          0%   { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </div>
  )
}

// ── Shared styles ────────────────────────────────────────────
const navLinkStyle: React.CSSProperties = {
  color: '#7A5C3A', textDecoration: 'none',
  fontSize: '0.88rem', fontWeight: 600,
}
const sectionTagStyle: React.CSSProperties = {
  fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.2em',
  textTransform: 'uppercase', color: '#C9A84C', marginBottom: '0.75rem', textAlign: 'center',
}
const sectionTitleStyle: React.CSSProperties = {
  fontFamily: "'Playfair Display', Georgia, serif",
  fontSize: 'clamp(1.8rem,4vw,2.8rem)', fontWeight: 700,
  color: '#3D2310', lineHeight: 1.2, textAlign: 'center',
}
const btnPrimaryStyle: React.CSSProperties = {
  background: '#3D2310', color: '#C9A84C',
  padding: '0.85rem 2rem', borderRadius: '3rem',
  textDecoration: 'none', fontSize: '0.95rem', fontWeight: 700,
  display: 'inline-block',
}
const btnSecondaryStyle: React.CSSProperties = {
  background: 'transparent', color: '#3D2310',
  padding: '0.85rem 2rem', borderRadius: '3rem',
  textDecoration: 'none', fontSize: '0.95rem', fontWeight: 700,
  border: '2px solid rgba(61,35,16,0.25)', display: 'inline-block',
}
