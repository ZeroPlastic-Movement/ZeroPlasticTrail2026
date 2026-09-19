/**
 * Serverless check-in endpoint.
 *
 * The Monday.com token lives here, server-side, and never reaches the browser.
 * Anything prefixed VITE_ is compiled into the client bundle, so the token must
 * NOT be named VITE_MONDAY_API_TOKEN. Set MONDAY_API_TOKEN in Vercel instead.
 */

const MONDAY_API_URL = 'https://api.monday.com/v2';
const BOARD_ID = process.env.MONDAY_BOARD_ID || '5031418117';

// Column ids on board 5031418117. Verified against the live board.
const COL = {
  nic: 'numeric_mm7brhp6',
  mobile: 'numeric_mm7bz03e',
  participated: 'color_mm7bt98r',
  certificateName: 'dropdown_mm7bzxw6',
};

// ---- Rate limiting -------------------------------------------------------
// Monday rejects a rate-limited request outright, so nothing ran on their side
// and the identical call can be sent again. That is what makes retrying
// create_item safe here: a rejected write never happened, so a retry cannot
// produce a second participant. Only the conditions below are ever retried —
// never a 400/401/403, an invalid query, or a bad board/column id.
const MAX_ATTEMPTS = 3;

// Each wait is capped. Monday can advise a delay of half a minute, but a
// serverless function that sleeps that long is killed by the platform timeout,
// which would turn a busy moment into a hard failure at the gate. Better to
// give up quickly and let the volunteer tap Search again.
const MAX_RETRY_WAIT_MS = 2000;

const RATE_LIMIT_MARKERS = [
  'maxconcurrencyexceeded',
  'concurrency_limit_exceeded',
  'rate limit exceeded',
  'rate_limit_exceeded',
  'ip_rate_limit_exceeded',
  'complexity_budget_exhausted',
  'complexityexception',
  'too many requests',
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isRateLimited(response, body) {
  if (response.status === 429) return true;

  const parts = [body?.error_code, body?.error_message];
  for (const error of body?.errors || []) {
    parts.push(error?.message, error?.extensions?.code, error?.error_code);
  }
  const text = parts.filter(Boolean).join(' ').toLowerCase();
  if (!text) return false;

  // A daily quota will not clear inside the retry window, so failing fast beats
  // making someone wait for a retry that cannot succeed.
  if (text.includes('daily_limit_exceeded')) return false;

  return RATE_LIMIT_MARKERS.some((marker) => text.includes(marker));
}

/** Monday's own advice first, then a 1s / 2s backoff. The jitter stops a queue
 *  of simultaneous check-ins from retrying on the same millisecond. */
function retryWaitMs(response, body, attempt) {
  const retryAfter = Number(response.headers?.get?.('retry-after'));
  const retryIn = Number(
    body?.retry_in_seconds ?? body?.errors?.[0]?.extensions?.retry_in_seconds
  );

  let wait;
  if (Number.isFinite(retryAfter) && retryAfter > 0) wait = retryAfter * 1000;
  else if (Number.isFinite(retryIn) && retryIn > 0) wait = retryIn * 1000;
  else wait = 1000 * 2 ** (attempt - 1);

  return Math.min(wait, MAX_RETRY_WAIT_MS) + Math.floor(Math.random() * 250);
}

async function monday(query, variables) {
  const token = process.env.MONDAY_API_TOKEN;
  if (!token) {
    throw new HttpError(500, 'Server is not configured. MONDAY_API_TOKEN is missing.');
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: token,
  };
  // Optional: pin the Monday API version so a future breaking change to their
  // "current" version cannot take the app down mid-event. See README.
  if (process.env.MONDAY_API_VERSION) {
    headers['API-Version'] = process.env.MONDAY_API_VERSION;
  }

  for (let attempt = 1; ; attempt++) {
    const response = await fetch(MONDAY_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query, variables }),
    });

    const body = await response.json().catch(() => null);

    if (isRateLimited(response, body) && attempt < MAX_ATTEMPTS) {
      const wait = retryWaitMs(response, body, attempt);
      // Deliberately logs no variables: they carry NIC and mobile numbers.
      console.warn(
        `Monday rate limited request; retrying in ${Math.round(wait / 1000)}s ` +
          `(attempt ${attempt + 1}/${MAX_ATTEMPTS})`
      );
      await sleep(wait);
      continue;
    }

    if (!response.ok || !body) {
      throw new HttpError(502, `Monday.com returned ${response.status}.`);
    }
    if (body.errors?.length) {
      // Surface the reason in the server log, never to the participant.
      console.error('Monday GraphQL error:', JSON.stringify(body.errors));
      throw new HttpError(502, body.errors[0]?.message || 'Monday.com rejected the request.');
    }
    return body.data;
  }
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Digits only. The NIC column on the board is a numbers column, so stored
 *  values are always bare digits — an old-format "912345678V" has to be
 *  compared on its digits. */
