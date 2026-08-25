CREATE POLICY "applicants upload own application documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'application-documents'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "applicants read own application documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'application-documents'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "staff read application documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'application-documents'
  AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin'))
);