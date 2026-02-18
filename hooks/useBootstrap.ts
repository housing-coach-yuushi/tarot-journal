'use client';

import { useState, useCallback } from 'react';

interface Identity {
  name?: string;
  creature?: string;
  vibe?: string;
  emoji?: string;
  voiceId?: string;
  showDebug?: boolean;
  bgmEnabled?: boolean;
}

interface User {
  name?: string;
  callName?: string;
}

interface BootstrapState {
  isBootstrapped: boolean;
  identity?: Identity;
  user?: User;
}

interface UseBootstrapReturn {
  bootstrap: BootstrapState;
  setBootstrap: React.Dispatch<React.SetStateAction<BootstrapState>>;
  updateIdentity: (updates: Partial<Identity>) => void;
  updateUser: (updates: Partial<User>) => void;
}

export function useBootstrap(): UseBootstrapReturn {
  const [bootstrap, setBootstrap] = useState<BootstrapState>({
    isBootstrapped: false,
    identity: { showDebug: false },
  });

  const updateIdentity = useCallback((updates: Partial<Identity>) => {
    setBootstrap(prev => ({
      ...prev,
      identity: {
        ...prev.identity,
        ...updates,
      },
    }));
  }, []);

  const updateUser = useCallback((updates: Partial<User>) => {
    setBootstrap(prev => ({
      ...prev,
      user: {
        ...prev.user,
        ...updates,
      },
    }));
  }, []);

  return {
    bootstrap,
    setBootstrap,
    updateIdentity,
    updateUser,
  };
}
