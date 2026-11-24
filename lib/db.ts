import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

export interface EventSettings {
  id: number;
  event_title: string;
  event_subtitle: string;
  organizer_label: string;
  status: 'WAITING' | 'OPEN' | 'CLOSED';
  require_pin: boolean;
  room_pin: string;
  timer_minutes: number;
  ends_at: string | null;
}

export interface Candidate {
  id: number;
  number: number;
  name: string;
  category: string;
  costume_theme: string | null;
  photo_data: string;
  is_active: boolean;
  created_at: string;
}

export interface CandidateWithVotes extends Candidate {
  votes: number;
}

export interface Vote {
  id: string;
  candidate_id: number;
  voter_token: string;
  ip_hash: string | null;
  user_agent: string | null;
  created_at: string;
}

// In-Memory Fallback Store (Used when DATABASE_URL is not configured)
interface InMemoryStore {
  settings: EventSettings;
  candidates: Candidate[];
  votes: Vote[];
}

const globalStore: InMemoryStore = (globalThis as unknown as { __stagevote_store?: InMemoryStore }).__stagevote_store || {
  settings: {
    id: 1,
    event_title: 'Live Event Voting',
    event_subtitle: 'Audience Choice Award',
    organizer_label: 'Event Committee',
    status: 'OPEN',
    require_pin: true,
    room_pin: '2026',
    timer_minutes: 5,
    ends_at: null,
  },
  candidates: [
    {
      id: 1,
      number: 1,
      name: 'Alex Rivera',
      category: 'Participant',
      costume_theme: 'Cyberpunk Vanguard',
      photo_data: '',
      is_active: true,
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: 2,
      number: 2,
      name: 'Dr. Sarah Chen',
      category: 'Guest',
      costume_theme: 'Neo Victorian Royal',
      photo_data: '',
      is_active: true,
      created_at: new Date(Date.now() - 3000000).toISOString(),
    },
    {
      id: 3,
      number: 3,
      name: 'Marcus Brody',
      category: 'VIP',
      costume_theme: 'Steampunk Explorer',
      photo_data: '',
      is_active: true,
      created_at: new Date(Date.now() - 2400000).toISOString(),
    },
    {
      id: 4,
      number: 4,
      name: 'Elena Rostova',
      category: 'General',
      costume_theme: 'Celestial Empress',
      photo_data: '',
      is_active: true,
      created_at: new Date(Date.now() - 1800000).toISOString(),
    },
  ],
  votes: [
    { id: 'v1', candidate_id: 2, voter_token: 'mock-1', ip_hash: 'hash-a', user_agent: 'Chrome', created_at: new Date(Date.now() - 900000).toISOString() },
    { id: 'v2', candidate_id: 2, voter_token: 'mock-2', ip_hash: 'hash-b', user_agent: 'Safari', created_at: new Date(Date.now() - 850000).toISOString() },
    { id: 'v3', candidate_id: 4, voter_token: 'mock-3', ip_hash: 'hash-c', user_agent: 'Mobile Safari', created_at: new Date(Date.now() - 700000).toISOString() },
    { id: 'v4', candidate_id: 1, voter_token: 'mock-4', ip_hash: 'hash-d', user_agent: 'Firefox', created_at: new Date(Date.now() - 600000).toISOString() },
    { id: 'v5', candidate_id: 2, voter_token: 'mock-5', ip_hash: 'hash-e', user_agent: 'Chrome', created_at: new Date(Date.now() - 500000).toISOString() },
  ],
};

(globalThis as unknown as { __stagevote_store?: InMemoryStore }).__stagevote_store = globalStore;

/**
 * Executes a mock SQL query against the in-memory store.
 */
