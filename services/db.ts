import { apiFetch } from './api';

export const saveVideo = async (blob: Blob): Promise<string> => {
  const formData = new FormData();
  formData.append('video', blob, 'interview.webm');

  const res = await apiFetch('/videos/upload', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    throw new Error('Failed to upload video');
  }

  const data = await res.json();
  return data.videoPath;
};

export const getVideoUrl = (videoPath: string): string => {
  return `/api/videos/${videoPath}`;
};

export const deleteVideo = async (videoPath: string): Promise<void> => {
  await apiFetch(`/videos/${videoPath}`, { method: 'DELETE' });
};
