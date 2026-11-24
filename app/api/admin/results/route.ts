import { NextResponse } from 'next/server';
import { isAuthenticatedAdmin } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAuthenticatedAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sql = getDb();

    // Candidate ranking query
    const candidates = await sql`
      SELECT 
        c.id,
        c.number,
        c.name,
        c.category,
        c.costume_theme,
        c.photo_data,
        c.is_active,
        COUNT(v.id)::int AS votes
      FROM candidates c
      LEFT JOIN votes v ON c.id = v.candidate_id
      GROUP BY c.id
      ORDER BY votes DESC, c.number ASC
    `;

    // Total votes count
    const totalCountRows = await sql`
      SELECT COUNT(*)::int AS total_votes FROM votes
    `;
    const totalVotes = totalCountRows[0]?.total_votes || 0;

    // Anomaly detection: duplicate IP hashes with multiple votes
    const duplicateIps = await sql`
      SELECT ip_hash, COUNT(*)::int AS vote_count
      FROM votes
      WHERE ip_hash IS NOT NULL
      GROUP BY ip_hash
      HAVING COUNT(*) > 1
      ORDER BY vote_count DESC
      LIMIT 10
    `;

    // Recent votes activity
    const recentVotes = await sql`
      SELECT 
        v.id,
        v.created_at,
        c.number AS candidate_number,
        c.name AS candidate_name,
        v.ip_hash
      FROM votes v
      JOIN candidates c ON v.candidate_id = c.id
      ORDER BY v.created_at DESC
      LIMIT 15
    `;

    // Unique user agents count
    const uaCountRows = await sql`
      SELECT COUNT(DISTINCT user_agent)::int AS unique_user_agents
      FROM votes
    `;
    const uniqueUserAgents = uaCountRows[0]?.unique_user_agents || 0;

    return NextResponse.json({
      candidates,
      total_votes: totalVotes,
      anomalies: {
        duplicate_ips: duplicateIps,
        unique_user_agents: uniqueUserAgents,
        recent_votes: recentVotes,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/admin/results:', error);
    return NextResponse.json({ error: 'Failed to fetch results' }, { status: 500 });
  }
}
