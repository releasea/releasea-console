import { demoTemplates } from './templates';

const HOUR_MS = 60 * 60 * 1000;
const STORAGE_KEY = 'releasea.demo.overlay';
const SESSION_KEY = 'releasea.demo.session';
const TOKEN = 'demo-session-token-0001';
const CSRF = 'demo-csrf-token-0001';

type Overlay = {
  upserts: Record<string, { collection: string; value: Record<string, unknown>; expiresAt: number }>;
  deletes: Record<string, { collection: string; expiresAt: number }>;
};

const emptyOverlay = (): Overlay => ({ upserts: {}, deletes: {} });

const readOverlay = (): Overlay => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyOverlay();
    const parsed = JSON.parse(raw) as Overlay;
    return {
      upserts: parsed.upserts ?? {},
      deletes: parsed.deletes ?? {},
    };
  } catch {
    return emptyOverlay();
  }
};

const writeOverlay = (overlay: Overlay) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(overlay));
};

const purgeOverlay = (overlay: Overlay) => {
  const now = Date.now();
  for (const [key, entry] of Object.entries(overlay.upserts)) {
    if (entry.expiresAt <= now) delete overlay.upserts[key];
  }
  for (const [key, entry] of Object.entries(overlay.deletes)) {
    if (entry.expiresAt <= now) delete overlay.deletes[key];
  }
  return overlay;
};

const keyOf = (collection: string, id: string) => `${collection}:${id}`;

const nowIso = () => new Date().toISOString();

const idFor = (prefix: string) => `${prefix}-${Math.random().toString(16).slice(2, 10)}`;

const revision = () => {
  const alphabet = 'abcdef0123456789';
  let value = 'g';
  for (let index = 0; index < 7; index += 1) value += alphabet[Math.floor(Math.random() * alphabet.length)];
  return value;
};

const policy = {
  action: 'allow',
  timeoutMs: 15000,
  retries: 1,
  ipPolicy: 'open',
};

const hostFor = (serviceName: string, environment: string) => {
  const slug = environment === 'prod' || environment === 'production' ? 'prod' : environment === 'staging' ? 'staging' : 'dev';
  return `${serviceName}-${slug}.releasea.internal`;
};

const rule = (
  id: string,
  serviceId: string,
  serviceName: string,
  environment: string,
): Record<string, unknown> => ({
  id,
  name: 'rule-default',
  serviceId,
  environment,
  hosts: [hostFor(serviceName, environment)],
  gateways: ['istio-system/releasea-internal-gateway'],
  paths: ['/'],
  methods: ['GET'],
  protocol: 'http',
  port: 8080,
  status: 'published',
  createdAt: '2026-10-28T12:00:00.000Z',
  updatedAt: '2026-10-28T12:00:00.000Z',
  lastPublishedAt: '2026-10-28T12:00:00.000Z',
  policy,
  contractId: id,
  revision: 1,
});

const service = (
  id: string,
  name: string,
  descriptionReady: boolean,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  id,
  name,
  type: 'microservice',
  status: descriptionReady ? 'running' : 'created',
  isActive: descriptionReady,
  autoDeploy: false,
  pauseOnIdle: true,
  pauseIdleTimeoutSeconds: 3600,
  projectId: 'proj-storefront',
  port: 8080,
  healthCheckPath: '/health',
  replicas: 1,
  minReplicas: 1,
  maxReplicas: 3,
  cpu: 250,
  memory: 256,
  createdAt: '2026-10-27T12:00:00.000Z',
  lastDeployAt: descriptionReady ? '2026-10-28T18:00:00.000Z' : undefined,
  environment: {},
  deploymentStrategy: { type: 'rolling' },
  ruleIds: descriptionReady ? [`rule-${id}-dev`, `rule-${id}-api`] : [],
  sourceType: 'git',
  repoUrl: `https://github.com/releasea-demo/${name}`,
  branch: 'main',
  rootDir: '.',
  dockerfilePath: './Dockerfile',
  dockerContext: '.',
  managementMode: 'managed',
  profileId: descriptionReady ? 'rp-medium' : undefined,
  runtime: descriptionReady
    ? { dev: { status: 'healthy', reason: '', updatedAt: '2026-10-28T18:00:00.000Z' } }
    : {},
  ...overrides,
});

const deploy = (
  id: string,
  serviceId: string,
  environment: string,
  rev: string,
): Record<string, unknown> => ({
  id,
  serviceId,
  status: 'completed',
  environment,
  commit: rev,
  image: `releasea/${serviceId}:${rev}`,
  branch: 'main',
  triggeredBy: 'Demo',
  startedAt: '2026-10-28T18:00:00.000Z',
  finishedAt: '2026-10-28T18:02:00.000Z',
  createdAt: '2026-10-28T18:00:00.000Z',
  logs: ['Preparing source', 'Building image', 'Publishing release', 'Validating health', 'New version active'],
  strategyStatus: { type: 'rolling', phase: 'completed', summary: 'New version active', updatedAt: '2026-10-28T18:02:00.000Z' },
});

const DEMO_CLOCK = Date.parse('2026-10-29T11:00:00.000Z');

const hoursBeforeDemo = (hours: number) => new Date(DEMO_CLOCK - hours * 60 * 60 * 1000).toISOString();

const windowBounds = (url: URL, fallbackMs: number) => {
  const to = Date.parse(url.searchParams.get('to') ?? '') || Date.now();
  const from = Date.parse(url.searchParams.get('from') ?? '') || (to - fallbackMs);
  return { from: Math.min(from, to), to: Math.max(from, to) };
};

const demoMetrics = (serviceId: string, url: URL) => {
  const environment = url.searchParams.get('environment') ?? 'dev';
  const namespace = environment === 'staging' ? 'releasea-apps-staging' : 'releasea-apps-development';
  if (serviceId === 'svc-fraud') {
    return {
      serviceId,
      environment,
      namespace,
      timestamps: [],
      cpu: [],
      memory: [],
      latencyP95: [],
      requests: [],
      statusCodes: { '2xx': [], '4xx': [], '5xx': [] },
      diagnostics: {
        prometheusUrl: 'simulated',
        namespace,
        serviceName: serviceId,
        cpuQuerySuccess: true,
        memQuerySuccess: true,
        latencyQuerySuccess: true,
        reqQuerySuccess: true,
      },
    };
  }
  const { from, to } = windowBounds(url, 15 * 60 * 1000);
  const count = 24;
  const step = Math.max(1, Math.floor((to - from) / (count - 1)));
  const timestamps: string[] = [];
  const cpu: number[] = [];
  const memory: number[] = [];
  const latencyP95: number[] = [];
  const requests: number[] = [];
  const ok: number[] = [];
  const clientErrors: number[] = [];
  const serverErrors: number[] = [];
  const shape = serviceId === 'svc-inventory'
    ? { cpu: 86, memory: 91, latency: 280, errorRate: 0.12 }
    : serviceId === 'svc-notifications'
      ? { cpu: 34, memory: 47, latency: 740, errorRate: 0.38 }
      : serviceId === 'svc-pricing'
        ? { cpu: 63, memory: 71, latency: 160, errorRate: 0.07 }
        : { cpu: 22, memory: 38, latency: 48, errorRate: 0.01 };
  for (let index = 0; index < count; index += 1) {
    timestamps.push(new Date(from + step * index).toISOString());
    cpu.push(Math.min(98, Math.round(shape.cpu + Math.sin(index / 3) * 4)));
    memory.push(Math.min(98, Math.round(shape.memory + Math.cos(index / 4) * 3)));
    latencyP95.push(Number((shape.latency + Math.sin(index / 2.4) * (shape.latency * 0.08)).toFixed(1)));
    const requestCount = Math.round(80 + Math.sin(index / 2) * 25);
    requests.push(requestCount);
    const serverErrorCount = Math.round(requestCount * shape.errorRate);
    const clientErrorCount = Math.round(requestCount * 0.02);
    serverErrors.push(serverErrorCount);
    clientErrors.push(clientErrorCount);
    ok.push(Math.max(0, requestCount - serverErrorCount - clientErrorCount));
  }
  return {
    serviceId,
    environment,
    namespace,
    timestamps,
    cpu,
    memory,
    latencyP95,
    requests,
    statusCodes: { '2xx': ok, '4xx': clientErrors, '5xx': serverErrors },
    diagnostics: {
      prometheusUrl: 'simulated',
      namespace: environment === 'staging' ? 'releasea-apps-staging' : 'releasea-apps-development',
      serviceName: serviceId,
      timeRangeStart: timestamps[0],
      timeRangeEnd: timestamps[timestamps.length - 1],
      cpuQuerySuccess: true,
      memQuerySuccess: true,
      latencyQuerySuccess: true,
      reqQuerySuccess: true,
    },
  };
};

