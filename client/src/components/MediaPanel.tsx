import { ImagePlus, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { validateMediaFile } from "@/lib/mediaValidation";
import { COOKIE_NAME, CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from "@shared/const";

type UploadStatus = "reading" | "uploading" | "failed" | "complete";
type UploadItem = { id: string; file: File; status: UploadStatus; progress: number; error?: string };

function getCookieValue(name: string) {
  return document.cookie.split(";").map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

function uploadHeaders() {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const csrfToken = getCookieValue(CSRF_COOKIE_NAME);
  if (csrfToken) headers[CSRF_HEADER_NAME] = csrfToken;
  if (import.meta.env.DEV && import.meta.env.VITE_CMS_E2E_TEST_AUTH === "1") headers["x-cms-e2e-test-auth"] = "enabled";
  try {
    const token = sessionStorage.getItem("manus-cookie")?.split(";").find(part => part.trim().startsWith(`${COOKIE_NAME}=`))?.trim().slice(`${COOKIE_NAME}=`.length);
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch { /* Embedded browsers can deny session storage. */ }
  return headers;
}

function readFileAsBase64(file: File, onProgress: (percent: number) => void) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onprogress = event => {
      if (event.lengthComputable) onProgress(Math.max(1, Math.min(15, Math.round((event.loaded / event.total) * 15))));
    };
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("Unable to read file."));
    reader.readAsDataURL(file);
  });
}

function uploadWithProgress(input: { fileName: string; mimeType: string; dataBase64: string }, onProgress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/trpc/cms.media.upload?batch=1");
    xhr.withCredentials = true;
    Object.entries(uploadHeaders()).forEach(([name, value]) => xhr.setRequestHeader(name, value));
    xhr.upload.onprogress = event => {
      if (event.lengthComputable) onProgress(Math.max(16, Math.min(99, 15 + Math.round((event.loaded / event.total) * 84))));
    };
    xhr.onerror = () => reject(new Error("Upload request could not be completed."));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      try {
        const body = JSON.parse(xhr.responseText) as Array<{ error?: { json?: { message?: string } } }>;
        reject(new Error(body[0]?.error?.json?.message || "Upload failed."));
      } catch {
        reject(new Error("Upload failed."));
      }
    };
    xhr.send(JSON.stringify({ 0: { json: input } }));
  });
}

