export type CredentialProvider = 'massive' | 'coingecko';
type StoragePort = Pick<Storage,'getItem'|'setItem'|'removeItem'>;
// Deliberately separate from EQUINOX_V1 and all backup/snapshot code.
// Plain local browser storage; not a cryptographically secure vault.
const prefix = 'EQUINOX_LOCAL_CREDENTIAL_V1:';
export class CredentialStore {
  constructor(private storage: StoragePort) {}
  read(provider: CredentialProvider): string | null {
    try { return this.storage.getItem(prefix + provider); }
    catch { throw new Error('CREDENTIAL_STORAGE_UNAVAILABLE'); }
  }
  has(provider: CredentialProvider): boolean { return this.read(provider) !== null; }
  save(provider: CredentialProvider, input: string): void {
    const key = input.trim();
    if (!/^[\x21-\x7e]{1,512}$/.test(key)) throw new Error('INVALID_CREDENTIAL');
    try { this.storage.setItem(prefix + provider,key); }
    catch { throw new Error('CREDENTIAL_STORAGE_UNAVAILABLE'); }
  }
  remove(provider: CredentialProvider): void {
    try { this.storage.removeItem(prefix + provider); }
    catch { throw new Error('CREDENTIAL_STORAGE_UNAVAILABLE'); }
  }
}
