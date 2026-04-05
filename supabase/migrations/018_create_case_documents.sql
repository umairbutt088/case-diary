-- Create the case_documents table
CREATE TABLE public.case_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.case_documents ENABLE ROW LEVEL SECURITY;

-- Policies for public.case_documents table
CREATE POLICY "Users can view their own case documents"
  ON public.case_documents FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own case documents"
  ON public.case_documents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own case documents"
  ON public.case_documents FOR DELETE
  USING (auth.uid() = user_id);

-- Setup Storage for Case Documents
INSERT INTO storage.buckets (id, name, public) 
VALUES ('case_documents', 'case_documents', false)
ON CONFLICT (id) DO NOTHING;

-- Policies for storage.objects (the bucket)
CREATE POLICY "Users can upload their own case documents"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'case_documents' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can select their own case documents"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'case_documents' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own case documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'case_documents' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );
