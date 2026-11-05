import { Suspense } from 'react';
import {createRoot} from 'react-dom/client';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { PageLoadingState } from './components/common/StateViews';
import App from './App';
import './index.css';
import './lib/theme';

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <Suspense fallback={<PageLoadingState />}>
      <App />
    </Suspense>
  </ErrorBoundary>
);
