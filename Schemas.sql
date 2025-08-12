CREATE TABLE video_files (
  id UUID PRIMARY KEY,
  original_file_path TEXT NOT NULL,
  file_url TEXT,
  upload_status TEXT CHECK (upload_status IN ('Pending','Uploading','Completed')),
  transcoding_status TEXT CHECK (transcoding_status IN ('Pending','Transcoding','Completed')),
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE videos (
  id UUID PRIMARY KEY REFERENCES video_files(id) ON DELETE CASCADE,
  title TEXT,
  description TEXT,
  uploaded_at TIMESTAMP DEFAULT now(),
  likes INTEGER DEFAULT 0,
  dislikes INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  duration INTERVAL,
  uploader_id UUID,
  thumbnail_url TEXT,
  tags TEXT[],
  visibility TEXT DEFAULT 'private'
);
