import type { PluginOption } from "vite";
type MaybePromise<T> = T | Promise<T>;
export interface DocusaurusBuildOptions {
    rootDir?: string;
    siteDir?: string;
    outputDir?: string;
    tempRootDir?: string;
    packageManagerCommand?: string[];
    log?: (message: string) => void;
}
export interface VikeDocusaurusPluginOptions extends DocusaurusBuildOptions {
    mountPath?: string;
    dev?: {
        watch?: boolean;
        debounceMs?: number;
        proxyPort?: number | null;
        ignoreGeneratedDirs?: boolean;
        onBuildStart?: (reason: string) => MaybePromise<void>;
        onBuildSuccess?: (reason: string, outputDir: string) => MaybePromise<void>;
        onBuildFailure?: (reason: string, error: Error) => MaybePromise<void>;
    };
}
interface BuildResult {
    outputDir: string;
}
export declare const buildDocusaurusSite: (options?: DocusaurusBuildOptions) => Promise<BuildResult>;
export declare const vikePluginDocusaurus: (options?: VikeDocusaurusPluginOptions) => PluginOption;
export type { PagefindBrowserSearchOptions, PagefindFiltersFeatureOptions, PagefindHighlightFeatureOptions, PagefindHighlightOptions, PagefindMetadataFeatureOptions, PagefindSearchFeatures, PagefindSearchQueryOptions, PagefindSearchResult, PagefindSortingFeatureOptions, PagefindSubResult, PagefindSubResultsFeatureOptions, ResolvedPagefindSearchFeatures, } from "./search.js";
export { createPagefindSearchClient, enablePagefindHighlighting, } from "./search.js";
