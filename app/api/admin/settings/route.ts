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
    let rows = await sql`
      SELECT id, event_title, event_subtitle, organizer_label, status, require_pin, room_pin, timer_minutes, ends_at
      FROM event_settings
      WHERE id = 1
      LIMIT 1
    `;

    if (rows.length === 0) {
      await sql`
        INSERT INTO event_settings (id, event_title, event_subtitle, organizer_label, status, require_pin, room_pin, timer_minutes)
        VALUES (1, 'Live Event Voting', 'Audience Choice Award', 'Event Committee', 'WAITING', true, '2026', 5)
        ON CONFLICT (id) DO NOTHING
      `;
      rows = await sql`
        SELECT id, event_title, event_subtitle, organizer_label, status, require_pin, room_pin, timer_minutes, ends_at
        FROM event_settings
        WHERE id = 1
        LIMIT 1
      `;
    }

    return NextResponse.json({ settings: rows[0] });
  } catch (error) {
    console.error('Error in GET /api/admin/settings:', error);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await isAuthenticatedAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const {
      event_title,
      event_subtitle,
      organizer_label,
      status,
      require_pin,
      room_pin,
      timer_minutes,
      ends_at,
    } = body;

    const sql = getDb();

    // Fetch existing settings
    const currentRows = await sql`
      SELECT * FROM event_settings WHERE id = 1 LIMIT 1
    `;
    const cur = currentRows[0] || {};

    const updatedTitle = event_title !== undefined ? String(event_title).trim() : (cur.event_title || 'Live Event Voting');
    const updatedSubtitle = event_subtitle !== undefined ? String(event_subtitle).trim() : (cur.event_subtitle || 'Audience Choice Award');
    const updatedOrganizer = organizer_label !== undefined ? String(organizer_label).trim() : (cur.organizer_label || 'Event Committee');
    const updatedStatus = status !== undefined && ['WAITING', 'OPEN', 'CLOSED'].includes(status) ? status : (cur.status || 'WAITING');
    const updatedRequirePin = require_pin !== undefined ? Boolean(require_pin) : (cur.require_pin ?? true);
    const updatedRoomPin = room_pin !== undefined ? String(room_pin).replace(/\D/g, '').slice(0, 10) : (cur.room_pin || '2026');
    const updatedTimer = timer_minutes !== undefined ? Math.max(1, parseInt(timer_minutes, 10) || 5) : (cur.timer_minutes || 5);
    const updatedEndsAt = ends_at !== undefined ? ends_at : cur.ends_at;

    const result = await sql`
      UPDATE event_settings
      SET
        event_title = ${updatedTitle},
        event_subtitle = ${updatedSubtitle},
        organizer_label = ${updatedOrganizer},
        status = ${updatedStatus},
        require_pin = ${updatedRequirePin},
        room_pin = ${updatedRoomPin},
        timer_minutes = ${updatedTimer},
        ends_at = ${updatedEndsAt}
      WHERE id = 1
      RETURNING *
    `;

    return NextResponse.json({ success: true, settings: result[0] });
  } catch (error) {
    console.error('Error in PATCH /api/admin/settings:', error);
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
