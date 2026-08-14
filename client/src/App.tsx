import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import { Article, BlogArchive, CategoryArchive, SearchResults, TagArchive } from "./pages/Blog";
import { Page } from "./pages/Page";
import { PreviewArticle } from "./pages/Preview";

const Admin = lazy(() => import("./pages/Admin"));
function AdminRoute() { return <Suspense fallback={<main className="min-h-screen bg-[#fbfaf7]" />}><Admin /></Suspense>; }

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/admin/:rest*"} component={AdminRoute} />
      <Route path={"/admin"} component={AdminRoute} />
      <Route path={"/preview/:id"} component={PreviewArticle} />
      <Route path={"/page/:slug"} component={Page} />
      <Route path={"/blog/:slug"} component={Article} />
      <Route path={"/blog"} component={BlogArchive} />
      <Route path={"/category/:slug"} component={CategoryArchive} />
      <Route path={"/tag/:slug"} component={TagArchive} />
      <Route path={"/search"} component={SearchResults} />
      <Route path={"/"} component={Home} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
