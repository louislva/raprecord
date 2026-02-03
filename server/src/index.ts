import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOWNLOADS_DIR = path.join(__dirname, '../../downloads');
const METADATA_FILE = path.join(DOWNLOADS_DIR, 'metadata.json');
const YT_DLP = '/usr/local/bin/yt-dlp';
const SPAWN_ENV = { ...process.env, PATH: `${process.env.HOME}/.deno/bin:${process.env.PATH}` };

// Ensure downloads directory exists
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// Load or initialize metadata (maps video ID to title)
interface Metadata {
  [videoId: string]: { title: string };
}

function loadMetadata(): Metadata {
  if (fs.existsSync(METADATA_FILE)) {
    return JSON.parse(fs.readFileSync(METADATA_FILE, 'utf-8'));
  }
  return {};
}

function saveMetadata(metadata: Metadata): void {
  fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
}

// Extract video ID from YouTube URL
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/  // Just the ID itself
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

const app = express();
app.use(cors());
app.use(express.json());

interface DownloadResult {
  id: string;
  title: string;
  cached: boolean;
}

app.post('/api/download', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const videoId = extractVideoId(url);
  if (!videoId) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }

  const outputPath = path.join(DOWNLOADS_DIR, `${videoId}.mp3`);
  const metadata = loadMetadata();

  // Check if already downloaded
  if (fs.existsSync(outputPath) && metadata[videoId]) {
    console.log(`Cache hit for ${videoId}: ${metadata[videoId].title}`);
    return res.json({ id: videoId, title: metadata[videoId].title, cached: true });
  }

  console.log(`Download request for: ${url} (videoId: ${videoId})`);

  try {
    const result = await new Promise<DownloadResult>((resolve, reject) => {
      // First, get the title
      const titleProcess = spawn(YT_DLP, ['--get-title', url], { env: SPAWN_ENV });
      let title = '';
      let titleError = '';

      titleProcess.stdout.on('data', (data) => {
        title += data.toString().trim();
      });

      titleProcess.stderr.on('data', (data) => {
        titleError += data.toString();
      });

      titleProcess.on('close', (code) => {
        if (code !== 0) {
          console.error(`yt-dlp title error: ${titleError}`);
          reject(new Error(`Failed to get video info: ${titleError || 'Unknown error'}`));
          return;
        }

        // Now download the audio
        const downloadProcess = spawn(YT_DLP, [
          '-x',
          '--audio-format', 'mp3',
          '-o', outputPath,
          url
        ], { env: SPAWN_ENV });

        let errorOutput = '';

        downloadProcess.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        downloadProcess.on('close', (downloadCode) => {
          if (downloadCode === 0) {
            // Save metadata
            metadata[videoId] = { title };
            saveMetadata(metadata);
            console.log(`Downloaded ${videoId}: ${title}`);
            resolve({ id: videoId, title, cached: false });
          } else {
            reject(new Error(`yt-dlp failed: ${errorOutput}`));
          }
        });
      });
    });

    res.json(result);
  } catch (error) {
    console.error('Download error:', error);
    const message = error instanceof Error ? error.message : 'Failed to download audio';
    res.status(500).json({ error: message });
  }
});

app.get('/api/audio/:id', (req, res) => {
  const { id } = req.params;
  const filePath = path.join(DOWNLOADS_DIR, `${id}.mp3`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Audio file not found' });
  }

  const stat = fs.statSync(filePath);
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Content-Length', stat.size);
  res.setHeader('Accept-Ranges', 'bytes');

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
