import { createServerFn } from "@tanstack/react-start";
import { DEMO_ACCOUNTS, DEMO_PASSWORD, isDemoRole, type DemoRole } from "@/lib/demo";

/**
 * Creates (or repairs) the fixed demo account for a role and returns the
 * credentials the browser should sign in with.
 */
export const ensureDemoAccount = createServerFn({ method: "POST" })
  .inputValidator((input: { role: string }) => {
    if (!isDemoRole(input.role)) throw new Error("Unknown demo role.");
    return { role: input.role };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: flag, error: flagError } = await supabaseAdmin
      .from("feature_flags")
      .select("enabled")
      .eq("key", "demo.login.enabled")
      .maybeSingle();
    if (flagError) throw new Error(flagError.message);
    if (!flag?.enabled) {
      throw new Error("Demo logins are switched off for this platform.");
    }

    const account = DEMO_ACCOUNTS[data.role];

    // Find an existing demo user without listing the whole directory page by page.
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", account.email)
      .maybeSingle();

    let userId = existingProfile?.id ?? null;

    if (userId) {
      // Keep the password predictable even if it was changed during testing.
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: DEMO_PASSWORD,
        email_confirm: true,
      });
      if (error) userId = null;
    }

    if (!userId) {
      const created = await supabaseAdmin.auth.admin.createUser({
        email: account.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { first_name: account.first, last_name: account.last, demo: true },
      });
      if (created.error || !created.data.user) {
        throw new Error(created.error?.message ?? "Could not prepare the demo account.");
      }
      userId = created.data.user.id;
    }

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: userId,
      email: account.email,
      first_name: account.first,
      last_name: account.last,
    });
    if (profileError) throw new Error(profileError.message);

    // Customer is the baseline role for every account; add the demo role too.
    const roles: DemoRole[] = data.role === "customer" ? ["customer"] : ["customer", data.role];
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert(
        roles.map((role) => ({ user_id: userId as string, role })),
        { onConflict: "user_id,role" },
      );
    if (roleError) throw new Error(roleError.message);

    return { email: account.email, password: DEMO_PASSWORD, home: account.home };
  });
