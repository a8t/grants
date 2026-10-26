-- Rename Stripe billing columns to Paddle (Merchant of Record).
-- Better Auth additional fields: paddleCustomerId / paddleSubscriptionId.

ALTER TABLE "user" RENAME COLUMN "stripeCustomerId" TO "paddleCustomerId";
ALTER TABLE "user" RENAME COLUMN "stripeSubscriptionId" TO "paddleSubscriptionId";
