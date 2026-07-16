import * as React from 'react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Image as ImageIcon, Trash2, Edit2, Grid3X3 } from 'lucide-react';
import { doc, updateDoc, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface PhotoAlbum {
  id: string;
  name: string;
  description?: string;
  coverImage?: string;
  photos: string[];
  createdAt: number;
  updatedAt: number;
}

interface PhotoAlbumsProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  albums: PhotoAlbum[];
  onAlbumsChange: (albums: PhotoAlbum[]) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

export const PhotoAlbums: React.FC<PhotoAlbumsProps> = ({
  isOpen,
  onClose,
  userId,
  albums,
  onAlbumsChange,
  showToast,
}) => {
  const [selectedAlbum, setSelectedAlbum] = useState<PhotoAlbum | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [newAlbumDescription, setNewAlbumDescription] = useState('');
  const [editingAlbum, setEditingAlbum] = useState<PhotoAlbum | null>(null);

  const handleCreateAlbum = async () => {
    if (!newAlbumName.trim()) {
      showToast('Please enter an album name', 'error');
      return;
    }

    try {
      const newAlbum: PhotoAlbum = {
        id: Date.now().toString(),
        name: newAlbumName,
        description: newAlbumDescription,
        photos: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await updateDoc(doc(db, 'users', userId), {
        photoAlbums: arrayUnion(newAlbum),
        updatedAt: serverTimestamp(),
      });

      onAlbumsChange([...albums, newAlbum]);
      setNewAlbumName('');
      setNewAlbumDescription('');
      setIsCreating(false);
      showToast('Album created!', 'success');
    } catch (error) {
      console.error('Error creating album:', error);
      showToast('Failed to create album', 'error');
    }
  };

  const handleDeleteAlbum = async (albumId: string) => {
    try {
      const albumToDelete = albums.find(a => a.id === albumId);
      if (!albumToDelete) return;

      await updateDoc(doc(db, 'users', userId), {
        photoAlbums: arrayRemove(albumToDelete),
        updatedAt: serverTimestamp(),
      });

      onAlbumsChange(albums.filter(a => a.id !== albumId));
      if (selectedAlbum?.id === albumId) {
        setSelectedAlbum(null);
      }
      showToast('Album deleted', 'success');
    } catch (error) {
      console.error('Error deleting album:', error);
      showToast('Failed to delete album', 'error');
    }
  };

  const handleAddPhoto = async (albumId: string, photoUrl: string) => {
    try {
      const album = albums.find(a => a.id === albumId);
      if (!album) return;

      const updatedAlbum = {
        ...album,
        photos: [...album.photos, photoUrl],
        updatedAt: Date.now(),
      };

      await updateDoc(doc(db, 'users', userId), {
        photoAlbums: arrayRemove(album),
        updatedAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'users', userId), {
        photoAlbums: arrayUnion(updatedAlbum),
        updatedAt: serverTimestamp(),
      });

      onAlbumsChange(albums.map(a => a.id === albumId ? updatedAlbum : a));
      showToast('Photo added!', 'success');
    } catch (error) {
      console.error('Error adding photo:', error);
      showToast('Failed to add photo', 'error');
    }
  };

  const handleRemovePhoto = async (albumId: string, photoUrl: string) => {
    try {
      const album = albums.find(a => a.id === albumId);
      if (!album) return;

      const updatedAlbum = {
        ...album,
        photos: album.photos.filter(p => p !== photoUrl),
        updatedAt: Date.now(),
      };

      await updateDoc(doc(db, 'users', userId), {
        photoAlbums: arrayRemove(album),
        updatedAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'users', userId), {
        photoAlbums: arrayUnion(updatedAlbum),
        updatedAt: serverTimestamp(),
      });

      onAlbumsChange(albums.map(a => a.id === albumId ? updatedAlbum : a));
      showToast('Photo removed', 'success');
    } catch (error) {
      console.error('Error removing photo:', error);
      showToast('Failed to remove photo', 'error');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center">
                  <ImageIcon size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Photo Albums</h2>
                  <p className="text-sm text-gray-500">Organize your photos</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 flex items-center justify-center transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {selectedAlbum ? (
                // Album Detail View
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">{selectedAlbum.name}</h3>
                      {selectedAlbum.description && (
                        <p className="text-sm text-gray-500">{selectedAlbum.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedAlbum(null)}
                        className="px-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 hover:bg-gray-50 dark:hover:bg-zinc-800 text-sm"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => handleDeleteAlbum(selectedAlbum.id)}
                        className="p-2 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>

                  {selectedAlbum.photos.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {selectedAlbum.photos.map((photo, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="relative aspect-square rounded-2xl overflow-hidden group"
                        >
                          <img
                            src={photo}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={() => handleRemovePhoto(selectedAlbum.id, photo)}
                            className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={14} className="text-white" />
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10">
                      <ImageIcon size={48} className="mx-auto text-gray-200 dark:text-zinc-800 mb-4" />
                      <p className="text-gray-500">No photos in this album yet</p>
                    </div>
                  )}

                  <div className="mt-4">
                    <label className="block w-full">
                      <div className="border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-2xl p-6 text-center cursor-pointer hover:border-gray-400 transition-colors">
                        <Plus size={24} className="mx-auto mb-2 text-gray-400" />
                        <p className="text-sm text-gray-500">Click to add photo URL</p>
                        <input
                          type="text"
                          placeholder="Paste image URL"
                          className="mt-2 w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.currentTarget.value) {
                              handleAddPhoto(selectedAlbum.id, e.currentTarget.value);
                              e.currentTarget.value = '';
                            }
                          }}
                        />
                      </div>
                    </label>
                  </div>
                </div>
              ) : (
                // Albums List View
                <div>
                  {!isCreating ? (
                    <button
                      onClick={() => setIsCreating(true)}
                      className="w-full mb-4 p-4 border-2 border-dashed border-gray-300 dark:border-zinc-700 rounded-2xl flex items-center justify-center gap-2 hover:border-gray-400 transition-colors"
                    >
                      <Plus size={20} />
                      <span className="font-medium">Create New Album</span>
                    </button>
                  ) : (
                    <div className="mb-4 p-4 bg-gray-50 dark:bg-zinc-800 rounded-2xl space-y-3">
                      <input
                        type="text"
                        value={newAlbumName}
                        onChange={(e) => setNewAlbumName(e.target.value)}
                        placeholder="Album name"
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                      />
                      <input
                        type="text"
                        value={newAlbumDescription}
                        onChange={(e) => setNewAlbumDescription(e.target.value)}
                        placeholder="Description (optional)"
                        className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleCreateAlbum}
                          className="flex-1 py-2 rounded-xl bg-black dark:bg-white text-white dark:text-black font-medium"
                        >
                          Create
                        </button>
                        <button
                          onClick={() => {
                            setIsCreating(false);
                            setNewAlbumName('');
                            setNewAlbumDescription('');
                          }}
                          className="px-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {albums.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {albums.map((album) => (
                        <motion.div
                          key={album.id}
                          whileHover={{ scale: 1.02 }}
                          onClick={() => setSelectedAlbum(album)}
                          className="cursor-pointer group"
                        >
                          <div className="aspect-square rounded-2xl overflow-hidden bg-gray-100 dark:bg-zinc-800 relative">
                            {album.coverImage || album.photos[0] ? (
                              <img
                                src={album.coverImage || album.photos[0]}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ImageIcon size={32} className="text-gray-300" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Grid3X3 size={24} className="text-white" />
                            </div>
                          </div>
                          <div className="mt-2">
                            <p className="font-medium truncate">{album.name}</p>
                            <p className="text-xs text-gray-500">{album.photos.length} photos</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-10">
                      <ImageIcon size={48} className="mx-auto text-gray-200 dark:text-zinc-800 mb-4" />
                      <p className="text-gray-500">No albums yet. Create your first album!</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
