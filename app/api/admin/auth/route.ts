import { NextRequest, NextResponse } from 'next/server';
import { createAdminSessionToken, SESSION_COOKIE_NAME } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { password } = body;

    const expectedPassword = process.env.ADMIN_PASSWORD || 'admin';

    if (!password || password !== expectedPassword) {
      return NextResponse.json(
        { error: 'Invalid admin password.' },
        { status: 401 }
      );
    }

    const token = createAdminSessionToken();
    const isProduction = process.env.NODE_ENV === 'production';

    const response = NextResponse.json({
      success: true,
      message: 'Admin authenticated successfully.',
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Error in POST /api/admin/auth:', error);
    return NextResponse.json(
      { error: 'Failed to authenticate admin.' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({
    success: true,
    message: 'Admin session terminated.',
  });

  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}
