import type { ConstitutionSchema } from './types';

export const constitutionV1: ConstitutionSchema = {
  version: '1.0.0',

  argumentTypes: [
    {
      code: 'CLM',
      name: 'Claim',
      description:
        'A substantive, falsifiable assertion supporting or opposing the resolution. Must be declarative.',
    },
    {
      code: 'RBT',
      name: 'Rebuttal',
      description:
        'A direct challenge to a parent Claim or Rebuttal. Must explain why the parent is wrong, misleading, or insufficient.',
    },
    {
      code: 'CRB',
      name: 'Counter-Rebuttal',
      description:
        'A defense of the original claim against a Rebuttal. Must address the specific objection raised.',
    },
    {
      code: 'EVD',
      name: 'Evidence',
      description:
        'Factual support for a parent Claim, Rebuttal, or Counter-Rebuttal. Must include at least one cited source.',
    },
    {
      code: 'CLR',
      name: 'Clarification Request',
      description:
        'A question asking the parent author to clarify scope, definitions, or assumptions. Must be phrased as a question.',
    },
    {
      code: 'CON',
      name: 'Concession',
      description:
        "An acknowledgment that the parent argument's point is valid. Must explicitly state what is being conceded.",
    },
    {
      code: 'SYN',
      name: 'Synthesis Note',
      description:
        'A summary of a completed subtree. Available only when the parent thread is closed.',
    },
  ],

  transitionMatrix: {
    CLM: ['RBT', 'EVD', 'CLR', 'CON'],
    RBT: ['CRB', 'EVD', 'CLR', 'CON'],
    CRB: ['RBT', 'EVD', 'CLR'],
    EVD: ['CLR', 'RBT'],
    CLR: ['CLM'],
    CON: ['SYN'],
    SYN: [],
  },

  tags: [
    { id: 'empirical', label: 'Empirical', category: 'epistemic' },
    { id: 'theoretical', label: 'Theoretical', category: 'epistemic' },
    { id: 'definitional', label: 'Definitional', category: 'epistemic' },
    { id: 'statistical', label: 'Statistical', category: 'epistemic' },
    { id: 'anecdotal', label: 'Anecdotal', category: 'epistemic' },
    { id: 'speculative', label: 'Speculative', category: 'rhetorical' },
    { id: 'expert-opinion', label: 'Expert Opinion', category: 'rhetorical' },
    { id: 'peer-reviewed', label: 'Peer-Reviewed', category: 'rhetorical' },
    { id: 'scope-dispute', label: 'Scope Dispute', category: 'procedural' },
    { id: 'burden-of-proof', label: 'Burden of Proof', category: 'procedural' },
  ],

  structuralLimits: {
    maxDepth: 10,
    maxBodyLength: 2000,
    maxTagsPerArgument: 3,
    maxEvidenceLinksPerArgument: 5,
  },

  aiChecks: {
    enabled: true,
    checks: {
      topicRelevance: {
        enabled: true,
        ruleId: 'AI_OFF_TOPIC',
        severity: 'warning',
        confidenceThreshold: 0.85,
      },
      typeFit: {
        enabled: true,
        ruleId: 'AI_TYPE_MISMATCH',
        severity: 'info',
        confidenceThreshold: 0.8,
      },
      tagSuggestion: {
        enabled: true,
        ruleId: 'AI_TAG_SUGGESTION',
        severity: 'info',
      },
    },
  },
};
