-- Re-seed Connect writer stubs after Better Auth user-table migration.
DELETE FROM writer_profiles WHERE user_id LIKE 'u_writer_%';
DELETE FROM "user" WHERE id LIKE 'u_writer_%';

INSERT INTO "user" (
  id, name, email, emailVerified, image, createdAt, updatedAt,
  accountType, seekerKind, subscriptionTier, paddleCustomerId, paddleSubscriptionId, subscriptionStatus
) VALUES
('u_writer_maya', 'Maya Chen', 'maya.chen@example.com', 1, NULL, datetime('now'), datetime('now'), 'writer', NULL, 'paid', NULL, NULL, 'active'),
('u_writer_jordan', 'Jordan Blake', 'jordan.blake@example.com', 1, NULL, datetime('now'), datetime('now'), 'writer', NULL, 'paid', NULL, NULL, 'active'),
('u_writer_sam', 'Sam Okonkwo', 'sam.okonkwo@example.com', 1, NULL, datetime('now'), datetime('now'), 'writer', NULL, 'paid', NULL, NULL, 'active'),
('u_writer_priya', 'Priya Nair', 'priya.nair@example.com', 1, NULL, datetime('now'), datetime('now'), 'writer', NULL, 'paid', NULL, NULL, 'active');

INSERT INTO writer_profiles (
  user_id, display_name, org_name, disciplines, provinces, rate_range, bio, portfolio_url, listed
) VALUES
(
  'u_writer_maya', 'Maya Chen', 'Chen Arts Writing',
  '["visual arts","theatre","festivals"]', '["ON"]', '$75–$120/hr',
  'Toronto-based grant writer focused on OAC and Canada Council project grants.',
  'https://example.com/maya-chen', 1
),
(
  'u_writer_jordan', 'Jordan Blake', NULL,
  '["music","festivals"]', '["ON","CA"]', 'Project packages from $1,200',
  'Helps Ontario musicians with FACTOR and Ontario Creates applications.',
  'https://example.com/jordan-blake', 1
),
(
  'u_writer_sam', 'Sam Okonkwo', 'Plain Language Grants',
  '["literary","community arts"]', '["ON"]', '$90/hr',
  'Plain-language narratives for first-time organizational applicants.',
  NULL, 1
),
(
  'u_writer_priya', 'Priya Nair', NULL,
  '["Indigenous arts","community arts","heritage"]', '["ON"]', 'Sliding scale',
  'Collaborative grant support for Indigenous and community-led arts projects.',
  'https://example.com/priya-nair', 1
);