const demoLogs = (serviceId: string, url: URL) => {
  const { from, to } = windowBounds(url, 3 * 60 * 60 * 1000);
  const lines: Array<[string, string]> = serviceId === 'svc-inventory'
    ? [
        ['warn', 'readiness probe failed on inventory-dev-7f3a1c2-def34'],
        ['warn', 'only 1 of 2 instances is ready'],
        ['error', 'GET /api/stock 503 910ms'],
        ['warn', 'upstream latency above 250ms for catalog lookup'],
        ['info', 'GET /health 200 8ms'],
        ['error', 'GET /api/stock 503 640ms'],
        ['warn', 'connection pool saturated'],
        ['info', 'GET /health 200 6ms'],
      ]
    : serviceId === 'svc-notifications'
      ? [
          ['error', 'process exited with status 1'],
          ['error', 'missing TEMPLATE_TOKEN'],
          ['fatal', 'crashloop: container restarted 14 times'],
          ['error', 'back-off restarting failed container'],
          ['info', 'starting container'],
          ['fatal', 'panic: template renderer is nil'],
        ]
      : serviceId === 'svc-search'
        ? [
            ['info', 'pulling ghcr.io/releasea-demo/search:deployin'],
            ['info', 'starting new revision'],
            ['info', 'waiting for readiness'],
            ['info', 'GET /health 200 12ms'],
          ]
        : [
            ['info', 'listening on :8080'],
            ['info', 'GET /health 200 3ms'],
            ['info', 'GET /api/items 200 18ms'],
            ['info', 'request completed trace=4c91a2'],
            ['info', 'GET /health 200 4ms'],
            ['warn', 'upstream latency above 80ms for catalog lookup'],
            ['info', 'POST /api/checkout 201 42ms'],
            ['info', 'GET /health 200 3ms'],
            ['info', 'cache hit for product list'],
            ['info', 'GET /api/items 200 11ms'],
            ['info', 'GET /health 200 2ms'],
            ['info', 'connection reused for upstream payments'],
          ];
  const step = Math.max(1, Math.floor((to - from) / lines.length));
  const pod = url.searchParams.get('pod') ?? '';
  return {
    logs: lines.map(([level, message], index) => ({
      id: `log-${serviceId}-${index}`,
      timestamp: new Date(from + step * (index + 1)).toISOString(),
      level,
      message,
      serviceId,
      metadata: {
        ...(pod ? { pod, replicaName: pod } : {}),
        container: 'app',
        containerName: 'app',
      },
    })),
    diagnostics: {
      lokiUrl: 'simulated',
      namespace: 'releasea-apps-development',
      serviceName: serviceId,
    },
  };
};

const serviceHistory = (serviceId: string, name: string) => {
  const points: Array<[string, number, string]> = [
    ['dev', 4, 'g7f3a1c2'],
    ['dev', 28, 'a91c20e4'],
    ['dev', 76, 'b10d44aa'],
    ['staging', 18, 'c55e10b1'],
    ['staging', 100, 'd2aa7710'],
  ];
  return points.map(([environment, hours, rev]) => {
    const startedAt = hoursBeforeDemo(hours);
    const finishedAt = new Date(Date.parse(startedAt) + 2 * 60 * 1000).toISOString();
    return {
      ...deploy(`deploy-${serviceId}-${environment}-${rev}`, serviceId, environment, rev),
      image: `ghcr.io/releasea-demo/${name}:${rev}`,
      triggeredBy: 'Demo Operator',
      startedAt,
      finishedAt,
      createdAt: startedAt,
      strategyStatus: {
        type: 'rolling',
        phase: 'completed',
        summary: 'New version active',
        updatedAt: finishedAt,
      },
    };
  });
};

const serviceRules = (serviceId: string, name: string) => {
  const api = rule(`rule-${serviceId}-api`, serviceId, name, 'dev');
  api.name = 'rule-api';
  api.paths = ['/api', '/health'];
  api.methods = ['GET', 'POST'];
  const staging = rule(`rule-${serviceId}-staging`, serviceId, name, 'staging');
  staging.revision = 2;
  staging.promotedFromRuleId = `rule-${serviceId}-dev`;
  staging.promotedFromEnvironment = 'dev';
  return [
    rule(`rule-${serviceId}-dev`, serviceId, name, 'dev'),
    api,
    staging,
  ];
};

const ruleRelease = (id: string, ruleId: string, serviceId: string, environment: string, hours: number) => {
  const startedAt = hoursBeforeDemo(hours);
  return {
    id,
    ruleId,
    serviceId,
    status: 'completed',
    environment,
    triggeredBy: 'Demo Operator',
    startedAt,
    finishedAt: new Date(Date.parse(startedAt) + 30 * 1000).toISOString(),
    createdAt: startedAt,
    logs: ['Validating rule', 'Publishing edge', 'Rule is live'],
  };
};

const activityDeploy = (
  serviceId: string,
  name: string,
  status: string,
  hours: number,
  summary: string,
) => {
  const startedAt = hoursBeforeDemo(hours);
  const finished = status === 'failed';
  const finishedAt = new Date(Date.parse(startedAt) + 90 * 1000).toISOString();
  return {
    ...deploy(`deploy-${serviceId}-dev-${status}`, serviceId, 'dev', status.slice(0, 7)),
    image: `ghcr.io/releasea-demo/${name}:${status}`,
    triggeredBy: 'Demo Operator',
    status,
    startedAt,
    createdAt: startedAt,
    finishedAt: finished ? finishedAt : undefined,
    logs: finished
      ? ['Preparing source', 'Publishing release', 'Health check failed', 'Revision was not promoted']
      : ['Preparing source', 'Publishing release', summary],
    strategyStatus: {
      type: 'rolling',
      phase: status,
      summary,
      updatedAt: finished ? finishedAt : startedAt,
    },
  };
};

