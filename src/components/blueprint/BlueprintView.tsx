import React, { useState } from 'react';
import {
  FileCode2,
  Database,
  Layers,
  Network,
  CheckCircle2,
  Table,
  Workflow,
  Server,
  BookOpen,
  Copy,
  Check,
} from 'lucide-react';

export const BlueprintView: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'OVERVIEW' | 'ARCHITECTURE' | 'DATABASE' | 'API' | 'ROADMAP'>('OVERVIEW');
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-6">
      {/* Blueprint Header */}
      <div className="bg-[#111827] border border-cyan-800/40 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <FileCode2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-100 flex items-center gap-2">
                <span>HisabFlow Master System Blueprint & Architectural Specification</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                  Phase 1 Complete
                </span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Full-stack personal accounting engine • PostgreSQL • Prisma ORM • Express.js • Dark-First UI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => {
                navigator.clipboard.writeText('HisabFlow Phase 1 Master Blueprint');
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="px-3 py-1.5 rounded-lg bg-[#162032] hover:bg-gray-800 text-gray-300 border border-[#1F2937] flex items-center gap-1.5 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Ref'}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs inside Blueprint */}
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-[#1F2937] overflow-x-auto text-xs">
          {[
            { id: 'OVERVIEW', label: '1. Executive Summary & Design System', icon: BookOpen },
            { id: 'ARCHITECTURE', label: '2. System Architecture & Diagram', icon: Network },
            { id: 'DATABASE', label: '3. PostgreSQL ER & Prisma Schema', icon: Database },
            { id: 'API', label: '4. REST API Endpoint Matrix', icon: Server },
            { id: 'ROADMAP', label: '5. Phased Roadmap & Phase 1 Checklist', icon: CheckCircle2 },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#162032]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 1: Overview & Executive Summary */}
      {activeSection === 'OVERVIEW' && (
        <div className="space-y-5">
          <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              1. Executive Summary
            </h3>
            <p className="text-xs text-gray-300 leading-relaxed">
              <strong>HisabFlow</strong> is a professional personal accounting and money management web application tailored for Bangladeshi individuals and professionals operating in BDT (৳) within the Asia/Dhaka timezone.
              Unlike simple expense trackers that blur liquidity with income, HisabFlow implements rigorous financial accounting principles:
            </p>
            <ul className="list-disc pl-5 text-xs text-gray-400 space-y-1.5 leading-relaxed">
              <li><strong>Liquidity vs. Income:</strong> Internal transfers between Cash, Bank, and Mobile Banking (bKash/Nagad) update balances atomically without inflating income or expense totals.</li>
              <li><strong>Loans as Assets & Liabilities:</strong> Lending money creates an asset (Receivable), not an expense. Borrowing money creates a liability (Payable), not income. Repayments reduce principals and liquidate positions cleanly.</li>
              <li><strong>Dual-Track Expense Entry:</strong> Supports quick Single Expense entry (Workflow A) and high-efficiency Daily Bulk Entry (Workflow B) with atomic batch saving.</li>
              <li><strong>Precision Arithmetic:</strong> Utilizes PostgreSQL <code>Decimal(14,2)</code> to prevent IEEE 754 floating-point rounding errors.</li>
            </ul>
          </div>

          <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              UI Design System Tokens
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-[#0B0F17] border border-[#1F2937]">
                <div className="text-gray-400 text-[11px]">Backgrounds</div>
                <div className="font-mono text-gray-200 mt-1">#0B0F17 / #111827</div>
                <div className="text-[10px] text-gray-500">Deep charcoal dark-first</div>
              </div>

              <div className="p-3 rounded-lg bg-[#0B0F17] border border-[#1F2937]">
                <div className="text-gray-400 text-[11px]">Primary Accent</div>
                <div className="font-mono text-emerald-400 mt-1">#10B981 (Emerald)</div>
                <div className="text-[10px] text-gray-500">Income & Active balance</div>
              </div>

              <div className="p-3 rounded-lg bg-[#0B0F17] border border-[#1F2937]">
                <div className="text-gray-400 text-[11px]">Expense Accent</div>
                <div className="font-mono text-rose-400 mt-1">#EF4444 (Rose)</div>
                <div className="text-[10px] text-gray-500">Outflows & deductions</div>
              </div>

              <div className="p-3 rounded-lg bg-[#0B0F17] border border-[#1F2937]">
                <div className="text-gray-400 text-[11px]">Typography</div>
                <div className="font-mono text-cyan-300 mt-1">Plus Jakarta Sans</div>
                <div className="text-[10px] text-gray-500">JetBrains Mono for digits</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section 2: Architecture Diagram */}
      {activeSection === 'ARCHITECTURE' && (
        <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-5 space-y-5">
          <div>
            <h3 className="text-sm font-bold text-gray-100">Layered System Architecture</h3>
            <p className="text-xs text-gray-400 mt-0.5">Strict separation between client presentation, REST routing, and financial database storage</p>
          </div>

          {/* Visual Architecture Diagram Box */}
          <div className="p-4 rounded-xl bg-[#0B0F17] border border-[#1F2937] font-mono text-xs text-gray-300 space-y-3">
            <div className="text-center font-bold text-cyan-400 text-sm pb-2 border-b border-[#1F2937]">
              HISABFLOW ARCHITECTURE PIPELINE
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-center">
              <div className="p-3 rounded-lg bg-[#162032] border border-[#1F2937]">
                <div className="text-emerald-400 font-bold mb-1">[Frontend]</div>
                <div className="text-[11px] text-gray-200">Next.js App Shell</div>
                <div className="text-[10px] text-gray-400 mt-1">React, Tailwind, Lucide</div>
              </div>

              <div className="p-3 rounded-lg bg-[#162032] border border-[#1F2937]">
                <div className="text-blue-400 font-bold mb-1">[API Gateway]</div>
                <div className="text-[11px] text-gray-200">Express.js REST API</div>
                <div className="text-[10px] text-gray-400 mt-1">CORS, Central Error Hdlr</div>
              </div>

              <div className="p-3 rounded-lg bg-[#162032] border border-[#1F2937]">
                <div className="text-purple-400 font-bold mb-1">[Service Logic]</div>
                <div className="text-[11px] text-gray-200">Accounting Engine</div>
                <div className="text-[10px] text-gray-400 mt-1">Ledger Integrity & Validation</div>
              </div>

              <div className="p-3 rounded-lg bg-[#162032] border border-[#1F2937]">
                <div className="text-amber-400 font-bold mb-1">[ORM Layer]</div>
                <div className="text-[11px] text-gray-200">Prisma Client JS</div>
                <div className="text-[10px] text-gray-400 mt-1">Atomic Transactions ($tx)</div>
              </div>

              <div className="p-3 rounded-lg bg-[#162032] border border-[#1F2937]">
                <div className="text-rose-400 font-bold mb-1">[Storage]</div>
                <div className="text-[11px] text-gray-200">PostgreSQL DB</div>
                <div className="text-[10px] text-gray-400 mt-1">Decimal(14,2) Constraints</div>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#111827] border border-[#1F2937] text-gray-400 text-[11px] leading-relaxed">
              <strong>Crucial Architectural Invariant:</strong> The Next.js frontend NEVER communicates directly with the database.
              All balance changes, loans, transfers, and expense commits must pass through Express.js validation, guaranteeing server-authoritative balance derivation and preventing client-side forgery.
            </div>
          </div>
        </div>
      )}

      {/* Section 3: Database & ER Diagram */}
      {activeSection === 'DATABASE' && (
        <div className="space-y-5">
          <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-gray-100 flex items-center justify-between">
              <span>Database Entities & Relational Design</span>
              <span className="text-xs font-mono text-indigo-400">api/prisma/schema.prisma</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-lg bg-[#0E131F] border border-[#1F2937] space-y-1">
                <div className="font-bold text-emerald-400 text-sm">User</div>
                <p className="text-gray-400">Root owner of all accounts, transactions, and categories. Guarantees multi-user data isolation via user_id foreign keys.</p>
              </div>

              <div className="p-3.5 rounded-lg bg-[#0E131F] border border-[#1F2937] space-y-1">
                <div className="font-bold text-blue-400 text-sm">Account</div>
                <p className="text-gray-400">Stores liquid accounts (CASH, BANK, MOBILE_BANKING) with opening and verified current balance in Decimal(14,2).</p>
              </div>

              <div className="p-3.5 rounded-lg bg-[#0E131F] border border-[#1F2937] space-y-1">
                <div className="font-bold text-rose-400 text-sm">Transaction (Unified Ledger)</div>
                <p className="text-gray-400">Single source of truth for all financial movements: INCOME, EXPENSE, TRANSFER_IN, TRANSFER_OUT, LOAN disbursements & repayments.</p>
              </div>

              <div className="p-3.5 rounded-lg bg-[#0E131F] border border-[#1F2937] space-y-1">
                <div className="font-bold text-purple-400 text-sm">Loan & LoanRepayment</div>
                <p className="text-gray-400">Differentiates LENT (Receivables owed to user) from BORROWED (Payables user owes). Tracks remaining principal atomically.</p>
              </div>

              <div className="p-3.5 rounded-lg bg-[#0E131F] border border-[#1F2937] space-y-1">
                <div className="font-bold text-amber-400 text-sm">ExpenseBatch & ExpenseBatchItem</div>
                <p className="text-gray-400">Supports Workflow B: daily bulk expense entry where multiple lines for a day are committed in a single transaction.</p>
              </div>

              <div className="p-3.5 rounded-lg bg-[#0E131F] border border-[#1F2937] space-y-1">
                <div className="font-bold text-cyan-400 text-sm">Category</div>
                <p className="text-gray-400">Self-referential hierarchy for parent categories and subcategories (e.g., Food & Dining → Lunch, Groceries).</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section 4: REST API Matrix */}
      {activeSection === 'API' && (
        <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-gray-100">REST API Planning Matrix (Express.js Service)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#162032] border-b border-[#1F2937] text-gray-400 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Method</th>
                  <th className="py-2.5 px-3">Endpoint URL</th>
                  <th className="py-2.5 px-3">Purpose & Business Rule</th>
                  <th className="py-2.5 px-3">Scheduled Phase</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2937] text-gray-300">
                <tr>
                  <td className="py-2 px-3 font-mono text-emerald-400 font-bold">GET</td>
                  <td className="py-2 px-3 font-mono text-gray-200">/api/health</td>
                  <td className="py-2 px-3 text-gray-400">Service readiness check and uptime timestamp</td>
                  <td className="py-2 px-3 text-cyan-400 font-semibold">Phase 1 (Live)</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-mono text-emerald-400 font-bold">GET/POST</td>
                  <td className="py-2 px-3 font-mono text-gray-200">/api/accounts</td>
                  <td className="py-2 px-3 text-gray-400">List and create user accounts with opening balances</td>
                  <td className="py-2 px-3 text-gray-400">Phase 4</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-mono text-blue-400 font-bold">POST</td>
                  <td className="py-2 px-3 font-mono text-gray-200">/api/expenses/bulk</td>
                  <td className="py-2 px-3 text-gray-400">Commit Workflow B daily expense batch atomically</td>
                  <td className="py-2 px-3 text-gray-400">Phase 5</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-mono text-blue-400 font-bold">POST</td>
                  <td className="py-2 px-3 font-mono text-gray-200">/api/transfers</td>
                  <td className="py-2 px-3 text-gray-400">Deduct source & credit dest atomically via Prisma transaction</td>
                  <td className="py-2 px-3 text-gray-400">Phase 6</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-mono text-purple-400 font-bold">POST</td>
                  <td className="py-2 px-3 font-mono text-gray-200">/api/loans/:id/repayments</td>
                  <td className="py-2 px-3 text-gray-400">Record partial or full repayment; enforces remaining &gt;= amount</td>
                  <td className="py-2 px-3 text-gray-400">Phase 7</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section 5: Roadmap & Phase 1 Checklist */}
      {activeSection === 'ROADMAP' && (
        <div className="bg-[#111827] border border-[#1F2937] rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-gray-100">Development Phases & Phase 1 Verification Checklist</h3>

          <div className="space-y-2.5 text-xs">
            {[
              { phase: 'Phase 1: Planning & UI Scaffold', status: 'COMPLETED', active: true, desc: 'Full blueprint, architecture, Prisma schema draft, Express backend scaffold, dark theme design tokens, and all interactive pages with realistic Bangladeshi mock data.' },
              { phase: 'Phase 2: PostgreSQL & Prisma Migrations', status: 'NEXT MILESTONE', active: false, desc: 'Configure PostgreSQL connection, execute initial schema migration, generate Prisma Client, and seed sample accounts.' },
              { phase: 'Phase 3: Express API Foundation', status: 'PENDING', active: false, desc: 'Integrate Prisma into Express, wire request validators, centralized error handlers, and integration tests.' },
              { phase: 'Phase 4: Accounts & Categories Engine', status: 'PENDING', active: false, desc: 'Complete CRUD for Accounts and Categories with subcategory tree handling.' },
              { phase: 'Phase 5: Income & Daily Bulk Expenses (Workflows A & B)', status: 'PENDING', active: false, desc: 'Implement atomic batch saves for daily expenses and revenue tracking.' },
              { phase: 'Phase 6: Atomic Internal Transfers', status: 'PENDING', active: false, desc: 'Execute balance updates in Prisma $transaction with overdraft and distinct-account safeguards.' },
              { phase: 'Phase 7: Loans & Repayment Accounting', status: 'PENDING', active: false, desc: 'Receivable and payable tracking with overpayment prevention and settlement triggers.' },
              { phase: 'Phase 8: Unified Reports & Reconciliation', status: 'PENDING', active: false, desc: 'Cash flow reconciliation, category distribution, and CSV export.' },
              { phase: 'Phase 9: User Authentication & Security', status: 'PENDING', active: false, desc: 'Secure session/JWT tokens, password hashing, and user data isolation.' },
              { phase: 'Phase 10: Production Hardening & Testing', status: 'PENDING', active: false, desc: 'Automated test suites, decimal rounding assertions, and deployment verification.' },
            ].map((p, i) => (
              <div
                key={i}
                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                  p.active
                    ? 'bg-emerald-950/20 border-emerald-500/40'
                    : 'bg-[#0E131F] border-[#1F2937]'
                }`}
              >
                <div>
                  <div className="font-bold text-gray-100 flex items-center gap-2">
                    {p.active && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    <span>{p.phase}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">{p.desc}</p>
                </div>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded self-start sm:self-auto ${
                    p.active
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                      : 'bg-[#162032] text-gray-400 border border-[#1F2937]'
                  }`}
                >
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
