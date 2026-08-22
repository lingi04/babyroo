import { Injectable } from '@nestjs/common';
import { waitUntil } from '@vercel/functions';
import { debugLog } from '../../../../common/debug-log';
import {
  RecommendationJob,
  RecommendationJobDispatcherPort,
} from '../../application/ports/out/recommendation-job-dispatcher.port';
import { RecommendationJobProcessor } from '../../application/services/recommendation-job.processor';

@Injectable()
export class VercelWaitUntilRecommendationJobDispatcher
  implements RecommendationJobDispatcherPort
{
  constructor(private readonly processor: RecommendationJobProcessor) {}

  async dispatch(job: RecommendationJob): Promise<void> {
    waitUntil(
      this.processor.process(job).catch(error => {
        debugLog('recommendations.job.unhandledFailure', {
          ...job,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }),
    );
  }
}
