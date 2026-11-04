/* Read-only Shadowrocket probe. Not a location-settings implementation. */
(function () {
  "use strict";

  const HEALTH_URL = "https://wloc-settings.invalid/health";
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, max-age=0",
    "Pragma": "no-cache",
    "X-Content-Type-Options": "nosniff",
  };
  let status = 400;
  let result = "invalid-request";

  if (typeof $request === "object" && $request !== null) {
    const requestHeaders = $request.headers === undefined ? {} : $request.headers;
    const validHeaders = requestHeaders !== null && typeof requestHeaders === "object" && !Array.isArray(requestHeaders);
    const hasOrigin = validHeaders && Object.keys(requestHeaders).some(function (name) {
        return name.toLowerCase() === "origin";
      });

    if (!validHeaders) {
      status = 400;
      result = "invalid-request";
    } else if (hasOrigin) {
      status = 403;
      result = "cross-origin-request-denied";
    } else if ($request.url !== HEALTH_URL) {
      status = 404;
      result = "unknown-endpoint";
    } else if ($request.method !== "GET") {
      status = 405;
      result = "method-not-allowed";
      headers.Allow = "GET";
    } else {
      status = 200;
      result = "ok";
    }
  }

  $done({
    response: {
      status: status,
      headers: headers,
      body: JSON.stringify({
        service: "wloc-local-health",
        protocol: 1,
        status: result,
      }),
    },
  });
})();
