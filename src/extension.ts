'use strict';
import { ExtensionContext } from 'vscode';
import { registerMarkdownTodos } from './markdownTodos';
import { registerOpenInApplication } from './openFile';
import { registerEditorCommands } from './editorCommands';

export async function activate(context: ExtensionContext): Promise<void> {
    registerMarkdownTodos(context);
    registerOpenInApplication(context);
    registerEditorCommands(context);
}
