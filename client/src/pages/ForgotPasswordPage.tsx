import { useSignIn } from "@clerk/react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { clerkErrorMessage } from "@/components/auth/clerkError";
import { CodeField, Field, FormError, SubmitButton } from "@/components/auth/Field";
import { goTo } from "@/components/auth/goTo";
import { t } from "@/i18n";
import { paths } from "@/routes";

export function ForgotPasswordPage() {
  const { signIn, fetchStatus } = useSignIn();
  const navigate = useNavigate();
  const [codeSent, setCodeSent] = useState(false);
  const [error, setError] = useState<string>();
  const busy = fetchStatus === "fetching";

  async function sendCode(form: FormData) {
    setError(undefined);
    const { error: createError } = await signIn.create({ identifier: String(form.get("email")) });
    if (createError) return setError(t.auth.resetFailed);
    const { error: sendError } = await signIn.resetPasswordEmailCode.sendCode();
    if (sendError) return setError(t.auth.resetFailed);
    setCodeSent(true);
  }

  async function verifyCode(form: FormData) {
    setError(undefined);
    const { error } = await signIn.resetPasswordEmailCode.verifyCode({ code: String(form.get("code")) });
    if (error) setError(t.auth.wrongCode);
  }

  async function setPassword(form: FormData) {
    setError(undefined);
    const { error } = await signIn.resetPasswordEmailCode.submitPassword({
      password: String(form.get("password")),
      signOutOfOtherSessions: true,
    });
    if (error) return setError(clerkErrorMessage(error, t.auth.resetFailed));
    if (signIn.status === "complete") {
      await signIn.finalize({ navigate: ({ decorateUrl }) => goTo(decorateUrl(paths.checker), navigate) });
    } else {
      setError(t.auth.unsupportedStep);
    }
  }

  const backLink = (
    <Link to={paths.login} className="auth-link mx-auto mt-[22px] text-[13px] text-muted-foreground">
      {t.auth.backToLogin}
    </Link>
  );

  if (signIn.status === "needs_new_password") {
    return (
      <AuthLayout title={t.auth.newPasswordTitle} subtitle={t.auth.newPasswordSubtitle}>
        <form action={setPassword} className="flex flex-col">
          <Field id="password" type="password" label={t.auth.newPassword} autoComplete="new-password" required />
          {error && <FormError>{error}</FormError>}
          <SubmitButton busy={busy}>{t.auth.setPassword}</SubmitButton>
        </form>
        {backLink}
      </AuthLayout>
    );
  }

  if (codeSent) {
    return (
      <AuthLayout title={t.auth.verifyTitle} subtitle={t.auth.verifySubtitle}>
        <form action={verifyCode} className="flex flex-col">
          <CodeField />
          {error && <FormError>{error}</FormError>}
          <SubmitButton busy={busy}>{t.auth.verify}</SubmitButton>
        </form>
        {backLink}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t.auth.resetTitle} subtitle={t.auth.resetSubtitle}>
      <form action={sendCode} className="flex flex-col">
        <Field id="email" type="email" label={t.auth.email} placeholder={t.auth.emailPlaceholder} autoComplete="email" required />
        {error && <FormError>{error}</FormError>}
        <SubmitButton busy={busy}>{t.auth.sendCode}</SubmitButton>
      </form>
      {backLink}
    </AuthLayout>
  );
}
