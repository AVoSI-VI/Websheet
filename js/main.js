import * as model from "./model.js";
import { parseWorkbook } from "./import.js";
import * as view from "./view.js";

const status = document.getElementById("status");
const tabs = document.getElementById("tabs");
const toolbar = document.getElementById("toolbar");
const fileInput = document.getElementById("file");

let book = model.load();

view.bind(document.getElementById("grid"), {
  onSelect: syncToolbar,
  onStatus: (msg) => { status.textContent = msg; }
});
view.show(book);
renderTabs();
status.textContent = book ? "Restored saved workbook." : "";
syncToolbar();

toolbar.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn || !book) return;
  const { r, c } = view.selection();
  const act = btn.dataset.act;
  let msg = "";
  if (act === "bold" || act === "italic" || act === "underline") {
    msg = model.toggleFlag(book, r, c, act);
  } else if (act === "align") {
    const cell = model.getCell(book, r, c);
    const next = cell && cell.align === btn.dataset.value ? "" : btn.dataset.value;
    msg = model.setField(book, r, c, "align", next);
  } else if (act === "row") {
    msg = model.insertRow(book, r);
    view.selection().r += 1;
  } else if (act === "col") {
    msg = model.insertCol(book, c);
    view.selection().c += 1;
  } else if (act === "check") {
    msg = model.insertCheckbox(book, r, c);
  } else {
    return;
  }
  status.textContent = msg;
  view.refresh();
});

document.getElementById("color").addEventListener("change", (e) => {
  applyStyle("color", e.target.value);
});

document.getElementById("bg").addEventListener("change", (e) => {
  applyStyle("bg", e.target.value);
});

fileInput.addEventListener("change", async () => {
  const file = fileInput.files && fileInput.files[0];
  fileInput.value = "";
  if (!file) return;
  try {
    const buf = await file.arrayBuffer();
    book = parseWorkbook(buf, file.name);
    const msg = model.save(book);
    view.show(book);
    renderTabs();
    status.textContent = msg || "Loaded " + file.name;
  } catch {
    status.textContent = "Could not read that file.";
  }
});

function applyStyle(field, value) {
  if (!book) return;
  const { r, c } = view.selection();
  status.textContent = model.setField(book, r, c, field, value);
  view.refresh();
}

function renderTabs() {
  tabs.replaceChildren();
  if (!book) return;
  book.sheets.forEach((sheet, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = sheet.name;
    if (i === book.active) btn.className = "active";
    btn.addEventListener("click", () => {
      if (book.active === i) return;
      status.textContent = model.setActive(book, i);
      view.show(book);
      renderTabs();
    });
    tabs.append(btn);
  });
}

function syncToolbar() {
  const ready = !!model.activeSheet(book);
  toolbar.querySelectorAll("button, input").forEach((el) => {
    el.disabled = !ready;
  });
  const cell = ready ? model.getCell(book, view.selection().r, view.selection().c) : null;
  toolbar.querySelectorAll("button[data-act]").forEach((btn) => {
    const act = btn.dataset.act;
    let on = false;
    if (cell && (act === "bold" || act === "italic" || act === "underline")) on = !!cell[act];
    if (cell && act === "align") on = cell.align === btn.dataset.value;
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
}
