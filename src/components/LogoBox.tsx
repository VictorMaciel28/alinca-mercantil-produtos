import logoDark from '@/assets/images/logo-dark.png'
import logoSm from '@/assets/images/logo-sm.png'
import Image from 'next/image'
import Link from 'next/link'

const LogoBox = () => {
  return (
    <div className="logo-box">
      <Link href="/dashboards/analytics" className="logo-dark">
        <Image width={44} height={44} src={logoSm} className="logo-sm" alt="logo sm" />
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
          <Image width={150} height={56} src={logoDark} className="logo-lg" alt="logo dark" />
        </div>
      </Link>
      <Link href="/dashboards/analytics" className="logo-light">
        <Image width={44} height={44} src={logoSm} className="logo-sm" alt="logo sm" />
        <Image width={150} height={56} src={logoDark} className="logo-lg" alt="logo dark" />
      </Link>
    </div>
  )
}

export default LogoBox
