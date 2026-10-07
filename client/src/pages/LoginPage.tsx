import { useSignIn } from "@clerk/react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { CodeField, Field, FormError, SubmitButton } from "@/components/auth/Field";
import { goTo } from "@/components/auth/goTo";
import { t } from "@/i18n";
import { paths } from "@/routes";

export function LoginPage() {
  const { signIn, fetchStatus } = useSignIn();
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  const busy = fetchStatus === "fetching";

  const finish = () =>
    signIn.finalize({ navigate: ({ decorateUrl }) => goTo(decorateUrl(paths.checker), navigate) });

  async function submit(form: FormData) {
    setError(undefined);
    const { error } = await signIn.password({
      emailAddress: String(form.get("email")),
      password: String(form.get("password")),
    });
    if (error) return setError(t.auth.wrongCredentials);
    if (signIn.status === "complete") await finish();
    else if (signIn.status === "needs_client_trust") await signIn.mfa.sendEmailCode();
    else setError(t.auth.unsupportedStep);
  }

  async function verify(form: FormData) {
    setError(undefined);
    const { error } = await signIn.mfa.verifyEmailCode({ code: String(form.get("code")) });
    if (error) return setError(t.auth.wrongCode);
    if (signIn.status === "complete") await finish();
  }

  if (signIn.status === "needs_client_trust") {
    return (
      <AuthLayout title={t.auth.verifyTitle} subtitle={t.auth.verifySubtitle}>
        <form action={verify} className="flex flex-col">
          <CodeField />
          {error && <FormError>{error}</FormError>}
          <SubmitButton busy={busy}>{t.auth.verify}</SubmitButton>
        </form>
        <div className="mt-5 flex justify-center gap-4 text-[13px] text-muted-foreground">
          <button type="button" className="auth-link" onClick={() => signIn.mfa.sendEmailCode()}>
            {t.auth.resendCode}
          </button>
          <button type="button" className="auth-link" onClick={() => signIn.reset()}>
            {t.auth.startOver}
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t.auth.loginTitle} subtitle={t.auth.loginSubtitle}>
      <form action={submit} className="flex flex-col">
        <Field id="email" type="email" label={t.auth.email} placeholder={t.auth.emailPlaceholder} autoComplete="email" required />
        <Field id="password" type="password" label={t.auth.password} placeholder="••••••••" autoComplete="current-password" required />
        <div className="-mt-2 mb-[22px] text-right">
          <Link to={paths.forgotPassword} className="auth-link text-xs text-muted-foreground">
            {t.auth.forgotPassword}
          </Link>
        </div>
        {error && <FormError>{error}</FormError>}
        <SubmitButton busy={busy}>{t.auth.login} →</SubmitButton>
      </form>
      <p className="mt-[22px] text-center text-[13px] text-muted-foreground">
        {t.auth.noAccount}{" "}
        <Link to={paths.signup} className="auth-link font-semibold text-foreground">
          {t.auth.signup}
        </Link>
      </p>
      <p className="mt-7 text-center text-[11px] leading-relaxed text-faint">{t.auth.terms}</p>
    </AuthLayout>
  );
}
