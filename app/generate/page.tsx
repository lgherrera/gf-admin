// app/generate/page.tsx
 
'use client';
 
import { useState, useRef, useCallback, useEffect } from 'react';
import Nav from '../components/nav';
 
const ASPECT_RATIOS = [
  { label: '16:9', value: '16:9' },
  { label: '9:16', value: '9:16' },
  { label: '2:3', value: '2:3' },
];
 
const RESOLUTIONS = [
  { label: '1K', value: '1K' },
  { label: '2K', value: '2K' },
  { label: '4K', value: '4K' },
];
 
const COUNTS = [
  { label: '1', value: 1 },
  { label: '2', value: 2 },
  { label: '3', value: 3 },
  { label: '4', value: 4 },
];
 
const MODELS = [
  { label: 'Nano Banana Pro', value: 'nanobananapro', sub: 'fal.ai · 4K' },
  { label: 'Seedream 4.5', value: 'seedream', sub: 'ByteDance · fal' },
  { label: 'Seedream 5', value: 'seedream5', sub: 'ByteDance · Lite' },
  { label: 'Flux 1 Dev', value: 'flux1dev', sub: 'Black Forest Labs' },
  { label: 'Flux 2 Pro', value: 'flux2pro', sub: 'Black Forest Labs' },
  { label: 'GPT Image 2', value: 'gptimage2', sub: 'OpenAI · fal' },
];
 
const RATIO_W: Record<string, number> = { '16:9': 16, '9:16': 9, '2:3': 2 };
const RATIO_H: Record<string, number> = { '16:9': 9, '9:16': 16, '2:3': 3 };
 
const EYE_COLORS = ['blue', 'brown', 'green', 'cyan', 'amber', 'violet'];
 
// Models that do NOT support seed
const NO_SEED_MODELS = new Set(['seedream5', 'flux2pro', 'gptimage2']);
 
interface GeneratedImage {
  url: string;
  prompt: string;
  ratio: string;
  seed: number | null;
}
 
