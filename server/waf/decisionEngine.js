class DecisionEngine {
  constructor() {
    this.thresholds = { low: 40, normal: 25, high: 15 };
  }
  getThreshold(strict = 'normal') {
    return (
      this.thresholds[String(strict).toLowerCase()] ?? this.thresholds.normal
    );
  }
  decide(score, strict) {
    const threshold = this.getThreshold(strict);
    return { action: score >= threshold ? 'BLOCK' : 'ALLOW', score, threshold };
  }
}
export default new DecisionEngine();
