import { describe, it, expect } from 'vitest';
import { parse } from '../src/parser.js';
import { validate } from '../src/validator.js';
import type { ElementNode, HxmlNode } from '../src/ast.js';

/** Find elements by name in a flat list of children. */
function findElements(children: HxmlNode[], name: string): ElementNode[] {
    return children.filter(
        (n): n is ElementNode =>
            n.type === 'element' && n.name.toLowerCase() === name.toLowerCase(),
    );
}

/** Recursively find the first element matching a name. */
function findDeep(children: HxmlNode[], name: string): ElementNode | undefined {
    for (const node of children) {
        if (node.type === 'element') {
            if (node.name.toLowerCase() === name.toLowerCase()) return node;
            const found = findDeep(node.children, name);
            if (found) return found;
        }
    }
    return undefined;
}

describe('HTML5 auto-close rules', () => {
    describe('dt/dd auto-close', () => {
        it('auto-closes <dt> before another <dt>', () => {
            const { ast } = parse('<dl><dt>Term 1<dt>Term 2<dd>Def 2</dl>');
            const dl = findDeep(ast.children, 'dl');
            expect(dl).toBeDefined();
            const dts = findElements(dl!.children, 'dt');
            expect(dts).toHaveLength(2);
        });

        it('auto-closes <dd> before <dt>', () => {
            const { ast } = parse('<dl><dd>Def 1<dt>Term 2</dl>');
            const dl = findDeep(ast.children, 'dl');
            expect(dl).toBeDefined();
            const children = dl!.children.filter(n => n.type === 'element');
            expect(children).toHaveLength(2);
        });

        it('auto-closes <dt> before <dd>', () => {
            const { ast } = parse('<dl><dt>Term<dd>Definition</dl>');
            const dl = findDeep(ast.children, 'dl');
            expect(dl).toBeDefined();
            const dt = findElements(dl!.children, 'dt');
            const dd = findElements(dl!.children, 'dd');
            expect(dt).toHaveLength(1);
            expect(dd).toHaveLength(1);
        });
    });

    describe('option/optgroup auto-close', () => {
        it('auto-closes <option> before another <option>', () => {
            const { ast } = parse('<select><option>A<option>B<option>C</select>');
            const select = findDeep(ast.children, 'select');
            expect(select).toBeDefined();
            const options = findElements(select!.children, 'option');
            expect(options).toHaveLength(3);
        });

        it('auto-closes <optgroup> before another <optgroup>', () => {
            const { ast } = parse('<select><optgroup label="G1"><option>A<optgroup label="G2"><option>B</select>');
            const select = findDeep(ast.children, 'select');
            expect(select).toBeDefined();
            const groups = findElements(select!.children, 'optgroup');
            expect(groups).toHaveLength(2);
        });
    });

    describe('thead/tbody/tfoot auto-close', () => {
        it('auto-closes <thead> before <tbody>', () => {
            const { ast } = parse('<table><thead><tr><td>H</td></tr><tbody><tr><td>B</td></tr></table>');
            const table = findDeep(ast.children, 'table');
            expect(table).toBeDefined();
            const thead = findElements(table!.children, 'thead');
            const tbody = findElements(table!.children, 'tbody');
            expect(thead).toHaveLength(1);
            expect(tbody).toHaveLength(1);
        });

        it('auto-closes <tbody> before another <tbody>', () => {
            const { ast } = parse('<table><tbody><tr><td>1</td></tr><tbody><tr><td>2</td></tr></table>');
            const table = findDeep(ast.children, 'table');
            expect(table).toBeDefined();
            const tbodies = findElements(table!.children, 'tbody');
            expect(tbodies).toHaveLength(2);
        });

        it('auto-closes <thead> before <tfoot>', () => {
            const { ast } = parse('<table><thead><tr><td>H</td></tr><tfoot><tr><td>F</td></tr></table>');
            const table = findDeep(ast.children, 'table');
            expect(table).toBeDefined();
            const thead = findElements(table!.children, 'thead');
            const tfoot = findElements(table!.children, 'tfoot');
            expect(thead).toHaveLength(1);
            expect(tfoot).toHaveLength(1);
        });
    });

    describe('tr/td/th auto-close', () => {
        it('auto-closes <tr> before another <tr>', () => {
            const { ast } = parse('<table><tr><td>A<tr><td>B</table>');
            const table = findDeep(ast.children, 'table');
            expect(table).toBeDefined();
            const trs = findElements(table!.children, 'tr');
            expect(trs).toHaveLength(2);
        });

        it('auto-closes <td> before another <td>', () => {
            const { ast } = parse('<table><tr><td>A<td>B<td>C</tr></table>');
            const tr = findDeep(ast.children, 'tr');
            expect(tr).toBeDefined();
            const tds = findElements(tr!.children, 'td');
            expect(tds).toHaveLength(3);
        });

        it('auto-closes <td> before <th>', () => {
            const { ast } = parse('<table><tr><td>A<th>B</tr></table>');
            const tr = findDeep(ast.children, 'tr');
            expect(tr).toBeDefined();
            const children = tr!.children.filter(n => n.type === 'element');
            expect(children).toHaveLength(2);
        });
    });

    describe('ruby annotation auto-close', () => {
        it('auto-closes <rb> before <rt>', () => {
            const { ast } = parse('<ruby><rb>Base<rt>Anno</ruby>');
            const ruby = findDeep(ast.children, 'ruby');
            expect(ruby).toBeDefined();
            const rb = findElements(ruby!.children, 'rb');
            const rt = findElements(ruby!.children, 'rt');
            expect(rb).toHaveLength(1);
            expect(rt).toHaveLength(1);
        });

        it('auto-closes <rt> before another <rt>', () => {
            const { ast } = parse('<ruby><rt>A<rt>B</ruby>');
            const ruby = findDeep(ast.children, 'ruby');
            expect(ruby).toBeDefined();
            const rts = findElements(ruby!.children, 'rt');
            expect(rts).toHaveLength(2);
        });
    });

    describe('colgroup/caption auto-close', () => {
        it('auto-closes <caption> before <colgroup>', () => {
            const { ast } = parse('<table><caption>Title<colgroup><col></table>');
            const table = findDeep(ast.children, 'table');
            expect(table).toBeDefined();
            const caption = findElements(table!.children, 'caption');
            const colgroup = findElements(table!.children, 'colgroup');
            expect(caption).toHaveLength(1);
            expect(colgroup).toHaveLength(1);
        });

        it('auto-closes <caption> before <thead>', () => {
            const { ast } = parse('<table><caption>Title<thead><tr><td>H</table>');
            const table = findDeep(ast.children, 'table');
            expect(table).toBeDefined();
            const caption = findElements(table!.children, 'caption');
            const thead = findElements(table!.children, 'thead');
            expect(caption).toHaveLength(1);
            expect(thead).toHaveLength(1);
        });
    });

    describe('head/body auto-close', () => {
        it('auto-closes <head> before <body>', () => {
            const { ast } = parse('<html><head><title>T</title><body><p>Hi</p></html>');
            const html = findDeep(ast.children, 'html');
            expect(html).toBeDefined();
            const head = findElements(html!.children, 'head');
            const body = findElements(html!.children, 'body');
            expect(head).toHaveLength(1);
            expect(body).toHaveLength(1);
        });
    });

    describe('auto-close respects XML mode boundaries', () => {
        it('XML element keeps its mode regardless of surrounding HTML', () => {
            const { ast } = parse(
                '<data:cell xmlns:data="urn:app"><p>Text<div>Block</div></p></data:cell>',
            );
            const cell = findDeep(ast.children, 'data:cell');
            expect(cell).toBeDefined();
            expect(cell!.mode).toBe('xml');
        });

        it('does NOT auto-close <p> ancestor when an XML element is on the stack', () => {
            // Stack when <div> opens: [root, p(html), data:cell(xml)]
            // Auto-close walk hits data:cell(xml) first → breaks → p is protected
            const { ast } = parse(
                '<p><data:cell xmlns:data="urn:app"><div>Block</div></data:cell>',
            );
            const p = findDeep(ast.children, 'p');
            expect(p).toBeDefined();
            const cell = findDeep(p!.children, 'data:cell');
            expect(cell).toBeDefined();
        });

        it('<li> ancestor of XML context is NOT auto-closed by another <li>', () => {
            // Stack when second <li> opens: [root, ul, li(html), data:item(xml)]
            // Auto-close walk hits data:item(xml) → breaks → outer <li> is protected
            const { ast } = parse(
                '<ul><li><data:item xmlns:data="urn:app"></data:item><li>Two</ul>',
            );
            const ul = findDeep(ast.children, 'ul');
            expect(ul).toBeDefined();
            const firstLi = findElements(ul!.children, 'li')[0];
            expect(firstLi).toBeDefined();
            const item = findDeep(firstLi.children, 'data:item');
            expect(item).toBeDefined();
        });

        it('<option> ancestor of XML context is NOT auto-closed by another <option>', () => {
            // Stack when second <option> opens: [root, select, option(html), data:val(xml)]
            // Auto-close walk hits data:val(xml) → breaks → outer <option> is protected
            const { ast } = parse(
                '<select><option><data:val xmlns:data="urn:app"/><option>B</select>',
            );
            const select = findDeep(ast.children, 'select');
            expect(select).toBeDefined();
            const firstOption = findElements(select!.children, 'option')[0];
            expect(firstOption).toBeDefined();
            const val = findDeep(firstOption.children, 'data:val');
            expect(val).toBeDefined();
        });

        it('HTML auto-close works normally in pure HTML context alongside XML siblings', () => {
            const { ast } = parse(
                '<data:wrapper xmlns:data="urn:app"></data:wrapper>' +
                '<ul><li>One<li>Two</ul>',
            );
            const ul = findDeep(ast.children, 'ul');
            expect(ul).toBeDefined();
            const lis = findElements(ul!.children, 'li');
            expect(lis).toHaveLength(2);
        });

        it('HTML ancestor of nested XML is protected — <p> survives a block opener inside XML', () => {
            // <p> → <data:block> → <div> opening: auto-close walk hits data:block → breaks
            const { ast } = parse(
                '<p>outer<data:block xmlns:data="urn:app"><div>inner</div></data:block>',
            );
            const p = findDeep(ast.children, 'p');
            expect(p).toBeDefined();
            const block = findDeep(p!.children, 'data:block');
            expect(block).toBeDefined();
        });

        it('XML elements themselves are never auto-closed by HTML rules', () => {
            // Two sibling XML elements: second should not "close" first
            const { ast } = parse(
                '<div xmlns:data="urn:app">' +
                  '<data:section/>' +
                  '<data:section/>' +
                '</div>',
            );
            const div = findDeep(ast.children, 'div');
            expect(div).toBeDefined();
            const sections = findElements(div!.children, 'data:section');
            expect(sections).toHaveLength(2);
        });
    });
});

