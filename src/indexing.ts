export type WorkspaceRoot = { path: string };

export type MarkdownSearchScope = {
    rootPath: string;
    exclude?: string;
};

export function enabledSearchExcludes(exclude: unknown): string[] {
    if (typeof exclude !== 'object' || exclude === null || Array.isArray(exclude)) {
        return [];
    }

    return Object.entries(exclude)
        .filter(([, enabled]) => enabled === true)
        .map(([pattern]) => pattern);
}

export function combineSearchExcludes(excludes: string[]): string | undefined {
    if (excludes.length === 0) {
        return undefined;
    }
    if (excludes.length === 1) {
        return excludes[0];
    }

    return `{${excludes.join(',')}}`;
}

export function createMarkdownSearchScopes(
    workspaceRoots: WorkspaceRoot[],
    excludeForRoot: (rootPath: string) => unknown
): MarkdownSearchScope[] {
    return workspaceRoots.map(({ path: rootPath }) => {
        const exclude = combineSearchExcludes(enabledSearchExcludes(excludeForRoot(rootPath)));
        return exclude === undefined ? { rootPath } : { rootPath, exclude };
    });
}

export function sortFilePaths(filePaths: string[]): string[] {
    return [...new Set(filePaths)].sort((left, right) => left.localeCompare(right));
}
