// Entry point for frontend/scripts/prerender.mjs: renders one website page to plain HTML at build time.
import React from 'react';
import { renderToString } from 'react-dom/server';
import { AuthProvider } from '../../context/AuthContext';
import { RouterProvider } from '../../lib/router';
import { SiteView } from './SiteView';

export { SEO_IMAGE, SEO_PAGES, SEO_STRUCTURED_DATA, SITE_URL } from './seo';
export { SCREENS, screenSrcSet } from './siteConfig';

export const renderPage = (path: string) =>
  renderToString(
    <AuthProvider>
      <RouterProvider initialPath={path}>
        <SiteView />
      </RouterProvider>
    </AuthProvider>
  );
