import json
import os
import urllib.request

import boto3
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest


def _signed_post(url, region, payload):
    session = boto3.Session()
    credentials = session.get_credentials().get_frozen_credentials()

    body = json.dumps(payload).encode("utf-8")
    request = AWSRequest(
        method="POST",
        url=url,
        data=body,
        headers={"Content-Type": "application/json"},
    )
    SigV4Auth(credentials, "execute-api", region).add_auth(request)

    req = urllib.request.Request(
        url,
        data=body,
        headers=dict(request.headers.items()),
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as response:
        return response.status


def handler(event, context):
    api_targets = [
        (os.environ["API_1_URL"], os.environ["API_1_REGION"]),
        (os.environ["API_2_URL"], os.environ["API_2_REGION"]),
        (os.environ["API_3_URL"], os.environ["API_3_REGION"]),
        (os.environ["API_4_URL"], os.environ["API_4_REGION"]),
        (os.environ["API_5_URL"], os.environ["API_5_REGION"]),
        (os.environ["API_6_URL"], os.environ["API_6_REGION"]),
    ]

    processed = 0
    for record in event.get("Records", []):
        body = record.get("body", "{}")
        payload = {"message": body, "messageId": record.get("messageId")}
        for url, region in api_targets:
            _signed_post(url, region, payload)
        processed += 1

    return {"processed": processed}
