import { useEffect, useState } from 'react';

import {
  fetchAIPersonas,
  fetchMistralModelPreferences,
  type AIPersona,
  type MistralModelPreference,
} from '../api/aiPreferences';

/**
 * Issue #262: the user's saved Mistral models and Personas, shared by
 * `AIProposalPanel.tsx` (2D) and `AIProposalPanel3D.tsx` (3D) to populate
 * their model/persona dropdowns -- both document families read from the
 * same per-user preferences (#259/#261), so this is one fetch, not a
 * document-family-specific one. A fetch failure resolves to an empty
 * list (the panel's own empty-state copy already handles "no saved
 * models/personas yet", so a load error degrades to the same UI rather
 * than a separate error state).
 */
export function useSavedAIPreferences() {
  const [models, setModels] = useState<MistralModelPreference[] | null>(null);
  const [personas, setPersonas] = useState<AIPersona[] | null>(null);

  useEffect(() => {
    fetchMistralModelPreferences()
      .then(setModels)
      .catch(() => setModels([]));
    fetchAIPersonas()
      .then(setPersonas)
      .catch(() => setPersonas([]));
  }, []);

  return {
    models: models ?? [],
    personas: personas ?? [],
    loading: models === null || personas === null,
  };
}
