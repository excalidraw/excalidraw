import base64
import json
import logging
import uuid

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def _is_alb_event(event):
    request_context = event.get("requestContext")
    return isinstance(request_context, dict) and "elb" in request_context


def _parse_json_body(event):
    raw = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        raw = base64.b64decode(raw).decode("utf-8")
    if not raw.strip():
        return {}
    return json.loads(raw)


def _http_response(status_code, payload, *, for_alb):
    body = json.dumps(payload)
    headers = {"Content-Type": "application/json"}
    if for_alb:
        return {
            "isBase64Encoded": False,
            "statusCode": status_code,
            "statusDescription": f"{status_code} {'OK' if status_code < 400 else 'Error'}",
            "headers": headers,
            "body": body,
        }
    return {
        "statusCode": status_code,
        "headers": headers,
        "body": body,
    }


def writer_handler(event, context):
    logger.info("writer invoked: %s", json.dumps(event))

    for_alb = _is_alb_event(event)
    try:
        body = _parse_json_body(event) if for_alb else json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return _http_response(
            400,
            {"error": "invalid JSON body"},
            for_alb=for_alb,
        )

    key = str(uuid.uuid4())

    # mock: would write to S3 and enqueue to SQS
    logger.info("mock write: key=%s body=%s", key, body)

    return _http_response(201, {"key": key}, for_alb=for_alb)


def reader_handler(event, context):
    logger.info("reader invoked: %s", json.dumps(event))

    params = event.get("queryStringParameters") or {}
    key = params.get("key")

    if not key:
        return {
            "statusCode": 400,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"error": "missing query param: key"}),
        }

    # mock: would fetch from S3
    logger.info("mock read: key=%s", key)

    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({"key": key, "data": {}}),
    }


def monitoring_handler(event, context):
    logger.info("monitoring invoked: %s", json.dumps(event))
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({"status": "ok"}),
    }
