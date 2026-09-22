import { Body, Controller, Get, HttpCode, Inject, Param, Post, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../../common/auth.guard';
import { CurrentUser, RequestUser } from '../../../../common/current-user.decorator';
import {
  CREATE_RECOMMENDATION_SESSION_USE_CASE,
  CreateRecommendationSessionUseCase,
} from '../../application/ports/in/create-recommendation-session.use-case';
import {
  GET_RECOMMENDATION_SESSION_USE_CASE,
  GetRecommendationSessionUseCase,
} from '../../application/ports/in/get-recommendation-session.use-case';
import {
  LIST_RECOMMENDATION_SESSIONS_USE_CASE,
  ListRecommendationSessionsUseCase,
} from '../../application/ports/in/list-recommendation-sessions.use-case';
import { CreateRecommendationSessionInput } from '../../domain/recommendation.entity';

@Controller('recommendation-sessions')
@UseGuards(AuthGuard)
export class RecommendationsController {
  constructor(
    @Inject(CREATE_RECOMMENDATION_SESSION_USE_CASE)
    private readonly createRecommendationSessionUseCase: CreateRecommendationSessionUseCase,
    @Inject(LIST_RECOMMENDATION_SESSIONS_USE_CASE)
    private readonly listRecommendationSessionsUseCase: ListRecommendationSessionsUseCase,
    @Inject(GET_RECOMMENDATION_SESSION_USE_CASE)
    private readonly getRecommendationSessionUseCase: GetRecommendationSessionUseCase,
  ) {}

  @Post()
  @HttpCode(204)
  async createSession(
    @CurrentUser() user: RequestUser,
    @Body() body: CreateRecommendationSessionInput,
    @Res({ passthrough: true }) response: { setHeader(name: string, value: string): void },
  ) {
    const session = await this.createRecommendationSessionUseCase.createSession(user.id, body);
    response.setHeader('X-Recommendation-Session-Id', session.id);
  }

  @Get()
  listSessions(@CurrentUser() user: RequestUser) {
    return this.listRecommendationSessionsUseCase.listSessions(user.id);
  }

  @Get(':sessionId')
  getSession(@CurrentUser() user: RequestUser, @Param('sessionId') sessionId: string) {
    return this.getRecommendationSessionUseCase.getSession(user.id, sessionId);
  }
}
