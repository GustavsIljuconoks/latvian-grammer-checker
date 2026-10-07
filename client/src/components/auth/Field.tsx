import { REGEXP_ONLY_DIGITS } from "input-otp";
import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { t } from "@/i18n";

export function Field({ id, label, ...props }: { id: string; label: string } & ComponentProps<"input">) {
  return (
    <div className="mb-[18px] flex flex-col">
      <Label htmlFor={id} className="mb-2 text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        name={id}
        className="h-12 rounded-xl border-0 bg-secondary px-4 text-sm shadow-none focus-visible:bg-[#ececE6] focus-visible:ring-2 focus-visible:ring-foreground/15"
        {...props}
      />
    </div>
  );
}

/** Clerk's 6-digit email code. input-otp renders a real <input name="code">, so form actions read it as usual. */
export function CodeField({ id = "code" }: { id?: string }) {
  const slot = "size-12 border-0 bg-secondary text-base first:rounded-l-xl last:rounded-r-xl";
  return (
    <div className="mb-[18px] flex flex-col">
      <Label htmlFor={id} className="mb-2 text-xs font-medium text-muted-foreground">
        {t.auth.code}
      </Label>
      <InputOTP id={id} name={id} maxLength={6} pattern={REGEXP_ONLY_DIGITS} autoComplete="one-time-code" autoFocus required containerClassName="justify-center">
        <InputOTPGroup>
          {[0, 1, 2].map((i) => (
            <InputOTPSlot key={i} index={i} className={slot} />
          ))}
        </InputOTPGroup>
        <InputOTPSeparator />
        <InputOTPGroup>
          {[3, 4, 5].map((i) => (
            <InputOTPSlot key={i} index={i} className={slot} />
          ))}
        </InputOTPGroup>
      </InputOTP>
    </div>
  );
}

export function SubmitButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <Button type="submit" disabled={busy} className="h-[50px] w-full rounded-xl text-sm font-semibold">
      {children}
    </Button>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="mb-4 text-center text-[13px] text-destructive">
      {children}
    </p>
  );
}
