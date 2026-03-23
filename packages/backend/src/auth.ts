import { betterAuth } from 'better-auth';
import { Kysely, PostgresDialect } from 'kysely';
import { pool } from './db/database';

// Better Auth v1.5+ requires a Kysely instance — wrap the existing pg Pool
const kyselyDb = new Kysely({ dialect: new PostgresDialect({ pool }) });

export const auth = betterAuth({
  database: {
    db: kyselyDb,
    type: 'postgresql',
  },

  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3001',
  secret: process.env.BETTER_AUTH_SECRET ?? 'dev-secret-change-in-production',
  trustedOrigins: [
    process.env.FRONTEND_URL ?? 'http://localhost:5173',
    process.env.BETTER_AUTH_URL ?? 'http://localhost:3001',
    'http://localhost:4173',
  ],

  emailAndPassword: {
    enabled: true,
  },

  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
  },

  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'staff',
        input: false,
      },
    },
  },

  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const { rows } = await pool.query(
            'SELECT role FROM authorized_users WHERE LOWER(email) = LOWER($1)',
            [user.email]
          );
          if (rows.length === 0) {
            throw new Error('Your account is not authorized to access this application. Contact an administrator.');
          }
          return { data: { ...user, role: rows[0].role as string } };
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const { rows: userRows } = await pool.query(
            'SELECT email FROM "user" WHERE id = $1',
            [session.userId]
          );
          if (!userRows[0]) throw new Error('User not found');
          const { rows: authRows } = await pool.query(
            'SELECT role FROM authorized_users WHERE LOWER(email) = LOWER($1)',
            [userRows[0].email as string]
          );
          if (authRows.length === 0) {
            throw new Error('Your account is not authorized to access this application. Contact an administrator.');
          }
          return { data: session };
        },
      },
    },
  },
});

export type Auth = typeof auth;
