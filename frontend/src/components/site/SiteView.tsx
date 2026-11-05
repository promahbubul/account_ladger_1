import React, { useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Download } from 'lucide-react';
import { Link, usePathname } from '../../lib/router';
import { useAuth } from '../../context/AuthContext';
import { SiteLayout } from './SiteLayout';
import { APK_URL, CONTACT_EMAIL } from './siteConfig';

const PRIMARY = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md bg-[#0f766e] text-white hover:bg-[#115e59]';
const SECONDARY = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md border border-slate-300 text-slate-800 hover:bg-slate-50';

const Screenshot: React.FC<{ src: string; alt: string; className?: string }> = ({ src, alt, className = '' }) => (
  <img src={src} alt={alt} loading="lazy" className={`block w-full h-auto rounded-md border border-slate-200 ${className}`} />
);

const ApkButton: React.FC<{ className?: string }> = ({ className = PRIMARY }) => (
  <a href={APK_URL} className={className}>
    <Download className="w-4 h-4" />
    Download for Android
  </a>
);

const HomePage: React.FC = () => {
  const { user } = useAuth();
  return (
    <>
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-12">
        <div className="max-w-2xl">
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900">
            Know where your money went.
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Record your cash, bank and bKash accounts in one place, along with what you spend, what you lend, and what each project costs.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            {user ? (
              <Link href={user.role === 'ADMIN' ? '/admin' : '/dashboard'} className={PRIMARY}>Go to dashboard</Link>
            ) : (
              <Link href="/register" className={PRIMARY}>Create a free account</Link>
            )}
            <ApkButton className={SECONDARY} />
          </div>
        </div>
        {/* The full dashboard is unreadable at phone width, so phones see the app instead. */}
        <Screenshot src="/screens/dashboard.jpg" alt="The AccountLedger dashboard, with sample data" className="mt-12 hidden sm:block" />
        <Screenshot src="/screens/mobile.jpg" alt="The AccountLedger Android app, with sample data" className="mt-10 sm:hidden max-w-xs mx-auto" />
      </section>

      <section className="border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid sm:grid-cols-3 gap-8">
          <div>
            <h2 className="font-semibold text-slate-900">Every account together</h2>
            <p className="mt-2 text-sm text-slate-600">See the balance of your cash, bank and mobile accounts, and move money between them.</p>
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Daily expenses, quickly</h2>
            <p className="mt-2 text-sm text-slate-600">Enter a whole day's spending at once, sorted by category, and set a monthly budget for each.</p>
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Money you lent or borrowed</h2>
            <p className="mt-2 text-sm text-slate-600">Keep track of who owes what, and record each repayment as it comes in.</p>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid lg:grid-cols-5 gap-10 items-center">
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">Running a project? Keep its money separate.</h2>
            <p className="mt-3 text-slate-600">
              Contractors can give each project its own ledger: funds received, spending by head such as cement or labor, and who spent what. It stays out of your personal accounts.
            </p>
            <Link href="/features" className="mt-5 inline-block text-sm font-medium text-[#0f766e] hover:underline">
              See all features
            </Link>
          </div>
          <Screenshot src="/screens/project.jpg" alt="A project's funds and expenses by head, with sample data" className="lg:col-span-3" />
        </div>
      </section>
    </>
  );
};

const FEATURES = [
  {
    title: 'Accounts and transfers',
    text: 'Cash, bank and mobile banking accounts, each with its own balance. Transfers move money between them without counting as income or expense.',
  },
  {
    title: 'Income and expenses',
    text: 'Add one entry at a time, or a full day of expenses grouped by category. Search and filter by date, account or category.',
  },
  {
    title: 'Budgets',
    text: 'Set a monthly limit for a category, and get a warning as you approach it.',
  },
  {
    title: 'Loans',
    text: 'Record money you lent or borrowed, with due dates and partial repayments.',
  },
  {
    title: 'Projects',
    text: 'A separate ledger for each project, with funds, expense heads and people. Export a report as PDF or CSV.',
  },
  {
    title: 'Reports',
    text: 'Spending by category, income against expense over 12 months, and how money moved through each account.',
  },
];

const FeaturesPage: React.FC = () => (
  <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
    <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Features</h1>
    <p className="mt-3 max-w-2xl text-slate-600">Available on the web and on Android, from the same account.</p>
    <dl className="mt-10 max-w-3xl divide-y divide-slate-200 border-y border-slate-200">
      {FEATURES.map((feature) => (
        <div key={feature.title} className="py-5 sm:grid sm:grid-cols-3 sm:gap-6">
          <dt className="font-medium text-slate-900">{feature.title}</dt>
          <dd className="mt-1 sm:mt-0 sm:col-span-2 text-sm text-slate-600">{feature.text}</dd>
        </div>
      ))}
    </dl>
    <Screenshot src="/screens/reports.jpg" alt="The reports page, with sample data" className="mt-12" />
  </section>
);

const DownloadPage: React.FC = () => (
  <section className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid md:grid-cols-2 gap-12">
    <div>
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Download for Android</h1>
      <p className="mt-3 text-slate-600">
        The app isn't on the Play Store yet, so you install it directly. Your account works on both the app and the website.
      </p>
      <div className="mt-6"><ApkButton /></div>

      <div className="mt-8 hidden sm:flex items-center gap-4">
        <div className="p-2 border border-slate-200 rounded-md">
          <QRCodeSVG value={APK_URL} size={112} aria-label="QR code linking to the Android download" />
        </div>
        <p className="text-sm text-slate-600">On a computer? Scan this with your phone's camera to download there.</p>
      </div>

      <h2 className="mt-10 font-semibold text-slate-900">How to install</h2>
      <ol className="mt-3 list-decimal list-inside space-y-2 text-sm text-slate-600">
        <li>Download the file and open it from your notifications or Downloads folder.</li>
        <li>If Android asks, allow installing from this source.</li>
        <li>Tap Install, then sign in or create an account.</li>
      </ol>
      <p className="mt-4 text-sm text-slate-500">
        Android warns about any app from outside the Play Store. To update, install the newest download over the old one; your data stays in your account.
      </p>
    </div>
    <Screenshot src="/screens/mobile.jpg" alt="The AccountLedger Android app, with sample data" className="max-w-xs mx-auto md:ml-auto md:mr-0" />
  </section>
);

const ContactLine: React.FC = () =>
  CONTACT_EMAIL ? (
    <a href={`mailto:${CONTACT_EMAIL}`} className="text-[#0f766e] hover:underline">{CONTACT_EMAIL}</a>
  ) : (
    <a href="https://github.com/promahbubul/account_ladger_1/issues" className="text-[#0f766e] hover:underline">our GitHub issues page</a>
  );

const ContactPage: React.FC = () => (
  <section className="max-w-3xl mx-auto px-4 sm:px-6 py-14">
    <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Contact</h1>
    <p className="mt-3 text-slate-600">
      For help with your account, or to report a problem, reach us at <ContactLine />.
    </p>
  </section>
);

const Legal: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="max-w-3xl mx-auto px-4 sm:px-6 py-14">
    <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
    <p className="mt-2 text-sm text-slate-500">Last updated 5 November 2026</p>
    <div className="mt-8 space-y-6 text-sm leading-6 text-slate-700 [&_h2]:font-semibold [&_h2]:text-slate-900 [&_h2]:text-base [&_h2]:mb-1 [&_ul]:list-disc [&_ul]:pl-5">
      {children}
    </div>
  </section>
);

