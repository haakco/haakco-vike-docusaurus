export const buildHighlightedSearchUrl = (url, key, value) => withSearchParam(url, key, value);
const resolveHighlightFeature = (options) => {
    const feature = options.features?.highlighting;
    if (feature === false || options.highlightParam === false) {
        return null;
    }
    if (typeof feature === "object") {
        return {
            param: feature.param ?? options.highlightParam ?? "highlight",
            constructorOptions: feature.constructorOptions ?? {},
        };
    }
    return {
        param: options.highlightParam || "highlight",
        constructorOptions: {},
    };
};
const resolveMetadataFields = (options) => options.features?.metadata === false
    ? []
    : (options.features?.metadata?.fields ?? options.metadataFields ?? []);
const resolveDefaultFilters = (options) => options.features?.filters === false
    ? undefined
    : (options.features?.filters?.defaultValue ?? options.defaultFilters);
const resolveDefaultSort = (options) => options.features?.sorting === false
    ? undefined
    : (options.features?.sorting?.defaultValue ?? options.defaultSort);
const resolveSubResultLimit = (options) => {
    const feature = options.features?.subResults;
    if (feature === false)
        return 0;
    if (typeof feature === "object")
        return feature.maxItems;
    return undefined;
};
export const resolvePagefindSearchFeatures = (options) => ({
    highlighting: resolveHighlightFeature(options),
    metadataFields: resolveMetadataFields(options),
    defaultFilters: resolveDefaultFilters(options),
    defaultSort: resolveDefaultSort(options),
    subResultLimit: resolveSubResultLimit(options),
});
const withTrailingSlash = (value) => (value.endsWith("/") ? value : `${value}/`);
const buildBundlePath = (baseUrl, fileName) => `${withTrailingSlash(baseUrl)}pagefind/${fileName}`;
const withSearchParam = (url, key, value) => {
    const parsed = new URL(url, "http://localhost");
    parsed.searchParams.set(key, value);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
};
const pickMetadata = (meta, metadataFields) => {
    const metadata = {};
    for (const field of metadataFields) {
        if (meta[field] != null) {
            metadata[field] = meta[field];
        }
    }
    return metadata;
};
const resolveHighlightConstructor = (module) => {
    const candidate = module.PagefindHighlight ??
        module.default ??
        globalThis.PagefindHighlight;
    if (typeof candidate !== "function") {
        throw new Error("PagefindHighlight constructor not found in pagefind-highlight.js");
    }
    return candidate;
};
export const enablePagefindHighlighting = async ({ baseUrl, highlightParam = "highlight", constructorOptions = {}, }) => {
    const module = (await import(
    /* webpackIgnore: true */
    buildBundlePath(baseUrl, "pagefind-highlight.js")));
    const PagefindHighlight = resolveHighlightConstructor(module);
    return new PagefindHighlight({
        highlightParam,
        ...constructorOptions,
    });
};
export const createPagefindSearchClient = ({ baseUrl, ...options }) => {
    let modulePromise = null;
    const resolvedFeatures = resolvePagefindSearchFeatures({
        baseUrl,
        ...options,
    });
    const loadModule = async () => {
        modulePromise ??= import(
        /* webpackIgnore: true */
        buildBundlePath(baseUrl, "pagefind.js"));
        const pagefind = await modulePromise;
        await pagefind.init();
        return pagefind;
    };
    return {
        init: loadModule,
        getFilters: async () => {
            const pagefind = await loadModule();
            return pagefind.filters?.() ?? null;
        },
        search: async (query, options = {}) => {
            const pagefind = await loadModule();
            const response = await pagefind.search(query, {
                filters: options.filters ?? resolvedFeatures.defaultFilters,
                sort: options.sort ?? resolvedFeatures.defaultSort,
            });
            const rawResults = await Promise.all(response.results.map((result) => result.data()));
            const limitedResults = rawResults.slice(0, options.limit ?? rawResults.length);
            return limitedResults.map((result) => {
                const meta = (result.meta ?? {});
                const url = resolvedFeatures.highlighting
                    ? buildHighlightedSearchUrl(result.url, resolvedFeatures.highlighting.param, query)
                    : result.url;
                return {
                    url,
                    title: meta.title ?? "Untitled",
                    excerpt: result.excerpt,
                    meta,
                    metadata: pickMetadata(meta, resolvedFeatures.metadataFields),
                    subResults: (result.sub_results ?? [])
                        .slice(0, resolvedFeatures.subResultLimit ?? result.sub_results?.length)
                        .map((subResult) => ({
                        ...subResult,
                        url: resolvedFeatures.highlighting
                            ? buildHighlightedSearchUrl(subResult.url, resolvedFeatures.highlighting.param, query)
                            : subResult.url,
                    })),
                };
            });
        },
    };
};
