# MCP Boolean Observation Mapping — Expanded 1000+ CSV

Generated: 2026-06-07T01:38:09Z

This ZIP contains a candidate mapping artifact for expanding MCP boolean classifier output into richer, display-only observations.

## Files

- `mcp_boolean_observation_mapping_expanded_1000plus.csv` — 2,383 mapping rows.
- `proposed_new_boolean_flags.csv` — 134 low-level booleans, including proposed new flags that may require SQL/API schema work.
- `schema_mcp_boolean_observation_mapping.json` — column-level manifest.
- `README_mcp_boolean_observation_mapping.md` — this file.

## Design intent

The mapping expands each family from simple many-to-one boolean rules into:
1. single-flag observations;
2. negative-flag observations;
3. two-flag combinations;
4. asymmetric yes/no combinations;
5. curated triple rules;
6. cross-family rules.

It includes alignments to:
- Graham-style disagreement hierarchy labels (DH0-DH6);
- HiTODS-style productivity/responsiveness clusters;
- Walton-style argument scheme slots where relevant;
- expert-disagreement dimensions: informant-related, information-related, uncertainty-related.

## Surface rule

- Card page: detail is loaded and visible by default.
- Timeline page: the same detail is available behind tap-to-reveal disclosure.

## Governance rule

Every row is a machine observation display rule only. The mapping must not block, reject, suppress, route, or delay a user post. Any `schema_action = requires_sql_or_json_schema_extension` row needs a normal operator-gated schema/API design before implementation.
