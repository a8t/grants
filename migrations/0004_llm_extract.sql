-- LLM structured extract on proposals (admin review before publish)

ALTER TABLE grant_proposals ADD COLUMN llm_extract_json TEXT;
ALTER TABLE grant_proposals ADD COLUMN llm_raw_response TEXT;
ALTER TABLE grant_proposals ADD COLUMN llm_provider TEXT;
ALTER TABLE grant_proposals ADD COLUMN llm_model TEXT;
ALTER TABLE grant_proposals ADD COLUMN llm_enriched_at TEXT;
ALTER TABLE grant_proposals ADD COLUMN llm_error TEXT;
