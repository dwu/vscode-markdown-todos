'use strict';
import { ExtensionContext, window, workspace, Uri, TreeDataProvider, TreeItem, TextDocument, EventEmitter, TreeItemCollapsibleState, ThemeIcon, commands, Selection, RelativePattern, FileSystemWatcher, TextEditorRevealType } from 'vscode';
import { removeFileFromCache } from './cache';
import { createMarkdownSearchScopes, sortFilePaths } from './indexing';
import { SerialQueue } from './asyncQueue';
import { parseMarkdownDocument } from './parser';
import { countTodos, visibleChildren, visibleFiles, visibleHeadTodos } from './treeItems';

const FileType: 'file' = 'file';
type File = { type: typeof FileType; path: string; headlessTodos: Todo[]; heads: Head[]; };

const HeadType: 'head' = 'head';
type Head = { type: typeof HeadType; text: string; line: number; file: File; todos: Todo[]; };

const TodoType: 'todo' = 'todo';
type Todo = { type: typeof TodoType; text: string; isChecked: boolean; line: number; file: File; indent: string; };

type Item = File | Head | Todo;

export function registerMarkdownTodos(context: ExtensionContext): void {
    const todoTreeDataProvider = new TodoTreeDataProvider();

    context.subscriptions.push(commands.registerCommand('markdown-todos.refresh', async () => {
        await todoTreeDataProvider.reindex();
    }));

    context.subscriptions.push(commands.registerCommand('markdown-todos.toggleTicked', () => {
        todoTreeDataProvider.displayTicked = !todoTreeDataProvider.displayTicked;
    }));

    context.subscriptions.push(commands.registerCommand('markdown-todos.focus', async (todo: Todo) => {
        const textEditor = await window.showTextDocument(Uri.file(todo.file.path), { preview: true });
        const range = textEditor.document.lineAt(todo.line).range;
        textEditor.selection = new Selection(range.end, range.start);
        textEditor.revealRange(range, TextEditorRevealType.InCenter);
    }));

    context.subscriptions.push(todoTreeDataProvider);
    context.subscriptions.push(window.createTreeView('markdown-todos-explorer', { treeDataProvider: todoTreeDataProvider }));
    context.subscriptions.push(window.createTreeView('markdown-todos-view-container', { treeDataProvider: todoTreeDataProvider }));
}

class TodoTreeDataProvider implements TreeDataProvider<Item> {
    // Type as an array of `File`s as only files are kept at the top level
    private cache: File[] = [];
    private _onDidChangeTreeData: EventEmitter<Item | undefined> = new EventEmitter<Item | undefined>();
    private _displayTicked = false;
    public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

    private readonly watcher: FileSystemWatcher;
    private readonly operationQueue = new SerialQueue();
    private readonly outputChannel = window.createOutputChannel('Markdown To-Dos');

    constructor() {
        this.watcher = workspace.createFileSystemWatcher('**/*.md');

        this.watcher.onDidChange(uri => {
            this.runSafely('Unable to refresh changed Markdown file', this.operationQueue.enqueue(async () => {
                this.refresh(await workspace.openTextDocument(uri));
            }));
        });

        this.watcher.onDidCreate(uri => {
            this.runSafely('Unable to refresh created Markdown file', this.operationQueue.enqueue(async () => {
                this.refresh(await workspace.openTextDocument(uri));
            }));
        });

        this.watcher.onDidDelete(uri => {
            this.runSafely('Unable to refresh deleted Markdown file', this.operationQueue.enqueue(() => {
                if (removeFileFromCache(this.cache, uri.fsPath)) {
                    this._onDidChangeTreeData.fire(undefined);
                }
            }));
        });

        void this.reindex();
    }

    public getTreeItem(element: Item) {
        switch (element.type) {
            case 'file': {
                const headlessCounts = countTodos(element.headlessTodos);
                const headfulCounts = element.heads.reduce((counts, head) => {
                    const { checked, unchecked } = countTodos(head.todos);
                    return { checked: counts.checked + checked, unchecked: counts.unchecked + unchecked };
                }, { checked: 0, unchecked: 0 });
                const checked = headlessCounts.checked + headfulCounts.checked;
                const unchecked = headlessCounts.unchecked + headfulCounts.unchecked;
                const total = checked + unchecked;
                const done = checked === 0 ? '' : `${checked} done, `;
                const item = new TreeItem(`${workspace.asRelativePath(Uri.file(element.path), true)} (${done}${unchecked} to do, ${total} total)`, TreeItemCollapsibleState.Expanded);
                item.contextValue = 'file';
                item.iconPath = ThemeIcon.Folder;
                item.resourceUri = Uri.file(element.path);
                item.id = element.path;
                item.tooltip = element.path;
                return item;
            }
            case 'head': {
                const { checked, unchecked } = countTodos(element.todos);
                const total = checked + unchecked;
                const done = checked === 0 ? '' : `${checked} done, `;
                const item = new TreeItem(`${element.text} (${done}${unchecked} to do, ${total} total)`, TreeItemCollapsibleState.Expanded);
                item.contextValue = 'head';
                item.iconPath = ThemeIcon.Folder;
                item.id = element.file.path + ':' + element.line;
                item.tooltip = element.text;
                return item;
            }
            case 'todo': {
                const item = new TreeItem(element.isChecked ? '☒ ' + element.text : '☐ '+ element.text);
                item.command = { title: 'Focus todo', command: 'markdown-todos.focus', arguments: [element] };
                item.contextValue = 'todo-' + (element.isChecked ? 'ticked' : 'unticked');
                item.iconPath = ThemeIcon.File;
                item.id = element.file.path + ':' + element.line;
                item.tooltip = element.text;
                return item;
            }
            default: {
                throw new Error(`Unexpected type ${(element as Item /* never */).type}`);
            }
        }
    }

