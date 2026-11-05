// Change this one line when the site moves to its own domain.
export const SITE_URL = 'https://account-ladger.vercel.app';

export const SEO_IMAGE = `${SITE_URL}/og.png`;

export const SEO_PAGES: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'Account Ledger: Track Your Money, Expenses and Projects',
    description:
      'Free money manager for Bangladesh. Record cash, bank and bKash accounts, daily expenses, loans and project costs, on the web and on Android.',
  },
  '/features': {
    title: 'Features | Account Ledger',
    description:
      'Accounts and transfers, daily expenses by category, monthly budgets, loans, project ledgers and reports, all from one account.',
  },
  '/download': {
    title: 'Download the Android App | Account Ledger',
    description: 'Download the Account Ledger app for Android, with steps to install it and a QR code to scan from your computer.',
  },
  '/privacy': {
    title: 'Privacy Policy | Account Ledger',
    description: 'What Account Ledger stores, how it is used, the services we rely on, and the choices you have over your data.',
  },
  '/terms': {
    title: 'Terms of Use | Account Ledger',
    description: 'The terms for using Account Ledger, including your responsibility for your records and what the service does not guarantee.',
  },
};

// Tells search engines what kind of product this is. Only states what the site itself says.
export const SEO_STRUCTURED_DATA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Account Ledger',
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'Android, Web',
  url: SITE_URL,
  description: SEO_PAGES['/'].description,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'BDT' },
};
