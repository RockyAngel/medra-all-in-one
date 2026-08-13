-- ============ MEMBERSHIP / PROMOTION / COUPON / CAMPAIGN ENGINE ============

CREATE TYPE public.membership_audience AS ENUM ('customer','seller','rider');
CREATE TYPE public.subscription_status AS ENUM
  ('trialing','active','past_due','payment_failed','grace_period','paused','cancelled','expired','suspended');
CREATE TYPE public.funding_source AS ENUM ('platform','seller','shared');
CREATE TYPE public.promotion_kind AS ENUM
  ('percent_off','amount_off','buy_x_get_y','category_discount','product_discount','store_discount',
   'cart_discount','delivery_discount','member_discount','flash_deal');
CREATE TYPE public.promotion_status AS ENUM ('draft','pending_approval','active','paused','ended','rejected');
CREATE TYPE public.invoice_status AS ENUM ('pending','processing','paid','failed','refunded','cancelled');

-- ---------------------------------- plans ----------------------------------
CREATE TABLE public.membership_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  audience public.membership_audience NOT NULL,
  description text,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  currency text NOT NULL DEFAULT 'NGN',
  billing_period text NOT NULL DEFAULT 'monthly',
  trial_days integer NOT NULL DEFAULT 0 CHECK (trial_days >= 0),
  benefits text[] NOT NULL DEFAULT '{}',
  entitlements jsonb NOT NULL DEFAULT '{}'::jsonb,
  eligibility jsonb NOT NULL DEFAULT '{}'::jsonb,
  max_members integer,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT false,
  starts_at timestamptz,
  ends_at timestamptz,
  archived_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.membership_plans TO anon;
GRANT SELECT, INSERT, UPDATE ON public.membership_plans TO authenticated;
GRANT ALL ON public.membership_plans TO service_role;
ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans readable when live" ON public.membership_plans FOR SELECT
  USING (archived_at IS NULL AND is_active);
CREATE POLICY "staff read all plans" ON public.membership_plans FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE TRIGGER membership_plans_updated BEFORE UPDATE ON public.membership_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------ subscriptions ------------------------------
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payer_id uuid REFERENCES auth.users(id),
  plan_id uuid NOT NULL REFERENCES public.membership_plans(id),
  audience public.membership_audience NOT NULL,
  price_paid numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'NGN',
  billing_period text NOT NULL DEFAULT 'monthly',
  entitlements_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  benefits_snapshot text[] NOT NULL DEFAULT '{}',
  status public.subscription_status NOT NULL DEFAULT 'trialing',
  trial_start timestamptz,
  trial_end timestamptz,
  started_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  next_billing_at timestamptz,
  grace_until timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  cancelled_at timestamptz,
  expires_at timestamptz,
  provider text,
  provider_reference text,
  reference text NOT NULL DEFAULT 'SUB-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX subscriptions_one_live_per_audience
  ON public.subscriptions (user_id, audience)
  WHERE status IN ('trialing','active','past_due','payment_failed','grace_period','paused');
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subscriptions" ON public.subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR payer_id = auth.uid());
CREATE POLICY "staff read subscriptions" ON public.subscriptions FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE TRIGGER subscriptions_updated BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id),
  event text NOT NULL,
  from_status public.subscription_status,
  to_status public.subscription_status,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_events TO authenticated;
GRANT ALL ON public.subscription_events TO service_role;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own subscription events" ON public.subscription_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.id = subscription_id AND s.user_id = auth.uid())
         OR public.is_staff(auth.uid()));

CREATE TABLE public.subscription_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL DEFAULT 'NGN',
  reference text NOT NULL UNIQUE DEFAULT 'MINV-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),
  provider text,
  provider_reference text,
  provider_status text,
  status public.invoice_status NOT NULL DEFAULT 'pending',
  period_start timestamptz,
  period_end timestamptz,
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX subscription_invoices_provider_ref
  ON public.subscription_invoices (provider, provider_reference)
  WHERE provider_reference IS NOT NULL;
GRANT SELECT ON public.subscription_invoices TO authenticated;
GRANT ALL ON public.subscription_invoices TO service_role;
ALTER TABLE public.subscription_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own invoices" ON public.subscription_invoices FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- -------------------------------- campaigns --------------------------------
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  audience text NOT NULL DEFAULT 'all_customers',
  budget numeric(12,2),
  budget_used numeric(12,2) NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  status public.promotion_status NOT NULL DEFAULT 'draft',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read campaigns" ON public.campaigns FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE TRIGGER campaigns_updated BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -------------------------------- promotions -------------------------------
CREATE TABLE public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  kind public.promotion_kind NOT NULL,
  funding_source public.funding_source NOT NULL,
  platform_funded_percent numeric(5,2) NOT NULL DEFAULT 0 CHECK (platform_funded_percent BETWEEN 0 AND 100),
  discount_value numeric(12,2) NOT NULL CHECK (discount_value >= 0),
  max_discount numeric(12,2),
  min_order numeric(12,2) NOT NULL DEFAULT 0,
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  seller_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  product_ids uuid[] NOT NULL DEFAULT '{}',
  category_ids uuid[] NOT NULL DEFAULT '{}',
  requires_membership boolean NOT NULL DEFAULT false,
  first_order_only boolean NOT NULL DEFAULT false,
  reward_multiplier numeric(5,2),
  priority integer NOT NULL DEFAULT 100,
  stackable boolean NOT NULL DEFAULT false,
  exclusive boolean NOT NULL DEFAULT false,
  quantity_limit integer,
  quantity_used integer NOT NULL DEFAULT 0,
  per_user_limit integer,
  budget numeric(12,2),
  budget_used numeric(12,2) NOT NULL DEFAULT 0,
  starts_at timestamptz,
  ends_at timestamptz,
  status public.promotion_status NOT NULL DEFAULT 'draft',
  approval_note text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX promotions_live_idx ON public.promotions (status, starts_at, ends_at);
