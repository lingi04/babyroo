import { FcmPushNotificationAdapter } from './adapters/fcm-push-notification.adapter';
import { PushDeliveryPort } from './application/push-delivery.port';

// Add providers here. Factories initialize only the selected implementation.
const providers: Record<string, () => PushDeliveryPort> = {
  fcm: () => new FcmPushNotificationAdapter(),
};

export function createPushDelivery(
  provider = process.env.BABYROO_PUSH_PROVIDER ?? 'fcm',
  factories: Readonly<Record<string, () => PushDeliveryPort>> = providers,
): PushDeliveryPort {
  if (!Object.prototype.hasOwnProperty.call(factories, provider)) {
    throw new Error(`Unsupported push provider: ${provider}`);
  }
  const delivery = factories[provider]();
  if (delivery.provider !== provider) throw new Error('Push provider registration mismatch');
  return delivery;
}
