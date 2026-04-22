import json
import logging
import uuid

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def writer_handler(event, context):
    logger.info("writer invoked: %s", json.dumps(event))

    body = json.loads(event.get("body") or "{}")
    key = str(uuid.uuid4())

    # mock: would write to S3 and enqueue to SQS
    logger.info("mock write: key=%s body=%s", key, body)

    return {
        "statusCode": 201,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({"key": key}),
    }


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
