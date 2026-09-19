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
  university: 'color_mm7bmtcx',
  participated: 'color_mm7bt98r',
  certificateName: 'dropdown_mm7bzxw6',
  medical: 'color_mm7b1hjs',
};

// Status labels that already exist on the University / Institution column.
// Registration only ever writes one of these, so a crafted request cannot
// invent new labels on the board.
const UNIVERSITIES = [
  'Open University of Sri Lanka',
  'University of Colombo',
  'University of Peradeniya',
  'University of Kelaniya',
  'University of Ruhuna',
  'University of Wayamba',
  'University of Vavuniya',
  'Sabaragamuwa University of Sri Lanka',
  'Ocean University of Sri Lanka',
  'CINEC',
  'NIBM',
  'NISD',
  'NDT',
  'SIBA Campus',
  'Other',
];

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

  const response = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });

  const body = await response.json().catch(() => null);

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
  const name = requireText(payload.name, 'Full name', 100);
  const nic = normaliseNic(payload.nic);
  const mobile = normaliseMobile(payload.mobile);

  const university = String(payload.university ?? '').trim();
  if (!UNIVERSITIES.includes(university)) {
    throw new HttpError(400, 'Select your university or institution.');
  }

  const certificateName = String(payload.certificateName ?? '').trim().slice(0, 100);
  const medical = String(payload.medical ?? '').trim().slice(0, 255) || 'No';

  // Someone may have registered between the search and this submit.
  const existing = await searchByNic(nic);
  if (existing.found) {
    if (!existing.alreadyParticipated) await markParticipated(existing.itemId);
    return { ok: true, duplicate: true, name: existing.name };
  }

  // Core fields must land. The two optional ones write into a dropdown and a
  // status column whose labels are per-person free text, so a label-creation
  // failure there must never cost us the check-in itself.
  const core = {
    [COL.nic]: nic,
    [COL.mobile]: mobile,
    [COL.university]: { label: university },
    [COL.participated]: { label: 'Yes' },
  };
  const full = { ...core };
  if (certificateName) full[COL.certificateName] = { labels: [certificateName] };
  if (medical) full[COL.medical] = { label: medical };

  try {
    await createItem(name, full);
    return { ok: true };
  } catch (error) {
    console.error('Full registration failed, retrying with core fields only:', error.message);
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
