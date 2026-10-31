import {
  approvalRequestSchema,
  auditEntrySchema,
  authSessionSchema,
  attributionSchema,
  audienceCreateSchema,
  audienceListItemSchema,
  audienceUpdateSchema,
  conversionEventCreateSchema,
  conversionEventSchema,
  conversionEventUpdateSchema,
  creativeCreateSchema,
  creativeListItemSchema,
  creativeTestSchema,
  creativeUpdateSchema,
  campaignChecklistSchema,
  campaignCreateSchema,
  campaignDetailSchema,
  campaignListItemSchema,
  campaignPlanSchema,
  campaignPlanUpdateSchema,
  campaignSchema,
  campaignUpdateSchema,
  errorSchema,
  healthLiveSchema,
  healthStatusSchema,
  listMetaSchema,
  loginInputSchema,
  meUpdateSchema,
  overviewSchema,
  rolePermissionsSchema,
  trackingHealthSchema,
  userSchema,
} from '@lulu/shared';
import { z, type ZodType } from 'zod';

export type JsonObject = Record<string, unknown>;

// Scheme name for the bearer token from POST /auth/login. Lives here (not in
// document.ts) so paths.ts can reference it without a circular import.
export const BEARER_AUTH_SCHEME = 'bearerAuth';

const COMPONENT_NAMES = {
  HealthStatus: healthStatusSchema,
  HealthLiveStatus: healthLiveSchema,
  ListMeta: listMetaSchema,
  AuditEntry: auditEntrySchema,
  AudienceListItem: audienceListItemSchema,
  AudienceCreateInput: audienceCreateSchema,
  AudienceUpdateInput: audienceUpdateSchema,
  CreativeListItem: creativeListItemSchema,
  CreativeCreateInput: creativeCreateSchema,
  CreativeUpdateInput: creativeUpdateSchema,
  CreativeTest: creativeTestSchema,
  ConversionEvent: conversionEventSchema,
  ConversionEventCreateInput: conversionEventCreateSchema,
  ConversionEventUpdateInput: conversionEventUpdateSchema,
  Attribution: attributionSchema,
  ErrorEnvelope: errorSchema,
  LoginInput: loginInputSchema,
  AuthSession: authSessionSchema,
  MeUpdateInput: meUpdateSchema,
  User: userSchema,
  RolePermissions: rolePermissionsSchema,
  Campaign: campaignSchema,
  CampaignListItem: campaignListItemSchema,
  CampaignDetail: campaignDetailSchema,
  CampaignCreateInput: campaignCreateSchema,
  CampaignUpdateInput: campaignUpdateSchema,
  CampaignPlan: campaignPlanSchema,
  CampaignPlanUpdateInput: campaignPlanUpdateSchema,
  CampaignChecklist: campaignChecklistSchema,
  ApprovalRequest: approvalRequestSchema,
  Overview: overviewSchema,
  TrackingHealth: trackingHealthSchema,
} as const satisfies Record<string, ZodType>;

export type ComponentName = keyof typeof COMPONENT_NAMES;

export const COMPONENT_REF_PREFIX = '#/components/schemas/';

export function schemaRef(name: ComponentName): string {
  return `${COMPONENT_REF_PREFIX}${name}`;
}

// Zod 4 emits draft 2020-12 JSON Schema, which OpenAPI 3.1 embeds directly.
export function toJsonSchema(schema: ZodType): JsonObject {
  const json = z.toJSONSchema(schema, {
    io: 'output',
    unrepresentable: 'any',
    target: 'draft-2020-12',
  }) as JsonObject;
  // $schema belongs on standalone JSON Schema documents, not on OpenAPI components.
  delete json.$schema;
  return json;
}

// Single source of component schemas: every entry is a Zod schema from packages/shared.
export function buildComponentSchemas(): Record<ComponentName, JsonObject> {
  return Object.fromEntries(
    Object.entries(COMPONENT_NAMES).map(([name, schema]) => [name, toJsonSchema(schema)]),
  ) as Record<ComponentName, JsonObject>;
}