const seed = () => ({
  teams: [{
    id: 'team-1',
    name: 'Storefront',
    slug: 'storefront',
    members: [{ id: 'usr-demo', name: 'Demo Operator', email: 'demo@releasea.io', role: 'admin' }],
    createdAt: '2026-10-20T12:00:00.000Z',
  }],
  projects: [{
    id: 'proj-storefront',
    name: 'Storefront',
    slug: 'storefront',
    description: 'Demo project for the service surface.',
    teamId: 'team-1',
    owner: 'Demo Operator',
    registryCredentialId: 'reg-demo',
    defaultEnvironment: 'dev',
    dataClassification: 'internal',
    serviceTier: 'standard',
    createdAt: '2026-10-20T12:00:00.000Z',
    updatedAt: '2026-10-28T18:00:00.000Z',
    services: [],
  }],
  services: [
    service('svc-checkout', 'checkout', true),
    service('svc-payments', 'payments', true),
    service('svc-catalog', 'catalog', true),
    service('svc-recommendations', 'recommendations', true, {
      deploymentStrategy: { type: 'canary', canaryPercent: 20 },
      lastDeployAt: hoursBeforeDemo(0.25),
      runtime: {
        dev: {
          status: 'healthy',
          reason: 'Canary is serving 20% of traffic.',
          updatedAt: hoursBeforeDemo(0.25),
        },
      },
    }),
    service('svc-inventory', 'inventory', true, {
      replicas: 2,
      runtime: {
        dev: {
          status: 'degraded',
          reason: '1 of 2 instances is ready. The second pod is failing its readiness probe.',
          updatedAt: hoursBeforeDemo(0.5),
        },
      },
    }),
    service('svc-notifications', 'notifications', true, {
      status: 'error',
      runtime: {
        dev: {
          status: 'crashloop',
          reason: 'Container exits on startup because TEMPLATE_TOKEN is missing.',
          updatedAt: hoursBeforeDemo(0.3),
        },
      },
    }),
    service('svc-search', 'search', true, {
      runtime: {
        dev: {
          status: 'pending',
          reason: 'A new revision is starting.',
          updatedAt: hoursBeforeDemo(0.2),
        },
      },
    }),
    service('svc-pricing', 'pricing', true, {
      runtime: {
        dev: {
          status: 'degraded',
          reason: 'Traffic is moving back to the previous revision after a failed health check.',
          updatedAt: hoursBeforeDemo(0.15),
        },
      },
    }),
    service('svc-billing', 'billing', true, {
      status: 'stopped',
      isActive: false,
      lastDeployAt: hoursBeforeDemo(30),
      runtime: {
        dev: {
          status: 'idle',
          reason: 'Paused after the idle window.',
          updatedAt: hoursBeforeDemo(6),
        },
      },
    }),
    service('svc-reviews', 'reviews', true, {
      status: 'pending',
      runtime: {
        dev: {
          status: 'pending',
          reason: 'Waiting for the new instances to become ready.',
          updatedAt: hoursBeforeDemo(0.4),
        },
      },
    }),
    service('svc-storefront', 'storefront', true),
    service('svc-fraud', 'fraud', false),
  ],
  rules: [
    ...serviceRules('svc-checkout', 'checkout'),
    ...serviceRules('svc-payments', 'payments'),
    ...serviceRules('svc-catalog', 'catalog'),
    ...serviceRules('svc-recommendations', 'recommendations'),
    ...serviceRules('svc-inventory', 'inventory'),
    ...serviceRules('svc-notifications', 'notifications'),
    ...serviceRules('svc-search', 'search'),
    ...serviceRules('svc-pricing', 'pricing'),
    ...serviceRules('svc-billing', 'billing'),
    ...serviceRules('svc-reviews', 'reviews'),
    ...serviceRules('svc-storefront', 'storefront'),
  ],
  deploys: [
    ...serviceHistory('svc-checkout', 'checkout'),
    ...serviceHistory('svc-payments', 'payments'),
    ...serviceHistory('svc-catalog', 'catalog'),
    ...serviceHistory('svc-recommendations', 'recommendations'),
    {
      ...deploy('deploy-svc-recommendations-dev-canary', 'svc-recommendations', 'dev', 'f20c11aa'),
      image: 'ghcr.io/releasea-demo/recommendations:f20c11aa',
      triggeredBy: 'Demo Operator',
      startedAt: hoursBeforeDemo(0.25),
      finishedAt: new Date(Date.parse(hoursBeforeDemo(0.25)) + 2 * 60 * 1000).toISOString(),
      createdAt: hoursBeforeDemo(0.25),
      strategyStatus: {
        type: 'canary',
        phase: 'completed',
        summary: '20% of traffic is on the new version.',
        updatedAt: new Date(Date.parse(hoursBeforeDemo(0.25)) + 2 * 60 * 1000).toISOString(),
      },
    },
    ...serviceHistory('svc-inventory', 'inventory'),
    ...serviceHistory('svc-notifications', 'notifications'),
    activityDeploy('svc-notifications', 'notifications', 'failed', 1, 'Health check failed'),
    ...serviceHistory('svc-search', 'search'),
    activityDeploy('svc-search', 'search', 'deploying', 0.2, 'Publishing the new revision'),
    ...serviceHistory('svc-pricing', 'pricing'),
    activityDeploy('svc-pricing', 'pricing', 'rolling-back', 0.15, 'Returning traffic to the previous revision'),
    {
      ...deploy('deploy-svc-billing-dev-old', 'svc-billing', 'dev', 'e11aa220'),
      image: 'ghcr.io/releasea-demo/billing:e11aa220',
      triggeredBy: 'Demo Operator',
      startedAt: hoursBeforeDemo(30),
      finishedAt: new Date(Date.parse(hoursBeforeDemo(30)) + 2 * 60 * 1000).toISOString(),
      createdAt: hoursBeforeDemo(30),
    },
    ...serviceHistory('svc-reviews', 'reviews'),
    activityDeploy('svc-reviews', 'reviews', 'validating', 0.4, 'Waiting for readiness'),
    ...serviceHistory('svc-storefront', 'storefront'),
  ],
  ruleDeploys: [
    ruleRelease('rd-checkout-dev', 'rule-svc-checkout-dev', 'svc-checkout', 'dev', 4),
    ruleRelease('rd-checkout-api', 'rule-svc-checkout-api', 'svc-checkout', 'dev', 26),
    ruleRelease('rd-checkout-staging', 'rule-svc-checkout-staging', 'svc-checkout', 'staging', 18),
    ruleRelease('rd-payments-dev', 'rule-svc-payments-dev', 'svc-payments', 'dev', 4),
    ruleRelease('rd-payments-api', 'rule-svc-payments-api', 'svc-payments', 'dev', 30),
    ruleRelease('rd-catalog-dev', 'rule-svc-catalog-dev', 'svc-catalog', 'dev', 5),
    ruleRelease('rd-catalog-api', 'rule-svc-catalog-api', 'svc-catalog', 'dev', 40),
  ],
  workers: [
    {
      id: 'worker-dev',
      name: 'development',
      status: 'online',
      environment: 'dev',
      tags: ['dev'],
      cluster: 'releasea',
      namespacePrefix: 'releasea-apps',
      namespace: 'releasea-apps-development',
      version: 'demo',
      lastHeartbeat: nowIso(),
      tasksCompleted: 12,
      registeredAt: '2026-10-20T12:00:00.000Z',
      desiredAgents: 1,
      onlineAgents: 1,
      credentialId: 'cred-worker-dev',
    },
    {
      id: 'worker-staging',
      name: 'staging',
      status: 'online',
      environment: 'staging',
      tags: ['staging'],
      cluster: 'releasea',
      namespacePrefix: 'releasea-apps',
      namespace: 'releasea-apps-staging',
      version: 'demo',
      lastHeartbeat: nowIso(),
      tasksCompleted: 4,
      registeredAt: '2026-10-20T12:00:00.000Z',
      desiredAgents: 1,
      onlineAgents: 1,
      credentialId: 'cred-worker-staging',
    },
  ],
  environments: [
    { id: 'dev', name: 'Development', description: 'Day-to-day', namespace: 'releasea-apps-development' },
    { id: 'staging', name: 'Staging', description: 'Homologation', namespace: 'releasea-apps-staging' },
    { id: 'prod', name: 'Production', description: 'Live traffic', namespace: 'releasea-apps-production' },
  ],
  'runtime-profiles': [
    { id: 'rp-small', name: 'small', description: 'Lightweight services and sidecars', cpu: '250m', cpuLimit: '500m', memory: '256Mi', memoryLimit: '512Mi', createdAt: '2026-10-20T12:00:00.000Z', updatedAt: '2026-10-20T12:00:00.000Z' },
    { id: 'rp-medium', name: 'medium', description: 'General-purpose APIs and microservices', cpu: '500m', cpuLimit: '1000m', memory: '512Mi', memoryLimit: '1024Mi', createdAt: '2026-10-20T12:00:00.000Z', updatedAt: '2026-10-20T12:00:00.000Z' },
    { id: 'rp-large', name: 'large', description: 'Workers and throughput-oriented services', cpu: '1000m', cpuLimit: '2000m', memory: '1024Mi', memoryLimit: '2048Mi', createdAt: '2026-10-20T12:00:00.000Z', updatedAt: '2026-10-20T12:00:00.000Z' },
  ],
  registryCredentials: [{
    id: 'reg-demo',
    name: 'Releasea registry',
    provider: 'ghcr',
    registryUrl: 'ghcr.io/releasea-demo',
    username: 'releasea-demo',
    scope: 'platform',
    createdAt: '2026-10-20T12:00:00.000Z',
    updatedAt: '2026-10-20T12:00:00.000Z',
    notes: 'Simulated registry credential. Images are not pushed.',
  }],
});

type Store = ReturnType<typeof seed>;
type Collection = keyof Store;

