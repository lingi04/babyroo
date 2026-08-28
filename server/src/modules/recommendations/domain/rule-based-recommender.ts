import { BabyrooEvent } from '../../events/domain/event.entity';
import { Child } from '../../users/domain/user.entity';
import {
  RecommendationPreferences,
  RecommendationResult,
} from './recommendation.entity';

type ScoredEvent = {
  event: BabyrooEvent;
  score: number;
  reasons: string[];
  caution?: string;
};

const REGION_BY_ANSWER: Record<string, string> = {
  seoul: '서울',
  gyeonggi: '경기',
};

export class RuleBasedRecommender {
  recommend(
    events: BabyrooEvent[],
    children: Child[],
    preferences: RecommendationPreferences,
  ): RecommendationResult[] {
    const childAges = children.map(child => this.ageMonths(child.birthDate));
    const region = preferences.startRegion
      ? REGION_BY_ANSWER[preferences.startRegion]
      : undefined;

    return events
      .filter(event => this.isRecommendationCandidate(event, childAges, region))
      .map(event => this.scoreEvent(event, childAges, preferences))
      .sort((a, b) => b.score - a.score || this.eventSequence(b.event) - this.eventSequence(a.event))
      .slice(0, 3)
      .map(scored => ({
        eventId: scored.event.id,
        reasons: scored.reasons.slice(0, 3),
        caution: scored.caution,
      }));
  }

  private isRecommendationCandidate(
    event: BabyrooEvent,
    childAges: number[],
    region?: string,
  ): boolean {
    if (event.endsAt && event.endsAt < this.today()) {
      return false;
    }
    if (region && event.region !== region) {
      return false;
    }
    if (!['performance', 'experience', 'play_space', 'exhibition'].includes(event.category)) {
      return false;
    }
    if (event.reservationStatus === 'closed') {
      return false;
    }
    if (childAges.length === 0) {
      return true;
    }
    return childAges.some(age => this.matchesAge(event, age));
  }

  private scoreEvent(
    event: BabyrooEvent,
    childAges: number[],
    preferences: RecommendationPreferences,
  ): ScoredEvent {
    let score = this.eventSequence(event);
    const reasons: string[] = [];
    let caution: string | undefined;

    if (childAges.some(age => this.matchesAge(event, age))) {
      score += 40;
      reasons.push('Selected child age matches this event.');
    } else if (childAges.length === 0) {
      caution = 'Child age was not provided, so age fit should be checked.';
    }

    if (event.indoor === true) {
      reasons.push('This is an indoor option.');
      if (
        preferences.weatherPlan === 'prefer_indoor' ||
        preferences.place === 'indoor'
      ) {
        score += 25;
      }
    }

    if (preferences.price === 'free' && event.priceType === 'free') {
      score += 20;
      reasons.push('It is listed as free.');
    } else if (preferences.price === 'low' && event.priceType !== 'paid') {
      score += 10;
    }

    if (
      preferences.reservation === 'no_reservation' &&
      event.reservationRequired === false
    ) {
      score += 15;
      reasons.push('It does not require reservation.');
    }

    if (preferences.activity && preferences.activity !== 'any') {
      if (event.category === preferences.activity) {
        score += 15;
        reasons.push(`It matches the ${preferences.activity} preference.`);
      }
    }

    if (event.guardianRequired) {
      reasons.push('Guardian participation is noted.');
    }

    if (reasons.length === 0) {
      reasons.push('It is a currently published Babyroo event.');
    }

    if (!caution && event.reservationStatus === 'unknown') {
      caution = 'Reservation availability should be checked on the source page.';
    }

    return { event, score, reasons, caution };
  }

  private matchesAge(event: BabyrooEvent, ageMonths: number): boolean {
    if (event.ageMinMonths === undefined && event.ageMaxMonths === undefined) {
      return false;
    }
    if (event.ageMinMonths !== undefined && ageMonths < event.ageMinMonths) {
      return false;
    }
    if (event.ageMaxMonths !== undefined && ageMonths > event.ageMaxMonths) {
      return false;
    }
    return true;
  }

  private ageMonths(birthDate: string): number {
    const birth = new Date(`${birthDate}T00:00:00.000Z`);
    const now = new Date();
    return (
      (now.getUTCFullYear() - birth.getUTCFullYear()) * 12 +
      now.getUTCMonth() -
      birth.getUTCMonth()
    );
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private eventSequence(event: BabyrooEvent): number {
    return event.csvSequence ?? 0;
  }
}
