import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticatedAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!(await isAuthenticatedAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { confirm } = body;

    if (confirm !== 'RESET') {
      return NextResponse.json(
        { error: 'Confirmation phrase must be exactly "RESET".' },
        { status: 400 }
      );
    }

    const sql = getDb();
    await sql`DELETE FROM votes;`;

    return NextResponse.json({
      success: true,
      message: 'All trial votes have been successfully reset to 0.',
    });
  } catch (error) {
    console.error('Error in POST /api/admin/reset-votes:', error);
    return NextResponse.json({ error: 'Failed to reset votes' }, { status: 500 });
  }
}
