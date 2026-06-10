from __future__ import annotations

from graph_layout_rag.manifest import ManifestItem


def book_metadata_stubs() -> list[ManifestItem]:
    return [
        ManifestItem(
            id="book-dett99",
            title="Graph Drawing: Algorithms for the Visualization of Graphs",
            authors=["Di Battista", "Eades", "Tamassia", "Tollis"],
            year=1999,
            source="book",
            url="https://doi.org/10.1007/978-1-4612-0353-7",
            contentType="text/metadata",
            status="metadata_only",
            tags=["book", "survey"],
            doi="10.1007/978-1-4612-0353-7",
            abstract="Classic graph drawing textbook (Prentice Hall). Use handbook chapter PDFs for open content.",
        ),
        ManifestItem(
            id="book-kaufmann-wagner",
            title="Drawing Graphs: Methods and Models",
            authors=["Kaufmann", "Wagner"],
            year=2001,
            source="book",
            url="https://doi.org/10.1007/3-540-44969-8",
            contentType="text/metadata",
            status="metadata_only",
            tags=["book"],
            doi="10.1007/3-540-44969-8",
            abstract="Springer LNCS survey volume; typically paywalled.",
        ),
        ManifestItem(
            id="book-junger-mutzel",
            title="Graph Drawing Software",
            authors=["Jünger", "Mutzel"],
            year=2002,
            source="book",
            url="https://doi.org/10.1007/978-3-642-55946-3",
            contentType="text/metadata",
            status="metadata_only",
            tags=["book", "software"],
            doi="10.1007/978-3-642-55946-3",
            abstract="Graph drawing software systems including Graphviz-era tools.",
        ),
    ]
