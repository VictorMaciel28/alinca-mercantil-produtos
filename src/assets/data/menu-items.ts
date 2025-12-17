import { MenuItemType } from '@/types/menu'

export const MENU_ITEMS: MenuItemType[] = [
  {
    key: 'custom',
    label: 'Menu',
    isTitle: true,
  },
  {
    key: 'vendas',
    label: 'Vendas',
    icon: 'ri:shopping-bag-3-line',
    children: [
      {
        key: 'pedidos',
        label: 'Pedidos',
        icon: 'ri:menu-line',
        url: '/pedidos',
        parentKey: 'vendas',
      },
      {
        key: 'propostas',
        label: 'Propostas Comerciais',
        icon: 'ri:file-list-3-line',
        url: '/propostas',
        parentKey: 'vendas',
      },
    ],
  },
  {
    key: 'administracao',
    label: 'Administração',
    icon: 'ri:settings-3-line',
    children: [
      {
        key: 'clientes',
        label: 'Clientes',
        icon: 'ri:team-line',
        url: '/clientes',
        parentKey: 'administracao',
      },
      {
        key: 'vendedores',
        label: 'Vendedores',
        icon: 'ri:user-star-line',
        url: '/vendedores',
        parentKey: 'administracao',
      },
      {
        key: 'supervisores',
        label: 'Supervisores',
        icon: 'ri:user-settings-line',
        url: '/supervisores',
        parentKey: 'administracao',
      },
      {
        key: 'televendas',
        label: 'Televendas',
        icon: 'ri:phone-line',
        url: '/televendas',
        parentKey: 'administracao',
      },
    ],
  },
  {
    key: 'comissoes',
    label: 'Comissões',
    icon: 'ri:money-dollar-circle-line',
    url: '/comissoes',
  },
]
