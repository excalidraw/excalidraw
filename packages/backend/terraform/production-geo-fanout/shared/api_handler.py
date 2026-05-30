import json
import os


def handler(event, context):
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(
            {
                "service": os.getenv("APP_CONFIG_PATH", "unknown"),
                "message": "ok",
                "requestContext": event.get("requestContext", {}),
            }
        ),
    }
