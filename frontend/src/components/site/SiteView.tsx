import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Briefcase, CalendarDays, Download, HandCoins, Wallet } from 'lucide-react';
import { Link, usePathname } from '../../lib/router';
import { useAuth } from '../../context/AuthContext';
import { SiteLayout } from './SiteLayout';
import { SITE_URL } from './seo';
import { APK_URL, CONTACT_EMAIL, SCREENS, screenSrcSet } from './siteConfig';
import { SEO_PAGES } from './seo';

const PRIMARY = 'btn-gradient inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md bg-accent-solid text-white';
const SECONDARY = 'inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md border border-site-line-strong text-ink hover:bg-site-hover';

// Each picture exists in both themes, and only the one matching the page is shown and loaded.
// Width and height reserve the space, so nothing jumps when the picture arrives.
const Screenshot: React.FC<{ name: string; alt: string }> = ({ name, alt }) => {
  const { width, height, sizes, widths } = SCREENS[name];
  return (
    <>
      {(['light', 'dark'] as const).map((theme) => (
        <img
          key={theme}
          src={`/screens/${name}-${theme}-${widths[0]}.webp`}
          srcSet={screenSrcSet(name, theme)}
          sizes={sizes}
          width={width}
          height={height}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={`only-${theme} block w-full h-auto`}
        />
      ))}
    </>
  );
};

const BrowserFrame: React.FC<{ name: string; alt: string; className?: string }> = ({ name, alt, className = '' }) => (
  <div className={`mockup-shadow rounded-xl border border-site-line bg-site-card overflow-hidden ${className}`}>
    <div className="flex items-center gap-1.5 px-3.5 py-2.5 border-b border-site-line" aria-hidden="true">
      <span className="w-2.5 h-2.5 rounded-full bg-[#f87171]" />
      <span className="w-2.5 h-2.5 rounded-full bg-[#fbbf24]" />
      <span className="w-2.5 h-2.5 rounded-full bg-[#34d399]" />
    </div>
    <Screenshot name={name} alt={alt} />
  </div>
);

const PhoneFrame: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`mockup-shadow rounded-[2rem] border-[7px] border-[#111827] bg-[#111827] ring-1 ring-site-line-strong overflow-hidden ${className}`}>
    <div className="rounded-[1.5rem] overflow-hidden">
      <Screenshot name="mobile" alt="The Account Ledger Android app, with sample data" />
    </div>
  </div>
);

// True until the first render on a ready-made page has finished.
let onReadyMadePage = typeof document !== 'undefined' && Boolean(document.documentElement.dataset.prerendered);

