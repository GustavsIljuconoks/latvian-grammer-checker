import { isClerkAPIResponseError } from "@clerk/react/errors";
import { t } from "@/i18n";

// translates a Clerk sign-up or password error. clerk's own messages are english, so only its code is used.
export function clerkErrorMessage(error: unknown, fallback: string): string {
  const first = isClerkAPIResponseError(error) ? error.errors[0] : undefined;

  switch (first?.code) {
    case "form_password_length_too_short": {
      const min = Number(first.message.match(/\d+/)?.[0]);
      return min ? t.auth.passwordTooShort(min) : t.auth.passwordTooShortGeneric;
    }
    case "form_password_pwned":
      return t.auth.passwordPwned;
    case "form_password_not_strong_enough":
    case "form_password_validation_failed":
      return t.auth.passwordWeak;
    case "form_identifier_exists":
      return t.auth.emailTaken;
    case "form_param_format_invalid":
      return first.meta?.paramName === "email_address" ? t.auth.emailInvalid : fallback;
    default:
      return fallback;
  }
}