GRANT SELECT ON public.promotions TO anon;
GRANT SELECT ON public.promotions TO authenticated;
GRANT ALL ON public.promotions TO service_role;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "active promotions are public" ON public.promotions FOR SELECT
  USING (status = 'active'
         AND (starts_at IS NULL OR starts_at <= now())
         AND (ends_at IS NULL OR ends_at > now()));
CREATE POLICY "sellers read own promotions" ON public.promotions FOR SELECT TO authenticated
  USING (seller_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE TRIGGER promotions_updated BEFORE UPDATE ON public.promotions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.promotion_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  platform_funded numeric(12,2) NOT NULL DEFAULT 0,
  seller_funded numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (promotion_id, order_id)
);
GRANT SELECT ON public.promotion_redemptions TO authenticated;
GRANT ALL ON public.promotion_redemptions TO service_role;
ALTER TABLE public.promotion_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or seller or staff redemptions" ON public.promotion_redemptions FOR SELECT TO authenticated
  USING (user_id = auth.uid()
         OR public.is_staff(auth.uid())
         OR EXISTS (SELECT 1 FROM public.promotions p WHERE p.id = promotion_id AND p.seller_id = auth.uid()));

-- --------------------------------- coupons ---------------------------------
CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  code text NOT NULL UNIQUE,
  description text,
  discount_type text NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent','amount','delivery_percent','delivery_amount')),
  discount_value numeric(12,2) NOT NULL CHECK (discount_value >= 0),
  min_order numeric(12,2) NOT NULL DEFAULT 0,
  max_discount numeric(12,2),
  funding_source public.funding_source NOT NULL DEFAULT 'platform',
  platform_funded_percent numeric(5,2) NOT NULL DEFAULT 100 CHECK (platform_funded_percent BETWEEN 0 AND 100),
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit integer,
  usage_count integer NOT NULL DEFAULT 0,
  per_user_limit integer NOT NULL DEFAULT 1,
  budget numeric(12,2),
  budget_used numeric(12,2) NOT NULL DEFAULT 0,
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE,
  seller_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  eligible_category_ids uuid[] NOT NULL DEFAULT '{}',
  eligible_product_ids uuid[] NOT NULL DEFAULT '{}',
  eligible_user_ids uuid[] NOT NULL DEFAULT '{}',
  requires_membership boolean NOT NULL DEFAULT false,
  first_order_only boolean NOT NULL DEFAULT false,
  stackable boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX coupons_code_upper ON public.coupons (upper(code));
GRANT SELECT ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "seller and staff read coupons" ON public.coupons FOR SELECT TO authenticated
  USING (seller_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE TRIGGER coupons_updated BEFORE UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.coupon_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  platform_funded numeric(12,2) NOT NULL DEFAULT 0,
  seller_funded numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (coupon_id, order_id)
);
GRANT SELECT ON public.coupon_redemptions TO authenticated;
GRANT ALL ON public.coupon_redemptions TO service_role;
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or seller or staff coupon redemptions" ON public.coupon_redemptions FOR SELECT TO authenticated
  USING (user_id = auth.uid()
         OR public.is_staff(auth.uid())
         OR EXISTS (SELECT 1 FROM public.coupons c WHERE c.id = coupon_id AND c.seller_id = auth.uid()));

-- ---------------------------- featured placements --------------------------
CREATE TABLE public.featured_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('product','store','category','campaign')),
  entity_id uuid NOT NULL,
  placement text NOT NULL DEFAULT 'home_hero',
  is_sponsored boolean NOT NULL DEFAULT false,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  status public.promotion_status NOT NULL DEFAULT 'active',
  display_order integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.featured_placements TO anon, authenticated;
GRANT ALL ON public.featured_placements TO service_role;
ALTER TABLE public.featured_placements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "live placements are public" ON public.featured_placements FOR SELECT
  USING (status = 'active' AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now()));

-- ------------------------------ promo credits ------------------------------
CREATE TABLE public.promo_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  remaining numeric(12,2) NOT NULL CHECK (remaining >= 0),
  currency text NOT NULL DEFAULT 'NGN',
  source text NOT NULL DEFAULT 'platform_grant',
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.promo_credits TO authenticated;
GRANT ALL ON public.promo_credits TO service_role;
ALTER TABLE public.promo_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own promo credits" ON public.promo_credits FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- --------------------- order-level promotion snapshots ---------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'NGN',
  ADD COLUMN IF NOT EXISTS coupon_id uuid REFERENCES public.coupons(id),
  ADD COLUMN IF NOT EXISTS coupon_code text,
  ADD COLUMN IF NOT EXISTS coupon_discount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promotion_discount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS membership_discount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_funded_discount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seller_funded_discount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;