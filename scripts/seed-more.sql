-- Additional curated Ontario-relevant arts/culture programs (manual corpus boost).
-- Idempotent-ish: delete by known ids then re-insert.

DELETE FROM grants WHERE id LIKE 'g_cur_%';

INSERT INTO grants (
  id, slug, name, funder, applicant_types, eligibility_summary,
  amount_min, amount_max, amount_notes, deadline_at, deadline_notes,
  url, province_scope, disciplines, status
) VALUES
(
  'g_cur_cc_artistic_creation',
  'canada-council-artistic-creation',
  'Artistic Creation (Explore and Create)',
  'Canada Council for the Arts',
  'individual',
  'Supports research, creation and development of artistic work. Ontario artists who are Canadian citizens or permanent residents may apply. Rolling intake before project start.',
  NULL, 25000, 'See opportunity guidelines for maximums', NULL, 'Any time before project start',
  'https://canadacouncil.ca/funding/grants/deadlines', 'CA',
  '["visual arts","music","theatre","dance","literary","media arts"]', 'rolling'
),
(
  'g_cur_cc_cks_travel',
  'canada-council-cks-travel',
  'Creating, Knowing and Sharing — Travel',
  'Canada Council for the Arts',
  'both',
  'Travel support for First Nations, Inuit and Métis arts practice. Open to Ontario-based Indigenous artists and organizations.',
  NULL, NULL, 'See guidelines', NULL, 'Any time before departure',
  'https://canadacouncil.ca/funding/grants/deadlines', 'CA',
  '["Indigenous arts"]', 'rolling'
),
(
  'g_cur_cc_literary_pub',
  'canada-council-literary-publishing-projects',
  'Literary Publishing Projects',
  'Canada Council for the Arts',
  'organization',
  'Supports Canadian literary publishers for publishing projects. Ontario publishers are eligible under national criteria.',
  NULL, NULL, NULL, '2026-04-15', NULL,
  'https://canadacouncil.ca/funding/grants/deadlines', 'CA',
  '["literary"]', 'open'
),
(
  'g_cur_cc_circulation',
  'canada-council-circulation-and-touring',
  'Circulation and Touring',
  'Canada Council for the Arts',
  'organization',
  'Supports circulation and touring of Canadian artistic work nationally and abroad. Ontario presenters and companies may apply.',
  NULL, NULL, NULL, '2026-06-03', 'Multiple intakes — see deadlines page',
  'https://canadacouncil.ca/funding/grants/deadlines', 'CA',
  '["touring","theatre","dance","music","festivals"]', 'open'
),
(
  'g_cur_tac_access',
  'tac-accessibility-grant',
  'Accessibility Grant',
  'Toronto Arts Council',
  'both',
  'Additional project funding toward accessibility costs for artists. Rolling deadline for Toronto-based applicants.',
  NULL, NULL, NULL, NULL, 'Rolling',
  'https://torontoartscouncil.org/grants/tac-accessibility-grant/', 'ON',
  '["accessibility","community arts"]', 'rolling'
),
(
  'g_cur_tac_black_arts',
  'tac-black-arts-projects',
  'Black Arts Projects',
  'Toronto Arts Council',
  'both',
  'Supports creation, development and presentation by Black artists across disciplines in Toronto, including mentorship.',
  NULL, NULL, NULL, NULL, 'Rolling',
  'https://torontoartscouncil.org/grants/black-arts-projects/', 'ON',
  '["community arts","visual arts","music","theatre"]', 'rolling'
),
(
  'g_cur_tac_indigenous',
  'tac-indigenous-arts-projects',
  'Indigenous Arts Projects',
  'Toronto Arts Council',
  'both',
  'Creation, development and presentation by Indigenous artists in Toronto; also sector-development projects.',
  NULL, NULL, NULL, NULL, 'Rolling',
  'https://torontoartscouncil.org/grants/indigenous-arts-projects/', 'ON',
  '["Indigenous arts"]', 'rolling'
),
(
  'g_cur_tac_parks',
  'tac-animating-toronto-parks',
  'Animating Toronto Parks',
  'Toronto Arts Council',
  'both',
  'Free arts programming in selected Toronto parks for organizations, collectives and individuals.',
  NULL, NULL, NULL, '2026-06-09', NULL,
  'https://torontoartscouncil.org/grants/animating-toronto-parks/', 'ON',
  '["community arts","festivals"]', 'open'
),
(
  'g_cur_tac_library',
  'tac-artists-in-the-library',
  'Artists in the Library',
  'Toronto Arts Council',
  'both',
  'Community-engaged arts programming in selected Toronto Public Library branches.',
  NULL, NULL, NULL, '2026-10-06', NULL,
  'https://torontoartscouncil.org/grants/artists-in-the-library/', 'ON',
  '["community arts"]', 'open'
),
(
  'g_cur_tac_open_door',
  'tac-open-door',
  'Open Door',
  'Toronto Arts Council',
  'organization',
  'Supports transformative ideas for arts organizations, collectives and/or the Toronto arts sector.',
  NULL, NULL, NULL, '2026-11-26', NULL,
  'https://torontoartscouncil.org/grants/open-door/', 'ON',
  '["capacity","community arts"]', 'open'
),
(
  'g_cur_oac_music_recording',
  'oac-music-recording-projects',
  'Music Recording Projects',
  'Ontario Arts Council',
  'both',
  'Recording support for Ontario musicians (demo/EP and full-length album categories).',
  NULL, 10000, 'Demo/EP max $4,000; album max $10,000', '2026-04-21', 'Also Nov 5, 2026',
  'https://www.arts.on.ca/grants/music-recording-projects', 'ON',
  '["music"]', 'open'
),
(
  'g_cur_oac_literary_creation',
  'oac-literary-creation-works-for-publication',
  'Literary Creation Projects — Works for Publication',
  'Ontario Arts Council',
  'individual',
  'Supports Ontario literary writers creating book-length works intended for publication.',
  NULL, NULL, NULL, '2026-09-10', NULL,
  'https://www.arts.on.ca/grants/literary-creation-projects-works-for-publication', 'ON',
  '["literary"]', 'open'
),
(
  'g_cur_oac_indigenous_arts',
  'oac-indigenous-arts-projects',
  'Indigenous Arts Projects',
  'Ontario Arts Council',
  'both',
  'Project support for Indigenous artists and arts organizations in Ontario.',
  NULL, NULL, NULL, '2026-04-23', NULL,
  'https://www.arts.on.ca/grants/indigenous-arts-projects', 'ON',
  '["Indigenous arts"]', 'open'
),
(
  'g_cur_oac_artists_communities',
  'oac-artists-in-communities-and-schools',
  'Artists in Communities and Schools Projects',
  'Ontario Arts Council',
  'both',
  'Interactive arts experiences with Ontario communities and schools.',
  NULL, NULL, NULL, '2026-04-21', NULL,
  'https://www.arts.on.ca/grants/artists-in-communities-and-schools-projects', 'ON',
  '["community arts"]', 'open'
),
(
  'g_cur_oc_music_company',
  'ontario-creates-music-company-development',
  'Ontario Music Investment Fund — Music Company Development',
  'Ontario Creates',
  'organization',
  'Investment for Ontario music companies (labels, publishers, managers) with revenues over $125K.',
  NULL, NULL, NULL, '2026-04-23', 'Second deadline Sep 10, 2026',
  'https://www.ontariocreates.ca/investment-programs/content-creation/ontario-music-fund', 'ON',
  '["music"]', 'open'
),
(
  'g_cur_oc_music_futures',
  'ontario-creates-music-futures',
  'Ontario Music Investment Fund — Music Futures',
  'Ontario Creates',
  'organization',
  'Growth investment for Ontario music companies with revenues $25K–$125K.',
  NULL, NULL, NULL, '2026-04-30', 'Second deadline Sep 24, 2026',
  'https://www.ontariocreates.ca/investment-programs/content-creation/ontario-music-fund', 'ON',
  '["music"]', 'open'
),
(
  'g_cur_oc_publishing',
  'ontario-creates-publishing-marketing-discoverability',
  'Publishing Marketing and Discoverability Fund',
  'Ontario Creates',
  'organization',
  'Marketing investment for Ontario book and magazine publishers (incl. emerging stream).',
  NULL, 150000, 'Up to $150,000; emerging stream up to $15,000', '2026-06-01', NULL,
  'https://www.ontariocreates.ca/investment-programs/business-development/publishing-marketing-and-discoverability-fund', 'ON',
  '["literary"]', 'open'
),
(
  'g_cur_factor_artist_dev',
  'factor-artist-development',
  'Artist Development',
  'FACTOR',
  'individual',
  'Up to $5,000 toward a year of artist development (recording, touring, video, marketing) for Canadian commercial recording artists including Ontario.',
  0, 5000, '$5,000 subsidy', NULL, 'See FACTOR fiscal deadlines',
  'https://www.factor.ca/programs/artist-programs/', 'CA',
  '["music"]', 'open'
),
(
  'g_cur_factor_jsr_album',
  'factor-juried-sound-recording-album',
  'Juried Sound Recording: Album',
  'FACTOR',
  'both',
  'Funding toward production and marketing of an original full-length sound recording for eligible Canadian artists/labels.',
  NULL, NULL, NULL, NULL, 'See FACTOR deadlines calendar',
  'https://www.factor.ca/artists/deadlines/', 'CA',
  '["music"]', 'open'
),
(
  'g_cur_pch_bcah_festivals',
  'pch-bcah-local-festivals',
  'Building Communities Through Arts and Heritage — Local Festivals',
  'Canadian Heritage',
  'organization',
  'Funding for recurring local festivals presenting local artists, artisans and cultural carriers. Ontario community groups eligible.',
  NULL, NULL, NULL, NULL, 'See component guidelines for intake',
  'https://www.canada.ca/en/canadian-heritage/services/funding/building-communities.html', 'CA',
  '["festivals","community arts","heritage"]', 'open'
),
(
  'g_cur_pch_arts_presentation',
  'pch-canada-arts-presentation-fund',
  'Canada Arts Presentation Fund',
  'Canadian Heritage',
  'organization',
  'Assistance to professional arts presenters and presenter-support organizations (festivals and performing arts series).',
  NULL, NULL, NULL, NULL, 'See program page',
  'https://www.canada.ca/en/canadian-heritage/services/funding.html', 'CA',
  '["festivals","theatre","dance","music"]', 'open'
),
(
  'g_cur_ottawa_creation',
  'ottawa-creation-and-production-fund',
  'Creation and Production Fund for Professional Artists',
  'City of Ottawa',
  'individual',
  'Municipal project support for professional artists in Ottawa (separate from organizational arts funding streams).',
  NULL, NULL, NULL, NULL, 'See City of Ottawa cultural funding pages',
  'https://ottawa.ca/en/arts-heritage-and-events/funding-calls-and-opportunities/cultural-funding/arts-funding-program/funding-streams', 'ON',
  '["visual arts","theatre","music","dance","literary"]', 'open'
),
(
  'g_cur_hamilton_creation',
  'hamilton-cef-creation-presentation',
  'City Enrichment Fund — Creation & Presentation for Professional Artists',
  'City of Hamilton',
  'individual',
  'CEF arts stream supporting professional artist creation and presentation in Hamilton.',
  NULL, NULL, NULL, NULL, 'CEF intake windows — see City of Hamilton',
  'https://www.hamilton.ca/people-programs/community-funding-grant-programs/city-enrichment-fund/cef-arts-program', 'ON',
  '["visual arts","theatre","music","dance"]', 'open'
),
(
  'g_cur_kingston_creation',
  'kingston-ckaf-creation-development',
  'City of Kingston Arts Fund — Creation & Development',
  'Kingston Arts Council (CKAF)',
  'individual',
  'Supports Kingston professional artists for creation/development of new work ($3,000–$10,000).',
  3000, 10000, NULL, NULL, 'Annual CKAF intakes',
  'https://artskingston.ca/ckaf/', 'ON',
  '["visual arts","music","theatre","dance","literary"]', 'open'
),
(
  'g_cur_metcalf_performing',
  'metcalf-performing-arts-strategic',
  'Performing Arts strategy grants (curated)',
  'George Cedric Metcalf Charitable Foundation',
  'organization',
  'Foundation support relevant to Ontario performing-arts organizations. Confirm live guidelines before applying.',
  NULL, NULL, NULL, NULL, 'See foundation site for current calls',
  'https://metcalffoundation.com/', 'ON',
  '["theatre","dance","music"]', 'open'
);
