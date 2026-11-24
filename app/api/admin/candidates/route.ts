import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticatedAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAuthenticatedAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sql = getDb();
    const candidates = await sql`
      SELECT 
        c.id,
        c.number,
        c.name,
        c.category,
        c.costume_theme,
        c.photo_data,
        c.is_active,
        c.created_at,
        COUNT(v.id)::int AS votes
      FROM candidates c
      LEFT JOIN votes v ON c.id = v.candidate_id
      GROUP BY c.id
      ORDER BY c.number ASC
    `;

    return NextResponse.json({ candidates });
  } catch (error) {
    console.error('Error in GET /api/admin/candidates:', error);
    return NextResponse.json({ error: 'Failed to fetch candidate list' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticatedAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { number, name: rawName, category, costume_theme, photo_data, is_active } = body;

    const name = String(rawName || '').trim();
    if (!name) {
      return NextResponse.json({ error: 'Candidate name is required.' }, { status: 400 });
    }

    if (!photo_data || typeof photo_data !== 'string') {
      return NextResponse.json({ error: 'Candidate photo data is required.' }, { status: 400 });
    }

    // Payload size safety validation: <= 250 KB
    const photoByteLength = Buffer.byteLength(photo_data, 'utf8');
    if (photoByteLength > 250 * 1024) {
      return NextResponse.json(
        { error: `Compressed photo size (${Math.round(photoByteLength / 1024)} KB) exceeds the 250 KB limit.` },
        { status: 400 }
      );
    }

    const sql = getDb();

    // Auto-calculate or validate candidate number
    let candNumber = parseInt(number, 10);
    if (isNaN(candNumber) || candNumber <= 0) {
      const maxRows = await sql`SELECT COALESCE(MAX(number), 0) as max_num FROM candidates`;
      candNumber = (maxRows[0]?.max_num || 0) + 1;
    } else {
      // Check if number already exists
      const existing = await sql`SELECT id FROM candidates WHERE number = ${candNumber} LIMIT 1`;
      if (existing.length > 0) {
        const maxRows = await sql`SELECT COALESCE(MAX(number), 0) as max_num FROM candidates`;
        candNumber = (maxRows[0]?.max_num || 0) + 1;
      }
    }

    const cat = category ? String(category).trim() : 'Participant';
    const theme = costume_theme ? String(costume_theme).trim() : null;
    const active = is_active !== undefined ? Boolean(is_active) : true;

    const inserted = await sql`
      INSERT INTO candidates (number, name, category, costume_theme, photo_data, is_active)
      VALUES (${candNumber}, ${name}, ${cat}, ${theme}, ${photo_data}, ${active})
      RETURNING *
    `;

    return NextResponse.json({
      success: true,
      candidate: { ...inserted[0], votes: 0 },
    });
  } catch (error) {
    console.error('Error in POST /api/admin/candidates:', error);
    return NextResponse.json({ error: 'Failed to create candidate' }, { status: 500 });
  }
}
