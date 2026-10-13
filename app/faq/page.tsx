'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'

type Lang = 'ar' | 'en' | 'fr'

const t = {
  ar: {
    dir: 'rtl' as const,
    title: 'الأسئلة الشائعة',
    sub: 'كل اللي محتاج تعرفه عن جُمار',
    header: 'الأسئلة الشائعة',
    noAnswer: 'مش لاقي إجابة سؤالك؟',
    askWa: 'اسألنا على واتساب',
    back: '← الرجوع للموقع',
    cats: [
      {
        cat: '🚚 التوصيل',
        items: [
          { q: 'بتوصلوا فين؟', a: 'دلوقتي بنوصل داخل التجمع الخامس (الحي الأول لحد السادس، كمبوندات، بيفرلي هيلز، ماونتن فيو). قريباً هنوسع لمناطق تانية في القاهرة الجديدة. التوصيل مجاني من ١٥٠٠ جنيه.' },
          { q: 'التوصيل بكام؟', a: 'التوصيل مجاني من ١٥٠٠ جنيه داخل التجمع الخامس حتى ٣١ أكتوبر ٢٠٢٦ 🎉 بعد كده هيبقى بسعر رمزي.' },
          { q: 'بيوصل إمتى بعد الطلب؟', a: 'خلال ٤ أيام من تأكيد الطلب. لو طلبت قبل الساعة ٢ ظهر — بنحاول نوصل أسرع.' },
          { q: 'ممكن أحدد وقت التوصيل؟', a: 'أيوه! لما بنتواصل معاك لتأكيد الطلب، بنحدد معاك الوقت المناسب.' },
        ],
      },
      {
        cat: '💳 الدفع',
        items: [
          { q: 'طرق الدفع إيه؟', a: 'كاش عند الاستلام، أو InstaPay على الرقم 01110330052.' },
          { q: 'ممكن أدفع أونلاين؟', a: 'دلوقتي الدفع كاش أو InstaPay بس. الدفع بالكارت أونلاين قريباً!' },
        ],
      },
      {
        cat: '🍬 المنتج',
        items: [
          { q: 'إيه الفرق بين المنتجات؟', a: 'عندنا ٥ نكهات: تمرية الطحينة (تمر + طحينة + سمسم)، فدج الكاجو (تمر + كاجو + كريمة)، سلطانة الفستق (تمر + فستق حلبي)، سنيكرز الفول السوداني، وسنيكرز البندق. كل قطعة مغطّاة بشوكولاتة داكنة.' },
          { q: 'في سكر في المنتج؟', a: 'لا! مفيش سكر مضاف خالص. الحلاوة كلها من التمر المجدول الطبيعي.' },
          { q: 'مناسب للسكر والدايت؟', a: 'التمر بطبيعته سكر طبيعي (فركتوز وجلوكوز)، فهو طاقة طبيعية مش صناعية. بس لو عندك سكري، استشر دكتورك. المنتج خالي من سكر مضاف ومواد حافظة وألوان صناعية.' },
          { q: 'مدة الصلاحية كام؟', a: 'درجة حرارة الغرفة: ٧ أيام · التلاجة: ٣ شهور · الفريزر: ١٨ شهر. الأفضل تاكله طازج في أول أسبوع 😋' },
          { q: 'في حساسية من أي مكوّن؟', a: 'المنتجات بتحتوي على مكسرات (كاجو، فستق، بندق، فول سوداني) وسمسم وشوكولاتة. لو عندك حساسية من أي منها، ابعتلنا واتساب ونساعدك تختار المناسب.' },
        ],
      },
      {
        cat: '🎁 الهدايا والعلب',
        items: [
          { q: 'ممكن أطلب كهدية؟', a: 'أيوه! العلب جاهزة للإهداء بتغليف أنيق. ممكن تضيف رسالة شخصية في خانة الملاحظات عند الطلب.' },
          { q: 'إيه الهدايا المجانية على العلب الكبيرة؟', a: 'علبة ٨ قطع = +٢ هدية | علبة ١٥ قطعة = +٣ هدايا | علبة ٢٤ قطعة = +٤ هدايا 🎁' },
        ],
      },
      {
        cat: '🏪 البازار',
        items: [
          { q: 'فين البازار؟', a: 'بازار لوتس — التجمع الخامس، القاهرة الجديدة. ٢٢ لـ ٢٤ أكتوبر ٢٠٢٦.' },
          { q: 'ممكن أشتري في البازار؟', a: 'أيوه! هتلاقينا هناك بكل المنتجات. الدفع كاش بس في البازار.' },
        ],
      },
    ],
  },
  en: {
    dir: 'ltr' as const,
    title: 'FAQ',
    sub: 'Everything you need to know about Jumar',
    header: 'FAQ',
    noAnswer: "Can't find your answer?",
    askWa: 'Ask us on WhatsApp',
    back: 'Back to site →',
    cats: [
      {
        cat: '🚚 Delivery',
        items: [
          { q: 'Where do you deliver?', a: 'Currently we deliver within Fifth Settlement (Districts 1–6, compounds, Beverly Hills, Mountain View). We\'ll expand to other New Cairo areas soon. Free delivery from 1500 EGP.' },
          { q: 'How much is delivery?', a: 'Free delivery from 1500 EGP inside Fifth Settlement until October 31, 2026 🎉 After that, a small fee applies.' },
          { q: 'How long does delivery take?', a: 'Within 4 days of order confirmation. If you order before 2 PM, we try to deliver sooner.' },
          { q: 'Can I set a delivery time?', a: 'Yes! When we contact you to confirm the order, we\'ll agree on a convenient time.' },
        ],
      },
      {
        cat: '💳 Payment',
        items: [
          { q: 'What payment methods are available?', a: 'Cash on delivery, or InstaPay to 01110330052.' },
          { q: 'Can I pay online?', a: 'Currently cash or InstaPay only. Online card payment coming soon!' },
        ],
      },
      {
        cat: '🍬 Product',
        items: [
          { q: 'What are the differences between flavors?', a: 'We have 5 flavors: Tahini Tamriya (dates + tahini + sesame), Cashew Fudge (dates + cashew + cream), Pistachio Sultana (dates + pistachio), Peanut Snickers, and Hazelnut Snickers. Every piece is coated in dark chocolate.' },
          { q: 'Does the product contain sugar?', a: 'No added sugar at all! All sweetness comes from natural Medjool dates.' },
          { q: 'Is it suitable for diabetics or diets?', a: 'Dates naturally contain fruit sugars (fructose and glucose) — natural energy, not artificial. If you\'re diabetic, consult your doctor. The product is free from added sugar, preservatives, and artificial colors.' },
          { q: 'What is the shelf life?', a: 'Room temperature: 7 days · Fridge: 3 months · Freezer: 18 months. Best enjoyed fresh in the first week 😋' },
          { q: 'Any allergen information?', a: 'Products contain nuts (cashew, pistachio, hazelnut, peanut), sesame, and chocolate. If you have any allergy, message us on WhatsApp and we\'ll help you choose.' },
        ],
      },
      {
        cat: '🎁 Gifts & Boxes',
        items: [
          { q: 'Can I order as a gift?', a: 'Yes! Boxes come elegantly packaged for gifting. You can add a personal note in the order notes field.' },
          { q: 'What free gifts come with large boxes?', a: 'Box of 8 = +2 free | Box of 15 = +3 free | Box of 24 = +4 free 🎁' },
        ],
      },
      {
        cat: '🏪 Bazaar',
        items: [
          { q: 'Where is the bazaar?', a: 'Lotus Bazaar — Fifth Settlement, New Cairo. October 22–24, 2026.' },
          { q: 'Can I buy at the bazaar?', a: 'Yes! You\'ll find us there with all products. Cash only at the bazaar.' },
        ],
      },
    ],
  },
  fr: {
    dir: 'ltr' as const,
    title: 'FAQ',
    sub: 'Tout ce que vous devez savoir sur Jumar',
    header: 'FAQ',
    noAnswer: 'Vous ne trouvez pas votre réponse ?',
    askWa: 'Posez-nous la question sur WhatsApp',
    back: '← Retour au site',
    cats: [
      {
        cat: '🚚 Livraison',
        items: [
          { q: 'Où livrez-vous ?', a: 'Actuellement, nous livrons dans tout le Fifth Settlement (Districts 1–6, résidences, Beverly Hills, Mountain View). Bientôt dans d\'autres zones du Nouveau Caire. Livraison gratuite dès 1500 EGP.' },
          { q: 'Combien coûte la livraison ?', a: 'Livraison gratuite dès 1500 EGP au Fifth Settlement jusqu\'au 31 octobre 2026 🎉 Ensuite, des frais symboliques s\'appliqueront.' },
          { q: 'Combien de temps prend la livraison ?', a: 'Sous 4 jours après confirmation de la commande. Si vous commandez avant 14h, nous essayons de livrer plus tôt.' },
          { q: 'Puis-je choisir l\'heure de livraison ?', a: 'Oui ! Lorsque nous vous contactons pour confirmer la commande, nous convenons d\'un horaire.' },
        ],
      },
      {
        cat: '💳 Paiement',
        items: [
          { q: 'Quels sont les modes de paiement ?', a: 'Espèces à la livraison, ou InstaPay au 01110330052.' },
          { q: 'Puis-je payer en ligne ?', a: 'Actuellement espèces ou InstaPay uniquement. Paiement par carte en ligne bientôt !' },
        ],
      },
      {
        cat: '🍬 Produit',
        items: [
          { q: 'Quelles sont les différences entre les saveurs ?', a: 'Nous proposons 5 saveurs : Tamriya Tahini (dattes + tahini + sésame), Fudge Cajou (dattes + cajou + crème), Sultane Pistache (dattes + pistache), Snickers Cacahuète, et Snickers Noisette. Chaque pièce est enrobée de chocolat noir.' },
          { q: 'Le produit contient-il du sucre ?', a: 'Aucun sucre ajouté ! Toute la douceur vient des dattes Medjool naturelles.' },
          { q: 'Convient-il aux diabétiques ou aux régimes ?', a: 'Les dattes contiennent naturellement des sucres fruités (fructose et glucose) — une énergie naturelle. En cas de diabète, consultez votre médecin. Le produit est sans sucre ajouté, sans conservateurs ni colorants artificiels.' },
          { q: 'Quelle est la durée de conservation ?', a: 'Température ambiante : 7 jours · Réfrigérateur : 3 mois · Congélateur : 18 mois. À déguster frais dans la première semaine 😋' },
          { q: 'Informations sur les allergènes ?', a: 'Les produits contiennent des fruits à coque (cajou, pistache, noisette, cacahuète), du sésame et du chocolat. En cas d\'allergie, contactez-nous sur WhatsApp.' },
        ],
      },
      {
        cat: '🎁 Cadeaux & Boîtes',
        items: [
          { q: 'Puis-je commander en cadeau ?', a: 'Oui ! Les boîtes sont élégamment emballées pour offrir. Vous pouvez ajouter un message personnel dans les notes de commande.' },
          { q: 'Quels cadeaux gratuits avec les grandes boîtes ?', a: 'Boîte de 8 = +2 offertes | Boîte de 15 = +3 offertes | Boîte de 24 = +4 offertes 🎁' },
        ],
      },
      {
        cat: '🏪 Bazar',
        items: [
          { q: 'Où se trouve le bazar ?', a: 'Bazar Lotus — Fifth Settlement, Nouveau Caire. 22–24 octobre 2026.' },
          { q: 'Peut-on acheter au bazar ?', a: 'Oui ! Vous nous trouverez là-bas avec tous les produits. Espèces uniquement au bazar.' },
        ],
      },
    ],
  },
}

