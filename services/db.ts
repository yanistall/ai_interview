import { apiFetch } from './api';

const getVideoFileName = (blob: Blob): string => {
  if (blob.type.includes('mp4')) return 'interview.mp4';
  if (blob.type.includes('webm')) return 'interview.webm';
  return 'interview.bin';
};

export const saveVideo = async (blob: Blob): Promise<string> => {
  const formData = new FormData();
  formData.append('video', blob, getVideoFileName(blob));

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

export const fetchVideoToken = async (filename: string): Promise<string> => {
  const res = await apiFetch(`/videos/token/${filename}`, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`Failed to get video token: ${res.status}`);
  }
  const data = await res.json();
  return data.token as string;
};

export const deleteVideo = async (videoPath: string): Promise<void> => {
  await apiFetch(`/videos/${videoPath}`, { method: 'DELETE' });
};
