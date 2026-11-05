import React, { lazy, Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { PageLoadingState } from './components/common/StateViews';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { ActionModals } from './components/modals/ActionModals';
import { Loan } from './mock/data';
import { AuthProvider, useAuth } from './context/AuthContext';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { DateFilterProvider } from './context/DateFilterContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { RouterProvider, useRouter, usePathname } from './lib/router';
import { AUTH_PATHS, isPublicPath } from './components/site/siteConfig';
// Loaded with the app, so a ready-made page never blanks while a chunk downloads.
import { SiteView } from './components/site/SiteView';

const DashboardView = lazy(() => import('./components/dashboard/DashboardView').then((module) => ({ default: module.DashboardView })));
const AccountsView = lazy(() => import('./components/accounts/AccountsView').then((module) => ({ default: module.AccountsView })));
const IncomeView = lazy(() => import('./components/income/IncomeView').then((module) => ({ default: module.IncomeView })));
const ExpensesView = lazy(() => import('./components/expenses/ExpensesView').then((module) => ({ default: module.ExpensesView })));
const BudgetsView = lazy(() => import('./components/budgets/BudgetsView').then((module) => ({ default: module.BudgetsView })));
const TransfersView = lazy(() => import('./components/transfers/TransfersView').then((module) => ({ default: module.TransfersView })));
const ProjectsView = lazy(() => import('./components/projects/ProjectsView').then((module) => ({ default: module.ProjectsView })));
const LoansView = lazy(() => import('./components/loans/LoansView').then((module) => ({ default: module.LoansView })));
const CategoriesView = lazy(() => import('./components/categories/CategoriesView').then((module) => ({ default: module.CategoriesView })));
const TransactionsView = lazy(() => import('./components/transactions/TransactionsView').then((module) => ({ default: module.TransactionsView })));
const ReportsView = lazy(() => import('./components/reports/ReportsView').then((module) => ({ default: module.ReportsView })));
const SettingsView = lazy(() => import('./components/settings/SettingsView').then((module) => ({ default: module.SettingsView })));
const AdminView = lazy(() => import('./components/admin/AdminView').then((module) => ({ default: module.AdminView })));
const LoginView = lazy(() => import('./components/auth/LoginView').then((module) => ({ default: module.LoginView })));
const ForgotPasswordView = lazy(() => import('./components/auth/ForgotPasswordView').then((module) => ({ default: module.ForgotPasswordView })));
const ResetPasswordView = lazy(() => import('./components/auth/ResetPasswordView').then((module) => ({ default: module.ResetPasswordView })));
const VerifyEmailView = lazy(() => import('./components/auth/VerifyEmailView').then((module) => ({ default: module.VerifyEmailView })));
const ProfileView = lazy(() => import('./components/profile/ProfileView').then((module) => ({ default: module.ProfileView })));

function AppContent() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading: isAuthLoading } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Modal flow state (normal users only)
  const [activeModal, setActiveModal] = useState<'income' | 'expense' | 'transfer' | 'loan' | 'daily_bulk' | 'repayment' | null>(null);
  const [selectedLoanForRepayment, setSelectedLoanForRepayment] = useState<Loan | null>(null);

  const toast = useToast();

  const { budgetAlerts } = useFinance();
  const overBudgetCount = budgetAlerts.filter((b) => b.status === 'EXCEEDED').length;

  // Derive current logical tab from actual URL pathname
  const getTabFromPath = useCallback(
    (path: string): NavTab => {
      const clean = path.replace(/\/+$/, '') || '/';
      if (clean === '/profile') return 'profile';
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
        if (clean === '/projects') return 'projects';
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
        projects: '/projects',
        categories: '/categories',
        transactions: '/transactions',
        reports: '/reports',
        settings: '/settings',
        profile: '/profile',
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
    if (isAuthLoading) return;
    // The website stays open to everyone, signed in or not.
    if (isPublicPath(pathname)) return;
    if (!user) {
      // App pages need an account, for example right after signing out.
      if (!AUTH_PATHS.includes(pathname)) router.replace('/');
      return;
    }
    if (user.emailVerified === false) {
      if (pathname !== '/verify-email') {
        router.replace('/verify-email');
      }
      return;
    }

    const clean = pathname.replace(/\/+$/, '') || '/';

    const isSignInPage = ['/login', '/register', '/forgot-password', '/reset-password'].includes(clean);

    if (isAdmin) {
      if (!clean.startsWith('/admin') && clean !== '/profile') {
        router.replace('/admin');
      }
    } else {
      if (clean.startsWith('/admin')) {
        router.replace('/dashboard');
      } else if (isSignInPage) {
        router.replace('/dashboard');
      }
    }
  }, [user, isAdmin, isAuthLoading, pathname, router]);

  const showNotification = (msg: string) => {
    toast.success(msg);
  };

  // The public website doesn't wait for the session check.
  if (isPublicPath(pathname)) {
    return <SiteView />;
  }

  if (isAuthLoading) {
    return (
      <div className={`min-h-screen ${'bg-site-sunken text-ink-3'} flex flex-col items-center justify-center`}>
        <img
          src="/logo.png"
          alt="Account Ledger Logo"
          className="w-12 h-12 object-contain mb-3 animate-pulse"
        />
        <p className="text-xs text-gray-400">Loading Account Ledger...</p>
      </div>
    );
  }

  // Public & unverified views
  if (pathname === '/verify-email') {
    return <VerifyEmailView />;
  }

  if (!user) {
    if (pathname === '/forgot-password') {
      return <ForgotPasswordView />;
    }
    if (pathname === '/reset-password') {
      return <ResetPasswordView />;
    }
    if (pathname === '/login' || pathname === '/register') {
      return <LoginView />;
    }
    return <SiteView />;
  }

  if (user.emailVerified === false) {
    return <VerifyEmailView />;
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
      case 'projects':
        return 'Projects';
      case 'categories':
        return 'Categories';
      case 'transactions':
        return 'Transactions';
      case 'reports':
        return 'Reports';
      case 'settings':
        return 'Settings';
      case 'profile':
        return 'Profile';
      default:
        return 'Account Ledger';
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
    <div className="h-screen max-h-screen bg-surface-sunken text-gray-100 flex flex-col antialiased overflow-hidden">


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
          <ErrorBoundary key={currentTab}>
          <Suspense fallback={<PageLoadingState />}>
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

              {currentTab === 'projects' && <ProjectsView />}

              {currentTab === 'categories' && (
                <CategoriesView onSuccessNotification={showNotification} />
              )}

              {currentTab === 'transactions' && <TransactionsView />}

              {currentTab === 'reports' && <ReportsView />}

              {currentTab === 'settings' && <SettingsView />}

              {currentTab === 'profile' && <ProfileView />}
            </>
          )}
          </Suspense>
          </ErrorBoundary>
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
        <ToastProvider>
          <FinanceProvider>
            <DateFilterProvider>
              <AppContent />
            </DateFilterProvider>
          </FinanceProvider>
        </ToastProvider>
      </RouterProvider>
    </AuthProvider>
  );
}
