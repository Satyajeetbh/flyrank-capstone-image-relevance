export interface ProviderUsage {
  provider: string;
  model: string;
  inputUnits: number;
  outputUnits: number;
}

export interface ProviderResult<T> {
  output: T;
  usage: ProviderUsage | null;
}
