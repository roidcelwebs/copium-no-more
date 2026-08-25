import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Images, Link2, LoaderCircle, Plus, Radio, Send, Trash2 } from "lucide-react";
import { useAccount } from "@/components/account/AccountProvider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { type AppAccount, fetchAccounts } from "@/lib/cloud-accounts";
import {
  LOCAL_BROADCASTS_CHANGED_EVENT,
  createBroadcastLink,
  fetchLocalBroadcastHistory,
  sendLocalBroadcast,
  type LocalBroadcastRecord,
} from "@/lib/local-broadcasts";
import { LOCAL_ACCOUNTS_CHANGED_EVENT } from "@/lib/local-events";
import {
  type ProcessedProgressPicture,
  formatProgressPictureBytes,
  processProgressPictures,
} from "@/lib/progress-picture-processing";

type StagedImage = ProcessedProgressPicture & { previewUrl: string };

export function BroadcastComposer() {
  const { account } = useAccount();
  const [clients, setClients] = useState<AppAccount[]>([]);
  const [recipientMode, setRecipientMode] = useState<"all" | "selected">("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [links, setLinks] = useState<Array<{ id: string; text: string; url: string }>>([]);
  const [images, setImages] = useState<StagedImage[]>([]);
  const [history, setHistory] = useState<LocalBroadcastRecord[]>([]);
  const [processing, setProcessing] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef<StagedImage[]>([]);

  const load = useCallback(async () => {
    const accounts = await fetchAccounts();
    setClients(accounts.filter((candidate) => candidate.role === "client"));
    setHistory(fetchLocalBroadcastHistory());
  }, []);

  useEffect(() => {
    void load();
    const onChange = () => void load();
    window.addEventListener(LOCAL_ACCOUNTS_CHANGED_EVENT, onChange);
    window.addEventListener(LOCAL_BROADCASTS_CHANGED_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(LOCAL_ACCOUNTS_CHANGED_EVENT, onChange);
      window.removeEventListener(LOCAL_BROADCASTS_CHANGED_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [load]);

  imagesRef.current = images;

  useEffect(
    () => () => imagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl)),
    [],
  );

  const addImages = async (files: FileList | null) => {
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
        nextError instanceof Error ? nextError.message : "The images could not be processed because a file is invalid or too large. What happened: image processing failed. Why: file may be corrupted or over 2.5MB. What to do: try again with smaller valid images (max 6, WebP optimized) and check device storage.",
      );
    } finally {
      setProcessing(false);
      setProgress(0);
    }
  };

  const recipients = recipientMode === "all" ? clients.map((client) => client.id) : selectedIds;

  const send = async () => {
    if (!account || account.role !== "coach" || sending) return;
    if (!recipients.length) {
      setError("No recipients selected. What happened: no Clients chosen. Why: a broadcast needs at least one recipient. What to do: choose All Clients or select at least one Client and try again.");
      return;
    }
    if (
      !window.confirm(
        `Send this broadcast to ${recipients.length} Client${recipients.length === 1 ? "" : "s"}?`,
      )
    )
      return;
    setSending(true);
    setError(null);
    try {
      await sendLocalBroadcast({
        coachId: account.id,
        recipientIds: recipients,
        text,
        links,
        pictures: images,
        onProgress: (done, total) => setProgress(Math.round((done / total) * 100)),
      });
      images.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      setText("");
      setLinks([]);
      setImages([]);
      setSelectedIds([]);
      setRecipientMode("all");
      setHistory(fetchLocalBroadcastHistory());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "The broadcast could not be sent.");
    } finally {
      setSending(false);
      setProgress(0);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">New broadcast</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Send an immediate permanent Coach chat message to all or selected local Clients.
        </p>
      </div>

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-card-foreground">Recipients</h3>
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant={recipientMode === "all" ? "default" : "outline"}
            onClick={() => setRecipientMode("all")}
          >
            All Clients
          </Button>
          <Button
            type="button"
            variant={recipientMode === "selected" ? "default" : "outline"}
            onClick={() => setRecipientMode("selected")}
          >
            Selected
          </Button>
        </div>
        {recipientMode === "selected" && (
          <div className="max-h-52 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
            {clients.length === 0 ? (
              <p className="text-sm text-muted-foreground">No local Clients exist yet.</p>
            ) : (
              clients.map((client) => (
                <label
                  key={client.id}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-accent"
                >
                  <Checkbox
                    checked={selectedIds.includes(client.id)}
                    onCheckedChange={(checked) =>
                      setSelectedIds((current) =>
                        checked
                          ? [...new Set([...current, client.id])]
                          : current.filter((id) => id !== client.id),
                      )
                    }
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{client.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      @{client.username}
                    </span>
                  </span>
                </label>
              ))
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {recipients.length} recipient{recipients.length === 1 ? "" : "s"}
        </p>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div className="space-y-1.5">
          <Label htmlFor="broadcast-text">Message text</Label>
          <Textarea
            id="broadcast-text"
            value={text}
            maxLength={2000}
            rows={5}
            placeholder="Write the Coach broadcast"
            onChange={(event) => setText(event.target.value)}
          />
          <p className="text-right text-xs text-muted-foreground">{text.length}/2000</p>
        </div>

        {links.map((link, index) => (
          <div key={link.id} className="rounded-lg border border-border bg-background p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-medium">External link {index + 1}</p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Delete link"
                onClick={() =>
                  setLinks((current) => current.filter((candidate) => candidate.id !== link.id))
                }
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <div className="space-y-2">
              <Input
                value={link.text}
                maxLength={2000}
                placeholder="Visible link text"
                onChange={(event) =>
                  setLinks((current) =>
                    current.map((candidate) =>
                      candidate.id === link.id
                        ? { ...candidate, text: event.target.value }
                        : candidate,
                    ),
                  )
                }
              />
              <Input
                value={link.url}
                maxLength={2048}
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="https://example.com"
                onChange={(event) =>
                  setLinks((current) =>
                    current.map((candidate) =>
                      candidate.id === link.id
                        ? { ...candidate, url: event.target.value }
                        : candidate,
                    ),
                  )
                }
              />
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setLinks((current) => [...current, createBroadcastLink()])}
        >
          <Link2 className="h-4 w-4" aria-hidden="true" />
          Add link
        </Button>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-card-foreground">Images</h3>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => {
            void addImages(event.target.files);
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
            void addImages(event.target.files);
            event.target.value = "";
          }}
        />
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={processing || sending || images.length >= 6}
            onClick={() => cameraRef.current?.click()}
          >
            <Camera className="h-4 w-4" aria-hidden="true" />
            Camera
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={processing || sending || images.length >= 6}
            onClick={() => galleryRef.current?.click()}
          >
            <Images className="h-4 w-4" aria-hidden="true" />
            Gallery
          </Button>
        </div>
        {images.length > 0 && (
          <ul className="grid grid-cols-3 gap-2">
            {images.map((image) => (
              <li
                key={image.id}
                className="relative overflow-hidden rounded-lg border border-border"
              >
                <img
                  src={image.previewUrl}
                  alt="Selected broadcast attachment"
                  className="aspect-square w-full object-cover"
                />
                <div className="flex items-center justify-between gap-1 p-1.5">
                  <span className="truncate text-[10px] text-muted-foreground">
                    {formatProgressPictureBytes(image.byteSize)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="Remove image"
                    onClick={() => {
                      URL.revokeObjectURL(image.previewUrl);
                      setImages((current) =>
                        current.filter((candidate) => candidate.id !== image.id),
                      );
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {(processing || sending) && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            {processing ? "Processing images…" : "Sending broadcast…"}
          </div>
          <Progress value={progress} />
        </div>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <Button
        type="button"
        className="w-full"
        disabled={
          sending ||
          processing ||
          !recipients.length ||
          (!text.trim() && !links.length && !images.length)
        }
        onClick={() => void send()}
      >
        <Send className="h-4 w-4" />
        Send broadcast now
      </Button>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Recent broadcasts</h3>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No broadcasts sent on this device.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {history.slice(0, 10).map((record) => (
              <li key={record.id} className="p-3">
                <p className="truncate text-sm font-medium">{record.summary}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {record.recipientCount} recipient{record.recipientCount === 1 ? "" : "s"} ·{" "}
                  {formatDate(record.sentAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown time"
    : new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(date);
}