function executeMockQuery(sqlText: string, params: unknown[]): unknown[] {
  const norm = sqlText.replace(/\s+/g, ' ').trim().toUpperCase();

  // 1. SELECT ... FROM event_settings
  if (norm.startsWith('SELECT') && norm.includes('FROM EVENT_SETTINGS')) {
    return [{ ...globalStore.settings }];
  }

  // 2. INSERT INTO event_settings
  if (norm.startsWith('INSERT INTO EVENT_SETTINGS')) {
    return [{ ...globalStore.settings }];
  }

  // 3. UPDATE event_settings
  if (norm.startsWith('UPDATE EVENT_SETTINGS')) {
    if (params.length >= 8) {
      globalStore.settings.event_title = String(params[0]);
      globalStore.settings.event_subtitle = String(params[1]);
      globalStore.settings.organizer_label = String(params[2]);
      globalStore.settings.status = params[3] as 'WAITING' | 'OPEN' | 'CLOSED';
      globalStore.settings.require_pin = Boolean(params[4]);
      globalStore.settings.room_pin = String(params[5]);
      globalStore.settings.timer_minutes = Number(params[6]);
      globalStore.settings.ends_at = params[7] as string | null;
    }
    return [{ ...globalStore.settings }];
  }

  // 4. Candidate count / ranking query
  if (norm.includes('FROM CANDIDATES C LEFT JOIN VOTES V')) {
    const list = globalStore.candidates.map((c) => {
      const votes = globalStore.votes.filter((v) => v.candidate_id === c.id).length;
      return { ...c, votes };
    });

    if (norm.includes('ORDER BY VOTES DESC')) {
      list.sort((a, b) => b.votes - a.votes || a.number - b.number);
    } else {
      list.sort((a, b) => a.number - b.number);
    }
    return list;
  }

  // 5. SELECT id, number, name ... FROM candidates WHERE is_active = true
  if (norm.startsWith('SELECT') && norm.includes('FROM CANDIDATES') && norm.includes('WHERE IS_ACTIVE = TRUE')) {
    return globalStore.candidates
      .filter((c) => c.is_active)
      .sort((a, b) => a.number - b.number)
      .map((c) => ({
        id: c.id,
        number: c.number,
        name: c.name,
        category: c.category,
        costume_theme: c.costume_theme,
        photo_data: c.photo_data,
        is_active: c.is_active,
      }));
  }

  // 6. SELECT MAX(number) FROM candidates
  if (norm.includes('SELECT COALESCE(MAX(NUMBER), 0)')) {
    const max = globalStore.candidates.reduce((m, c) => Math.max(m, c.number), 0);
    return [{ max_num: max }];
  }

  // 7. SELECT * FROM candidates WHERE id = ...
  if (norm.startsWith('SELECT') && norm.includes('FROM CANDIDATES WHERE ID =')) {
    const candId = Number(params[0]);
    const found = globalStore.candidates.find((c) => c.id === candId);
    if (!found) return [];
    if (norm.includes('AND IS_ACTIVE = TRUE') && !found.is_active) return [];
    return [{ ...found }];
  }

  // 8. SELECT id FROM candidates WHERE number = ...
  if (norm.startsWith('SELECT') && norm.includes('FROM CANDIDATES WHERE NUMBER =')) {
    const num = Number(params[0]);
    const found = globalStore.candidates.find((c) => c.number === num);
    return found ? [{ id: found.id }] : [];
  }

  // 9. INSERT INTO candidates
  if (norm.startsWith('INSERT INTO CANDIDATES')) {
    const newId = globalStore.candidates.length > 0 ? Math.max(...globalStore.candidates.map((c) => c.id)) + 1 : 1;
    const newCand: Candidate = {
      id: newId,
      number: Number(params[0]),
      name: String(params[1]),
      category: String(params[2] || 'Participant'),
      costume_theme: params[3] ? String(params[3]) : null,
      photo_data: String(params[4]),
      is_active: Boolean(params[5] ?? true),
      created_at: new Date().toISOString(),
    };
    globalStore.candidates.push(newCand);
    return [{ ...newCand }];
  }

  // 10. UPDATE candidates
  if (norm.startsWith('UPDATE CANDIDATES')) {
    const candId = Number(params[params.length - 1]);
    const idx = globalStore.candidates.findIndex((c) => c.id === candId);
    if (idx !== -1) {
      if (params.length === 2 && norm.includes('SET IS_ACTIVE =')) {
        globalStore.candidates[idx].is_active = Boolean(params[0]);
      } else if (params.length >= 6) {
        globalStore.candidates[idx].number = Number(params[0]);
        globalStore.candidates[idx].name = String(params[1]);
        globalStore.candidates[idx].category = String(params[2]);
        globalStore.candidates[idx].costume_theme = params[3] ? String(params[3]) : null;
        globalStore.candidates[idx].photo_data = String(params[4]);
        globalStore.candidates[idx].is_active = Boolean(params[5]);
      }
      return [{ ...globalStore.candidates[idx] }];
    }
    return [];
  }

  // 11. DELETE FROM candidates WHERE id = ...
  if (norm.startsWith('DELETE FROM CANDIDATES WHERE ID =')) {
    const candId = Number(params[0]);
    globalStore.candidates = globalStore.candidates.filter((c) => c.id !== candId);
    globalStore.votes = globalStore.votes.filter((v) => v.candidate_id !== candId);
    return [];
  }

  // 12. DELETE FROM candidates (all)
  if (norm.startsWith('DELETE FROM CANDIDATES')) {
    globalStore.candidates = [];
    globalStore.votes = [];
    return [];
  }

  // 13. SELECT ... FROM votes v JOIN candidates c WHERE v.voter_token = ...
  if (norm.includes('FROM VOTES V JOIN CANDIDATES C') && norm.includes('WHERE V.VOTER_TOKEN =')) {
    const token = String(params[0]);
    const vote = globalStore.votes.find((v) => v.voter_token === token);
    if (!vote) return [];
    const cand = globalStore.candidates.find((c) => c.id === vote.candidate_id);
    if (!cand) return [];
    return [
      {
        vote_id: vote.id,
        created_at: vote.created_at,
        id: cand.id,
        number: cand.number,
        name: cand.name,
        category: cand.category,
        costume_theme: cand.costume_theme,
        photo_data: cand.photo_data,
      },
    ];
  }

  // 14. SELECT id FROM votes WHERE voter_token = ...
  if (norm.startsWith('SELECT ID FROM VOTES WHERE VOTER_TOKEN =')) {
    const token = String(params[0]);
    const found = globalStore.votes.find((v) => v.voter_token === token);
    return found ? [{ id: found.id }] : [];
  }

  // 15. INSERT INTO votes
  if (norm.startsWith('INSERT INTO VOTES')) {
    const newVote: Vote = {
      id: `v-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      candidate_id: Number(params[0]),
      voter_token: String(params[1]),
      ip_hash: params[2] ? String(params[2]) : null,
      user_agent: params[3] ? String(params[3]) : null,
      created_at: new Date().toISOString(),
    };
    globalStore.votes.push(newVote);
    return [{ id: newVote.id }];
  }

  // 16. Total votes count
  if (norm.includes('SELECT COUNT(*)::INT AS TOTAL_VOTES FROM VOTES')) {
    return [{ total_votes: globalStore.votes.length }];
  }

  // 17. Duplicate IP hashes
  if (norm.includes('GROUP BY IP_HASH HAVING COUNT(*) > 1')) {
    const map = new Map<string, number>();
    globalStore.votes.forEach((v) => {
      if (v.ip_hash) {
        map.set(v.ip_hash, (map.get(v.ip_hash) || 0) + 1);
      }
    });
    const dupes: Array<{ ip_hash: string; vote_count: number }> = [];
    for (const [hash, count] of map.entries()) {
      if (count > 1) dupes.push({ ip_hash: hash, vote_count: count });
    }
    dupes.sort((a, b) => b.vote_count - a.vote_count);
    return dupes.slice(0, 10);
  }

  // 18. Recent votes
  if (norm.includes('FROM VOTES V JOIN CANDIDATES C ORDER BY V.CREATED_AT DESC')) {
    const list = [...globalStore.votes].reverse().slice(0, 15).map((v) => {
      const cand = globalStore.candidates.find((c) => c.id === v.candidate_id);
      return {
        id: v.id,
        created_at: v.created_at,
        candidate_number: cand?.number || 0,
        candidate_name: cand?.name || 'Unknown',
        ip_hash: v.ip_hash,
      };
    });
    return list;
  }

  // 19. Unique user agents
  if (norm.includes('COUNT(DISTINCT USER_AGENT)')) {
    const uas = new Set(globalStore.votes.map((v) => v.user_agent).filter(Boolean));
    return [{ unique_user_agents: uas.size }];
  }

  // 20. DELETE FROM votes (reset)
  if (norm.startsWith('DELETE FROM VOTES')) {
    globalStore.votes = [];
    return [];
  }

  return [];
}

/**
 * Creates a mock Neon query function using tagged template literals or parameterized calls.
 */
function createMockDb(): NeonQueryFunction<false, false> {
  const queryFn = async (
    stringsOrQuery: TemplateStringsArray | string,
    ...values: unknown[]
  ): Promise<unknown[]> => {
    let sqlText = '';
    let params: unknown[] = [];

    if (Array.isArray(stringsOrQuery) && 'raw' in stringsOrQuery) {
      // Tagged template literal: sql`SELECT ... ${val}`
      const strings = stringsOrQuery as unknown as TemplateStringsArray;
      sqlText = strings.join('?');
      params = values;
    } else if (typeof stringsOrQuery === 'string') {
      sqlText = stringsOrQuery;
      params = values;
    }

    return executeMockQuery(sqlText, params);
  };

  return queryFn as unknown as NeonQueryFunction<false, false>;
}

/**
 * Returns a Neon serverless SQL query function instance.
 * Automatically uses in-memory mock fallback if DATABASE_URL is not configured.
 */
export function getDb(): NeonQueryFunction<false, false> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return createMockDb();
  }
  return neon(databaseUrl);
}