const materialize = (): Store => {
  const overlay = purgeOverlay(readOverlay());
  writeOverlay(overlay);
  const state = seed();
  for (const [key, entry] of Object.entries(overlay.deletes)) {
    const collection = entry.collection as Collection;
    const id = key.slice(collection.length + 1);
    const list = state[collection] as Record<string, unknown>[];
    state[collection] = list.filter((item) => item.id !== id) as never;
  }
  for (const [key, entry] of Object.entries(overlay.upserts)) {
    const collection = entry.collection as Collection;
    const id = key.slice(collection.length + 1);
    const list = state[collection] as Record<string, unknown>[];
    const index = list.findIndex((item) => item.id === id);
    if (index >= 0) list[index] = entry.value;
    else list.unshift(entry.value);
  }
  const services = state.services as Record<string, unknown>[];
  state.projects = state.projects.map((project) => ({
    ...project,
    services: services.filter((item) => item.projectId === project.id),
  }));
  return state;
};

const remember = (collection: Collection, value: Record<string, unknown>) => {
  const overlay = purgeOverlay(readOverlay());
  const id = String(value.id);
  overlay.upserts[keyOf(collection, id)] = { collection, value, expiresAt: Date.now() + HOUR_MS };
  delete overlay.deletes[keyOf(collection, id)];
  writeOverlay(overlay);
};

const forget = (collection: Collection, id: string) => {
  const overlay = purgeOverlay(readOverlay());
  overlay.deletes[keyOf(collection, id)] = { collection, expiresAt: Date.now() + HOUR_MS };
  delete overlay.upserts[keyOf(collection, id)];
  writeOverlay(overlay);
};

const demoUser = (email = 'demo@releasea.io') => ({
  id: 'usr-demo',
  name: 'Demo Operator',
  email,
  role: 'admin',
  teamId: 'team-1',
  teamName: 'Storefront',
});

const readSession = () => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) as ReturnType<typeof demoUser> : null;
  } catch {
    return null;
  }
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

type DemoProvider = {
  id: string;
  label: string;
  description?: string;
  authModes?: string[];
  capabilities?: string[];
  scopeSupport?: string[];
  configFields?: string[];
  implementation?: string;
};

type DemoCategory = {
  kind: string;
  label: string;
  description: string;
  defaultProvider?: string;
  providers: DemoProvider[];
};

const demoCatalog: Record<'scm' | 'registry' | 'secrets' | 'identity' | 'notifications', DemoCategory> & { version: string } = {
  version: '1',
  scm: {
    kind: 'scm',
    label: 'SCM',
    description: 'Source control providers used for repository access and template operations.',
    defaultProvider: 'github',
    providers: [
      { id: 'github', label: 'GitHub', description: 'Built-in GitHub support used by templates, commit lookup and repository cloning.', authModes: ['token', 'ssh'], capabilities: ['repo-clone', 'template-repos', 'commit-history', 'pull-requests'], scopeSupport: ['platform', 'project', 'service'] },
      { id: 'gitlab', label: 'GitLab', description: 'Credential option for repository cloning in worker build flows.', authModes: ['token', 'ssh'], capabilities: ['repo-clone'], scopeSupport: ['platform', 'project', 'service'] },
      { id: 'bitbucket', label: 'Bitbucket', description: 'Credential option for repository cloning in worker build flows.', authModes: ['token', 'ssh'], capabilities: ['repo-clone'], scopeSupport: ['platform', 'project', 'service'] },
    ],
  },
  registry: {
    kind: 'registry',
    label: 'Registry',
    description: 'Container registries available to build and deploy pipelines.',
    defaultProvider: 'docker',
    providers: [
      { id: 'docker', label: 'Docker Registry', description: 'Generic OCI registry using username and password authentication.', authModes: ['basic'], capabilities: ['image-push', 'image-pull'], scopeSupport: ['platform', 'project', 'service'] },
      { id: 'ghcr', label: 'GitHub Container Registry', description: 'OCI registry hosted by GitHub with standard basic credentials.', authModes: ['basic'], capabilities: ['image-push', 'image-pull'], scopeSupport: ['platform', 'project', 'service'] },
      { id: 'ecr', label: 'AWS ECR', description: 'AWS Elastic Container Registry using generated username and password credentials.', authModes: ['basic'], capabilities: ['image-push', 'image-pull'], scopeSupport: ['platform', 'project', 'service'] },
      { id: 'gcr', label: 'Google Container Registry', description: 'Google-hosted registry using standard username and password credentials.', authModes: ['basic'], capabilities: ['image-push', 'image-pull'], scopeSupport: ['platform', 'project', 'service'] },
      { id: 'acr', label: 'Azure Container Registry', description: 'Azure-hosted registry using standard username and password credentials.', authModes: ['basic'], capabilities: ['image-push', 'image-pull'], scopeSupport: ['platform', 'project', 'service'] },
    ],
  },
  secrets: {
    kind: 'secrets',
    label: 'Secrets',
    description: 'Secrets managers available for resolving secret references during deploys.',
    defaultProvider: 'vault',
    providers: [
      { id: 'vault', label: 'Vault', description: 'HashiCorp Vault backed secret resolution.', capabilities: ['secret-read', 'secret-reference'], configFields: ['address', 'token'] },
      { id: 'aws', label: 'AWS Secrets Manager', description: 'AWS-hosted secret resolution using access key credentials.', capabilities: ['secret-read', 'secret-reference'], configFields: ['accessKeyId', 'secretAccessKey', 'region'] },
      { id: 'gcp', label: 'GCP Secret Manager', description: 'Google Cloud secret resolution using service account credentials.', capabilities: ['secret-read', 'secret-reference'], configFields: ['projectId', 'serviceAccountJson'] },
    ],
  },
  identity: {
    kind: 'identity',
    label: 'Identity',
    description: 'Identity protocols supported by Releasea. Providers such as Keycloak, Okta, Azure AD, Google and Microsoft typically connect through OIDC.',
    providers: [
      { id: 'saml', label: 'SAML', description: 'SAML 2.0 single sign-on with group mapping and audit events.', capabilities: ['single-sign-on', 'group-mapping', 'session-revocation'], implementation: 'saml' },
      { id: 'oidc', label: 'OIDC', description: 'Generic OpenID Connect support for providers such as Keycloak, Okta, Azure AD and Google.', capabilities: ['single-sign-on', 'group-mapping', 'session-revocation'], implementation: 'oidc' },
    ],
  },
  notifications: {
    kind: 'notifications',
    label: 'Notifications',
    description: 'Built-in platform event notifications currently configurable in platform settings.',
    defaultProvider: 'platform-events',
    providers: [
      { id: 'platform-events', label: 'Platform Events', description: 'Built-in notification toggles for deploy, service, worker and approval events.', capabilities: ['deploy-success', 'deploy-failed', 'service-down', 'worker-offline', 'approval-required', 'approval-completed'] },
    ],
  },
};

const configuredProviders = new Set(['github', 'ghcr', 'vault', 'oidc', 'platform-events']);

const providerCategory = (kind: keyof typeof demoCatalog) => {
  if (kind === 'version') return { kind, providers: [] };
  const category = demoCatalog[kind];
  return {
    kind,
    providers: category.providers.map((provider) => {
      const configured = configuredProviders.has(provider.id);
      return {
        id: provider.id,
        label: provider.label,
        state: configured ? 'configured' : 'not-configured',
        message: configured
          ? 'Simulated for this demo. No external account is contacted.'
          : 'Available in this demo. No credential is stored.',
        configured,
        default: provider.id === category.defaultProvider,
        resourceCount: configured ? 1 : 0,
        implementation: provider.implementation,
      };
    }),
  };
};

const healthCategory = (kind: keyof typeof demoCatalog) => {
  if (kind === 'version') return { kind, healthy: 0, unhealthy: 0, checks: [] };
  const category = demoCatalog[kind];
  const checks = category.providers.map((provider) => {
    const configured = configuredProviders.has(provider.id);
    return {
      providerId: provider.id,
      providerLabel: provider.label,
      state: configured ? 'healthy' : 'disabled',
      message: configured
        ? 'Simulated. Nothing is created outside this browser.'
        : 'No credential is stored for this provider.',
      default: provider.id === category.defaultProvider,
    };
  });
  return {
    kind,
    healthy: checks.filter((check) => check.state === 'healthy').length,
    unhealthy: 0,
    disabled: checks.filter((check) => check.state === 'disabled').length,
    checks,
  };
};

