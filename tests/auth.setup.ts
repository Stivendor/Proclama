import { test as setup, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { AUTH_FILE } from './auth-file';

/**
 * Mints a real Supabase session for the test account WITHOUT going through the
 * Google OAuth redirect flow:
 *   1. admin.generateLink (service_role)
 *   2. verifyOtp with the returned token_hash
 * The session is written into a Playwright storageState file as the localStorage
 * entry supabase-js reads on startup (sb-<ref>-auth-token).
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local (gitignored, local only).
 */
setup('authenticate', async () => {
  const url = process.env.VITE_SUPABASE_URL!;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const email = process.env.TEST_USER_EMAIL!;

  expect(url, 'VITE_SUPABASE_URL missing').toBeTruthy();
  expect(serviceKey, 'SUPABASE_SERVICE_ROLE_KEY missing in .env.local').toBeTruthy();
  expect(email, 'TEST_USER_EMAIL missing').toBeTruthy();

  // 1. Admin generates a magic link (service_role)
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  expect(linkErr, `generateLink failed: ${linkErr?.message}`).toBeNull();
  const tokenHash = linkData.properties?.hashed_token;
  expect(tokenHash, 'no hashed_token returned').toBeTruthy();

  // 2. Verify the OTP to obtain a real session
  const anon = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: verifyData, error: verifyErr } = await anon.auth.verifyOtp({
    token_hash: tokenHash!,
    type: 'magiclink',
  });
  expect(verifyErr, `verifyOtp failed: ${verifyErr?.message}`).toBeNull();
  const session = verifyData.session;
  expect(session, 'no session from verifyOtp').toBeTruthy();

  // 3. Build storageState: supabase-js stores the session under sb-<ref>-auth-token
  const projectRef = new URL(url).hostname.split('.')[0];
  const storageKey = `sb-${projectRef}-auth-token`;

  const storageState = {
    cookies: [],
    origins: [
      {
        origin: 'http://localhost:5173',
        localStorage: [{ name: storageKey, value: JSON.stringify(session) }],
      },
    ],
  };

  mkdirSync(dirname(AUTH_FILE), { recursive: true });
  writeFileSync(AUTH_FILE, JSON.stringify(storageState, null, 2));
});
