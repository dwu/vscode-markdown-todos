'use strict';
import { ExtensionContext, commands, TextEditor, Uri, window, workspace } from 'vscode';
import { getAngleBracketFileName, resolveRelativeFileReference, toggleMarkdownCheckbox } from './editorCommandUtils';

export function registerEditorCommands(context: ExtensionContext): void {
    context.subscriptions.push(commands.registerCommand('markdown-todos.toggleCheckbox', toggleCheckbox));
    context.subscriptions.push(commands.registerCommand('markdown-todos.openFileReference', openFileReference));
    context.subscriptions.push(window.onDidChangeActiveTextEditor(updateFileLinkContext));
    context.subscriptions.push(window.onDidChangeTextEditorSelection(event => {
        if (event.textEditor === window.activeTextEditor) {
            updateFileLinkContext();
        }
    }));
    context.subscriptions.push(workspace.onDidChangeTextDocument(event => {
        if (event.document === window.activeTextEditor?.document) {
            updateFileLinkContext();
        }
    }));
    updateFileLinkContext();
}

async function toggleCheckbox(): Promise<void> {
    const editor = getMarkdownEditor();
    if (editor === undefined) {
        return;
    }

    const line = editor.document.lineAt(editor.selection.active.line);
    const toggledLine = toggleMarkdownCheckbox(line.text);
    if (toggledLine === undefined) {
        return;
    }

    await editor.edit(edit => edit.replace(line.range, toggledLine));
}

async function openFileReference(): Promise<void> {
    const editor = getMarkdownEditor();
    if (editor === undefined) {
        return;
    }

    const line = editor.document.lineAt(editor.selection.active.line);
    const fileName = getAngleBracketFileName(line.text);
    if (fileName === undefined) {
        return;
    }

    const uri = resolveFileReference(fileName, editor.document.uri);
    if (uri === undefined) {
        return;
    }

    try {
        await commands.executeCommand('markdown-todos.openInApplication', uri);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        void window.showErrorMessage(`Unable to open ${fileName}: ${message}`);
    }
}

function getMarkdownEditor(): TextEditor | undefined {
    const editor = window.activeTextEditor;
    return editor?.document.languageId === 'markdown' ? editor : undefined;
}

function resolveFileReference(fileName: string, documentUri: Uri): Uri | undefined {
    if (/^[a-z][a-z\d+.-]*:/i.test(fileName) && !/^[a-zA-Z]:[\\/]/.test(fileName)) {
        try {
            return Uri.parse(fileName);
        } catch {
            return undefined;
        }
    }

    if (documentUri.scheme === 'file') {
        return Uri.file(resolveRelativeFileReference(fileName, documentUri.fsPath));
    }

    if (documentUri.scheme === 'untitled') {
        return undefined;
    }

    return Uri.joinPath(documentUri, '..', fileName);
}

function updateFileLinkContext(): void {
    const editor = getMarkdownEditor();
    const fileName = editor === undefined ? undefined : getAngleBracketFileName(
        editor.document.lineAt(editor.selection.active.line).text
    );
    const hasFileLink = fileName !== undefined && !isUriReference(fileName);
    void commands.executeCommand('setContext', 'markdown-todos.fileLink', hasFileLink);
}

function isUriReference(fileName: string): boolean {
    return /^[a-z][a-z\d+.-]*:/i.test(fileName) && !/^[a-zA-Z]:[\\/]/.test(fileName);
}
