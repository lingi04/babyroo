import { Injectable } from '@nestjs/common';
import { GoogleAuth } from 'google-auth-library';
import { ApplicationError } from '../../../../common/application-error';
import { debugLog } from '../../../../common/debug-log';
import {
  GooglePlayBillingPort,
  GooglePlayProductPurchase,
  GooglePlayProductPurchaseRequest,
} from '../../application/ports/out/google-play-billing.port';

type AndroidPublisherProductPurchaseResponse = {
  orderId?: string;
  purchaseState?: number;
  consumptionState?: number;
  acknowledgementState?: number;
};

const ANDROID_PUBLISHER_SCOPE =
  'https://www.googleapis.com/auth/androidpublisher';

@Injectable()
export class GooglePlayBillingAdapter implements GooglePlayBillingPort {
  private auth?: GoogleAuth;

  async getProductPurchase(
    request: GooglePlayProductPurchaseRequest,
  ): Promise<GooglePlayProductPurchase> {
    const client = await this.getAuth().getClient();
    const url = this.purchaseUrl(request);

    try {
      const response =
        await client.request<AndroidPublisherProductPurchaseResponse>({
          method: 'GET',
          url,
        });
      const data = response.data ?? {};

      return {
        orderId: data.orderId,
        purchaseState: data.purchaseState,
        consumptionState: data.consumptionState,
        acknowledgementState: data.acknowledgementState,
        rawResponse: data as Record<string, unknown>,
      };
    } catch (error) {
      debugLog('credits.googlePlay.verify.failure', {
        productId: request.productId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ApplicationError(
        'GOOGLE_PLAY_PURCHASE_VERIFICATION_FAILED',
        'Google Play purchase verification failed',
        502,
      );
    }
  }

  async consumeProductPurchase(
    request: GooglePlayProductPurchaseRequest,
  ): Promise<void> {
    const client = await this.getAuth().getClient();

    try {
      await client.request({
        method: 'POST',
        url: `${this.purchaseUrl(request)}:consume`,
      });
    } catch (error) {
      debugLog('credits.googlePlay.consume.failure', {
        productId: request.productId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ApplicationError(
        'GOOGLE_PLAY_PURCHASE_CONSUME_FAILED',
        'Google Play purchase consume failed',
        502,
      );
    }
  }

  private getAuth() {
    if (!this.auth) {
      this.auth = this.createAuth();
    }

    return this.auth;
  }

  private createAuth() {
    const serviceAccountJson = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;

    if (serviceAccountJson) {
      try {
        return new GoogleAuth({
          credentials: JSON.parse(serviceAccountJson),
          scopes: [ANDROID_PUBLISHER_SCOPE],
        });
      } catch {
        throw new ApplicationError(
          'GOOGLE_PLAY_BILLING_NOT_CONFIGURED',
          'Google Play billing service account JSON is invalid',
          503,
        );
      }
    }

    const clientEmail = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY;

    if (!clientEmail || !privateKey) {
      throw new ApplicationError(
        'GOOGLE_PLAY_BILLING_NOT_CONFIGURED',
        'Google Play billing service account is not configured',
        503,
      );
    }

    return new GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey.replace(/\\n/g, '\n'),
      },
      scopes: [ANDROID_PUBLISHER_SCOPE],
    });
  }

  private purchaseUrl({
    packageName,
    productId,
    purchaseToken,
  }: GooglePlayProductPurchaseRequest) {
    const encodedPackageName = encodeURIComponent(packageName);
    const encodedProductId = encodeURIComponent(productId);
    const encodedToken = encodeURIComponent(purchaseToken);

    return `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodedPackageName}/purchases/products/${encodedProductId}/tokens/${encodedToken}`;
  }
}
