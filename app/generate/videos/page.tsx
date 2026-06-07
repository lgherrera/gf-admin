// app/generate/videos/page.tsx

'use client';

import { useState, useRef, useEffect } from 'react';
import Nav from '../../components/nav';

const ASPECT_RATIOS = [
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' },
];

const MODELS = [
  { label: 'Seedance 2.0', value: 'seedance', sub: 'ByteDance · fal' },
  { label: 'Grok Imagine 1.5', value: 'grok', sub: 'xAI · fal' },
];

const RATIO_W: Record<string, number> = { '16:9': 16, '9:16': 9 };
const RATIO_H: Record<string, number> = { '16:9': 9, '9:16': 16 };

export default function VideosPage() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [ratio, setRatio] = useState('9:16');
  const [model, setModel] = useState('seedance');
  const [duration, setDuration] = useState(12);
  const [generateAudio, setGenerateAudio] = useState(false);

  // Reference image (required for image-to-video)
  const [refImage, setRefImage] = useState<File | null>(null);
  const [refPreview, setRefPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);

  // Session persistence
  useEffect(() => {
    const saved = sessionStorage.getItem('admin-pwd');
    if (saved) {
      setPassword(saved);
      setAuthenticated(true);
    }
  }, []);

  // Elapsed timer
  useEffect(() => {
    if (!loading) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [loading]);

  const handleLogin = (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    sessionStorage.setItem('admin-pwd', password);
    setAuthenticated(true);
  };

  const handleFile = (file: File | null) => {
    if (!file || !file.type.startsWith('image/')) return;
    setRefImage(file);
    const reader = new FileReader();
    reader.onload = (e) => setRefPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const removeRef = () => {
    setRefImage(null);
    setRefPreview(null);
  };

  const compressImage = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 1024;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          const scale = MAX / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        const dataUri = canvas.toDataURL('image/jpeg', 0.85);
        resolve(dataUri.split(',')[1]);
      };
      img.onerror = reject;
      img.src = url;
    });

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${sec}s`;
  };

  const handleGenerate = async () => {
    if (!refImage) {
      setError('Upload a reference image first.');
      return;
    }
    setLoading(true);
    setError(null);
    setResultUrl(null);

    try {
      const base64 = await compressImage(refImage);

      const res = await fetch('/api/generate/video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': password,
        },
        body: JSON.stringify({
          prompt: prompt.trim() || undefined,
          aspectRatio: ratio,
          duration,
          model,
          referenceImage: base64,
          generateAudio,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      if (!data.url) throw new Error('No video URL received');

      setResultUrl(data.url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const downloadVideo = () => {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = `video-${Date.now()}.mp4`;
    a.click();
  };

  if (!authenticated) {
    return (
      <div className="login-container">
        <div className="login-card">
          <h1 className="login-title">Polola IA</h1>
          <p className="login-subtitle">Admin Dashboard</p>
          <div className="login-form">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="login-input"
              onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(e); }}
              autoFocus
            />
            <button onClick={handleLogin} className="login-button">Enter</button>
          </div>
        </div>
      </div>
    );
  }

  const previewAspect = `${RATIO_W[ratio]} / ${RATIO_H[ratio]}`;

  return (
    <>
      <Nav />
      <div className="gen-page">
        {/* Left: Controls */}
        <div className="gen-controls">
          <h1 className="gen-title">Video Generation</h1>

          {/* Model */}
          <div className="gen-field">
            <label className="gen-label">Model</label>
            <div className="gen-model-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
              {MODELS.map((m) => (
                <button
                  key={m.value}
                  className={`gen-model-btn ${model === m.value ? 'gen-model-active' : ''}`}
                  onClick={() => setModel(m.value)}
                >
                  <span className="gen-model-name">{m.label}</span>
                  <span className="gen-model-sub">{m.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Prompt */}
          <div className="gen-field">
            <label className="gen-label">
              Prompt <span className="gen-optional">(optional — guides motion/action)</span>
            </label>
            <textarea
              className="gen-textarea"
              placeholder="Describe the motion or action you want..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
            />
          </div>

          {/* Aspect Ratio */}
          <div className="gen-field">
            <label className="gen-label">Aspect Ratio</label>
            <div className="gen-ratio-grid">
              {ASPECT_RATIOS.map((r) => (
                <button
                  key={r.value}
                  className={`gen-ratio-btn ${ratio === r.value ? 'gen-ratio-active' : ''}`}
                  onClick={() => setRatio(r.value)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div className="gen-field">
            <label className="gen-label">Duration — {duration}s</label>
            <div className="ac-duration-row">
              <input
                type="range"
                className="ac-duration-slider"
                min={5}
                max={15}
                step={1}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
              <div className="ac-duration-labels">
                <span>5s</span>
                <span>10s</span>
                <span>15s</span>
              </div>
            </div>
          </div>

          {/* Generate Audio Toggle */}
          <div className="gen-field">
            <label
              className="gen-toggle-row"
              onClick={() => setGenerateAudio(!generateAudio)}
            >
              <span className={`gen-toggle-track ${generateAudio ? 'gen-toggle-on' : ''}`}>
                <span className="gen-toggle-thumb" />
              </span>
              <span className="gen-label" style={{ margin: 0 }}>Generate Audio</span>
            </label>
          </div>

          {error && <div className="gen-error">{error}</div>}

          <button
            className="gen-button"
            onClick={handleGenerate}
            disabled={loading || !refImage}
          >
            {loading ? `Generating... ${formatTime(elapsed)}` : 'Generate Video'}
          </button>
        </div>

        {/* Right: Preview */}
        <div className="gen-preview-panel">
          {/* Reference Image (required) */}
          <div className="gen-field" style={{ width: '100%', maxWidth: 500 }}>
            <label className="gen-label" style={{ color: 'var(--accent)' }}>
              Reference Image <span className="gen-optional">(required)</span>
            </label>
            {!refPreview ? (
              <div
                className={`gen-dropzone ${dragOver ? 'gen-dropzone-active' : ''}`}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handleFile(e.dataTransfer.files?.[0] ?? null);
                }}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => { handleFile(e.target.files?.[0] ?? null); e.target.value = ''; }}
                />
                <span className="gen-drop-icon">+</span>
                <span className="gen-drop-text">Drop or click to upload the starting frame</span>
              </div>
            ) : (
              <div className="ac-ref-preview-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={refPreview} alt="Reference" className="ac-ref-preview" />
                <button className="ac-ref-remove" onClick={removeRef}>×</button>
              </div>
            )}
          </div>

          {/* Video Preview */}
          <div className="gen-preview-frame" style={{ aspectRatio: previewAspect }}>
            {loading && (
              <div className="gen-loading">
                <div className="loading-spinner" />
                <p>Generating video... {formatTime(elapsed)}</p>
              </div>
            )}
            {resultUrl && !loading ? (
              <video
                src={resultUrl}
                controls
                autoPlay
                loop
                className="gen-result-video"
              />
            ) : !loading ? (
              <div className="gen-empty">
                <div className="gen-empty-icon">🎬</div>
                <p>Your video will appear here</p>
              </div>
            ) : null}
          </div>

          {resultUrl && !loading && (
            <div className="gen-download-bar">
              <span className="gen-seed-badge">{duration}s · {ratio} · 720p</span>
              <button className="gen-dl-btn" onClick={downloadVideo}>
                Download MP4
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}