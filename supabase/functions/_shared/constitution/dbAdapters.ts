// MIRROR of src/domain/constitution/dbAdapters.ts
// Only difference: imports use explicit .ts extensions for Deno compatibility.
// Keep in sync with the source file.
import type {
  ConstitutionVersion,
  ConstitutionRule,
  ConstitutionTagDef,
  ConstitutionFlagDef,
  RuleType,
  EvaluationSeverity,
  FlagStatus,
} from './types.ts';

export interface DbConstitutionVersion {
  id: string;
  slug: string;
  version: string;
  title: string;
  active: boolean;
}

export interface DbConstitutionRule {
  id: string;
  constitution_id: string;
  code: string;
  title: string;
  description: string;
  rule_type: string;
  severity: string;
  params: Record<string, unknown>;
  enabled: boolean;
}

export interface DbConstitutionTagDef {
  code: string;
  label: string;
  description: string;
  category: string;
  allowed_argument_types: string[];
  enabled: boolean;
}

export interface DbConstitutionFlagDef {
  code: string;
  label: string;
  description: string;
  severity: string;
  default_status: string;
  auto_review_threshold: number | null;
  enabled: boolean;
}

function normalizeParams(params: Record<string, unknown>): Record<string, unknown> {
  const out = { ...params };

  const mappings: [string, string][] = [
    ['allowed_reply_types', 'allowedChildren'],
    ['allowed_root_types', 'allowedRootTypes'],
    ['min_chars', 'minChars'],
    ['max_chars', 'maxChars'],
    ['off_topic_threshold', 'offTopicThreshold'],
    ['applies_to', 'appliesTo'],
    ['applies_to_types', 'appliesToTypes'],
    ['axis_tag_codes', 'axisTagCodes'],
    ['hard_block_threshold', 'hardBlockThreshold'],
    ['warning_threshold', 'warningThreshold'],
    ['evasion_patterns', 'evasionPatterns'],
    ['loaded_patterns', 'loadedPatterns'],
    ['concession_markers', 'concessionMarkers'],
    ['uncertainty_patterns', 'uncertaintyPatterns'],
    ['trigger_tags', 'triggerTags'],
    ['evasion_parent_overlap_threshold', 'evasionParentOverlapThreshold'],
  ];

  for (const [snake, camel] of mappings) {
    if (snake in out && !(camel in out)) {
      out[camel] = out[snake];
    }
  }

  return out;
}

export function adaptDbConstitutionVersion(row: DbConstitutionVersion): ConstitutionVersion {
  return { id: row.id, slug: row.slug, version: row.version, title: row.title, active: row.active };
}

export function adaptDbRule(row: DbConstitutionRule): ConstitutionRule {
  return {
    id: row.id,
    constitutionId: row.constitution_id,
    code: row.code,
    title: row.title,
    description: row.description,
    ruleType: row.rule_type as RuleType,
    severity: row.severity as EvaluationSeverity,
    params: normalizeParams(row.params),
    enabled: row.enabled,
  };
}

export function adaptDbTagDef(row: DbConstitutionTagDef): ConstitutionTagDef {
  return {
    code: row.code,
    label: row.label,
    description: row.description,
    category: row.category,
    allowedArgumentTypes: row.allowed_argument_types,
    enabled: row.enabled,
  };
}

export function adaptDbFlagDef(row: DbConstitutionFlagDef): ConstitutionFlagDef {
  return {
    code: row.code,
    label: row.label,
    description: row.description,
    severity: row.severity as EvaluationSeverity,
    defaultStatus: row.default_status as FlagStatus,
    autoReviewThreshold: row.auto_review_threshold,
    enabled: row.enabled,
  };
}
