import { cellKey, padSheet } from "./model.js";

const ZIP = [0x50, 0x4b];
const OLE = [0xd0, 0xcf, 0x11, 0xe0];

function extension(filename) {
  const match = String(filename || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "";
}

function hasSignature(buf, signature) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return signature.every((value, i) => bytes[i] === value);
}

function sheetFromMatrix(name, matrix) {
  const cells = {};
  let cols = 0;
  matrix.forEach((row, r) => {
    if (!Array.isArray(row)) return;
    cols = Math.max(cols, row.length);
    row.forEach((val, c) => {
      if (val == null || val === "") return;
      cells[cellKey(r, c)] = { v: String(val) };
    });
  });
  return padSheet(name, matrix.length, cols, cells);
}

export function parseWorkbook(buf, filename) {
  if (typeof XLSX === "undefined") {
    throw new Error("parser missing");
  }
  const kind = extension(filename);
  const zipped = kind === "xlsx" || kind === "xlsm" || kind === "ods";
  if (zipped && !hasSignature(buf, ZIP)) throw new Error("bad file");
  if (kind === "xls" && !hasSignature(buf, OLE)) throw new Error("bad file");
  const opts = { type: "array", bookVBA: false };
  if (String(filename || "").toLowerCase().endsWith(".tsv")) opts.FS = "\t";
  const wb = XLSX.read(buf, opts);
  const sheets = wb.SheetNames.map((name) => {
    const matrix = XLSX.utils.sheet_to_json(wb.Sheets[name], {
      header: 1,
      raw: false,
      defval: ""
    });
    return sheetFromMatrix(name, matrix);
  });
  if (!sheets.length) sheets.push(sheetFromMatrix("Sheet1", []));
  return { active: 0, sheets };
}
