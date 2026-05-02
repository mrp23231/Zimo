import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../lib/utils';

interface VideoUploadProps {
  onUpload: (videoUrl: string, thumbnailUrl: string, duration: number) => void;
  onCancel?: () => void;
  maxSizeMB?: number;
  maxDurationSeconds?: number;
  className?: string;
}

export const VideoUpload: React.FC<VideoUploadProps> = ({
  onUpload,
  onCancel,
  maxSizeMB = 50,
  maxDurationSeconds = 60,
  className
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('');
  const [duration, setDuration] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl);
    };
  }, [previewUrl, thumbnailUrl]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.type.startsWith('video/')) {
      setError('Only video files are allowed');
      return;
    }

    if (selectedFile.size > maxSizeMB * 1024 * 1024) {
      setError(`Video too large. Max ${maxSizeMB}MB allowed`);
      return;
    }

    setFile(selectedFile);
    setError(null);

    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);

    if (videoRef.current) {
      videoRef.current.src = url;
      videoRef.current.onloadedmetadata = () => {
        setDuration(Math.round(videoRef.current?.duration || 0));
        
        if (videoRef.current && videoRef.current.duration > maxDurationSeconds) {
          setError(`Video too long. Max ${maxDurationSeconds}s allowed`);
          return;
        }

        videoRef.current.currentTime = 1;
      };
      videoRef.current.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current?.videoWidth || 320;
        canvas.height = videoRef.current?.videoHeight || 180;
        const ctx = canvas.getContext('2d');
        if (ctx && videoRef.current) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const thumbUrl = canvas.toDataURL('image/jpeg', 0.8);
          setThumbnailUrl(thumbUrl);
        }
      };
    }
  };

  const handleUpload = async () => {
    if (!file || !previewUrl) return;

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      for (let i = 0; i <= 100; i += 10) {
        setProgress(i);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      onUpload(previewUrl, thumbnailUrl, duration);
      
      setFile(null);
      setPreviewUrl('');
      setThumbnailUrl('');
      setDuration(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError('Upload failed');
      console.error(err);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleCancel = () => {
    setFile(null);
    setPreviewUrl('');
    setThumbnailUrl('');
    setDuration(0);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onCancel?.();
  };

  return (
    <div className={cn('space-y-4', className)}>
      <input
        ref={fileInputRef}
        type='file'
        accept='video/*'
        onChange={handleFileSelect}
        className='hidden'
        disabled={uploading}
      />
      
      {!previewUrl ? (
        <button
          type='button'
          onClick={() => fileInputRef.current?.click()}
          className='w-full border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-xl p-8 text-center hover:border-blue-500 dark:hover:border-blue-400 transition-colors'
        >
          <div className='text-gray-400 mb-2'>
            <svg className='w-12 h-12 mx-auto' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' />
            </svg>
          </div>
          <span className='text-sm text-gray-600 dark:text-gray-300'>
            Click to select video (max {maxSizeMB}MB, {maxDurationSeconds}s)
          </span>
        </button>
      ) : (
        <div className='space-y-3'>
          <div className='relative rounded-xl overflow-hidden border dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800'>
            <video
              src={previewUrl}
              className='w-full max-h-64 object-contain'
              controls
            />
            {uploading && (
              <div className='absolute inset-0 bg-black/50 flex items-center justify-center'>
                <div className='text-white text-sm font-bold'>{Math.round(progress)}%</div>
              </div>
            )}
          </div>
          
          {thumbnailUrl && (
            <div className='flex items-center gap-3 p-3 bg-gray-50 dark:bg-zinc-800 rounded-xl'>
              <img src={thumbnailUrl} alt='Thumbnail' className='w-20 h-14 object-cover rounded' />
              <div className='flex-1 text-sm'>
                <div className='font-medium'>Video ready</div>
                <div className='text-gray-500'>{Math.round(duration)}s</div>
              </div>
            </div>
          )}

          {error && (
            <div className='p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm'>
              {error}
            </div>
          )}

          <div className='flex gap-2'>
            <button
              type='button'
              onClick={handleUpload}
              disabled={uploading || !!error}
              className='flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
            >
              {uploading ? 'Uploading...' : 'Upload Video'}
            </button>
            <button
              type='button'
              onClick={handleCancel}
              className='px-4 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors'
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <video ref={videoRef} className='hidden' />
    </div>
  );
};
