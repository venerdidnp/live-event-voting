import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticatedAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticatedAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const candId = parseInt(id, 10);
  if (isNaN(candId)) {
    return NextResponse.json({ error: 'Invalid candidate ID' }, { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { number, name, category, costume_theme, photo_data, is_active } = body;

    const sql = getDb();
    const existing = await sql`SELECT * FROM candidates WHERE id = ${candId} LIMIT 1`;
    if (existing.length === 0) {
      return NextResponse.json({ error: 'Candidate not found' }, { status: 404 });
    }
    const current = existing[0];

    let updatedNumber = current.number;
    if (number !== undefined) {
      const parsedNum = parseInt(number, 10);
      if (!isNaN(parsedNum) && parsedNum > 0) {
        // If changed number, ensure no other candidate has it
        const dupCheck = await sql`
          SELECT id FROM candidates WHERE number = ${parsedNum} AND id != ${candId} LIMIT 1
        `;
        if (dupCheck.length === 0) {
          updatedNumber = parsedNum;
        }
      }
    }

    const updatedName = name !== undefined ? String(name).trim() : current.name;
    const updatedCategory = category !== undefined ? String(category).trim() : current.category;
    const updatedTheme = costume_theme !== undefined ? String(costume_theme).trim() : current.costume_theme;
    const updatedActive = is_active !== undefined ? Boolean(is_active) : current.is_active;

    let updatedPhoto = current.photo_data;
    if (photo_data && typeof photo_data === 'string') {
      const photoByteLength = Buffer.byteLength(photo_data, 'utf8');
      if (photoByteLength > 250 * 1024) {
        return NextResponse.json(
          { error: `Photo payload (${Math.round(photoByteLength / 1024)} KB) exceeds 250 KB limit.` },
          { status: 400 }
        );
      }
      updatedPhoto = photo_data;
    }

    const result = await sql`
      UPDATE candidates
      SET
        number = ${updatedNumber},
        name = ${updatedName},
        category = ${updatedCategory},
        costume_theme = ${updatedTheme},
        photo_data = ${updatedPhoto},
        is_active = ${updatedActive}
      WHERE id = ${candId}
      RETURNING *
    `;

    return NextResponse.json({ success: true, candidate: result[0] });
  } catch (error) {
    console.error('Error in PATCH /api/admin/candidates/[id]:', error);
    return NextResponse.json({ error: 'Failed to update candidate' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticatedAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const candId = parseInt(id, 10);
  if (isNaN(candId)) {
    return NextResponse.json({ error: 'Invalid candidate ID' }, { status: 400 });
  }

  try {
    const sql = getDb();
    await sql`DELETE FROM candidates WHERE id = ${candId}`;
    return NextResponse.json({ success: true, message: 'Candidate deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/admin/candidates/[id]:', error);
    return NextResponse.json({ error: 'Failed to delete candidate' }, { status: 500 });
  }
}