const pool = (environment: string, namespace: string): Record<string, unknown> => ({
  id: `pool-${environment}`,
  status: 'online',
  capacityState: 'ready',
  environment,
  cluster: 'releasea',
  namespacePrefix: 'releasea-apps',
  tags: [environment],
  namespaces: [namespace],
  workerCount: 1,
  onlineWorkers: 1,
  busyWorkers: 0,
  offlineWorkers: 0,
  pendingWorkers: 0,
  registrationCount: 1,
  activeRegistrations: 1,
  pendingRegistrations: 0,
  inactiveRegistrations: 0,
  desiredAgents: 1,
  onlineAgents: 1,
  availableAgents: 1,
  capacityScore: 100,
  saturationPercent: 0,
  saturationState: 'idle',
  lastHeartbeat: nowIso(),
});

const ENTRA_ISSUER = 'https://login.microsoftonline.com/00000000-0000-4000-8000-000000000001/v2.0';

const demoActor = (id: string, name: string, email: string) => ({ id, name, email });

const demoIdpConfig = () => ({
  saml: {
    enabled: false,
    entityId: '',
    ssoUrl: '',
    sloUrl: '',
    certificate: '',
    signatureAlgorithm: 'sha256',
    digestAlgorithm: 'sha256',
    nameIdFormat: 'emailAddress',
    assertionEncrypted: false,
    wantAuthnRequestsSigned: true,
    allowUnsolicitedResponse: false,
    attributeMapping: { email: 'email', firstName: 'first_name', lastName: 'last_name', groups: 'groups' },
  },
  oidc: {
    enabled: true,
    issuer: ENTRA_ISSUER,
    clientId: 'releasea-demo',
    clientSecret: 'demo-not-a-secret',
    scopes: ['openid', 'profile', 'email', 'groups'],
    responseType: 'code',
    tokenEndpointAuth: 'client_secret_post',
    userinfoEndpoint: 'https://graph.microsoft.com/oidc/userinfo',
    jwksUri: 'https://login.microsoftonline.com/00000000-0000-4000-8000-000000000001/discovery/v2.0/keys',
    attributeMapping: { email: 'email', firstName: 'given_name', lastName: 'family_name', groups: 'groups' },
  },
  provisioning: {
    autoProvision: true,
    autoDeprovision: false,
    syncInterval: 60,
    defaultRole: 'developer',
    createTeamsFromGroups: true,
  },
  session: { maxAge: 86400, idleTimeout: 3600, singleLogout: true, forceReauth: false },
  security: { requireMfa: true, allowedDomains: ['releasea.io'], blockedDomains: [], ipRestrictions: [] },
});

const demoIdpConnections = () => [{
  id: 'idp-entra',
  name: 'Microsoft Entra ID',
  protocol: 'oidc',
  status: 'active',
  issuer: ENTRA_ISSUER,
  clientId: 'releasea-demo',
  createdAt: '2026-10-20T12:00:00.000Z',
  lastSyncAt: hoursBeforeDemo(2),
  usersCount: 3,
  groupsCount: 2,
}];

const demoIdpMappings = () => [
  {
    id: 'map-storefront',
    externalGroup: 'releasea-storefront',
    internalTeamId: 'team-1',
    internalTeamName: 'Storefront',
    role: 'developer',
    syncEnabled: true,
    lastSyncAt: hoursBeforeDemo(2),
    memberCount: 3,
  },
  {
    id: 'map-admins',
    externalGroup: 'releasea-admins',
    internalTeamId: 'team-1',
    internalTeamName: 'Storefront',
    role: 'admin',
    syncEnabled: true,
    lastSyncAt: hoursBeforeDemo(2),
    memberCount: 1,
  },
];

const demoIdpSessions = () => [{
  id: 'idp-session-demo',
  userId: 'usr-demo',
  userName: 'Demo Operator',
  userEmail: 'demo@releasea.io',
  provider: 'oidc',
  providerName: 'Microsoft Entra ID',
  createdAt: hoursBeforeDemo(5),
  expiresAt: new Date(DEMO_CLOCK + 8 * 60 * 60 * 1000).toISOString(),
  lastActivity: hoursBeforeDemo(1),
  ipAddress: '203.0.113.10',
  userAgent: 'Demo browser',
  active: true,
}];

const demoIdpAudit = () => [
  {
    id: 'idp-audit-1',
    timestamp: hoursBeforeDemo(1),
    action: 'login_success',
    userId: 'usr-demo',
    userName: 'Demo Operator',
    provider: 'oidc',
    ipAddress: '203.0.113.10',
    details: 'Signed in through Microsoft Entra ID.',
  },
  {
    id: 'idp-audit-2',
    timestamp: hoursBeforeDemo(2),
    action: 'group_sync',
    userName: 'Microsoft Entra ID',
    provider: 'oidc',
    details: 'Synced releasea-storefront and releasea-admins into Storefront.',
  },
  {
    id: 'idp-audit-3',
    timestamp: hoursBeforeDemo(6),
    action: 'user_provision',
    userId: 'usr-demo',
    userName: 'Demo Operator',
    provider: 'oidc',
    details: 'Provisioned Demo Operator from Entra group releasea-admins.',
  },
];

const deployPolicyRule = (environment: string, strict: boolean) => ({
  environment,
  allowAutoDeploy: !strict,
  requireExplicitVersion: strict,
  blockExternalExposure: strict,
  allowedProfileIds: [],
  allowedScmProviders: ['github'],
  allowedRegistryProviders: ['ghcr'],
  allowedSecretProviders: [],
  allowedSourceTypes: ['git'],
  allowedRegistries: ['ghcr.io/releasea-demo'],
  allowedStrategies: strict && environment === 'prod' ? ['canary', 'blue-green'] : ['rolling', 'canary', 'blue-green'],
  maxReplicas: environment === 'prod' ? 5 : 3,
});

const demoGovernanceSettings = () => ({
  deployApproval: { enabled: true, environments: ['staging', 'prod'], minApprovers: 1 },
  deployPolicy: {
    enabled: true,
    dryRun: false,
    rules: [
      deployPolicyRule('dev', false),
      deployPolicyRule('staging', true),
      deployPolicyRule('prod', true),
    ],
  },
  rulePublishApproval: { enabled: true, externalOnly: true, minApprovers: 1 },
  auditRetentionDays: 90,
});

const demoApprovals = () => [
  {
    id: 'apr-checkout-staging',
    type: 'deploy',
    status: 'pending',
    resourceId: 'svc-checkout',
    resourceName: 'checkout',
    environment: 'staging',
    requestedBy: demoActor('usr-maya', 'Maya Chen', 'maya@releasea.io'),
    requestedAt: hoursBeforeDemo(3),
    metadata: { version: 'g7f3a1c2', branch: 'main', commit: 'g7f3a1c2' },
  },
  {
    id: 'apr-payments-publish',
    type: 'rule-publish',
    status: 'pending',
    resourceId: 'rule-svc-payments-api',
    resourceName: 'payments / rule-api',
    environment: 'prod',
    requestedBy: demoActor('usr-leo', 'Leo Martins', 'leo@releasea.io'),
    requestedAt: hoursBeforeDemo(5),
    metadata: { hosts: ['payments-prod.releasea.external'], gateways: ['istio-system/releasea-external-gateway'] },
  },
  {
    id: 'apr-catalog-dev',
    type: 'deploy',
    status: 'approved',
    resourceId: 'svc-catalog',
    resourceName: 'catalog',
    environment: 'dev',
    requestedBy: demoActor('usr-demo', 'Demo Operator', 'demo@releasea.io'),
    requestedAt: hoursBeforeDemo(20),
    reviewedBy: demoActor('usr-maya', 'Maya Chen', 'maya@releasea.io'),
    reviewedAt: hoursBeforeDemo(18),
    reviewComment: 'Development deploy looks healthy.',
    metadata: { version: 'b10d44aa', branch: 'main' },
  },
];

