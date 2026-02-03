import { useState } from 'react';

interface Track {
  id: string;
  title: string;
}

function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [track, setTrack] = useState<Track | null>(null);

  const handleDownload = async () => {
    if (!url.trim()) return;

    setLoading(true);
    setError('');
    setTrack(null);

    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Download failed');
      }

      setTrack(data);
      setUrl('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      // Clean up yt-dlp error messages for display
      if (message.includes('Sign in to confirm')) {
        setError('This video is blocked by YouTube bot detection. Try a different video.');
      } else if (message.includes('Video unavailable')) {
        setError('Video unavailable or private.');
      } else if (message.includes('Invalid YouTube URL')) {
        setError('Invalid YouTube URL. Please check and try again.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>RapRecord</h1>

      <div className="input-group">
        <input
          type="text"
          placeholder="Paste YouTube URL..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={loading}
        />
        <button onClick={handleDownload} disabled={loading || !url.trim()}>
          {loading ? 'Downloading...' : 'Download'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {track && (
        <div className="player">
          <h2>{track.title}</h2>
          <audio controls autoPlay src={`/api/audio/${track.id}`}>
            Your browser does not support the audio element.
          </audio>
        </div>
      )}
    </div>
  );
}

export default App;
