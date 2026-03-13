-- ============================================
-- Lesson Resources & Tests
-- Adds support for multiple content types per lesson:
-- videos, documents, study guides, downloads
-- Plus standalone tests (separate from lesson quizzes)
-- ============================================

-- Resources attached to lessons (videos, docs, PDFs, study guides)
CREATE TABLE lesson_resources (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('video', 'document', 'study_guide', 'download', 'link', 'image')),
  title text NOT NULL,
  description text,
  -- For videos
  video_provider text CHECK (video_provider IN ('youtube', 'bunny', 'mux', 'vimeo')),
  video_id text,
  video_duration_sec int,
  -- For documents/downloads
  file_url text,
  file_name text,
  file_size_bytes bigint,
  file_type text,          -- 'pdf', 'docx', 'xlsx', 'pptx', etc.
  -- For links
  external_url text,
  -- Metadata
  sort_order int NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,  -- primary video shown in lesson viewer
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_lesson_resources_lesson ON lesson_resources(lesson_id);

-- Tests (standalone assessments, separate from lesson quizzes)
-- Can be module-level or course-level
CREATE TABLE tests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id uuid REFERENCES courses(id) ON DELETE CASCADE,
  module_id uuid REFERENCES modules(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'test' CHECK (type IN ('test', 'exam', 'assessment', 'practice')),
  questions jsonb NOT NULL DEFAULT '[]',
  passing_score int NOT NULL DEFAULT 70,
  time_limit_min int,                -- null = no time limit
  max_attempts int DEFAULT 3,        -- null = unlimited
  shuffle_questions boolean NOT NULL DEFAULT false,
  shuffle_options boolean NOT NULL DEFAULT false,
  show_answers_after boolean NOT NULL DEFAULT true,
  published boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tests_course ON tests(course_id);
CREATE INDEX idx_tests_module ON tests(module_id);

-- Test attempts
CREATE TABLE test_attempts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  test_id uuid NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  score int NOT NULL DEFAULT 0,
  answers jsonb NOT NULL DEFAULT '[]',
  passed boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  time_spent_sec int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_test_attempts_user ON test_attempts(user_id);
CREATE INDEX idx_test_attempts_test ON test_attempts(test_id);

-- RLS
ALTER TABLE lesson_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_attempts ENABLE ROW LEVEL SECURITY;

-- Students can read resources for published courses
CREATE POLICY "students_read_resources" ON lesson_resources
  FOR SELECT TO authenticated
  USING (true);

-- Students can read published tests
CREATE POLICY "students_read_tests" ON tests
  FOR SELECT TO authenticated
  USING (published = true);

-- Students manage own test attempts
CREATE POLICY "students_own_attempts" ON test_attempts
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Admin full access
CREATE POLICY "admins_all_resources" ON lesson_resources
  FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "admins_all_tests" ON tests
  FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "admins_read_attempts" ON test_attempts
  FOR SELECT TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
