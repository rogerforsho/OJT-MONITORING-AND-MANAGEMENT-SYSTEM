'use client';

import React, { useState, useEffect } from 'react';
import { Megaphone, X, Check, Eye, EyeOff, RotateCcw } from '@/src/components/ui/Icons';

export interface AnnouncementItem {
  announcement_id: string;
  title: string;
  content: string;
  target_department: string;
  created_at: string;
}

interface Props {
  announcements: AnnouncementItem[];
}

const STORAGE_KEY = 'ojt_dismissed_announcements';

export default function CampusBulletin({ announcements = [] }: Props) {
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [showDismissed, setShowDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Load dismissed announcement IDs from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setDismissedIds(parsed);
        }
      }
    } catch {}
    setMounted(true);
  }, []);

  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updated = Array.from(new Set([...dismissedIds, id]));
      setDismissedIds(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  };

  const handleRestore = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updated = dismissedIds.filter((item) => item !== id);
      setDismissedIds(updated);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {}
  };

  const handleClearAllDismissed = () => {
    setDismissedIds([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  // Separate active vs dismissed
  const activeAnnouncements = mounted
    ? announcements.filter((a) => !dismissedIds.includes(a.announcement_id))
    : announcements;

  const dismissedAnnouncements = mounted
    ? announcements.filter((a) => dismissedIds.includes(a.announcement_id))
    : [];

  return (
    <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#0A3D24] text-[#FFCC00] flex items-center justify-center shrink-0 shadow-xs">
            <Megaphone className="w-4 h-4 text-[#FFCC00]" />
          </div>
          <div>
            <h3 className="text-xs font-extrabold text-slate-900">Campus Bulletin</h3>
            <p className="text-[10px] text-slate-400">Institutional Announcements</p>
          </div>
        </div>
        <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-[#FFCC00]/15 text-[#0A3D24] border border-[#FFCC00]/40 uppercase tracking-wider">
          Notice Board
        </span>
      </div>

      {/* Active Unread Announcements */}
      {activeAnnouncements.length > 0 ? (
        <div className="space-y-3">
          {activeAnnouncements.map((annc) => (
            <div
              key={annc.announcement_id}
              className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-amber-500/40 transition-all flex flex-col gap-1.5 relative group shadow-2xs"
            >
              <div className="flex items-center justify-between gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-[#0A3D24] text-[#FFCC00] uppercase tracking-wider">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FFCC00] animate-pulse" />
                    {annc.target_department === 'All' ? 'Campus-Wide' : `${annc.target_department} Dept`}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {new Date(annc.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                  </span>
                </div>

                {/* 1-Click Dismiss Button */}
                <button
                  type="button"
                  onClick={(e) => handleDismiss(annc.announcement_id, e)}
                  title="Dismiss this notice (I've read this)"
                  className="text-[10px] font-bold text-slate-400 hover:text-slate-700 bg-white hover:bg-slate-200/70 border border-slate-200 px-2 py-0.5 rounded-md flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
                >
                  <X className="w-2.5 h-2.5" />
                  <span>Dismiss</span>
                </button>
              </div>

              <h4 className="text-xs font-bold text-slate-900 leading-snug">{annc.title}</h4>
              <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-3">{annc.content}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-6 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-1.5 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
          <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <Check className="w-4 h-4" />
          </div>
          <p className="font-bold text-slate-800 text-xs">You&apos;re all caught up!</p>
          <p className="text-[11px] text-slate-400">No unread announcements on your board.</p>
        </div>
      )}

      {/* Dismissed Announcements Toggle & Archive */}
      {dismissedAnnouncements.length > 0 && (
        <div className="pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowDismissed(!showDismissed)}
            className="w-full flex items-center justify-between text-[11px] font-bold text-slate-500 hover:text-[#0A3D24] transition-colors py-1 cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              {showDismissed ? <EyeOff className="w-3.5 h-3.5 text-slate-400" /> : <Eye className="w-3.5 h-3.5 text-slate-400" />}
              {showDismissed ? 'Hide dismissed notices' : `Show ${dismissedAnnouncements.length} dismissed notice${dismissedAnnouncements.length > 1 ? 's' : ''}`}
            </span>
            <span className="text-[10px] text-slate-400">
              {showDismissed ? '▲' : '▼'}
            </span>
          </button>

          {showDismissed && (
            <div className="space-y-2 mt-2 pt-2 border-t border-slate-100/80 page-fade-in">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Dismissed Archive
                </span>
                <button
                  type="button"
                  onClick={handleClearAllDismissed}
                  className="text-[10px] font-bold text-[#0A3D24] hover:underline cursor-pointer flex items-center gap-1"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  Restore All
                </button>
              </div>

              {dismissedAnnouncements.map((annc) => (
                <div
                  key={annc.announcement_id}
                  className="p-3 rounded-xl bg-slate-100/70 border border-slate-200/60 flex items-start justify-between gap-2 opacity-80 hover:opacity-100 transition-opacity"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 uppercase">
                        {annc.target_department}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(annc.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <h5 className="text-xs font-bold text-slate-700 leading-snug line-clamp-1">{annc.title}</h5>
                    <p className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">{annc.content}</p>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleRestore(annc.announcement_id, e)}
                    title="Restore to active board"
                    className="text-[10px] font-bold text-[#0A3D24] hover:text-[#062415] bg-white border border-slate-200 px-2 py-0.5 rounded shadow-2xs hover:bg-slate-50 transition-all shrink-0 cursor-pointer"
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
