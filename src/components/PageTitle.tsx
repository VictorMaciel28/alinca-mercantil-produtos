import { Col, Row } from 'react-bootstrap'
import IconifyIcon from './wrappers/IconifyIcon'
import Link from 'next/link'
import { ReactNode } from 'react'

const PageTitle = ({
  title,
  subName,
  actions,
  compactRight,
}: {
  title: string
  subName: string
  actions?: ReactNode
  compactRight?: boolean
}) => {
  return (
    <Row>
      <Col xs={12}>
        <div className="page-title-box">
          {compactRight ? (
            <div className="w-100">
              <div className="d-flex d-md-none justify-content-between align-items-center w-100 mb-2">
                <h4 className="mb-0 fw-semibold">{title}</h4>
                <div className="d-flex justify-content-end">
                  {actions}
                </div>
              </div>
              <div className="d-flex d-md-none justify-content-start w-100">
                <ol className="breadcrumb mb-0 d-flex flex-wrap">
                  <li className="breadcrumb-item">
                    <Link href="">{subName}</Link>
                  </li>{' '}
                  &nbsp;
                  <IconifyIcon width={22} height={21} icon="ri:arrow-drop-right-line" />
                  &nbsp;
                  <li className="breadcrumb-item active">{title}</li>
                </ol>
              </div>

              <div className="d-none d-md-flex justify-content-between align-items-center w-100">
                <h4 className="mb-0 fw-semibold">{title}</h4>
                <div className="d-flex align-items-center gap-2 ms-auto">
                  {actions}
                  <ol className="breadcrumb mb-0 d-flex flex-wrap">
                    <li className="breadcrumb-item">
                      <Link href="">{subName}</Link>
                    </li>{' '}
                    &nbsp;
                    <IconifyIcon width={22} height={21} icon="ri:arrow-drop-right-line" />
                    &nbsp;
                    <li className="breadcrumb-item active">{title}</li>
                  </ol>
                </div>
              </div>
            </div>
          ) : (
            <>
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item">
                  <Link href="">{subName}</Link>
                </li>{' '}
                &nbsp;
                <IconifyIcon width={22} height={21} icon="ri:arrow-drop-right-line" />
                &nbsp;
                <li className="breadcrumb-item active">{title}</li>
              </ol>
              {actions ? <div className="d-flex justify-content-end py-2">{actions}</div> : null}
              <h4 className="mb-0 fw-semibold">{title}</h4>
            </>
          )}
        </div>
      </Col>
    </Row>
  )
}

export default PageTitle
