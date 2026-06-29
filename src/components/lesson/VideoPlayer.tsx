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

type VideoEventType =
  | 'watch_start' | 'heartbeat' | 'pause' | 'resume'
  | 'seek' | 'watch_end' | 'replay' | 'speed_change';

function track(
  assetId: string,
  enrollmentId: string | undefined,
  sessionId: string,
  accessToken: string,
  eventType: VideoEventType,
  extra?: { watchPositionSec?: number; durationSec?: number; playbackSpeed?: number },
) {
  fetch('/api/tracking/video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      assetId, enrollmentId, sessionId, eventType,
      deviceType: typeof window !== 'undefined' ? (window.innerWidth < 768 ? 'mobile' : 'desktop') : 'desktop',
      ...extra,
    }),
  }).catch(() => {});
}

function trackFraud(
  assetId: string,
  enrollmentId: string | undefined,
  accessToken: string,
  violationType: string,
  detail: Record<string, unknown>,
) {
  fetch('/api/tracking/fraud', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
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

  // ── Anti-fraud refs ───────────────────────────────────────────
  // Vị trí xa nhất đã xem thực sự (chỉ cập nhật khi KHÔNG đang seek)
  const maxWatchedSec = useRef<number>(0);
  // Snapshot maxWatchedSec tại thời điểm BẮT ĐẦU seek (chỉ lấy 1 lần / lần seek)
  const seekStartWatched = useRef<number>(0);
  // Đang trong quá trình seek do người dùng (giữa seeking và seeked)
  const isUserSeeking = useRef<boolean>(false);
  // Seek này do hệ thống cưỡng chế (không phải user)
  const isForcedSeek = useRef<boolean>(false);

  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fraudWarning, setFraudWarning] = useState<string | null>(null);
  const fraudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showFraudWarning = (msg: string) => {
    setFraudWarning(msg);
    if (fraudTimer.current) clearTimeout(fraudTimer.current);
    fraudTimer.current = setTimeout(() => setFraudWarning(null), 3500);
  };

  // Fetch stream URL
  useEffect(() => {
    fetch(`/api/assets/${assetId}/stream-url`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setStreamData({ streamUrl: data.data.streamUrl, mimeType: data.data.mimeType ?? 'video/mp4' });
        else setError(data.error ?? 'Không thể tải video');
      })
      .catch(() => setError('Không thể kết nối server'))
      .finally(() => setIsLoading(false));
  }, [assetId, accessToken]);

  // Init video.js
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
      playbackRates: [0.75, 1, 1.25, 1.5, 2],
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

    // ── Vô hiệu hóa thanh progress khi chống gian lận ─────────
    if (!allowFreeSeeking) {
      player.ready(() => {
        // 1. Disable progress control trong video.js
        const progressControl = (player.controlBar as any)?.progressControl;
        if (progressControl) {
          progressControl.disable();
          const el = progressControl.el() as HTMLElement | null;
          if (el) {
            el.style.pointerEvents = 'none';
            el.style.cursor = 'not-allowed';
            el.style.opacity = '0.5';
            el.title = 'Tua video bị vô hiệu hóa';
          }
        }

        // 2. Chặn phím tắt tua (← →) và skip (+10s/-10s)
        player.on('keydown', (e: KeyboardEvent) => {
          const blocked = ['ArrowLeft', 'ArrowRight'];
          if (blocked.includes(e.key)) {
            e.stopImmediatePropagation();
            e.preventDefault();
            showFraudWarning('Tua video bị vô hiệu hóa trong khóa học này.');
          }
        });

        // 3. Block seeking qua native video element (backup cho HLS/VHS)
        const nativeVideo = player.el()?.querySelector('video') as HTMLVideoElement | null;
        if (nativeVideo) {
          nativeVideo.addEventListener('seeking', () => {
            // Chỉ block khi đây là seek do user (không phải forced)
            if (!isForcedSeek.current && !isUserSeeking.current) {
              seekStartWatched.current = maxWatchedSec.current;
              isUserSeeking.current = true;
            }
          });
        }
      });
    }

    // ── Cập nhật maxWatchedSec — CHỈ khi không đang seek ─────
    // Fix quan trọng: dùng player.seeking() để tránh timeupdate pollute maxWatchedSec
    player.on('timeupdate', () => {
      if (!player.seeking() && !isForcedSeek.current) {
        const current = Math.floor(player.currentTime() ?? 0);
        if (current > maxWatchedSec.current) {
          maxWatchedSec.current = current;
        }
      }
    });

    // ── Tracking: play / heartbeat / pause ────────────────────
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

    // ── Giới hạn tốc độ phát ─────────────────────────────────
    player.on('ratechange', () => {
      const rate = player.playbackRate() ?? 1;
      if (rate > maxPlaybackRate) {
        player.playbackRate(maxPlaybackRate);
        showFraudWarning(`Tốc độ phát tối đa là ${maxPlaybackRate}x`);
        trackFraud(assetId, enrollmentId, accessToken, 'speed_exceed', { attempted: rate, max: maxPlaybackRate });
        return;
      }
      track(assetId, enrollmentId, sid, accessToken, 'speed_change', {
        playbackSpeed: rate,
        watchPositionSec: Math.floor(player.currentTime() ?? 0),
      });
    });

    // ── Bắt đầu seek: snapshot vị trí đã xem xa nhất ─────────
    // Chỉ ghi nhận LẦN ĐẦU của mỗi lượt seek (seeking có thể fire nhiều lần khi kéo)
    player.on('seeking', () => {
      if (!isForcedSeek.current && !isUserSeeking.current) {
        seekStartWatched.current = maxWatchedSec.current;
        isUserSeeking.current = true;
      }
    });

    // ── Kết thúc seek: kiểm tra và cưỡng chế nếu gian lận ────
    player.on('seeked', () => {
      // Nếu đây là forced seek do hệ thống → bỏ qua, chỉ reset flag
      if (isForcedSeek.current) {
        isForcedSeek.current = false;
        isUserSeeking.current = false;
        return;
      }

      isUserSeeking.current = false;
      const seekedTo = Math.floor(player.currentTime() ?? 0);

      if (!allowFreeSeeking) {
        // Buffer 2 giây để tránh false-positive với video buffer/auto-resume
        const allowedMax = seekStartWatched.current + 2;
        if (seekedTo > allowedMax) {
          // Cưỡng chế quay về vị trí đã xem
          isForcedSeek.current = true;
          player.currentTime(seekStartWatched.current);
          showFraudWarning('Không thể tua đến phần chưa xem. Hãy xem theo thứ tự.');
          trackFraud(assetId, enrollmentId, accessToken, 'forward_seek', {
            attemptedSec: seekedTo,
            allowedSec: seekStartWatched.current,
            maxWatchedSec: maxWatchedSec.current,
          });
          return;
        }
      }

      // Seek hợp lệ (backward hoặc trong phạm vi đã xem)
      track(assetId, enrollmentId, sid, accessToken, 'seek', {
        watchPositionSec: seekedTo,
      });
    });

    // ── Hoàn thành video ──────────────────────────────────────
    player.on('ended', () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      track(assetId, enrollmentId, sid, accessToken, 'watch_end', {
        watchPositionSec: Math.floor(player.currentTime() ?? 0),
        durationSec: Math.floor(player.duration() ?? 0),
      });

      const duration = player.duration() ?? 0;
      if (duration > 0) {
        const watchedPct = (maxWatchedSec.current / duration) * 100;
        if (watchedPct >= requiredWatchPct) {
          onComplete?.();
        } else {
          showFraudWarning(
            `Cần xem ít nhất ${requiredWatchPct}% video để hoàn thành (đã xem ${Math.floor(watchedPct)}%)`,
          );
        }
      } else {
        onComplete?.();
      }
    });

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (fraudTimer.current) clearTimeout(fraudTimer.current);
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
                     bg-red-600/90 text-white text-xs font-semibold
                     px-4 py-2.5 rounded-lg shadow-xl backdrop-blur-sm
                     flex items-center gap-2 pointer-events-none
                     animate-bounce"
          style={{ whiteSpace: 'nowrap' }}
        >
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          {fraudWarning}
        </div>
      )}

      {/* Nhãn khóa tua - hiển thị thường trực khi chống gian lận bật */}
      {!allowFreeSeeking && (
        <div className="absolute bottom-12 right-2 z-40 pointer-events-none">
          <span className="bg-black/60 text-white/70 text-[10px] px-2 py-0.5 rounded-full">
            🔒 Không tua
          </span>
        </div>
      )}
    </div>
  );
}
