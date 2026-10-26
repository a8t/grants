-- Replace DIY magic-link / sessions with Better Auth core tables.
-- App profile tables keep snake_case; Better Auth tables use its default camelCase columns.

PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS magic_link_tokens;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS saves;
DROP TABLE IF EXISTS seeker_profiles;
DROP TABLE IF EXISTS writer_profiles;
DROP TABLE IF EXISTS users;

CREATE TABLE "user" (
  "id" text NOT NULL PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "emailVerified" integer NOT NULL,
  "image" text,
  "createdAt" date NOT NULL,
  "updatedAt" date NOT NULL,
  "accountType" text NOT NULL DEFAULT 'seeker'
    CHECK ("accountType" IN ('seeker', 'writer')),
  "seekerKind" text CHECK ("seekerKind" IN ('individual', 'organization') OR "seekerKind" IS NULL),
  "subscriptionTier" text NOT NULL DEFAULT 'free'
    CHECK ("subscriptionTier" IN ('free', 'paid')),
  "stripeCustomerId" text,
  "stripeSubscriptionId" text,
  "subscriptionStatus" text
);

CREATE INDEX idx_user_accountType ON "user" ("accountType");

CREATE TABLE "session" (
  "id" text NOT NULL PRIMARY KEY,
  "expiresAt" date NOT NULL,
  "token" text NOT NULL UNIQUE,
  "createdAt" date NOT NULL,
  "updatedAt" date NOT NULL,
  "ipAddress" text,
  "userAgent" text,
  "userId" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE
);

CREATE INDEX idx_session_userId ON "session" ("userId");

CREATE TABLE "account" (
  "id" text NOT NULL PRIMARY KEY,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" date,
  "refreshTokenExpiresAt" date,
  "scope" text,
  "password" text,
  "createdAt" date NOT NULL,
  "updatedAt" date NOT NULL
);

CREATE INDEX idx_account_userId ON "account" ("userId");

CREATE TABLE "verification" (
  "id" text NOT NULL PRIMARY KEY,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expiresAt" date NOT NULL,
  "createdAt" date NOT NULL,
  "updatedAt" date NOT NULL
);

CREATE INDEX idx_verification_identifier ON "verification" ("identifier");

CREATE TABLE seeker_profiles (
  user_id TEXT PRIMARY KEY REFERENCES "user" (id) ON DELETE CASCADE,
  display_name TEXT,
  province TEXT NOT NULL DEFAULT 'ON',
  disciplines TEXT NOT NULL DEFAULT '[]',
  org_name TEXT,
  bio TEXT,
  reminder_offsets TEXT NOT NULL DEFAULT '[14,7,3,1]',
  weekly_digest INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE saves (
  user_id TEXT NOT NULL REFERENCES "user" (id) ON DELETE CASCADE,
  grant_id TEXT NOT NULL REFERENCES grants (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, grant_id)
);

CREATE INDEX idx_saves_grant ON saves (grant_id);

CREATE TABLE writer_profiles (
  user_id TEXT PRIMARY KEY REFERENCES "user" (id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  org_name TEXT,
  disciplines TEXT NOT NULL DEFAULT '[]',
  provinces TEXT NOT NULL DEFAULT '["ON"]',
  rate_range TEXT,
  bio TEXT NOT NULL DEFAULT '',
  portfolio_url TEXT,
  listed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_writers_listed ON writer_profiles (listed);

PRAGMA foreign_keys = ON;
