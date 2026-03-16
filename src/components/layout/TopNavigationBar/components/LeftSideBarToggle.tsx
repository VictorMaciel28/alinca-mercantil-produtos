'use client'
import IconifyIcon from '@/components/wrappers/IconifyIcon'
import React from 'react'
import { useLayoutContext } from '@/context/useLayoutContext'

const LeftSideBarToggle = () => {
  const {
    menu: { size },
    changeMenu: { size: changeMenuSize },
  } = useLayoutContext()

  const handleMenuSize = () => {
    if (size === 'hidden') {
      const htmlTag = document.getElementsByTagName('html')[0]
      htmlTag.classList.toggle('sidebar-enable')
      return
    }
    if (size === 'condensed') changeMenuSize('default')
    else if (size === 'default') changeMenuSize('condensed')
  }

  return (
    <div className="topbar-item">
      <button type="button" onClick={handleMenuSize} className="button-toggle-menu topbar-button">
        <IconifyIcon icon="ri:menu-2-line" width={24} height={24} className="fs-24" />
      </button>
    </div>
  )
}

export default LeftSideBarToggle
