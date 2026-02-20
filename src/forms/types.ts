export type EnvVar = {
  id: string;
  key: string;
  value: string;
  type: 'plain' | 'secret';
};
