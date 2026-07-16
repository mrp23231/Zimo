import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface PostCarouselProps {
  images: string[];
  onImageClick?: (index: number) => void;
  className?: string;
}

export const PostCarousel: React.FC<PostCarouselProps> = ({ images, onImageClick, className }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (!images.length) return null;

  const goNext = () => setCurrentIndex((prev) => (prev + 1) % images.length);
  const goPrev = () => setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);

  return (
    <div className={cn('relative rounded-xl overflow-hidden bg-gray-100 dark:bg-zinc-800', className)}>
      <div className="relative aspect-video">
        <img
          src={images[currentIndex]}
          alt={`Image ${currentIndex + 1}`}
          className="w-full h-full object-cover cursor-pointer"
          onClick={() => onImageClick?.(currentIndex)}
        />
      </div>

      {images.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
            aria-label="Previous image"
          >
            <ChevronLeft size={20} className="text-white" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/30 hover:bg-black/50 transition-colors"
            aria-label="Next image"
          >
            <ChevronRight size={20} className="text-white" />
          </button>

          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {images.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }}
                className={cn(
                  'w-1.5 h-1.5 rounded-full transition-colors',
                  idx === currentIndex ? 'bg-white' : 'bg-white/40'
                )}
                aria-label={`Go to image ${idx + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