// Fades content in the first time it scrolls into view. CSS turns this off for reduced motion.
const Reveal: React.FC<{ children: React.ReactNode; delay?: number; className?: string }> = ({ children, delay = 0, className = '' }) => {
  const ref = useRef<HTMLDivElement>(null);
  // The ready-made HTML has to show everything, because nothing runs to fade it in.
  const [shown, setShown] = useState(typeof window === 'undefined');
  const [instant, setInstant] = useState(false);

  // On a ready-made page the content was already on screen, so it must not fade in a second time.
  useLayoutEffect(() => {
    const element = ref.current;
    if (element && onReadyMadePage && element.getBoundingClientRect().top < window.innerHeight) {
      setInstant(true);
      setShown(true);
    }
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal ${shown ? 'reveal-in' : ''} ${className}`} style={instant ? { transition: 'none' } : { transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
};

const ApkButton: React.FC<{ className?: string }> = ({ className = PRIMARY }) => (
  <a href={APK_URL} className={className}>
    <Download className="w-4 h-4" />
    Download for Android
  </a>
);

const HIGHLIGHTS = [
  {
    Icon: Wallet,
    title: 'Every account together',
    text: 'See the balance of your cash, bank and mobile accounts, and move money between them.',
  },
  {
    Icon: CalendarDays,
    title: 'Daily expenses, quickly',
    text: "Enter a whole day's spending at once, sorted by category, and set a monthly budget for each.",
  },
  {
    Icon: HandCoins,
    title: 'Money you lent or borrowed',
    text: 'Keep track of who owes what, and record each repayment as it comes in.',
  },
];

const HomePage: React.FC = () => {
  const { user } = useAuth();
  return (
    <>
      <section className="site-gradient">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-16 sm:pb-24">
          <Reveal className="max-w-2xl">
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-ink">
              Know where <span className="text-gradient">your money</span> went.
            </h1>
            <p className="mt-4 text-lg text-ink-2">
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
          </Reveal>

          <Reveal delay={150} className="relative mt-12 sm:mt-14">
            {/* The full dashboard is unreadable at phone width, so phones see the app instead. */}
            <div className="hidden sm:block lg:pr-24">
              <BrowserFrame name="dashboard" alt="The Account Ledger dashboard, with sample data" />
            </div>
            <div className="hidden lg:block absolute right-0 bottom-[-2.5rem] w-52">
              <PhoneFrame className="float-slow" />
            </div>
            <div className="sm:hidden max-w-[17rem] mx-auto">
              <PhoneFrame className="float-slow" />
            </div>
          </Reveal>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 grid sm:grid-cols-3 gap-5">
        {HIGHLIGHTS.map(({ Icon, title, text }, index) => (
          <Reveal key={title} delay={index * 100}>
            <div className="site-card h-full rounded-xl border border-site-line bg-site-card p-5">
              <div className="w-9 h-9 rounded-lg btn-gradient text-white flex items-center justify-center" aria-hidden="true">
                <Icon className="w-4 h-4" />
              </div>
              <h2 className="mt-4 font-semibold text-ink">{title}</h2>
              <p className="mt-2 text-sm text-ink-2">{text}</p>
            </div>
          </Reveal>
        ))}
      </section>

      <section className="border-y border-site-line bg-site-sunken">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 grid lg:grid-cols-5 gap-10 items-center">
          <Reveal className="lg:col-span-2">
            <div className="inline-flex w-9 h-9 rounded-lg btn-gradient text-white items-center justify-center" aria-hidden="true">
              <Briefcase className="w-4 h-4" />
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-ink">Running a project? Keep its money separate.</h2>
            <p className="mt-3 text-ink-2">
              Contractors can give each project its own ledger: funds received, spending by head such as cement or labor, and who spent what. It stays out of your personal accounts.
            </p>
            <Link href="/features" className="mt-5 inline-block text-sm font-medium text-accent hover:underline">
              See all features
            </Link>
          </Reveal>
          <Reveal delay={150} className="lg:col-span-3">
            <BrowserFrame name="project" alt="A project's funds and expenses by head, with sample data" />
          </Reveal>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <Reveal>
          <div className="rounded-2xl p-8 sm:p-12 text-center text-white" style={{ backgroundImage: 'linear-gradient(120deg, #115e59, #0f766e 50%, #1d4ed8)' }}>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">Start with your first account today.</h2>
            <p className="mt-3 text-white/85">Use it in your browser, or install it on your Android phone.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href={user ? (user.role === 'ADMIN' ? '/admin' : '/dashboard') : '/register'} className="inline-flex items-center px-4 py-2.5 text-sm font-medium rounded-md bg-[#fff] text-[#115e59] hover:bg-[#f0fdfa]">
                {user ? 'Go to dashboard' : 'Create a free account'}
              </Link>
              <a href={APK_URL} className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-md border border-white/50 text-white hover:bg-white/10">
                <Download className="w-4 h-4" />
                Download for Android
              </a>
            </div>
          </div>
        </Reveal>
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
  <section className="site-gradient"><div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
    <h1 className="text-3xl font-semibold tracking-tight text-ink">Features</h1>
    <p className="mt-3 max-w-2xl text-ink-2">Available on the web and on Android, from the same account.</p>
    <dl className="mt-10 max-w-3xl divide-y divide-site-line border-y border-site-line">
      {FEATURES.map((feature) => (
        <div key={feature.title} className="py-5 sm:grid sm:grid-cols-3 sm:gap-6">
          <dt className="font-medium text-ink">{feature.title}</dt>
          <dd className="mt-1 sm:mt-0 sm:col-span-2 text-sm text-ink-2">{feature.text}</dd>
        </div>
      ))}
    </dl>
    <Reveal className="mt-12">
      <BrowserFrame name="reports" alt="The reports page, with sample data" />
    </Reveal>
  </div></section>
);

const DownloadPage: React.FC = () => (
  <section className="site-gradient"><div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid md:grid-cols-2 gap-12">
    <div>
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Download for Android</h1>
      <p className="mt-3 text-ink-2">
        The app isn't on the Play Store yet, so you install it directly. Your account works on both the app and the website.
      </p>
      <div className="mt-6"><ApkButton /></div>
      <p className="mt-3 text-sm text-ink-3">
        Nothing downloading? Open this page in Chrome and tap the button again. The finished file is in your Downloads folder.
      </p>

      <div className="mt-8 hidden sm:flex items-center gap-4">
        <div className="p-2 border border-site-line rounded-md bg-[#fff]">
          <QRCodeSVG value={`${SITE_URL}/download`} size={112} aria-label="QR code linking to this page, to open on your phone" />
        </div>
        <p className="text-sm text-ink-2">On a computer? Scan this with your phone's camera to open this page there, then tap the download button.</p>
      </div>

      <h2 className="mt-10 font-semibold text-ink">How to install</h2>
      <ol className="mt-3 list-decimal list-inside space-y-2 text-sm text-ink-2">
        <li>Download the file and open it from your notifications or Downloads folder.</li>
        <li>If Android asks, allow installing from this source.</li>
        <li>Tap Install, then sign in or create an account.</li>
      </ol>
      <p className="mt-4 text-sm text-ink-3">
        Android warns about any app from outside the Play Store. To update, install the newest download over the old one; your data stays in your account.
      </p>
    </div>
    <div className="max-w-[17rem] w-full mx-auto md:ml-auto md:mr-8 self-start">
      <PhoneFrame className="float-slow" />
    </div>
  </div></section>
);

const ContactLine: React.FC = () =>
  CONTACT_EMAIL ? (
    <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent hover:underline">{CONTACT_EMAIL}</a>
  ) : (
    <a href="https://github.com/promahbubul/account_ladger_1/issues" className="text-accent hover:underline">our GitHub issues page</a>
  );

const ContactPage: React.FC = () => (
  <section className="max-w-3xl mx-auto px-4 sm:px-6 py-14">
    <h1 className="text-3xl font-semibold tracking-tight text-ink">Contact</h1>
    <p className="mt-3 text-ink-2">
      For help with your account, or to report a problem, reach us at <ContactLine />.
    </p>
  </section>
);

const Legal: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="max-w-3xl mx-auto px-4 sm:px-6 py-14">
    <h1 className="text-3xl font-semibold tracking-tight text-ink">{title}</h1>
    <p className="mt-2 text-sm text-ink-3">Last updated 5 November 2026</p>
    <div className="mt-8 space-y-6 text-sm leading-6 text-ink-2 [&_h2]:font-semibold [&_h2]:text-ink [&_h2]:text-base [&_h2]:mb-1 [&_ul]:list-disc [&_ul]:pl-5">
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
      <h2>Using Account Ledger</h2>
      <p>Account Ledger helps you keep your own records. Keep your password private, and only enter information you have the right to store.</p>
    </div>
    <div>
      <h2>Your records</h2>
      <p>Your records belong to you, and you are responsible for checking that they are correct. Account Ledger doesn't hold or move real money, isn't connected to your bank, and isn't financial or tax advice.</p>
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

  // Runs after every Reveal's layout effect above, so they all see the first render.
  useEffect(() => {
    onReadyMadePage = false;
    delete document.documentElement.dataset.prerendered;
  }, []);

  useEffect(() => {
    // Moving between pages keeps the title and description in step with the ready-made HTML.
    const seo = SEO_PAGES[pathname.replace(/\/+$/, '') || '/'] || SEO_PAGES['/'];
    document.title = seo.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', seo.description);
    return () => {
      document.title = 'Account Ledger';
    };
  }, [pathname]);

  return (
    <SiteLayout>
      <Page />
    </SiteLayout>
  );
};
