import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp, hashIp } from '@/lib/hash';

export const dynamic = 'force-dynamic';

// Validates the room PIN against the server so the voter gate can reject a
// wrong PIN immediately instead of only after a nominee has been selected.
export async function POST(req: NextRequest) {
  try {
    const ipHashed = hashIp(getClientIp(req));

    const rateCheck = checkRateLimit(ipHashed, 30, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Please wait a moment before trying again.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const enteredPin = String(body?.room_pin ?? '').trim();

    const sql = getDb();
    const rows = await sql`
      SELECT require_pin, room_pin
      FROM event_settings
      WHERE id = 1
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Voting configuration not initialized.' },
        { status: 500 }
      );
    }

    const settings = rows[0];

    if (settings.require_pin && enteredPin !== String(settings.room_pin).trim()) {
      return NextResponse.json(
        { error: 'Incorrect room PIN. Please check the screen on stage.' },
        { status: 401 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in POST /api/verify-pin:', error);
    return NextResponse.json(
      { error: 'Could not verify the PIN. Please try again.' },
      { status: 500 }
    );
  }
}
