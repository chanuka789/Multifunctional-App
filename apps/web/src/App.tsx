import { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes, useParams } from 'react-router';
import { Toaster } from 'sonner';
import { AuthProvider } from './lib/auth';
import { AppShell } from './components/AppShell';
import { toolBySlug } from './tools/registry';
import Landing from './pages/Landing';
import NotFound from './pages/NotFound';

const ToolsHub = lazy(() => import('./pages/ToolsHub'));
const Login = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Login })));
const Signup = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Signup })));
const Account = lazy(() => import('./pages/Account'));
const SharePage = lazy(() => import('./pages/SharePage'));
const Privacy = lazy(() => import('./pages/Legal').then((m) => ({ default: m.Privacy })));
const Terms = lazy(() => import('./pages/Legal').then((m) => ({ default: m.Terms })));
const Brand = lazy(() => import('./pages/Brand'));

function ToolRoute() {
  const { slug = '' } = useParams();
  const tool = toolBySlug(slug);
  if (!tool) return <NotFound inShell />;
  const C = tool.Component;
  document.title = `${tool.name} — Ondevo`;
  return <C key={slug} />;
}

function Loading() {
  return (
    <div className="p-6" role="status" aria-live="polite">
      <div className="progress w-48" data-indeterminate="true">
        <span />
      </div>
      <span className="sr-only">Loading</span>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route element={<AppShell />}>
              <Route path="/tools" element={<ToolsHub />} />
              <Route path="/tools/:slug" element={<ToolRoute />} />
              <Route path="/account" element={<Account />} />
            </Route>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/s/:id" element={<SharePage />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/brand" element={<Brand />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
        <Toaster position="bottom-center" />
      </BrowserRouter>
    </AuthProvider>
  );
}
