type SearchSortValue = "asc" | "desc";

type PagefindRawResult = {
  url: string;
  excerpt: string;
  meta?: Record<string, string | undefined>;
  sub_results?: Array<{
    url: string;
    title: string;
    excerpt: string;
  }>;
};

type PagefindSearchResponse = {
  results: Array<{
    id: string;
    data: () => Promise<PagefindRawResult>;
  }>;
};

type PagefindSearchModule = {
  init: () => Promise<void>;
  search: (
    query: string,
    options?: {
      filters?: Record<string, unknown>;
      sort?: Record<string, SearchSortValue> | string;
    },
  ) => Promise<PagefindSearchResponse>;
  filters?: () => Promise<unknown>;
};

type PagefindHighlightConstructor = new (
  options?: Record<string, unknown>,
) => unknown;

export interface PagefindSubResult {
  url: string;
  title: string;
  excerpt: string;
}

export interface PagefindSearchResult<
  TMeta extends Record<string, string | undefined> = Record<
    string,
    string | undefined
  >,
> {
  url: string;
  title: string;
  excerpt: string;
  meta: TMeta;
  metadata: Partial<TMeta>;
  subResults: PagefindSubResult[];
}

export interface PagefindSearchQueryOptions {
  filters?: Record<string, unknown>;
  sort?: Record<string, SearchSortValue> | string;
  limit?: number;
}

export interface PagefindHighlightFeatureOptions {
  param?: string;
  constructorOptions?: Record<string, unknown>;
}

export interface PagefindMetadataFeatureOptions<
  TMetadataField extends string = string,
> {
  fields: readonly TMetadataField[];
}

export interface PagefindFiltersFeatureOptions {
  defaultValue?: Record<string, unknown>;
}

export interface PagefindSortingFeatureOptions {
  defaultValue?: Record<string, SearchSortValue> | string;
}

export interface PagefindSubResultsFeatureOptions {
  maxItems?: number;
}

export interface PagefindSearchFeatures<
  TMetadataField extends string = string,
> {
  highlighting?: boolean | PagefindHighlightFeatureOptions;
  metadata?: false | PagefindMetadataFeatureOptions<TMetadataField>;
  filters?: false | PagefindFiltersFeatureOptions;
  sorting?: false | PagefindSortingFeatureOptions;
  subResults?: boolean | PagefindSubResultsFeatureOptions;
}

export interface PagefindBrowserSearchOptions<
  TMetadataField extends string = string,
> {
  baseUrl: string;
  features?: PagefindSearchFeatures<TMetadataField>;
  highlightParam?: string | false;
  metadataFields?: readonly TMetadataField[];
  defaultFilters?: Record<string, unknown>;
  defaultSort?: Record<string, SearchSortValue> | string;
}

export interface PagefindHighlightOptions {
  baseUrl: string;
  highlightParam?: string;
  constructorOptions?: Record<string, unknown>;
}

export interface ResolvedPagefindSearchFeatures<
  TMetadataField extends string = string,
> {
  highlighting: null | {
    param: string;
    constructorOptions: Record<string, unknown>;
  };
  metadataFields: readonly TMetadataField[];
  defaultFilters?: Record<string, unknown>;
  defaultSort?: Record<string, SearchSortValue> | string;
  subResultLimit?: number;
}

export const buildHighlightedSearchUrl = (
  url: string,
  key: string,
  value: string,
) => withSearchParam(url, key, value);

