import { useCallback, useState } from 'react';
import { RecordedSession, RecordingFrame } from './useSessionRecording';

export const useSessionExport = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const drawFrameToCanvas = (
    ctx: CanvasRenderingContext2D,
    frame: RecordingFrame,
    width: number,
    height: number,
    session: RecordedSession
  ) => {
    const scaleX = width / 640;
    const scaleY = height / 480;

    // Dark background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    const connections = [
      ['left_shoulder', 'right_shoulder'],
      ['left_shoulder', 'left_elbow'],
      ['left_elbow', 'left_wrist'],
      ['right_shoulder', 'right_elbow'],
      ['right_elbow', 'right_wrist'],
      ['left_shoulder', 'left_hip'],
      ['right_shoulder', 'right_hip'],
      ['left_hip', 'right_hip'],
      ['left_hip', 'left_knee'],
      ['left_knee', 'left_ankle'],
      ['right_hip', 'right_knee'],
      ['right_knee', 'right_ankle'],
    ];

    const getKeypoint = (name: string) => frame.keypoints.find(k => k.name === name);

    // Draw connections
    ctx.lineWidth = 4;
    ctx.strokeStyle = frame.feedback.isCorrect ? '#22c55e' : '#f59e0b';
    ctx.lineCap = 'round';

    connections.forEach(([start, end]) => {
      const startKp = getKeypoint(start);
      const endKp = getKeypoint(end);

      if (startKp && endKp && (startKp.score || 0) > 0.5 && (endKp.score || 0) > 0.5) {
        ctx.beginPath();
        ctx.moveTo(startKp.x * scaleX, startKp.y * scaleY);
        ctx.lineTo(endKp.x * scaleX, endKp.y * scaleY);
        ctx.stroke();
      }
    });

    // Draw keypoints
    frame.keypoints.forEach(kp => {
      if ((kp.score || 0) > 0.5) {
        ctx.fillStyle = frame.feedback.isCorrect ? '#22c55e' : '#f59e0b';
        ctx.beginPath();
        ctx.arc(kp.x * scaleX, kp.y * scaleY, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(kp.x * scaleX, kp.y * scaleY, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw header with pose name and branding
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, width, 50);
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px system-ui';
    ctx.fillText(session.poseName, 16, 32);

    // Draw accuracy badge
    const accuracyBadgeX = width - 100;
    ctx.fillStyle = frame.feedback.isCorrect ? '#22c55e' : '#f59e0b';
    ctx.beginPath();
    ctx.roundRect(accuracyBadgeX, 10, 85, 30, 8);
    ctx.fill();
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(frame.feedback.accuracy)}%`, accuracyBadgeX + 42, 31);
    ctx.textAlign = 'left';

    // Draw time progress bar at bottom
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, height - 40, width, 40);

    const timeProgress = frame.timestamp / session.duration;
    ctx.fillStyle = '#4f46e5';
    ctx.fillRect(0, height - 4, width * timeProgress, 4);

    // Time display
    const formatTime = (ms: number) => {
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    ctx.fillStyle = '#fff';
    ctx.font = '14px system-ui';
    ctx.fillText(formatTime(frame.timestamp), 16, height - 15);
    ctx.textAlign = 'right';
    ctx.fillText(formatTime(session.duration), width - 16, height - 15);
    ctx.textAlign = 'left';
  };

  const exportAsVideo = useCallback(async (session: RecordedSession): Promise<Blob | null> => {
    if (session.frames.length === 0) return null;
    
    setIsExporting(true);
    setExportProgress(0);

    try {
      const width = 640;
      const height = 480;
      const fps = 30;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Check if MediaRecorder is available
      if (typeof MediaRecorder === 'undefined') {
        throw new Error('MediaRecorder not supported in this browser');
      }

      const stream = canvas.captureStream(fps);
      const chunks: Blob[] = [];
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 2500000,
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      return new Promise((resolve) => {
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          setIsExporting(false);
          setExportProgress(100);
          resolve(blob);
        };

        mediaRecorder.start();

        let frameIndex = 0;
        const totalFrames = session.frames.length;

        const renderNextFrame = () => {
          if (frameIndex >= totalFrames) {
            mediaRecorder.stop();
            return;
          }

          const frame = session.frames[frameIndex];
          drawFrameToCanvas(ctx, frame, width, height, session);

          setExportProgress(Math.round((frameIndex / totalFrames) * 100));
          frameIndex++;

          // Render at approximately 30fps
          setTimeout(renderNextFrame, 33);
        };

        renderNextFrame();
      });
    } catch (error) {
      console.error('Export failed:', error);
      setIsExporting(false);
      return null;
    }
  }, []);

  const downloadVideo = useCallback(async (session: RecordedSession) => {
    const blob = await exportAsVideo(session);
    if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `yoga-session-${session.poseName.toLowerCase().replace(/\s+/g, '-')}-${new Date(session.startTime).toISOString().split('T')[0]}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }, [exportAsVideo]);

  const exportAsJSON = useCallback((session: RecordedSession) => {
    const exportData = {
      ...session,
      frames: session.frames.map(f => ({
        timestamp: f.timestamp,
        keypoints: f.keypoints,
        feedback: f.feedback,
      })),
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yoga-session-${session.poseName.toLowerCase().replace(/\s+/g, '-')}-${new Date(session.startTime).toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const generateShareImage = useCallback(async (session: RecordedSession): Promise<string | null> => {
    const width = 800;
    const height = 600;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    // Gradient background
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#1a1a2e');
    gradient.addColorStop(1, '#16213e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('Yoga Practice Complete! 🧘', width / 2, 70);

    // Pose name
    ctx.fillStyle = '#a78bfa';
    ctx.font = '24px system-ui';
    ctx.fillText(session.poseName, width / 2, 110);

    // Draw skeleton preview in the center
    const previewWidth = 300;
    const previewHeight = 225;
    const previewX = (width - previewWidth) / 2;
    const previewY = 140;

    // Find best frame (highest accuracy)
    const bestFrame = session.frames.reduce((best, frame) => 
      frame.feedback.accuracy > best.feedback.accuracy ? frame : best
    , session.frames[0]);

    if (bestFrame) {
      ctx.fillStyle = '#2a2a4a';
      ctx.beginPath();
      ctx.roundRect(previewX - 10, previewY - 10, previewWidth + 20, previewHeight + 20, 16);
      ctx.fill();

      // Scale and draw skeleton
      const scaleX = previewWidth / 640;
      const scaleY = previewHeight / 480;

      const connections = [
        ['left_shoulder', 'right_shoulder'],
        ['left_shoulder', 'left_elbow'],
        ['left_elbow', 'left_wrist'],
        ['right_shoulder', 'right_elbow'],
        ['right_elbow', 'right_wrist'],
        ['left_shoulder', 'left_hip'],
        ['right_shoulder', 'right_hip'],
        ['left_hip', 'right_hip'],
        ['left_hip', 'left_knee'],
        ['left_knee', 'left_ankle'],
        ['right_hip', 'right_knee'],
        ['right_knee', 'right_ankle'],
      ];

      const getKeypoint = (name: string) => bestFrame.keypoints.find(k => k.name === name);

      ctx.lineWidth = 3;
      ctx.strokeStyle = '#22c55e';
      ctx.lineCap = 'round';

      connections.forEach(([start, end]) => {
        const startKp = getKeypoint(start);
        const endKp = getKeypoint(end);

        if (startKp && endKp && (startKp.score || 0) > 0.5 && (endKp.score || 0) > 0.5) {
          ctx.beginPath();
          ctx.moveTo(previewX + startKp.x * scaleX, previewY + startKp.y * scaleY);
          ctx.lineTo(previewX + endKp.x * scaleX, previewY + endKp.y * scaleY);
          ctx.stroke();
        }
      });

      bestFrame.keypoints.forEach(kp => {
        if ((kp.score || 0) > 0.5) {
          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          ctx.arc(previewX + kp.x * scaleX, previewY + kp.y * scaleY, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    // Stats section
    const statsY = previewY + previewHeight + 50;
    const statWidth = 200;
    const statSpacing = 40;

    const stats = [
      { label: 'Duration', value: formatDuration(session.duration), color: '#60a5fa' },
      { label: 'Avg Accuracy', value: `${Math.round(session.averageAccuracy)}%`, color: getStatColor(session.averageAccuracy) },
      { label: 'Peak Accuracy', value: `${Math.round(session.peakAccuracy)}%`, color: getStatColor(session.peakAccuracy) },
    ];

    const totalWidth = stats.length * statWidth + (stats.length - 1) * statSpacing;
    const startX = (width - totalWidth) / 2;

    stats.forEach((stat, i) => {
      const x = startX + i * (statWidth + statSpacing);
      
      // Stat box
      ctx.fillStyle = '#2a2a4a';
      ctx.beginPath();
      ctx.roundRect(x, statsY, statWidth, 80, 12);
      ctx.fill();

      // Value
      ctx.fillStyle = stat.color;
      ctx.font = 'bold 28px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(stat.value, x + statWidth / 2, statsY + 40);

      // Label
      ctx.fillStyle = '#9ca3af';
      ctx.font = '14px system-ui';
      ctx.fillText(stat.label, x + statWidth / 2, statsY + 62);
    });

    // Footer branding
    ctx.fillStyle = '#6b7280';
    ctx.font = '14px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(`Practiced on ${new Date(session.startTime).toLocaleDateString()}`, width / 2, height - 30);

    return canvas.toDataURL('image/png');
  }, []);

  const downloadShareImage = useCallback(async (session: RecordedSession) => {
    const dataUrl = await generateShareImage(session);
    if (dataUrl) {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `yoga-progress-${session.poseName.toLowerCase().replace(/\s+/g, '-')}-${new Date(session.startTime).toISOString().split('T')[0]}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  }, [generateShareImage]);

  const shareProgress = useCallback(async (session: RecordedSession) => {
    const dataUrl = await generateShareImage(session);
    if (!dataUrl) return;

    // Convert data URL to blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const file = new File([blob], 'yoga-progress.png', { type: 'image/png' });

    const shareData = {
      title: `${session.poseName} - Yoga Practice`,
      text: `I just practiced ${session.poseName} and achieved ${Math.round(session.averageAccuracy)}% average accuracy! 🧘‍♀️`,
      files: [file],
    };

    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User cancelled or share failed, fall back to download
        await downloadShareImage(session);
      }
    } else {
      // Fallback to download
      await downloadShareImage(session);
    }
  }, [generateShareImage, downloadShareImage]);

  return {
    isExporting,
    exportProgress,
    exportAsVideo,
    downloadVideo,
    exportAsJSON,
    generateShareImage,
    downloadShareImage,
    shareProgress,
  };
};

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function getStatColor(value: number): string {
  if (value >= 80) return '#22c55e';
  if (value >= 50) return '#f59e0b';
  return '#ef4444';
}
