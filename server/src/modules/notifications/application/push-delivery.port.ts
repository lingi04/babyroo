import { PushDevice } from './push-device.repository';

export const PUSH_DELIVERY_PORT = Symbol('PUSH_DELIVERY_PORT');

export type PushNotification = {
  title: string;
  body: string;
  data: Record<string, string>;
  deduplicationKey: string;
};

// Throw on delivery failure; invalid_token means confirmed provider rejection.
export interface PushDeliveryPort {
  readonly provider: string;
  send(device: PushDevice, notification: PushNotification): Promise<'sent' | 'invalid_token'>;
}
