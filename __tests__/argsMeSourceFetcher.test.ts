/**
 * RESEED-001 — argsMeSourceFetcher tests.
 * Injects fetchImpl so NO real network is used. Covers JSON + XML-fallback
 * parse, the Accept header, non-2xx, and the no-network guard.
 */
const fetcher = require('../scripts/reseeder/argsMeSourceFetcher');

function jsonResponse(body: unknown, status = 200) {
  return {
    status,
    headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? 'application/json;charset=utf-8' : null) },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

function xmlResponse(text: string, status = 200) {
  return {
    status,
    headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? 'text/html;charset=utf-8' : null) },
    json: async () => {
      throw new Error('not json');
    },
    text: async () => text,
  };
}

const REAL_SHAPE = {
  query: {},
  totalSize: 1,
  arguments: [
    {
      id: 'S1',
      conclusion: 'school uniforms',
      premises: [{ text: 'School uniforms reduce peer pressure over clothing.', stance: 'PRO' }],
      context: { topic: 'school uniforms', sourceDomain: 'debate.org', sourceId: 'S1', sourceUrl: 'https://www.debate.org/x/' },
      stance: 'PRO',
    },
  ],
};

describe('fetchArgsMeTopic', () => {
  it('parses a JSON content-type response (parseMode: json)', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(REAL_SHAPE));
    const { records, parseMode } = await fetcher.fetchArgsMeTopic({ query: 'school uniforms', pageSize: 2, fetchImpl });
    expect(parseMode).toBe('json');
    expect(records).toHaveLength(1);
    expect(records[0].topic).toBe('school uniforms');
  });

  it('sends the Accept: application/json header', async () => {
    const fetchImpl = jest.fn(async (_url: string, _opts: unknown) => jsonResponse(REAL_SHAPE));
    await fetcher.fetchArgsMeTopic({ query: 'x', pageSize: 1, fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const call = fetchImpl.mock.calls[0];
    const opts = call[1] as { headers: { Accept: string } };
    expect(opts.headers.Accept).toBe('application/json');
  });

  it('falls back to XML/HTML extraction on a non-JSON content-type (parseMode: xml_fallback)', async () => {
    // Embedded-JSON path (args.me non-JSON responses often inline the array).
    const html = `<html><body><script>window.__DATA={"arguments":${JSON.stringify(REAL_SHAPE.arguments)}}</script></body></html>`;
    const fetchImpl = jest.fn(async () => xmlResponse(html));
    const { records, parseMode } = await fetcher.fetchArgsMeTopic({ query: 'x', pageSize: 1, fetchImpl });
    expect(parseMode).toBe('xml_fallback');
    expect(records.length).toBeGreaterThanOrEqual(1);
    expect(records[0].topic).toBe('school uniforms');
  });

  it('extracts from XML element blocks when no embedded JSON is present', () => {
    const xml =
      '<arguments><argument><id>S7</id><conclusion>remote work</conclusion>' +
      '<topic>remote work</topic><premise>Remote work expands the hiring pool beyond commuting distance.</premise>' +
      '<stance>PRO</stance></argument></arguments>';
    const out = fetcher.extractArgumentsFromNonJson(xml);
    expect(out).toHaveLength(1);
    expect(out[0].premises[0].text).toContain('Remote work');
  });

  it('returns empty records (no throw) on a non-2xx status', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse({}, 503));
    const { records } = await fetcher.fetchArgsMeTopic({ query: 'x', pageSize: 1, fetchImpl });
    expect(records).toEqual([]);
  });

  it('returns empty records on a network error (no throw)', async () => {
    const fetchImpl = jest.fn(async () => {
      throw new Error('ECONNRESET');
    });
    const { records } = await fetcher.fetchArgsMeTopic({ query: 'x', pageSize: 1, fetchImpl });
    expect(records).toEqual([]);
  });

  it('guards against a missing fetch implementation (no accidental live call)', async () => {
    const savedFetch = (globalThis as { fetch?: unknown }).fetch;
    // Force global fetch undefined so the module cannot fall back to it.
    (globalThis as { fetch?: unknown }).fetch = undefined;
    try {
      await expect(fetcher.fetchArgsMeTopic({ query: 'x', pageSize: 1 })).rejects.toThrow(/no fetch implementation/);
    } finally {
      (globalThis as { fetch?: unknown }).fetch = savedFetch;
    }
  });
});
