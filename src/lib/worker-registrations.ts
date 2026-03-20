import type { Worker, WorkerRegistration } from '@/types/releasea';
import { environmentsShareNamespace } from '@/lib/environments';

export function isWorkerRegistrationForEnvironment(
  registration: Pick<WorkerRegistration, 'environment'> | null | undefined,
  environment: string,
): boolean {
  if (!registration || !environment) return false;
  const registrationEnvironment = registration.environment?.trim();
  if (!registrationEnvironment) return false;
  return environmentsShareNamespace(registrationEnvironment, environment);
}

export function hasRegisteredWorkerForEnvironment(
  environment: string,
  workers: Pick<Worker, 'environment'>[],
  registrations: Pick<WorkerRegistration, 'environment'>[],
): boolean {
  return (
    workers.some((worker) => environmentsShareNamespace(worker.environment?.trim() ?? '', environment))
    || registrations.some((registration) => isWorkerRegistrationForEnvironment(registration, environment))
  );
}
