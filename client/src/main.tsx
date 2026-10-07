import { ClerkProvider } from "@clerk/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Navigate } from "react-router";
import { RouterProvider } from "react-router/dom";
import { AppShell } from "@/components/AppShell";
import { GuestOnly, RequireAuth } from "@/components/AuthGuards";
import { Toaster } from "@/components/ui/sonner";
import { CheckerPage } from "@/pages/CheckerPage";
import { DocumentPage } from "@/pages/DocumentPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { HistoryPage } from "@/pages/HistoryPage";
import { LoginPage } from "@/pages/LoginPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { SignupPage } from "@/pages/SignupPage";
import { paths } from "@/routes";
import "./index.css";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
if (!publishableKey) throw new Error("VITE_CLERK_PUBLISHABLE_KEY is missing.");

const router = createBrowserRouter([
  {
    element: <GuestOnly />,
    children: [
      { path: paths.login, element: <LoginPage /> },
      { path: paths.signup, element: <SignupPage /> },
      { path: paths.forgotPassword, element: <ForgotPasswordPage /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: paths.checker, element: <CheckerPage /> },
          { path: paths.documentPattern, element: <DocumentPage /> },
          { path: paths.history, element: <HistoryPage /> },
          { path: paths.settings, element: <SettingsPage /> },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to={paths.checker} replace /> },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClerkProvider publishableKey={publishableKey} afterSignOutUrl={paths.login}>
      <RouterProvider router={router} />
      <Toaster position="bottom-center" />
    </ClerkProvider>
  </StrictMode>,
);
