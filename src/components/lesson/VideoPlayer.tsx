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
  /** Tỷ lệ % tối thiểu phải xem để bài học được tính là hoàn thành (mặc định 90) */
  requiredWatchPct?: number;
  /** Tốc độ phát tối đa (mặc định 2.0x) */
  maxPlaybackRate?: number;
  /** Cho phép tua video tự do (mặc định false - bật chống gian lận) */
  allowFreeSeeking?: boolean;
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

// Ghi nhận hành vi gian lận (fire-and-forget)
function trackFraud(
  assetId: string,
  enrollmentId: string | undefined,
  accessToken: string,
  violationType: string,
  detail: Record<string, unknown>,
) {
  fetch('/api/tracking/fraud', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ assetId, enrollmentId, violationType, detail }),
  }).catch(() => {});
}

// ── Component ─────────────────────────────────────────────────

export function VideoPlayer({
  assetId,
  enrollmentId,
  accessToken,
  onComplete,
  className,
  requiredWatchPct = 90,
  maxPlaybackRate = 2.0,
  allowFreeSeeking = false,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const sessionId = useRef<string>(crypto.randomUUID());
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Anti-fraud: theo dõi vị trí xem xa nhất
  const maxWatchedSec = useRef<number>(0);
  // Vị trí trước khi seek (để phát hiện forward seek)
  const preSeekPosition = useRef<number>(0);
  // Cờ để phân biệt seek do hệ thống vs người dùng
  const isForcedSeek = useRef<boolean>(false);

  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fraudWarning, setFraudWarning] = useState<string | null>(null);
  const fraudWarningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFraudWarning = (msg: string) => {
    setFraudWarning(msg);
    if (fraudWarningTimer.current) clearTimeout(fraudWarningTimer.current);
    fraudWarningTimer.current = setTimeout(() => setFraudWarning(null), 3500);
  };

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

    const player = videojs(videoEl, {
      controls: true,
      autoplay: false,
      preload: 'metadata',
      fluid: true,
      playbackRates: [0.75, 1, 1.25, 1.5, 2],  // tối đa 2x
      html5: {
        vhs: { overrideNative: true },
        nativeVideoTracks: false,
        nativeAudioTracks: false,
        nativeTextTracks: false,
      },
      sources: [{ src: streamData.streamUrl, type: streamData.mimeType }],
    });

    playerRef.current = player;
    const sid = sessionId.current;

    // ── Track vị trí xem để chống forward seek ────────────────

    // Cập nhật maxWatchedSec liên tục khi đang xem
    player.on('timeupdate', () => {
      const current = Math.floor(player.currentTime() ?? 0);
      if (!isForcedSeek.current && current > maxWatchedSec.current) {
        maxWatchedSec.current = current;
      }
    });

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

    // ── Chống gian lận: giới hạn tốc độ phát ─────────────────
    player.on('ratechange', () => {
      const rate = player.playbackRate() ?? 1;
      if (rate > maxPlaybackRate) {
        // Cưỡng chế về tốc độ tối đa
        player.playbackRate(maxPlaybackRate);
        showFraudWarning(`Tốc độ phát tối đa là ${maxPlaybackRate}x`);
        trackFraud(assetId, enrollmentId, accessToken, 'speed_exceed', {
          attempted: rate,
          max: maxPlaybackRate,
        });
        return;
      }
      track(assetId, enrollmentId, sid, accessToken, 'speed_change', {
        playbackSpeed: rate,
        watchPositionSec: Math.floor(player.currentTime() ?? 0),
      });
    });

    // ── Chống gian lận: ghi vị trí trước khi seek ─────────────
    player.on('seeking', () => {
      if (!isForcedSeek.current) {
        preSeekPosition.current = maxWatchedSec.current;
      }
    });

    // ── Chống gian lận: chặn forward seek vượt quá đã xem ─────
    player.on('seeked', () => {
      const seekedTo = Math.floor(player.currentTime() ?? 0);

      if (!allowFreeSeeking && !isForcedSeek.current) {
        // Cho phép buffer 3 giây (để không false-positive)
        const allowedMax = preSeekPosition.current + 3;
        if (seekedTo > allowedMax) {
          // Cưỡng chế quay về vị trí xem xa nhất
          isForcedSeek.current = true;
          player.currentTime(preSeekPosition.current);
          showFraudWarning('Không thể tua đến phần chưa xem. Hãy xem theo thứ tự.');
          trackFraud(assetId, enrollmentId, accessToken, 'forward_seek', {
            attemptedSec: seekedTo,
            allowedSec: preSeekPosition.current,
          });
          // Reset flag sau khi seek hoàn tất
          setTimeout(() => { isForcedSeek.current = false; }, 300);
          return;
        }
      }

      // Reset flag nếu là forced seek đã hoàn tất
      if (isForcedSeek.current) {
        isForcedSeek.current = false;
      }

      track(assetId, enrollmentId, sid, accessToken, 'seek', {
        watchPositionSec: seekedTo,
      });
    });

    // ── Hoàn thành video ───────────────────────────────────────
    player.on('ended', () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      track(assetId, enrollmentId, sid, accessToken, 'watch_end', {
        watchPositionSec: Math.floor(player.currentTime() ?? 0),
        durationSec: Math.floor(player.duration() ?? 0),
      });
      // Chỉ callback khi đã xem đủ % yêu cầu
      const duration = player.duration() ?? 0;
      if (duration > 0) {
        const watchedPct = (maxWatchedSec.current / duration) * 100;
        if (watchedPct >= requiredWatchPct) {
          onComplete?.();
        } else {
          showFraudWarning(
            `Cần xem ít nhất ${requiredWatchPct}% video để hoàn thành bài học (đã xem ${Math.floor(watchedPct)}%)`,
          );
        }
      } else {
        onComplete?.();
      }
    });

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (fraudWarningTimer.current) clearTimeout(fraudWarningTimer.current);
      player.dispose();
    };
  }, [streamData, assetId, enrollmentId, accessToken, onComplete, allowFreeSeeking, requiredWatchPct, maxPlaybackRate]); // eslint-disable-line

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
    <div className={`w-full relative ${className}`}>
      <div ref={videoRef} data-vjs-player />

      {/* Cảnh báo chống gian lận */}
      {fraudWarning && (
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 z-50
                     bg-red-600/90 text-white text-xs font-medium
                     px-4 py-2 rounded-lg shadow-lg backdrop-blur-sm
                     flex items-center gap-2 animate-fade-in pointer-events-none"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          {fraudWarning}
        </div>
      )}
    </div>
  );
}
