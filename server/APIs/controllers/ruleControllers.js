import * as v from '../Validators/validators.js';
import { requireThat } from '../middleware/errors.js';

export function validateRule(body, partial = false) {
  v.onlyFields(body, [
    'name',
    'pattern',
    'match_type',
    'score',
    'enabled',
    'description',
  ]);
  requireThat(Object.keys(body).length > 0, 'Provide at least one rule field.');
  const out = {};
  if (!partial || body.name !== undefined)
    out.name = v.text(body.name, 'Rule name', 120);
  if (!partial || body.pattern !== undefined)
    out.pattern = v.text(body.pattern, 'Detection pattern', 1000);
  if (!partial || body.match_type !== undefined) {
    requireThat(
      ['keyword', 'regex'].includes(body.match_type),
      'Match type must be keyword or regex.'
    );
    out.match_type = body.match_type;
  }
  if (!partial || body.score !== undefined) {
    requireThat(
      Number.isInteger(body.score) && body.score >= 1 && body.score <= 100,
      'Rule score must be an integer from 1 to 100.'
    );
    out.score = body.score;
  }
  if (!partial || body.enabled !== undefined) {
    requireThat(
      body.enabled === undefined || typeof body.enabled === 'boolean',
      'Enabled must be a boolean.'
    );
    out.enabled = body.enabled ?? true;
  }
  if (!partial || body.description !== undefined) {
    requireThat(
      body.description === undefined ||
        (typeof body.description === 'string' &&
          body.description.length <= 500),
      'Description must be at most 500 characters.'
    );
    out.description = body.description?.trim() || '';
  }
  if (out.pattern && out.match_type === 'regex') {
    try {
      new RegExp(out.pattern, 'i');
    } catch {
      requireThat(false, 'Invalid regular expression.');
    }
  }
  return out;
}
export function createRuleControllers(rules) {
  return {
    list: async (req, res) =>
      res.json({ rules: await rules.list(req.user.service_id) }),
    create: async (req, res) =>
      res
        .status(201)
        .json({
          rule: await rules.create(req.user.service_id, validateRule(req.body)),
        }),
    update: async (req, res) =>
      res.json({
        rule: await rules.update(
          req.user.service_id,
          v.id(req.params.id),
          validateRule(req.body, true)
        ),
      }),
    remove: async (req, res) => {
      await rules.remove(req.user.service_id, v.id(req.params.id));
      res.json({ message: 'Custom rule deleted.' });
    },
  };
}
