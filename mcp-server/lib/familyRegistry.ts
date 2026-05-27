/**
 * OPS-MCP-FAMILY-VALIDATOR-REFACTOR — Shared multi-family validator registry.
 *
 * `FamilyValidatorRegistry` is a Map-backed registry keyed by family id →
 * {@link FamilyMetadata}. Each family (currently only A; later B/C/D/E/F/G/H/I/J)
 * registers exactly once. The registry is the single source of truth for
 * "what families does this MCP server support".
 *
 * The module exposes BOTH a module-level singleton (consumed by the validator
 * at production time) AND a `createFamilyRegistry()` factory (consumed by
 * isolated unit tests). The singleton exposes 6 named functions per design
 * §3.3; the factory yields an instance with the same public surface.
 *
 * Design anchors:
 *   - design §3.1 (Map choice + ordered iteration)
 *   - design §3.2 (FamilyMetadata = ReadonlySet<rawKey> + classifierSetVersion)
 *   - design §3.3 (6 public functions; behavior contracts)
 *   - design §5.3 (factory pattern for test isolation)
 *
 * Doctrine anchors:
 *   - cdiscourse-doctrine §10a — every registered family is a structural-
 *     observation grouping; the registry encodes no verdict.
 *   - cdiscourse-doctrine §6 — pure data module; no env reads, no logging.
 */

/** Family id type (alias of string; later refactors may narrow). */
export type SupportedFamily = string;

/**
 * Metadata a family registers about itself.
 *
 * The raw key set is a frozen `ReadonlySet` (not an array) because the
 * registry's hot path is membership lookup (`requestedRawKeys ⊆ rawKeys`),
 * which is O(1) on a Set vs O(n) on an array. The underlying source data
 * (`FAMILY_A_RAW_KEYS`) is still an array; the registry stores a derived Set.
 */
export interface FamilyMetadata {
  readonly rawKeys: ReadonlySet<string>;
  readonly classifierSetVersion: string;
}

/**
 * The registry's public interface.
 *
 * Each method's contract is documented at the singleton-export bindings
 * below. The factory `createFamilyRegistry()` yields an instance with this
 * shape; the singleton exposes the same shape as 6 named free functions.
 */
export interface FamilyValidatorRegistry {
  register(family: SupportedFamily, metadata: FamilyMetadata): void;
  getSupportedFamilies(): ReadonlyArray<SupportedFamily>;
  getRawKeysForFamily(family: SupportedFamily): ReadonlySet<string>;
  getClassifierSetVersion(family: SupportedFamily): string;
  isFamilySupported(family: string): boolean;
  isRawKeySupportedForFamily(family: string, rawKey: string): boolean;
}

/**
 * Build a fresh registry instance.
 *
 * Use this in isolated unit tests so each test starts with an empty
 * registry and freely registers fake families without polluting the
 * production singleton.
 */
export function createFamilyRegistry(): FamilyValidatorRegistry {
  const families = new Map<SupportedFamily, FamilyMetadata>();

  return {
    register(family: SupportedFamily, metadata: FamilyMetadata): void {
      if (families.has(family)) {
        throw new Error('family already registered: ' + family);
      }
      if (metadata.rawKeys.size === 0) {
        throw new Error('rawKeys must be non-empty Set');
      }
      if (metadata.classifierSetVersion.length === 0) {
        throw new Error('classifierSetVersion must be non-empty string');
      }
      families.set(family, metadata);
    },

    getSupportedFamilies(): ReadonlyArray<SupportedFamily> {
      return Object.freeze(Array.from(families.keys()));
    },

    getRawKeysForFamily(family: SupportedFamily): ReadonlySet<string> {
      const metadata = families.get(family);
      if (metadata === undefined) {
        throw new Error('family not registered: ' + family);
      }
      return metadata.rawKeys;
    },

    getClassifierSetVersion(family: SupportedFamily): string {
      const metadata = families.get(family);
      if (metadata === undefined) {
        throw new Error('family not registered: ' + family);
      }
      return metadata.classifierSetVersion;
    },

    isFamilySupported(family: string): boolean {
      return families.has(family);
    },

    isRawKeySupportedForFamily(family: string, rawKey: string): boolean {
      const metadata = families.get(family);
      if (metadata === undefined) return false;
      return metadata.rawKeys.has(rawKey);
    },
  };
}

/**
 * Module-level singleton consumed by the production validator
 * (`familyBooleanRequestSchema.ts`). Family A registers into this instance
 * via `familyRegistryInit.ts`'s side-effect import.
 *
 * NOTE: the singleton's `register()` will throw on duplicate registration.
 * Idempotency at module-import time is provided by `familyRegistryInit.ts`'s
 * `initialized` guard, NOT by the registry. The registry intentionally
 * surfaces double-registration as a loud error (defensive; design §3.3).
 */
const singleton = createFamilyRegistry();

export function register(family: SupportedFamily, metadata: FamilyMetadata): void {
  singleton.register(family, metadata);
}

export function getSupportedFamilies(): ReadonlyArray<SupportedFamily> {
  return singleton.getSupportedFamilies();
}

export function getRawKeysForFamily(family: SupportedFamily): ReadonlySet<string> {
  return singleton.getRawKeysForFamily(family);
}

export function getClassifierSetVersion(family: SupportedFamily): string {
  return singleton.getClassifierSetVersion(family);
}

export function isFamilySupported(family: string): boolean {
  return singleton.isFamilySupported(family);
}

export function isRawKeySupportedForFamily(family: string, rawKey: string): boolean {
  return singleton.isRawKeySupportedForFamily(family, rawKey);
}
