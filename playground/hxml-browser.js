// src/utils/source-map.ts
var SourceTracker = class {
  constructor(source) {
    this.source = source;
    this.lineStarts = [0];
    for (let i = 0; i < source.length; i++) {
      if (source[i] === "\n") {
        this.lineStarts.push(i + 1);
      }
    }
  }
  /** Byte offsets where each line begins (index 0 = line 1). */
  lineStarts;
  /** Resolve an absolute byte offset to a SourcePosition. */
  positionAt(offset) {
    if (offset <= 0) return { line: 1, col: 0, offset: 0 };
    if (offset >= this.source.length) {
      offset = this.source.length;
    }
    let lo = 0;
    let hi = this.lineStarts.length - 1;
    while (lo < hi) {
      const mid = lo + hi + 1 >>> 1;
      if (this.lineStarts[mid] <= offset) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    return {
      line: lo + 1,
      // 1-indexed
      col: offset - this.lineStarts[lo],
      // 0-indexed
      offset
    };
  }
  /** Convenience: build a SourceRange from two offsets. */
  range(startOffset, endOffset) {
    return {
      start: this.positionAt(startOffset),
      end: this.positionAt(endOffset)
    };
  }
};

// src/constants.ts
var HTML_VOID_ELEMENTS = /* @__PURE__ */ new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
]);
var HTML_RAW_TEXT_ELEMENTS = /* @__PURE__ */ new Set([
  "script",
  "style",
  "textarea",
  "title"
]);
var HTML_AUTO_CLOSE_BEFORE = {
  p: /* @__PURE__ */ new Set([
    "address",
    "article",
    "aside",
    "blockquote",
    "details",
    "div",
    "dl",
    "fieldset",
    "figcaption",
    "figure",
    "footer",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "header",
    "hgroup",
    "hr",
    "main",
    "nav",
    "ol",
    "p",
    "pre",
    "section",
    "summary",
    "table",
    "ul"
  ]),
  li: /* @__PURE__ */ new Set(["li"]),
  dt: /* @__PURE__ */ new Set(["dt", "dd"]),
  dd: /* @__PURE__ */ new Set(["dt", "dd"]),
  td: /* @__PURE__ */ new Set(["td", "th"]),
  th: /* @__PURE__ */ new Set(["td", "th"]),
  tr: /* @__PURE__ */ new Set(["tr"]),
  option: /* @__PURE__ */ new Set(["option", "optgroup"]),
  optgroup: /* @__PURE__ */ new Set(["optgroup"]),
  rb: /* @__PURE__ */ new Set(["rb", "rt", "rtc", "rp"]),
  rt: /* @__PURE__ */ new Set(["rb", "rt", "rtc", "rp"]),
  rtc: /* @__PURE__ */ new Set(["rb", "rtc", "rp"]),
  rp: /* @__PURE__ */ new Set(["rb", "rt", "rtc", "rp"]),
  thead: /* @__PURE__ */ new Set(["tbody", "tfoot"]),
  tbody: /* @__PURE__ */ new Set(["tbody", "tfoot"]),
  tfoot: /* @__PURE__ */ new Set(["tbody"]),
  colgroup: /* @__PURE__ */ new Set(["colgroup"]),
  caption: /* @__PURE__ */ new Set(["caption", "colgroup", "thead", "tbody", "tfoot", "tr"]),
  head: /* @__PURE__ */ new Set(["body"])
};
var PREDECLARED_NAMESPACES = /* @__PURE__ */ new Map([
  ["xml", "http://www.w3.org/XML/1998/namespace"],
  ["xmlns", "http://www.w3.org/2000/xmlns/"]
]);
var HTML_INLINE_ELEMENTS = /* @__PURE__ */ new Set([
  "a",
  "abbr",
  "b",
  "bdi",
  "bdo",
  "br",
  "cite",
  "code",
  "data",
  "dfn",
  "em",
  "i",
  "kbd",
  "mark",
  "q",
  "rp",
  "rt",
  "ruby",
  "s",
  "samp",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "time",
  "u",
  "var",
  "wbr",
  "img",
  "input"
]);
var FOREIGN_CONTENT_NAMESPACES = {
  "http://www.w3.org/2000/svg": "svg",
  "http://www.w3.org/1998/Math/MathML": "math"
};

// src/utils/errors.ts
function makeError(code, message, loc, hint) {
  return { severity: "error", code, message, loc, hint };
}
function makeWarning(code, message, loc, hint) {
  return { severity: "warning", code, message, loc, hint };
}

