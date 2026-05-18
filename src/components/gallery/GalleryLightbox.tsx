import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X, Calendar, MapPin, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import SharePointGalleryImage from './SharePointGalleryImage';

// ── Types ──────────────────────────────────────────────────
interface LightboxPhoto {
  id: string;
  image_url: string;
  caption?: string;
  author?: string;
  initials?: string;
  date?: string | Date;
  location?: string;
}

interface GalleryLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  photos: LightboxPhoto[];
  initialIndex: number;
  eventTitle?: string;
  isAdmin?: boolean;
  onEdit?: (photo: LightboxPhoto) => void;
  onDelete?: (photo: LightboxPhoto) => void;
}

// ── Constants ──────────────────────────────────────────────
const GAP = 24;
const TRANSITION = { type: 'spring' as const, stiffness: 260, damping: 28 };

// ── Helpers ────────────────────────────────────────────────
function getSlotWidth(): number {
  const vw = window.innerWidth;
  if (vw <= 600) return Math.round(vw * 0.85);
  if (vw <= 900) return Math.round(vw * 0.65);
  return Math.min(Math.round(vw * 0.52), 780);
}

// ── Component ──────────────────────────────────────────────
const GalleryLightbox: React.FC<GalleryLightboxProps> = ({
  isOpen,
  onClose,
  photos,
  initialIndex,
  eventTitle,
  isAdmin,
  onEdit,
  onDelete,
}) => {
  const [cur, setCur] = useState(initialIndex);
  const [slotW, setSlotW] = useState(getSlotWidth);
  const [animating, setAnimating] = useState(false);
  const [metaFade, setMetaFade] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Sync index when re-opened
  useEffect(() => { setCur(initialIndex); }, [initialIndex]);

  // Recalculate slot width on resize
  useEffect(() => {
    if (!isOpen) return;
    const onResize = () => setSlotW(getSlotWidth());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isOpen]);

  // Lock body scroll
  useEffect(() => {
    if (isOpen) { document.body.style.overflow = 'hidden'; }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Navigate
  const go = useCallback((idx: number) => {
    if (animating || photos.length <= 1) return;
    setAnimating(true);
    setMetaFade(true);
    const next = ((idx % photos.length) + photos.length) % photos.length;
    setCur(next);
    setTimeout(() => setMetaFade(false), 250);
    setTimeout(() => setAnimating(false), 600);
  }, [animating, photos.length]);

  // Keyboard
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(cur + 1);
      if (e.key === 'ArrowLeft') go(cur - 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, cur, go, onClose]);

  // Touch swipe
  const touchX = useRef(0);
  const onTouchStart = (e: React.TouchEvent) => { touchX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (Math.abs(dx) > 50) go(cur + (dx < 0 ? 1 : -1));
  };

  if (!isOpen || photos.length === 0) return null;

  const photo = photos[cur];

  // ── Track offset calculation (pixel-perfect, matching WP logic) ──
  const vpW = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const trackX = (vpW / 2) - (cur * (slotW + GAP)) - (slotW / 2);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="lightbox-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="fixed inset-0 z-[9999] flex flex-col"
          style={{ background: 'rgba(8, 3, 5, 0.97)' }}
        >
          {/* ─── TOP BAR ─── */}
          <div className="flex items-center justify-between px-6 py-4 shrink-0 z-20">
            <span className="text-[11px] uppercase tracking-[0.14em] text-[#c9a96e]/60 font-medium select-none">
              {cur + 1} / {photos.length}
            </span>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center border border-[#c9a96e]/25 bg-[#83002A]/25 text-[#f5f0ea] hover:bg-[#83002A] hover:border-[#83002A] transition-colors duration-200"
            >
              <X size={16} />
            </button>
          </div>

          {/* ─── VIEWPORT (slides area) ─── */}
          <div
            ref={viewportRef}
            className="relative flex-1 flex items-center overflow-hidden"
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {/* Nav Prev */}
            {photos.length > 1 && (
              <button
                onClick={() => go(cur - 1)}
                className="absolute left-4 md:left-7 z-30 w-11 h-11 rounded-full flex items-center justify-center border border-[#c9a96e]/25 bg-[rgba(8,3,5,0.6)] text-[#f5f0ea] hover:bg-[#83002A] hover:border-[#83002A] transition-colors duration-200 backdrop-blur-sm"
              >
                <ChevronLeft size={20} />
              </button>
            )}

            {/* Track */}
            <motion.div
              className="flex items-center absolute top-0 bottom-0"
              style={{ gap: `${GAP}px` }}
              animate={{ x: trackX }}
              transition={TRANSITION}
            >
              {photos.map((p, i) => {
                const dist = Math.abs(i - cur);
                const isActive = dist === 0;
                const isAdj = dist === 1;

                return (
                  <div
                    key={p.id}
                    className="h-full flex items-center justify-center shrink-0"
                    style={{ width: slotW }}
                  >
                    <motion.div
                      className={cn(
                        'rounded-2xl overflow-hidden',
                        !isActive && 'cursor-pointer'
                      )}
                      style={{ width: '100%' }}
                      animate={{
                        scale: isActive ? 1 : isAdj ? 0.87 : 0.78,
                        opacity: isActive ? 1 : isAdj ? 0.5 : 0.25,
                        filter: isActive
                          ? 'brightness(1)'
                          : isAdj
                          ? 'brightness(0.6)'
                          : 'brightness(0.45)',
                      }}
                      transition={{ duration: 0.55, ease: [0.77, 0, 0.175, 1] }}
                      onClick={() => !isActive && go(i)}
                    >
                      <SharePointGalleryImage
                        photo={p as any}
                        alt={p.caption || ''}
                        className="w-full block rounded-2xl"
                        style={{
                          boxShadow: isActive
                            ? '0 24px 60px rgba(0,0,0,0.65)'
                            : '0 8px 20px rgba(0,0,0,0.3)',
                        }}
                        draggable={false}
                      />
                    </motion.div>
                  </div>
                );
              })}
            </motion.div>

            {/* Nav Next */}
            {photos.length > 1 && (
              <button
                onClick={() => go(cur + 1)}
                className="absolute right-4 md:right-7 z-30 w-11 h-11 rounded-full flex items-center justify-center border border-[#c9a96e]/25 bg-[rgba(8,3,5,0.6)] text-[#f5f0ea] hover:bg-[#83002A] hover:border-[#83002A] transition-colors duration-200 backdrop-blur-sm"
              >
                <ChevronRight size={20} />
              </button>
            )}
          </div>

          {/* ─── METADATA BAR ─── */}
          <div
            className={cn(
              'shrink-0 px-6 py-4 flex flex-col md:flex-row items-start justify-between gap-4 transition-all duration-200 z-20',
              metaFade ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'
            )}
            style={{ maxWidth: slotW + 40, margin: '0 auto', width: '100%' }}
          >
            {/* Author */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-10 h-10 rounded-full bg-[#83002A]/35 border border-[#c9a96e]/35 flex items-center justify-center text-[#c9a96e] text-xs font-bold">
                {photo.initials || 'SC'}
              </div>
              <div>
                <div className="text-[#f5f0ea] text-sm font-semibold leading-tight">
                  {photo.author || 'SCPNG Office'}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="flex items-center gap-1 text-[10px] uppercase tracking-[0.08em] text-[#c9a96e]/60">
                    <Calendar size={9} />
                    {photo.date
                      ? new Date(photo.date).toLocaleDateString()
                      : 'N/A'}
                  </span>
                  {photo.location && (
                    <span className="flex items-center gap-1 text-[10px] uppercase tracking-[0.08em] text-[#c9a96e]/60">
                      <MapPin size={9} />
                      {photo.location}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Caption + Actions */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#f5f0ea]/50 leading-relaxed line-clamp-2">
                {photo.caption || 'No description available for this visual asset.'}
              </p>
              {isAdmin && (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => onEdit?.(photo)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-[#83002A] hover:border-[#83002A] hover:text-white transition-colors duration-200"
                  >
                    <Pencil size={12} /> Edit
                  </button>
                  <button
                    onClick={() => onDelete?.(photo)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-red-900/50 hover:border-red-700 hover:text-red-200 transition-colors duration-200"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ─── DOTS ─── */}
          {photos.length > 1 && (
            <div className="shrink-0 flex justify-center gap-1.5 pb-5 px-4 flex-wrap max-w-xs mx-auto">
              {photos.slice(0, 20).map((_, i) => (
                <button
                  key={i}
                  onClick={() => go(i)}
                  className={cn(
                    'w-1.5 h-1.5 rounded-full transition-all duration-300',
                    i === cur
                      ? 'bg-[#c9a96e] scale-150'
                      : 'bg-[#c9a96e]/20 hover:bg-[#c9a96e]/40'
                  )}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GalleryLightbox;
