import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { saveTextFile } from './saveJsonFile';
import { formatCurrency, formatDate } from './formatters';

const safeFileName = (name) => name.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'project';

// Quotes every cell, and stops spreadsheets from running user text that looks like a formula.
const csvCell = (value) => {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
};

export const buildProjectCsv = (project, entries) => {
  const rows = [
    ['Project', project.name],
    ['Client', project.clientName],
    ['Total funds', project.totalFunds],
    ['Total expense', project.totalExpense],
    ['Balance', project.balance],
    [],
    ['Date', 'Type', 'Head', 'Person', 'Description', 'Amount'],
    ...entries.map((e) => [e.date, e.type === 'FUND' ? 'Fund' : 'Expense', e.headName, e.personName, e.description, e.amount]),
  ];
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
};

export const exportProjectCsv = async (project, entries) => {
  // The byte order mark lets Excel read Bangla text correctly.
  await saveTextFile(`${safeFileName(project.name)}-report.csv`, `\uFEFF${buildProjectCsv(project, entries)}`, 'text/csv');
};

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const buildProjectHtml = (project, entries) => {
  const summaryRows = (title, rows) =>
    rows.length
      ? `<h2>${title}</h2><table><tbody>${rows
          .map((row) => `<tr><td>${escapeHtml(row.name)}</td><td class="num">${escapeHtml(formatCurrency(row.amount))}</td></tr>`)
          .join('')}</tbody></table>`
      : '';

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    body { font-family: -apple-system, 'Segoe UI', Roboto, 'Noto Sans Bengali', sans-serif; color: #111; font-size: 12px; margin: 24px; }
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
      <td><div class="caption">Total funds</div>${escapeHtml(formatCurrency(project.totalFunds))}</td>
      <td><div class="caption">Total expense</div>${escapeHtml(formatCurrency(project.totalExpense))}</td>
      <td><div class="caption">Balance</div>${escapeHtml(formatCurrency(project.balance))}</td>
    </tr></table>
    ${summaryRows('Expense by head', project.byHead)}
    ${summaryRows('Expense by person', project.byPerson.filter((p) => p.expense > 0).map((p) => ({ name: p.name, amount: p.expense })))}
    <h2>All entries</h2>
    <table><thead><tr><th>Date</th><th>Type</th><th>Head</th><th>Person</th><th>Description</th><th class="num">Amount</th></tr></thead><tbody>
    ${entries
      .map(
        (e) => `<tr><td>${escapeHtml(formatDate(e.date))}</td><td>${e.type === 'FUND' ? 'Fund' : 'Expense'}</td><td>${escapeHtml(e.headName)}</td><td>${escapeHtml(e.personName)}</td><td>${escapeHtml(e.description)}</td><td class="num">${escapeHtml(formatCurrency(e.amount))}</td></tr>`
      )
      .join('')}
    </tbody></table>
  </body></html>`;
};

export const exportProjectPdf = async (project, entries) => {
  const html = buildProjectHtml(project, entries);
  if (Platform.OS === 'web') {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `${project.name} report` });
};
