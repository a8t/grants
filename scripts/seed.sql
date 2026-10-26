-- Sample Ontario arts/culture grants + stub listed writers (placeholders for local browse)
DELETE FROM saves;
DELETE FROM writer_profiles;
DELETE FROM seeker_profiles;
DELETE FROM session;
DELETE FROM account;
DELETE FROM verification;
DELETE FROM "user";
DELETE FROM grants;

INSERT INTO grants (
  id, slug, name, funder, applicant_types, eligibility_summary,
  amount_min, amount_max, amount_notes, deadline_at, deadline_notes,
  url, province_scope, disciplines, status
) VALUES
(
  'g_oac_project_ind',
  'oac-project-grants-individuals',
  'Project Grants for Individuals',
  'Ontario Arts Council',
  'individual',
  'Supports Ontario professional artists developing or presenting a new project. Applicants must be Ontario residents with a recent public presentation history in their discipline.',
  3000, 15000, NULL, '2026-04-15', NULL,
  'https://www.arts.on.ca/', 'ON',
  '["visual arts","theatre","dance","music","literary","media arts"]', 'open'
),
(
  'g_oac_project_org',
  'oac-project-grants-organizations',
  'Project Grants for Organizations',
  'Ontario Arts Council',
  'organization',
  'One-time project funding for Ontario arts organizations and collectives for creation, production, or presentation. Not for ongoing operating costs.',
  5000, 40000, NULL, '2026-05-01', NULL,
  'https://www.arts.on.ca/', 'ON',
  '["theatre","dance","music","visual arts","festivals"]', 'open'
),
(
  'g_oac_media',
  'oac-media-artists-creation',
  'Media Artists Creation Projects',
  'Ontario Arts Council',
  'individual',
  'Creation funding for independent Ontario media artists working in film, video, audio, or emerging digital practices.',
  5000, 25000, NULL, '2026-06-12', NULL,
  'https://www.arts.on.ca/', 'ON',
  '["media arts","film","digital"]', 'open'
),
(
  'g_oac_theatre',
  'oac-theatre-projects',
  'Theatre Projects',
  'Ontario Arts Council',
  'both',
  'Supports theatre creation and production by Ontario artists and companies, including new work development and remounts with clear public outcomes.',
  5000, 35000, NULL, '2026-03-20', NULL,
  'https://www.arts.on.ca/', 'ON',
  '["theatre"]', 'open'
),
(
  'g_oac_dance',
  'oac-dance-projects',
  'Dance Projects',
  'Ontario Arts Council',
  'both',
  'Project support for Ontario dance artists and organizations for creation, rehearsal, and presentation.',
  4000, 30000, NULL, '2026-07-08', NULL,
  'https://www.arts.on.ca/', 'ON',
  '["dance"]', 'open'
),
(
  'g_cc_explore',
  'canada-council-explore-and-create',
  'Explore and Create',
  'Canada Council for the Arts',
  'individual',
  'National program open to Ontario artists for research, creation, and professional development. Citizenship or permanent residency required.',
  1000, 25000, 'Typical individual project range; see guidelines', '2026-04-02', NULL,
  'https://canadacouncil.ca/', 'CA',
  '["visual arts","music","literary","theatre","dance","media arts"]', 'open'
),
(
  'g_cc_arts_across',
  'canada-council-arts-across-canada',
  'Arts Across Canada',
  'Canada Council for the Arts',
  'organization',
  'Supports circulation, touring, and market development for Canadian arts organizations, including Ontario presenters and producers.',
  5000, 60000, NULL, '2026-05-22', NULL,
  'https://canadacouncil.ca/', 'CA',
  '["touring","festivals","music","theatre","dance"]', 'open'
),
(
  'g_cc_cks',
  'canada-council-creating-knowing-sharing',
  'Creating, Knowing and Sharing',
  'Canada Council for the Arts',
  'both',
  'Supports First Nations, Inuit, and Métis arts practice — creation, knowledge sharing, and travel. Ontario-based Indigenous artists and orgs are eligible.',
  3000, 50000, NULL, NULL, 'Multiple intakes — check current deadlines',
  'https://canadacouncil.ca/', 'CA',
  '["Indigenous arts","visual arts","music","literary","theatre"]', 'rolling'
),
(
  'g_cc_literary',
  'canada-council-literary-writing',
  'Literary Writing',
  'Canada Council for the Arts',
  'individual',
  'Grants for Canadian literary writers (including Ontario) for book-length projects in poetry, fiction, nonfiction, or children''s literature.',
  5000, 25000, NULL, '2026-09-15', NULL,
  'https://canadacouncil.ca/', 'CA',
  '["literary"]', 'open'
),
(
  'g_tac_project',
  'toronto-arts-council-project',
  'Project Grants',
  'Toronto Arts Council',
  'both',
  'Project funding for Toronto-based professional artists and arts organizations. Must demonstrate a clear Toronto public benefit.',
  2000, 20000, NULL, '2026-04-28', NULL,
  'https://torontoartscouncil.org/', 'ON',
  '["visual arts","theatre","music","dance","literary","community arts"]', 'open'
),
(
  'g_tac_community',
  'toronto-arts-council-community-arts',
  'Community Arts Projects',
  'Toronto Arts Council',
  'organization',
  'Supports community-engaged arts projects led by Toronto organizations working with local participants.',
  5000, 25000, NULL, '2026-06-01', NULL,
  'https://torontoartscouncil.org/', 'ON',
  '["community arts","festivals"]', 'open'
),
(
  'g_ocaf',
  'ontario-cultural-attractions-fund',
  'Ontario Cultural Attractions Fund',
  'Ontario Cultural Attractions Fund',
  'organization',
  'Marketing and audience-development support for major Ontario cultural attractions and festivals with tourism impact.',
  10000, 100000, 'Varies by project scale', '2026-08-14', NULL,
  'https://ocaf.on.ca/', 'ON',
  '["festivals","museums","heritage","music"]', 'open'
),
(
  'g_factor',
  'factor-sound-recording',
  'Sound Recording Investment',
  'FACTOR',
  'both',
  'Investment support for Canadian sound recordings. Ontario artists and labels commonly use this program alongside provincial music funds.',
  3000, 30000, NULL, NULL, 'Rolling intakes — see FACTOR calendar',
  'https://www.factor.ca/', 'CA',
  '["music"]', 'rolling'
),
(
  'g_on_creates_music',
  'ontario-creates-music-fund',
  'Music Fund',
  'Ontario Creates',
  'both',
  'Supports Ontario music companies and entrepreneurs for business and market development activities.',
  5000, 75000, NULL, '2026-05-15', NULL,
  'https://ontariocreates.ca/', 'ON',
  '["music"]', 'open'
),
(
  'g_pch_bctap',
  'pch-building-communities-through-arts',
  'Building Communities Through Arts and Heritage',
  'Canadian Heritage',
  'organization',
  'Local festivals and commemorations funding. Ontario community groups presenting arts or heritage events may apply.',
  2000, 100000, 'Local Festivals component', '2026-04-30', NULL,
  'https://www.canada.ca/en/canadian-heritage.html', 'CA',
  '["festivals","heritage","community arts"]', 'open'
),
(
  'g_metcalf',
  'metcalf-performing-arts',
  'Performing Arts Program (placeholder)',
  'George Cedric Metcalf Charitable Foundation',
  'organization',
  'Placeholder seed for a foundation performing-arts stream relevant to Ontario presenters and companies. Confirm current guidelines on the funder site.',
  15000, 75000, NULL, '2026-10-01', NULL,
  'https://metcalffoundation.com/', 'ON',
  '["theatre","dance","music"]', 'open'
),
(
  'g_indigenous_culture',
  'ontario-indigenous-culture-fund',
  'Indigenous Culture Fund (placeholder)',
  'Ontario — Indigenous culture programs',
  'both',
  'Placeholder for Ontario Indigenous culture / arts project support. Treat as a directory stub until curated against the live program page.',
  2500, 30000, NULL, '2026-07-31', NULL,
  'https://www.ontario.ca/', 'ON',
  '["Indigenous arts","community arts","heritage"]', 'open'
),
(
  'g_cc_digital',
  'canada-council-digital-greenhouse',
  'Digital Greenhouse (placeholder)',
  'Canada Council for the Arts',
  'both',
  'Placeholder for digital / innovation arts support open to Ontario applicants. Verify live Canada Council digital initiatives before publishing publicly.',
  5000, 40000, NULL, '2026-11-12', NULL,
  'https://canadacouncil.ca/', 'CA',
  '["digital","media arts"]', 'open'
);

