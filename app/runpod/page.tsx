// app/runpod/page.tsx

'use client';

import { useState, useEffect, useRef } from 'react';
import Nav from '../components/nav';

const MODELS = [
  { label: 'FLUX Dev', value: 'flux', desc: 'Best quality · ~30s' },
  { label: 'RealVisXL', value: 'sdxl_full', desc: 'Photorealistic SDXL · ~15s' },
  { label: 'Chroma HD', value: 'chroma', desc: 'Uncensored Flux · ~40s' },
];

const MODEL_DEFAULTS: Record<string, { steps: string; guidance: string; strength: string }> = {
  flux: { steps: '15', guidance: '3.5', strength: '0.85' },
  sdxl_full: { steps: '30', guidance: '5.0', strength: '0.7' },
  chroma: { steps: '40', guidance: '3.0', strength: '0.75' },
};

const MODEL_LABELS: Record<string, string> = {
  flux: 'FLUX Dev',
  sdxl_full: 'RealVisXL',
  chroma: 'Chroma HD',
};

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
  model: string;
}

export default function RunPodPage() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [model, setModel] = useState('flux');
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState(
    'low quality, ugly, unfinished, out of focus, deformed, disfigure, blurry, smudged, restricted palette, flat colors'
  );
  const [ratio, setRatio] = useState('9:16');
  const [seed, setSeed] = useState('');
  const [steps, setSteps] = useState('15');
  const [guidance, setGuidance] = useState('3.5');
  const [strength, setStrength] = useState('0.85');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedImage | null>(null);
  const [refImage, setRefImage] = useState<string | null>(null);
  const [refPreview, setRefPreview] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem('admin-pwd');
    if (saved) {
      setPassword(saved);
      setAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleModelChange = (newModel: string) => {
    setModel(newModel);
    const defaults = MODEL_DEFAULTS[newModel];
    setSteps(defaults.steps);
    setGuidance(defaults.guidance);
    setStrength(defaults.strength);
  };

  const handleLogin = (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    sessionStorage.setItem('admin-pwd', password);
    setAuthenticated(true);
  };

  const handleImageUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be under 10MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setRefPreview(dataUrl);
      setRefImage(dataUrl.split(',')[1]);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleImageUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const clearRefImage = () => {
    setRefImage(null);
    setRefPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const pollStatus = (jobId: string, currentPrompt: string, currentRatio: string, currentModel: string) => {
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/runpod/status?id=${jobId}&model=${currentModel}`, {
          headers: { 'x-admin-password': password },
        });
        const data = await res.json();
        setStatus(data.status);

        if (data.status === 'COMPLETED') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          if (timerRef.current) clearInterval(timerRef.current);
          setResult({
            url: data.url,
            prompt: currentPrompt,
            ratio: currentRatio,
            seed: data.seed ?? null,
            model: currentModel,
          });
          setLoading(false);
          setStatus(null);
        } else if (data.status === 'FAILED') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          if (timerRef.current) clearInterval(timerRef.current);
          setError(data.error || 'Job failed');
          setLoading(false);
          setStatus(null);
        }
      } catch {
        // Keep polling
      }
    }, 3000);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Enter a prompt before generating.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setStatus('STARTING');
    setElapsed(0);

    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    try {
      const parsedSeed = seed.trim() !== '' ? parseInt(seed, 10) : undefined;

      const body: Record<string, unknown> = {
        prompt,
        aspectRatio: ratio,
        steps: parseInt(steps, 10),
        guidance: parseFloat(guidance),
        model,
      };

      if (parsedSeed !== undefined) body.seed = parsedSeed;

      if (refImage) {
        body.image_base64 = refImage;
        body.strength = parseFloat(strength);
      }

      // SDXL and Chroma support negative prompts
      if (model !== 'flux' && negativePrompt.trim()) {
        body.negative_prompt = negativePrompt;
      }

      const res = await fetch('/api/runpod', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': password,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start job');

      setStatus(data.status || 'IN_QUEUE');
      pollStatus(data.jobId, prompt, ratio, model);
    } catch (err: unknown) {
      if (timerRef.current) clearInterval(timerRef.current);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
      setStatus(null);
    }
  };

  const handleCancel = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    setLoading(false);
    setStatus(null);
    setError('Cancelled');
  };

  const downloadImage = (format: 'png' | 'jpeg') => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = `runpod-${result.model}-${Date.now()}.${format}`;
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
  const modelLabel = MODEL_LABELS[model] ?? model;
  const supportsNegative = model !== 'flux';

  const statusLabel = () => {
    if (!status) return '';
    const labels: Record<string, string> = {
      STARTING: 'Starting job...',
      IN_QUEUE: 'In queue...',
      IN_PROGRESS: 'Generating...',
    };
    return `${labels[status] || status} (${elapsed}s)`;
  };

  return (
    <>
      <Nav />
      <div className="gen-page">
        <div className="gen-controls">
          <h1 className="gen-title">RunPod — {modelLabel}</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '-12px' }}>
            No safety filters · Your infrastructure
          </p>

          {/* Model Selector */}
          <div className="gen-field">
            <label className="gen-label">Model</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {MODELS.map((m) => (
                <button
                  key={m.value}
                  className={`gen-ratio-btn ${model === m.value ? 'gen-ratio-active' : ''}`}
                  onClick={() => handleModelChange(m.value)}
                  disabled={loading}
                  style={{ textAlign: 'left', padding: '10px 14px' }}
                >
                  <span style={{ fontWeight: 600 }}>{m.label}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                    {m.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

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

          {/* Negative Prompt */}
          {supportsNegative && (
            <div className="gen-field">
              <label className="gen-label">
                Negative Prompt <span className="gen-optional">({modelLabel})</span>
              </label>
              <textarea
                className="gen-textarea"
                placeholder="Things to avoid..."
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                rows={2}
              />
            </div>
          )}

          {/* Reference Image */}
          <div className="gen-field">
            <label className="gen-label">
              Reference Image <span className="gen-optional">(optional — enables img2img)</span>
            </label>
            {refPreview ? (
              <div style={{ position: 'relative', display: 'inline-block', marginBottom: '8px' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={refPreview}
                  alt="Reference"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '200px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                  }}
                />
                <button
                  onClick={clearRefImage}
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    background: 'rgba(0,0,0,0.7)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '24px',
                    height: '24px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--border)',
                  borderRadius: '8px',
                  padding: '24px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontSize: '14px',
                }}
              >
                Drop an image here or click to upload
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file);
              }}
              style={{ display: 'none' }}
            />
          </div>

          {/* Strength */}
          {refImage && (
            <div className="gen-field">
              <label className="gen-label">
                Strength <span className="gen-optional">({strength})</span>
              </label>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={strength}
                onChange={(e) => setStrength(e.target.value)}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                <span>Subtle changes</span>
                <span>Heavy transformation</span>
              </div>
            </div>
          )}

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

          <button
            className="gen-button"
            onClick={loading ? handleCancel : handleGenerate}
          >
            {loading
              ? `Cancel (${statusLabel()})`
              : refImage
              ? `Generate (${modelLabel} · img2img)`
              : `Generate (${modelLabel})`}
          </button>
        </div>

        {/* Right: Preview */}
        <div className="gen-preview-panel">
          <div className="gen-preview-frame" style={{ aspectRatio: previewAspect }}>
            {loading && (
              <div className="gen-loading">
                <div className="loading-spinner" />
                <p>{statusLabel()}</p>
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
                {MODEL_LABELS[result.model] ?? result.model} · Seed: {result.seed ?? 'auto'}
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