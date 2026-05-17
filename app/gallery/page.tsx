// app/gallery/page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import Nav from '../components/nav';

interface GeneratedImage {
  id: string;
  girlfriend_id: string | null;
  prompt: string;
  image_url: string;
  aspect_ratio: string | null;
  model: string | null;
  created_at: string;
}

export default function GalleryPage() {
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [contentRating, setContentRating] = useState<'sfw' | 'nsfw'>('sfw');

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/generated-images/community?contentRating=${contentRating}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch images');
        return res.json();
      })
      .then((data) => setImages(data.images || []))
      .catch((err) => {
        console.error('Error fetching gallery:', err);
        setError('Could not load images.');
      })
      .finally(() => setLoading(false));
  }, [contentRating]);

  // Lightbox controls
  const openLightbox = (index: number) => setSelectedIndex(index);
  const closeLightbox = () => setSelectedIndex(null);

  const goNext = useCallback(() => {
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex + 1) % images.length);
    }
  }, [selectedIndex, images.length]);

  const goPrev = useCallback(() => {
    if (selectedIndex !== null) {
      setSelectedIndex((selectedIndex - 1 + images.length) % images.length);
    }
  }, [selectedIndex, images.length]);

  // Keyboard navigation
  useEffect(() => {
    if (selectedIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedIndex, goNext, goPrev]);

  const selectedImage = selectedIndex !== null ? images[selectedIndex] : null;

  return (
    <>
      <Nav />
      <div className="gallery-page">
        <div className="gallery-header">
          <h1 className="gallery-title">Gallery</h1>

          <div className="gallery-rating-toggle">
            <button
              className={`gallery-rating-btn ${contentRating === 'sfw' ? 'gallery-rating-active' : ''}`}
              onClick={() => setContentRating('sfw')}
            >
              SFW
            </button>
            <button
              className={`gallery-rating-btn ${contentRating === 'nsfw' ? 'gallery-rating-active gallery-rating-nsfw' : ''}`}
              onClick={() => setContentRating('nsfw')}
            >
              NSFW
            </button>
          </div>

          {!loading && !error && images.length > 0 && (
            <span className="gallery-count">
              {images.length} {images.length === 1 ? 'image' : 'images'}
            </span>
          )}
        </div>

        {loading ? (
          <div className="gallery-status">Loading...</div>
        ) : error ? (
          <div className="gallery-status">{error}</div>
        ) : images.length === 0 ? (
          <div className="gallery-empty">
            <div className="gallery-empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </div>
            <p className="gallery-empty-text">No {contentRating.toUpperCase()} images in the gallery yet.</p>
            <p className="gallery-empty-sub">Saved images from users will appear here.</p>
          </div>
        ) : (
          <div className="gallery-grid">
            {images.map((image, index) => (
              <div
                key={image.id}
                className="gallery-item"
                onClick={() => openLightbox(index)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.image_url}
                  alt={image.prompt}
                  className="gallery-img"
                  loading="lazy"
                />
                <div className="gallery-item-overlay">
                  <span className="gallery-item-prompt">{image.prompt}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {selectedImage && (
        <div className="gallery-lightbox" onClick={closeLightbox}>
          <button
            className="gallery-lb-close"
            onClick={closeLightbox}
            aria-label="Close"
          >
            ✕
          </button>

          <button
            className="gallery-lb-nav gallery-lb-prev"
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            aria-label="Previous"
          >
            ‹
          </button>

          <div
            className="gallery-lb-content"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selectedImage.image_url}
              alt={selectedImage.prompt}
              className="gallery-lb-img"
            />
          </div>

          <button
            className="gallery-lb-nav gallery-lb-next"
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            aria-label="Next"
          >
            ›
          </button>

          {selectedImage.prompt && (
            <div className="gallery-lb-caption">
              <p className="gallery-lb-prompt">{selectedImage.prompt}</p>
              {selectedImage.model && (
                <span className="gallery-lb-model">{selectedImage.model}</span>
              )}
            </div>
          )}

          <div className="gallery-lb-counter">
            {(selectedIndex ?? 0) + 1} / {images.length}
          </div>
        </div>
      )}
    </>
  );
}