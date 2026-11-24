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

    if (confirm !== 'CLEAR') {
      return NextResponse.json(
        { error: 'Confirmation phrase must be exactly "CLEAR".' },
        { status: 400 }
      );
    }

    const sql = getDb();
    // Cascade deletes all votes as well
    await sql`DELETE FROM candidates;`;

    return NextResponse.json({
      success: true,
      message: 'All nominees and votes have been cleared. Ready for fresh candidate entry from No. 01.',
    });
  } catch (error) {
    console.error('Error in POST /api/admin/clear-candidates:', error);
    return NextResponse.json({ error: 'Failed to clear candidates' }, { status: 500 });
  }
}
