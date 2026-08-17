INSERT INTO public.feature_flags (key, label, description, category, enabled, state)
VALUES (
  'demo.login.enabled',
  'Demo role logins',
  'Allows anyone to sign in to fixed demo accounts for each role. Turn this off before launch.',
  'platform',
  true,
  'beta'
)
ON CONFLICT (key) DO NOTHING;