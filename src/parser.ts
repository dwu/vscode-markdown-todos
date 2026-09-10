export type ParsedTodo = {
    text: string;
    isChecked: boolean;
    line: number;
    indent: string;
};

export type ParsedHead = {
    text: string;
    line: number;
    todos: ParsedTodo[];
};

export type ParsedDocument = {
    headlessTodos: ParsedTodo[];
    heads: ParsedHead[];
};

const headingPattern = /^(#+)\s+(.*)$/;
const taskPattern = /^(\s*)[-*+]\s+\[([ xX])\](?:\s+(.*))?$/;
const fencePattern = /^ {0,3}(`{3,}|~{3,})(.*)$/;

export function parseMarkdownDocument(text: string): ParsedDocument {
    const headlessTodos: ParsedTodo[] = [];
    const heads: ParsedHead[] = [];
    let activeFence: { marker: '`' | '~'; length: number } | undefined;

    for (const [lineNumber, lineText] of text.split(/\r?\n/).entries()) {
        const fenceMatch = lineText.match(fencePattern);
        if (fenceMatch !== null) {
            const marker = fenceMatch[1][0] as '`' | '~';
            if (activeFence === undefined) {
                if (marker === '`' && fenceMatch[2].includes('`')) { continue; }
                activeFence = { marker, length: fenceMatch[1].length };
            } else if (activeFence.marker === marker && fenceMatch[1].length >= activeFence.length && /^[ \t]*$/.test(fenceMatch[2])) {
                activeFence = undefined;
            }
            continue;
        }
        if (activeFence !== undefined) {
            continue;
        }

        const headingMatch = lineText.match(headingPattern);
        if (headingMatch !== null) {
            heads.push({ text: headingMatch[2].trim(), line: lineNumber, todos: [] });
            continue;
        }

        const taskMatch = lineText.match(taskPattern);
        if (taskMatch === null) {
            continue;
        }

        const todo: ParsedTodo = {
            text: taskMatch[3]?.trim() ?? '',
            isChecked: taskMatch[2].toLowerCase() === 'x',
            line: lineNumber,
            indent: taskMatch[1]
        };
        const currentHead = heads[heads.length - 1];
        if (currentHead === undefined) {
            headlessTodos.push(todo);
        } else {
            currentHead.todos.push(todo);
        }
    }

    return { headlessTodos, heads: heads.filter(head => head.todos.length > 0) };
}
