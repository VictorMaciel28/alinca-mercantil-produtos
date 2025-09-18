import { MenuItemType } from '@/types/menu'

export const MENU_ITEMS: MenuItemType[] = [
  {
    key: 'custom',
    label: 'Menu',
    isTitle: true,
  },
  {
    key: 'pedidos',
    label: 'Pedidos',
    icon: 'ri:menu-line',
    url: '/pedidos',
  },
  {
    key: 'propostas',
    label: 'Propostas Comerciais',
    icon: 'ri:menu-line',
    url: '/propostas',
  },
]