export default function FAQPage() {
  const [open, setOpen] = useState<string | null>(null)
  const [lang, setLang] = useState<Lang>('ar')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('jumar_lang') as Lang | null
      if (saved && ['ar', 'en', 'fr'].includes(saved)) setLang(saved)
    } catch {}
  }, [])

  function changeLang(l: Lang) {
    setLang(l)
    try { localStorage.setItem('jumar_lang', l) } catch {}
  }

  const T = t[lang]
  const brown = '#3D2310'
  const gold = '#C9A84C'
  const cream = '#FAF5EB'

  return (
    <div style={{ minHeight: '100vh', background: cream, fontFamily: "'Cairo', 'Segoe UI', sans-serif" }} dir={T.dir}>
      {/* Header */}
      <div style={{ background: brown, padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/">
          <Image src="/logo.jpg" alt="جُمار" width={100} height={50} style={{ height: 42, width: 'auto', objectFit: 'contain' }} />
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: gold, fontWeight: 700, fontSize: '0.9rem' }}>{T.header}</span>
          <div style={{ display: 'flex', gap: '0.3rem', marginInlineStart: '0.75rem' }}>
            {(['ar', 'en', 'fr'] as Lang[]).map(l => (
              <button key={l} onClick={() => changeLang(l)} style={{
                padding: '0.15rem 0.45rem', borderRadius: '1rem', border: '1.5px solid',
                borderColor: lang === l ? gold : 'rgba(201,168,76,0.35)',
                background: lang === l ? gold : 'transparent',
                color: lang === l ? brown : 'rgba(201,168,76,0.8)',
                fontSize: '0.65rem', fontWeight: 700, cursor: 'pointer',
              }}>{l.toUpperCase()}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <h1 style={{ color: brown, fontSize: '1.8rem', fontWeight: 700, marginBottom: '0.4rem' }}>{T.title}</h1>
        <p style={{ color: '#7A5C3A', fontSize: '0.9rem', marginBottom: '2.5rem' }}>{T.sub}</p>

        {T.cats.map(cat => (
          <div key={cat.cat} style={{ marginBottom: '2rem' }}>
            <h2 style={{ color: brown, fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: `2px solid rgba(201,168,76,0.25)` }}>
              {cat.cat}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {cat.items.map(item => {
                const key = cat.cat + item.q
                const isOpen = open === key
                return (
                  <div key={item.q} style={{ background: '#fff', borderRadius: '0.875rem', border: `1.5px solid ${isOpen ? gold : 'rgba(201,168,76,0.2)'}`, overflow: 'hidden', transition: 'border-color 0.2s' }}>
                    <button
                      onClick={() => setOpen(isOpen ? null : key)}
                      style={{ width: '100%', padding: '0.9rem 1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', textAlign: T.dir === 'rtl' ? 'right' : 'left', fontFamily: 'inherit' }}>
                      <span style={{ fontWeight: 700, color: brown, fontSize: '0.9rem', flex: 1 }}>{item.q}</span>
                      <span style={{ color: gold, fontWeight: 700, fontSize: '1.1rem', marginInlineStart: '0.75rem', transition: 'transform 0.2s', display: 'inline-block', transform: isOpen ? 'rotate(45deg)' : 'none' }}>+</span>
                    </button>
                    {isOpen && (
                      <div style={{ padding: '0 1.1rem 1rem', color: '#555', fontSize: '0.88rem', lineHeight: 1.8, borderTop: '1px solid rgba(201,168,76,0.15)' }}>
                        {item.a}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* CTA */}
        <div style={{ background: brown, borderRadius: '1.25rem', padding: '1.5rem', textAlign: 'center', marginTop: '1rem' }}>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.88rem', marginBottom: '0.75rem' }}>{T.noAnswer}</p>
          <a href="https://wa.me/201110330052" target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-block', background: '#25D366', color: '#fff', borderRadius: '2rem', padding: '0.7rem 1.5rem', fontWeight: 700, textDecoration: 'none', fontSize: '0.9rem' }}>
            💬 {T.askWa}
          </a>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link href="/" style={{ color: gold, textDecoration: 'none', fontWeight: 700, fontSize: '0.88rem' }}>{T.back}</Link>
        </div>
      </div>

      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');`}</style>
    </div>
  )
}
