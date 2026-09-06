const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_TO_EMAIL = 'Info.translinelogistics@gmail.com';
const RESEND_TIMEOUT_MS = 10_000;
const TEMPORARY_ERROR_MESSAGE = 'We could not send your enquiry right now. Please try again or contact dispatch directly.';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SERVICE_LABELS = Object.freeze({
  'general-freight': 'General freight',
  hotshots: 'Hotshots',
  'express-delivery': 'Express delivery',
  courier: 'Courier',
  oversize: 'Oversize freight',
  removals: 'Removals',
});
const ALLOWED_SERVICES = new Set(Object.keys(SERVICE_LABELS));

const FIELD_RULES = {
  submissionId: { required: true, minLength: 36, maxLength: 36 },
  name: { required: true, minLength: 2, maxLength: 120 },
  contact: { required: true, minLength: 3, maxLength: 160 },
  pickup: { required: true, minLength: 2, maxLength: 160 },
  destination: { required: true, minLength: 2, maxLength: 160 },
  loadDetails: { required: true, minLength: 10, maxLength: 2000 },
  preferredDate: { required: false, maxLength: 120 },
  service: { required: true, maxLength: 120 },
  sourcePath: { required: false, maxLength: 300 },
  website: { required: false, maxLength: 200 },
};

function parseBody(body) {
  let parsed = body;

  if (typeof body === 'string') {
    try {
      parsed = JSON.parse(body);
    } catch {
      return null;
    }
  }

  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    return null;
  }

  return parsed;
}

function validateFields(body) {
  const fields = {};
  const errors = {};

  for (const [field, rule] of Object.entries(FIELD_RULES)) {
    const value = body[field];

    if (value === undefined) {
      if (rule.required) errors[field] = 'is required';
      fields[field] = '';
      continue;
    }

    if (typeof value !== 'string') {
      errors[field] = 'must be a string';
      fields[field] = '';
      continue;
    }

    const trimmed = value.trim();
    fields[field] = trimmed;

    if (rule.required && trimmed.length === 0) {
      errors[field] = 'is required';
    } else if (rule.minLength && trimmed.length < rule.minLength) {
      errors[field] = `must be at least ${rule.minLength} characters`;
    } else if (trimmed.length > rule.maxLength) {
      errors[field] = `must be ${rule.maxLength} characters or fewer`;
    }
  }

  if (!errors.service && !ALLOWED_SERVICES.has(fields.service)) {
    errors.service = 'must be a supported service';
  }

  if (!errors.submissionId && !UUID_PATTERN.test(fields.submissionId)) {
    errors.submissionId = 'must be a valid UUID';
  }

  return { fields, errors };
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function htmlValue(value) {
  return escapeHtml(value || 'Not provided').replace(/\r?\n/g, '<br>');
}

function buildHtml(fields) {
  const rows = [
    ['Name', fields.name],
    ['Contact', fields.contact],
    ['Service', SERVICE_LABELS[fields.service]],
    ['Pickup', fields.pickup],
    ['Destination', fields.destination],
    ['Load details', fields.loadDetails],
    ['Preferred date', fields.preferredDate],
    ['Source page', fields.sourcePath],
  ];

  const tableRows = rows
    .map(([label, value]) => `<tr><th align="left" valign="top">${label}</th><td>${htmlValue(value)}</td></tr>`)
    .join('');

  return `<h1>New website transport enquiry</h1><table cellpadding="8" cellspacing="0">${tableRows}</table>`;
}

function buildText(fields) {
  return [
    'New website transport enquiry',
    '',
    `Name: ${fields.name}`,
    `Contact: ${fields.contact}`,
    `Service: ${SERVICE_LABELS[fields.service]}`,
    `Pickup: ${fields.pickup}`,
    `Destination: ${fields.destination}`,
    `Load details: ${fields.loadDetails}`,
    `Preferred date: ${fields.preferredDate || 'Not provided'}`,
    `Source page: ${fields.sourcePath || 'Not provided'}`,
  ].join('\n');
}

function isEmail(value) {
  if (value.length > 254 || /\s/.test(value)) return false;

  const atIndex = value.indexOf('@');
  if (atIndex <= 0 || atIndex !== value.lastIndexOf('@')) return false;

  const local = value.slice(0, atIndex);
  const domain = value.slice(atIndex + 1);
  if (
    local.length > 64
    || local.startsWith('.')
    || local.endsWith('.')
    || local.includes('..')
    || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)
  ) {
    return false;
  }

  const domainLabels = domain.split('.');
  return domainLabels.length >= 2 && domainLabels.every(
    (label) => label.length <= 63 && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label)
  );
}

