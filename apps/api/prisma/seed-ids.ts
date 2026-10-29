import { createHash } from 'node:crypto';

// Fixed ids for the seed, so it can run again without duplicates. The workspace and the two original
// sign-in users keep their original UUIDs; every other row gets a deterministic UUID derived from its
// fixture key, so the seed, the fixtures and the integration tests agree.

export function seedUuid(key: string): string {
  const hex = createHash('sha256').update(`lulu-paid-ads:${key}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export const SEED_WORKSPACE_ID = '40b340f2-ed67-4fc9-b7b8-febbf2014943';
export const SEED_JAMIE_ID = '562025e7-2561-4ac9-82da-44cb11df5c28';
export const SEED_ALEX_ID = 'c255f401-73e5-40f2-aebd-452fe03ef9e4';
export const SEED_SAMIRA_ID = seedUuid('user_samira');

export const SEED_AD_ACCOUNT_IDS = {
  googleAds: seedUuid('account_google_ads'),
  googleLsa: seedUuid('account_google_lsa'),
  meta: seedUuid('account_meta'),
  linkedin: seedUuid('account_linkedin'),
} as const;

export const SEED_CAMPAIGN_IDS = {
  springBerlin: seedUuid('campaign_spring_berlin'),
  localCalls: seedUuid('campaign_local_calls'),
  studioAwareness: seedUuid('campaign_studio_awareness'),
  b2bQ4: seedUuid('campaign_b2b_q4'),
} as const;

export const SEED_CREATIVE_IDS = {
  springRsa: seedUuid('creative_spring_rsa'),
  berlinLanding: seedUuid('creative_berlin_landing'),
  offerExtension: seedUuid('creative_offer_extension'),
  lsaProfile: seedUuid('creative_lsa_profile'),
  callScript: seedUuid('creative_call_script'),
  studioWalkthrough: seedUuid('creative_studio_walkthrough'),
  beforeAfter: seedUuid('creative_before_after'),
  studioForm: seedUuid('creative_studio_form'),
  opsCaseStudy: seedUuid('creative_ops_case_study'),
  linkedinForm: seedUuid('creative_linkedin_form'),
} as const;

export const SEED_AUDIENCE_IDS = {
  website30d: seedUuid('audience_website_30d'),
  crmQualified: seedUuid('audience_crm_qualified'),
  lookalikeStudio: seedUuid('audience_lookalike_studio'),
} as const;

export const SEED_CONVERSION_EVENT_IDS = {
  qualifiedLead: seedUuid('event_qualified_lead'),
  bookedConsultation: seedUuid('event_booked_consultation'),
  offlineSale: seedUuid('event_offline_sale'),
} as const;

export const SEED_AUTOMATION_RULE_IDS = {
  protectCpl: seedUuid('rule_protect_cpl'),
  weeklyDigest: seedUuid('rule_weekly_digest'),
  trackingFailure: seedUuid('rule_tracking_failure'),
} as const;

export const SEED_AUTOMATION_ACTIVITY_IDS = {
  reviewRequested: seedUuid('activity_1'),
  digestSent: seedUuid('activity_2'),
} as const;

export const SEED_STATEMENT_IDS = {
  googleJune: seedUuid('statement_2026_06_google'),
  metaJune: seedUuid('statement_2026_06_meta'),
} as const;

export const SEED_INCIDENT_IDS = {
  linkedinConversion: seedUuid('incident_linkedin_conversion'),
  metaAudience: seedUuid('incident_meta_audience'),
} as const;

export const SEED_WEBHOOK_EVENT_IDS = {
  googleCampaignUpdated: seedUuid('webhook_1'),
  metaLeadCreated: seedUuid('webhook_2'),
  linkedinConversionRetrying: seedUuid('webhook_3'),
} as const;

export const SEED_SYNC_RUN_IDS = {
  googleAds: seedUuid('sync_1'),
  meta: seedUuid('sync_2'),
  linkedin: seedUuid('sync_3'),
} as const;

export const SEED_SPEND_LIMIT_ID = seedUuid('spend_limit');
export const SEED_APPROVAL_POLICY_ID = seedUuid('approval_policy');
export const SEED_PAYMENT_METHOD_ID = seedUuid('payment_method');
export const SEED_CAMPAIGN_DEFAULTS_SETTING_ID = seedUuid('setting_campaign_defaults');
