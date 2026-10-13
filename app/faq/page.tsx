'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

const FAQS = [
  {
    cat: '🚚 التوصيل',
    items: [
      {
        q: 'بتوصلوا فين؟',
        a: 'دلوقتي بنوصل داخل التجمع الخامس (الحي الأول لحد السادس، كمبوندات، بيفرلي هيلز، ماونتن فيو). قريباً هنوسع لمناطق تانية في القاهرة الجديدة. التوصيل مجاني من ١٥٠٠ جنيه.',
      },
      {
        q: 'التوصيل بكام؟',
        a: 'التوصيل مجاني من ١٥٠٠ جنيه داخل التجمع الخامس حتى ٣١ أكتوبر ٢٠٢٦ 🎉 بعد كده هيبقى بسعر رمزي.',
      },
      {
        q: 'بيوصل إمتى بعد الطلب؟',
        a: 'خلال ٤ أيام من تأكيد الطلب. لو طلبت قبل الساعة ٢ ظهر — بنحاول نوصل أسرع.',
      },
      {
        q: 'ممكن أحدد وقت التوصيل؟',
        a: 'أيوه! لما بنتواصل معاك لتأكيد الطلب، بنحدد معاك الوقت المناسب.',
      },
    ],
  },
  {
    cat: '💳 الدفع',
    items: [
      {
        q: 'طرق الدفع إيه؟',
        a: 'كاش عند الاستلام، أو InstaPay على الرقم 01110330052.',
      },
      {
        q: 'ممكن أدفع أونلاين؟',
        a: 'دلوقتي الدفع كاش أو InstaPay بس. الدفع بالكارت أونلاين قريباً!',
      },
    ],
  },
  {
    cat: '🍬 المنتج',
    items: [
      {
        q: 'إيه الفرق بين المنتجات؟',
        a: 'عندنا ٥ نكهات: تمرية الطحينة (تمر + طحينة + سمسم)، فدج الكاجو (تمر + كاجو + كريمة)، سلطانة الفستق (تمر + فستق حلبي)، سنيكرز الفول السوداني، وسنيكرز البندق. كل قطعة مغطّاة بشوكولاتة داكنة.',
      },
      {
        q: 'في سكر في المنتج؟',
        a: 'لا! مفيش سكر مضاف خالص. الحلاوة كلها من التمر المجدول الطبيعي.',
      },
      {
        q: 'مناسب للسكر والدايت؟',
        a: 'التمر بطبيعته سكر طبيعي (فركتوز وجلوكوز)، فهو طاقة طبيعية مش صناعية. بس لو عندك سكري، استشر دكتورك. المنتج خالي من سكر مضاف ومواد حافظة وألوان صناعية.',
      },
      {
        q: 'مدة الصلاحية كام؟',
        a: 'درجة حرارة الغرفة: ٧ أيام · التلاجة: ٣ شهور · الفريزر: ١٨ شهر. الأفضل تاكله طازج في أول أسبوع 😋',
      },
      {
        q: 'في حساسية من أي مكوّن؟',
        a: 'المنتجات بتحتوي على مكسرات (كاجو، فستق، بندق، فول سوداني) وسمسم وشوكولاتة. لو عندك حساسية من أي منها، ابعتلنا واتساب ونساعدك تختار المناسب.',
      },
    ],
  },
  {
    cat: '🎁 الهدايا والعلب',
    items: [
      {
        q: 'ممكن أطلب كهدية؟',
        a: 'أيوه! العلب جاهزة للإهداء بتغليف أنيق. ممكن تضيف رسالة شخصية في خانة الملاحظات عند الطلب.',
      },
      {
        q: 'إيه الهدايا المجانية على العلب الكبيرة؟',
        a: 'علبة ٨ قطع = +٢ هدية | علبة ١٥ قطعة = +٣ هدايا | علبة ٢٤ قطعة = +٤ هدايا 🎁',
      },
    ],
  },
  {
    cat: '🏪 البازار',
    items: [
      {
        q: 'فين البازار؟',
        a: 'بازار لوتس — التجمع الخامس، القاهرة الجديدة. ٢٢ لـ ٢٤ أكتوبر ٢٠٢٦.',
      },
      {
        q: 'ممكن أشتري في البازار؟',
        a: 'أيوه! هتلاقينا هناك بكل المنتجات. الدفع كاش بس في البازار.',
      },
    ],
  },
]

export default function FAQPage() {
  const [open, setOpen] = useState<string | null>(null)
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
        <span style={{ color: gold, fontWeight: 700, fontSize: '0.9rem' }}>الأسئلة الشائعة</span>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '2rem 1.5rem' }}>
        <h1 style={{ color: brown, fontSize: '1.8rem', fontWeight: 700, marginBottom: '0.4rem' }}>الأسئلة الشائعة</h1>
        <p style={{ color: '#7A5C3A', fontSize: '0.9rem', marginBottom: '2.5rem' }}>كل اللي محتاج تعرفه عن جُمار</p>

        {FAQS.map(cat => (
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
                      style={{ width: '100%', padding: '0.9rem 1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'right', fontFamily: 'inherit' }}>
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
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.88rem', marginBottom: '0.75rem' }}>مش لاقي إجابة سؤالك؟</p>
          <a href="https://wa.me/201110330052" target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-block', background: '#25D366', color: '#fff', borderRadius: '2rem', padding: '0.7rem 1.5rem', fontWeight: 700, textDecoration: 'none', fontSize: '0.9rem' }}>
            💬 اسألنا على واتساب
          </a>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link href="/" style={{ color: gold, textDecoration: 'none', fontWeight: 700, fontSize: '0.88rem' }}>← الرجوع للموقع</Link>
        </div>
      </div>
    </div>
  )
}