export function MediaPanel() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [altText, setAltText] = useState("");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [description, setDescription] = useState("");
  const [uploadQueue, setUploadQueue] = useState<UploadItem[]>([]);
  const media = trpc.cms.media.list.useQuery({ perPage: 30, query: query || undefined });
  const utils = trpc.useUtils();
  const update = trpc.cms.media.update.useMutation({
    onSuccess: () => { utils.cms.media.list.invalidate(); setSelected(null); toast.success("Media metadata saved."); },
    onError: error => toast.error(error.message),
  });
  const replace = trpc.cms.media.replace.useMutation({
    onSuccess: record => { utils.cms.media.list.invalidate(); setSelected(record); toast.success("Media file replaced. Existing content references were preserved."); },
    onError: error => toast.error(error.message),
  });
  const remove = trpc.cms.media.delete.useMutation({
    onSuccess: () => { utils.cms.media.list.invalidate(); setSelected(null); toast.success("Media record removed."); },
    onError: error => toast.error(error.message),
  });

  function updateQueue(id: string, changes: Partial<UploadItem>) {
    setUploadQueue(queue => queue.map(item => item.id === id ? { ...item, ...changes } : item));
  }

  async function uploadFile(file: File, retryId?: string) {
    const id = retryId || crypto.randomUUID();
    const validationError = validateMediaFile(file);
    if (validationError) {
      const failed: UploadItem = { id, file, status: "failed", progress: 0, error: validationError };
      setUploadQueue(queue => retryId ? queue.map(item => item.id === id ? failed : item) : [...queue, failed]);
      toast.error(`${file.name}: ${validationError}`);
      return;
    }
    const initial: UploadItem = { id, file, status: "reading", progress: 0 };
    setUploadQueue(queue => retryId ? queue.map(item => item.id === id ? initial : item) : [...queue, initial]);
    try {
      const dataBase64 = await readFileAsBase64(file, progress => updateQueue(id, { status: "reading", progress }));
      if (!dataBase64) throw new Error("Unable to read file.");
      updateQueue(id, { status: "uploading", progress: 15 });
      await uploadWithProgress({ fileName: file.name, mimeType: file.type, dataBase64 }, progress => updateQueue(id, { status: "uploading", progress }));
      updateQueue(id, { status: "complete", progress: 100, error: undefined });
      utils.cms.media.list.invalidate();
      toast.success(`${file.name} added to the library.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload failed.";
      updateQueue(id, { status: "failed", error: message });
      toast.error(`${file.name}: ${message}`);
    }
  }

  async function selectFiles(files?: FileList | File[]) {
    for (const file of Array.from(files || [])) await uploadFile(file);
  }

  function retryUpload(id: string) {
    const item = uploadQueue.find(candidate => candidate.id === id);
    if (item) void uploadFile(item.file, id);
  }

  async function replaceFile(file?: File) {
    if (!file || !selected) return;
    const validationError = validateMediaFile(file);
    if (validationError) return toast.error(`${file.name}: ${validationError}`);
    try {
      const dataBase64 = await readFileAsBase64(file, () => undefined);
      if (!dataBase64) throw new Error("Unable to read file.");
      await replace.mutateAsync({ id: selected.id, fileName: file.name, mimeType: file.type, dataBase64 });
    } catch (error) {
      toast.error(error instanceof Error ? `${file.name}: ${error.message}` : `${file.name}: replacement failed.`);
    }
  }

  useEffect(() => {
    const prevent = (event: DragEvent) => event.preventDefault();
    const drop = (event: DragEvent) => { event.preventDefault(); if (event.dataTransfer?.files) void selectFiles(event.dataTransfer.files); };
    document.addEventListener("dragover", prevent);
    document.addEventListener("drop", drop);
    return () => { document.removeEventListener("dragover", prevent); document.removeEventListener("drop", drop); };
  }, [uploadQueue]);

  function openItem(item: any) {
    setSelected(item);
    setAltText(item.altText || "");
    setTitle(item.title || "");
    setCaption(item.caption || "");
    setDescription(item.description || "");
  }

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#946b4f]">Asset archive</p>
          <h1 className="mt-1 font-serif text-4xl text-[#30221a]">Media library</h1>
          <p className="mt-2 text-sm text-stone-500">Drop multiple files anywhere in this page, or select files below. JPEG, PNG, WebP, AVIF, GIF, and PDF up to 10 MB each.</p>
        </div>
        <Label className="inline-flex h-10 cursor-pointer items-center rounded-md bg-[#503525] px-4 text-sm font-medium text-white shadow-sm transition hover:bg-[#3f281c]">
          <ImagePlus className="mr-2 h-4 w-4" />Upload files
          <input type="file" className="hidden" multiple accept="image/jpeg,image/png,image/webp,image/avif,image/gif,application/pdf" onChange={event => void selectFiles(event.target.files || [])} />
        </Label>
      </div>
      <div className="rounded-2xl border border-[#e7dfd3] bg-white p-4">
        {uploadQueue.length > 0 && <div aria-live="polite" className="mb-4 space-y-3 rounded-xl border border-[#eee7dc] bg-[#fcfbf8] p-3">
          {uploadQueue.map(item => <div key={item.id} className="space-y-1.5 text-sm">
            <div className="flex items-center gap-3"><span className="min-w-0 flex-1 truncate text-[#453229]">{item.file.name}</span><span className={item.status === "failed" ? "text-destructive" : item.status === "complete" ? "text-emerald-700" : "text-stone-500"}>{item.status === "reading" ? `Reading ${item.progress}%` : item.status === "uploading" ? `Uploading ${item.progress}%` : item.status === "complete" ? "Uploaded 100%" : item.error || "Failed"}</span>{item.status === "failed" && <Button type="button" size="sm" variant="outline" onClick={() => retryUpload(item.id)}>Retry</Button>}</div>
            <div className="h-1.5 overflow-hidden rounded-full bg-stone-200" aria-label={`${item.file.name} upload progress`}><div className={`h-full rounded-full transition-[width] duration-200 ${item.status === "failed" ? "bg-destructive" : item.status === "complete" ? "bg-emerald-600" : "bg-[#946b4f]"}`} style={{ width: `${item.progress}%` }} /></div>
          </div>)}
        </div>}
        <div className="relative mb-4 max-w-sm"><Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search filenames and titles" className="pl-9" /></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">{media.data?.map(item => <button key={item.id} aria-label={`Open media ${item.title || item.fileName}`} onClick={() => openItem(item)} className="group overflow-hidden rounded-xl border border-[#eee7dc] bg-[#fbfaf8] text-left transition hover:-translate-y-0.5 hover:shadow-md"><div className="aspect-square bg-[#efe9df]">{item.mimeType.startsWith("image/") ? <img src={item.url} alt={item.altText || item.fileName} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-stone-500">PDF</div>}</div><div className="p-3"><p className="truncate text-xs font-medium text-[#453229]">{item.title || item.fileName}</p><p className="mt-1 text-[11px] text-stone-500">{Math.ceil(item.sizeBytes / 1024)} KB</p></div></button>)}</div>
        {!media.data?.length && !media.isLoading && <div className="py-16 text-center text-sm text-stone-500">No media files have been uploaded.</div>}
      </div>
      <Dialog open={Boolean(selected)} onOpenChange={open => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{selected?.fileName}</DialogTitle><DialogDescription>Update accessible and editorial metadata, replace the stored file, or remove this library record.</DialogDescription></DialogHeader>
          {selected && <div className="space-y-4"><div className="max-h-56 overflow-hidden rounded-lg bg-[#f3eee6]">{selected.mimeType.startsWith("image/") ? <img src={selected.url} alt={altText || selected.fileName} className="w-full object-contain" /> : <div className="p-8 text-center text-sm text-stone-500">Document file</div>}</div><div><Label htmlFor="media-alt-text">Alternative text</Label><Input id="media-alt-text" className="mt-2" value={altText} onChange={event => setAltText(event.target.value)} /></div><div><Label htmlFor="media-title">Title</Label><Input id="media-title" className="mt-2" value={title} onChange={event => setTitle(event.target.value)} placeholder={selected.fileName} /></div><div><Label htmlFor="media-caption">Caption</Label><Textarea id="media-caption" className="mt-2" value={caption} onChange={event => setCaption(event.target.value)} /></div><div><Label htmlFor="media-description">Description</Label><Textarea id="media-description" className="mt-2 min-h-24" value={description} onChange={event => setDescription(event.target.value)} placeholder="Internal or editorial notes about this asset." /></div><Label className="inline-flex cursor-pointer items-center text-sm font-medium text-[#70513d] underline underline-offset-4"><ImagePlus className="mr-2 h-4 w-4" />{replace.isPending ? "Replacing file…" : "Replace file"}<input type="file" className="hidden" accept="image/jpeg,image/png,image/webp,image/avif,image/gif,application/pdf" disabled={replace.isPending} onChange={event => void replaceFile(event.target.files?.[0])} /></Label><div className="flex justify-between gap-3"><Button variant="destructive" onClick={() => window.confirm(`Remove ${selected.fileName} from the library?`) && remove.mutate({ id: selected.id })}><Trash2 className="mr-2 h-4 w-4" />Remove record</Button><Button onClick={() => update.mutate({ id: selected.id, values: { altText: altText || null, title: title || null, caption: caption || null, description: description || null } })} disabled={update.isPending}>{update.isPending ? "Saving…" : "Save metadata"}</Button></div></div>}
        </DialogContent>
      </Dialog>
    </section>
  );
}
