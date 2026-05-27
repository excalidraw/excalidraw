import json
import os
import urllib.request


def _invoke(url, payload):
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as response:
        return response.status


def handler(event, context):
    api_urls = [
        os.environ["API_1_URL"],
        os.environ["API_2_URL"],
        os.environ["API_3_URL"],
        os.environ["API_4_URL"],
        os.environ["API_5_URL"],
    ]

    processed = 0
    for record in event.get("Records", []):
        body = record.get("body", "{}")
        payload = {"message": body, "messageId": record.get("messageId")}
        for url in api_urls:
            _invoke(url, payload)
        processed += 1

    return {"processed": processed}
