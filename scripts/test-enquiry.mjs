import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEnquiryHandler,
  enquiryJsonErrorHandler,
} from '../server/enquiries/handler.js';

const configuredEnv = {
  RESEND_API_KEY: 'test-api-key',
  ENQUIRY_FROM_EMAIL: 'Transline Enquiries <enquiries@example.com>',
};

function validBody(overrides = {}) {
  return {
    submissionId: '123e4567-e89b-42d3-a456-426614174000',
    name: 'Taylor Example',
    contact: '0400 000 000',
    pickup: 'Perth WA',
    destination: 'Albany WA',
    loadDetails: 'One pallet',
    preferredDate: '',
    service: 'general-freight',
    sourcePath: '/contact',
    website: '',
    ...overrides,
  };
}

function mockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

async function invoke(handler, { method = 'POST', body = validBody() } = {}) {
  const res = mockResponse();
  await handler({ method, body }, res);
  return res;
}

test('rejects non-POST requests without contacting Resend', async () => {
  let fetchCalled = false;
  const handler = createEnquiryHandler({
    env: configuredEnv,
    fetchImpl: async () => {
      fetchCalled = true;
      throw new Error('fetch must not run');
    },
  });

  const res = await invoke(handler, { method: 'GET' });
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'POST');
  assert.deepEqual(res.body, { error: 'Method not allowed' });
  assert.equal(fetchCalled, false);
});

test('validates required, typed, and bounded fields after trimming', async () => {
  const handler = createEnquiryHandler({
    env: configuredEnv,
    fetchImpl: async () => {
      throw new Error('fetch must not run');
    },
  });

  const res = await invoke(handler, {
    body: validBody({
      name: '   ',
      contact: 123,
      pickup: 'x'.repeat(161),
      destination: 'A',
      loadDetails: 'Too short',
      preferredDate: null,
      service: 'other',
      submissionId: 'not-a-uuid',
    }),
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'Invalid enquiry');
  assert.deepEqual(Object.keys(res.body.fields).sort(), [
    'contact',
    'destination',
    'loadDetails',
    'name',
    'pickup',
    'preferredDate',
    'service',
    'submissionId',
  ]);
});

test('returns JSON for malformed bodies in the handler and Express parser', async () => {
  const handler = createEnquiryHandler({
    env: configuredEnv,
    fetchImpl: async () => {
      throw new Error('fetch must not run');
    },
  });
  const req = { method: 'POST' };
  Object.defineProperty(req, 'body', {
    get() {
      throw new SyntaxError('malformed JSON');
    },
  });

  const handlerRes = mockResponse();
  await handler(req, handlerRes);
  assert.equal(handlerRes.statusCode, 400);
  assert.deepEqual(handlerRes.body, { error: 'Invalid JSON request body' });

  const middlewareRes = mockResponse();
  let calledNext = false;
  enquiryJsonErrorHandler(
    { status: 400, type: 'entity.parse.failed' },
    { path: '/api/enquiry' },
    middlewareRes,
    () => { calledNext = true; },
  );
  assert.equal(middlewareRes.statusCode, 400);
  assert.deepEqual(middlewareRes.body, { error: 'Invalid JSON request body' });
  assert.equal(calledNext, false);
});

test('rejects a filled honeypot without contacting Resend', async () => {
  let fetchCalled = false;
  const handler = createEnquiryHandler({
    env: configuredEnv,
    fetchImpl: async () => {
      fetchCalled = true;
      return { ok: true, status: 200 };
    },
  });

  const res = await invoke(handler, { body: validBody({ website: 'https://spam.example' }) });
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: 'Invalid enquiry' });
  assert.equal(fetchCalled, false);
});

test('requires server email configuration without exposing secrets', async () => {
  let fetchCalled = false;
  const handler = createEnquiryHandler({
    env: {},
    fetchImpl: async () => {
      fetchCalled = true;
      return { ok: true, status: 200 };
    },
  });

  const originalConsoleError = console.error;
  console.error = () => {};
  let res;
  try {
    res = await invoke(handler);
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, {
    error: 'Enquiry email service is not configured',
    message: 'We could not send your enquiry right now. Please try again or contact dispatch directly.',
  });
  assert.equal(fetchCalled, false);
});

