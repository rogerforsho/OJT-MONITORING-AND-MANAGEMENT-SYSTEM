'use client';

import React from 'react';
import Image from 'next/image';
import { useDesktop } from '@/src/hooks/useDesktop';

interface Props {
  onOpenCommandPalette?: () => void;
}

export default function DesktopTitlebar({ onOpenCommandPalette }: Props) {
  const { isDesktop, isMaximized, minimizeWindow, maximizeWindow, closeWindow, isMiniWidget } = useDesktop();

  if (!isDesktop) return null;

  return (
    <header
      className="h-9 w-full bg-[#041a0f] border-b border-[#FFCC00]/20 flex items-center justify-between select-none z-50 text-xs shrink-0"
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      {/* Left: Brand Seal & Title */}
      <div className="flex items-center gap-2.5 px-3">
        <div className="w-5 h-5 rounded-md bg-white/10 p-0.5 border border-[#FFCC00]/40 flex items-center justify-center shrink-0">
          <Image
            src="/logo.png"
            alt="CdM Seal"
            width={16}
            height={16}
            className="object-contain"
            priority
          />
        </div>
        <div className="flex items-center gap-1.5 font-bold">
          <span className="text-white text-[11px] font-serif tracking-tight font-black">CdM OJT Portal</span>
          <span className="text-[#FFCC00] text-[9px] font-extrabold tracking-wider uppercase opacity-80">Desktop</span>
        </div>
      </div>

      {/* Center: Command Palette Trigger (Hidden in Mini-Widget) */}
      {!isMiniWidget && (
        <div
          className="flex-1 max-w-sm px-2 flex items-center justify-center"
          style={{ WebkitAppRegion: 'no-drag' } as any}
        >
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="w-full flex items-center justify-between px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all text-[11px] cursor-pointer shadow-inner"
          >
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-[#FFCC00]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="8" />
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35" />
              </svg>
              <span>Quick Search or Jump to...</span>
            </div>
            <kbd className="text-[9px] font-bold font-mono bg-white/10 px-1.5 py-0.5 rounded text-[#FFCC00] border border-white/10">
              Ctrl K
            </kbd>
          </button>
        </div>
      )}

      {/* Right: Native Window Controls */}
      <div
        className="flex items-center h-full"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        <button
          type="button"
          onClick={minimizeWindow}
          title="Minimize"
          className="h-full px-3.5 flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <line x1="4" y1="12" x2="20" y2="12" />
          </svg>
        </button>

        {!isMiniWidget && (
          <button
            type="button"
            onClick={maximizeWindow}
            title={isMaximized ? 'Restore Window' : 'Maximize Window'}
            className="h-full px-3.5 flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            {isMaximized ? (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="6" y="6" width="12" height="12" rx="1" />
                <polyline points="9 6 9 3 18 3 18 12 15 12" />
              </svg>
            ) : (
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="4" y="4" width="16" height="16" rx="1.5" />
              </svg>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={closeWindow}
          title="Close to System Tray"
          className="h-full px-4 flex items-center justify-center text-slate-300 hover:text-white hover:bg-rose-600 transition-colors cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </header>
  );
}
