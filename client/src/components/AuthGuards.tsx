import { useAuth } from "@clerk/react";
import { Navigate, Outlet } from "react-router";
import { paths } from "@/routes";

export function RequireAuth() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  return isSignedIn ? <Outlet /> : <Navigate to={paths.login} replace />;
}

export function GuestOnly() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return null;
  return isSignedIn ? <Navigate to={paths.checker} replace /> : <Outlet />;
}
