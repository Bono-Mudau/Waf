import ruleEngine from './ruleEngine.js';
import heuristicEngine from './heuristicEngine.js';
class DetectionEngine {
  detect(record, rules) {
    const values = ruleEngine.extractRequestValues(record);
    const ruleMatches = ruleEngine.evaluate(values, rules);
    const heuristics = heuristicEngine.evaluate(values);
    const ruleScore = ruleMatches.reduce(
      (sum, match) => sum + Number(match.rule.score),
      0
    );
    return {
      score: ruleScore + heuristics.score,
      ruleScore,
      heuristicScore: heuristics.score,
      ruleMatches,
      indicators: heuristics.indicators,
    };
  }
}
export default new DetectionEngine();
