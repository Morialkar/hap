declare global {
  interface Window {
    __APP__?: {
      apiBase: string;
      csrfToken?: string;
      locale: string;
    };
  }
}

export {};
