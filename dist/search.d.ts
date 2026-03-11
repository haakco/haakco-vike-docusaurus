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
    search: (query: string, options?: {
        filters?: Record<string, unknown>;
        sort?: Record<string, SearchSortValue> | string;
    }) => Promise<PagefindSearchResponse>;
    filters?: () => Promise<unknown>;
};
export interface PagefindSubResult {
    url: string;
    title: string;
    excerpt: string;
}
export interface PagefindSearchResult<TMeta extends Record<string, string | undefined> = Record<string, string | undefined>> {
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
export interface PagefindMetadataFeatureOptions<TMetadataField extends string = string> {
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
export interface PagefindSearchFeatures<TMetadataField extends string = string> {
    highlighting?: boolean | PagefindHighlightFeatureOptions;
    metadata?: false | PagefindMetadataFeatureOptions<TMetadataField>;
    filters?: false | PagefindFiltersFeatureOptions;
    sorting?: false | PagefindSortingFeatureOptions;
    subResults?: boolean | PagefindSubResultsFeatureOptions;
}
export interface PagefindBrowserSearchOptions<TMetadataField extends string = string> {
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
export interface ResolvedPagefindSearchFeatures<TMetadataField extends string = string> {
    highlighting: null | {
        param: string;
        constructorOptions: Record<string, unknown>;
    };
    metadataFields: readonly TMetadataField[];
    defaultFilters?: Record<string, unknown>;
    defaultSort?: Record<string, SearchSortValue> | string;
    subResultLimit?: number;
}
export declare const buildHighlightedSearchUrl: (url: string, key: string, value: string) => string;
export declare const resolvePagefindSearchFeatures: <TMetadataField extends string = string>(options: PagefindBrowserSearchOptions<TMetadataField>) => ResolvedPagefindSearchFeatures<TMetadataField>;
export declare const enablePagefindHighlighting: ({ baseUrl, highlightParam, constructorOptions, }: PagefindHighlightOptions) => Promise<unknown>;
export declare const createPagefindSearchClient: <TMetadataField extends string = string>({ baseUrl, ...options }: PagefindBrowserSearchOptions<TMetadataField>) => {
    init: () => Promise<PagefindSearchModule>;
    getFilters: () => Promise<unknown>;
    search: (query: string, options?: PagefindSearchQueryOptions) => Promise<PagefindSearchResult<Record<TMetadataField | "title", string | undefined>>[]>;
};
export {};
