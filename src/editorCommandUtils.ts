import * as path from 'path';

const markdownCheckboxPattern = /^(\s*[-*+]\s+\[)([ xX])\](?=\s|$)/;

/**
 * Toggles the checkbox marker of a Markdown task at the start of a line.
 * Returns undefined when the line is not a Markdown task.
 */
export function toggleMarkdownCheckbox(lineText: string): string | undefined {
    const match = markdownCheckboxPattern.exec(lineText);
    if (match === null || match.index === undefined) {
        return undefined;
    }

    const nextMarker = match[2] === ' ' ? 'x' : ' ';
    return lineText.slice(0, match.index) + match[1] + nextMarker + ']' + lineText.slice(match.index + match[0].length);
}

/**
 * Finds the first non-empty file reference enclosed in angle brackets.
 */
export function getAngleBracketFileName(lineText: string): string | undefined {
    const match = /<([^<>]+)>/.exec(lineText);
    const fileName = match?.[1].trim();
    return fileName === '' ? undefined : fileName;
}

export function resolveRelativeFileReference(fileName: string, documentPath: string): string {
    return path.resolve(path.dirname(documentPath), fileName);
}