// src/tokenizer.ts
var Tokenizer = class {
  pos = 0;
  src;
  tracker;
  diagnostics = [];
  constructor(source) {
    this.src = source;
    this.tracker = new SourceTracker(source);
  }
  // ── Helpers ──────────────────────────────────────────────────────────────
  eof() {
    return this.pos >= this.src.length;
  }
  peek(n = 0) {
    return this.src[this.pos + n] ?? "";
  }
  consume(n = 1) {
    const s = this.src.slice(this.pos, this.pos + n);
    this.pos += n;
    return s;
  }
  match(str) {
    return this.src.startsWith(str, this.pos);
  }
  matchCI(str) {
    if (this.pos + str.length > this.src.length) return false;
    for (let i = 0; i < str.length; i++) {
      const a = this.src.charCodeAt(this.pos + i);
      const b = str.charCodeAt(i);
      if (a === b) continue;
      const aLower = a | 32;
      const bLower = b | 32;
      if (aLower !== bLower || aLower < 97 || aLower > 122) return false;
    }
    return true;
  }
  skipWS() {
    while (!this.eof()) {
      const c = this.src.charCodeAt(this.pos);
      if (c !== 32 && c !== 9 && c !== 10 && c !== 13 && c !== 12) break;
      this.pos++;
    }
  }
  readUntil(terminator) {
    const i = this.src.indexOf(terminator, this.pos);
    if (i < 0) {
      const s2 = this.src.slice(this.pos);
      this.pos = this.src.length;
      return s2;
    }
    const s = this.src.slice(this.pos, i);
    this.pos = i + terminator.length;
    return s;
  }
  readWhile(fn) {
    const start = this.pos;
    while (!this.eof() && fn(this.src[this.pos])) {
      this.pos++;
    }
    return this.src.slice(start, this.pos);
  }
  // ── Attribute parsing ────────────────────────────────────────────────────
  readAttrValue() {
    const q = this.peek();
    if (q === '"' || q === "'") {
      const quoteStart = this.pos;
      this.pos++;
      const valStart = this.pos;
      while (!this.eof()) {
        const ch = this.src[this.pos];
        if (ch === q) {
          const val2 = this.src.slice(valStart, this.pos);
          this.pos++;
          return val2;
        }
        if (ch === "\n" || ch === "\r") {
          const val2 = this.src.slice(valStart, this.pos);
          this.diagnostics.push(makeError(
            "HXML002",
            `Unterminated attribute value (missing closing ${q})`,
            this.tracker.range(quoteStart, this.pos),
            "Add a closing quote to the attribute value"
          ));
          return val2;
        }
        this.pos++;
      }
      const val = this.src.slice(valStart, this.pos);
      this.diagnostics.push(makeError(
        "HXML002",
        `Unterminated attribute value (missing closing ${q})`,
        this.tracker.range(quoteStart, this.pos),
        "Add a closing quote to the attribute value"
      ));
      return val;
    }
    return this.readWhile((ch) => /[^\s>\/]/.test(ch));
  }
  readAttrs() {
    const attrs = [];
    while (!this.eof()) {
      this.skipWS();
      if (this.peek() === ">" || this.match("/>")) break;
      const attrStart = this.pos;
      const name = this.readWhile((ch) => /[^\s=>\/"']/.test(ch));
      if (!name) break;
      let value = null;
      this.skipWS();
      if (this.peek() === "=") {
        this.consume();
        this.skipWS();
        value = this.readAttrValue();
      }
      const attrEnd = this.pos;
      attrs.push({
        name,
        value,
        loc: this.tracker.range(attrStart, attrEnd)
      });
    }
    return attrs;
  }
  // ── Raw text mode ────────────────────────────────────────────────────────
  /**
   * After an open tag for a raw text element (script, style, textarea, title),
   * consume everything as a single TEXT token until the matching close tag.
   */
  readRawText(tagName) {
    const start = this.pos;
    const closeTag = `</${tagName.toLowerCase()}`;
    while (this.pos < this.src.length) {
      const ltIdx = this.src.indexOf("<", this.pos);
      if (ltIdx < 0) break;
      this.pos = ltIdx;
      if (this.pos + closeTag.length <= this.src.length && this.matchCI(closeTag)) {
        const afterTag = this.src[this.pos + closeTag.length];
        if (afterTag === ">" || afterTag === " " || afterTag === "	" || afterTag === "\n" || afterTag === "\r" || afterTag === void 0) {
          const text2 = this.src.slice(start, ltIdx);
          this.pos = ltIdx;
          if (text2) {
            return {
              type: "TEXT",
              value: text2,
              loc: this.tracker.range(start, ltIdx)
            };
          }
          return null;
        }
      }
      this.pos = ltIdx + 1;
    }
    this.pos = this.src.length;
    const text = this.src.slice(start);
    if (text) {
      return {
        type: "TEXT",
        value: text,
        loc: this.tracker.range(start, this.pos)
      };
    }
    return null;
  }
  // Pending token for raw-text-element content
  _pending = null;
  // ── Main tokenization ───────────────────────────────────────────────────
  nextToken() {
    if (this._pending) {
      const t = this._pending;
      this._pending = null;
      return t;
    }
    if (this.eof()) return null;
    const start = this.pos;
    if (this.match("<!--")) {
      this.consume(4);
      const value = this.readUntil("-->");
      return {
        type: "COMMENT",
        value,
        loc: this.tracker.range(start, this.pos)
      };
    }
    if (this.match("<![CDATA[")) {
      this.consume(9);
      const value = this.readUntil("]]>");
      return {
        type: "CDATA",
        value,
        loc: this.tracker.range(start, this.pos)
      };
    }
    if (this.match("<!") && this.matchCI("<!DOCTYPE")) {
      this.consume(9);
      this.skipWS();
      const value = this.readUntil(">").trim();
      return {
        type: "DOCTYPE",
        value,
        loc: this.tracker.range(start, this.pos)
      };
    }
    if (this.match("<!")) {
      this.consume(2);
      const body = this.readUntil(">");
      this.diagnostics.push(makeError(
        "HXML003",
        `Unrecognised markup declaration: "<!${body.trimEnd()}"`,
        this.tracker.range(start, this.pos),
        "Valid markup declarations are <!--comment-->, <![CDATA[...]]>, or <!DOCTYPE ...>"
      ));
      return {
        type: "TEXT",
        value: "",
        loc: this.tracker.range(start, this.pos)
      };
    }
    if (this.match("<?")) {
      this.consume(2);
      const raw = this.readUntil("?>").trim();
      const spaceIdx = raw.search(/\s/);
      const target = spaceIdx < 0 ? raw : raw.slice(0, spaceIdx);
      const data = spaceIdx < 0 ? "" : raw.slice(spaceIdx).trim();
      return {
        type: "PI",
        target,
        data,
        loc: this.tracker.range(start, this.pos)
      };
    }
    if (this.peek() === "<") {
      this.consume();
      if (this.peek() === "/") {
        this.consume();
        const name2 = this.readWhile((ch) => /[^\s>]/.test(ch));
        this.skipWS();
        if (this.peek() === ">") this.consume();
        return {
          type: "CLOSE_TAG",
          name: name2,
          loc: this.tracker.range(start, this.pos)
        };
      }
      const name = this.readWhile((ch) => /[^\s>\/<]/.test(ch));
      if (!name) {
        return {
          type: "TEXT",
          value: "<",
          loc: this.tracker.range(start, this.pos)
        };
      }
      const attrs = this.readAttrs();
      this.skipWS();
      const selfClosing = this.match("/>");
      if (selfClosing) {
        this.consume(2);
      } else if (this.peek() === ">") {
        this.consume();
      }
      const token = {
        type: "OPEN_TAG",
        name,
        attrs,
        selfClosing,
        loc: this.tracker.range(start, this.pos)
      };
      const lo = name.toLowerCase();
      if (!name.includes(":") && HTML_RAW_TEXT_ELEMENTS.has(lo)) {
        const rawToken = this.readRawText(name);
        if (rawToken) {
          this._pending = rawToken;
        }
      }
      return token;
    }
    const text = this.readWhile((ch) => ch !== "<");
    return {
      type: "TEXT",
      value: text,
      loc: this.tracker.range(start, this.pos)
    };
  }
  /** Tokenize the entire source into an array of tokens. */
  tokenize() {
    const tokens = [];
    let tok;
    while ((tok = this.nextToken()) !== null) {
      tokens.push(tok);
    }
    return tokens;
  }
};

// src/parser.ts
function isXmlName(name) {
  return name.includes(":");
}
function splitName(name) {
  const idx = name.indexOf(":");
  if (idx < 0) return { prefix: null, localName: name };
  return { prefix: name.slice(0, idx), localName: name.slice(idx + 1) };
}
function emptyRange() {
  const pos = { line: 1, col: 0, offset: 0 };
  return { start: pos, end: pos };
}
function parse(source, options) {
  const tokenizer = new Tokenizer(source);
  const tokens = tokenizer.tokenize();
  const diagnostics = [...tokenizer.diagnostics];
  const preserveWhitespace = options?.preserveWhitespace ?? false;
  const root = {
    type: "root",
    children: [],
    mode: "html",
    loc: emptyRange()
  };
  const stack = [{
    node: root,
    mode: "html",
    namespaces: new Map(PREDECLARED_NAMESPACES)
  }];
  const current = () => stack[stack.length - 1];
  function autoCloseBefore(openName) {
    const lo = openName.toLowerCase();
    let didClose = true;
    while (didClose) {
      didClose = false;
      for (let i = stack.length - 1; i > 0; i--) {
        const entry = stack[i];
        if (entry.node.type !== "element") continue;
        if (entry.mode === "xml") break;
        const stackName = entry.node.name.toLowerCase();
        const closeSet = HTML_AUTO_CLOSE_BEFORE[stackName];
        if (closeSet && closeSet.has(lo)) {
          stack.splice(i);
          didClose = true;
          break;
        }
      }
    }
  }
  for (const token of tokens) {
    switch (token.type) {
      case "TEXT": {
        const parentMode = current().mode;
        if (!preserveWhitespace && parentMode === "html" && !token.value.trim()) {
          continue;
        }
        const textNode = {
          type: "text",
          value: token.value,
          mode: parentMode,
          loc: token.loc
        };
        current().node.children.push(textNode);
        break;
      }
      case "COMMENT": {
        const commentNode = {
          type: "comment",
          value: token.value,
          mode: current().mode,
          loc: token.loc
        };
        current().node.children.push(commentNode);
        break;
      }
      case "CDATA": {
        const cdataNode = {
          type: "cdata",
          value: token.value,
          mode: current().mode,
          loc: token.loc
        };
        current().node.children.push(cdataNode);
        break;
      }
      case "PI": {
        const piNode = {
          type: "processingInstruction",
          target: token.target,
          data: token.data,
          mode: current().mode,
          loc: token.loc
        };
        current().node.children.push(piNode);
        break;
      }
      case "DOCTYPE": {
        const doctypeNode = {
          type: "doctype",
          value: token.value,
          mode: "html",
          loc: token.loc
        };
        root.children.push(doctypeNode);
        break;
      }
      case "OPEN_TAG": {
        const xmlMode = isXmlName(token.name);
        const mode = xmlMode ? "xml" : "html";
        const { prefix, localName } = splitName(token.name);
        if (xmlMode && localName.includes(":")) {
          diagnostics.push(makeError(
            "HXML104",
            `Tag name "${token.name}" contains more than one colon`,
            token.loc,
            "XML tag names may have at most one colon separating prefix and local name"
          ));
        }
        const nsDecls = /* @__PURE__ */ new Map();
        for (const attr of token.attrs) {
          if (attr.name.startsWith("xmlns:")) {
            const nsPrefix = attr.name.slice(6);
            nsDecls.set(nsPrefix, attr.value ?? "");
          } else if (attr.name === "xmlns") {
            nsDecls.set("#default", attr.value ?? "");
          }
        }
        if (!xmlMode) {
          autoCloseBefore(token.name);
        }
        const attrs = token.attrs.map((a) => ({
          name: a.name,
          value: a.value,
          loc: a.loc
        }));
        const lo = token.name.toLowerCase();
        const isVoid = !xmlMode && HTML_VOID_ELEMENTS.has(lo) || token.selfClosing;
        const element = {
          type: "element",
          name: token.name,
          prefix,
          localName,
          attrs,
          namespaces: nsDecls,
          selfClosing: token.selfClosing,
          isVoid,
          children: [],
          mode,
          loc: token.loc
        };
        current().node.children.push(element);
        if (!isVoid) {
          stack.push({
            node: element,
            mode,
            namespaces: nsDecls
          });
        }
        break;
      }
      case "CLOSE_TAG": {
        const xmlExpected = isXmlName(token.name);
        let found = -1;
        for (let i = stack.length - 1; i > 0; i--) {
          const entry = stack[i];
          if (entry.node.type !== "element") continue;
          const stackName = entry.node.name;
          if (xmlExpected) {
            if (stackName === token.name) {
              found = i;
              break;
            }
          } else {
            if (stackName.toLowerCase() === token.name.toLowerCase()) {
              found = i;
              break;
            }
          }
        }
        if (found < 0) {
          diagnostics.push(makeError(
            "HXML101",
            `Unmatched closing tag </${token.name}>`,
            token.loc
          ));
          continue;
        }
        if (found < stack.length - 1) {
          const unclosed = stack.slice(found + 1);
          for (const entry of unclosed) {
            if (entry.mode === "xml" && entry.node.type === "element") {
              diagnostics.push(makeError(
                "HXML102",
                `Unclosed XML element <${entry.node.name}> inside <${token.name}>`,
                entry.node.loc,
                `Add </${entry.node.name}> before </${token.name}>`
              ));
            }
          }
        }
        stack.splice(found);
        break;
      }
    }
  }
  for (let i = 1; i < stack.length; i++) {
    const entry = stack[i];
    if (entry.mode === "xml" && entry.node.type === "element") {
      diagnostics.push(makeError(
        "HXML103",
        `XML element <${entry.node.name}> was never closed`,
        entry.node.loc,
        `Add </${entry.node.name}>`
      ));
    }
  }
  if (tokens.length > 0) {
    root.loc = {
      start: tokens[0].loc.start,
      end: tokens[tokens.length - 1].loc.end
    };
  }
  return { ast: root, diagnostics };
}

// src/utils/vlq.ts
var BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function encodeVlqInt(value) {
  let vlq = value < 0 ? -value << 1 | 1 : value << 1;
  let result = "";
  do {
    let digit = vlq & 31;
    vlq >>>= 5;
    if (vlq > 0) digit |= 32;
    result += BASE64[digit];
  } while (vlq > 0);
  return result;
}
function encodeVlqSegment(values) {
  return values.map(encodeVlqInt).join("");
}

// src/utils/escape.ts
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(s) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function sanitizeComment(s) {
  return s.replace(/--/g, "- -");
}
function sanitizePI(s) {
  return s.replace(/\?>/g, "? >");
}

// src/emitter.ts
var SourceMapBuilder = class {
  segments = [];
  write(text, loc) {
    if (text) this.segments.push({ text, loc });
  }
  buildHtml() {
    return this.segments.map((s) => s.text).join("");
  }
  buildSourceMap(sourceFile, sourceContent) {
    let genLine = 0;
    let genCol = 0;
    let prevGenCol = 0;
    let prevSrcLine = 0;
    let prevSrcCol = 0;
    const lineGroups = [[]];
    for (const seg of this.segments) {
      if (seg.loc) {
        const srcLine = seg.loc.start.line - 1;
        const srcCol = seg.loc.start.col;
        const encoded = encodeVlqSegment([
          genCol - prevGenCol,
          0,
          // source index (always 0 — one source file)
          srcLine - prevSrcLine,
          srcCol - prevSrcCol
        ]);
        lineGroups[genLine].push(encoded);
        prevGenCol = genCol;
        prevSrcLine = srcLine;
        prevSrcCol = srcCol;
      }
      for (let i = 0; i < seg.text.length; i++) {
        if (seg.text[i] === "\n") {
          genLine++;
          genCol = 0;
          prevGenCol = 0;
          if (genLine >= lineGroups.length) lineGroups.push([]);
        } else {
          genCol++;
        }
      }
    }
    const mappings = lineGroups.map((g) => g.join(",")).join(";");
    const map = {
      version: 3,
      sources: [sourceFile],
      names: [],
      mappings
    };
    if (sourceContent !== void 0) {
      map["sourcesContent"] = [sourceContent];
    }
    return JSON.stringify(map);
  }
};
function mergeNs(parent, element) {
  if (element.namespaces.size === 0) return parent;
  const merged = new Map(parent);
  for (const [k, v] of element.namespaces) merged.set(k, v);
  return merged;
}
function emit(ast, options) {
  const mode = options?.mode ?? "custom-elements";
  const indent = options?.indent ?? "";
  const includeDoctype = options?.doctype ?? true;
  const wantSourceMap = options?.sourceMap ?? false;
  const rootNs = new Map(PREDECLARED_NAMESPACES);
  const smb = new SourceMapBuilder();
  for (const node of ast.children) {
    emitNode(node, mode, indent, 0, includeDoctype, false, rootNs, smb);
  }
  const html = smb.buildHtml();
  if (wantSourceMap) {
    const sourceFile = options?.sourceFile ?? "input.hxml";
    return { html, sourceMap: smb.buildSourceMap(sourceFile) };
  }
  return { html };
}
function emitNode(node, mode, indent, depth, includeDoctype, rawTextParent, nsCtx, smb) {
  switch (node.type) {
    case "text":
      smb.write(rawTextParent ? node.value : escapeHtml(node.value), node.loc);
      return;
    case "comment":
      smb.write(`<!--${sanitizeComment(node.value)}-->`, node.loc);
      return;
    case "cdata":
      smb.write(escapeHtml(node.value), node.loc);
      return;
    case "processingInstruction":
      if (node.target === "xml") return;
      smb.write(`<!--?${node.target}${node.data ? " " + sanitizePI(node.data) : ""}?-->`, node.loc);
      return;
    case "doctype":
      smb.write(includeDoctype ? "<!DOCTYPE html>\n" : "", node.loc);
      return;
    case "element":
      emitElement(node, mode, indent, depth, nsCtx, smb);
      return;
  }
}
function emitElement(element, mode, indent, depth, nsCtx, smb) {
  const childNs = mergeNs(nsCtx, element);
  if (element.mode === "xml") {
    emitXmlElement(element, mode, indent, depth, childNs, smb);
    return;
  }
  emitHtmlElement(element, mode, indent, depth, childNs, smb);
}
function emitHtmlElement(element, mode, indent, depth, nsCtx, smb) {
  const tagName = element.name.toLowerCase();
  const isRawText = HTML_RAW_TEXT_ELEMENTS.has(tagName);
  let openTag = `<${tagName}`;
  for (const attr of element.attrs) {
    if (attr.name.startsWith("xmlns:") || attr.name === "xmlns") continue;
    openTag += emitAttr(attr);
  }
  if (element.isVoid) {
    openTag += ">";
    smb.write(openTag, element.loc);
    return;
  }
  openTag += ">";
  smb.write(openTag, element.loc);
  emitChildren(element.children, mode, indent, depth, nsCtx, isRawText, smb);
  smb.write(`</${tagName}>`);
}
function emitXmlElement(element, emitMode, indent, depth, nsCtx, smb) {
  switch (emitMode) {
    case "custom-elements":
      emitAsCustomElement(element, emitMode, indent, depth, nsCtx, smb);
      return;
    case "data-attributes":
      emitAsDataAttributes(element, emitMode, indent, depth, nsCtx, smb);
      return;
    case "passthrough":
      emitAsPassthrough(element, emitMode, indent, depth, nsCtx, smb);
      return;
    case "strip":
      emitAsStripped(element, emitMode, indent, depth, nsCtx, smb);
      return;
  }
}
function emitAsCustomElement(element, emitMode, indent, depth, nsCtx, smb) {
  if (element.prefix) {
    const nsUri = nsCtx.get(element.prefix);
    if (nsUri && nsUri in FOREIGN_CONTENT_NAMESPACES) {
      emitAsForeignContent(element, emitMode, indent, depth, nsCtx, nsUri, smb);
      return;
    }
  }
  const customTag = element.prefix ? `${element.prefix}-${element.localName}` : element.localName;
  let openTag = `<${customTag}`;
  for (const attr of element.attrs) {
    if (attr.name.startsWith("xmlns:")) {
      const prefix = attr.name.slice(6);
      openTag += ` data-xmlns-${prefix}="${escapeAttr(attr.value ?? "")}"`;
    } else if (attr.name === "xmlns") {
      openTag += ` data-xmlns="${escapeAttr(attr.value ?? "")}"`;
    } else {
      openTag += emitAttr(attr);
    }
  }
  if (element.isVoid && element.children.length === 0) {
    openTag += `></${customTag}>`;
    smb.write(openTag, element.loc);
    return;
  }
  openTag += ">";
  smb.write(openTag, element.loc);
  emitChildren(element.children, emitMode, indent, depth, nsCtx, false, smb);
  smb.write(`</${customTag}>`);
}
function emitAsForeignContent(element, emitMode, indent, depth, nsCtx, nsUri, smb) {
  const tagName = element.localName;
  let openTag = `<${tagName}`;
  for (const attr of element.attrs) {
    if (attr.name.startsWith("xmlns:") || attr.name === "xmlns") continue;
    openTag += emitAttr(attr);
  }
  if (element.isVoid && element.children.length === 0) {
    openTag += "/>";
    smb.write(openTag, element.loc);
    return;
  }
  openTag += ">";
  smb.write(openTag, element.loc);
  emitChildren(element.children, emitMode, indent, depth, nsCtx, false, smb);
  smb.write(`</${tagName}>`);
}
function emitAsDataAttributes(element, emitMode, indent, depth, nsCtx, smb) {
  const wrapper = "div";
  let openTag = `<${wrapper} data-hxml-tag="${escapeAttr(element.name)}"`;
  for (const attr of element.attrs) {
    if (attr.name.startsWith("xmlns:") || attr.name === "xmlns") {
      const dataName = attr.name === "xmlns" ? "data-xmlns" : `data-xmlns-${attr.name.slice(6)}`;
      openTag += ` ${dataName}="${escapeAttr(attr.value ?? "")}"`;
    } else if (attr.value === null) {
      openTag += ` data-${attr.name}`;
    } else {
      openTag += ` data-${attr.name}="${escapeAttr(attr.value)}"`;
    }
  }
  openTag += ">";
  smb.write(openTag, element.loc);
  emitChildren(element.children, emitMode, indent, depth, nsCtx, false, smb);
  smb.write(`</${wrapper}>`);
}
function emitAsPassthrough(element, emitMode, indent, depth, nsCtx, smb) {
  let openTag = `<${element.name}`;
  for (const attr of element.attrs) {
    openTag += emitAttr(attr);
  }
  if (element.isVoid && element.children.length === 0) {
    openTag += "/>";
    smb.write(openTag, element.loc);
    return;
  }
  openTag += ">";
  smb.write(openTag, element.loc);
  emitChildren(element.children, emitMode, indent, depth, nsCtx, false, smb);
  smb.write(`</${element.name}>`);
}
function emitAsStripped(element, emitMode, indent, depth, nsCtx, smb) {
  emitChildren(element.children, emitMode, indent, depth, nsCtx, false, smb);
}
function emitChildren(children, mode, indent, depth, nsCtx, rawTextParent, smb) {
  if (rawTextParent || !indent) {
    for (const child of children) {
      emitNode(child, mode, indent, depth + 1, false, rawTextParent, nsCtx, smb);
    }
    return;
  }
  const hasBlockChild = children.some(
    (c) => c.type === "element" && !HTML_INLINE_ELEMENTS.has(c.name.toLowerCase())
  );
  if (!hasBlockChild) {
    for (const child of children) {
      emitNode(child, mode, indent, depth + 1, false, false, nsCtx, smb);
    }
    return;
  }
  const pad = indent.repeat(depth + 1);
  const closePad = indent.repeat(depth);
  for (const child of children) {
    if (child.type === "processingInstruction" && child.target === "xml") continue;
    if (child.type === "text") {
      const trimmed = child.value.trim();
      if (trimmed) {
        smb.write(`
${pad}`);
        smb.write(escapeHtml(trimmed), child.loc);
      }
    } else {
      smb.write(`
${pad}`);
      emitNode(child, mode, indent, depth + 1, false, false, nsCtx, smb);
    }
  }
  smb.write(`
${closePad}`);
}
function emitAttr(attr) {
  if (attr.value === null) {
    return ` ${attr.name}`;
  }
  return ` ${attr.name}="${escapeAttr(attr.value)}"`;
}

// src/validator.ts
function validate(ast) {
  const diagnostics = [];
  const scopeStack = [new Map(PREDECLARED_NAMESPACES)];
  walkChildren(ast.children, diagnostics, scopeStack, "html");
  return diagnostics;
}
function currentScope(stack) {
  return (prefix) => {
    for (let i = stack.length - 1; i >= 0; i--) {
      const uri = stack[i].get(prefix);
      if (uri !== void 0) return uri;
    }
    return null;
  };
}
function walkChildren(children, diagnostics, scopeStack, parentMode) {
  for (const node of children) {
    switch (node.type) {
      case "element":
        validateElement(node, diagnostics, scopeStack);
        break;
      case "cdata":
        if (parentMode === "html") {
          diagnostics.push(makeWarning(
            "HXML301",
            "CDATA section inside HTML-mode element",
            node.loc,
            "CDATA is only meaningful inside XML-mode elements"
          ));
        }
        break;
      case "doctype":
        if (node.value.toLowerCase() !== "html") {
          diagnostics.push(makeWarning(
            "HXML302",
            `Legacy DOCTYPE: "${node.value}"`,
            node.loc,
            "Use <!DOCTYPE html> for HXML documents"
          ));
        }
        break;
      // text, comment, pi — no validation needed
      default:
        break;
    }
  }
}
function validateElement(element, diagnostics, scopeStack) {
  scopeStack.push(element.namespaces);
  const resolve = currentScope(scopeStack);
  if (element.prefix) {
    const uri = resolve(element.prefix);
    if (!uri) {
      diagnostics.push(makeError(
        "HXML201",
        `Namespace prefix "${element.prefix}" is not declared on <${element.name}>`,
        element.loc,
        `Add xmlns:${element.prefix}="..." to this element or an ancestor`
      ));
    }
  }
  const seenNsDecls = /* @__PURE__ */ new Set();
  for (const attr of element.attrs) {
    let key = null;
    if (attr.name === "xmlns") {
      key = "#default";
    } else if (attr.name.startsWith("xmlns:")) {
      key = attr.name.slice(6);
    }
    if (!key) continue;
    if (seenNsDecls.has(key)) {
      diagnostics.push(makeError(
        "HXML205",
        `Duplicate namespace declaration for prefix "${key === "#default" ? "(default)" : key}" on <${element.name}>`,
        attr.loc,
        "Remove the duplicate xmlns declaration or keep only one value"
      ));
      continue;
    }
    seenNsDecls.add(key);
  }
  if (element.mode === "xml") {
    const seen = /* @__PURE__ */ new Set();
    for (const attr of element.attrs) {
      if (seen.has(attr.name)) {
        diagnostics.push(makeError(
          "HXML202",
          `Duplicate attribute "${attr.name}" on XML element <${element.name}>`,
          attr.loc,
          "Remove the duplicate attribute"
        ));
      }
      seen.add(attr.name);
    }
    for (const attr of element.attrs) {
      if (attr.value === null && !attr.name.startsWith("xmlns")) {
        diagnostics.push(makeError(
          "HXML203",
          `Attribute "${attr.name}" on XML element <${element.name}> must have a value`,
          attr.loc,
          `Use ${attr.name}="${attr.name}" for boolean attributes in XML mode`
        ));
      }
    }
  }
  for (const attr of element.attrs) {
    if (attr.name.includes(":") && !attr.name.startsWith("xmlns:") && !attr.name.startsWith("xml:")) {
      const attrPrefix = attr.name.split(":")[0];
      const uri = resolve(attrPrefix);
      if (!uri) {
        diagnostics.push(makeError(
          "HXML204",
          `Namespace prefix "${attrPrefix}" used in attribute "${attr.name}" is not declared`,
          attr.loc,
          `Add xmlns:${attrPrefix}="..." to this element or an ancestor`
        ));
      }
    }
  }
  walkChildren(element.children, diagnostics, scopeStack, element.mode);
  scopeStack.pop();
}

// src/converter.ts
function htmlToHxml(source, options) {
  const indent = options?.indent ?? "  ";
  const preserveWhitespace = options?.preserveWhitespace ?? false;
  const { ast } = parse(source, { preserveWhitespace: true });
  const hxml = serializeNodes(ast.children, indent, 0, preserveWhitespace);
  return { hxml };
}
function serializeNodes(nodes, indent, depth, preserveWS) {
  let out = "";
  for (const node of nodes) {
    out += serializeNode(node, indent, depth, preserveWS);
  }
  return out;
}
function serializeNode(node, indent, depth, preserveWS) {
  switch (node.type) {
    case "doctype":
      return `<!DOCTYPE html>
`;
    case "text":
      if (!preserveWS) {
        return node.value.replace(/\s+/g, " ");
      }
      return node.value;
    case "comment":
      return `<!--${node.value}-->`;
    case "cdata":
      return `<![CDATA[${node.value}]]>`;
    case "processingInstruction":
      return `<?${node.target}${node.data ? " " + node.data : ""}?>`;
    case "element":
      return serializeElement(node, indent, depth, preserveWS);
  }
}
function serializeElement(element, indent, depth, preserveWS) {
  const tagName = element.mode === "html" ? element.name.toLowerCase() : element.name;
  const pad = indent.repeat(depth);
  const childPad = indent.repeat(depth + 1);
  let openTag = `<${tagName}`;
  for (const attr of element.attrs) {
    openTag += attr.value === null ? ` ${attr.name}` : ` ${attr.name}="${escapeAttr(attr.value)}"`;
  }
  if (HTML_VOID_ELEMENTS.has(tagName) || element.isVoid) {
    return `${pad}${openTag}>`;
  }
  if (HTML_RAW_TEXT_ELEMENTS.has(tagName)) {
    const content = element.children.map((c) => c.type === "text" ? c.value : "").join("");
    return `${pad}${openTag}>${content}</${tagName}>`;
  }
  if (element.children.length === 0) {
    return `${pad}${openTag}></${tagName}>`;
  }
  const shouldIndent = !preserveWS && hasBlockContent(element.children);
  if (!shouldIndent) {
    const inner = serializeNodes(element.children, indent, depth + 1, preserveWS);
    return `${pad}${openTag}>${trimInline(inner)}</${tagName}>`;
  }
  let out = `${pad}${openTag}>
`;
  for (const child of element.children) {
    if (child.type === "text") {
      const raw = preserveWS ? child.value : child.value.replace(/\s+/g, " ");
      const v = raw.trim();
      if (v) out += `${childPad}${v}
`;
    } else if (child.type === "element") {
      out += serializeElement(child, indent, depth + 1, preserveWS) + "\n";
    } else {
      const chunk = serializeNode(child, indent, depth + 1, preserveWS).trim();
      if (chunk) out += `${childPad}${chunk}
`;
    }
  }
  out += `${pad}</${tagName}>`;
  return out;
}
function hasBlockContent(nodes) {
  for (const node of nodes) {
    if (node.type === "element" && !HTML_INLINE_ELEMENTS.has(node.name.toLowerCase())) return true;
    if (node.type === "text" && node.value.includes("\n")) return true;
  }
  return false;
}
function trimInline(s) {
  return s.replace(/^\s+/, "").replace(/\s+$/, "");
}

// src/index.ts
function parse2(source, options) {
  return parse(source, options);
}
function emit2(ast, options) {
  return emit(ast, options);
}
function validate2(ast) {
  return validate(ast);
}
function htmlToHxml2(source, options) {
  return htmlToHxml(source, options);
}
function format(source, options) {
  return htmlToHxml(source, options);
}
function compile(source, options) {
  const parseResult = parse(source, options?.parse);
  const diagnostics = [...parseResult.diagnostics];
  if (!options?.noValidate) {
    const validationDiags = validate(parseResult.ast);
    diagnostics.push(...validationDiags);
  }
  const emitResult = emit(parseResult.ast, options?.emit);
  return {
    html: emitResult.html,
    ast: parseResult.ast,
    diagnostics
  };
}
export {
  compile,
  emit2 as emit,
  format,
  htmlToHxml2 as htmlToHxml,
  parse2 as parse,
  validate2 as validate
};
//# sourceMappingURL=hxml-browser.js.map
