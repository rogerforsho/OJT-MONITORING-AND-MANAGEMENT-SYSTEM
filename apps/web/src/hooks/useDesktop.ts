'use client';

import { useState, useEffect } from 'react';
import { getElectronAPI, type ElectronAPI } from '@/src/lib/desktop';

export function useDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  const [platform, setPlatform] = useState<string>('web');

  useEffect(() => {
    const api = getElectronAPI();
    if (api?.isDesktop) {
      setIsDesktop(true);
      setPlatform(api.platform || 'desktop');
    }
  }, []);

  const showNotification = (title: string, body?: string) => {
    const api = getElectronAPI();
    if (api) {
      api.showNotification(title, body);
    }
  };

  const selectFolder = async (): Promise<string | null> => {
    const api = getElectronAPI();
    if (api) {
      return await api.selectFolder();
    }
    return null;
  };

  const saveFileToFolder = async (folderPath: string, fileName: string, fileDataBase64: string) => {
    const api = getElectronAPI();
    if (api) {
      return await api.saveFileToFolder(folderPath, fileName, fileDataBase64);
    }
    return { success: false, error: 'Not running in desktop app' };
  };

  const minimizeToTray = () => {
    const api = getElectronAPI();
    if (api) {
      api.minimizeToTray();
    }
  };

  const toggleMiniWidget = (enable: boolean) => {
    const api = getElectronAPI();
    if (api) {
      api.toggleMiniWidget(enable);
    }
  };

  return {
    isDesktop,
    platform,
    showNotification,
    selectFolder,
    saveFileToFolder,
    minimizeToTray,
    toggleMiniWidget,
  };
}