-- Stub writer accounts (paid/listed) for Connect directory (Better Auth `user` table)
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
  'u_writer_maya',
  'Maya Chen',
  'Chen Arts Writing',
  '["visual arts","theatre","festivals"]',
  '["ON"]',
  '$75–$120/hr',
  'Toronto-based grant writer focused on OAC and Canada Council project grants for visual artists and small theatre companies.',
  'https://example.com/maya-chen',
  1
),
(
  'u_writer_jordan',
  'Jordan Blake',
  NULL,
  '["music","festivals"]',
  '["ON","CA"]',
  'Project packages from $1,200',
  'Former FACTOR juror-turned-writer. Helps Ontario musicians and presenters with FACTOR, Ontario Creates, and touring applications.',
  'https://example.com/jordan-blake',
  1
),
(
  'u_writer_sam',
  'Sam Okonkwo',
  'Plain Language Grants',
  '["literary","community arts"]',
  '["ON"]',
  '$90/hr',
  'Specializes in literary and community-arts proposals. Clear, plain-language narratives for first-time organizational applicants.',
  NULL,
  1
),
(
  'u_writer_priya',
  'Priya Nair',
  NULL,
  '["Indigenous arts","community arts","heritage"]',
  '["ON"]',
  'Sliding scale',
  'Collaborative grant support for Indigenous and community-led arts projects across southern and mid-northern Ontario.',
  'https://example.com/priya-nair',
  1
);