test('trims and HTML-escapes submitted values and omits reply_to for a phone', async () => {
  const requests = [];
  const handler = createEnquiryHandler({
    env: configuredEnv,
    fetchImpl: async (...args) => {
      requests.push(args);
      return { ok: true, status: 200 };
    },
  });

  const res = await invoke(handler, {
    body: validBody({
      name: '  Taylor <script>  ',
      pickup: ' Perth & surrounds ',
      loadDetails: 'Pallet <fragile>\nHandle "carefully"',
      sourcePath: ' /services/freight ',
    }),
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true });
  assert.equal(requests.length, 1);
  assert.equal(requests[0][0], 'https://api.resend.com/emails');

  const options = requests[0][1];
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.Authorization, 'Bearer test-api-key');
  assert.equal(options.headers['Idempotency-Key'], '123e4567-e89b-42d3-a456-426614174000');
  assert.equal(options.headers['User-Agent'], 'TranslineLogistics-Enquiry/1.0');
  const email = JSON.parse(options.body);
  assert.deepEqual(email.to, ['Info.translinelogistics@gmail.com']);
  assert.equal(email.subject, 'New website enquiry — General freight');
  assert.equal('reply_to' in email, false);
  assert.match(email.html, /Taylor &lt;script&gt;/);
  assert.match(email.html, /Perth &amp; surrounds/);
  assert.match(email.html, /Pallet &lt;fragile&gt;<br>Handle &quot;carefully&quot;/);
  assert.match(email.html, /General freight/);
  assert.doesNotMatch(email.html, /<script>/);
  assert.match(email.html, /\/services\/freight/);
});

test('uses a valid contact email as reply_to and honours ENQUIRY_TO_EMAIL', async () => {
  let sentEmail;
  const handler = createEnquiryHandler({
    env: { ...configuredEnv, ENQUIRY_TO_EMAIL: 'dispatch@example.com' },
    fetchImpl: async (_url, options) => {
      sentEmail = JSON.parse(options.body);
      return { ok: true, status: 200 };
    },
  });

  const res = await invoke(handler, {
    body: validBody({ contact: '  customer@example.net  ' }),
  });

  assert.equal(res.statusCode, 200);
  assert.equal(sentEmail.reply_to, 'customer@example.net');
  assert.deepEqual(sentEmail.to, ['dispatch@example.com']);
});

test('omits reply_to for email-like strings that are not valid addresses', async () => {
  const invalidEmails = [
    'foo@bar..com',
    '.foo@example.com',
    'foo.@example.com',
    'foo@-example.com',
  ];

  for (const contact of invalidEmails) {
    let sentEmail;
    const handler = createEnquiryHandler({
      env: configuredEnv,
      fetchImpl: async (_url, options) => {
        sentEmail = JSON.parse(options.body);
        return { ok: true, status: 200 };
      },
    });

    const res = await invoke(handler, { body: validBody({ contact }) });
    assert.equal(res.statusCode, 200);
    assert.equal('reply_to' in sentEmail, false, contact);
  }
});

test('returns a truthful gateway error when Resend rejects the request', async () => {
  const handler = createEnquiryHandler({
    env: configuredEnv,
    fetchImpl: async () => ({ ok: false, status: 422 }),
  });

  const originalConsoleError = console.error;
  const logs = [];
  console.error = (...values) => logs.push(values.join(' '));
  let res;
  try {
    res = await invoke(handler, { body: validBody({ name: 'Private Person' }) });
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(res.statusCode, 502);
  assert.deepEqual(res.body, {
    error: 'Unable to send enquiry right now',
    message: 'We could not send your enquiry right now. Please try again or contact dispatch directly.',
  });
  assert.equal(logs.some((line) => line.includes('Private Person')), false);
});

test('returns a truthful gateway error when the provider cannot be reached', async () => {
  const handler = createEnquiryHandler({
    env: configuredEnv,
    fetchImpl: async () => {
      throw new Error('offline');
    },
  });

  const originalConsoleError = console.error;
  console.error = () => {};
  let res;
  try {
    res = await invoke(handler);
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(res.statusCode, 502);
  assert.deepEqual(res.body, {
    error: 'Unable to send enquiry right now',
    message: 'We could not send your enquiry right now. Please try again or contact dispatch directly.',
  });
});

test('times out a stalled provider request and returns JSON', async () => {
  const handler = createEnquiryHandler({
    env: configuredEnv,
    resendTimeoutMs: 5,
    fetchImpl: async (_url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
    }),
  });

  const originalConsoleError = console.error;
  console.error = () => {};
  let res;
  try {
    res = await invoke(handler);
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(res.statusCode, 502);
  assert.equal(res.body.error, 'Unable to send enquiry right now');
  assert.equal(typeof res.body.message, 'string');
});