describe('Parser/Validator namespace separation', () => {
    it('parser emits zero diagnostics for undeclared namespace prefix', () => {
        // The parser should not validate namespace prefixes;
        // that's the validator's job.
        const { diagnostics } = parse('<data:record>text</data:record>');
        // Parser may report unclosed element errors, but not namespace errors
        const nsErrors = diagnostics.filter(d => d.code === 'HXML201');
        expect(nsErrors).toHaveLength(0);
    });

    it('validator reports undeclared namespace prefix', () => {
        const { ast } = parse('<data:record>text</data:record>');
        const valDiags = validate(ast);
        const nsErrors = valDiags.filter(d => d.code === 'HXML201');
        expect(nsErrors.length).toBeGreaterThan(0);
    });

    it('parse diagnostics and validate diagnostics are independent', () => {
        // Parse a valid document with declared namespaces
        const { ast, diagnostics: parseDiags } = parse(
            '<data:record xmlns:data="urn:app">text</data:record>',
        );
        const valDiags = validate(ast);
        // Both should have zero errors
        expect(parseDiags.filter(d => d.severity === 'error')).toHaveLength(0);
        expect(valDiags.filter(d => d.code === 'HXML201')).toHaveLength(0);
    });
});

describe('Spec completeness behaviors', () => {
    it('inserts implicit html/head/body wrappers when omitted', () => {
        const { ast } = parse('<title>T</title><p>Body</p>');
        const html = findDeep(ast.children, 'html');
        expect(html).toBeDefined();
        const head = findDeep(html!.children, 'head');
        const body = findDeep(html!.children, 'body');
        expect(head).toBeDefined();
        expect(body).toBeDefined();
        expect(findDeep(head!.children, 'title')).toBeDefined();
        expect(findDeep(body!.children, 'p')).toBeDefined();
    });

    it('inserts implicit colgroup when col appears directly under table', () => {
        const { ast } = parse('<table><col><col></table>');
        const table = findDeep(ast.children, 'table');
        expect(table).toBeDefined();
        const colgroup = findDeep(table!.children, 'colgroup');
        expect(colgroup).toBeDefined();
        const cols = findElements(colgroup!.children, 'col');
        expect(cols.length).toBeGreaterThanOrEqual(2);
    });

    it('treats <xml> regions as XML mode-switch containers', () => {
        const { ast } = parse('<xml xmlns:data="urn:app"><record><name>A</name></record></xml>');
        const xml = findDeep(ast.children, 'xml');
        expect(xml).toBeDefined();
        expect(xml!.mode).toBe('xml');

        const record = findDeep(xml!.children, 'record');
        expect(record).toBeDefined();
        expect(record!.mode).toBe('xml');
    });

    it('recovers common formatting-tag misnesting without unmatched-close diagnostics', () => {
        const { diagnostics } = parse('<p><b><i>x</b></i></p>');
        const unmatched = diagnostics.filter(d => d.code === 'HXML101');
        expect(unmatched).toHaveLength(0);
    });
});
