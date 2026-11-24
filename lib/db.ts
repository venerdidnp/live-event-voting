import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

/**
 * Returns a Neon serverless SQL query function instance.
 * Safe from SQL injection when using tagged templates or parameterized inputs.
 */
export function getDb(): NeonQueryFunction<false, false> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not defined in environment variables.');
  }
  return neon(databaseUrl);
}

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
