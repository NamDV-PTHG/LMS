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

  // Ref để passed các giá trị anti-fraud vào closure của player.ended
  // (vì maxWatched là let variable trong effect, cần một bridge để ended đọc được)
  const maxWatchedRef = useRef<number>(0);

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

    // ── Khởi tạo anti-fraud state (local variables trong closure) ──
    // Dùng let thay vì ref vì không cần trigger React re-render,
    // chỉ cần persist trong vòng đời effect này.
    let maxWatched = 0;   // giây xa nhất đã xem thực sự
    let forcedSeek = false; // true khi HỆ THỐNG đang seek về — để phân biệt với user seek

    // Sync maxWatched vào ref để player.ended có thể đọc
    const syncRef = () => { maxWatchedRef.current = maxWatched; };

    player.ready(() => {
      const nativeVideo = player.el()?.querySelector('video') as HTMLVideoElement | null;
      if (!nativeVideo) return;

      // ══════════════════════════════════════════════════════
      // CORE: Theo dõi vị trí đã xem thực sự
      // Dùng native timeupdate + native .seeking (đáng tin hơn player.seeking())
      // ══════════════════════════════════════════════════════
      nativeVideo.addEventListener('timeupdate', () => {
        // Chỉ cập nhật khi KHÔNG đang seek (kể cả forced seek)
        if (!nativeVideo.seeking && !forcedSeek) {
          const current = Math.floor(nativeVideo.currentTime);
          if (current > maxWatched) {
            maxWatched = current;
            syncRef();
          }
        }
      });

      if (!allowFreeSeeking) {
        // ══════════════════════════════════════════════════════
        // BLOCK 1: Chặn seeking NGAY LẬP TỨC trên native video element
        // Đây là cách đáng tin nhất — không cần chờ seeked event
        // ══════════════════════════════════════════════════════
        nativeVideo.addEventListener('seeking', () => {
          if (forcedSeek) {
            // Đây là seek do hệ thống tạo ra (forced back) — cho phép
            forcedSeek = false;
            return;
          }

          const target = nativeVideo.currentTime;

          // Buffer 2 giây để tránh false-positive với buffering/auto-resume
          if (target > maxWatched + 2) {
            // Từ chối seek: đặt lại ngay về vị trí đã xem
            forcedSeek = true;
            nativeVideo.currentTime = maxWatched;

            showFraudWarning('Không thể tua đến phần chưa xem. Hãy xem theo thứ tự.');
            trackFraud(assetId, enrollmentId, accessToken, 'forward_seek', {
              attemptedSec: Math.round(target),
              allowedSec: maxWatched,
            });
          }
          // Seek lùi hoặc trong vùng đã xem → cho phép (không làm gì)
        });

        // ══════════════════════════════════════════════════════
        // BLOCK 2: Vô hiệu hóa thanh progress bar UI
        // ══════════════════════════════════════════════════════
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

        // Thêm CSS override để chắc chắn không có element con nào clickable
        const styleTag = document.createElement('style');
        styleTag.textContent = `
          .vjs-progress-control,
          .vjs-seek-bar,
          .vjs-play-progress,
          .vjs-load-progress,
          .vjs-mouse-display {
            pointer-events: none !important;
            cursor: not-allowed !important;
          }
        `;
        document.head.appendChild(styleTag);

        // Cleanup style tag khi player bị destroy
        player.on('dispose', () => styleTag.remove());

        // ══════════════════════════════════════════════════════
        // BLOCK 3: Chặn phím tắt tua (← → và J/L trong một số cấu hình)
        // ══════════════════════════════════════════════════════
        player.on('keydown', (e: KeyboardEvent) => {
          const blocked = ['ArrowLeft', 'ArrowRight', 'j', 'J', 'l', 'L'];
          if (blocked.includes(e.key)) {
            e.stopImmediatePropagation();
            e.preventDefault();
            showFraudWarning('Tua video bị vô hiệu hóa trong khóa học này.');
          }
        });

        // Backup: chặn keydown trên native video element
        nativeVideo.addEventListener('keydown', (e: KeyboardEvent) => {
          const blocked = ['ArrowLeft', 'ArrowRight'];
          if (blocked.includes(e.key)) {
            e.stopImmediatePropagation();
            e.preventDefault();
          }
        });
      }
    });

    // ── Tracking: play / heartbeat ────────────────────────────
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

    // ── Hoàn thành video ──────────────────────────────────────
    player.on('ended', () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      track(assetId, enrollmentId, sid, accessToken, 'watch_end', {
        watchPositionSec: Math.floor(player.currentTime() ?? 0),
        durationSec: Math.floor(player.duration() ?? 0),
      });

      const duration = player.duration() ?? 0;
      if (duration > 0) {
        // Đọc từ ref vì maxWatched là local variable trong ready() closure
        const watchedPct = (maxWatchedRef.current / duration) * 100;
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
