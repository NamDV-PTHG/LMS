'use client';

import React, { useEffect, useRef, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import type Player from 'video.js/dist/types/player';

// ── Types ─────────────────────────────────────────────────────

interface VideoPlayerProps {
  assetId: string;
  enrollmentId?: string;
  accessToken: string;
  onComplete?: () => void;
  className?: string;
}

interface StreamData {
  streamUrl: string;
  mimeType: string;
}

// ── Tracking helpers ──────────────────────────────────────────

type VideoEventType =
  | 'watch_start' | 'heartbeat' | 'pause' | 'resume'
  | 'seek' | 'watch_end' | 'replay' | 'speed_change';

// Fire-and-forget: never block UI, never throw
function track(
  assetId: string,
  enrollmentId: string | undefined,
  sessionId: string,
  accessToken: string,
  eventType: VideoEventType,
  extra?: {
    watchPositionSec?: number;
    durationSec?: number;
    playbackSpeed?: number;
  },
) {
  fetch('/api/tracking/video', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      assetId,
      enrollmentId,
      sessionId,
      eventType,
      deviceType: typeof window !== 'undefined' ? (window.innerWidth < 768 ? 'mobile' : 'desktop') : 'desktop',
      ...extra,
    }),
  }).catch(() => {});
}

// ── Component ─────────────────────────────────────────────────

export function VideoPlayer({
  assetId,
  enrollmentId,
  accessToken,
  onComplete,
  className,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const sessionId = useRef<string>(crypto.randomUUID());
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch stream info (URL + mimeType)
  useEffect(() => {
    fetch(`/api/assets/${assetId}/stream-url`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setStreamData({
            streamUrl: data.data.streamUrl,
            mimeType: data.data.mimeType ?? 'video/mp4',
          });
        } else {
          setError(data.error ?? 'Không thể tải video');
        }
      })
      .catch(() => setError('Không thể kết nối server'))
      .finally(() => setIsLoading(false));
  }, [assetId, accessToken]);

  // Init video.js once stream data is available
  useEffect(() => {
    if (!streamData || !videoRef.current) return;

    const videoEl = document.createElement('video-js');
    videoEl.classList.add('vjs-big-play-centered', 'vjs-fluid');
    videoRef.current.appendChild(videoEl);

    const isHls = streamData.mimeType === 'application/x-mpegURL';

    const player = videojs(videoEl, {
      controls: true,
      autoplay: false,
      preload: 'metadata',
      fluid: true,
      html5: {
        vhs: {
          overrideNative: true,
          // Add auth header for requests to our own /api/ endpoints (e.g. manifest proxy).
          // MinIO presigned URLs ignore unknown headers, so this is safe for segment requests too.
          xhr: {
            beforeRequest: (options: Record<string, unknown>) => {
              const uri = (options.uri as string) ?? '';
              if (uri.startsWith('/api/') || uri.includes(window.location.hostname)) {
                options.headers = {
                  ...(options.headers as Record<string, string>),
                  Authorization: `Bearer ${accessToken}`,
                };
              }
              return options;
            },
          },
        },
        nativeVideoTracks: false,
        nativeAudioTracks: false,
        nativeTextTracks: false,
      },
      sources: [{ src: streamData.streamUrl, type: streamData.mimeType }],
    });

    playerRef.current = player;

    const sid = sessionId.current;

    // ── Event tracking ─────────────────────────────────────────

    player.on('play', () => {
      track(assetId, enrollmentId, sid, accessToken, 'watch_start', {
        watchPositionSec: Math.floor(player.currentTime() ?? 0),
        durationSec: Math.floor(player.duration() ?? 0),
        playbackSpeed: player.playbackRate(),
      });

      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      heartbeatRef.current = setInterval(() => {
        if (!player.paused()) {
          track(assetId, enrollmentId, sid, accessToken, 'heartbeat', {
            watchPositionSec: Math.floor(player.currentTime() ?? 0),
            durationSec: Math.floor(player.duration() ?? 0),
          });
        }
      }, parseInt(process.env.NEXT_PUBLIC_VIDEO_HEARTBEAT_MS ?? '10000', 10));
    });

    player.on('pause', () => {
      track(assetId, enrollmentId, sid, accessToken, 'pause', {
        watchPositionSec: Math.floor(player.currentTime() ?? 0),
      });
    });

    player.on('ratechange', () => {
      track(assetId, enrollmentId, sid, accessToken, 'speed_change', {
        playbackSpeed: player.playbackRate(),
        watchPositionSec: Math.floor(player.currentTime() ?? 0),
      });
    });

    player.on('seeked', () => {
      track(assetId, enrollmentId, sid, accessToken, 'seek', {
        watchPositionSec: Math.floor(player.currentTime() ?? 0),
      });
    });

    player.on('ended', () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      track(assetId, enrollmentId, sid, accessToken, 'watch_end', {
        watchPositionSec: Math.floor(player.currentTime() ?? 0),
        durationSec: Math.floor(player.duration() ?? 0),
      });
      onComplete?.();
    });

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      player.dispose();
    };
  }, [streamData, assetId, enrollmentId, accessToken, onComplete]); // eslint-disable-line

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center bg-black aspect-video ${className}`}>
        <div className="text-white text-sm">Đang tải video...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-black aspect-video ${className}`}>
        <div className="text-red-400 text-sm text-center px-4">{error}</div>
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      <div ref={videoRef} data-vjs-player />
    </div>
  );
}
