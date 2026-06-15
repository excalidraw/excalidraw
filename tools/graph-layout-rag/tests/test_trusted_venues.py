from graph_layout_rag.harvest import trusted_venues


def test_drops_specs_parse_schema_org_and_strict_gate(monkeypatch):
    payload = """
    <script type="application/ld+json">
    {"mainEntity":{"hasPart":[
      {"@type":"ScholarlyArticle","name":"Layered Graph Drawing",
       "author":[{"name":"Ada Author"}],"abstract":"A layout paper",
       "url":"https://drops.test/doc/10.4230/LIPIcs.GD.2025.1",
       "identifier":"10.4230/LIPIcs.GD.2025.1",
       "encoding":{"contentUrl":"https://drops.test/paper.pdf"}},
      {"@type":"ScholarlyArticle","name":"Unrelated Geometry",
       "identifier":"10.4230/LIPIcs.SoCG.2025.2"}
    ]}}
    </script>
    """
    monkeypatch.setattr(trusted_venues, "_get_html", lambda url: payload)
    specs = trusted_venues._drops_specs(
        {"id": "test", "venue": "SoCG", "year": 2025, "trusted": False}
    )
    assert len(specs) == 1
    assert specs[0]["doi"] == "10.4230/LIPIcs.GD.2025.1"
    assert specs[0]["authors"] == ["Ada Author"]
    assert specs[0]["pdf_url"] == "https://drops.test/paper.pdf"


def test_jgaa_specs_extract_direct_pdf_and_metadata(monkeypatch):
    html = """
    <div class="obj_article_summary">
      <a id="article-42" href="https://jgaa.test/article/view/42">A Drawing Paper</a>
      <div class="authors">Ada Author, Bob Writer</div>
      <a class="obj_galley_link pdf" href="https://jgaa.test/article/view/42/7">PDF</a>
    </div>
    """
    monkeypatch.setattr(trusted_venues, "_get_html", lambda url: html)
    assert trusted_venues._jgaa_specs("https://jgaa.test/issue/1") == [
        {
            "article_id": "42",
            "title": "A Drawing Paper",
            "authors": ["Ada Author", "Bob Writer"],
            "landing": "https://jgaa.test/article/view/42",
            "pdf_url": "https://jgaa.test/article/download/42/7",
        }
    ]


def test_jgaa_pdf_url_preserves_existing_download_endpoint():
    url = "https://jgaa.test/article/download/42/7"
    assert trusted_venues._jgaa_pdf_url(url) == url


def test_jgaa_archive_paginates(monkeypatch):
    pages = {
        trusted_venues.JGAA_ARCHIVE: """
          <a href="https://jgaa.test/issue/view/2">Issue</a>
          <div class="cmp_pagination"><a class="next" href="https://jgaa.test/archive/2">Next</a></div>
        """,
        "https://jgaa.test/archive/2": """
          <a href="https://jgaa.test/issue/view/1">Issue</a>
        """,
    }
    monkeypatch.setattr(trusted_venues, "_get_html", pages.get)
    assert trusted_venues._jgaa_issue_urls() == [
        "https://jgaa.test/issue/view/1",
        "https://jgaa.test/issue/view/2",
    ]


def test_incremental_checkpoint_skips_completed_sources(tmp_path, monkeypatch):
    checkpoint = tmp_path / "trusted.json"
    checkpoint.write_text(
        '{"drops_volumes":["LIPIcs-volume-320","LIPIcs-volume-357","LIPIcs-volume-332"],'
        '"jgaa_issues":["https://jgaa.test/issue/1"]}',
        encoding="utf-8",
    )
    monkeypatch.setattr(trusted_venues, "CHECKPOINT_PATH", checkpoint)
    monkeypatch.setattr(
        trusted_venues, "_jgaa_issue_urls", lambda: ["https://jgaa.test/issue/1"]
    )
    monkeypatch.setattr(
        trusted_venues,
        "_drops_specs",
        lambda volume: (_ for _ in ()).throw(AssertionError("must skip")),
    )
    monkeypatch.setattr(
        trusted_venues,
        "_jgaa_specs",
        lambda url: (_ for _ in ()).throw(AssertionError("must skip")),
    )
    assert trusted_venues.harvest_trusted_venues() == []


def test_failed_jgaa_issue_is_not_checkpointed(tmp_path, monkeypatch):
    checkpoint = tmp_path / "trusted.json"
    monkeypatch.setattr(trusted_venues, "CHECKPOINT_PATH", checkpoint)
    monkeypatch.setattr(trusted_venues, "DROPS_VOLUMES", ())
    monkeypatch.setattr(
        trusted_venues, "_jgaa_issue_urls", lambda: ["https://jgaa.test/issue/1"]
    )
    monkeypatch.setattr(
        trusted_venues,
        "_jgaa_specs",
        lambda url: [
            {
                "article_id": "42",
                "title": "A Drawing Paper",
                "authors": [],
                "landing": "https://jgaa.test/article/view/42",
                "pdf_url": "https://jgaa.test/article/download/42/7",
            }
        ],
    )
    monkeypatch.setattr(
        trusted_venues,
        "_download_jgaa",
        lambda spec, dry_run: trusted_venues.ManifestItem(
            id="jgaa-42",
            title="A Drawing Paper",
            source="jgaa",
            url=spec["pdf_url"],
            status="metadata_only",
        ),
    )

    trusted_venues.harvest_trusted_venues()

    assert not checkpoint.exists()