const PrivacyPage: React.FC = () => (
  <Legal title="Privacy Policy">
    <div>
      <h2>What we store</h2>
      <ul>
        <li>Your name, username and email address.</li>
        <li>Your password in hashed form. We can't read it. If you sign in with Google, we store your Google account ID and picture instead.</li>
        <li>The financial records you enter: accounts, transactions, budgets, loans and projects.</li>
        <li>A log of account activity, including IP addresses, kept for one year for security.</li>
      </ul>
    </div>
    <div>
      <h2>How we use it</h2>
      <p>Only to run the service: to show you your records, keep your account secure, and send emails such as verification codes and password resets. We don't sell your data, and we don't show ads.</p>
    </div>
    <div>
      <h2>Services we rely on</h2>
      <p>Your data is stored in a Neon PostgreSQL database and handled by our server host. The website is served by Vercel, Google sign-in uses Firebase, and the Android download is served by GitHub.</p>
    </div>
    <div>
      <h2>Your choices</h2>
      <p>You can change your name in your profile and download a backup of your records from Settings. To delete your account and its records, contact us at <ContactLine />.</p>
    </div>
  </Legal>
);

const TermsPage: React.FC = () => (
  <Legal title="Terms of Use">
    <div>
      <h2>Using AccountLedger</h2>
      <p>AccountLedger helps you keep your own records. Keep your password private, and only enter information you have the right to store.</p>
    </div>
    <div>
      <h2>Your records</h2>
      <p>Your records belong to you, and you are responsible for checking that they are correct. AccountLedger doesn't hold or move real money, isn't connected to your bank, and isn't financial or tax advice.</p>
    </div>
    <div>
      <h2>No guarantee</h2>
      <p>We work to keep the service running and your data safe, but it is provided as it is, without a guarantee that it will always be available or free of errors. Download a backup of records that matter to you.</p>
    </div>
    <div>
      <h2>Changes and contact</h2>
      <p>We may update the service and these terms, and may suspend accounts that misuse it. Questions are welcome at <ContactLine />.</p>
    </div>
  </Legal>
);

const PAGES: Record<string, { title: string; Page: React.FC }> = {
  '/features': { title: 'Features', Page: FeaturesPage },
  '/download': { title: 'Download for Android', Page: DownloadPage },
  '/privacy': { title: 'Privacy Policy', Page: PrivacyPage },
  '/terms': { title: 'Terms of Use', Page: TermsPage },
  ...(CONTACT_EMAIL ? { '/contact': { title: 'Contact', Page: ContactPage } } : {}),
};

export const SiteView: React.FC = () => {
  const pathname = usePathname();
  const entry = PAGES[pathname.replace(/\/+$/, '')];
  const Page = entry?.Page || HomePage;

  useEffect(() => {
    document.title = entry ? `${entry.title} | AccountLedger` : 'AccountLedger';
    return () => {
      document.title = 'AccountLedger';
    };
  }, [entry]);

  return (
    <SiteLayout>
      <Page />
    </SiteLayout>
  );
};
