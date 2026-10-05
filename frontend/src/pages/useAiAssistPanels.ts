import { useCallback, useState } from 'react';

export type AiAssistSeed = { prompt: string; nonce: number };

export function useAiAssistPanels() {
  const [showAiFixPanel, setShowAiFixPanel] = useState(false);
  const [aiFixSeed, setAiFixSeed] = useState<AiAssistSeed | null>(null);
  const [showAiLayerPanel, setShowAiLayerPanel] = useState(false);
  const [aiLayerSeed, setAiLayerSeed] = useState<AiAssistSeed | null>(null);

  const openAiFixPanel = useCallback((prompt: string) => {
    setAiFixSeed({ prompt, nonce: Date.now() });
    setShowAiFixPanel(true);
  }, []);

  const closeAiFixPanel = useCallback(() => setShowAiFixPanel(false), []);

  const openAiLayerPanel = useCallback((prompt: string) => {
    setAiLayerSeed({ prompt, nonce: Date.now() });
    setShowAiLayerPanel(true);
  }, []);

  const closeAiLayerPanel = useCallback(() => setShowAiLayerPanel(false), []);

  return {
    showAiFixPanel,
    aiFixSeed,
    showAiLayerPanel,
    aiLayerSeed,
    openAiFixPanel,
    closeAiFixPanel,
    openAiLayerPanel,
    closeAiLayerPanel,
  };
}