function sendJson(res, status, body) {
  return res.status(status).json(body);
}

export function enquiryJsonErrorHandler(error, req, res, next) {
  const requestPath = req.path || req.url?.split('?')[0];
  if (requestPath !== '/api/enquiry') {
    return next(error);
  }

  if (error?.status === 413 || error?.type === 'entity.too.large') {
    return sendJson(res, 413, { error: 'Request body is too large' });
  }

  if (error?.status === 400 || error?.type === 'entity.parse.failed') {
    return sendJson(res, 400, { error: 'Invalid JSON request body' });
  }

  return next(error);
}

export function createEnquiryHandler({
  fetchImpl = globalThis.fetch,
  env = process.env,
  resendTimeoutMs = RESEND_TIMEOUT_MS,
} = {}) {
  return async function enquiryHandler(req, res) {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendJson(res, 405, { error: 'Method not allowed' });
    }

    let body;
    let validation;
    try {
      body = parseBody(req.body);
      if (body) validation = validateFields(body);
    } catch {
      return sendJson(res, 400, { error: 'Invalid JSON request body' });
    }

    if (!body) {
      return sendJson(res, 400, { error: 'A JSON request body is required' });
    }

    const { fields, errors } = validation;
    if (Object.keys(errors).length > 0) {
      return sendJson(res, 400, { error: 'Invalid enquiry', fields: errors });
    }

    if (fields.website) {
      return sendJson(res, 400, { error: 'Invalid enquiry' });
    }

    const apiKey = env.RESEND_API_KEY?.trim();
    const from = env.ENQUIRY_FROM_EMAIL?.trim();
    const to = env.ENQUIRY_TO_EMAIL?.trim() || DEFAULT_TO_EMAIL;

    if (!apiKey || !from) {
      console.error('enquiry: required email configuration is missing');
      return sendJson(res, 500, {
        error: 'Enquiry email service is not configured',
        message: TEMPORARY_ERROR_MESSAGE,
      });
    }

    if (typeof fetchImpl !== 'function') {
      console.error('enquiry: native fetch is unavailable');
      return sendJson(res, 500, {
        error: 'Enquiry email service is unavailable',
        message: TEMPORARY_ERROR_MESSAGE,
      });
    }

    const email = {
      from,
      to: [to],
      subject: `New website enquiry — ${SERVICE_LABELS[fields.service]}`,
      html: buildHtml(fields),
      text: buildText(fields),
    };

    if (isEmail(fields.contact)) {
      email.reply_to = fields.contact;
    }

    let providerResponse;
    try {
      providerResponse = await fetchImpl(RESEND_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': fields.submissionId,
          'User-Agent': 'TranslineLogistics-Enquiry/1.0',
        },
        body: JSON.stringify(email),
        signal: AbortSignal.timeout(resendTimeoutMs),
      });
    } catch {
      console.error('enquiry: email provider request failed');
      return sendJson(res, 502, {
        error: 'Unable to send enquiry right now',
        message: TEMPORARY_ERROR_MESSAGE,
      });
    }

    if (!providerResponse?.ok) {
      console.error(`enquiry: email provider returned status ${providerResponse?.status ?? 'unknown'}`);
      return sendJson(res, 502, {
        error: 'Unable to send enquiry right now',
        message: TEMPORARY_ERROR_MESSAGE,
      });
    }

    return sendJson(res, 200, { ok: true });
  };
}

export const enquiryHandler = createEnquiryHandler();
