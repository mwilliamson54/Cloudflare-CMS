import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { validateMediaFile } from "@/lib/mediaValidation";
import { ArrowDown, ArrowUp, Box, GripVertical, ImagePlus, List, ListOrdered, Loader2, Plus, Table2, Trash2, Type, Video } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export type GraphicalBlock =
  | { id: string; type: "heading"; level: 1 | 2 | 3 | 4 | 5 | 6; text: string }
  | { id: string; type: "paragraph"; text: string }
  | { id: string; type: "list"; ordered: boolean; items: string[] }
  | { id: string; type: "table"; headers: string[]; rows: string[][] }
  | { id: string; type: "image"; mediaId?: number; src: string; alt: string; caption: string }
  | { id: string; type: "embed"; url: string; title: string }
  | { id: string; type: "widget"; widget: "callout" | "note"; title: string; body: string };

export type GraphicalDocument = { blocks: GraphicalBlock[] };

const graphicMarker = "<!-- atelier-graphical:";
const allowedEmbedHosts = new Set(["www.youtube.com", "www.youtube-nocookie.com", "player.vimeo.com", "open.spotify.com", "www.instagram.com"]);
const uid = () => crypto.randomUUID();
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);

export function isTrustedEmbedUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && allowedEmbedHosts.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function defaultGraphicalBlocks(markdown = ""): GraphicalBlock[] {
  const paragraphs = markdown.replace(/^<!-- atelier-graphical:[\s\S]*?-->\s*/i, "").split(/\n{2,}/).map(value => value.trim()).filter(Boolean);
  return paragraphs.length ? paragraphs.map((text, index) => ({ id: `import-${index}`, type: "paragraph", text })) : [{ id: uid(), type: "paragraph", text: "Start composing your story." }];
}

function parseGraphicalDocument(markdown: string): GraphicalBlock[] | null {
  const markerIndex = markdown.indexOf(graphicMarker);
  if (markerIndex !== 0) return null;
  const end = markdown.indexOf("-->");
  if (end < 0) return null;
  try {
    const decoded = decodeURIComponent(escape(atob(markdown.slice(graphicMarker.length, end).trim())));
    const parsed = JSON.parse(decoded) as GraphicalDocument;
    return Array.isArray(parsed.blocks) ? parsed.blocks : null;
  } catch {
    return null;
  }
}

function encodeGraphicalDocument(blocks: GraphicalBlock[]) {
  return `${graphicMarker}${btoa(unescape(encodeURIComponent(JSON.stringify({ blocks } satisfies GraphicalDocument))))}-->`;
}

export function blocksToHtml(blocks: GraphicalBlock[]) {
  return blocks.map(block => {
    if (block.type === "heading") return `<h${block.level}>${escapeHtml(block.text)}</h${block.level}>`;
    if (block.type === "paragraph") return `<p>${escapeHtml(block.text).replace(/\n/g, "<br>")}</p>`;
    if (block.type === "list") return `<${block.ordered ? "ol" : "ul"}>${block.items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</${block.ordered ? "ol" : "ul"}>`;
    if (block.type === "table") return `<table><thead><tr>${block.headers.map(header => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${block.rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    if (block.type === "image") return `<figure><img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt)}">${block.caption ? `<figcaption>${escapeHtml(block.caption)}</figcaption>` : ""}</figure>`;
    if (block.type === "embed") return isTrustedEmbedUrl(block.url) ? `<iframe src="${escapeHtml(block.url)}" title="${escapeHtml(block.title || "Embedded media")}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation"></iframe>` : "";
    return `<aside class="cms-widget cms-widget-${block.widget}"><strong>${escapeHtml(block.title)}</strong><p>${escapeHtml(block.body)}</p></aside>`;
  }).join("\n");
}

