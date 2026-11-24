import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sql = getDb();
    const candidates = await sql`
      SELECT id, number, name, category, costume_theme, photo_data, is_active
      FROM candidates
      WHERE is_active = true
      ORDER BY number ASC
    `;

    return NextResponse.json({ candidates });
  } catch (error) {
    console.error('Error in GET /api/candidates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch candidate list' },
      { status: 500 }
    );
  }
}
