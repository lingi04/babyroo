export const PUSH_DEVICE_REPOSITORY = Symbol('PUSH_DEVICE_REPOSITORY');

export type PushDevice = {
  installationId: string;
  userId: string;
  token: string;
  provider: string;
  platform: 'android' | 'ios';
};

export interface PushDeviceRepository {
  register(device: PushDevice): Promise<void>;
  remove(userId: string, installationId: string): Promise<void>;
  removeInvalidToken(provider: string, token: string): Promise<void>;
  listByUser(userId: string): Promise<PushDevice[]>;
}
