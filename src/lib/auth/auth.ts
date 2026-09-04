import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import type { PrismaClient } from '../../generated/prisma/client.js';

import 'dotenv/config';

const SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7;
const SESSION_UPDATE_AGE_SECONDS = 60 * 60 * 24;

export function createAuth(prisma: PrismaClient) {
  return betterAuth({
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
    },
    // Better Auth's own routes (/api/auth/*) bypass Nest's guard pipeline, so the
    // existing global ArcjetGuard never sees them (verified: confirmed with a live
    // request flood, see docs/specs/0001-better-auth-integration). This is the
    // fallback rate limit for those routes specifically, matching Arcjet's config.
    rateLimit: {
      enabled: true,
      window: 60,
      max: 60,
    },
    session: {
      expiresIn: SESSION_EXPIRES_IN_SECONDS,
      updateAge: SESSION_UPDATE_AGE_SECONDS,
    },
    user: {
      additionalFields: {
        role: {
          type: 'string',
          defaultValue: 'PARTICIPANT',
          input: false,
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
