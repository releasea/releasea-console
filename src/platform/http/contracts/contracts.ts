import { z } from 'zod';

export const authUserSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(['admin', 'developer']),
  avatar: z.string().optional(),
  teamId: z.string().min(1),
  teamName: z.string().min(1),
});

export const authSessionRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authSignUpRequestSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(1),
});

export const authSessionResponseSchema = z.object({
  user: authUserSchema,
  token: z.string().min(16),
});

export const authExchangeSSORequestSchema = z.object({
  ticket: z.string().min(1),
});

export const operationSummarySchema = z.object({
  id: z.string().min(1),
  status: z.string().min(1),
}).passthrough();

export const promoteCanaryRequestSchema = z.object({
  environment: z.string().min(1),
});

export const promoteCanaryResponseSchema = z.object({
  operation: operationSummarySchema,
});

export const createDeployRequestSchema = z.object({
  environment: z.string().min(1),
  version: z.string().optional(),
  trigger: z.string().optional(),
}).passthrough();
