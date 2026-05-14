// app/runpod/page.tsx

'use client';

import { useState, useEffect } from 'react';
import Nav from '../components/nav';

const ASPECT_RATIOS = [
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' },
  { label: '2:3', value: '2:3' },
  { label: '1:1', value: '1:1' },
];

const RATIO_W: Record<string, number> = { '16:9': 16, '9:16': 9, '2:3': 2, '1:1': 1 };
const RATIO_H: Record<string, number> = { '16:9': 9, '9:16': 16, '2:3': 3, '1:1': 1 };

interface GeneratedImage {
  url: string;
  prompt: string;
  ratio: string;
  seed: number | null;
}

export default function RunPodPage() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [ratio, setRatio] = useState('9:16');
  const [seed, setSeed] = useState('');
  const [steps, setSteps] = useState('15');
  const [guidance, setGuidance] = useState('3.5');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedImage | null>(null);

  // Session persistence
  useEffect(() => {
    const saved = sessionStorage.getItem('admin-pwd');
    if (saved) {
      setPassword(saved);
      setAuthenticated(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    sessionStorage.setItem('admin-pwd', password);
    setAuthenticated(true);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Enter a prompt before generating.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const parsedSeed = seed.trim() !== '' ? parseInt(seed, 10) : undefined;

      const res = await fetch('/api/runpod', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': password,
        },
        body: JSON.stringify({
          prompt,
          aspectRatio: ratio,
          seed: parsedSeed,
          steps: parseInt(steps, 10),
          guidance: parseFloat(guidance),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      if (!data.url) throw new Error('No image received');

      setResult({
        url: data.url,
        prompt,
        ratio,
        seed: data.seed ?? null,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const downloadImage = (format: 'png' | 'jpeg') => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = `runpod-${Date.now()}.${format}`;
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
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleLogin(e);
              }}
              autoFocus
            />
            <button onClick={handleLogin} className="login-button">
              Enter
            </button>
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
          <h1 className="gen-title">RunPod — Flux 1 Dev</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '-12px' }}>
            No safety filters · Your infrastructure
          </p>

          {/* Prompt */}
          <div className="gen-field">
            <label className="gen-label">Prompt</label>
            <textarea
              className="gen-textarea"
              placeholder="Describe the image you want to create..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={5}
            />
            <div className="gen-char-count">{prompt.length} chars</div>
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

          {/* Steps & Guidance */}
          <div className="gen-field">
            <label className="gen-label">Steps & Guidance</label>
            <div className="gen-seed-row">
              <div style={{ flex: 1 }}>
                <input
                  type="number"
                  className="gen-seed-input"
                  placeholder="Steps"
                  value={steps}
                  onChange={(e) => setSteps(e.target.value)}
                  min={1}
                  max={50}
                />
                <div className="gen-char-count">steps</div>
              </div>
              <div style={{ flex: 1 }}>
                <input
                  type="number"
                  className="gen-seed-input"
                  placeholder="Guidance"
                  value={guidance}
                  onChange={(e) => setGuidance(e.target.value)}
                  min={0}
                  max={20}
                  step={0.5}
                />
                <div className="gen-char-count">guidance</div>
              </div>
            </div>
          </div>

          {/* Seed */}
          <div className="gen-field">
            <label className="gen-label">
              Seed <span className="gen-optional">(optional)</span>
            </label>
            <div className="gen-seed-row">
              <input
                type="number"
                className="gen-seed-input"
                placeholder="e.g. 1234567"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                min={0}
                max={2147483647}
              />
              {result && result.seed !== null && (
                <button
                  className="gen-seed-reuse"
                  onClick={() => setSeed(String(result.seed))}
                >
                  ↺ Reuse {result.seed}
                </button>
              )}
            </div>
          </div>

          {error && <div className="gen-error">{error}</div>}

          <button className="gen-button" onClick={handleGenerate} disabled={loading}>
            {loading ? 'Generating...' : 'Generate Image'}
          </button>
        </div>

        {/* Right: Preview */}
        <div className="gen-preview-panel">
          <div className="gen-preview-frame" style={{ aspectRatio: previewAspect }}>
            {loading && (
              <div className="gen-loading">
                <div className="loading-spinner" />
                <p>Generating on RunPod...</p>
              </div>
            )}
            {result && !loading ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={result.url} alt={result.prompt} className="gen-result-img" />
            ) : !loading ? (
              <div className="gen-empty">
                <div className="gen-empty-icon">✦</div>
                <p>Your image will appear here</p>
              </div>
            ) : null}
          </div>

          {result && !loading && (
            <div className="gen-download-bar">
              <span className="gen-seed-badge">
                Seed: {result.seed ?? 'auto'}
              </span>
              <div className="gen-download-btns">
                <button className="gen-dl-btn" onClick={() => downloadImage('png')}>
                  PNG
                </button>
                <button className="gen-dl-btn" onClick={() => downloadImage('jpeg')}>
                  JPEG
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}