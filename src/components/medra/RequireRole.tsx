import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { useAuth, type AppRole, ROLE_HOME } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LoadingState } from "./States";
import { Logo } from "./Logo";

export function RequireRole({ roles, children }: { roles: AppRole[]; children: ReactNode }) {
  const { loading, session, roles: myRoles, hasAnyRole } = useAuth();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <LoadingState label="Checking your access…" />
      </div>
    );
  }

  if (!session) {
    return (
      <Gate
        title="Sign in to continue"
        body="This area is only available to authorised Medra accounts."
        action={
          <Button asChild className="rounded-full px-6 font-bold">
            <Link to="/login">Go to log in</Link>
          </Button>
        }
      />
    );
  }

  if (!hasAnyRole(roles)) {
    const fallback = (myRoles[0] ? ROLE_HOME[myRoles[0]] : "/") as "/";
    return (
      <Gate
        title="You don't have access to this area"
        body="Your account role doesn't permit this dashboard. If you believe this is a mistake, contact platform support."
        action={
          <Button asChild variant="outline" className="rounded-full px-6 font-bold">
            <Link to={fallback}>Back to your dashboard</Link>
          </Button>
        }
      />
    );
  }

  return <>{children}</>;
}

function Gate({ title, body, action }: { title: string; body: string; action: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-5">
      <div className="surface-card w-full max-w-md p-8 text-center">
        <div className="flex justify-center">
          <Logo size={40} />
        </div>
        <span className="mt-6 inline-grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
          <Lock className="size-5" />
        </span>
        <h1 className="mt-4 text-xl font-extrabold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <div className="mt-6 flex justify-center">{action}</div>
      </div>
    </div>
  );
}
