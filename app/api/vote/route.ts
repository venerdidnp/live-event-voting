import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'node:crypto';
import { getDb } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp, hashIp } from '@/lib/hash';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const clientIp = getClientIp(req);
    const ipHashed = hashIp(clientIp);

    // Rate Limiting (max 30 requests/min per IP hash)
    const rateCheck = checkRateLimit(ipHashed, 30, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait a moment before trying again.' },
        { status: 429 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { candidate_id, room_pin } = body;

    if (!candidate_id || typeof candidate_id !== 'number') {
      return NextResponse.json(
        { error: 'Valid candidate ID is required.' },
        { status: 400 }
      );
    }

    const sql = getDb();

    // 1. Check Event Status and PIN Requirements
    const settingsRows = await sql`
      SELECT status, require_pin, room_pin
      FROM event_settings
      WHERE id = 1
      LIMIT 1
    `;

    if (settingsRows.length === 0) {
      return NextResponse.json(
        { error: 'Voting configuration not initialized.' },
        { status: 500 }
      );
    }

    const settings = settingsRows[0];

    if (settings.status === 'WAITING') {
      return NextResponse.json(
        { error: 'Voting session has not started yet. Please wait for the announcement.' },
        { status: 400 }
      );
    }

    if (settings.status === 'CLOSED') {
      return NextResponse.json(
        { error: 'Voting session is closed.' },
        { status: 400 }
      );
    }

    if (settings.require_pin) {
      const sanitizedPin = String(room_pin || '').trim();
      if (!sanitizedPin || sanitizedPin !== String(settings.room_pin).trim()) {
        return NextResponse.json(
          { error: 'Invalid room PIN. Please check the screen on stage.' },
          { status: 401 }
        );
      }
    }

    // 2. Anti-double vote check via cookie
    const cookieStore = await cookies();
    const existingToken = cookieStore.get('voted_token')?.value;

    if (existingToken) {
      const existingVote = await sql`
        SELECT id FROM votes WHERE voter_token = ${existingToken} LIMIT 1
      `;
      if (existingVote.length > 0) {
        return NextResponse.json(
          { error: 'Your vote has already been recorded on this device.' },
          { status: 409 }
        );
      }
    }

    // 3. Verify Candidate exists and is active
    const candidateRows = await sql`
      SELECT id, number, name, category, costume_theme
      FROM candidates
      WHERE id = ${candidate_id} AND is_active = true
      LIMIT 1
    `;

    if (candidateRows.length === 0) {
      return NextResponse.json(
        { error: 'Selected candidate does not exist or is currently inactive.' },
        { status: 404 }
      );
    }

    const candidate = candidateRows[0];

    // 4. Record the vote with a unique voter_token UUID
    const newVoterToken = crypto.randomUUID();
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    await sql`
      INSERT INTO votes (candidate_id, voter_token, ip_hash, user_agent)
      VALUES (${candidate.id}, ${newVoterToken}, ${ipHashed}, ${userAgent})
    `;

    // 5. Set HttpOnly, SameSite=Lax, Secure (in production) cookie for 24h
    const isProduction = process.env.NODE_ENV === 'production';
    const response = NextResponse.json({
      success: true,
      message: `Vote successfully cast for candidate No. ${candidate.number} (${candidate.name})!`,
      candidate: {
        id: candidate.id,
        number: candidate.number,
        name: candidate.name,
      },
    });

    response.cookies.set('voted_token', newVoterToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      maxAge: 60 * 60 * 24, // 24 hours
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Error in POST /api/vote:', error);
    return NextResponse.json(
      { error: 'Internal server error while processing your vote.' },
      { status: 500 }
    );
  }
}
