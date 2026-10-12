export type OrderStatus = 'new' | 'preparing' | 'ready' | 'shipped' | 'delivered' | 'cancelled'

export interface Customer {
  id: string
  name: string
  phone: string
  whatsapp: string
  area: string
  address: string
  created_at: string
}

export interface OrderItem {
  id: string
  order_id: string
  product_name: string
  quantity: number
}

export interface Order {
  id: string
  customer_id: string
  status: OrderStatus
  box_qty: number
  total_price: number
  notes: string
  created_at: string
  updated_at: string
  customers?: Customer
  order_items?: OrderItem[]
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: '🆕 جديد',
  preparing: '👩‍🍳 قيد التحضير',
  ready: '✅ جاهز',
  shipped: '🚚 تم الشحن',
  delivered: '🎉 تم التوصيل',
  cancelled: '❌ ملغي',
}

export const STATUS_COLORS: Record<OrderStatus, string> = {
  new: 'bg-blue-100 text-blue-800',
  preparing: 'bg-yellow-100 text-yellow-800',
  ready: 'bg-green-100 text-green-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
}

export const PRODUCTS = [
  { key: 'تمرية', name: 'تمرية الطحينة', desc: 'تمر، طحينة، بندق، سمسم' },
  { key: 'فدج', name: 'فدج الكاجو', desc: 'تمر، كاجو، زبدة' },
  { key: 'سلطانة', name: 'سلطانة', desc: 'تمر مجدول، فستق' },
  { key: 'سنيكرز_سوداني', name: 'سنيكرز فول سوداني', desc: 'تمر، فول سوداني، شوكولاتة دارك' },
]

export const BOXES = [
  { qty: 8, price: 240 },
  { qty: 15, price: 415 },
  { qty: 24, price: 600 },
]
