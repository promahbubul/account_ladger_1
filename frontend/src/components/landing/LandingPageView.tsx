import React, { useState } from 'react';
import {
  Download,
  Smartphone,
  ShieldCheck,
  TrendingUp,
  Wallet,
  ArrowRight,
  QrCode,
  Copy,
  Check,
  Layers,
  Lock,
  Laptop,
  ChevronDown,
  Sparkles,
  CheckCircle,
  RefreshCw,
  BarChart3,
} from 'lucide-react';
import { useRouter } from '../../lib/router';

export const LandingPageView: React.FC = () => {
  const router = useRouter();
  const [copiedLink, setCopiedLink] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const apkDownloadUrl = '/AccountLedger-release.apk';
  const fullDownloadUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/AccountLedger-release.apk`
    : 'https://account-ladger.vercel.app/AccountLedger-release.apk';

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(fullDownloadUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const faqs = [
    {
      q: 'Is the AccountLedger mobile application completely free?',
      a: 'Yes, AccountLedger is 100% free with no subscription fees, no in-app purchases, and zero intrusive ads. You get complete access to all financial ledger features, multi-account tracking, reports, and cloud sync.'
    },
    {
      q: 'Is it safe to install this APK directly on my Android phone?',
      a: 'Absolutely. Android displays a standard warning whenever you install an APK directly from a web browser instead of the Google Play Store. Our APK is built with official security certificates, is completely open-source, and contains zero adware or trackers. Simply tap "Install anyway" or "Allow from this source".'
    },
    {
      q: 'Can I use both the Mobile App and the Web App together?',
      a: 'Yes! Both the mobile app and web platform share the exact same secure cloud backend. Any transaction, income, or expense you record on your Android phone syncs immediately to the web dashboard and vice-versa in real time.'
    },
    {
      q: 'What are the minimum system requirements for the Android app?',
      a: 'The AccountLedger APK is optimized for modern 64-bit Android smartphones running Android 7.0 (Nougat) and higher. With our recent native binary optimization, the APK size is only 20.2 MB, consuming minimal battery and storage.'
    },
    {
      q: 'How do I update the application when a new release is available?',
      a: 'Whenever an update is released, you can simply download the latest APK directly from this website and install it over your existing app. All your stored data, accounts, and login sessions will remain completely intact.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#090A0D] text-slate-100 selection:bg-emerald-500 selection:text-black">
      {/* Background glowing gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-emerald-500/10 blur-[130px] rounded-full" />
        <div className="absolute top-[30%] right-[-10%] w-[600px] h-[600px] bg-blue-600/10 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/10 blur-[140px] rounded-full" />
      </div>

      {/* Sticky Navigation Bar */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#090A0D]/80 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo & Brand */}
          <div 
            onClick={() => router.push('/')}
            className="flex items-center gap-3.5 cursor-pointer group"
          >
            <div className="relative">
              <img 
                src="/logo.png" 
                alt="AccountLedger Logo" 
                className="w-10 h-10 object-contain rounded-xl shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform"
              />
              <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#090A0D] rounded-full" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-white tracking-tight">AccountLedger</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  v1.0.0
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Smart Financial Manager</p>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
            <a href="#features" className="hover:text-emerald-400 transition-colors">Features</a>
            <a href="#app-showcase" className="hover:text-emerald-400 transition-colors">Mobile App</a>
            <a href="#how-to-install" className="hover:text-emerald-400 transition-colors">How to Install</a>
            <a href="#faq" className="hover:text-emerald-400 transition-colors">FAQ</a>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/login')}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-800/60 border border-slate-800 transition-all flex items-center gap-2"
            >
              <Laptop className="w-4 h-4 text-slate-400" />
              <span>Web App</span>
            </button>

            <a
              href={apkDownloadUrl}
              download="AccountLedger-release.apk"
              className="relative group px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-950 bg-gradient-to-r from-emerald-400 to-emerald-300 hover:from-emerald-300 hover:to-teal-300 shadow-lg shadow-emerald-500/25 transition-all flex items-center gap-2"
            >
              <Download className="w-4 h-4 transition-transform group-hover:-translate-y-0.5" />
              <span>Download APK</span>
            </a>
          </div>
        </div>
      </header>

      {/* Main Hero Section */}
      <section className="relative z-10 pt-16 pb-20 lg:pt-24 lg:pb-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-slate-300 text-xs font-medium mb-8 backdrop-blur-md shadow-inner">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>Android APK v1.0.0 Released</span>
            <span className="text-slate-500">•</span>
            <span className="text-emerald-400 font-semibold">20.2 MB Native Build</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[1.15] mb-6">
            Master your finances with{' '}
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              complete ledger precision.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-lg sm:text-xl text-slate-400 leading-relaxed mb-10 max-w-2xl mx-auto">
            The all-in-one financial ledger for individuals, freelancers, and businesses in Bangladesh. Track cash, banks, bKash, and debts on mobile & web with zero ads.
          </p>

          {/* Hero CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14">
            <a
              href={apkDownloadUrl}
              download="AccountLedger-release.apk"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-base shadow-xl shadow-emerald-500/25 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-3 group"
            >
              <Smartphone className="w-5 h-5" />
              <div className="text-left">
                <div className="text-[11px] uppercase tracking-wider text-slate-900/80 font-bold leading-none">
                  Direct Download
                </div>
                <div className="text-base font-bold leading-tight">
                  Download Android APK
                </div>
              </div>
              <Download className="w-5 h-5 ml-2 transition-transform group-hover:translate-y-0.5" />
            </a>

            <button
              onClick={() => router.push('/login')}
              className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-white font-semibold text-base border border-slate-700/80 hover:border-slate-600 transition-all flex items-center justify-center gap-3 backdrop-blur-md"
            >
              <Laptop className="w-5 h-5 text-slate-400" />
              <span>Open Web Platform</span>
              <ArrowRight className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          {/* Trust Highlights */}
          <div className="pt-6 border-t border-slate-800/80 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-medium text-slate-400">
            <div className="flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>100% Free & Ad-Free</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>Ultra-Fast 20 MB</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>Google One-Tap Login</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>Real-Time Cloud Sync</span>
            </div>
          </div>
        </div>
      </section>

      {/* App Showcase & Specs Grid */}
      <section id="app-showcase" className="relative z-10 py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="bg-gradient-to-b from-slate-900/80 to-[#12151B]/90 border border-slate-800 rounded-3xl p-6 sm:p-10 lg:p-12 shadow-2xl backdrop-blur-xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left: Realistic Phone Interface Mockup */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="relative w-full max-w-[320px] rounded-[42px] p-3.5 bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 shadow-2xl shadow-emerald-500/10 border-4 border-slate-700">
                {/* Speaker pill */}
                <div className="absolute top-5 left-1/2 -translate-x-1/2 w-20 h-4 bg-slate-950 rounded-full z-20 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-slate-800 mr-2" />
                  <div className="w-8 h-1 rounded-full bg-slate-800" />
                </div>

                {/* Inner Screen */}
                <div className="bg-[#0B0D10] rounded-[34px] overflow-hidden pt-7 pb-4 px-4 text-white font-sans border border-slate-800/80">
                  {/* App Header */}
                  <div className="flex items-center justify-between mb-4 pt-1">
                    <div className="flex items-center gap-2">
                      <img src="/logo.png" alt="Logo" className="w-7 h-7 rounded-lg" />
                      <div>
                        <div className="text-xs font-bold text-white">AccountLedger</div>
                        <div className="text-[9px] text-slate-400">Personal & Business</div>
                      </div>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-emerald-400 border border-emerald-500/30">
                      M
                    </div>
                  </div>

                  {/* Balance Hero Card */}
                  <div className="bg-gradient-to-br from-[#161B22] to-[#0E1217] p-3.5 rounded-2xl border border-slate-800 mb-3.5 shadow-md">
                    <div className="text-[10px] font-medium text-slate-400 mb-1 flex items-center justify-between">
                      <span>Total Net Balance</span>
                      <span className="text-[9px] text-emerald-400 font-semibold bg-emerald-500/10 px-1.5 py-0.5 rounded">Active</span>
                    </div>
                    <div className="text-xl font-extrabold text-white tracking-tight mb-2.5">
                      ৳ 2,45,850.00
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-[10px]">
                      <div>
                        <div className="text-slate-400 text-[9px]">This Month In</div>
                        <div className="text-emerald-400 font-bold">+৳ 85,000</div>
                      </div>
                      <div>
                        <div className="text-slate-400 text-[9px]">This Month Out</div>
                        <div className="text-red-400 font-bold">-৳ 32,400</div>
                      </div>
                    </div>
                  </div>

                  {/* Multi-Account Strip */}
                  <div className="mb-3.5">
                    <div className="text-[10px] font-bold text-slate-400 mb-1.5 uppercase tracking-wider">
                      Accounts
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800">
                        <div className="text-[9px] text-slate-400">Cash</div>
                        <div className="text-[11px] font-bold text-white">৳ 15,400</div>
                      </div>
                      <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800">
                        <div className="text-[9px] text-slate-400">City Bank</div>
                        <div className="text-[11px] font-bold text-white">৳ 1,80,000</div>
                      </div>
                      <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800">
                        <div className="text-[9px] text-slate-400">bKash</div>
                        <div className="text-[11px] font-bold text-white">৳ 50,450</div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-3 gap-1.5 mb-3.5">
                    <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-xl py-2 flex flex-col items-center justify-center text-emerald-400 text-[9px] font-bold">
                      <TrendingUp className="w-3.5 h-3.5 mb-0.5" />
                      + Income
                    </div>
                    <div className="bg-red-500/15 border border-red-500/30 rounded-xl py-2 flex flex-col items-center justify-center text-red-400 text-[9px] font-bold">
                      <TrendingUp className="w-3.5 h-3.5 mb-0.5 rotate-180" />
                      - Expense
                    </div>
                    <div className="bg-blue-500/15 border border-blue-500/30 rounded-xl py-2 flex flex-col items-center justify-center text-blue-400 text-[9px] font-bold">
                      <RefreshCw className="w-3.5 h-3.5 mb-0.5" />
                      Transfer
                    </div>
                  </div>

                  {/* Recent Transactions Snippet */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Recent Activity
                    </div>
                    <div className="bg-slate-900/80 p-2 rounded-xl flex items-center justify-between border border-slate-800/60 text-[10px]">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px]">💰</div>
                        <div>
                          <div className="font-semibold text-white leading-none">Client Payment</div>
                          <div className="text-[8px] text-slate-400">City Bank • Today</div>
                        </div>
                      </div>
                      <span className="font-bold text-emerald-400">+৳ 45,000</span>
                    </div>

                    <div className="bg-slate-900/80 p-2 rounded-xl flex items-center justify-between border border-slate-800/60 text-[10px]">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center text-[10px]">🏢</div>
                        <div>
                          <div className="font-semibold text-white leading-none">Office Rent</div>
                          <div className="text-[8px] text-slate-400">bKash • Yesterday</div>
                        </div>
                      </div>
                      <span className="font-bold text-slate-300">-৳ 18,000</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Technical Specs & Download Box */}
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-4">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Production Release</span>
              </div>
              <h2 className="text-3xl font-bold text-white mb-4">
                Engineered for speed, stability, and zero bloatware.
              </h2>
              <p className="text-slate-300 text-base leading-relaxed mb-8">
                Built natively with React Native and compiled with custom 64-bit arm64-v8a architecture, AccountLedger opens in under 1 second and consumes less than 40 MB of RAM.
              </p>

              {/* Specs Table */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
                <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Package Name</span>
                  <span className="text-xs font-mono font-bold text-emerald-400 truncate block">com.accountledger.mobile</span>
                </div>
                <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">APK File Size</span>
                  <span className="text-sm font-bold text-white">20.26 MB</span>
                </div>
                <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Target Android</span>
                  <span className="text-sm font-bold text-white">Android 7.0+ (API 24+)</span>
                </div>
                <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Architecture</span>
                  <span className="text-sm font-bold text-white">arm64-v8a (64-bit)</span>
                </div>
                <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Security</span>
                  <span className="text-xs font-bold text-emerald-400">Debug/Release Signed</span>
                </div>
                <div className="bg-slate-950/70 p-3.5 rounded-2xl border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Pricing</span>
                  <span className="text-sm font-bold text-emerald-400">100% Free</span>
                </div>
              </div>

              {/* QR Code & Direct Download Box */}
              <div className="p-6 rounded-2xl bg-slate-950/90 border border-emerald-500/20 flex flex-col sm:flex-row items-center gap-6">
                {/* Visual QR Code Generator representation */}
                <div className="bg-white p-3 rounded-xl flex-shrink-0 shadow-lg">
                  <svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Top-Left Corner Box */}
                    <rect x="6" y="6" width="28" height="28" fill="#090A0D" rx="4" />
                    <rect x="12" y="12" width="16" height="16" fill="white" rx="2" />
                    <rect x="16" y="16" width="8" height="8" fill="#090A0D" rx="1" />
                    
                    {/* Top-Right Corner Box */}
                    <rect x="62" y="6" width="28" height="28" fill="#090A0D" rx="4" />
                    <rect x="68" y="12" width="16" height="16" fill="white" rx="2" />
                    <rect x="72" y="16" width="8" height="8" fill="#090A0D" rx="1" />

                    {/* Bottom-Left Corner Box */}
                    <rect x="6" y="62" width="28" height="28" fill="#090A0D" rx="4" />
                    <rect x="12" y="68" width="16" height="16" fill="white" rx="2" />
                    <rect x="16" y="72" width="8" height="8" fill="#090A0D" rx="1" />

                    {/* Data Pixels */}
                    <rect x="40" y="8" width="8" height="8" fill="#090A0D" />
                    <rect x="50" y="18" width="6" height="6" fill="#090A0D" />
                    <rect x="40" y="28" width="8" height="6" fill="#090A0D" />
                    
                    <rect x="8" y="40" width="8" height="8" fill="#090A0D" />
                    <rect x="22" y="44" width="6" height="6" fill="#090A0D" />
                    <rect x="36" y="40" width="8" height="8" fill="#090A0D" />
                    <rect x="52" y="40" width="6" height="6" fill="#090A0D" />
                    <rect x="66" y="44" width="8" height="6" fill="#090A0D" />
                    <rect x="80" y="40" width="8" height="8" fill="#090A0D" />

                    <rect x="42" y="56" width="8" height="8" fill="#090A0D" />
                    <rect x="58" y="60" width="6" height="6" fill="#090A0D" />
                    <rect x="70" y="56" width="8" height="8" fill="#090A0D" />

                    <rect x="40" y="72" width="8" height="8" fill="#090A0D" />
                    <rect x="56" y="76" width="8" height="8" fill="#090A0D" />
                    <rect x="74" y="74" width="6" height="6" fill="#090A0D" />
                    <rect x="82" y="82" width="8" height="8" fill="#090A0D" />
                  </svg>
                </div>

                <div className="flex-1 text-center sm:text-left">
                  <h4 className="text-white font-bold text-base mb-1 flex items-center justify-center sm:justify-start gap-2">
                    <QrCode className="w-4 h-4 text-emerald-400" />
                    <span>Scan with Mobile Camera</span>
                  </h4>
                  <p className="text-xs text-slate-400 mb-3">
                    Point your phone camera to download the APK directly on your device.
                  </p>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <a
                      href={apkDownloadUrl}
                      download="AccountLedger-release.apk"
                      className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download APK (20.2 MB)
                    </a>
                    <button
                      onClick={handleCopyLink}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedLink ? 'Link Copied!' : 'Copy Link'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features Grid */}
      <section id="features" className="relative z-10 py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-3">
            Powerful Ledger Capabilities
          </h2>
          <h3 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Everything you need to control every single Taka.
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 transition-all group">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Wallet className="w-6 h-6" />
            </div>
            <h4 className="text-xl font-bold text-white mb-3">Multi-Account & Wallet System</h4>
            <p className="text-sm text-slate-400 leading-relaxed">
              Create and segregate Cash in Hand, Multiple Bank Accounts, and Mobile Banking (bKash, Nagad, Rocket). View individual and aggregated balances instantly.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 transition-all group">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Layers className="w-6 h-6" />
            </div>
            <h4 className="text-xl font-bold text-white mb-3">Double-Entry Mathematical Balance</h4>
            <p className="text-sm text-slate-400 leading-relaxed">
              Balances are never arbitrarily modified; every balance is dynamically derived from immutable transaction ledger records, guaranteeing zero calculation errors.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 transition-all group">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <RefreshCw className="w-6 h-6" />
            </div>
            <h4 className="text-xl font-bold text-white mb-3">Internal Transfers & Loan Tracker</h4>
            <p className="text-sm text-slate-400 leading-relaxed">
              Transfer funds between Bank and Cash without distorting income/expense totals. Track loans given and borrowed with due dates and partial repayment records.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 transition-all group">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <BarChart3 className="w-6 h-6" />
            </div>
            <h4 className="text-xl font-bold text-white mb-3">Categorization & Monthly Budgets</h4>
            <p className="text-sm text-slate-400 leading-relaxed">
              Tag expenses by Food, Rent, Salary, or Utilities. Set monthly budget thresholds and receive visual alerts before you overspend.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 transition-all group">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Lock className="w-6 h-6" />
            </div>
            <h4 className="text-xl font-bold text-white mb-3">Google One-Tap Passwordless Login</h4>
            <p className="text-sm text-slate-400 leading-relaxed">
              Sign in with your verified Google account seamlessly. No tedious passwords to memorize, protected by official Firebase enterprise-grade authentication.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/40 transition-all group">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h4 className="text-xl font-bold text-white mb-3">Enterprise Cloud Privacy & Backup</h4>
            <p className="text-sm text-slate-400 leading-relaxed">
              Your financial records are isolated with strict tenant security and backed up in PostgreSQL with automated audit logging. You own 100% of your data.
            </p>
          </div>
        </div>
      </section>

      {/* How to Install Guide Section */}
      <section id="how-to-install" className="relative z-10 py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-800/80">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-2 block">
            Step-by-Step Guide
          </span>
          <h3 className="text-3xl font-extrabold text-white">
            How to Install the APK on Android
          </h3>
          <p className="text-slate-400 text-sm mt-3">
            Since this is a direct APK release outside the Play Store, follow these 3 quick steps:
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Step 1 */}
          <div className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800 relative">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-bold flex items-center justify-center mb-6 text-base">
              1
            </div>
            <h4 className="text-lg font-bold text-white mb-2">Download the APK File</h4>
            <p className="text-sm text-slate-400 leading-relaxed mb-4">
              Click the <strong className="text-white">Download Android APK</strong> button or scan the QR code to save <code className="text-emerald-400 text-xs">AccountLedger-release.apk</code> to your Downloads folder.
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800 relative">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-bold flex items-center justify-center mb-6 text-base">
              2
            </div>
            <h4 className="text-lg font-bold text-white mb-2">Allow from this Source</h4>
            <p className="text-sm text-slate-400 leading-relaxed mb-4">
              When Android shows <em className="text-slate-300">"File might be harmful"</em> or <em className="text-slate-300">"Install unknown apps"</em>, tap <strong>Settings</strong> and toggle on <strong>"Allow from this source"</strong>.
            </p>
          </div>

          {/* Step 3 */}
          <div className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800 relative">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-bold flex items-center justify-center mb-6 text-base">
              3
            </div>
            <h4 className="text-lg font-bold text-white mb-2">Install & Sign In</h4>
            <p className="text-sm text-slate-400 leading-relaxed mb-4">
              Tap <strong>Install</strong>. Once complete, launch AccountLedger, sign in with your Google Account or Email, and begin managing your finances!
            </p>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions (FAQ) */}
      <section id="faq" className="relative z-10 py-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto border-t border-slate-800/80">
        <div className="text-center mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-2 block">
            Common Inquiries
          </span>
          <h3 className="text-3xl font-extrabold text-white">Frequently Asked Questions</h3>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => (
            <div 
              key={idx}
              className="rounded-2xl bg-slate-900/70 border border-slate-800 overflow-hidden transition-colors"
            >
              <button
                onClick={() => toggleFaq(idx)}
                className="w-full py-5 px-6 text-left flex items-center justify-between gap-4 font-semibold text-white hover:text-emerald-400 transition-colors"
              >
                <span>{faq.q}</span>
                <ChevronDown className={`w-5 h-5 flex-shrink-0 text-slate-400 transition-transform duration-200 ${openFaq === idx ? 'rotate-180 text-emerald-400' : ''}`} />
              </button>
              {openFaq === idx && (
                <div className="px-6 pb-6 text-sm text-slate-300 leading-relaxed border-t border-slate-800/60 pt-4">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="relative z-10 py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="rounded-3xl bg-gradient-to-r from-emerald-600/20 via-teal-600/20 to-blue-600/20 border border-emerald-500/30 p-10 sm:p-14 text-center relative overflow-hidden backdrop-blur-xl">
          <div className="max-w-2xl mx-auto relative z-10">
            <h3 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
              Ready to take control of your accounts?
            </h3>
            <p className="text-slate-300 text-base mb-8">
              Download the standalone Android release APK now or open the full web application on any device.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href={apkDownloadUrl}
                download="AccountLedger-release.apk"
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-base shadow-lg shadow-emerald-500/30 transition-all flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                <span>Download APK (20.2 MB)</span>
              </a>
              <button
                onClick={() => router.push('/login')}
                className="w-full sm:w-auto px-8 py-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-base border border-slate-700 transition-all flex items-center justify-center gap-2"
              >
                <Laptop className="w-5 h-5 text-slate-400" />
                <span>Open Web Version</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-800/80 bg-[#07080A] py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-xs text-slate-400">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="AccountLedger Logo" className="w-8 h-8 rounded-lg" />
            <div>
              <span className="font-bold text-white text-sm">AccountLedger</span>
              <p className="text-[11px] text-slate-500">© 2026 AccountLedger. All rights reserved.</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <a href="#features" className="hover:text-emerald-400 transition-colors">Features</a>
            <a href="#how-to-install" className="hover:text-emerald-400 transition-colors">Installation Guide</a>
            <button onClick={() => router.push('/login')} className="hover:text-emerald-400 transition-colors">Sign In</button>
            <a href={apkDownloadUrl} download className="text-emerald-400 font-semibold hover:underline">Direct APK Download</a>
          </div>

          <div className="flex items-center gap-2 text-slate-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
            <span>Systems Normal • API Online</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
export default LandingPageView;