function normaliseNic(input) {
  const digits = String(input ?? '').replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 12) {
    throw new HttpError(400, 'Enter a valid NIC number (9 to 12 digits).');
  }
  return digits;
}

function normaliseMobile(input) {
  const digits = String(input ?? '').replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 12) {
    throw new HttpError(400, 'Enter a valid mobile number.');
  }
  return digits;
}

function requireText(input, field, max) {
  const value = String(input ?? '').trim().replace(/\s+/g, ' ');
  if (!value) throw new HttpError(400, `${field} is required.`);
  if (value.length > max) throw new HttpError(400, `${field} is too long.`);
  return value;
}

async function searchByNic(nic) {
  const data = await monday(
    `query ($boardId: ID!, $columnId: String!, $value: String!, $participatedId: String!) {
       items_page_by_column_values(
         board_id: $boardId,
         limit: 1,
         columns: [{ column_id: $columnId, column_values: [$value] }]
       ) {
         items {
           id
           name
           column_values(ids: [$participatedId]) { id text }
         }
       }
     }`,
    { boardId: BOARD_ID, columnId: COL.nic, value: nic, participatedId: COL.participated }
  );

  const item = data?.items_page_by_column_values?.items?.[0];
  if (!item) return { found: false };

  // Only ever return this one participant's name — never the whole board.
  return {
    found: true,
    itemId: item.id,
    name: item.name,
    alreadyParticipated:
      item.column_values?.[0]?.text?.trim().toLowerCase() === 'yes',
  };
}

async function markParticipated(itemId) {
  await monday(
    `mutation ($boardId: ID!, $itemId: ID!, $columnId: String!, $value: JSON!) {
       change_column_value(board_id: $boardId, item_id: $itemId, column_id: $columnId, value: $value) { id }
     }`,
    {
      boardId: BOARD_ID,
      itemId: String(itemId),
      columnId: COL.participated,
      value: JSON.stringify({ label: 'Yes' }),
    }
  );
  return { ok: true };
}

async function createItem(name, columnValues) {
  const data = await monday(
    `mutation ($boardId: ID!, $itemName: String!, $cols: JSON!) {
       create_item(board_id: $boardId, item_name: $itemName, column_values: $cols, create_labels_if_missing: true) { id }
     }`,
    { boardId: BOARD_ID, itemName: name, cols: JSON.stringify(columnValues) }
  );
  return data?.create_item?.id;
}

async function register(payload) {
  const name = requireText(payload.name, 'Name', 100);
  const certificateName = requireText(payload.certificateName, 'Name for the certificate', 100);
  const mobile = normaliseMobile(payload.mobile);
  const nic = normaliseNic(payload.nic);

  // Someone may have registered between the search and this submit.
  const existing = await searchByNic(nic);
  if (existing.found) {
    if (!existing.alreadyParticipated) await markParticipated(existing.itemId);
    return { ok: true, duplicate: true, name: existing.name };
  }

  const core = {
    [COL.nic]: nic,
    [COL.mobile]: mobile,
    [COL.participated]: { label: 'Yes' },
  };

  // The existing certificate-name column is a dropdown. Try to save it while
  // creating the participant. If Monday rejects a new dropdown label, never
  // block the gate check-in: create the participant with the core fields.
  try {
    await createItem(name, {
      ...core,
      [COL.certificateName]: { labels: [certificateName] },
    });
    return { ok: true };
  } catch (error) {
    console.error('Registration with certificate name failed, retrying core fields:', error.message);
    await createItem(name, core);
    return { ok: true, partial: true };
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};

    switch (body.action) {
      case 'search':
        return res.status(200).json(await searchByNic(normaliseNic(body.nic)));

      case 'participate': {
        const itemId = String(body.itemId ?? '');
        if (!/^\d+$/.test(itemId)) throw new HttpError(400, 'Invalid participant reference.');
        return res.status(200).json(await markParticipated(itemId));
      }

      case 'register':
        return res.status(200).json(await register(body));

      default:
        return res.status(400).json({ error: 'Unknown action.' });
    }
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    if (status >= 500) console.error('Check-in handler error:', error);
    return res.status(status).json({
      error: status >= 500 ? 'Something went wrong. Please try again or see a volunteer.' : error.message,
    });
  }
}

export const config = { runtime: 'nodejs' };
