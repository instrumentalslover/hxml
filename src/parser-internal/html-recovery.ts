interface RecoveryStackEntry {
    node: {
        type: string;
        name?: string;
    };
    mode: string;
}

export function rememberImplicitHtmlClosures(
    entries: RecoveryStackEntry[],
    recentlyImplicitlyClosedHtml: string[],
): void {
    for (const entry of entries) {
        if (entry.node.type !== 'element' || entry.mode !== 'html' || !entry.node.name) continue;
        recentlyImplicitlyClosedHtml.push(entry.node.name.toLowerCase());
        if (recentlyImplicitlyClosedHtml.length > 16) {
            recentlyImplicitlyClosedHtml.shift();
        }
    }
}

export function consumeImplicitHtmlClosure(
    closeName: string,
    recentlyImplicitlyClosedHtml: string[],
    adoptionFormattingTags: Set<string>,
): boolean {
    const lower = closeName.toLowerCase();
    if (!adoptionFormattingTags.has(lower)) return false;
    const index = recentlyImplicitlyClosedHtml.lastIndexOf(lower);
    if (index < 0) return false;
    recentlyImplicitlyClosedHtml.splice(index, 1);
    return true;
}

export function autoCloseBefore(
    openName: string,
    stack: RecoveryStackEntry[],
    htmlAutoCloseBefore: Record<string, Set<string>>,
): void {
    const lo = openName.toLowerCase();

    let didClose = true;
    while (didClose) {
        didClose = false;
        for (let i = stack.length - 1; i > 0; i--) {
            const entry = stack[i];
            if (entry.node.type !== 'element' || !entry.node.name) continue;

            if (entry.mode === 'xml') break;

            const stackName = entry.node.name.toLowerCase();
            const closeSet = htmlAutoCloseBefore[stackName];

            if (closeSet && closeSet.has(lo)) {
                stack.splice(i);
                didClose = true;
                break;
            }
        }
    }
}
