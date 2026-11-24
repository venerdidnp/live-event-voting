import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sql = getDb();

    // Fetch or ensure default settings row
    let rows = await sql`
      SELECT id, event_title, event_subtitle, organizer_label, status, require_pin, timer_minutes, ends_at
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
        SELECT id, event_title, event_subtitle, organizer_label, status, require_pin, timer_minutes, ends_at
        FROM event_settings
        WHERE id = 1
        LIMIT 1
      `;
    }

    const settings = rows[0];

    // Auto-close if timer expired
    if (settings.status === 'OPEN' && settings.ends_at && new Date(settings.ends_at).getTime() <= Date.now()) {
      await sql`
        UPDATE event_settings
        SET status = 'CLOSED', ends_at = NULL
        WHERE id = 1
      `;
      settings.status = 'CLOSED';
      settings.ends_at = null;
    }

    // Check if voter has already voted via cookie
    const cookieStore = await cookies();
    const voterToken = cookieStore.get('voted_token')?.value;

    let hasVoted = false;
    let votedCandidate = null;
    let votedAt: string | null = null;

    if (voterToken) {
      const voteRows = await sql`
        SELECT v.id as vote_id, v.created_at, c.id, c.number, c.name, c.category, c.costume_theme, c.photo_data
        FROM votes v
        JOIN candidates c ON v.candidate_id = c.id
        WHERE v.voter_token = ${voterToken}
        LIMIT 1
      `;

      if (voteRows.length > 0) {
        hasVoted = true;
        const v = voteRows[0];
        votedAt = v.created_at;
        votedCandidate = {
          id: v.id,
          number: v.number,
          name: v.name,
          category: v.category,
          costume_theme: v.costume_theme,
          photo_data: v.photo_data,
        };
      }
    }

    return NextResponse.json({
      event_title: settings.event_title,
      event_subtitle: settings.event_subtitle,
      organizer_label: settings.organizer_label,
      status: settings.status,
      require_pin: settings.require_pin,
      timer_minutes: settings.timer_minutes,
      ends_at: settings.ends_at,
      has_voted: hasVoted,
      voted_candidate: votedCandidate,
      voted_at: votedAt,
    });
  } catch (error) {
    console.error('Error in GET /api/status:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve voting status' },
      { status: 500 }
    );
  }
}
