export function removeFileFromCache<T extends { path: string }>(cache: T[], filePath: string): boolean {
    const index = cache.findIndex(file => file.path === filePath);
    if (index < 0) {
        return false;
    }

    cache.splice(index, 1);
    return true;
}
