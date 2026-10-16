
const API_BASE_URL = "https://gateway.jobready.co.ke";

export async function apiRequest(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;

  console.log("[API REQUEST]", url);

  let response;

  try {
    response = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",

        // Temporary diagnostic test for the hosting bot verification
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",

        ...(options.body
          ? { "Content-Type": "application/json" }
          : {}),

        ...options.headers,
      },
    });
  } catch (error) {
    console.log("[API NETWORK ERROR]", error.message);
    throw new Error(`Network error: ${error.message}`);
  }

  const contentType = response.headers.get("content-type") || "";
  const rawBody = await response.text();

  console.log("[API STATUS]", response.status);
  console.log("[API CONTENT TYPE]", contentType);
  console.log("[API RAW RESPONSE]", rawBody);

  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error(
      `Expected JSON but received ${contentType || "unknown content type"}.`
    );
  }

  let data;

  try {
    data = JSON.parse(rawBody);
  } catch {
    throw new Error("The API returned invalid JSON.");
  }

  if (!response.ok) {
    throw new Error(
      data.message || `Request failed: HTTP ${response.status}`
    );
  }

  return data;
}

export function testApiHealth() {
  return apiRequest("/api/health");
}
