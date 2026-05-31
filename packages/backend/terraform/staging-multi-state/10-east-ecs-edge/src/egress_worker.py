#!/usr/bin/env python3
"""Poll egress SQS and perform optional outbound HTTP via NAT (staging mock)."""

import json
import os
import time
import urllib.request

import boto3


def _handle_message(body):
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        payload = {"raw": body}
    # Staging mock: optional GET to verify NAT egress path
    probe_url = os.environ.get("EGRESS_PROBE_URL", "")
    if probe_url:
        req = urllib.request.Request(probe_url, method="GET")
        with urllib.request.urlopen(req, timeout=10) as response:
            return response.status
    return payload


def main():
    queue_url = os.environ["EGRESS_QUEUE_URL"]
    sqs = boto3.client("sqs")
    wait_seconds = int(os.environ.get("SQS_WAIT_SECONDS", "20"))

    while True:
        response = sqs.receive_message(
            QueueUrl=queue_url,
            MaxNumberOfMessages=1,
            WaitTimeSeconds=wait_seconds,
        )
        for message in response.get("Messages", []):
            _handle_message(message.get("Body", "{}"))
            sqs.delete_message(
                QueueUrl=queue_url,
                ReceiptHandle=message["ReceiptHandle"],
            )
        if not response.get("Messages"):
            time.sleep(1)


if __name__ == "__main__":
    main()
