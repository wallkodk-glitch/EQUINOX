import { canonical, regenerate, type Snapshot } from "./calculate";
export type SealedSnapshot = { id: string; sha256: string; snapshot: Snapshot };
export async function sha256(value: unknown): Promise<string> {
  const data = new TextEncoder().encode(canonical(value));
  const result = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(result)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export async function seal(snapshot: Snapshot): Promise<SealedSnapshot> {
  const digest = await sha256(snapshot);
  return { id: digest, sha256: digest, snapshot };
}
export async function verifySeal(s: SealedSnapshot): Promise<boolean> {
  return s.sha256 === s.id && s.sha256 === (await sha256(s.snapshot));
}
export async function validateSeal(value: unknown): Promise<SealedSnapshot> {
  if (
    !value ||
    typeof value !== "object" ||
    !("snapshot" in value) ||
    !("sha256" in value) ||
    !("id" in value) ||
    typeof value.sha256 !== "string" ||
    typeof value.id !== "string"
  )
    throw new Error("CORRUPTED_SNAPSHOT");
  const s = {
    snapshot: regenerate(value.snapshot),
    sha256: value.sha256,
    id: value.id,
  };
  if (!(await verifySeal(s))) throw new Error("SNAPSHOT_HASH_MISMATCH");
  return s;
}
