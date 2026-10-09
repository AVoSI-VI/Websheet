import { activeSheet, cellKey, colName, getCell, setCheck, setValue } from "./model.js";

let book = null;
let root = null;
let onSelect = null;
let onStatus = null;
let sel = { r: 0, c: 0 };
let editing = false;
let suppressEdit = false;

export function bind(el, hooks) {
  root = el;
  onSelect = hooks && hooks.onSelect;
  onStatus = hooks && hooks.onStatus;
  root.addEventListener("mousedown", onGridDown);
  root.addEventListener("change", onCheck);
  document.addEventListener("keydown", onKey);
}

export function selection() {
  return sel;
}

export function show(next) {
  book = next;
  sel = { r: 0, c: 0 };
  editing = false;
  render();
}

export function refresh() {
  if (editing) commitEdit();
  render();
}

function sheet() {
  return activeSheet(book);
}

function clamp() {
  const sh = sheet();
  if (!sh) return;
  sel.r = Math.max(0, Math.min(sel.r, sh.rows - 1));
  sel.c = Math.max(0, Math.min(sel.c, sh.cols - 1));
}

function notify() {
  if (onSelect) onSelect(sel);
}

function render() {
  if (!root) return;
  root.replaceChildren();
  const sh = sheet();
  if (!sh) {
    const p = document.createElement("p");
    p.className = "empty";
    p.textContent = "Upload an Excel, CSV, TSV, or ODS file.";
    root.append(p);
    notify();
    return;
  }
  clamp();
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  const corner = document.createElement("th");
  corner.className = "corner";
  headRow.append(corner);
  for (let c = 0; c < sh.cols; c++) {
    const th = document.createElement("th");
    th.className = "colhead";
    th.textContent = colName(c);
    headRow.append(th);
  }
  thead.append(headRow);
  const tbody = document.createElement("tbody");
  for (let r = 0; r < sh.rows; r++) {
    const tr = document.createElement("tr");
    const rh = document.createElement("th");
    rh.className = "rowhead";
    rh.textContent = String(r + 1);
    tr.append(rh);
    for (let c = 0; c < sh.cols; c++) tr.append(drawCell(r, c));
    tbody.append(tr);
  }
  table.append(thead, tbody);
  root.append(table);
  notify();
}

function drawCell(r, c) {
  const sh = sheet();
  const cell = sh.cells[cellKey(r, c)];
  const td = document.createElement("td");
  td.dataset.r = String(r);
  td.dataset.c = String(c);
  if (r === sel.r && c === sel.c) td.classList.add("selected");
  if (!cell) return td;
  if (cell.bold) td.style.fontWeight = "700";
  if (cell.italic) td.style.fontStyle = "italic";
  if (cell.underline) td.style.textDecoration = "underline";
  if (cell.align) td.style.textAlign = cell.align;
  if (cell.color) td.style.color = cell.color;
  if (cell.bg) td.style.background = cell.bg;
  if (cell.check) {
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = cell.v === "1";
    td.classList.add("check");
    td.append(box);
    return td;
  }
  td.textContent = cell.v || "";
  if (cell.v) td.title = cell.v;
  return td;
}

function cellAt(target) {
  const td = target.closest("td");
  if (!td || !root.contains(td)) return null;
  return { td, r: Number(td.dataset.r), c: Number(td.dataset.c) };
}

function onGridDown(e) {
  const hit = cellAt(e.target);
  if (!hit || e.target.matches('input[type="text"]')) return;
  const wasEditing = editing;
  const same = !wasEditing && sel.r === hit.r && sel.c === hit.c;
  if (wasEditing) commitEdit();
  sel = { r: hit.r, c: hit.c };
  if (e.target.matches('input[type="checkbox"]')) {
    if (wasEditing) render();
    else paint();
    return;
  }
  if (same) beginEdit();
  else if (wasEditing) render();
  else paint();
}

function commitEdit() {
  if (!editing) return;
  const input = root.querySelector('input[type="text"]');
  editing = false;
  if (!input) return;
  const r = Number(input.parentElement.dataset.r);
  const c = Number(input.parentElement.dataset.c);
  note(setValue(book, r, c, input.value));
}

function paint() {
  if (!root) return;
  root.querySelectorAll("td.selected").forEach((td) => td.classList.remove("selected"));
  const td = root.querySelector(`td[data-r="${sel.r}"][data-c="${sel.c}"]`);
  if (td) td.classList.add("selected");
  notify();
}

function onCheck(e) {
  if (!e.target.matches("input[type=checkbox]")) return;
  const hit = cellAt(e.target);
  if (!hit) return;
  sel = { r: hit.r, c: hit.c };
  note(setCheck(book, hit.r, hit.c, e.target.checked));
  notify();
}

function note(msg) {
  if (msg && onStatus) onStatus(msg);
}

function beginEdit() {
  const cell = getCell(book, sel.r, sel.c);
  if (cell && cell.check) return;
  const td = root.querySelector(`td[data-r="${sel.r}"][data-c="${sel.c}"]`);
  if (!td) return;
  const input = document.createElement("input");
  input.type = "text";
  input.value = cell && cell.v ? cell.v : "";
  td.replaceChildren(input);
  editing = true;
  setTimeout(() => {
    if (!editing) return;
    input.focus();
    input.select();
  }, 0);
  input.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    finishEdit(e.key === "Enter");
  });
  input.addEventListener("blur", () => finishEdit(true));
}

function finishEdit(save) {
  if (!editing) return;
  if (save) commitEdit();
  else editing = false;
  suppressEdit = true;
  setTimeout(() => {
    if (!editing) render();
    suppressEdit = false;
  }, 0);
}

function move(dr, dc) {
  const sh = sheet();
  if (!sh || editing) return;
  sel = {
    r: Math.max(0, Math.min(sh.rows - 1, sel.r + dr)),
    c: Math.max(0, Math.min(sh.cols - 1, sel.c + dc))
  };
  paint();
  const td = root.querySelector("td.selected");
  if (td) td.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function onKey(e) {
  if (!sheet() || suppressEdit || !e.target.closest) return;
  if (e.target.closest('input[type="text"], textarea')) return;
  if (editing) {
    if (e.key === "Enter") {
      e.preventDefault();
      finishEdit(true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      finishEdit(false);
    }
    return;
  }
  if (e.key === "Enter") {
    e.preventDefault();
    beginEdit();
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    move(-1, 0);
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    move(1, 0);
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    move(0, -1);
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    move(0, 1);
  }
}
