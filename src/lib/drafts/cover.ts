import { getDraftCover, putDraftCover } from './repository';

/** Largura da capa exibida na home. A altura segue a proporção do formato. */
export const DRAFT_COVER_WIDTH = 480;

type CoverCaptureProvider = () => Promise<Blob | null>;

let provider: CoverCaptureProvider | null = null;
let inFlight: Promise<Blob | null> | null = null;
let lastCaptureAt = 0;
let lastCapturedDraftId: string | null = null;

export function setCoverCaptureProvider(next: CoverCaptureProvider | null): void {
  provider = next;
}

/**
 * A capa é cosmética: a captura pode falhar sem afetar o rascunho. Para não
 * pesar durante a digitação, no máximo uma captura a cada 5 segundos por rascunho;
 * ao sair do editor ou no fechamento de sessão pedimos `force` e ela sempre acontece.
 */
export async function captureAndSaveCover(draftId: string, force = false): Promise<boolean> {
  if (!provider) return false;
  if (!force && lastCapturedDraftId === draftId && Date.now() - lastCaptureAt < 5000) return false;

  if (!inFlight) {
    inFlight = provider();
    void inFlight.finally(() => {
      inFlight = null;
    });
  }

  try {
    const blob = await inFlight;
    if (!blob || blob.size === 0) return false;
    lastCaptureAt = Date.now();
    lastCapturedDraftId = draftId;
    await putDraftCover(draftId, blob);
    return true;
  } catch {
    return false;
  }
}

/**
 * Garante a PRIMEIRA capa do rascunho. Chamado no autosave: um post recém-criado
 * que sofre reload antes de voltar pra home nunca tinha capa, e a home caía no
 * placeholder. Só captura se ainda não existe — a renovação periódica continua
 * restrita ao `force` usado na saída do editor.
 */
export async function ensureCover(draftId: string): Promise<boolean> {
  if (!provider) return false;
  try {
    if (await getDraftCover(draftId)) return false;
  } catch {
    // Sem leitura: tenta gerar mesmo assim; a gravação é cosmética.
  }
  return captureAndSaveCover(draftId, true);
}
