const KEY = "websheet";
const PAD_ROWS = 8;
const PAD_COLS = 4;
const MIN_ROWS = 20;
const MIN_COLS = 10;

export function cellKey(r, c) {
  return r + "," + c;
}

export function parseKey(key) {
  const i = key.indexOf(",");
  return [Number(key.slice(0, i)), Number(key.slice(i + 1))];
}

export function colName(index) {
  let n = index + 1;
  let name = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

export function padSheet(name, usedRows, usedCols, cells) {
  return {
    name: name || "Sheet",
    rows: Math.max(usedRows + PAD_ROWS, MIN_ROWS),
    cols: Math.max(usedCols + PAD_COLS, MIN_COLS),
    cells: cells || {}
  };
}

export function activeSheet(book) {
  if (!book || !Array.isArray(book.sheets) || !book.sheets.length) return null;
  if (book.active < 0 || book.active >= book.sheets.length) book.active = 0;
  const sheet = book.sheets[book.active];
  if (!sheet.cells) sheet.cells = {};
  if (!sheet.rows || sheet.rows < 1) sheet.rows = 1;
  if (!sheet.cols || sheet.cols < 1) sheet.cols = 1;
  return sheet;
}

export function getCell(book, r, c) {
  const sheet = activeSheet(book);
  if (!sheet) return null;
  return sheet.cells[cellKey(r, c)] || null;
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const book = JSON.parse(raw);
    if (!book || !Array.isArray(book.sheets)) return null;
    activeSheet(book);
    return book;
  } catch {
    return null;
  }
}

export function save(book) {
  try {
    localStorage.setItem(KEY, JSON.stringify(book));
    return "";
  } catch {
    return "This workbook is too large to keep in the browser.";
  }
}

function ensure(sheet, r, c) {
  const key = cellKey(r, c);
  if (!sheet.cells[key]) sheet.cells[key] = { v: "" };
  return sheet.cells[key];
}

function bare(cell) {
  return !cell.v && !cell.bold && !cell.italic && !cell.underline &&
    !cell.align && !cell.color && !cell.bg && !cell.check;
}

function patch(book, r, c, fn) {
  const sheet = activeSheet(book);
  if (!sheet) return "";
  const key = cellKey(r, c);
  const cell = ensure(sheet, r, c);
  fn(cell);
  if (bare(cell)) delete sheet.cells[key];
  return save(book);
}

export function setActive(book, index) {
  if (!book.sheets[index]) return "";
  book.active = index;
  return save(book);
}

export function setValue(book, r, c, value) {
  const current = getCell(book, r, c);
  if (current && current.check) return "";
  return patch(book, r, c, (cell) => {
    cell.v = value;
  });
}

export function toggleFlag(book, r, c, flag) {
  return patch(book, r, c, (cell) => {
    if (cell[flag]) delete cell[flag];
    else cell[flag] = true;
  });
}

export function setField(book, r, c, field, value) {
  return patch(book, r, c, (cell) => {
    if (!value) delete cell[field];
    else cell[field] = value;
  });
}

export function insertCheckbox(book, r, c) {
  const sheet = activeSheet(book);
  if (!sheet) return "";
  const cell = ensure(sheet, r, c);
  cell.check = true;
  if (cell.v !== "1") cell.v = "";
  return save(book);
}

export function setCheck(book, r, c, on) {
  const sheet = activeSheet(book);
  if (!sheet) return "";
  const cell = ensure(sheet, r, c);
  if (!cell.check) return "";
  cell.v = on ? "1" : "";
  return save(book);
}

function remap(cells, shift) {
  const next = {};
  for (const [key, cell] of Object.entries(cells)) {
    const [r, c] = parseKey(key);
    const [nr, nc] = shift(r, c);
    next[cellKey(nr, nc)] = cell;
  }
  return next;
}

export function insertRow(book, at) {
  const sheet = activeSheet(book);
  if (!sheet) return "";
  sheet.cells = remap(sheet.cells, (r, c) => [r >= at ? r + 1 : r, c]);
  sheet.rows += 1;
  return save(book);
}

export function insertCol(book, at) {
  const sheet = activeSheet(book);
  if (!sheet) return "";
  sheet.cells = remap(sheet.cells, (r, c) => [r, c >= at ? c + 1 : c]);
  sheet.cols += 1;
  return save(book);
}
