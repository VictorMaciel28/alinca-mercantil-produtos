import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { exchangeTinyAuthorizationCode, getActiveTinyOAuthAccount } from '@/lib/tinyOAuth'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code) {
    return NextResponse.json({ ok: false, error: 'missing_code' }, { status: 400 })
  }

  try {
    const redirectUri =
      process.env.TINY_OAUTH_REDIRECT_URI ||
      `${req.nextUrl.origin}/api/tiny/oauth/callback`

    const account = await getActiveTinyOAuthAccount()
    if (!account?.client_id || !account?.client_secret) {
      return NextResponse.json(
        { ok: false, error: 'missing_active_oauth_account' },
        { status: 400 }
      )
    }
    const { expiresAt } = await exchangeTinyAuthorizationCode({
      accountId: account.id,
      code,
      redirectUri,
    })

    return NextResponse.json({
      ok: true,
      message: 'oauth_connected',
      account_id: account.id,
      expires_at: expiresAt?.toISOString() || null,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        ok: false,
        error: 'oauth_callback_failed',
        detail: error?.message || String(error),
      },
      { status: 500 }
    )
  }
}
