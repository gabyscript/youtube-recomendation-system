import type { RedemptionOutcome, RedemptionRejectionReason } from "../../types/redemption/redemption.js";

const MAX_TITLE_LENGTH: number = 100;

const REJECTION_MESSAGES: Readonly<Record<RedemptionRejectionReason, string>> = {
  invalid_link: "❌ No encontré un link de YouTube válido en tu canje.",
  not_found: "❌ El video no existe o fue eliminado.",
  private: "❌ El video es privado.",
  not_embeddable: "❌ El video no permite reproducirse fuera de YouTube.",
  live: "❌ No se aceptan transmisiones en vivo ni estrenos.",
  duplicate: "❌ Ese video ya está en la playlist.",
};

function shortenTitle(videoTitle: string): string {
  return videoTitle.length > MAX_TITLE_LENGTH ? `${videoTitle.slice(0, MAX_TITLE_LENGTH - 1)}…` : videoTitle;
}

export function buildChatMessage(userName: string, redemptionOutcome: RedemptionOutcome): string {
  const mention: string = `@${userName}`;

  switch (redemptionOutcome.status) {
    case "added":
      return `${mention} ✅ "${shortenTitle(redemptionOutcome.videoTitle)}" se agregó a la playlist.`;
    case "rejected":
      return `${mention} ${REJECTION_MESSAGES[redemptionOutcome.reason]}`;
    case "service_unavailable":
      return `${mention} ⚠️ YouTube no está disponible ahora mismo, tu canje no se pudo procesar.`;
    case "unexpected_error":
      return `${mention} ⚠️ Ocurrió un error al procesar tu canje.`;
  }
}