export default function GeneratePage() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [ratio, setRatio] = useState('9:16');
  const [resolution, setResolution] = useState('1K');
  const [count, setCount] = useState(1);
  const [model, setModel] = useState('nanobananapro');
  const [seed, setSeed] = useState('');
  const [referenceImages, setReferenceImages] = useState<File[]>([]);
  const [referencePreviews, setReferencePreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<GeneratedImage[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
 
  const isV5 = model === 'seedream5';
  const isFlux2Pro = model === 'flux2pro';
  const showSeed = !NO_SEED_MODELS.has(model);
  const showRefs = model === 'seedream' || model === 'seedream5' || model === 'flux2pro' || model === 'nanobananapro' || model === 'gptimage2';
 
  const maxRefs = isV5 ? 10 : isFlux2Pro ? 9 : 5;
 
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
 
  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const newFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    setReferenceImages((prev) => [...prev, ...newFiles]);
    newFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) =>
        setReferencePreviews((prev) => [...prev, e.target?.result as string]);
      reader.readAsDataURL(file);
    });
  }, []);
 
  const removeImage = (index: number) => {
    setReferenceImages((prev) => prev.filter((_, i) => i !== index));
    setReferencePreviews((prev) => prev.filter((_, i) => i !== index));
  };
 
  const compressImage = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const MAX = 1024;
        let w = img.width,
          h = img.height;
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
        const dataUri = canvas.toDataURL('image/jpeg', 0.82);
        resolve(dataUri.split(',')[1]);
      };
      img.onerror = reject;
      img.src = url;
    });
 
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Enter a prompt before generating.');
      return;
    }
    setLoading(true);
    setError(null);
    setResults([]);
    try {
      const base64Images = await Promise.all(referenceImages.map(compressImage));
      const parsedSeed = seed.trim() !== '' ? parseInt(seed, 10) : undefined;
      const randomEyeColor = EYE_COLORS[Math.floor(Math.random() * EYE_COLORS.length)];
      const enrichedPrompt =
        prompt.replace(
          /\b(cyan|blue|brown|green|amber|violet)\s+eyes\b/gi,
          `${randomEyeColor} eyes`
        ) || `${prompt}, ${randomEyeColor} eyes`;
 
      const res = await fetch('/api/generate/image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': password,
        },
        body: JSON.stringify({
          prompt: enrichedPrompt,
          aspectRatio: ratio,
          resolution,
          count,
          referenceImages: base64Images,
          seed: parsedSeed,
          model,
        }),
      });
 
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
 
      const urls: string[] = data.urls ?? (data.url ? [data.url] : []);
      if (urls.length === 0) throw new Error('No image URLs received');
 
      setResults(
        urls.map((url) => ({
          url,
          prompt: enrichedPrompt,
          ratio,
          seed: data.seed ?? null,
        }))
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };
 
  const downloadImage = async (imageUrl: string, format: 'jpeg' | 'png') => {
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `generated-${Date.now()}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(imageUrl, '_blank');
    }
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
          <h1 className="gen-title">Image Generation</h1>
 
          {/* Model */}
          <div className="gen-field">
            <label className="gen-label">Model</label>
            <div className="gen-model-grid">
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
 
          {/* Resolution */}
          <div className="gen-field">
            <label className="gen-label">Resolution</label>
            <div className="gen-ratio-grid">
              {RESOLUTIONS.map((r) => (
                <button
                  key={r.value}
                  className={`gen-ratio-btn ${resolution === r.value ? 'gen-ratio-active' : ''}`}
                  onClick={() => setResolution(r.value)}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
 
          {/* Image Count */}
          <div className="gen-field">
            <label className="gen-label">Images</label>
            <div className="gen-ratio-grid">
              {COUNTS.map((c) => (
                <button
                  key={c.value}
                  className={`gen-ratio-btn ${count === c.value ? 'gen-ratio-active' : ''}`}
                  onClick={() => setCount(c.value)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
 
          {/* Seed */}
          {showSeed && (
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
                {results.length > 0 && results[0].seed !== null && (
                  <button
                    className="gen-seed-reuse"
                    onClick={() => setSeed(String(results[0].seed))}
                  >
                    ↺ Reuse {results[0].seed}
                  </button>
                )}
              </div>
            </div>
          )}
 
          {error && <div className="gen-error">{error}</div>}
 
          <button className="gen-button" onClick={handleGenerate} disabled={loading}>
            {loading ? 'Generating...' : `Generate ${count > 1 ? `${count} Images` : 'Image'}`}
          </button>
        </div>
 
        {/* Right: Preview */}
        <div className="gen-preview-panel">
          {/* Reference Images — above preview */}
          {showRefs && (
            <div className="gen-field" style={{ width: '100%', maxWidth: 500 }}>
              <label className="gen-label" style={{ color: 'var(--accent)' }}>
                Reference Images <span className="gen-optional">(optional, up to {maxRefs})</span>
              </label>
              <div
                className={`gen-dropzone ${dragOver ? 'gen-dropzone-active' : ''}`}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handleFiles(e.dataTransfer.files);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={(e) => handleFiles(e.target.files)}
                />
                <span className="gen-drop-icon">+</span>
                <span className="gen-drop-text">Drop or click to upload</span>
              </div>
              {referencePreviews.length > 0 && (
                <div className="gen-ref-grid">
                  {referencePreviews.map((src, i) => (
                    <div key={i} className="gen-ref-item">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`Ref ${i + 1}`} className="gen-ref-img" />
                      <button className="gen-ref-remove" onClick={() => removeImage(i)}>
                        ×
                      </button>
                      <span className="gen-ref-label">Fig {i + 1}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
 
          {/* Single image preview */}
          {results.length <= 1 && (
            <>
              <div className="gen-preview-frame" style={{ aspectRatio: previewAspect }}>
                {loading && (
                  <div className="gen-loading">
                    <div className="loading-spinner" />
                    <p>Creating your image...</p>
                  </div>
                )}
                {results.length === 1 && !loading ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={results[0].url} alt={results[0].prompt} className="gen-result-img" />
                ) : !loading ? (
                  <div className="gen-empty">
                    <div className="gen-empty-icon">✦</div>
                    <p>Your image will appear here</p>
                  </div>
                ) : null}
              </div>
 
              {results.length === 1 && !loading && (
                <div className="gen-download-bar">
                  <span className="gen-seed-badge">
                    Seed: {results[0].seed ?? 'auto'}
                  </span>
                  <div className="gen-download-btns">
                    <button className="gen-dl-btn" onClick={() => downloadImage(results[0].url, 'jpeg')}>
                      JPEG
                    </button>
                    <button className="gen-dl-btn" onClick={() => downloadImage(results[0].url, 'png')}>
                      PNG
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
 
          {/* Multi-image grid */}
          {results.length > 1 && !loading && (
            <div className="gen-results-grid">
              {results.map((img, i) => (
                <div key={i} className="gen-results-item">
                  <div className="gen-preview-frame" style={{ aspectRatio: previewAspect }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.url} alt={img.prompt} className="gen-result-img" />
                  </div>
                  <div className="gen-download-bar">
                    <span className="gen-seed-badge">
                      {i + 1}/{results.length}
                    </span>
                    <div className="gen-download-btns">
                      <button className="gen-dl-btn" onClick={() => downloadImage(img.url, 'jpeg')}>
                        JPEG
                      </button>
                      <button className="gen-dl-btn" onClick={() => downloadImage(img.url, 'png')}>
                        PNG
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
 
          {/* Loading state for multi */}
          {results.length === 0 && loading && count > 1 && (
            <div className="gen-preview-frame" style={{ aspectRatio: previewAspect }}>
              <div className="gen-loading">
                <div className="loading-spinner" />
                <p>Creating {count} images...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}