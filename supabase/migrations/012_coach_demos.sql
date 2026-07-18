-- Coach demo content management
-- Tracks what needs recording, instructions for coaches, and uploaded videos

CREATE TABLE IF NOT EXISTS public.coach_demos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- What course/lesson this demo belongs to
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  module_title TEXT NOT NULL,
  lesson_title TEXT NOT NULL,

  -- The demo details
  title TEXT NOT NULL,
  description TEXT,
  instructions TEXT NOT NULL,

  -- Tags for filtering
  tags TEXT[] DEFAULT '{}',
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  estimated_duration TEXT,

  -- Recording status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'recording', 'uploaded', 'review', 'approved', 'published')),
  assigned_to TEXT,

  -- Video upload
  video_url TEXT,
  video_provider TEXT CHECK (video_provider IN ('bunny', 'youtube', 'mux', NULL)),
  video_id TEXT,
  thumbnail_url TEXT,

  -- Linked lesson (after published, this gets linked)
  linked_lesson_id UUID REFERENCES public.lessons(id) ON DELETE SET NULL,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

-- RLS
ALTER TABLE public.coach_demos ENABLE ROW LEVEL SECURITY;

-- Admin full access
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin full access coach_demos') THEN
    CREATE POLICY "Admin full access coach_demos" ON public.coach_demos FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_coach_demo_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS coach_demo_updated ON public.coach_demos;
CREATE TRIGGER coach_demo_updated BEFORE UPDATE ON public.coach_demos
FOR EACH ROW EXECUTE FUNCTION update_coach_demo_timestamp();

-- Index
CREATE INDEX IF NOT EXISTS idx_coach_demos_status ON public.coach_demos(status);
CREATE INDEX IF NOT EXISTS idx_coach_demos_course ON public.coach_demos(course_id);