const resolveHighlightFeature = <TMetadataField extends string>(
  options: PagefindBrowserSearchOptions<TMetadataField>,
) => {
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

const resolveMetadataFields = <TMetadataField extends string>(
  options: PagefindBrowserSearchOptions<TMetadataField>,
) =>
  options.features?.metadata === false
    ? []
    : (options.features?.metadata?.fields ?? options.metadataFields ?? []);

const resolveDefaultFilters = <TMetadataField extends string>(
  options: PagefindBrowserSearchOptions<TMetadataField>,
) =>
  options.features?.filters === false
    ? undefined
    : (options.features?.filters?.defaultValue ?? options.defaultFilters);

const resolveDefaultSort = <TMetadataField extends string>(
  options: PagefindBrowserSearchOptions<TMetadataField>,
) =>
  options.features?.sorting === false
    ? undefined
    : (options.features?.sorting?.defaultValue ?? options.defaultSort);

const resolveSubResultLimit = <TMetadataField extends string>(
  options: PagefindBrowserSearchOptions<TMetadataField>,
) => {
  const feature = options.features?.subResults;

  if (feature === false) return 0;
  if (typeof feature === "object") return feature.maxItems;
  return undefined;
};

export const resolvePagefindSearchFeatures = <
  TMetadataField extends string = string,
>(
  options: PagefindBrowserSearchOptions<TMetadataField>,
): ResolvedPagefindSearchFeatures<TMetadataField> => ({
  highlighting: resolveHighlightFeature(options),
  metadataFields: resolveMetadataFields(options),
  defaultFilters: resolveDefaultFilters(options),
  defaultSort: resolveDefaultSort(options),
  subResultLimit: resolveSubResultLimit(options),
});

const withTrailingSlash = (value: string) =>
  value.endsWith("/") ? value : `${value}/`;

const buildBundlePath = (baseUrl: string, fileName: string) =>
  `${withTrailingSlash(baseUrl)}pagefind/${fileName}`;

const withSearchParam = (url: string, key: string, value: string) => {
  const parsed = new URL(url, "http://localhost");
  parsed.searchParams.set(key, value);
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
};

const pickMetadata = <TMeta extends Record<string, string | undefined>>(
  meta: TMeta,
  metadataFields: readonly (keyof TMeta)[],
) => {
  const metadata: Partial<TMeta> = {};

  for (const field of metadataFields) {
    if (meta[field] != null) {
      metadata[field] = meta[field];
    }
  }

  return metadata;
};

const resolveHighlightConstructor = (module: Record<string, unknown>) => {
  const candidate =
    module.PagefindHighlight ??
    module.default ??
    (globalThis as Record<string, unknown>).PagefindHighlight;
  if (typeof candidate !== "function") {
    throw new Error(
      "PagefindHighlight constructor not found in pagefind-highlight.js",
    );
  }
  return candidate as PagefindHighlightConstructor;
};

export const enablePagefindHighlighting = async ({
  baseUrl,
  highlightParam = "highlight",
  constructorOptions = {},
}: PagefindHighlightOptions) => {
  const module = (await import(
    /* webpackIgnore: true */
    buildBundlePath(baseUrl, "pagefind-highlight.js")
  )) as Record<string, unknown>;

  const PagefindHighlight = resolveHighlightConstructor(module);
  return new PagefindHighlight({
    highlightParam,
    ...constructorOptions,
  });
};

export const createPagefindSearchClient = <
  TMetadataField extends string = string,
>({
  baseUrl,
  ...options
}: PagefindBrowserSearchOptions<TMetadataField>) => {
  let modulePromise: Promise<PagefindSearchModule> | null = null;
  const resolvedFeatures = resolvePagefindSearchFeatures({
    baseUrl,
    ...options,
  });

  const loadModule = async () => {
    modulePromise ??= import(
      /* webpackIgnore: true */
      buildBundlePath(baseUrl, "pagefind.js")
    ) as Promise<PagefindSearchModule>;

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
    search: async (
      query: string,
      options: PagefindSearchQueryOptions = {},
    ): Promise<
      PagefindSearchResult<
        Record<TMetadataField | "title", string | undefined>
      >[]
    > => {
      const pagefind = await loadModule();

      const response = await pagefind.search(query, {
        filters: options.filters ?? resolvedFeatures.defaultFilters,
        sort: options.sort ?? resolvedFeatures.defaultSort,
      });

      const rawResults = await Promise.all(
        response.results.map((result) => result.data()),
      );

      const limitedResults = rawResults.slice(
        0,
        options.limit ?? rawResults.length,
      );

      return limitedResults.map((result) => {
        const meta = (result.meta ?? {}) as Record<
          TMetadataField | "title",
          string | undefined
        >;
        const url = resolvedFeatures.highlighting
          ? buildHighlightedSearchUrl(
              result.url,
              resolvedFeatures.highlighting.param,
              query,
            )
          : result.url;

        return {
          url,
          title: meta.title ?? "Untitled",
          excerpt: result.excerpt,
          meta,
          metadata: pickMetadata(
            meta,
            resolvedFeatures.metadataFields as readonly (
              | TMetadataField
              | "title"
            )[],
          ),
          subResults: (result.sub_results ?? [])
            .slice(
              0,
              resolvedFeatures.subResultLimit ?? result.sub_results?.length,
            )
            .map((subResult) => ({
              ...subResult,
              url: resolvedFeatures.highlighting
                ? buildHighlightedSearchUrl(
                    subResult.url,
                    resolvedFeatures.highlighting.param,
                    query,
                  )
                : subResult.url,
            })),
        };
      });
    },
  };
};