const demoAuditLogs = () => [
  {
    id: 'audit-1',
    action: 'approval.requested',
    resourceType: 'service',
    resourceId: 'svc-checkout',
    resourceName: 'checkout',
    performedBy: demoActor('usr-maya', 'Maya Chen', 'maya@releasea.io'),
    performedAt: hoursBeforeDemo(3),
    details: { environment: 'staging', version: 'g7f3a1c2', message: 'Staging deploy is waiting for approval.' },
    ipAddress: '203.0.113.24',
  },
  {
    id: 'audit-2',
    action: 'policy.evaluated',
    resourceType: 'service',
    resourceId: 'svc-payments',
    resourceName: 'payments',
    performedBy: demoActor('usr-leo', 'Leo Martins', 'leo@releasea.io'),
    performedAt: hoursBeforeDemo(5),
    details: { environment: 'prod', message: 'External rule publication requires one approver.' },
    ipAddress: '203.0.113.31',
  },
  {
    id: 'audit-3',
    action: 'deploy.completed',
    resourceType: 'service',
    resourceId: 'svc-checkout',
    resourceName: 'checkout',
    performedBy: demoActor('usr-demo', 'Demo Operator', 'demo@releasea.io'),
    performedAt: hoursBeforeDemo(4),
    details: { environment: 'dev', version: 'g7f3a1c2', message: 'Development deploy completed.' },
    ipAddress: '203.0.113.10',
  },
  {
    id: 'audit-4',
    action: 'rule.published',
    resourceType: 'rule',
    resourceId: 'rule-svc-catalog-dev',
    resourceName: 'catalog / rule-default',
    performedBy: demoActor('usr-demo', 'Demo Operator', 'demo@releasea.io'),
    performedAt: hoursBeforeDemo(8),
    details: { environment: 'dev', message: 'Internal rule published.' },
    ipAddress: '203.0.113.10',
  },
  {
    id: 'audit-5',
    action: 'approval.approved',
    resourceType: 'service',
    resourceId: 'svc-catalog',
    resourceName: 'catalog',
    performedBy: demoActor('usr-maya', 'Maya Chen', 'maya@releasea.io'),
    performedAt: hoursBeforeDemo(18),
    details: { environment: 'dev', message: 'Development deploy approved.' },
    ipAddress: '203.0.113.24',
  },
];

const demoPlatformSettings = () => ({
  organization: { name: 'Releasea', slug: 'releasea', apiUrl: window.location.origin },
  database: { mongoUri: '', rabbitUrl: '' },
  identity: {
    saml: { enabled: false, entityId: '', ssoUrl: '', certificate: '' },
    keycloak: { enabled: false, url: '', realm: '', clientId: '', clientSecret: '' },
  },
  notifications: {
    deploySuccess: true,
    deployFailed: true,
    serviceDown: true,
    workerOffline: true,
    highCpu: false,
    approvalRequired: true,
    approvalCompleted: true,
  },
  security: { require2fa: false, ipAllowlist: false, auditLogs: true },
  resourceLimits: {
    maxServicesPerProject: 50,
    maxReplicasPerService: 10,
    maxCpuPerReplica: '2000m',
    maxMemoryPerReplica: '4Gi',
    defaultReplicas: 1,
    defaultCpu: '250m',
    defaultMemory: '512Mi',
  },
  integrations: [],
  secrets: {
    defaultProviderId: 'secret-vault',
    providers: [{
      id: 'secret-vault',
      name: 'Releasea Vault',
      type: 'vault',
      status: 'connected',
      config: { address: 'https://vault.demo.releasea.internal' },
      notes: 'Simulated Vault. Secrets are not stored.',
      createdAt: '2026-10-20T12:00:00.000Z',
      updatedAt: '2026-10-20T12:00:00.000Z',
    }],
  },
});

const demoAIProviders = () => [{
  id: 'ai-demo',
  name: 'Demo diagnostics',
  type: 'openai-compatible',
  baseUrl: 'https://demo.releasea.internal/v1',
  model: 'demo-diagnostics',
  enabled: true,
  default: true,
  hasApiKey: true,
  allowPrivateNetwork: false,
  externalEgress: false,
  timeoutSeconds: 45,
  maxInputChars: 60000,
  maxOutputTokens: 1800,
  dailyTokenLimit: 0,
  retentionDays: 30,
  capabilities: ['health-summary', 'failed-deploy'],
  health: {
    state: 'healthy',
    message: 'Simulated. No model provider was contacted.',
    checkedAt: hoursBeforeDemo(1),
  },
  createdAt: '2026-10-20T12:00:00.000Z',
  updatedAt: hoursBeforeDemo(1),
}];

const demoGovernanceExceptions = () => [{
  id: 'gexc-catalog-staging',
  policy: 'deploy-policy',
  serviceId: 'svc-catalog',
  serviceName: 'catalog',
  environment: 'staging',
  codes: ['external-exposure'],
  reason: 'Temporary window while the catalog edge cutover is reviewed.',
  expiresAt: new Date(DEMO_CLOCK + 48 * 60 * 60 * 1000).toISOString(),
  status: 'active',
  createdAt: hoursBeforeDemo(12),
  createdBy: demoActor('usr-demo', 'Demo Operator', 'demo@releasea.io'),
}];

