import {
  errorResponse,
  handleOptions,
  incrementStat,
  jsonResponse,
  parseJsonBody,
} from "../_shared";

const EVENT_TO_KEY = {
  terraform_import_success: "import_success",
  terraform_import_fail: "import_fail",
} as const;

type EventName = keyof typeof EVENT_TO_KEY;

type EventBody = {
  event?: string;
};

export const onRequestPost: PagesFunction = async (context) => {
  const { request, env } = context;

  const body = await parseJsonBody<EventBody>(request);
  if (!body?.event || !(body.event in EVENT_TO_KEY)) {
    return errorResponse(request, "Invalid event", 400);
  }

  const key = EVENT_TO_KEY[body.event as EventName];
  try {
    await incrementStat(env.STATS, key);
  } catch (err) {
    console.error("event increment failed", err);
    return errorResponse(request, "Failed to record event", 500);
  }

  return jsonResponse(request, { ok: true });
};

export const onRequestOptions: PagesFunction = async (context) =>
  handleOptions(context.request);
