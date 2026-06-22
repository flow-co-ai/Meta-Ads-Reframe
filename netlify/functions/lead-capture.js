const BOARD_ID = "8122098964";
const GROUP_NAME = "Meta Ads Reframe";

/*
  Column IDs (verified against board 8122098964 from sibling project):
    lead_email          → email column
    lead_phone          → phone column (countryShortName: "US")
    lead_status         → status column (label: "Form Submitted")
    text_mksaxzyk       → campaign (text)
    color_mksapa2t      → medium (status/dropdown, label: "Lead_Magnet")
    status_1_mkm8938t   → source (status, label e.g. "meta")
    text_mknzj871       → consent + timestamp (text/note)
*/

const SOURCE_LABELS = new Set([
  "apollo", "meta", "youtube", "referral", "personal", "unknown",
  "Website", "website", "ig", "Guidebook", "cold_email", "tiktok",
  "Meta", "google", "Cold Call", "Facebook_Mobile_Feed", "fb"
]);

function normalizeSource(raw) {
  if (!raw || String(raw).toLowerCase() === "direct") return "unknown";
  const s = String(raw).toLowerCase();
  if (s === "instagram") return "ig";
  if (s === "facebook" || s === "fb") return "fb";
  if (s === "meta") return "meta";
  return raw;
}

async function mondayRequest(query, token) {
  const resp = await fetch("https://api.monday.com/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": token,
      "API-Version": "2024-01",
    },
    body: JSON.stringify({ query }),
  });
  return resp.json();
}

async function getOrCreateGroup(token) {
  /* Check existing groups */
  const listQuery = `{ boards(ids: [${BOARD_ID}]) { groups { id title } } }`;
  const listData = await mondayRequest(listQuery, token);
  const groups = listData?.data?.boards?.[0]?.groups || [];
  const existing = groups.find(g => g.title === GROUP_NAME);
  if (existing) {
    console.log("Reusing existing group:", existing.id);
    return existing.id;
  }

  /* Create group */
  const createQuery = `mutation {
    create_group(board_id: ${BOARD_ID}, group_name: ${JSON.stringify(GROUP_NAME)}) { id }
  }`;
  const createData = await mondayRequest(createQuery, token);
  const newId = createData?.data?.create_group?.id;
  console.log("Created new group:", newId);
  return newId;
}

exports.handler = async function (event) {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors, body: "" };
  }

  const token = process.env.MONDAY_API_TOKEN;
  if (!token) {
    console.error("MONDAY_API_TOKEN not set");
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Config error" }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (_) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "Bad JSON" }) };
  }

  const {
    first_name, last_name, email, phone,
    sms_consent, consent_timestamp,
    source, utm_source, utm_campaign,
    campaign: campaignAttr, vertical,
    medium,
  } = body;

  const rawSource = utm_source || source || "direct";
  const normalizedSource = normalizeSource(rawSource);
  const sourceLabel = SOURCE_LABELS.has(normalizedSource) ? normalizedSource : "meta";

  const campaign = utm_campaign || campaignAttr || "Meta Reframe";
  const fullName = [first_name, last_name].filter(Boolean).join(" ") || email || "Unknown";

  let groupId;
  try {
    groupId = await getOrCreateGroup(token);
  } catch (err) {
    console.error("Group error:", err);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "Group error" }) };
  }

  const columnValues = {
    lead_email: { email: email || "", text: email || "" },
    lead_phone: { phone: phone || "", countryShortName: "US" },
    lead_status: { label: "Form Submitted" },
    text_mksaxzyk: campaign,
    color_mksapa2t: { label: "Lead_Magnet" },
    status_1_mkm8938t: { label: sourceLabel },
    text_mknzj871: sms_consent
      ? `SMS consent: true | ${consent_timestamp || new Date().toISOString()} | vertical: ${vertical || ""}`
      : "SMS consent: false",
  };

  const createItemQuery = `mutation {
    create_item(
      board_id: ${BOARD_ID},
      group_id: ${JSON.stringify(groupId)},
      item_name: ${JSON.stringify(fullName)},
      column_values: ${JSON.stringify(JSON.stringify(columnValues))}
    ) { id }
  }`;

  try {
    const data = await mondayRequest(createItemQuery, token);
    if (data.errors) {
      console.error("Monday errors:", JSON.stringify(data.errors));
      return {
        statusCode: 200,
        headers: cors,
        body: JSON.stringify({ ok: false, errors: data.errors, group_id: groupId }),
      };
    }
    const itemId = data?.data?.create_item?.id;
    console.log("Monday item created:", itemId, "| group:", groupId, "| campaign:", campaign);
    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ ok: true, item_id: itemId, group_id: groupId }),
    };
  } catch (err) {
    console.error("lead-capture error:", err);
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ ok: false, error: String(err) }),
    };
  }
};
