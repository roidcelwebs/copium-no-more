import type { ProgramSummary } from "./coach-programs";
import { emitLocalEvent, LOCAL_MEDIA_CHANGED_EVENT } from "./local-events";
import { getLocalBlob, putLocalBlob } from "./local-media";
import type { ProcessedProgramCover } from "./program-cover-processing";

export async function fetchProgramCoverUrls(
  programs: readonly ProgramSummary[],
): Promise<Record<string, string>> {
  const urls: Record<string, string> = {};
  await Promise.all(
    programs.map(async (program) => {
      if (!program.coverImagePath) return;
      const blob = await getLocalBlob(`program-cover:${program.id}`);
      if (blob) urls[program.id] = URL.createObjectURL(blob);
    }),
  );
  return urls;
}

export async function uploadProgramCover({
  programId,
  cover,
}: {
  coachId: string;
  programId: string;
  cover: ProcessedProgramCover;
}): Promise<string> {
  await putLocalBlob(`program-cover:${programId}`, cover.blob);
  emitLocalEvent(LOCAL_MEDIA_CHANGED_EVENT, { programId });
  return `${programId}/cover.webp`;
}
