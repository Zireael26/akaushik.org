# Rebuilding the materials

The source Markdown, JSON, HTML, and Python files are included. Runtime exercises use `labs/requirements-lock.txt`; document rebuilding additionally uses `tools/requirements-build.txt`. Use a separate build environment if you want to keep runtime dependencies minimal.

From the package root:

```bash
python tools/author_assessments.py
python tools/build_notebooks.py
python tools/build_figures.py
python tools/build_reader.py
python tools/build_books.py
python tools/verify_all.py
```

`author_assessments.py` regenerates the main workbook, solution source, and assignment/assessment JSON from its authored content. The additional trace cases and keys are separately maintained Markdown. `build_reader.py` embeds all lessons and both atlases into one offline file. `build_notebooks.py` executes the pure-Python notebook cells and records their outputs; no Jupyter server or paid model is required for this build step. You can open and modify the resulting notebooks in a normal Jupyter environment.

`build_books.py` uses the bundled ReportLab renderer. `pdf_engine.py` looks for the DejaVu fonts in `COURSE_FONT_DIR`, then the Linux system directory, then matplotlib's bundled copy (matplotlib is in the build requirements), so macOS and Windows builds need no font installation. `build_figures.py` generates original quantitative plots in PNG and SVG. `verify_all.py` runs the core/graph, original starter, and bridge acceptance suites without paid or external API calls.
