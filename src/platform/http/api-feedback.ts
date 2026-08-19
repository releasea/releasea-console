export const API_LOAD_FAILED_EVENT = 'releasea:api-load-failed';
export const API_LOAD_RECOVERED_EVENT = 'releasea:api-load-recovered';

export type ApiLoadFeedback = {
  resource: string;
  message?: string;
};
const activeFailures = new Map<string, string>();

const emit = (name: string, detail: ApiLoadFeedback) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ApiLoadFeedback>(name, { detail }));
};

export const reportApiLoadFailure = (resource: string, message?: string) => {
  activeFailures.set(resource, message || 'The platform returned an incomplete response.');
  emit(API_LOAD_FAILED_EVENT, { resource, message });
};

export const reportApiLoadRecovery = (resource: string) => {
  activeFailures.delete(resource);
  emit(API_LOAD_RECOVERED_EVENT, { resource });
};

export const getApiLoadFailures = () => Object.fromEntries(activeFailures);
