# Markdown To-Dos

Collect Markdown task-list items in VS Code tree views and open their files in an external application. This is a custom version of the [vscode-markdown-todo](https://github.com/TomasHubelbauer/vscode-markdown-todo) extension with minimal dependencies. See the [changelog](CHANGELOG.md) for the history of changes.

**Note**: This project was created with substantial assistance from generative AI tools, primarily for my personal use.

## Views and commands

The extension contributes the Markdown To-Dos view to both the Explorer and its own activity-bar view container. The view shows files, headings, and tasks. By default, checked tasks and headings/files that contain only checked tasks are hidden. Use `Toggle ✓ display` to show them, and `Refresh` to scan the workspace again.

The tree updates when Markdown files are created, saved, or deleted. Unsaved editor changes are not picked up by the file watcher; save the file or run `Refresh` to include them. A workspace must be open for indexing.

`Open in external application` is available from the Command Palette, Explorer and editor context menus, and file items in either view. `Open with Application...` prompts for a launcher command for one use.

## Task syntax

The parser recognizes an optional indentation followed by one of these bullets and checkbox markers:

```markdown
- [ ] unchecked task
* [x] checked task
+ [X] also checked
- [ ]
```

Only ` `, `x`, and `X` are valid checkbox characters. The task marker must start the line apart from indentation, so a task-looking fragment in ordinary prose is ignored. Tasks inside fenced code blocks using backticks or tildes are ignored. A task after a heading is shown under the most recent heading; headings without tasks are omitted.

## Exclusions

Indexing uses the `search.exclude` setting for each workspace folder. Entries set to `true` are excluded, while entries set to `false` remain searchable. With no exclusions, all `*.md` files under every workspace folder are scanned. In a multi-root workspace, each root uses its own folder-scoped configuration.

The same exclusions apply to file-watcher updates. `files.exclude` and conditional exclusion objects are not applied. Run `Refresh` after changing exclusion settings.

## External launchers

The default command uses the operating system opener when no launcher is configured: `open` on macOS, `explorer.exe` on Windows, and `xdg-open` on Linux. These launches return as soon as the opener starts.

Configure launchers under `markdown-todos.openInApplication.applications`. Keys can use a file extension with or without its leading dot, plus `*` as a fallback. Values can be a bare application/command name or a command template. In templates, `%p` is replaced with the file's parent folder and `%f` with its full path. Quote paths containing spaces:

```json
{
  "markdown-todos.openInApplication.applications": {
    "md": "code --reuse-window %f",
    "pdf": "evince %f",
    "*": "code --reuse-window %f",
    "special": "my-launcher --directory %p --file %f"
  }
}
```

Platform-specific examples include `"pdf": "Preview"` on macOS (the extension invokes `open -a Preview`), `"pdf": "evince %f"` on Linux, and `"pdf": "SumatraPDF.exe %f"` on Windows. Explicitly configured launchers are checked for errors and time out after ten seconds; their output is limited to the last 32 KiB.

## Troubleshooting

- If no tasks appear, open a workspace, check the task syntax, confirm the file is saved, and run `Refresh`.
- If checked tasks are missing, use `Toggle ✓ display`.
- If a file is missing, inspect `search.exclude` in the relevant workspace folder and make sure its entry is not set to `true`.
- If opening a file fails, verify that the configured launcher is installed and available on `PATH`, then try `Open with Application...` with a quoted `%f` template.

Build and package via `npm install && ./node_modules/.bin/vsce package`.