const handle = async (url: URL, init?: RequestInit): Promise<Response> => {
  const method = (init?.method ?? 'GET').toUpperCase();
  const path = url.pathname.replace(/^\/api\/v1/, '') || '/';
  const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
  const state = materialize();

  if (path === '/auth/csrf' && method === 'GET') return json({ csrfToken: CSRF });
  if (path === '/auth/sso/config' && method === 'GET') return json({ enabled: false });
  if (path === '/auth/refresh' && method === 'POST') {
    const user = readSession();
    if (!user) return json({ message: 'No demo session' }, 401);
    return json({ token: TOKEN, user });
  }
  if (path === '/auth/login' && method === 'POST') {
    const email = typeof body.email === 'string' && body.email.includes('@') ? body.email : 'demo@releasea.io';
    const user = demoUser(email);
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    return json({ token: TOKEN, user });
  }
  if (path === '/auth/logout' && method === 'POST') {
    localStorage.removeItem(SESSION_KEY);
    return json({ status: 'ok' });
  }
  if (path === '/auth/signup' && method === 'POST') {
    const email = typeof body.email === 'string' ? body.email : 'demo@releasea.io';
    const user = { ...demoUser(email), name: typeof body.name === 'string' ? body.name : 'Demo Operator' };
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    return json({ token: TOKEN, user });
  }

  if (path === '/settings/providers/status') {
    return json({
      version: 'demo',
      scm: providerCategory('scm'),
      registry: providerCategory('registry'),
      secrets: providerCategory('secrets'),
      identity: providerCategory('identity'),
      notifications: providerCategory('notifications'),
    });
  }
  if (path === '/settings/providers/health' || path === '/settings/providers/health/run') {
    return json({
      version: 'demo',
      scm: healthCategory('scm'),
      registry: healthCategory('registry'),
      secrets: healthCategory('secrets'),
      identity: healthCategory('identity'),
      notifications: healthCategory('notifications'),
    });
  }
  if (path === '/settings/providers/catalog') return json(demoCatalog);
  if (path === '/observability/health') {
    return json({
      status: 'healthy',
      prometheus: { healthy: true, url: 'simulated' },
      loki: { healthy: true, url: 'simulated' },
    });
  }
  if (path === '/observability/control-plane') {
    return json({
      version: 'demo',
      queue: {
        queueName: 'releasea.worker',
        deadLetterEnabled: false,
        queuedOperations: 0,
        dispatchingOperations: 0,
        dispatchFailedOperations: 0,
        staleQueuedOperations: 0,
        recentDispatchFailures: 0,
        status: 'healthy',
        summary: 'Simulated queue is idle.',
      },
    });
  }
  if (path === '/profile' && method === 'GET') {
    const user = readSession() ?? demoUser();
    return json({ ...user, twoFactorEnabled: false, connectedProviders: [], sessions: [] });
  }
  if (path === '/settings/platform' && method === 'GET') return json(demoPlatformSettings());
  if (path === '/settings/platform' && (method === 'PUT' || method === 'PATCH')) {
    return json({ ...demoPlatformSettings(), ...body });
  }
  if (path === '/workers/pools' && method === 'GET') {
    return json([
      pool('dev', 'releasea-apps-development'),
      pool('staging', 'releasea-apps-staging'),
    ]);
  }
  if (path === '/workers/registrations' && method === 'GET') return json([]);
  if (path === '/workers/discovered-workloads' && method === 'GET') return json([]);
  if (path === '/workers/bootstrap-profile' && method === 'GET') return json({ commands: [], notes: 'Simulated worker profile.' });
  if (path === '/credentials/scm' && method === 'GET') {
    return json([{
      id: 'scm-demo',
      name: 'Demo GitHub',
      provider: 'github',
      authType: 'token',
      scope: 'platform',
      createdAt: '2026-10-20T12:00:00.000Z',
      notes: 'Simulated credential. It does not call GitHub.',
    }]);
  }
  if (path === '/credentials/registry' && method === 'GET') return json(state.registryCredentials);
  if (path === '/credentials/registry' && method === 'POST') {
    const created = {
      id: idFor('reg'),
      name: typeof body.name === 'string' ? body.name : 'Registry',
      provider: typeof body.provider === 'string' ? body.provider : '',
      registryUrl: typeof body.registryUrl === 'string' ? body.registryUrl : '',
      username: typeof body.username === 'string' ? body.username : '',
      scope: typeof body.scope === 'string' ? body.scope : 'platform',
      projectId: typeof body.projectId === 'string' ? body.projectId : '',
      serviceId: typeof body.serviceId === 'string' ? body.serviceId : '',
      notes: typeof body.notes === 'string' ? body.notes : '',
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    remember('registryCredentials', created);
    return json(created, 201);
  }
  const registryItem = path.match(/^\/credentials\/registry\/([^/]+)$/);
  if (registryItem && method === 'DELETE') {
    forget('registryCredentials', decodeURIComponent(registryItem[1]));
    return json({ status: 'deleted' });
  }
  if (path === '/templates' && method === 'GET') return json(demoTemplates);
  if (path === '/rule-deploys' && method === 'GET') return json(state.ruleDeploys);
  if (path.startsWith('/scm/github/template-repos/availability')) {
    return json({ exists: false, owner: url.searchParams.get('owner') ?? 'releasea-demo', name: url.searchParams.get('name') ?? 'service', fullName: 'releasea-demo/service' });
  }
  if (path === '/scm/github/template-repos' && method === 'POST') {
    const name = typeof body.name === 'string' ? body.name : 'service';
    const owner = typeof body.owner === 'string' ? body.owner : 'releasea-demo';
    const fullName = `${owner}/${name}`;
    const simulated = `https://github.com/${fullName}`;
    return json({
      id: Date.now(),
      full_name: fullName,
      html_url: simulated,
      clone_url: `${simulated}.git`,
      ssh_url: `git@github.com:${fullName}.git`,
      default_branch: 'main',
      private: true,
      owner: { login: owner },
    });
  }
  if (path.startsWith('/scm/commits')) {
    return json([{ sha: revision(), message: 'Simulated commit', author: 'Demo Operator', date: nowIso() }]);
  }

  if (path === '/services/status' && method === 'GET') {
    return json({
      services: state.services,
      deploys: state.deploys,
      version: 'demo',
      cursor: 'demo',
      emittedAt: nowIso(),
    });
  }

  const deployMatch = path.match(/^\/services\/([^/]+)\/deploys$/);
  if (deployMatch && (method === 'POST' || method === 'PUT')) {
    const serviceId = decodeURIComponent(deployMatch[1]);
    const environment = typeof body.environment === 'string' ? body.environment : 'dev';
    const rev = revision();
    const created = deploy(idFor('deploy'), serviceId, environment, rev);
    created.startedAt = nowIso();
    created.finishedAt = nowIso();
    created.logs = ['Preparing source', 'Building image', 'Publishing release', 'Validating health', 'New version active'];
    const current = (state.services as Record<string, unknown>[]).find((item) => item.id === serviceId);
    const strategy = current?.deploymentStrategy as { type?: string; canaryPercent?: number } | undefined;
    if (strategy?.type === 'canary') {
      const percent = Number(strategy.canaryPercent ?? 10);
      created.strategyStatus = {
        type: 'canary',
        phase: 'completed',
        summary: `${percent}% of traffic is on the new version.`,
        updatedAt: nowIso(),
      };
    }
    remember('deploys', created);
    if (current) {
      remember('services', {
        ...current,
        status: 'running',
        isActive: true,
        lastDeployAt: nowIso(),
        runtime: { ...(current.runtime as object), [environment]: { status: 'healthy', reason: '', updatedAt: nowIso() } },
      });
    }
    return json({ id: created.id, status: 'completed', operation: { id: created.id, status: 'succeeded' } });
  }

  const promoteMatch = path.match(/^\/services\/([^/]+)\/(promote-canary|switch-blue-green)$/);
  if (promoteMatch && method === 'POST') {
    const serviceId = decodeURIComponent(promoteMatch[1]);
    const environment = typeof body.environment === 'string' ? body.environment : 'dev';
    if (promoteMatch[2] === 'promote-canary') {
      const latest = (state.deploys as Record<string, unknown>[])
        .filter((item) => item.serviceId === serviceId && item.environment === environment)
        .sort((left, right) => Date.parse(String(right.startedAt ?? right.createdAt ?? 0)) - Date.parse(String(left.startedAt ?? left.createdAt ?? 0)))[0];
      if (latest) {
        remember('deploys', {
          ...latest,
          status: 'completed',
          strategyStatus: {
            type: 'canary',
            phase: 'promoting',
            summary: 'Shifting the remaining traffic onto the new version.',
            details: { step: 'shift' },
            updatedAt: nowIso(),
          },
        });
        window.setTimeout(() => {
          remember('deploys', {
            ...latest,
            status: 'completed',
            strategyStatus: {
              type: 'canary',
              phase: 'promoted',
              summary: 'Promoted to stable',
              updatedAt: nowIso(),
            },
          });
        }, 1200);
      }
    }
    return json({ operation: { id: idFor('op'), status: 'succeeded' } });
  }

  const publishPolicy = path.match(/^\/rules\/([^/]+)\/publish-policy-check/);
  if (publishPolicy && method === 'GET') {
    return json({
      environment: url.searchParams.get('environment') ?? 'dev',
      internal: url.searchParams.get('internal') === 'true',
      external: url.searchParams.get('external') === 'true',
      violations: [],
    });
  }
  const publish = path.match(/^\/rules\/([^/]+)\/publish$/);
  if (publish && method === 'POST') {
    const ruleId = decodeURIComponent(publish[1]);
    const current = (state.rules as Record<string, unknown>[]).find((item) => item.id === ruleId);
    if (!current) return json({ message: 'Rule not found' }, 404);
    const gateways = [
      ...(body.internal ? ['istio-system/releasea-internal-gateway'] : []),
      ...(body.external ? ['istio-system/releasea-external-gateway'] : []),
    ];
    const next = { ...current, status: gateways.length ? 'published' : 'draft', gateways, updatedAt: nowIso(), lastPublishedAt: gateways.length ? nowIso() : current.lastPublishedAt };
    remember('rules', next);
    return json(next);
  }
  const promoteRule = path.match(/^\/rules\/([^/]+)\/promote$/);
  if (promoteRule && method === 'POST') {
    const ruleId = decodeURIComponent(promoteRule[1]);
    const current = (state.rules as Record<string, unknown>[]).find((item) => item.id === ruleId);
    if (!current) return json({ message: 'Rule not found' }, 404);
    const environment = typeof body.environment === 'string' ? body.environment : 'staging';
    const serviceId = String(current.serviceId);
    const source = (state.services as Record<string, unknown>[]).find((item) => item.id === serviceId);
    const name = source ? String(source.name) : 'service';
    const next = {
      ...current,
      id: idFor('rule'),
      environment,
      hosts: [hostFor(name, environment)],
      status: 'draft',
      gateways: [],
      revision: Number(current.revision ?? 1) + 1,
      promotedFromRuleId: current.id,
      promotedFromEnvironment: current.environment,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    remember('rules', next);
    return json({ rule: next, revision: next.revision, republish: false, internal: false, external: false });
  }

  if (path.startsWith('/services/') && path.endsWith('/rules') && method === 'POST') {
    const serviceId = path.split('/')[2];
    const source = (state.services as Record<string, unknown>[]).find((item) => item.id === serviceId);
    const created = {
      ...rule(idFor('rule'), serviceId, source ? String(source.name) : 'service', typeof body.environment === 'string' ? body.environment : 'dev'),
      ...body,
      id: idFor('rule'),
      serviceId,
      status: 'draft',
      gateways: [],
      createdAt: nowIso(),
      updatedAt: nowIso(),
      policy: body.policy ?? policy,
    };
    remember('rules', created);
    return json(created, 201);
  }

  if (path.includes('/deploy-policy-check')) {
    return json({
      environment: url.searchParams.get('environment') ?? 'dev',
      trigger: 'manual',
      sourceType: 'git',
      strategyType: 'rolling',
      replicas: 1,
      explicitVersion: false,
      target: {},
      violations: [],
    });
  }
  if (path.includes('/governance-events')) return json([]);

  const metrics = path.match(/^\/services\/([^/]+)\/metrics/);
  if (metrics) return json(demoMetrics(decodeURIComponent(metrics[1]), url));
  const logs = path.match(/^\/services\/([^/]+)\/logs/);
  if (logs) return json(demoLogs(decodeURIComponent(logs[1]), url));
  const pods = path.match(/^\/services\/([^/]+)\/pods/);
  if (pods) {
    const serviceId = decodeURIComponent(pods[1]);
    const current = (state.services as Record<string, unknown>[]).find((item) => item.id === serviceId);
    const name = current ? String(current.name) : 'service';
    const environment = url.searchParams.get('environment') ?? 'dev';
    const namespace = environment === 'staging'
      ? 'releasea-apps-staging'
      : environment === 'prod' || environment === 'production'
        ? 'releasea-apps-production'
        : 'releasea-apps-development';
    const runtime = current?.runtime as { dev?: { status?: string } } | undefined;
    const runtimeStatus = runtime?.dev?.status ?? '';
    const podNames = runtimeStatus === 'idle' || current?.status === 'created'
      ? []
      : runtimeStatus === 'crashloop'
        ? [`${name}-${environment}-7f3a1c2-abc12`]
        : [`${name}-${environment}-7f3a1c2-abc12`, `${name}-${environment}-7f3a1c2-def34`];
    return json({
      pods: podNames,
      namespace,
      serviceName: name,
    });
  }
  if (path.includes('/gitops/')) {
    if (path.endsWith('/timeline') || path.endsWith('/layout-presets')) return json([]);
    if (path.endsWith('/drift')) {
      return json({
        state: 'missing',
        inSync: false,
        status: 'needs-review',
        summary: 'GitOps is not configured in this demo.',
        message: 'GitOps is not configured in this demo.',
      });
    }
    return json({
      state: 'missing',
      inSync: false,
      status: 'needs-review',
      summary: 'GitOps is not configured in this demo.',
      message: 'GitOps is not configured in this demo.',
      checks: [],
      events: [],
      document: null,
    });
  }
  const serviceStatus = path.match(/^\/services\/([^/]+)\/status$/);
  if (serviceStatus && method === 'GET') {
    const serviceId = decodeURIComponent(serviceStatus[1]);
    const current = (state.services as Record<string, unknown>[]).find((item) => item.id === serviceId);
    if (!current) return json({ message: 'Not found' }, 404);
    return json({
      service: current,
      deploys: (state.deploys as Record<string, unknown>[]).filter((item) => item.serviceId === serviceId),
      rules: (state.rules as Record<string, unknown>[]).filter((item) => item.serviceId === serviceId),
      ruleDeploys: (state.ruleDeploys as Record<string, unknown>[]).filter((item) => item.serviceId === serviceId),
      version: 'demo',
      cursor: 'demo',
      emittedAt: nowIso(),
    });
  }
  if (path === '/identity/config' && method === 'GET') return json(demoIdpConfig());
  if (path === '/identity/config' && (method === 'PUT' || method === 'PATCH')) return json({ ...demoIdpConfig(), ...body });
  if (path === '/identity/connections' && method === 'GET') return json(demoIdpConnections());
  if (path === '/identity/mappings' && method === 'GET') return json(demoIdpMappings());
  if (path === '/identity/sessions' && method === 'GET') return json(demoIdpSessions());
  if (path === '/identity/audit' && method === 'GET') return json(demoIdpAudit());
  if (path.startsWith('/identity/test/')) return json({ success: true, message: 'Microsoft Entra ID demo connection is ready. No live directory was contacted.' });
  if (path === '/governance/approvals' && method === 'GET') return json(demoApprovals());
  if (path === '/governance/settings' && method === 'GET') return json(demoGovernanceSettings());
  if (path === '/governance/settings' && (method === 'PUT' || method === 'PATCH')) return json({ ...demoGovernanceSettings(), ...body });
  if (path === '/governance/audit' && method === 'GET') return json(demoAuditLogs());
  if (path === '/governance/exceptions' && method === 'GET') return json(demoGovernanceExceptions());
  if (path.includes('/governance') || path.includes('/audit')) return json([]);
  if (path === '/ai/providers' && method === 'GET') return json(demoAIProviders());
  if (path === '/ai/providers/available' && method === 'GET') {
    return json(demoAIProviders().map((provider) => ({
      id: provider.id,
      name: provider.name,
      type: provider.type,
      model: provider.model,
      default: provider.default,
      health: provider.health,
    })));
  }
  if (path === '/ai/usage' && method === 'GET') {
    return json({
      from: hoursBeforeDemo(24 * 30),
      providers: [{ _id: 'ai-demo', analyses: 12, inputTokens: 8400, outputTokens: 2100, totalTokens: 10500 }],
    });
  }
  if (path.startsWith('/ai/providers/') && path.endsWith('/test')) {
    return json({
      state: 'healthy',
      message: 'Simulated. No model provider was contacted.',
      models: ['demo-diagnostics'],
      capabilities: ['health-summary'],
      modelConfigured: true,
    });
  }
  if (path.startsWith('/ai/')) return json([]);
  if (path.startsWith('/environments/') && path.endsWith('/lock')) return json({ locked: false });

  const collectionNames: Collection[] = ['services', 'projects', 'rules', 'deploys', 'teams', 'workers', 'environments', 'runtime-profiles'];
  for (const collection of collectionNames) {
    if (path === `/${collection}` && method === 'GET') return json(state[collection]);
    if (path === `/${collection}` && method === 'POST') {
      const created = { id: idFor(collection.slice(0, 3)), createdAt: nowIso(), updatedAt: nowIso(), ...body };
      if (collection === 'services') {
        created.status = created.status ?? 'created';
        created.replicas = created.replicas ?? 1;
        created.cpu = created.cpu ?? 250;
        created.memory = created.memory ?? 256;
        created.environment = created.environment ?? {};
        created.ruleIds = created.ruleIds ?? [];
        created.type = created.type ?? 'microservice';
        created.managementMode = created.managementMode ?? 'managed';
      }
      remember(collection, created);
      return json(created, 201);
    }
    const item = path.match(new RegExp(`^/${collection}/([^/]+)$`));
    if (!item) continue;
    const id = decodeURIComponent(item[1]);
    const list = state[collection] as Record<string, unknown>[];
    const current = list.find((entry) => entry.id === id);
    if (method === 'GET') return current ? json(current) : json({ message: 'Not found' }, 404);
    if (method === 'PUT' || method === 'PATCH') {
      const next = { ...(current ?? { id }), ...body, id, updatedAt: nowIso() };
      remember(collection, next);
      return json(next);
    }
    if (method === 'DELETE') {
      forget(collection, id);
      return json({ status: 'deleted' });
    }
  }

  if (method === 'GET') return json([]);
  return json({ status: 'simulated' });
};

export const installDemoSimulation = () => {
  if (typeof window === 'undefined') return;
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    let url: URL;
    try {
      url = new URL(href, window.location.origin);
    } catch {
      return original(input, init);
    }
    if (!url.pathname.includes('/api/v1/')) return original(input, init);
    return handle(url, init);
  };
};

export const demoResetLabel = () => 'Anything you create is removed from this browser after 1 hour. GitHub repositories are not created.';
