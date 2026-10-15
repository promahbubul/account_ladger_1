import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardView } from './components/dashboard/DashboardView';
import { AccountsView } from './components/accounts/AccountsView';
import { IncomeView } from './components/income/IncomeView';
import { ExpensesView } from './components/expenses/ExpensesView';
import { BudgetsView } from './components/budgets/BudgetsView';
import { TransfersView } from './components/transfers/TransfersView';
import { LoansView } from './components/loans/LoansView';
import { CategoriesView } from './components/categories/CategoriesView';
import { TransactionsView } from './components/transactions/TransactionsView';
import { ReportsView } from './components/reports/ReportsView';
import { SettingsView } from './components/settings/SettingsView';
import { AdminView } from './components/admin/AdminView';
import { ActionModals } from './components/modals/ActionModals';
import { LoginView } from './components/auth/LoginView';
import { Loan } from './mock/data';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { DateFilterProvider } from './context/DateFilterContext';
import { RouterProvider, useRouter, usePathname } from './lib/router';
import { CheckCircle2, X, Wallet } from 'lucide-react';

function AppContent() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading: isAuthLoading } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Modal flow state (normal users only)
  const [activeModal, setActiveModal] = useState<'income' | 'expense' | 'transfer' | 'loan' | 'daily_bulk' | 'repayment' | null>(null);
  const [selectedLoanForRepayment, setSelectedLoanForRepayment] = useState<Loan | null>(null);

  // Notification toast state
  const [notification, setNotification] = useState<string | null>(null);

  const { budgetAlerts } = useFinance();
  const overBudgetCount = budgetAlerts.filter((b) => b.status === 'EXCEEDED').length;

  // Derive current logical tab from actual URL pathname
  const getTabFromPath = useCallback(
    (path: string): NavTab => {
      const clean = path.replace(/\/+$/, '') || '/';
      if (isAdmin) {
        if (clean === '/admin/users') return 'admin-users';
        if (clean === '/admin/logs') return 'admin-logs';
        if (clean === '/admin/settings') return 'admin-settings';
        return 'admin-dashboard';
      } else {
        if (clean === '/accounts') return 'accounts';
        if (clean === '/income') return 'income';
        if (clean === '/expenses') return 'expenses';
        if (clean === '/budgets') return 'budgets';
        if (clean === '/transfers') return 'transfers';
        if (clean === '/loans') return 'loans';
        if (clean === '/categories') return 'categories';
        if (clean === '/transactions') return 'transactions';
        if (clean === '/reports') return 'reports';
        if (clean === '/settings') return 'settings';
        return 'dashboard';
      }
    },
    [isAdmin]
  );

  const currentTab = useMemo(() => getTabFromPath(pathname), [getTabFromPath, pathname]);

  // Programmatic tab navigation mapped directly to real URL changes
  const handleNavigateTab = useCallback(
    (tab: NavTab | string) => {
      const tabToPathMap: Record<string, string> = {
        dashboard: '/dashboard',
        accounts: '/accounts',
        income: '/income',
        expenses: '/expenses',
        budgets: '/budgets',
        transfers: '/transfers',
        loans: '/loans',
        categories: '/categories',
        transactions: '/transactions',
        reports: '/reports',
        settings: '/settings',
        'admin-dashboard': '/admin',
        'admin-users': '/admin/users',
        'admin-logs': '/admin/logs',
        'admin-settings': '/admin/settings',
      };
      const target = tabToPathMap[tab] || (tab.startsWith('/') ? tab : `/${tab}`);
      router.push(target);
    },
    [router]
  );

  // Strict route security guard: enforce role separation & path canonicalization
  useEffect(() => {
    if (!user || isAuthLoading) return;
    const clean = pathname.replace(/\/+$/, '') || '/';

    if (isAdmin) {
      if (!clean.startsWith('/admin')) {
        router.replace('/admin');
      }
    } else {
      if (clean.startsWith('/admin')) {
        router.replace('/dashboard');
      } else if (clean === '/') {
        router.replace('/dashboard');
      }
    }
  }, [user, isAdmin, isAuthLoading, pathname, router]);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification((curr) => (curr === msg ? null : curr));
    }, 4500);
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#0d0f12] text-gray-400 flex flex-col items-center justify-center">
        <div className="w-10 h-10 rounded bg-[#1a1d24] border border-[#2a2d36] flex items-center justify-center text-blue-400 mb-3 animate-pulse">
          <Wallet className="w-5 h-5 text-blue-400" />
        </div>
        <p className="text-xs">Loading HisabFlow...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  const getPageTitle = (tab: NavTab): string => {
    switch (tab) {
      case 'admin-dashboard':
        return 'System Dashboard';
      case 'admin-users':
        return 'User Management';
      case 'admin-logs':
        return 'Audit Logs';
      case 'admin-settings':
        return 'System Settings';
      case 'dashboard':
        return 'Dashboard';
      case 'accounts':
        return 'Accounts';
      case 'income':
        return 'Income';
      case 'expenses':
        return 'Expenses';
      case 'budgets':
        return 'Budgets';
      case 'transfers':
        return 'Transfers';
      case 'loans':
        return 'Loans';
      case 'categories':
        return 'Categories';
      case 'transactions':
        return 'Transactions';
      case 'reports':
        return 'Reports';
      case 'settings':
        return 'Settings';
      default:
        return 'HisabFlow';
    }
  };

  const title = getPageTitle(currentTab);

  const isDataTableTab = [
    'transactions',
    'income',
    'expenses',
    'accounts',
    'transfers',
    'loans',
    'categories',
    'admin-users',
    'admin-logs',
  ].includes(currentTab);

  return (
    <div className="h-screen max-h-screen bg-[#121417] text-gray-100 flex flex-col antialiased overflow-hidden">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 max-w-md bg-[#1a1d24] border border-[#2b2e37] text-gray-100 rounded p-3 shadow-xl flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-200 leading-snug flex-1">{notification}</p>
          <button
            onClick={() => setNotification(null)}
            className="text-gray-400 hover:text-white p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={handleNavigateTab}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        overBudgetCount={overBudgetCount}
      />

      {/* Main Content Area */}
      <div className="lg:pl-64 flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header
          title={title}
          onOpenMobileSidebar={() => setIsMobileOpen(true)}
          onOpenQuickAction={(action) => setActiveModal(action)}
        />

        <main className={`flex-1 min-h-0 p-3 sm:p-4 lg:p-5 w-full min-w-0 ${isDataTableTab ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'}`}>
          {/* System Admin Sections */}
          {isAdmin && (
            <>
              {currentTab === 'admin-dashboard' && (
                <AdminView
                  initialSection="dashboard"
                  onSuccessNotification={showNotification}
                  onNavigateTab={handleNavigateTab}
                />
              )}
              {currentTab === 'admin-users' && (
                <AdminView
                  initialSection="users"
                  onSuccessNotification={showNotification}
                  onNavigateTab={handleNavigateTab}
                />
              )}
              {currentTab === 'admin-logs' && (
                <AdminView
                  initialSection="logs"
                  onSuccessNotification={showNotification}
                  onNavigateTab={handleNavigateTab}
                />
              )}
              {currentTab === 'admin-settings' && (
                <AdminView
                  initialSection="settings"
                  onSuccessNotification={showNotification}
                  onNavigateTab={handleNavigateTab}
                />
              )}
            </>
          )}

          {/* Normal User Financial Modules */}
          {!isAdmin && (
            <>
              {currentTab === 'dashboard' && (
                <DashboardView
                  onOpenQuickAction={(action) => setActiveModal(action)}
                  onNavigateTab={handleNavigateTab}
                />
              )}

              {currentTab === 'accounts' && (
                <AccountsView
                  onOpenTransferModal={() => setActiveModal('transfer')}
                  onNavigateTab={handleNavigateTab}
                  onSuccessNotification={showNotification}
                />
              )}

              {currentTab === 'income' && (
                <IncomeView
                  onOpenAddIncomeModal={() => setActiveModal('income')}
                  onSuccessNotification={showNotification}
                />
              )}

              {currentTab === 'expenses' && (
                <ExpensesView
                  onOpenSingleExpenseModal={() => setActiveModal('expense')}
                  onSuccessNotification={showNotification}
                />
              )}

              {currentTab === 'budgets' && (
                <BudgetsView
                  onSuccessNotification={showNotification}
                  onNavigateTab={handleNavigateTab}
                />
              )}

              {currentTab === 'transfers' && (
                <TransfersView
                  onOpenTransferModal={() => setActiveModal('transfer')}
                  onSuccessNotification={showNotification}
                />
              )}

              {currentTab === 'loans' && (
                <LoansView
                  onOpenAddLoanModal={() => setActiveModal('loan')}
                  onOpenRepaymentModal={(loan) => {
                    setSelectedLoanForRepayment(loan);
                    setActiveModal('repayment');
                  }}
                  onSuccessNotification={showNotification}
                />
              )}

              {currentTab === 'categories' && (
                <CategoriesView onSuccessNotification={showNotification} />
              )}

              {currentTab === 'transactions' && <TransactionsView />}

              {currentTab === 'reports' && <ReportsView />}

              {currentTab === 'settings' && <SettingsView />}
            </>
          )}
        </main>
      </div>

      {/* Global Quick Action Modals (only active for user role) */}
      {!isAdmin && (
        <ActionModals
          activeModal={activeModal}
          onClose={() => {
            setActiveModal(null);
            setSelectedLoanForRepayment(null);
          }}
          selectedLoanForRepayment={selectedLoanForRepayment}
          onSuccessNotification={showNotification}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider>
        <FinanceProvider>
          <DateFilterProvider>
            <AppContent />
          </DateFilterProvider>
        </FinanceProvider>
      </RouterProvider>
    </AuthProvider>
  );
}