export function blocksToMarkdown(blocks: GraphicalBlock[]) {
  return `${encodeGraphicalDocument(blocks)}\n\n${blocks.map(block => {
    if (block.type === "heading") return `${"#".repeat(block.level)} ${block.text}`;
    if (block.type === "paragraph") return block.text;
    if (block.type === "list") return block.items.map((item, index) => `${block.ordered ? `${index + 1}.` : "-"} ${item}`).join("\n");
    if (block.type === "table") return `| ${block.headers.join(" | ")} |\n| ${block.headers.map(() => "---").join(" | ")} |\n${block.rows.map(row => `| ${row.join(" | ")} |`).join("\n")}`;
    if (block.type === "image") return `![${block.alt}](${block.src})${block.caption ? `\n*${block.caption}*` : ""}`;
    if (block.type === "embed") return `[Embedded media: ${block.title || block.url}](${block.url})`;
    return `> ${block.title}\n> ${block.body}`;
  }).join("\n\n")}`;
}

function readFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = () => reject(new Error("Unable to read file."));
    reader.readAsDataURL(file);
  });
}

type Props = { initialMarkdown: string; onChange: (value: { markdown: string; html: string }) => void };

export function GraphicalBlockEditor({ initialMarkdown, onChange }: Props) {
  const [blocks, setBlocks] = useState<GraphicalBlock[]>(() => parseGraphicalDocument(initialMarkdown) || defaultGraphicalBlocks(initialMarkdown));
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [mediaTarget, setMediaTarget] = useState<string | null>(null);
  const [mediaQuery, setMediaQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const media = trpc.cms.media.list.useQuery({ perPage: 30, query: mediaQuery || undefined });
  const upload = trpc.cms.media.upload.useMutation();
  const orderedBlocks = useMemo(() => blocks, [blocks]);

  function commit(next: GraphicalBlock[]) {
    setBlocks(next);
    onChange({ markdown: blocksToMarkdown(next), html: blocksToHtml(next) });
  }
  function patch(id: string, changes: Partial<GraphicalBlock>) { commit(blocks.map(block => block.id === id ? { ...block, ...changes } as GraphicalBlock : block)); }
  function add(type: GraphicalBlock["type"]) {
    const next: GraphicalBlock = type === "heading" ? { id: uid(), type, level: 2, text: "Section heading" } : type === "paragraph" ? { id: uid(), type, text: "New paragraph." } : type === "list" ? { id: uid(), type, ordered: false, items: ["List item", "List item"] } : type === "table" ? { id: uid(), type, headers: ["Column one", "Column two"], rows: [["Value", "Value"], ["Value", "Value"]] } : type === "image" ? { id: uid(), type, src: "", alt: "", caption: "" } : type === "embed" ? { id: uid(), type, url: "", title: "" } : { id: uid(), type, widget: "callout", title: "Editorial note", body: "Add a considered aside for readers." };
    commit([...blocks, next]);
  }
  function move(index: number, direction: -1 | 1) { const target = index + direction; if (target < 0 || target >= blocks.length) return; const next = [...blocks]; [next[index], next[target]] = [next[target], next[index]]; commit(next); }
  function setImage(id: string, item: any) { patch(id, { mediaId: item.id, src: item.url, alt: item.altText || item.title || item.fileName, caption: item.caption || "" }); setMediaTarget(null); }
  async function uploadImage(file?: File, targetId = mediaTarget) {
    if (!file || !targetId) return;
    const error = validateMediaFile(file);
    if (error) return toast.error(`${file.name}: ${error}`);
    setUploading(true);
    try {
      const dataBase64 = await readFile(file);
      const record = await upload.mutateAsync({ fileName: file.name, mimeType: file.type, dataBase64, altText: null, title: null });
      setImage(targetId, record);
      await media.refetch();
      toast.success(`${file.name} was uploaded to the R2 media library and inserted.`);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "The media upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return <div className="rounded-xl border border-[#e7dfd3] bg-[#fcfbf8] p-4" data-testid="graphical-editor">
    <div className="flex flex-wrap gap-2 border-b border-[#eadfce] pb-4">
      <Button type="button" variant="outline" size="sm" onClick={() => add("heading")}><Type className="mr-1.5 h-3.5 w-3.5" />Heading</Button>
      <Button type="button" variant="outline" size="sm" onClick={() => add("paragraph")}><Plus className="mr-1.5 h-3.5 w-3.5" />Paragraph</Button>
      <Button type="button" variant="outline" size="sm" onClick={() => add("list")}><List className="mr-1.5 h-3.5 w-3.5" />List</Button>
      <Button type="button" variant="outline" size="sm" onClick={() => add("table")}><Table2 className="mr-1.5 h-3.5 w-3.5" />Table</Button>
      <Button type="button" variant="outline" size="sm" onClick={() => add("image")}><ImagePlus className="mr-1.5 h-3.5 w-3.5" />Image</Button>
      <Button type="button" variant="outline" size="sm" onClick={() => add("embed")}><Video className="mr-1.5 h-3.5 w-3.5" />Embed</Button>
      <Button type="button" variant="outline" size="sm" onClick={() => add("widget")}><Box className="mr-1.5 h-3.5 w-3.5" />Widget</Button>
    </div>
    <p className="mt-3 text-xs leading-5 text-stone-500">Build safely rendered content with drag-reorderable blocks. Image drops upload through the CMS media procedure to R2. Embeds accept only approved HTTPS providers; widgets are structured editorial callouts, not executable code.</p>
    <div className="mt-4 space-y-3">
      {orderedBlocks.map((block, index) => <section key={block.id} draggable onDragStart={() => setDraggedIndex(index)} onDragOver={event => event.preventDefault()} onDrop={() => { if (draggedIndex === null || draggedIndex === index) return; const next = [...blocks]; const [moved] = next.splice(draggedIndex, 1); next.splice(index, 0, moved); setDraggedIndex(null); commit(next); }} className="rounded-xl border border-[#e7dfd3] bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#946b4f]"><GripVertical className="h-4 w-4 cursor-grab" aria-hidden="true" />{block.type}</div><div className="flex gap-1"><Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0} aria-label={`Move ${block.type} block up`} onClick={() => move(index, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button><Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={index === blocks.length - 1} aria-label={`Move ${block.type} block down`} onClick={() => move(index, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button><Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" aria-label={`Remove ${block.type} block`} onClick={() => commit(blocks.filter(candidate => candidate.id !== block.id))}><Trash2 className="h-3.5 w-3.5" /></Button></div></div>
        {block.type === "heading" && <div className="grid gap-2 sm:grid-cols-[110px_1fr]"><select aria-label="Heading level" value={block.level} onChange={event => patch(block.id, { level: Number(event.target.value) as 1 | 2 | 3 | 4 | 5 | 6 })} className="rounded-md border border-input bg-background px-3 text-sm"><option value="1">H1</option><option value="2">H2</option><option value="3">H3</option><option value="4">H4</option><option value="5">H5</option><option value="6">H6</option></select><Input aria-label="Heading text" value={block.text} onChange={event => patch(block.id, { text: event.target.value })} /></div>}
        {block.type === "paragraph" && <Textarea aria-label="Paragraph text" value={block.text} onChange={event => patch(block.id, { text: event.target.value })} className="min-h-24" />}
        {block.type === "list" && <div className="space-y-2"><Button type="button" size="sm" variant="outline" onClick={() => patch(block.id, { ordered: !block.ordered })}>{block.ordered ? <ListOrdered className="mr-1.5 h-3.5 w-3.5" /> : <List className="mr-1.5 h-3.5 w-3.5" />}{block.ordered ? "Numbered" : "Bulleted"}</Button>{block.items.map((item, itemIndex) => <Input key={`${block.id}-${itemIndex}`} aria-label={`List item ${itemIndex + 1}`} value={item} onChange={event => patch(block.id, { items: block.items.map((value, index) => index === itemIndex ? event.target.value : value) })} />)}<Button type="button" size="sm" variant="ghost" onClick={() => patch(block.id, { items: [...block.items, "List item"] })}>Add list item</Button></div>}
        {block.type === "table" && <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{block.headers.map((header, column) => <th className="p-1" key={`${block.id}-h-${column}`}><Input aria-label={`Table heading ${column + 1}`} value={header} onChange={event => patch(block.id, { headers: block.headers.map((value, index) => index === column ? event.target.value : value) })} /></th>)}</tr></thead><tbody>{block.rows.map((row, rowIndex) => <tr key={`${block.id}-r-${rowIndex}`}>{row.map((cell, column) => <td className="p-1" key={`${block.id}-${rowIndex}-${column}`}><Input aria-label={`Table row ${rowIndex + 1} column ${column + 1}`} value={cell} onChange={event => patch(block.id, { rows: block.rows.map((current, index) => index === rowIndex ? current.map((value, cellIndex) => cellIndex === column ? event.target.value : value) : current) })} /></td>)}</tr>)}</tbody></table><Button type="button" size="sm" variant="ghost" className="mt-2" onClick={() => patch(block.id, { rows: [...block.rows, block.headers.map(() => "")] })}>Add table row</Button></div>}
        {block.type === "image" && <div className="space-y-3" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); void uploadImage(event.dataTransfer.files?.[0], block.id); }}><div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" onClick={() => setMediaTarget(block.id)}><ImagePlus className="mr-1.5 h-3.5 w-3.5" />Choose from R2 media library</Button><Label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-input px-3 text-xs font-medium">Drop or upload image<input className="hidden" type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/gif" onChange={event => void uploadImage(event.target.files?.[0], block.id)} /></Label></div>{block.src ? <img src={block.src} alt={block.alt || "Selected media"} className="max-h-64 rounded-lg object-cover" /> : <div className="rounded-lg border border-dashed border-[#d9cdbf] p-6 text-center text-sm text-stone-500">Drop an allowed image here to upload it to R2 and insert it into this block.</div>}<Input aria-label="Image alternative text" value={block.alt} onChange={event => patch(block.id, { alt: event.target.value })} placeholder="Describe the image for readers using assistive technology" /><Input aria-label="Image caption" value={block.caption} onChange={event => patch(block.id, { caption: event.target.value })} placeholder="Optional caption" /></div>}
        {block.type === "embed" && <div className="space-y-2"><Input aria-label="Embed URL" value={block.url} onChange={event => patch(block.id, { url: event.target.value })} placeholder="https://www.youtube.com/embed/..." /><Input aria-label="Embed title" value={block.title} onChange={event => patch(block.id, { title: event.target.value })} placeholder="Accessible embed title" />{block.url && !isTrustedEmbedUrl(block.url) && <p className="text-xs text-destructive">Use a supported HTTPS provider: YouTube, Vimeo, Spotify, or Instagram.</p>}</div>}
        {block.type === "widget" && <div className="space-y-2"><select aria-label="Widget type" value={block.widget} onChange={event => patch(block.id, { widget: event.target.value as "callout" | "note" })} className="rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="callout">Callout</option><option value="note">Editorial note</option></select><Input aria-label="Widget title" value={block.title} onChange={event => patch(block.id, { title: event.target.value })} /><Textarea aria-label="Widget body" value={block.body} onChange={event => patch(block.id, { body: event.target.value })} /></div>}
      </section>)}
    </div>
    <Dialog open={Boolean(mediaTarget)} onOpenChange={open => !open && setMediaTarget(null)}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>Choose an R2 media asset</DialogTitle><DialogDescription>Select an existing image or upload a new allowed image directly into the CMS media library.</DialogDescription></DialogHeader><Input value={mediaQuery} onChange={event => setMediaQuery(event.target.value)} placeholder="Search media" />{uploading && <p className="flex items-center gap-2 text-sm text-stone-500"><Loader2 className="h-4 w-4 animate-spin" />Uploading to R2…</p>}<div className="grid max-h-[55vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">{media.data?.filter(item => item.mimeType.startsWith("image/")).map(item => <button type="button" key={item.id} onClick={() => mediaTarget && setImage(mediaTarget, item)} className="overflow-hidden rounded-lg border border-[#e7dfd3] text-left hover:border-[#946b4f]"><img src={item.url} alt={item.altText || item.fileName} className="aspect-square w-full object-cover" /><span className="block truncate p-2 text-xs">{item.title || item.fileName}</span></button>)}</div></DialogContent></Dialog>
  </div>;
}
