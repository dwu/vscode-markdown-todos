'use strict';
import { ExtensionContext, window, workspace, Uri, TreeDataProvider, TreeItem, TextDocument, EventEmitter, TreeItemCollapsibleState, ThemeIcon, commands, Selection, Range, RelativePattern, FileSystemWatcher, TextEditorRevealType } from 'vscode';
import * as path from 'path';

const FileType: 'file' = 'file';
type File = { type: typeof FileType; path: string; headlessTodos: Todo[]; heads: Head[]; };

const HeadType: 'head' = 'head';
type Head = { type: typeof HeadType; text: string; line: number; file: File; todos: Todo[]; };

const TodoType: 'todo' = 'todo';
type Todo = { type: typeof TodoType; text: string; isChecked: boolean; line: number; file: File; indent: string; };

type Item = File | Head | Todo;

function treeFilename(filepath: string): string {
    return `${path.basename(path.dirname(filepath))}/${path.basename(filepath)}`;
}

export async function activate(context: ExtensionContext): Promise<void> {
    const todoTreeDataProvider = new TodoTreeDataProvider();

    context.subscriptions.push(commands.registerCommand('markdown-todos.refresh', () => {
        todoTreeDataProvider.reindex();
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

    constructor() {
        this.watcher = workspace.createFileSystemWatcher('**/*.md');

        this.watcher.onDidChange(async uri => {
            this.refresh(await workspace.openTextDocument(uri));
        });

        this.watcher.onDidCreate(async uri => {
            this.refresh(await workspace.openTextDocument(uri));
        });

        this.watcher.onDidDelete(uri => {
            const index = this.cache.findIndex(file => file.path === uri.fsPath);
            this.cache.splice(index, 1);
            this._onDidChangeTreeData.fire(undefined);
        });

        this.index();
    }

    public getTreeItem(element: Item) {
        switch (element.type) {
            case 'file': {
                const headlessCounts = this.count(element.headlessTodos);
                const headfulCounts = element.heads.reduce((counts, head) => {
                    const { checked, unchecked } = this.count(head.todos);
                    return { checked: counts.checked + checked, unchecked: counts.unchecked + unchecked };
                }, { checked: 0, unchecked: 0 });
                const checked = headlessCounts.checked + headfulCounts.checked;
                const unchecked = headlessCounts.unchecked + headfulCounts.unchecked;
                const total = checked + unchecked;
                const done = checked === 0 ? '' : `${checked} done, `;
                const item = new TreeItem(`${treeFilename(element.path)} (${done}${unchecked} to do, ${total} total)`, TreeItemCollapsibleState.Expanded);
                item.contextValue = 'file';
                item.iconPath = ThemeIcon.Folder;
                item.id = element.path;
                item.tooltip = element.path;
                return item;
            }
            case 'head': {
                const { checked, unchecked } = this.count(element.todos);
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
            if (this.displayTicked) {
                return this.cache as Item[];
            } else {
                return this.cache.filter(file => {
                    const headlessCounts = this.count(file.headlessTodos);
                    const headfulCounts = file.heads.reduce((counts, head) => {
                        const { checked, unchecked } = this.count(head.todos);
                        return { checked: counts.checked + checked, unchecked: counts.unchecked + unchecked };
                    }, { checked: 0, unchecked: 0 });
                    const unchecked = headlessCounts.unchecked + headfulCounts.unchecked;
                    return unchecked > 0;
                }) as Item[];
            }
        }

        if (element.type === 'file') {
            return [
                ...this.displayTicked ? element.headlessTodos : element.headlessTodos.filter(todo => !todo.isChecked),
                ...this.displayTicked ? element.heads : element.heads.filter(head => head.todos.filter(todo => !todo.isChecked).length > 0)
            ];
        }

        if (element.type === 'head') {
            return this._displayTicked ? element.todos : element.todos.filter(todo => !todo.isChecked);
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

    public reindex() {
        this.cache = [];
        this.index();
    }

    public reraise() {
        this._onDidChangeTreeData.fire(undefined);
    }

    private async index() {
        // TODO: https://github.com/Microsoft/vscode/issues/48674
        const excludes = await workspace.getConfiguration('search', null).get('exclude')! as any;
        const globs = Object.keys(excludes).map(exclude => new RelativePattern(workspace.workspaceFolders![0], exclude));
        const occurences: { [fsPath: string]: number; } = {};
        for (const glob of globs) {
            // TODO: https://github.com/Microsoft/vscode/issues/47645
            for (const file of await workspace.findFiles('**/*.md', glob)) {
                occurences[file.fsPath] = (occurences[file.fsPath] || 0) + 1;
            }
        }

        // Accept only files not excluded in any of the globs
        const files = Object.keys(occurences).filter(fsPath => occurences[fsPath] === globs.length).sort((a, b) => treeFilename(a).localeCompare(treeFilename(b)));
        for (const file of files) {
            const textDocument = await workspace.openTextDocument(Uri.file(file));
            this.refresh(textDocument);
        }

        this._onDidChangeTreeData.fire(undefined);
    }

    private refresh(textDocument: TextDocument) {
        const path = textDocument.uri.fsPath;
        const index = this.cache.findIndex(file => file.path === path);
        let file = this.cache[index] as File | undefined;
        if (file !== undefined) {
            file.headlessTodos = [];
            file.heads = [];
        } else {
            file = { type: FileType, path, headlessTodos: [], heads: [] };
        }

        for (let index = 0; index < textDocument.lineCount; index++) {
            const line = textDocument.lineAt(index);

            let match: RegExpMatchArray | null;
            if (match = line.text.match(/^(#+) (.*)/)) {
                // Line is a heading ==> push head to file.heads
                const head: Head = { type: HeadType, text: match[2].trim(), line: line.lineNumber, todos: [], file };
                file.heads.push(head);
                continue;
            }
            if (match = line.text.match(/(\s*)[-*+] (\[.\]) (.*)/)) {
                // Line is a todo, checked or unchecked ==> push todo to either the correct heading or to headlessTodos
                let checked: boolean = false;
                if (match[2] === "[x]" || match[2] === "[X]") {
                    checked = true;
                }
                const todo: Todo = { type: TodoType, text: match[3].trim(), isChecked: checked, line: line.lineNumber, indent: match[1], file };
                if (file.heads.length === 0) {
                    file.headlessTodos.push(todo);
                } else {
                    file.heads[file.heads.length - 1].todos.push(todo);
                }
            }
        }

        file.heads = file.heads.filter(head => head.todos.length > 0);

        if (index !== -1) {
            // Remove file after ites last to-do item has been deleted
            if (file.headlessTodos.length === 0 && file.heads.length === 0) {
                this.cache.splice(index, 1);
                this._onDidChangeTreeData.fire(undefined);
            } else {
                this._onDidChangeTreeData.fire(file);
            }
        } else {
            // Do not include empty files
            if (file.headlessTodos.length !== 0 || file.heads.length !== 0) {
                this.cache.push(file);
                // Refresh the tree to find the new file
                this._onDidChangeTreeData.fire(undefined);
            }
        }
    }

    private count(todos: Todo[]) {
        return todos.reduce((counts, todo) => {
            if (todo.isChecked) {
                counts.checked++;
            } else {
                counts.unchecked++;
            }

            return counts;
        }, { checked: 0, unchecked: 0 });
    }

    public dispose() {
        delete (this as any).cache; // make eslint happy
        this._onDidChangeTreeData.dispose();
        this.watcher.dispose();
    }
}