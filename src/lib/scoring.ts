import { resultsByMatchId } from "@/lib/results";

export type ScoreablePrediction = {
  matchId: string;
  homeScore: number;
  awayScore: number;
};

export function scorePrediction(prediction: ScoreablePrediction) {
  const result = resultsByMatchId.get(prediction.matchId);

  if (!result) {
    return 0;
  }

  return prediction.homeScore === result.homeScore &&
    prediction.awayScore === result.awayScore
    ? 1
    : 0;
}

export function scorePredictions(predictions: ScoreablePrediction[]) {
  return predictions.reduce(
    (total, prediction) => total + scorePrediction(prediction),
    0,
  );
}
