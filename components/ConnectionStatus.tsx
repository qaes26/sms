'use client';

import React from 'react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

interface ConnectionStatusProps {
  status: 'connected' | 'connecting' | 'idle' | 'failed' | 'disconnected' | string;
  isLive?: boolean;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({ status, isLive = false }) => {
  let label = 'Verbindung wird hergestellt...';
  let badgeColor = 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
  let Icon = Loader2;
  let animate = true;

  if (status === 'connected') {
    label = 'Verbunden';
    badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
    Icon = Wifi;
    animate = false;
  } else if (status === 'failed' || status === 'disconnected' || status === 'stopped') {
    label = 'Verbindung getrennt';
    badgeColor = 'bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700';
    Icon = WifiOff;
    animate = false;
  }

  return (
    <div className="flex items-center gap-2">
      {isLive && status === 'connected' && (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-red-100 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-900">
          <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
          Live
        </span>
      )}
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeColor}`}
      >
        <Icon className={`w-3.5 h-3.5 ${animate ? 'animate-spin' : ''}`} />
        <span>{label}</span>
      </span>
    </div>
  );
};