    public getChildren(element?: Item | undefined) {
        if (element === undefined) {
            return visibleFiles(this.cache, this.displayTicked) as Item[];
        }

        if (element.type === 'file') {
            return visibleChildren(element, this.displayTicked);
        }

        if (element.type === 'head') {
            return visibleHeadTodos(element.todos, this._displayTicked);
        }

        // Todos do not have children.
    }

    public get displayTicked() {
        return this._displayTicked;
    }

    public set displayTicked(value: boolean) {
        this._displayTicked = value;
        this._onDidChangeTreeData.fire(undefined);
    }

    public async reindex(): Promise<void> {
        try {
            await this.operationQueue.enqueue(() => this.index());
        } catch (error) {
            this.reportError('Unable to index Markdown files', error);
        }
    }

    public reraise() {
        this._onDidChangeTreeData.fire(undefined);
    }

    private async index() {
        const workspaceRoots = (workspace.workspaceFolders ?? []).map(folder => ({ path: folder.uri.fsPath }));
        const scopes = createMarkdownSearchScopes(
            workspaceRoots,
            rootPath => workspace.getConfiguration('search', Uri.file(rootPath)).get<unknown>('exclude')
        );
        const filesByScope = await Promise.all(scopes.map(scope => {
            const include = new RelativePattern(Uri.file(scope.rootPath), '**/*.md');
            const exclude = scope.exclude === undefined ? undefined : new RelativePattern(Uri.file(scope.rootPath), scope.exclude);
            return workspace.findFiles(include, exclude);
        }));
        const files = sortFilePaths(filesByScope.flat().map(file => file.fsPath));
        const nextCache = new Map<string, File>();
        for (const file of files) {
            const textDocument = await workspace.openTextDocument(Uri.file(file));
            const parsedFile = this.parseFile(textDocument);
            if (parsedFile !== undefined) {
                nextCache.set(parsedFile.path, parsedFile);
            }
        }

        this.cache = [...nextCache.values()];
        this._onDidChangeTreeData.fire(undefined);
    }

    private refresh(textDocument: TextDocument) {
        const file = this.parseFile(textDocument);
        const filePath = textDocument.uri.fsPath;
        const index = this.cache.findIndex(cachedFile => cachedFile.path === filePath);

        if (file === undefined) {
            if (index !== -1) {
                this.cache.splice(index, 1);
                this._onDidChangeTreeData.fire(undefined);
            }
            return;
        }

        if (index !== -1) {
            this.cache[index] = file;
            this._onDidChangeTreeData.fire(file);
        } else {
            this.cache.push(file);
            // Refresh the tree to find the new file
            this._onDidChangeTreeData.fire(undefined);
        }
    }

    private parseFile(textDocument: TextDocument): File | undefined {
        const parsedDocument = parseMarkdownDocument(textDocument.getText());
        const file: File = { type: FileType, path: textDocument.uri.fsPath, headlessTodos: [], heads: [] };
        file.headlessTodos = parsedDocument.headlessTodos.map(todo => ({ ...todo, type: TodoType, file }));
        file.heads = parsedDocument.heads.map(head => ({
            ...head,
            type: HeadType,
            file,
            todos: head.todos.map(todo => ({ ...todo, type: TodoType, file }))
        }));

        if (file.headlessTodos.length === 0 && file.heads.length === 0) {
            return undefined;
        }

        return file;
    }

    private runSafely(operation: string, promise: Promise<void>): void {
        void promise.catch(error => this.reportError(operation, error));
    }

    private reportError(operation: string, error: unknown): void {
        const message = error instanceof Error ? error.message : String(error);
        this.outputChannel.appendLine(`${operation}: ${message}`);
    }

    public dispose() {
        this._onDidChangeTreeData.dispose();
        this.watcher.dispose();
        this.outputChannel.dispose();
    }
}
