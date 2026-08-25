import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Images, LoaderCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { sendChatImages } from "@/lib/chat";
import {
  type ProcessedProgressPicture,
  formatProgressPictureBytes,
  processProgressPictures,
} from "@/lib/progress-picture-processing";

type StagedImage = ProcessedProgressPicture & { previewUrl: string };

export function ChatImageUploadDialog({
  clientId,
  senderAccountId,
  onSent,
  buttonLabel = "Send images",
  iconOnly = false,
}: {
  clientId: string;
  senderAccountId: string;
  onSent: () => Promise<void>;
  buttonLabel?: string;
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [images, setImages] = useState<StagedImage[]>([]);
  const [processing, setProcessing] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open || sending) return;
    images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    setImages([]);
    setError(null);
    setProgress(0);
    // images are intentionally read only when closing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sending]);

  const addFiles = async (files: FileList | null) => {
    if (!files?.length || processing || sending) return;
    const remaining = 6 - images.length;
    if (remaining <= 0) return;
    setProcessing(true);
    setError(null);
    try {
      const processed = await processProgressPictures(Array.from(files), remaining, (done, total) =>
        setProgress(Math.round((done / total) * 100)),
      );
      setImages((current) => [
        ...current,
        ...processed.map((image) => ({ ...image, previewUrl: URL.createObjectURL(image.blob) })),
      ]);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "These images could not be processed. Try again with smaller images and check device storage.",
      );
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  const send = async () => {
    if (!images.length || processing || sending) return;
    setSending(true);
    setError(null);
    setProgress(0);
    try {
      await sendChatImages({
        clientId,
        senderAccountId,
        pictures: images,
        onProgress: (done, total) => setProgress(Math.round((done / total) * 100)),
      });
      await onSent();
      setOpen(false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "The images could not be sent because local storage is unavailable or full. Check device storage and try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !sending && !processing && setOpen(next)}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={iconOnly ? "icon" : "default"}
          aria-label={buttonLabel}
          className={iconOnly ? "min-h-11 min-w-11 rounded-xl" : "min-h-12 rounded-xl text-[1rem]"}
        >
          <ImagePlus className="h-5 w-5" aria-hidden="true" />
          {!iconOnly && buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[1.25rem] font-semibold tracking-tight">Send images</DialogTitle>
          <DialogDescription className="text-[1rem] leading-5 text-muted-foreground">
            Select one to six images. They are optimized and stored only in this browser.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => {
            void addFiles(event.target.files);
            event.target.value = "";
          }}
        />
        <input
          ref={galleryRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            void addFiles(event.target.files);
            event.target.value = "";
          }}
        />

        <div className="grid grid-cols-2 gap-2.5">
          <Button
            type="button"
            variant="outline"
            disabled={processing || sending || images.length >= 6}
            onClick={() => cameraRef.current?.click()}
            className="min-h-12 rounded-xl text-[1rem]"
          >
            <Camera className="h-5 w-5" aria-hidden="true" />
            Camera
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={processing || sending || images.length >= 6}
            onClick={() => galleryRef.current?.click()}
            className="min-h-12 rounded-xl text-[1rem]"
          >
            <Images className="h-5 w-5" aria-hidden="true" />
            Gallery
          </Button>
        </div>

        {images.length > 0 && (
          <ul className="grid grid-cols-3 gap-2.5">
            {images.map((image) => (
              <li
                key={image.id}
                className="relative overflow-hidden rounded-xl border border-border"
              >
                <img
                  src={image.previewUrl}
                  alt="Selected chat attachment"
                  className="aspect-square w-full object-cover"
                />
                <div className="flex items-center justify-between gap-1 p-1.5">
                  <span className="truncate text-[0.8125rem] leading-4 text-muted-foreground">
                    {formatProgressPictureBytes(image.byteSize)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
                    disabled={sending}
                    aria-label="Remove image"
                    onClick={() => {
                      URL.revokeObjectURL(image.previewUrl);
                      setImages((current) =>
                        current.filter((candidate) => candidate.id !== image.id),
                      );
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {(processing || sending) && (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2.5 text-[1rem] leading-6 text-muted-foreground">
              <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
              {processing ? "Processing images…" : "Saving images…"}
            </div>
            <Progress value={progress} />
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-[1rem] leading-5 text-destructive">
            {error}
          </p>
        )}

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={processing || sending}
            onClick={() => setOpen(false)}
            className="min-h-11 rounded-xl"
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!images.length || processing || sending}
            onClick={() => void send()}
            className="min-h-11 rounded-xl"
          >
            Send {images.length || ""} image{images.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
