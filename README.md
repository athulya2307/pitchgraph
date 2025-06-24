# Pitch Graph Viewer

A React app for visualizing pitch data as musical "swaras" or cents, with support for multiple graphs, file uploads, and export to image.

## Features

- **Multiple Pitch Cards:** Choose how many pitch graphs you want to view (up to 20).
- **File Upload:** Upload `.txt` or `.csv` files containing pitch data for each card, or use the same file for all cards.
- **Time Range Selection:** Set start and end times (in seconds) for each graph.
- **Tonic Selection:** Specify the tonic frequency (Hz) for accurate swara/cents conversion.
- **Graph Types:** Switch between Victory Chart and Canvas rendering.
- **Y Axis Options:** View pitch as either musical swaras or cents.
- **Export:** Export individual graphs as PNG images (only the graph section, with white background).

## File Format

Each pitch file should be a `.txt` or `.csv` with two columns per line:  
`<time_in_seconds> <pitch_in_Hz>`

Example:

```
0.00 261.63
0.01 262.10
...
```

## Usage

1. **Install dependencies:**

   ```sh
   npm install
   ```

2. **Start the development server:**

   ```sh
   npm run dev
   ```

3. **Open the app** in your browser (usually at [http://localhost:5173](http://localhost:5173)).

4. **Select the number of pitch cards** you want.

5. **Upload pitch files** for each card, or use the same file for all.

6. **Adjust time range and tonic** as needed.

7. **Switch graph type** and Y axis type using the dropdowns.

8. **Export graphs** as images using the "Export Graph as Image" button.

## Code Structure

- Main logic and UI are in `src/App.jsx`.
- Uses [Victory](https://formidable.com/open-source/victory/) for charting and [html2canvas](https://github.com/niklasvh/html2canvas) for export.
- Styling is handled via a `styles` object in the same file.

## License

MIT

---

_Made with React and Victory._
