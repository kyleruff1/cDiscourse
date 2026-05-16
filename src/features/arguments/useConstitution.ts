import { useState, useEffect } from 'react';
import {
  constitutionVersion as localVersion,
  constitutionRules as localRules,
  tagDefinitions as localTagDefs,
  flagDefinitions as localFlagDefs,
  adaptDbConstitutionVersion,
  adaptDbRule,
  adaptDbTagDef,
  adaptDbFlagDef,
} from '../../domain/constitution';
import type {
  ConstitutionVersion,
  ConstitutionRule,
  ConstitutionTagDef,
  ConstitutionFlagDef,
} from '../../domain/constitution/types';
import { supabase, SUPABASE_CONFIGURED } from '../../lib/supabase';

export interface UseConstitutionResult {
  /** True only while the Supabase fetch is in-flight. Local values are usable immediately. */
  loading: boolean;
  error: string | null;
  /** 'supabase' if successfully fetched; 'local_fallback' otherwise. */
  source: 'supabase' | 'local_fallback';
  activeConstitution: ConstitutionVersion;
  activeRules: ConstitutionRule[];
  tagDefinitions: ConstitutionTagDef[];
  flagDefinitions: ConstitutionFlagDef[];
}

/**
 * Loads constitution data from Supabase when configured, falling back to
 * the locally bundled v1 definitions. Never blocks the composer — local
 * values are available immediately as initial state.
 */
export function useConstitution(): UseConstitutionResult {
  const [loading, setLoading] = useState(SUPABASE_CONFIGURED);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'supabase' | 'local_fallback'>('local_fallback');
  const [activeConstitution, setActiveConstitution] = useState<ConstitutionVersion>(localVersion);
  const [activeRules, setActiveRules] = useState<ConstitutionRule[]>(localRules);
  const [tagDefs, setTagDefs] = useState<ConstitutionTagDef[]>(localTagDefs);
  const [flagDefs, setFlagDefs] = useState<ConstitutionFlagDef[]>(localFlagDefs);

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) {
      return;
    }

    async function fetchFromSupabase() {
      try {
        const { data: versionRows, error: vErr } = await supabase
          .from('constitution_versions')
          .select('*')
          .eq('active', true)
          .limit(1);
        if (vErr || !versionRows?.length) {
          throw vErr ?? new Error('No active constitution version found');
        }

        const version = adaptDbConstitutionVersion(versionRows[0]);

        const [rulesResult, tagsResult, flagsResult] = await Promise.all([
          supabase.from('constitution_rules').select('*').eq('constitution_id', version.id).eq('enabled', true),
          supabase.from('tag_definitions').select('*').eq('enabled', true),
          supabase.from('flag_definitions').select('*').eq('enabled', true),
        ]);

        if (rulesResult.error) throw rulesResult.error;
        if (tagsResult.error) throw tagsResult.error;
        if (flagsResult.error) throw flagsResult.error;

        setActiveConstitution(version);
        setActiveRules((rulesResult.data ?? []).map(adaptDbRule));
        setTagDefs((tagsResult.data ?? []).map(adaptDbTagDef));
        setFlagDefs((flagsResult.data ?? []).map(adaptDbFlagDef));
        setSource('supabase');
        setError(null);
      } catch (err) {
        setSource('local_fallback');
        setError(err instanceof Error ? err.message : 'Constitution fetch failed');
      } finally {
        setLoading(false);
      }
    }

    void fetchFromSupabase();
  }, []);

  return {
    loading,
    error,
    source,
    activeConstitution,
    activeRules,
    tagDefinitions: tagDefs,
    flagDefinitions: flagDefs,
  };
}
