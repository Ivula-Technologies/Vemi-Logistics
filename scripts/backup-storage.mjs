// Copies every file in every Supabase Storage bucket (carrier documents, photos, delivery proofs, border papers) to
// a local folder, keeping the paths. Used by the weekly backup (.github/workflows/backup.yml): database dumps do not
// include stored files.
//
//   SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/backup-storage.mjs <output-folder>
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const PAGE = 1000;
const out = process.argv[2];
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!out || !url || !key) {
  console.error("Usage: SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/backup-storage.mjs <output-folder>");
  process.exit(2);
}
const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

/** Every file path under a folder of a bucket. Entries without an id are folders. */
async function listAll(bucket, prefix) {
  const files = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, { limit: PAGE, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(`Listing ${bucket}/${prefix} failed: ${error.message}`);
    for (const entry of data ?? []) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id) files.push({ path, size: entry.metadata?.size ?? 0 });
      else files.push(...await listAll(bucket, path));
    }
    if (!data || data.length < PAGE) break;
  }
  return files;
}

const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
if (bucketError) { console.error(`Listing buckets failed: ${bucketError.message}`); process.exit(1); }
const manifest = { at: new Date().toISOString(), buckets: {} };
let total = 0; let bytes = 0; const failed = [];
for (const { id: bucket } of buckets) {
  const files = await listAll(bucket, "");
  manifest.buckets[bucket] = files;
  for (const file of files) {
    total += 1;
    const { data, error } = await supabase.storage.from(bucket).download(file.path);
    if (error || !data) { failed.push(`${bucket}/${file.path}`); console.error(`Could not download ${bucket}/${file.path}: ${error?.message ?? "no data"}`); continue; }
    const target = join(out, "storage", bucket, file.path);
    await mkdir(dirname(target), { recursive: true });
    const content = Buffer.from(await data.arrayBuffer());
    await writeFile(target, content);
    bytes += content.length;
  }
}
await writeFile(join(out, "storage-manifest.json"), JSON.stringify({ ...manifest, bytes, failed }, null, 2));
console.log(`Copied ${total - failed.length} of ${total} files from ${buckets.length} buckets (${(bytes / 1048576).toFixed(1)} MB).`);
if (failed.length) process.exit(1);
