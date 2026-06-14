from pathlib import Path
from unittest.mock import MagicMock, patch

import httpx
import pytest

from graph_layout_rag.harvest.download import close_thread_clients, download_to_file


@pytest.fixture(autouse=True)
def reset_thread_clients():
    close_thread_clients()
    yield
    close_thread_clients()


def test_download_rejects_non_pdf(tmp_path: Path):
    dest = tmp_path / "out.pdf"
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = b"<html>not a pdf</html>"
    mock_response.headers = {"content-type": "text/html"}

    with patch("graph_layout_rag.harvest.download.log_attempt"):
        with patch("graph_layout_rag.harvest.download.httpx.Client") as client_cls:
            client = MagicMock()
            client.__enter__ = MagicMock(return_value=client)
            client.__exit__ = MagicMock(return_value=False)
            client.get.return_value = mock_response
            client_cls.return_value = client

            result = download_to_file(dest, "https://example.com/paper")

    assert result["ok"] is False
    assert result.get("reason") == "non-PDF"
    assert not dest.exists()


def test_download_accepts_valid_pdf(tmp_path: Path):
    dest = tmp_path / "out.pdf"
    pdf_bytes = b"%PDF-1.4\n" + b"x" * 20_000
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.content = pdf_bytes
    mock_response.headers = {"content-type": "application/pdf"}

    with patch("graph_layout_rag.harvest.download.log_attempt"):
        with patch("graph_layout_rag.harvest.download.httpx.Client") as client_cls:
            client = MagicMock()
            client.__enter__ = MagicMock(return_value=client)
            client.__exit__ = MagicMock(return_value=False)
            client.get.return_value = mock_response
            client_cls.return_value = client

            result = download_to_file(dest, "https://example.com/paper.pdf")

    assert result["ok"] is True
    assert dest.exists()
    assert dest.read_bytes().startswith(b"%PDF")


def test_download_retries_on_429(tmp_path: Path):
    dest = tmp_path / "out.pdf"
    pdf_bytes = b"%PDF-1.4\n" + b"x" * 20_000
    rate_limited = MagicMock(status_code=429, headers={})
    ok_response = MagicMock(status_code=200, content=pdf_bytes, headers={"content-type": "application/pdf"})

    with patch("graph_layout_rag.harvest.download.log_attempt"):
        with patch("graph_layout_rag.harvest.download.httpx.Client") as client_cls:
            with patch("graph_layout_rag.harvest.download.time.sleep"):
                client = MagicMock()
                client.__enter__ = MagicMock(return_value=client)
                client.__exit__ = MagicMock(return_value=False)
                client.get.side_effect = [rate_limited, ok_response]
                client_cls.return_value = client

                result = download_to_file(dest, "https://example.com/paper.pdf")

    assert result["ok"] is True


def test_download_handles_http_error(tmp_path: Path):
    dest = tmp_path / "out.pdf"

    with patch("graph_layout_rag.harvest.download.log_attempt"):
        with patch("graph_layout_rag.harvest.download.httpx.Client") as client_cls:
            client = MagicMock()
            client.__enter__ = MagicMock(return_value=client)
            client.__exit__ = MagicMock(return_value=False)
            client.get.side_effect = httpx.HTTPError("network down")
            client_cls.return_value = client

            with patch("graph_layout_rag.harvest.download.time.sleep"):
                result = download_to_file(dest, "https://example.com/paper.pdf")

    assert result["ok"] is False
    assert result.get("transient") is True


def test_download_respects_retry_after(tmp_path: Path):
    dest = tmp_path / "out.pdf"
    pdf_bytes = b"%PDF-1.4\n" + b"x" * 20_000
    rate_limited = MagicMock(status_code=429, headers={"Retry-After": "5"})
    ok_response = MagicMock(status_code=200, content=pdf_bytes, headers={"content-type": "application/pdf"})

    with patch("graph_layout_rag.harvest.download.log_attempt"):
        with patch("graph_layout_rag.harvest.download.httpx.Client") as client_cls:
            with patch("graph_layout_rag.harvest.download.time.sleep") as sleep_mock:
                client = MagicMock()
                client.__enter__ = MagicMock(return_value=client)
                client.__exit__ = MagicMock(return_value=False)
                client.get.side_effect = [rate_limited, ok_response]
                client_cls.return_value = client

                result = download_to_file(dest, "https://example.com/paper.pdf")

    assert result["ok"] is True
    assert any(call.args[0] == 5 for call in sleep_mock.call_args_list)
