import { formatBDT, formatDate } from './formatters';

export interface ProjectEntry {
  id: string;
  type: 'FUND' | 'EXPENSE';
  amount: number;
  date: string;
  description?: string | null;
  personId?: string | null;
  personName?: string | null;
  headId?: string | null;
  headName?: string | null;
}

export interface ProjectSummary {
  id: string;
  name: string;
  clientName?: string | null;
  location?: string | null;
  startDate?: string | null;
  budget?: number | null;
  status: string;
  totalFunds: number;
  totalExpense: number;
  balance: number;
  people: { id: string; name: string; phone?: string | null }[];
  heads: { id: string; name: string }[];
  byHead: { id: string; name: string; amount: number; count: number }[];
  byPerson: { id: string | null; name: string; expense: number; funds: number }[];
}

const safeFileName = (name: string) => name.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'project';

// Quotes every cell, and stops spreadsheets from running user text that looks like a formula.
const csvCell = (value: unknown) => {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

export const exportProjectCsv = (project: ProjectSummary, entries: ProjectEntry[]) => {
  const rows: unknown[][] = [
    ['Project', project.name],
    ['Client', project.clientName],
    ['Total funds', project.totalFunds],
    ['Total expense', project.totalExpense],
    ['Balance', project.balance],
    [],
    ['Date', 'Type', 'Head', 'Person', 'Description', 'Amount'],
    ...entries.map((e) => [e.date, e.type === 'FUND' ? 'Fund' : 'Expense', e.headName, e.personName, e.description, e.amount]),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  // The byte order mark lets Excel read Bangla text correctly.
  const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeFileName(project.name)}-report.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

const summaryTable = (title: string, rows: { name: string; amount: number }[]) =>
  rows.length
    ? `<h2>${title}</h2><table><tbody>${rows
        .map((row) => `<tr><td>${escapeHtml(row.name)}</td><td class="num">${escapeHtml(formatBDT(row.amount))}</td></tr>`)
        .join('')}</tbody></table>`
    : '';

export const buildProjectHtml = (project: ProjectSummary, entries: ProjectEntry[]) => `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(project.name)}</title><style>
  body { font-family: 'Segoe UI', Roboto, 'Noto Sans Bengali', sans-serif; color: #111; font-size: 12px; margin: 24px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  h2 { font-size: 13px; margin: 20px 0 6px; }
  p { margin: 0 0 2px; color: #555; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 5px 6px; border-bottom: 1px solid #ddd; }
  th { font-size: 10px; text-transform: uppercase; color: #555; }
  .num { text-align: right; white-space: nowrap; }
  .totals td { font-size: 14px; font-weight: 700; border: 0; padding-left: 0; }
  .totals .caption { font-size: 10px; font-weight: 400; color: #555; }
</style></head><body>
  <h1>${escapeHtml(project.name)}</h1>
  ${project.clientName ? `<p>Client: ${escapeHtml(project.clientName)}</p>` : ''}
  ${project.location ? `<p>Location: ${escapeHtml(project.location)}</p>` : ''}
  <table class="totals" style="margin-top:14px"><tr>
    <td><div class="caption">Total funds</div>${escapeHtml(formatBDT(project.totalFunds))}</td>
    <td><div class="caption">Total expense</div>${escapeHtml(formatBDT(project.totalExpense))}</td>
    <td><div class="caption">Balance</div>${escapeHtml(formatBDT(project.balance))}</td>
  </tr></table>
  ${summaryTable('Expense by head', project.byHead)}
  ${summaryTable('Expense by person', project.byPerson.filter((p) => p.expense > 0).map((p) => ({ name: p.name, amount: p.expense })))}
  <h2>All entries</h2>
  <table><thead><tr><th>Date</th><th>Type</th><th>Head</th><th>Person</th><th>Description</th><th class="num">Amount</th></tr></thead><tbody>
  ${entries
    .map(
      (e) => `<tr><td>${escapeHtml(formatDate(e.date))}</td><td>${e.type === 'FUND' ? 'Fund' : 'Expense'}</td><td>${escapeHtml(e.headName)}</td><td>${escapeHtml(e.personName)}</td><td>${escapeHtml(e.description)}</td><td class="num">${escapeHtml(formatBDT(e.amount))}</td></tr>`
    )
    .join('')}
  </tbody></table>
</body></html>`;

// Prints from a hidden frame, so the browser's "Save as PDF" shows only the report.
export const exportProjectPdf = (project: ProjectSummary, entries: ProjectEntry[]) => {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.position = 'fixed';
  frame.style.width = '0';
  frame.style.height = '0';
  frame.style.border = '0';
  frame.srcdoc = buildProjectHtml(project, entries);
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 60000);
  };
  document.body.appendChild(frame);
};
