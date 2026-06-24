// app/atlas-cloud/page.tsx

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Nav from '../components/nav';

type Tab = 'images' | 'videos';

interface GenerationResult {
  url: string;
  proxyUrl: string;
  predictTime?: number;
}

export default function AtlasCloudPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [tab, setTab] = useState<Tab>('images');

  // Form state
  const [prompt, setPrompt] = useState('');
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [duration, setDuration] = useState(5);

  // Generation state
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Build a proxied URL to avoid OSS hotlink 403s */
  const proxyUrl = useCallback(
    (originalUrl: string) =>
      `/api/atlas-cloud/proxy?url=${encodeURIComponent(originalUrl)}`,
    []
  );

  useEffect(() => {
    const saved = sessionStorage.getItem('admin-password');
    if (saved === process.env.NEXT_PUBLIC_ADMIN_PASSWORD || saved) {
      setPassword(saved);
      setAuthenticated(true);
    }
  }, []);

  const handleLogin = (e?: React.FormEvent) => {
    e?.preventDefault();
    sessionStorage.setItem('admin-password', password);
    setAuthenticated(true);
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReferenceFile(file);
      const reader = new FileReader();
      reader.onload = () => setReferencePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeReference = () => {
    setReferenceFile(null);
    setReferencePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const pollStatus = useCallback(
    (predictionId: string) => {
      pollingRef.current = setInterval(async () => {
        try {
          const res = await fetch(
            `/api/atlas-cloud/status?id=${predictionId}`,
            {
              headers: { 'x-admin-password': password },
            }
          );
          const data = await res.json();

          if (data.status === 'completed' || data.status === 'succeeded') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            if (timerRef.current) clearInterval(timerRef.current);
            const rawUrl = data.outputs?.[0] || '';
            setStatus('');
            setLoading(false);
            setResult({
              url: rawUrl,
              proxyUrl: proxyUrl(rawUrl),
              predictTime: data.predictTime,
            });
          } else if (data.status === 'failed') {
            if (pollingRef.current) clearInterval(pollingRef.current);
            if (timerRef.current) clearInterval(timerRef.current);
            setStatus('');
            setLoading(false);
            setError(data.error || 'Generation failed');
          } else {
            setStatus(data.status || 'processing');
          }
        } catch {
          // Keep polling on network hiccups
        }
      }, 3000);
    },
    [password, proxyUrl]
  );

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setStatus('starting');
    setElapsedTime(0);

    // Start elapsed timer
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    try {
      let imageUrl: string | undefined;

      // Step 1: Upload reference image if provided
      if (referenceFile) {
        setStatus('uploading reference...');
        const formData = new FormData();
        formData.append('file', referenceFile);

        const uploadRes = await fetch('/api/atlas-cloud/upload', {
          method: 'POST',
          headers: { 'x-admin-password': password },
          body: formData,
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error || 'Upload failed');
        imageUrl = uploadData.url;
      }

      // Step 2: Start generation
      setStatus('submitting...');

      const model =
        tab === 'images'
          ? 'bytedance/seedream-v4.5/edit'
          : 'bytedance/seedance-2.0/image-to-video';

      const res = await fetch('/api/atlas-cloud', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': password,
        },
        body: JSON.stringify({
          type: tab === 'images' ? 'image' : 'video',
          model,
          prompt,
          image_url: imageUrl,
          ...(tab === 'videos' && { duration }),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');

      // Step 3: Poll for result
      setStatus('processing');
      pollStatus(data.predictionId);
    } catch (err: unknown) {
      if (timerRef.current) clearInterval(timerRef.current);
      setLoading(false);
      setStatus('');
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const downloadResult = async () => {
    if (!result) return;
    try {
      // Download via proxy to avoid 403
      const res = await fetch(result.proxyUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `atlas-${tab === 'images' ? 'image' : 'video'}-${Date.now()}.${tab === 'images' ? 'png' : 'mp4'}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open(result.url, '_blank');
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

  return (
    <>
      <Nav />
      <div className="ac-page">
        {/* Left: Controls */}
        <div className="ac-controls">
          <div className="ac-header">
            <h1 className="ac-title">Atlas Cloud</h1>
            <span className="ac-subtitle">Seedream 4.5 · Seedance 2.0</span>
          </div>

          {/* Tabs */}
          <div className="ac-tabs">
            <button
              className={`ac-tab ${tab === 'images' ? 'ac-tab-active' : ''}`}
              onClick={() => {
                setTab('images');
                setResult(null);
                setError(null);
              }}
            >
              Imágenes
            </button>
            <button
              className={`ac-tab ${tab === 'videos' ? 'ac-tab-active' : ''}`}
              onClick={() => {
                setTab('videos');
                setResult(null);
                setError(null);
              }}
            >
              Videos
            </button>
          </div>

          {/* Model badge */}
          <div className="ac-model-badge">
            {tab === 'images'
              ? 'bytedance/seedream-v4.5/edit'
              : 'bytedance/seedance-2.0/image-to-video'}
          </div>

          {/* Reference Image */}
          <div className="ac-field">
            <label className="ac-label">
              Reference Image
              {tab === 'images' ? (
                <span className="ac-label-hint"> (required for edit)</span>
              ) : (
                <span className="ac-label-hint"> (first frame)</span>
              )}
            </label>
            {referencePreview ? (
              <div className="ac-ref-preview-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={referencePreview}
                  alt="Reference"
                  className="ac-ref-preview"
                />
                <button className="ac-ref-remove" onClick={removeReference}>
                  ✕
                </button>
              </div>
            ) : (
              <button
                className="ac-ref-upload-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="ac-ref-upload-icon">+</span>
                <span>Upload image</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>

          {/* Prompt */}
          <div className="ac-field">
            <label className="ac-label">Prompt</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                tab === 'images'
                  ? 'Describe the edit you want to apply...'
                  : 'Describe the motion and action for the video...'
              }
              className="ac-textarea"
              rows={5}
            />
          </div>

          {/* Duration — Videos only */}
          {tab === 'videos' && (
            <div className="ac-field">
              <label className="ac-label">
                Duration
                <span className="ac-label-hint"> ({duration}s)</span>
              </label>
              <div className="ac-duration-row">
                <input
                  type="range"
                  min={4}
                  max={15}
                  step={1}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="ac-duration-slider"
                />
                <div className="ac-duration-labels">
                  <span>4s</span>
                  <span>15s</span>
                </div>
              </div>
            </div>
          )}

          {/* Generate button */}
          <button
            className="ac-generate-btn"
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
          >
            {loading ? (
              <>
                <span className="ac-spinner" />
                {status}
                {elapsedTime > 0 && (
                  <span className="ac-elapsed">{elapsedTime}s</span>
                )}
              </>
            ) : (
              `Generate ${tab === 'images' ? 'Image' : 'Video'}`
            )}
          </button>

          {error && <div className="ac-error">{error}</div>}
        </div>

        {/* Right: Preview */}
        <div className="ac-preview-panel">
          {loading && (
            <div className="ac-loading-state">
              <div className="ac-pulse" />
              <p>
                {tab === 'videos'
                  ? 'Generating video — this may take 30-90 seconds...'
                  : 'Generating image...'}
              </p>
              {elapsedTime > 0 && (
                <span className="ac-elapsed-large">{elapsedTime}s</span>
              )}
            </div>
          )}

          {result && !loading && tab === 'images' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={result.proxyUrl}
              alt={prompt}
              className="ac-result-img"
            />
          )}

          {result && !loading && tab === 'videos' && (
            <video
              src={result.proxyUrl}
              controls
              autoPlay
              loop
              className="ac-result-video"
            />
          )}

          {!result && !loading && (
            <div className="ac-empty">
              <div className="ac-empty-icon">
                {tab === 'images' ? '🖼' : '🎬'}
              </div>
              <p>
                {tab === 'images'
                  ? 'Your edited image will appear here'
                  : 'Your generated video will appear here'}
              </p>
            </div>
          )}

          {result && !loading && (
            <div className="ac-download-bar">
              {result.predictTime && (
                <span className="ac-time-badge">
                  {result.predictTime.toFixed(1)}s
                </span>
              )}
              <button className="ac-dl-btn" onClick={downloadResult}>
                Download {tab === 'images' ? 'Image' : 'Video'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}