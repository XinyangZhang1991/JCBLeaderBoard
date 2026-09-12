// pdf-writer.js
// ---------------------------------------------------------------------------
// Self-contained, offline-capable HTML-to-PDF writer.
//
// Exposes a global `window.SimplePDF` with a single public entry point:
//
//     SimplePDF.fromHTML(htmlString, options) -> Blob (application/pdf)
//
// It parses a report HTML string into a sequence of text lines and simple
// blocks (headings, paragraphs, list items, tables rendered as text rows),
// lays them out on A4 pages with margins, wraps long lines, handles page
// breaks, and embeds the standard Helvetica base-14 font (no font embedding
// required). Styling cues supported: h1/h2/h3 sizes, bold via <strong>/<b>,
// and horizontal rules. All other tags are stripped to plain text.
//
// Pure ES5/ES6. No dependencies. No network access. Works from file://.
// ---------------------------------------------------------------------------
(function (global) {
  "use strict";

  // --- Page geometry (A4 in PDF points: 1pt = 1/72 inch) -------------------
  var PAGE_WIDTH = 595.28; // 210mm
  var PAGE_HEIGHT = 841.89; // 297mm
  var MARGIN_LEFT = 42.52; // 15mm
  var MARGIN_RIGHT = 42.52; // 15mm
  var MARGIN_TOP = 42.52; // 15mm
  var MARGIN_BOTTOM = 42.52; // 15mm

  var CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

  // --- Branding geometry ---------------------------------------------------
  // The header band occupies the top strip of every page; the footer strip
  // sits at the bottom. The content area is inset between them so text never
  // overlaps the branding.
  var HEADER_BAND_HEIGHT = 34; // filled JCB-yellow band
  var HEADER_TEXT_BASELINE = PAGE_HEIGHT - 22;
  var FOOTER_RULE_Y = MARGIN_BOTTOM + 14;
  var FOOTER_TEXT_BASELINE = MARGIN_BOTTOM + 4;

  var CONTENT_TOP = PAGE_HEIGHT - HEADER_BAND_HEIGHT - 14;
  var CONTENT_BOTTOM = FOOTER_RULE_Y + 12;

  // JCB brand colours (RGB 0-1).
  var JCB_YELLOW = [1, 0.796, 0];
  var JCB_BLACK = [0, 0, 0];
  var JCB_GREY = [0.35, 0.35, 0.35];
  var JCB_RULE = [0.85, 0.65, 0];

  // --- Font metrics (Helvetica / Helvetica-Bold, base-14) ------------------
  // Widths are in 1/1000 em units for the standard WinAnsi Helvetica metrics.
  // A compact table covering the printable ASCII range is sufficient for the
  // report content; unknown characters fall back to the average width.
  var HELVETICA_WIDTHS = {
    " ": 278,
    "!": 278,
    '"': 355,
    "#": 556,
    $: 556,
    "%": 889,
    "&": 667,
    "'": 191,
    "(": 333,
    ")": 333,
    "*": 389,
    "+": 584,
    ",": 278,
    "-": 333,
    ".": 278,
    "/": 278,
    0: 556,
    1: 556,
    2: 556,
    3: 556,
    4: 556,
    5: 556,
    6: 556,
    7: 556,
    8: 556,
    9: 556,
    ":": 278,
    ";": 278,
    "<": 584,
    "=": 584,
    ">": 584,
    "?": 556,
    "@": 1015,
    A: 667,
    B: 667,
    C: 722,
    D: 722,
    E: 667,
    F: 611,
    G: 778,
    H: 722,
    I: 278,
    J: 500,
    K: 667,
    L: 556,
    M: 833,
    N: 722,
    O: 778,
    P: 667,
    Q: 778,
    R: 722,
    S: 667,
    T: 611,
    U: 722,
    V: 667,
    W: 944,
    X: 667,
    Y: 667,
    Z: 611,
    "[": 278,
    "\\": 278,
    "]": 278,
    "^": 469,
    _: 556,
    "`": 333,
    a: 556,
    b: 556,
    c: 500,
    d: 556,
    e: 556,
    f: 278,
    g: 556,
    h: 556,
    i: 222,
    j: 222,
    k: 500,
    l: 222,
    m: 833,
    n: 556,
    o: 556,
    p: 556,
    q: 556,
    r: 333,
    s: 500,
    t: 278,
    u: 556,
    v: 500,
    w: 722,
    x: 500,
    y: 500,
    z: 500,
    "{": 334,
    "|": 260,
    "}": 334,
    "~": 584,
  };

  var HELVETICA_BOLD_WIDTHS = {
    " ": 278,
    "!": 333,
    '"': 474,
    "#": 556,
    $: 556,
    "%": 889,
    "&": 722,
    "'": 238,
    "(": 333,
    ")": 333,
    "*": 389,
    "+": 584,
    ",": 278,
    "-": 333,
    ".": 278,
    "/": 278,
    0: 556,
    1: 556,
    2: 556,
    3: 556,
    4: 556,
    5: 556,
    6: 556,
    7: 556,
    8: 556,
    9: 556,
    ":": 333,
    ";": 333,
    "<": 584,
    "=": 584,
    ">": 584,
    "?": 611,
    "@": 975,
    A: 722,
    B: 722,
    C: 722,
    D: 722,
    E: 667,
    F: 611,
    G: 778,
    H: 722,
    I: 278,
    J: 556,
    K: 722,
    L: 611,
    M: 833,
    N: 722,
    O: 778,
    P: 667,
    Q: 778,
    R: 722,
    S: 667,
    T: 611,
    U: 722,
    V: 667,
    W: 944,
    X: 667,
    Y: 667,
    Z: 611,
    "[": 333,
    "\\": 278,
    "]": 333,
    "^": 584,
    _: 556,
    "`": 333,
    a: 556,
    b: 611,
    c: 556,
    d: 611,
    e: 556,
    f: 333,
    g: 611,
    h: 611,
    i: 278,
    j: 278,
    k: 556,
    l: 278,
    m: 889,
    n: 611,
    o: 611,
    p: 611,
    q: 611,
    r: 389,
    s: 556,
    t: 333,
    u: 611,
    v: 556,
    w: 778,
    x: 556,
    y: 556,
    z: 500,
    "{": 389,
    "|": 280,
    "}": 389,
    "~": 584,
  };

  var DEFAULT_WIDTH = 556;

  function charWidth(ch, bold) {
    var table = bold ? HELVETICA_BOLD_WIDTHS : HELVETICA_WIDTHS;
    if (Object.prototype.hasOwnProperty.call(table, ch)) return table[ch];
    return DEFAULT_WIDTH;
  }

  // Measure a string in points at a given font size.
  function measureText(text, fontSize, bold) {
    var total = 0;
    for (var i = 0; i < text.length; i++) {
      total += charWidth(text.charAt(i), bold);
    }
    return (total / 1000) * fontSize;
  }

  // --- HTML entity decoding ------------------------------------------------
  var NAMED_ENTITIES = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    ndash: "-",
    mdash: "-",
    hellip: "...",
    copy: "(c)",
    reg: "(R)",
    trade: "(TM)",
    pound: "GBP",
    euro: "EUR",
    deg: "deg",
    times: "x",
    bull: "-",
    middot: "-",
    laquo: "<<",
    raquo: ">>",
    lsquo: "'",
    rsquo: "'",
    ldquo: '"',
    rdquo: '"',
    eacute: "e",
    egrave: "e",
    agrave: "a",
    ccedil: "c",
    uuml: "u",
    ouml: "o",
    auml: "a",
    szlig: "ss",
  };

  function decodeEntities(str) {
    if (!str) return "";
    return str.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, function (m, body) {
      if (body.charAt(0) === "#") {
        var code;
        if (body.charAt(1) === "x" || body.charAt(1) === "X") {
          code = parseInt(body.slice(2), 16);
        } else {
          code = parseInt(body.slice(1), 10);
        }
        if (!isNaN(code) && code > 0 && code < 65536) {
          try {
            return String.fromCharCode(code);
          } catch (e) {
            return "";
          }
        }
        return "";
      }
      var named = NAMED_ENTITIES[body.toLowerCase()];
      return named !== undefined ? named : m;
    });
  }

  // --- HTML parsing --------------------------------------------------------
  // We do not use a DOM. Instead we tokenise the HTML into block-level
  // elements and inline runs, tracking bold state and heading level.

  var BLOCK_TAGS = {
    p: 1,
    div: 1,
    h1: 1,
    h2: 1,
    h3: 1,
    h4: 1,
    h5: 1,
    h6: 1,
    li: 1,
    ul: 1,
    ol: 1,
    table: 1,
    tr: 1,
    td: 1,
    th: 1,
    section: 1,
    article: 1,
    header: 1,
    footer: 1,
    blockquote: 1,
    hr: 1,
    br: 1,
    body: 1,
    html: 1,
    head: 1,
    style: 1,
    script: 1,
    title: 1,
    meta: 1,
    link: 1,
    main: 1,
    nav: 1,
    aside: 1,
    figure: 1,
    figcaption: 1,
    dl: 1,
    dt: 1,
    dd: 1,
    pre: 1,
    form: 1,
    span: 0,
    strong: 0,
    b: 0,
    em: 0,
    i: 0,
    u: 0,
    a: 0,
    small: 0,
    code: 0,
    label: 0,
    font: 0,
    sup: 0,
    sub: 0,
    mark: 0,
    abbr: 0,
    cite: 0,
  };

  // Strip <style>...</style> and <script>...</script> and comments.
  function stripNonContent(html) {
    var out = html;
    out = out.replace(/<!--[\s\S]*?-->/g, " ");
    out = out.replace(/<style[\s\S]*?<\/style>/gi, " ");
    out = out.replace(/<script[\s\S]*?<\/script>/gi, " ");
    out = out.replace(/<head[\s\S]*?<\/head>/gi, " ");
    // A <title> appearing outside <head> must also be dropped, along with
    // any stray <meta>/<link> void elements and the document wrapper tags.
    out = out.replace(/<title[\s\S]*?<\/title>/gi, " ");
    out = out.replace(/<meta\b[^>]*>/gi, " ");
    out = out.replace(/<link\b[^>]*>/gi, " ");
    out = out.replace(/<\/?(?:html|body|head)\b[^>]*>/gi, " ");
    return out;
  }

  // Tokenise into an array of tokens: {type:'open'|'close'|'text'|'void'|
  // 'decl', tag, attrs, text}. The 'decl' type covers markup declarations such
  // as <!DOCTYPE html> and is ignored entirely by parseBlocks().
  function tokenise(html) {
    var tokens = [];
    var re = /<![^>]*>|<\/?([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^>]*?)?)\/?>|([^<]+)/g;
    var m;
    while ((m = re.exec(html)) !== null) {
      if (m[0].charAt(0) === "<" && m[0].charAt(1) === "!") {
        // Declaration (DOCTYPE, CDATA, etc.) - never visible text.
        tokens.push({ type: "decl", text: m[0] });
        continue;
      }
      if (m[3] !== undefined) {
        tokens.push({ type: "text", text: m[3] });
      } else {
        var tag = m[1].toLowerCase();
        var isClose = m[0].charAt(1) === "/";
        var selfClose = /\/>$/.test(m[0]);
        var isVoid =
          tag === "br" ||
          tag === "hr" ||
          tag === "img" ||
          tag === "meta" ||
          tag === "link" ||
          tag === "input" ||
          tag === "area" ||
          tag === "base" ||
          tag === "col" ||
          tag === "embed" ||
          tag === "source" ||
          tag === "track" ||
          tag === "wbr";
        if (isClose) {
          tokens.push({ type: "close", tag: tag });
        } else if (selfClose || isVoid) {
          tokens.push({ type: "void", tag: tag, attrs: m[2] || "" });
        } else {
          tokens.push({ type: "open", tag: tag, attrs: m[2] || "" });
        }
      }
    }
    return tokens;
  }

  // A parsed block: { kind, text, bold, level, indent, isRule, pageBreak }
  // kind: 'heading' | 'paragraph' | 'listitem' | 'tablerow' | 'rule' | 'spacer'
  function parseBlocks(html) {
    var clean = stripNonContent(html);
    var tokens = tokenise(clean);
    var blocks = [];

    var boldDepth = 0;
    var headingLevel = 0;
    var inList = 0;
    var listItemDepth = 0;
    var inTable = 0;
    var inCell = 0;
    var cellTexts = [];
    var cellBold = [];
    var currentText = "";
    var currentBold = false;
    // Indices into `blocks` at which page breaks were requested. Each entry is
    // captured when a break is detected so the flag lands on the NEXT block
    // emitted after that break, not on an earlier block already in the array.
    var pendingPageBreakIndices = [];

    function flushParagraph() {
      var text = normaliseWhitespace(currentText);
      if (text) {
        blocks.push({
          kind: headingLevel ? "heading" : "paragraph",
          text: text,
          bold: headingLevel ? true : currentBold,
          level: headingLevel,
          indent: inList ? 14 : 0,
        });
      }
      currentText = "";
      currentBold = false;
    }

    function flushCell() {
      cellTexts.push(normaliseWhitespace(currentText));
      cellBold.push(currentBold);
      currentText = "";
      currentBold = false;
    }

    function flushRow() {
      if (cellTexts.length) {
        blocks.push({
          kind: "tablerow",
          cells: cellTexts.slice(),
          cellBold: cellBold.slice(),
          indent: 0,
        });
      }
      cellTexts = [];
      cellBold = [];
    }

    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (t.type === "decl") {
        // Markup declarations (e.g. <!DOCTYPE html>) are never visible.
        continue;
      }
      if (t.type === "text") {
        currentText += t.text;
        continue;
      }

      var tag = t.tag;

      if (t.type === "void") {
        if (tag === "br") {
          currentText += "\n";
        } else if (tag === "hr") {
          flushParagraph();
          blocks.push({ kind: "rule" });
        }
        continue;
      }

      if (t.type === "open") {
        // Detect an explicit page-break-before style on any element.
        if (
          /page-break-before\s*:\s*always/i.test(t.attrs) ||
          /break-before\s*:\s*page/i.test(t.attrs)
        ) {
          flushParagraph();
          // Record each break so multiple page-break-before elements each
          // produce their own page boundary (a single flag would collapse them).
          pendingPageBreakIndices.push(blocks.length);
        }

        if (tag === "strong" || tag === "b") {
          boldDepth++;
          currentBold = true;
        } else if (
          tag === "h1" ||
          tag === "h2" ||
          tag === "h3" ||
          tag === "h4" ||
          tag === "h5" ||
          tag === "h6"
        ) {
          flushParagraph();
          headingLevel = parseInt(tag.charAt(1), 10);
          currentBold = true;
        } else if (tag === "ul" || tag === "ol") {
          flushParagraph();
          inList++;
        } else if (tag === "li") {
          flushParagraph();
          listItemDepth++;
        } else if (tag === "table") {
          flushParagraph();
          inTable++;
        } else if (tag === "tr") {
          flushRow();
        } else if (tag === "td" || tag === "th") {
          flushCell();
          inCell++;
          if (tag === "th") {
            boldDepth++;
            currentBold = true;
          }
        } else if (
          tag === "p" ||
          tag === "div" ||
          tag === "section" ||
          tag === "article" ||
          tag === "header" ||
          tag === "footer" ||
          tag === "blockquote" ||
          tag === "pre" ||
          tag === "figure" ||
          tag === "figcaption" ||
          tag === "dd" ||
          tag === "dt"
        ) {
          flushParagraph();
        }
        continue;
      }

      // t.type === 'close'
      if (tag === "strong" || tag === "b") {
        boldDepth = Math.max(0, boldDepth - 1);
        currentBold = boldDepth > 0;
      } else if (
        tag === "h1" ||
        tag === "h2" ||
        tag === "h3" ||
        tag === "h4" ||
        tag === "h5" ||
        tag === "h6"
      ) {
        flushParagraph();
        headingLevel = 0;
        currentBold = boldDepth > 0;
      } else if (tag === "ul" || tag === "ol") {
        flushParagraph();
        inList = Math.max(0, inList - 1);
      } else if (tag === "li") {
        flushParagraph();
        listItemDepth = Math.max(0, listItemDepth - 1);
      } else if (tag === "td" || tag === "th") {
        flushCell();
        inCell = Math.max(0, inCell - 1);
        if (tag === "th") {
          boldDepth = Math.max(0, boldDepth - 1);
          currentBold = boldDepth > 0;
        }
      } else if (tag === "tr") {
        flushRow();
      } else if (tag === "table") {
        flushRow();
        inTable = Math.max(0, inTable - 1);
      } else if (
        tag === "p" ||
        tag === "div" ||
        tag === "section" ||
        tag === "article" ||
        tag === "header" ||
        tag === "footer" ||
        tag === "blockquote" ||
        tag === "pre" ||
        tag === "figure" ||
        tag === "figcaption" ||
        tag === "dd" ||
        tag === "dt"
      ) {
        flushParagraph();
      }
    }
    flushParagraph();
    flushRow();

    // Apply pending page breaks. Each recorded index marks the position at
    // which a break was requested; we flag the next real block after it (or
    // append a spacer if none follows). Processing from the end backwards
    // keeps the recorded indices valid as we splice.
    for (var pb = pendingPageBreakIndices.length - 1; pb >= 0; pb--) {
      var startAt = pendingPageBreakIndices[pb];
      var target = -1;
      for (var b = startAt; b < blocks.length; b++) {
        if (blocks[b].kind !== "spacer") {
          target = b;
          break;
        }
      }
      if (target >= 0) {
        blocks[target].pageBreak = true;
      } else {
        blocks.push({ kind: "spacer", pageBreak: true });
      }
    }

    // Defensive post-pass: drop any text block that still looks like leaked
    // markup (a stray DOCTYPE, wrapper tag, or anything beginning with "<!").
    var MARKUP_RE = /^<!?\/?(doctype|html|head|body|title|meta|link)\b/i;
    var filtered = [];
    for (var f = 0; f < blocks.length; f++) {
      var blk = blocks[f];
      if (blk && typeof blk.text === "string") {
        var trimmed = blk.text.replace(/^\s+|\s+$/g, "");
        if (MARKUP_RE.test(trimmed) || trimmed.indexOf("<!") === 0) {
          continue;
        }
      }
      filtered.push(blk);
    }

    return filtered;
  }

  function normaliseWhitespace(str) {
    if (!str) return "";
    var decoded = decodeEntities(str);
    // Collapse runs of spaces/tabs but preserve explicit newlines as spaces
    // (line wrapping is handled by the layout engine).
    decoded = decoded.replace(/[ \t\r\f\v]+/g, " ");
    decoded = decoded.replace(/\n+/g, " ");
    return decoded.replace(/^\s+|\s+$/g, "");
  }

  // --- Layout engine -------------------------------------------------------
  // Produces an array of pages; each page is an array of draw ops:
  //   { type:'text', x, y, size, bold, text }
  //   { type:'line', x1, y1, x2, y2, width }

  function styleForBlock(block) {
    switch (block.kind) {
      case "heading":
        if (block.level === 1)
          return {
            size: 20,
            bold: true,
            spaceBefore: 14,
            spaceAfter: 8,
            leading: 24,
            rule: true,
            ruleWidth: 1.5,
          };
        if (block.level === 2)
          return {
            size: 15,
            bold: true,
            spaceBefore: 12,
            spaceAfter: 6,
            leading: 19,
            rule: true,
            ruleWidth: 1,
          };
        if (block.level === 3)
          return {
            size: 12.5,
            bold: true,
            spaceBefore: 10,
            spaceAfter: 5,
            leading: 16,
          };
        return {
          size: 11.5,
          bold: true,
          spaceBefore: 9,
          spaceAfter: 4,
          leading: 15,
        };
      case "paragraph":
        return {
          size: 10.5,
          bold: !!block.bold,
          spaceBefore: 4,
          spaceAfter: 6,
          leading: 14,
        };
      case "listitem":
        return {
          size: 10.5,
          bold: !!block.bold,
          spaceBefore: 2,
          spaceAfter: 3,
          leading: 14,
        };
      case "tablerow":
        return {
          size: 9.5,
          bold: false,
          spaceBefore: 2,
          spaceAfter: 2,
          leading: 12,
        };
      case "rule":
        return {
          size: 0,
          bold: false,
          spaceBefore: 8,
          spaceAfter: 8,
          leading: 0,
        };
      default:
        return {
          size: 10.5,
          bold: false,
          spaceBefore: 4,
          spaceAfter: 6,
          leading: 14,
        };
    }
  }

  // Wrap a single string into lines that fit maxWidth at the given font size.
  function wrapText(text, maxWidth, fontSize, bold) {
    var words = text.split(/\s+/);
    var lines = [];
    var current = "";
    for (var i = 0; i < words.length; i++) {
      var word = words[i];
      if (!word) continue;
      var candidate = current ? current + " " + word : word;
      if (measureText(candidate, fontSize, bold) <= maxWidth || !current) {
        // If a single word is wider than the line, hard-break it.
        if (!current && measureText(word, fontSize, bold) > maxWidth) {
          var pieces = hardBreak(word, maxWidth, fontSize, bold);
          for (var p = 0; p < pieces.length - 1; p++) lines.push(pieces[p]);
          current = pieces[pieces.length - 1];
        } else {
          current = candidate;
        }
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [""];
  }

  function hardBreak(word, maxWidth, fontSize, bold) {
    var pieces = [];
    var current = "";
    for (var i = 0; i < word.length; i++) {
      var ch = word.charAt(i);
      if (measureText(current + ch, fontSize, bold) > maxWidth && current) {
        pieces.push(current);
        current = ch;
      } else {
        current += ch;
      }
    }
    if (current) pieces.push(current);
    return pieces.length ? pieces : [""];
  }

  function layout(blocks, options) {
    var opts = options || {};
    var pages = [];
    var ops = [];
    var y = CONTENT_TOP;

    function newPage() {
      pages.push(ops);
      ops = [];
      y = CONTENT_TOP;
    }

    function ensureSpace(height) {
      if (y - height < CONTENT_BOTTOM) {
        newPage();
      }
    }

    for (var i = 0; i < blocks.length; i++) {
      var block = blocks[i];

      if (block.pageBreak && ops.length > 0) {
        newPage();
      }

      if (block.kind === "spacer") {
        continue;
      }

      var style = styleForBlock(block);

      if (block.kind === "rule") {
        ensureSpace(style.spaceBefore + style.spaceAfter + 1);
        y -= style.spaceBefore;
        ops.push({
          type: "line",
          x1: MARGIN_LEFT,
          y1: y,
          x2: MARGIN_LEFT + CONTENT_WIDTH,
          y2: y,
          width: 0.75,
        });
        y -= style.spaceAfter;
        continue;
      }

      if (block.kind === "tablerow") {
        layoutTableRow(
          block,
          style,
          ops,
          ensureSpace,
          function () {
            return y;
          },
          function (ny) {
            y = ny;
          },
        );
        continue;
      }

      // Text blocks (heading / paragraph / listitem).
      var indent = block.indent || 0;
      var bullet = block.kind === "listitem" ? "\u2022  " : "";
      var available = CONTENT_WIDTH - indent;
      var text = bullet + block.text;
      var lines = wrapText(text, available, style.size, style.bold);

      y -= style.spaceBefore;
      for (var l = 0; l < lines.length; l++) {
        ensureSpace(style.leading);
        var lineText = lines[l];
        // Continuation lines of a bullet are indented to align under the text.
        var lineIndent = indent;
        if (block.kind === "listitem" && l > 0) {
          lineIndent = indent + measureText(bullet, style.size, style.bold);
        }
        ops.push({
          type: "text",
          x: MARGIN_LEFT + lineIndent,
          y: y,
          size: style.size,
          bold: style.bold,
          text: lineText,
        });
        y -= style.leading;
      }

      // Coloured underline rule beneath h1/h2 headings.
      if (style.rule) {
        ensureSpace(style.ruleWidth + 4);
        y -= 2;
        ops.push({
          type: "rect",
          x: MARGIN_LEFT,
          y: y,
          w: CONTENT_WIDTH,
          h: style.ruleWidth,
          colour: JCB_RULE,
        });
        y -= style.ruleWidth + 2;
      }

      y -= style.spaceAfter;
    }

    if (ops.length > 0 || pages.length === 0) {
      pages.push(ops);
    }

    // Page-assembly hook: stamp the branded header band and footer (with
    // "Page N of M") onto every page after layout is complete.
    var title = opts.title || "JCB Leadership Report";
    var subtitle = opts.subtitle || "";
    var total = pages.length;
    for (var pg = 0; pg < pages.length; pg++) {
      decoratePage(pages[pg], pg + 1, total, title, subtitle);
    }

    return pages;
  }

  // Prepend the header band and append the footer to a page's op list.
  function decoratePage(pageOps, pageNumber, totalPages, title, subtitle) {
    var header = [];

    // Header band: filled JCB-yellow rectangle across the top.
    header.push({
      type: "rect",
      x: 0,
      y: PAGE_HEIGHT - HEADER_BAND_HEIGHT,
      w: PAGE_WIDTH,
      h: HEADER_BAND_HEIGHT,
      colour: JCB_YELLOW,
    });

    // Report title in black bold inside the band.
    header.push({
      type: "text",
      x: MARGIN_LEFT,
      y: HEADER_TEXT_BASELINE,
      size: 13,
      bold: true,
      text: title,
      colour: JCB_BLACK,
    });

    // Optional subtitle, right-aligned in the band.
    if (subtitle) {
      var subWidth = measureText(subtitle, 9, false);
      header.push({
        type: "text",
        x: PAGE_WIDTH - MARGIN_RIGHT - subWidth,
        y: HEADER_TEXT_BASELINE,
        size: 9,
        bold: false,
        text: subtitle,
        colour: JCB_BLACK,
      });
    }

    // Footer: thin rule plus title (left) and "Page N of M" (right).
    var footer = [];
    footer.push({
      type: "line",
      x1: MARGIN_LEFT,
      y1: FOOTER_RULE_Y,
      x2: MARGIN_LEFT + CONTENT_WIDTH,
      y2: FOOTER_RULE_Y,
      width: 0.5,
      colour: JCB_GREY,
    });
    footer.push({
      type: "text",
      x: MARGIN_LEFT,
      y: FOOTER_TEXT_BASELINE,
      size: 8,
      bold: false,
      text: title,
      colour: JCB_GREY,
    });
    var pageLabel = "Page " + pageNumber + " of " + totalPages;
    var labelWidth = measureText(pageLabel, 8, false);
    footer.push({
      type: "text",
      x: PAGE_WIDTH - MARGIN_RIGHT - labelWidth,
      y: FOOTER_TEXT_BASELINE,
      size: 8,
      bold: false,
      text: pageLabel,
      colour: JCB_GREY,
    });

    // Mutate in place: header ops first, then content, then footer ops.
    var combined = header.concat(pageOps, footer);
    pageOps.length = 0;
    for (var i = 0; i < combined.length; i++) pageOps.push(combined[i]);
  }

  function layoutTableRow(block, style, ops, ensureSpace, getY, setY) {
    var cells = block.cells || [];
    var colCount = cells.length || 1;
    var colWidth = CONTENT_WIDTH / colCount;
    var cellPadding = 4;

    // Wrap each cell to its column width.
    var wrapped = [];
    var maxLines = 1;
    for (var c = 0; c < cells.length; c++) {
      var bold = !!(block.cellBold && block.cellBold[c]);
      var lines = wrapText(
        cells[c],
        colWidth - cellPadding * 2,
        style.size,
        bold,
      );
      wrapped.push({ lines: lines, bold: bold });
      if (lines.length > maxLines) maxLines = lines.length;
    }

    var rowHeight = maxLines * style.leading + cellPadding;
    ensureSpace(rowHeight + style.spaceBefore);

    var y = getY();
    y -= style.spaceBefore;
    var rowTop = y;

    for (var ci = 0; ci < wrapped.length; ci++) {
      var x = MARGIN_LEFT + ci * colWidth + cellPadding;
      var cellY = rowTop - style.leading + 2;
      for (var li = 0; li < wrapped[ci].lines.length; li++) {
        ops.push({
          type: "text",
          x: x,
          y: cellY,
          size: style.size,
          bold: wrapped[ci].bold,
          text: wrapped[ci].lines[li],
        });
        cellY -= style.leading;
      }
    }

    // Light row separator.
    var sepY = rowTop - rowHeight + 2;
    ops.push({
      type: "line",
      x1: MARGIN_LEFT,
      y1: sepY,
      x2: MARGIN_LEFT + CONTENT_WIDTH,
      y2: sepY,
      width: 0.4,
    });

    setY(rowTop - rowHeight - style.spaceAfter);
  }

  // --- PDF serialisation ---------------------------------------------------

  // Characters in the 0x80-0x9F range that WinAnsiEncoding maps to printable
  // glyphs (the CP1252 "smart punctuation" block). Everything else in that
  // range is a control code and is not representable.
  var WINANSI_HIGH = {
    0x20ac: 0x80, // euro
    0x201a: 0x82, // single low quote
    0x0192: 0x83, // florin
    0x201e: 0x84, // double low quote
    0x2026: 0x85, // ellipsis
    0x2020: 0x86, // dagger
    0x2021: 0x87, // double dagger
    0x02c6: 0x88, // circumflex
    0x2030: 0x89, // per mille
    0x0160: 0x8a, // S caron
    0x2039: 0x8b, // single left angle quote
    0x0152: 0x8c, // OE
    0x017d: 0x8e, // Z caron
    0x2018: 0x91, // left single quote
    0x2019: 0x92, // right single quote
    0x201c: 0x93, // left double quote
    0x201d: 0x94, // right double quote
    0x2022: 0x95, // bullet
    0x2013: 0x96, // en dash
    0x2014: 0x97, // em dash
    0x02dc: 0x98, // small tilde
    0x2122: 0x99, // trademark
    0x0161: 0x9a, // s caron
    0x203a: 0x9b, // single right angle quote
    0x0153: 0x9c, // oe
    0x017e: 0x9e, // z caron
    0x0178: 0x9f, // Y diaeresis
  };

  // Non-representable characters mapped to a sensible ASCII equivalent.
  var ASCII_EQUIV = {
    0x2192: "->", // right arrow
    0x2190: "<-", // left arrow
    0x2191: "^", // up arrow
    0x2193: "v", // down arrow
    0x2b07: "v", // down arrow (emoji)
    0x2b06: "^", // up arrow (emoji)
    0x27a1: "->", // black right arrow
    0x2b05: "<-", // black left arrow
    0x26a0: "!", // warning sign
    0x2757: "!", // exclamation mark
    0x2705: "[OK]", // white heavy check mark
    0x2714: "[OK]", // heavy check mark
    0x274c: "[X]", // cross mark
    0x2716: "[X]", // heavy multiplication x
    0x1f4cb: "[ ]", // clipboard
    0x1f4ca: "[chart]", // bar chart
    0x1f4c8: "[chart]", // chart increasing
    0x1f3af: "[target]", // direct hit
    0x1f465: "[team]", // busts in silhouette
    0x1f3e2: "[org]", // office building
    0x1f50d: "[search]", // magnifying glass
    0x1f4a1: "[idea]", // light bulb
    0x1f4dd: "[note]", // memo
    0x1f4c4: "[doc]", // page facing up
    0x1f4c1: "[dir]", // file folder
    0x1f512: "[lock]", // lock
    0x1f513: "[unlock]", // open lock
    0x1f680: "[go]", // rocket
    0x1f4c9: "[chart]", // chart decreasing
    0x1f4cc: "[pin]", // pushpin
    0x1f517: "[link]", // link
    0x1f6a8: "[!]", // rotating light
    0x1f6d1: "[stop]", // stop sign
    0x1f504: "[sync]", // refresh
    0x1f4a5: "[!]", // collision
    0x1f4ac: "[chat]", // speech balloon
    0x1f4bc: "[case]", // briefcase
    0x1f4b0: "[$]", // money bag
    0x1f4b8: "[$]", // money with wings
    0x1f4b9: "[chart]", // chart with upwards trend
    0x1f4aa: "[+]", // flexed biceps
    0x1f44d: "[+]", // thumbs up
    0x1f44e: "[-]", // thumbs down
    0x1f525: "[!]", // fire
    0x1f389: "[*]", // party popper
    0x1f3c6: "[trophy]", // trophy
    0x1f947: "[1st]", // first place medal
    0x1f948: "[2nd]", // second place medal
    0x1f949: "[3rd]", // third place medal
    0x1f4af: "[100]", // hundred points
    0x1f4c6: "[cal]", // calendar
    0x1f4c5: "[cal]", // calendar
    0x23f0: "[time]", // alarm clock
    0x23f3: "[time]", // hourglass
    0x1f550: "[time]", // one o'clock
    0x1f551: "[time]", // two o'clock
    0x1f552: "[time]", // three o'clock
    0x1f553: "[time]", // four o'clock
    0x1f554: "[time]", // five o'clock
    0x1f555: "[time]", // six o'clock
    0x1f556: "[time]", // seven o'clock
    0x1f557: "[time]", // eight o'clock
    0x1f558: "[time]", // nine o'clock
    0x1f559: "[time]", // ten o'clock
    0x1f55a: "[time]", // eleven o'clock
    0x1f55b: "[time]", // twelve o'clock
    0x1f4e3: "[announce]", // megaphone
    0x1f4e2: "[announce]", // loudspeaker
    0x1f4e8: "[mail]", // incoming envelope
    0x2709: "[mail]", // envelope
    0x1f4e7: "[mail]", // e-mail
    0x1f4f1: "[phone]", // mobile phone
    0x260e: "[phone]", // telephone
    0x1f4bb: "[pc]", // laptop
    0x1f5a5: "[pc]", // desktop computer
    0x1f4be: "[disk]", // floppy disk
    0x1f4bf: "[disk]", // optical disk
    0x1f4c0: "[disk]", // dvd
    0x1f4f7: "[photo]", // camera
    0x1f3a5: "[video]", // movie camera
    0x1f3ac: "[video]", // clapper board
    0x1f50a: "[audio]", // speaker high volume
    0x1f507: "[mute]", // speaker mute
    0x1f4a4: "[zzz]", // sleeping
    0x1f634: "[zzz]", // sleeping face
    0x1f44b: "[hi]", // waving hand
    0x1f64f: "[thanks]", // folded hands
    0x1f4a3: "[!]", // bomb
    0x1f4a2: "[!]", // anger symbol
    0x1f4a8: "[!]", // dash symbol
    0x1f4ab: "[!]", // dizzy symbol
    0x1f4a6: "[!]", // sweat droplets
    0x1f4a7: "[!]", // droplet
    0x1f4a9: "[!]", // pile of poo
    0x1f440: "[eyes]", // eyes
    0x1f441: "[eye]", // eye
    0x1f5e3: "[speech]", // speaking head
    0x1f4ad: "[thought]", // thought balloon
    0x1f4a2: "[!]", // anger
    0x1f4a3: "[!]", // bomb
    0x1f4a5: "[!]", // collision
    0x1f4a6: "[!]", // sweat
    0x1f4a8: "[!]", // dash
    0x1f4ab: "[!]", // dizzy
    0x1f4ac: "[chat]", // speech balloon
    0x1f4ae: "[note]", // thought balloon
    0x1f4af: "[100]", // hundred points
    0x1f4b0: "[$]", // money bag
    0x1f4b1: "[$]", // currency exchange
    0x1f4b2: "[$]", // heavy dollar sign
    0x1f4b3: "[card]", // credit card
    0x1f4b4: "[yen]", // yen banknote
    0x1f4b5: "[$]", // dollar banknote
    0x1f4b6: "[eur]", // euro banknote
    0x1f4b7: "[gbp]", // pound banknote
    0x1f4b8: "[$]", // money with wings
    0x1f4b9: "[chart]", // chart with upwards trend
    0x1f4ba: "[seat]", // seat
    0x1f4bb: "[pc]", // laptop
    0x1f4bc: "[case]", // briefcase
    0x1f4bd: "[disk]", // minidisc
    0x1f4be: "[disk]", // floppy disk
    0x1f4bf: "[disk]", // optical disk
    0x1f4c0: "[disk]", // dvd
    0x1f4c1: "[dir]", // file folder
    0x1f4c2: "[dir]", // open file folder
    0x1f4c3: "[doc]", // page with curl
    0x1f4c4: "[doc]", // page facing up
    0x1f4c5: "[cal]", // calendar
    0x1f4c6: "[cal]", // tear-off calendar
    0x1f4c7: "[card]", // card index
    0x1f4c8: "[chart]", // chart increasing
    0x1f4c9: "[chart]", // chart decreasing
    0x1f4ca: "[chart]", // bar chart
    0x1f4cb: "[ ]", // clipboard
    0x1f4cc: "[pin]", // pushpin
    0x1f4cd: "[pin]", // round pushpin
    0x1f4ce: "[clip]", // paperclip
    0x1f4cf: "[ruler]", // straight ruler
    0x1f4d0: "[ruler]", // triangular ruler
    0x1f4d1: "[bookmark]", // bookmark tabs
    0x1f4d2: "[book]", // ledger
    0x1f4d3: "[book]", // notebook
    0x1f4d4: "[book]", // notebook with decorative cover
    0x1f4d5: "[book]", // closed book
    0x1f4d6: "[book]", // open book
    0x1f4d7: "[book]", // green book
    0x1f4d8: "[book]", // blue book
    0x1f4d9: "[book]", // orange book
    0x1f4da: "[book]", // books
    0x1f4db: "[name]", // name badge
    0x1f4dc: "[scroll]", // scroll
    0x1f4dd: "[note]", // memo
    0x1f4de: "[phone]", // telephone receiver
    0x1f4df: "[pager]", // pager
    0x1f4e0: "[fax]", // fax machine
    0x1f4e1: "[sat]", // satellite antenna
    0x1f4e2: "[announce]", // loudspeaker
    0x1f4e3: "[announce]", // megaphone
    0x1f4e4: "[mail]", // outbox tray
    0x1f4e5: "[mail]", // inbox tray
    0x1f4e6: "[box]", // package
    0x1f4e7: "[mail]", // e-mail
    0x1f4e8: "[mail]", // incoming envelope
    0x1f4e9: "[mail]", // envelope with arrow
    0x1f4ea: "[mail]", // closed mailbox with lowered flag
    0x1f4eb: "[mail]", // closed mailbox with raised flag
    0x1f4ec: "[mail]", // open mailbox with raised flag
    0x1f4ed: "[mail]", // open mailbox with lowered flag
    0x1f4ee: "[mail]", // postbox
    0x1f4ef: "[mail]", // postal horn
    0x1f4f0: "[news]", // newspaper
    0x1f4f1: "[phone]", // mobile phone
    0x1f4f2: "[phone]", // mobile phone with rightwards arrow
    0x1f4f3: "[phone]", // vibration mode
    0x1f4f4: "[phone]", // mobile phone off
    0x1f4f5: "[mute]", // no mobile phones
    0x1f4f6: "[signal]", // antenna with bars
    0x1f4f7: "[photo]", // camera
    0x1f4f8: "[photo]", // camera with flash
    0x1f4f9: "[video]", // video camera
    0x1f4fa: "[tv]", // television
    0x1f4fb: "[radio]", // radio
    0x1f4fc: "[vhs]", // videocassette
    0x1f4fd: "[film]", // film projector
    0x1f4fe: "[film]", // film frames
    0x1f4ff: "[pray]", // prayer beads
    0x1f500: "[shuffle]", // twisted rightwards arrows
    0x1f501: "[repeat]", // clockwise rightwards
    0x1f502: "[repeat]", // clockwise rightwards with circled one
    0x1f503: "[sync]", // clockwise downwards
    0x1f504: "[sync]", // anticlockwise downwards
    0x1f505: "[dim]", // low brightness
    0x1f506: "[bright]", // high brightness
    0x1f507: "[mute]", // speaker with cancellation stroke
    0x1f508: "[audio]", // speaker
    0x1f509: "[audio]", // speaker with one sound wave
    0x1f50a: "[audio]", // speaker with three sound waves
    0x1f50b: "[battery]", // battery
    0x1f50c: "[plug]", // electric plug
    0x1f50d: "[search]", // left-pointing magnifying glass
    0x1f50e: "[search]", // right-pointing magnifying glass
    0x1f50f: "[lock]", // lock with ink pen
    0x1f510: "[lock]", // closed lock with key
    0x1f511: "[key]", // key
    0x1f512: "[lock]", // lock
    0x1f513: "[unlock]", // open lock
    0x1f514: "[bell]", // bell
    0x1f515: "[mute]", // bell with cancellation stroke
    0x1f516: "[bookmark]", // bookmark
    0x1f517: "[link]", // link symbol
    0x1f518: "[radio]", // radio button
    0x1f519: "[back]", // back with leftwards arrow
    0x1f51a: "[end]", // end with leftwards arrow
    0x1f51b: "[on]", // on with exclamation mark
    0x1f51c: "[soon]", // soon with rightwards arrow
    0x1f51d: "[top]", // top with upwards arrow
    0x1f51e: "[18]", // no one under eighteen
    0x1f51f: "[10]", // keycap ten
    0x1f520: "[ABC]", // input symbol for latin capital letters
    0x1f521: "[abc]", // input symbol for latin small letters
    0x1f522: "[123]", // input symbol for numbers
    0x1f523: "[sym]", // input symbol for symbols
    0x1f524: "[abc]", // input symbol for latin letters
    0x1f525: "[!]", // fire
    0x1f526: "[torch]", // electric torch
    0x1f527: "[tool]", // wrench
    0x1f528: "[tool]", // hammer
    0x1f529: "[tool]", // nut and bolt
    0x1f52a: "[knife]", // hocho
    0x1f52b: "[gun]", // pistol
    0x1f52c: "[micro]", // microscope
    0x1f52d: "[telescope]", // telescope
    0x1f52e: "[crystal]", // crystal ball
    0x1f52f: "[star]", // six pointed star
    0x1f530: "[beginner]", // japanese symbol for beginner
    0x1f531: "[trident]", // trident emblem
    0x1f532: "[btn]", // black square button
    0x1f533: "[btn]", // white square button
    0x1f534: "[red]", // large red circle
    0x1f535: "[blue]", // large blue circle
    0x1f536: "[orange]", // large orange diamond
    0x1f537: "[blue]", // large blue diamond
    0x1f538: "[orange]", // small orange diamond
    0x1f539: "[blue]", // small blue diamond
    0x1f53a: "[red]", // up-pointing red triangle
    0x1f53b: "[red]", // down-pointing red triangle
    0x1f53c: "[up]", // up-pointing small red triangle
    0x1f53d: "[down]", // down-pointing small red triangle
    0x1f550: "[time]", // clock face one o'clock
    0x1f551: "[time]", // clock face two o'clock
    0x1f552: "[time]", // clock face three o'clock
    0x1f553: "[time]", // clock face four o'clock
    0x1f554: "[time]", // clock face five o'clock
    0x1f555: "[time]", // clock face six o'clock
    0x1f556: "[time]", // clock face seven o'clock
    0x1f557: "[time]", // clock face eight o'clock
    0x1f558: "[time]", // clock face nine o'clock
    0x1f559: "[time]", // clock face ten o'clock
    0x1f55a: "[time]", // clock face eleven o'clock
    0x1f55b: "[time]", // clock face twelve o'clock
    0x1f5fb: "[mountain]", // mount fuji
    0x1f5fc: "[tower]", // tokyo tower
    0x1f5fd: "[building]", // statue of liberty
    0x1f5fe: "[map]", // silhouette of japan
    0x1f5ff: "[moyai]", // moyai
    0x1f600: "[smile]", // grinning face
    0x1f601: "[smile]", // grinning face with smiling eyes
    0x1f602: "[laugh]", // face with tears of joy
    0x1f603: "[smile]", // smiling face with open mouth
    0x1f604: "[smile]", // smiling face with open mouth and smiling eyes
    0x1f605: "[smile]", // smiling face with open mouth and cold sweat
    0x1f606: "[laugh]", // smiling face with open mouth and tightly-closed eyes
    0x1f607: "[angel]", // smiling face with halo
    0x1f608: "[devil]", // smiling face with horns
    0x1f609: "[wink]", // winking face
    0x1f60a: "[smile]", // smiling face with smiling eyes
    0x1f60b: "[yum]", // face savouring delicious food
    0x1f60c: "[relief]", // relieved face
    0x1f60d: "[love]", // smiling face with heart-shaped eyes
    0x1f60e: "[cool]", // smiling face with sunglasses
    0x1f60f: "[smirk]", // smirking face
    0x1f610: "[neutral]", // neutral face
    0x1f611: "[neutral]", // expressionless face
    0x1f612: "[unamused]", // unamused face
    0x1f613: "[sweat]", // face with cold sweat
    0x1f614: "[pensive]", // pensive face
    0x1f615: "[confused]", // confused face
    0x1f616: "[confounded]", // confounded face
    0x1f617: "[kiss]", // kissing face
    0x1f618: "[kiss]", // face throwing a kiss
    0x1f619: "[kiss]", // kissing face with smiling eyes
    0x1f61a: "[kiss]", // kissing face with closed eyes
    0x1f61b: "[tongue]", // face with stuck-out tongue
    0x1f61c: "[tongue]", // face with stuck-out tongue and winking eye
    0x1f61d: "[tongue]", // face with stuck-out tongue and tightly-closed eyes
    0x1f61e: "[disappointed]", // disappointed face
    0x1f61f: "[worried]", // worried face
    0x1f620: "[angry]", // angry face
    0x1f621: "[rage]", // pouting face
    0x1f622: "[cry]", // crying face
    0x1f623: "[persevere]", // persevering face
    0x1f624: "[triumph]", // face with look of triumph
    0x1f625: "[disappointed]", // disappointed but relieved face
    0x1f626: "[frown]", // frowning face with open mouth
    0x1f627: "[anguished]", // anguished face
    0x1f628: "[fearful]", // fearful face
    0x1f629: "[weary]", // weary face
    0x1f62a: "[sleepy]", // sleepy face
    0x1f62b: "[tired]", // tired face
    0x1f62c: "[grimace]", // grimacing face
    0x1f62d: "[sob]", // loudly crying face
    0x1f62e: "[open]", // face with open mouth
    0x1f62f: "[hushed]", // hushed face
    0x1f630: "[cold]", // face with open mouth and cold sweat
    0x1f631: "[scream]", // face screaming in fear
    0x1f632: "[astonished]", // astonished face
    0x1f633: "[flushed]", // flushed face
    0x1f634: "[zzz]", // sleeping face
    0x1f635: "[dizzy]", // dizzy face
    0x1f636: "[speechless]", // face without mouth
    0x1f637: "[mask]", // face with medical mask
    0x1f638: "[cat]", // grinning cat face with smiling eyes
    0x1f639: "[cat]", // cat face with tears of joy
    0x1f63a: "[cat]", // smiling cat face with open mouth
    0x1f63b: "[cat]", // smiling cat face with heart-shaped eyes
    0x1f63c: "[cat]", // cat face with wry smile
    0x1f63d: "[cat]", // kissing cat face with closed eyes
    0x1f63e: "[cat]", // pouting cat face
    0x1f63f: "[cat]", // crying cat face
    0x1f640: "[cat]", // weary cat face
    0x1f645: "[no]", // face with no good gesture
    0x1f646: "[ok]", // face with ok gesture
    0x1f647: "[bow]", // person bowing deeply
    0x1f648: "[monkey]", // see-no-evil monkey
    0x1f649: "[monkey]", // hear-no-evil monkey
    0x1f64a: "[monkey]", // speak-no-evil monkey
    0x1f64b: "[hi]", // happy person raising one hand
    0x1f64c: "[thanks]", // person raising both hands in celebration
    0x1f64d: "[frown]", // person frowning
    0x1f64e: "[frown]", // person with pouting face
    0x1f64f: "[thanks]", // person with folded hands
    0x1f680: "[go]", // rocket
    0x1f681: "[heli]", // helicopter
    0x1f682: "[train]", // steam locomotive
    0x1f683: "[train]", // railway car
    0x1f684: "[train]", // high-speed train
    0x1f685: "[train]", // high-speed train with bullet nose
    0x1f686: "[train]", // train
    0x1f687: "[metro]", // metro
    0x1f688: "[train]", // light rail
    0x1f689: "[station]", // station
    0x1f68a: "[tram]", // tram
    0x1f68b: "[tram]", // tram car
    0x1f68c: "[bus]", // bus
    0x1f68d: "[bus]", // oncoming bus
    0x1f68e: "[trolley]", // trolleybus
    0x1f68f: "[bus]", // bus stop
    0x1f690: "[minibus]", // minibus
    0x1f691: "[ambulance]", // ambulance
    0x1f692: "[fire]", // fire engine
    0x1f693: "[police]", // police car
    0x1f694: "[police]", // oncoming police car
    0x1f695: "[taxi]", // taxi
    0x1f696: "[taxi]", // oncoming taxi
    0x1f697: "[car]", // automobile
    0x1f698: "[car]", // oncoming automobile
    0x1f699: "[car]", // recreational vehicle
    0x1f69a: "[truck]", // delivery truck
    0x1f69b: "[truck]", // articulated lorry
    0x1f69c: "[tractor]", // tractor
    0x1f69d: "[monorail]", // monorail
    0x1f69e: "[train]", // mountain railway
    0x1f69f: "[train]", // suspension railway
    0x1f6a0: "[train]", // mountain cableway
    0x1f6a1: "[train]", // aerial tramway
    0x1f6a2: "[ship]", // ship
    0x1f6a3: "[row]", // rowboat
    0x1f6a4: "[speedboat]", // speedboat
    0x1f6a5: "[traffic]", // horizontal traffic light
    0x1f6a6: "[traffic]", // vertical traffic light
    0x1f6a7: "[construction]", // construction sign
    0x1f6a8: "[!]", // police cars revolving light
    0x1f6a9: "[flag]", // triangular flag on post
    0x1f6aa: "[door]", // door
    0x1f6ab: "[no]", // no entry sign
    0x1f6ac: "[smoking]", // smoking symbol
    0x1f6ad: "[no]", // no smoking symbol
    0x1f6ae: "[litter]", // put litter in its place symbol
    0x1f6af: "[no]", // do not litter symbol
    0x1f6b0: "[water]", // potable water symbol
    0x1f6b1: "[no]", // non-potable water symbol
    0x1f6b2: "[bike]", // bicycle
    0x1f6b3: "[no]", // no bicycles
    0x1f6b4: "[bike]", // bicyclist
    0x1f6b5: "[bike]", // mountain bicyclist
    0x1f6b6: "[walk]", // pedestrian
    0x1f6b7: "[no]", // no pedestrians
    0x1f6b8: "[child]", // children crossing
    0x1f6b9: "[men]", // mens symbol
    0x1f6ba: "[women]", // womens symbol
    0x1f6bb: "[restroom]", // restroom
    0x1f6bc: "[baby]", // baby symbol
    0x1f6bd: "[toilet]", // toilet
    0x1f6be: "[wc]", // water closet
    0x1f6bf: "[shower]", // shower
    0x1f6c0: "[bath]", // bath
    0x1f6c1: "[bath]", // bathtub
    0x1f6c2: "[passport]", // passport control
    0x1f6c3: "[customs]", // customs
    0x1f6c4: "[baggage]", // baggage claim
    0x1f6c5: "[baggage]", // left luggage
    0x1f6d1: "[stop]", // octagonal sign
    0x1f6d2: "[cart]", // shopping trolley
  };

  function escapePdfText(str) {
    var out = "";
    // Iterate by code point so astral-plane characters (surrogate pairs) are
    // consumed as a single unit and never leave a lone surrogate behind.
    for (var i = 0; i < str.length; i++) {
      var code = str.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff && i + 1 < str.length) {
        var low = str.charCodeAt(i + 1);
        if (low >= 0xdc00 && low <= 0xdfff) {
          code = (code - 0xd800) * 0x400 + (low - 0xdc00) + 0x10000;
          i++;
        }
      }
      out += encodeChar(code);
    }
    return out;
  }

  // Encode a single Unicode code point into PDF string bytes (WinAnsi where
  // representable, an ASCII equivalent where sensible, otherwise dropped).
  function encodeChar(code) {
    if (code === 0x5c) return "\\\\"; // backslash
    if (code === 0x28) return "\\("; // (
    if (code === 0x29) return "\\)"; // )
    if (code >= 32 && code <= 126) return String.fromCharCode(code);
    if (code === 9) return " "; // tab -> space
    if (code === 10 || code === 13) return " "; // newlines -> space
    if (code === 0x00a0) return " "; // nbsp -> space
    // Latin-1 supplement (U+00A1-U+00FF) maps 1:1 to WinAnsi bytes.
    if (code >= 0x00a1 && code <= 0x00ff) return String.fromCharCode(code);
    // CP1252 smart-punctuation block.
    if (Object.prototype.hasOwnProperty.call(WINANSI_HIGH, code)) {
      return String.fromCharCode(WINANSI_HIGH[code]);
    }
    // Sensible ASCII equivalents for common symbols/emoji.
    if (Object.prototype.hasOwnProperty.call(ASCII_EQUIV, code)) {
      return ASCII_EQUIV[code];
    }
    // Drop anything else entirely - never emit "?".
    return "";
  }

  // Default text colour (black) used when an op carries no explicit colour.
  var BLACK = [0, 0, 0];

  function colourOp(colour) {
    var c = colour || BLACK;
    return fmt(c[0]) + " " + fmt(c[1]) + " " + fmt(c[2]) + " rg";
  }

  function buildContentStream(pageOps) {
    var parts = [];

    // 1) Filled rectangles (header band, section rules) are painted first so
    //    text and lines sit on top of them.
    for (var r = 0; r < pageOps.length; r++) {
      var rect = pageOps[r];
      if (rect.type === "rect") {
        parts.push(colourOp(rect.colour));
        parts.push(
          fmt(rect.x) +
            " " +
            fmt(rect.y) +
            " " +
            fmt(rect.w) +
            " " +
            fmt(rect.h) +
            " re f",
        );
      }
    }

    // 2) Stroked lines (rules, table separators, footer rule).
    for (var j = 0; j < pageOps.length; j++) {
      var line = pageOps[j];
      if (line.type === "line") {
        if (line.colour) parts.push(colourOp(line.colour));
        parts.push(
          fmt(line.width) +
            " w " +
            fmt(line.x1) +
            " " +
            fmt(line.y1) +
            " m " +
            fmt(line.x2) +
            " " +
            fmt(line.y2) +
            " l S",
        );
      }
    }

    // 3) Text, grouped into a single BT/ET block with per-op colour.
    parts.push("BT");
    var lastFont = null;
    var lastColour = null;
    for (var i = 0; i < pageOps.length; i++) {
      var op = pageOps[i];
      if (op.type === "text") {
        var fontKey = op.bold ? "F2" : "F1";
        if (fontKey !== lastFont) {
          parts.push("/" + fontKey + " " + fmt(op.size) + " Tf");
          lastFont = fontKey;
        } else {
          parts.push(fmt(op.size) + " Tf");
        }
        var colour = op.colour || BLACK;
        var colourKey = colour.join(",");
        if (colourKey !== lastColour) {
          parts.push(colourOp(colour));
          lastColour = colourKey;
        }
        parts.push("1 0 0 1 " + fmt(op.x) + " " + fmt(op.y) + " Tm");
        parts.push("(" + escapePdfText(op.text) + ") Tj");
      }
    }
    parts.push("ET");

    return parts.join("\n");
  }

  function fmt(n) {
    // Trim to 2 decimals and strip trailing zeros for compact output.
    var s = (Math.round(n * 100) / 100).toString();
    return s;
  }

  function buildPdf(pages, options) {
    var opts = options || {};
    var title = opts.title || "Document";
    var author = opts.author || "JCB Leadership Assessment";

    // Object numbering:
    // 1 = Catalog, 2 = Pages, 3 = Font F1, 4 = Font F2,
    // then for each page: page object + content stream object.
    var objects = [];
    var pageObjectNumbers = [];
    var contentObjectNumbers = [];

    var nextObj = 5;
    for (var i = 0; i < pages.length; i++) {
      pageObjectNumbers.push(nextObj++);
      contentObjectNumbers.push(nextObj++);
    }

    // 1: Catalog
    objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";

    // 2: Pages
    var kids = pageObjectNumbers
      .map(function (n) {
        return n + " 0 R";
      })
      .join(" ");
    objects[2] =
      "<< /Type /Pages /Count " + pages.length + " /Kids [" + kids + "] >>";

    // 3 & 4: Fonts (base-14 Helvetica)
    objects[3] =
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
    objects[4] =
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";

    // Page + content objects
    for (var p = 0; p < pages.length; p++) {
      var pageNum = pageObjectNumbers[p];
      var contentNum = contentObjectNumbers[p];
      var stream = buildContentStream(pages[p]);
      // Every character emitted by escapePdfText() is a single WinAnsi byte
      // (0x00-0xFF), so the string length equals the byte length.
      var streamBytes = stream.length;

      objects[pageNum] =
        "<< /Type /Page /Parent 2 0 R " +
        "/MediaBox [0 0 " +
        fmt(PAGE_WIDTH) +
        " " +
        fmt(PAGE_HEIGHT) +
        "] " +
        "/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> " +
        "/Contents " +
        contentNum +
        " 0 R >>";

      objects[contentNum] =
        "<< /Length " + streamBytes + " >>\nstream\n" + stream + "\nendstream";
    }

    // Info object (appended at the end).
    var infoNum = nextObj++;
    objects[infoNum] =
      "<< /Title (" +
      escapePdfText(title) +
      ") " +
      "/Author (" +
      escapePdfText(author) +
      ") " +
      "/Producer (SimplePDF) >>";

    // Serialise with byte offsets for the xref table.
    var header = "%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n";
    var chunks = [header];
    var offset = header.length;
    var offsets = [];

    var maxObj = infoNum;
    for (var o = 1; o <= maxObj; o++) {
      offsets[o] = offset;
      var body = objects[o];
      if (body === undefined) body = "<< >>";
      var objStr = o + " 0 obj\n" + body + "\nendobj\n";
      chunks.push(objStr);
      offset += objStr.length;
    }

    // xref table
    var xrefOffset = offset;
    var xref = "xref\n0 " + (maxObj + 1) + "\n";
    xref += "0000000000 65535 f \n";
    for (var x = 1; x <= maxObj; x++) {
      xref += pad10(offsets[x]) + " 00000 n \n";
    }
    chunks.push(xref);
    offset += xref.length;

    var trailer =
      "trailer\n<< /Size " +
      (maxObj + 1) +
      " /Root 1 0 R /Info " +
      infoNum +
      " 0 R >>\nstartxref\n" +
      xrefOffset +
      "\n%%EOF\n";
    chunks.push(trailer);

    return chunks.join("");
  }

  function pad10(n) {
    var s = String(n);
    while (s.length < 10) s = "0" + s;
    return s;
  }

  // --- Public API ----------------------------------------------------------

  function fromHTML(htmlString, options) {
    var html = typeof htmlString === "string" ? htmlString : "";
    var blocks = parseBlocks(html);
    var pages = layout(blocks, options);
    var pdfString = buildPdf(pages, options);

    // Convert the ASCII/Latin-1 string to bytes. All characters produced by
    // escapePdfText are within the 0-255 range, so a direct charCode mapping
    // is safe and preserves the header comment bytes.
    var bytes = new Uint8Array(pdfString.length);
    for (var i = 0; i < pdfString.length; i++) {
      bytes[i] = pdfString.charCodeAt(i) & 0xff;
    }

    if (typeof Blob !== "undefined") {
      return new Blob([bytes], { type: "application/pdf" });
    }

    // Node / non-browser fallback: return a Blob-like object exposing the
    // bytes so callers (and the verification harness) can inspect them.
    return {
      type: "application/pdf",
      size: bytes.length,
      bytes: bytes,
      _isSimplePdfFallback: true,
    };
  }

  var SimplePDF = {
    fromHTML: fromHTML,
    // Exposed for testing / advanced callers.
    _parseBlocks: parseBlocks,
    _layout: layout,
    _buildPdf: buildPdf,
    _measureText: measureText,
    PAGE_WIDTH: PAGE_WIDTH,
    PAGE_HEIGHT: PAGE_HEIGHT,
  };

  global.SimplePDF = SimplePDF;

  // CommonJS export so the verification harness can require() this file.
  if (typeof module !== "undefined" && module.exports) {
    module.exports = SimplePDF;
  }
})(typeof window !== "undefined" ? window : this);
