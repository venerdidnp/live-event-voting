#!/usr/bin/env node

/**
 * Database initialization script for Live Event Voting System.
 * Executes db/schema.sql against the Neon PostgreSQL database.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load environment variables from .env.local or .env if present
function loadEnvFile(envPath) {
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnvFile(path.join(rootDir, '.env.local'));
loadEnvFile(path.join(rootDir, '.env'));

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('\x1b[31m%s\x1b[0m', 'Error: DATABASE_URL is not set.');
  console.error('Please configure DATABASE_URL in .env.local or .env before running db:init.');
  process.exit(1);
}

const schemaPath = path.join(rootDir, 'db', 'schema.sql');
if (!fs.existsSync(schemaPath)) {
  console.error('\x1b[31m%s\x1b[0m', `Error: Schema file not found at ${schemaPath}`);
  process.exit(1);
}

const schemaSql = fs.readFileSync(schemaPath, 'utf8');

async function run() {
  console.log('\x1b[36m%s\x1b[0m', '🚀 Initializing Database with Neon Serverless...');
  try {
    const sql = neon(databaseUrl);
    
    // Split statements safely
    // Neon query function can execute raw statements or multi-statement string
    await sql(schemaSql);

    console.log('\x1b[32m%s\x1b[0m', '✅ Database schema initialized successfully!');
    console.log('\x1b[32m%s\x1b[0m', '   - event_settings created with default record');
    console.log('\x1b[32m%s\x1b[0m', '   - candidates table ready');
    console.log('\x1b[32m%s\x1b[0m', '   - votes table ready');
  } catch (err) {
    console.error('\x1b[31m%s\x1b[0m', '❌ Database initialization failed:');
    console.error(err);
    process.exit(1);
  }
}

run();
