// Credential Management API Types
interface PasswordCredentialData {
  id: string;
  password: string;
  name?: string;
  iconURL?: string;
}

interface PasswordCredential extends Credential {
  readonly password: string;
  readonly name: string;
  readonly iconURL: string;
}

declare var PasswordCredential: {
  prototype: PasswordCredential;
  new(data: PasswordCredentialData): PasswordCredential;
  new(form: HTMLFormElement): PasswordCredential;
};

interface Window {
  PasswordCredential: typeof PasswordCredential;
}

interface CredentialContainer {
  store(credential: Credential): Promise<void>;
  get(options?: CredentialRequestOptions): Promise<Credential | null>;
}
