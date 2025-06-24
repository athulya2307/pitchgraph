import React, { useState, useRef, useEffect } from 'react';
import {
  VictoryChart,
  VictoryLine,
  VictoryAxis,
  VictoryTheme,
  VictoryTooltip,
  VictoryVoronoiContainer,
} from 'victory';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Swara names and their positions in cents (relative to tonic Sa)
const SWARA_LABELS = [
  { name: 'Sa', cents: 0 },
  { name: 'Re', cents: 204 },
  { name: 'Re♯/Ga♭', cents: 316 },
  { name: 'Ga', cents: 386 },
  { name: 'Ma', cents: 498 },
  { name: 'Ma♯/Pa♭', cents: 610 },
  { name: 'Pa', cents: 702 },
  { name: 'Dha', cents: 906 },
  { name: 'Dha♯/Ni♭', cents: 1018 },
  { name: 'Ni', cents: 1088 },
  { name: "Sa'", cents: 1200 },
];

// Convert Hz to cents relative to tonic
const hzToCents = (hz, tonicHz) => {
  if (!hz || !tonicHz || hz <= 0 || tonicHz <= 0) return null;
  return 1200 * Math.log2(hz / tonicHz);
};

const parsePitchData = (text) => {
  const lines = text.split(/\r?\n/);
  const data = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const tokens = line.trim().split(/[ ,\t]+/);
    if (tokens.length < 2) continue;
    const t = parseFloat(tokens[0]);
    const p = parseFloat(tokens[1]);
    if (isNaN(t) || isNaN(p)) continue;
    data.push({ x: t, y: p });
  }
  data.sort((a, b) => a.x - b.x);
  return data;
};

// Get swara ticks for the visible cents range, but ensure enough vertical space between ticks
const getSwaraTicks = (minCents, maxCents, minSpacing = 60, height = 280) => {
  // minSpacing: minimum vertical px between swara labels
  // height: chart height in px (default 280)
  // Returns only swaras that are at least minSpacing px apart
  const ticks = [];
  const allTicks = [];
  const minOctave = Math.floor(minCents / 1200);
  const maxOctave = Math.ceil(maxCents / 1200);
  for (let octave = minOctave; octave <= maxOctave; octave++) {
    SWARA_LABELS.forEach(swara => {
      const cents = swara.cents + octave * 1200;
      if (cents >= minCents - 50 && cents <= maxCents + 50) {
        let label = swara.name;
        if (octave > 0) label += "'".repeat(octave);
        if (octave < 0) label += ",".repeat(-octave);
        allTicks.push({ value: cents, label });
      }
    });
  }
  // Filter so that no two swaras are too close vertically
  let lastY = null;
  allTicks.forEach(tick => {
    const yNorm = (tick.value - minCents) / (maxCents - minCents || 1);
    const yPx = height - (yNorm * height);
    if (lastY === null || Math.abs(yPx - lastY) >= minSpacing) {
      ticks.push(tick);
      lastY = yPx;
    }
  });
  return ticks;
};

// Helper to get y ticks for cents grid lines
const getYTicks = (min, max, count = 5) => {
  if (!isFinite(min) || !isFinite(max) || min === max) return [];
  const ticks = [];
  for (let i = 0; i <= count; i++) {
    ticks.push(min + ((max - min) * i) / count);
  }
  return ticks;
};

const PitchGraphCard = ({
  index,
  pitchData,
  startTime,
  endTime,
  tonic,
  onFileChange,
  onStartTimeChange,
  onEndTimeChange,
  onTonicChange,
  fileName,
  graphType,
  useSameFile,
  yAxisType,
}) => {
  // Filter and convert to cents
  const filteredData = (() => {
    if (!startTime || !endTime || !tonic) return [];
    const s = Number(startTime);
    const e = Number(endTime);
    const tonicHz = Number(tonic);
    if (isNaN(s) || isNaN(e) || s >= e || isNaN(tonicHz) || tonicHz <= 0) return [];
    return pitchData
      .filter((p) => p.x >= s && p.x <= e && p.y > 0)
      .map((p) => ({ x: p.x, y: hzToCents(p.y, tonicHz) }))
      .filter((p) => p.y !== null && isFinite(p.y));
  })();

  const canvasRef = useRef(null);
  const cardRef = useRef(null);

  // Draw canvas with horizontal grid lines for swaras or cents
  const drawGraph = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    if (
      !filteredData.length ||
      !startTime ||
      !endTime ||
      !tonic ||
      isNaN(Number(startTime)) ||
      isNaN(Number(endTime)) ||
      isNaN(Number(tonic)) ||
      Number(startTime) >= Number(endTime) ||
      Number(tonic) <= 0
    ) {
      ctx.fillStyle = '#4b5563';
      ctx.font = '16px "Poppins", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No pitch data loaded or invalid range/tonic', w / 2, h / 2);
      return;
    }

    const centsMin = Math.min(...filteredData.map(d => d.y));
    const centsMax = Math.max(...filteredData.map(d => d.y));
    const safeCentsMin = centsMin === centsMax ? centsMin - 1 : centsMin;
    const safeCentsMax = centsMin === centsMax ? centsMax + 1 : centsMax;

    const marginLeft = 70;
    const marginRight = 20;
    const marginTop = 35;
    const marginBottom = 45;
    const drawWidth = w - marginLeft - marginRight;
    const drawHeight = h - marginTop - marginBottom;

    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(marginLeft, marginTop, drawWidth, drawHeight);

    // Draw horizontal grid lines for swaras or cents
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.font = '13px "Poppins", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    if (yAxisType === 'swaras') {
      const swaraTicks = getSwaraTicks(safeCentsMin, safeCentsMax, 40, drawHeight);
      swaraTicks.forEach(({ value, label }) => {
        const yPos = marginTop + drawHeight - ((value - safeCentsMin) / (safeCentsMax - safeCentsMin || 1)) * drawHeight;
        ctx.strokeStyle = '#a3a3a3';
        ctx.beginPath();
        ctx.moveTo(marginLeft, yPos);
        ctx.lineTo(marginLeft + drawWidth, yPos);
        ctx.stroke();
        ctx.fillStyle = '#1e40af';
        ctx.textAlign = 'right';
        ctx.fillText(label, marginLeft - 18, yPos);
      });
      // Draw "Swaras" heading
      ctx.save();
      ctx.font = 'bold 15px "Poppins", monospace';
      ctx.fillStyle = '#1e40af';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('Swaras', marginLeft - 18, marginTop - 18);
      ctx.restore();
    } else {
      // Cents grid
      const yTicks = getYTicks(safeCentsMin, safeCentsMax, 5);
      yTicks.forEach((yVal) => {
        const yPos = marginTop + drawHeight - ((yVal - safeCentsMin) / (safeCentsMax - safeCentsMin || 1)) * drawHeight;
        ctx.strokeStyle = '#a3a3a3';
        ctx.beginPath();
        ctx.moveTo(marginLeft, yPos);
        ctx.lineTo(marginLeft + drawWidth, yPos);
        ctx.stroke();
        ctx.fillStyle = '#4b5563';
        ctx.fillText(yVal.toFixed(1), marginLeft - 18, yPos);
      });
      // Draw "Cents" heading
      ctx.save();
      ctx.font = 'bold 15px "Poppins", monospace';
      ctx.fillStyle = '#1e40af';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('Cents', marginLeft - 18, marginTop - 18);
      ctx.restore();
    }
    ctx.restore();

    // X axis ticks
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '11px "Poppins", monospace';
    const xTicks = 6;
    for (let i = 0; i <= xTicks; i++) {
      const xVal = Number(startTime) + ((Number(endTime) - Number(startTime)) * i) / xTicks;
      const xPos = marginLeft + (drawWidth * i) / xTicks;
      ctx.fillStyle = '#4b5563';
      ctx.fillText(xVal.toFixed(2), xPos, marginTop + drawHeight + 10);
      ctx.save();
      ctx.strokeStyle = 'rgba(156,163,175,0.15)';
      ctx.beginPath();
      ctx.moveTo(xPos, marginTop);
      ctx.lineTo(xPos, marginTop + drawHeight);
      ctx.stroke();
      ctx.restore();
    }

    // Draw axes
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(marginLeft, marginTop);
    ctx.lineTo(marginLeft, marginTop + drawHeight);
    ctx.lineTo(marginLeft + drawWidth, marginTop + drawHeight);
    ctx.stroke();

    // Draw pitch line
    ctx.strokeStyle = '#4f46e5';
    ctx.lineWidth = 3;
    ctx.beginPath();
    filteredData.forEach((pt, i) => {
      const x = marginLeft + ((pt.x - Number(startTime)) / (Number(endTime) - Number(startTime))) * drawWidth;
      const y = marginTop + drawHeight - ((pt.y - safeCentsMin) / (safeCentsMax - safeCentsMin || 1)) * drawHeight;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  };

  useEffect(() => {
    if (graphType === 'canvas') {
      drawGraph();
    }
    // eslint-disable-next-line
  }, [filteredData, startTime, endTime, tonic, graphType, yAxisType]);

  // Export this card as image
  const handleExportImage = async () => {
    if (cardRef.current) {
      const canvas = await html2canvas(cardRef.current, { backgroundColor: null });
      const link = document.createElement('a');
      link.download = `pitch-graph-${index + 1}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  };

  // Export this card as PDF
  const handleExportPDF = async () => {
    if (cardRef.current) {
      const canvas = await html2canvas(cardRef.current, { backgroundColor: '#fff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`pitch-graph-${index + 1}.pdf`);
    }
  };

  return (
    <section ref={cardRef} style={styles.card} aria-label={`Pitch Graph ${index + 1}`}>
      <h2 style={styles.cardTitle}>Pitch Graph {index + 1}</h2>

      {!useSameFile && (
        <>
          <label htmlFor={`file-input-${index}`} style={{ ...styles.fileLabel, marginRight: 12, display: 'inline-block' }}>
            Select Pitch File (.txt or .csv)
          </label>
          <input
            type="file"
            accept=".txt,.csv"
            id={`file-input-${index}`}
            onChange={e => onFileChange(index, e)}
            style={{ display: 'none' }}
            aria-label={`File upload input for pitch graph ${index + 1}`}
          />
          {fileName && <div style={styles.fileName}>Loaded File: {fileName}</div>}
        </>
      )}

      <div style={styles.controlsRow}>
        <div style={styles.miniInputGroup}>
          <label htmlFor={`startTime-${index}`} style={styles.miniLabel}>
            Start Time (s)
          </label>
          <input
            id={`startTime-${index}`}
            type="number"
            value={startTime}
            onChange={e => onStartTimeChange(index, e.target.value)}
            style={styles.miniInput}
            min={0}
            step="any"
            placeholder="0"
            aria-label={`Start time input for pitch graph ${index + 1}`}
          />
        </div>
        <div style={styles.miniInputGroup}>
          <label htmlFor={`endTime-${index}`} style={styles.miniLabel}>
            End Time (s)
          </label>
          <input
            id={`endTime-${index}`}
            type="number"
            value={endTime}
            onChange={e => onEndTimeChange(index, e.target.value)}
            style={styles.miniInput}
            min={0}
            step="any"
            placeholder="10"
            aria-label={`End time input for pitch graph ${index + 1}`}
          />
        </div>
        <div style={styles.miniInputGroup}>
          <label htmlFor={`tonic-${index}`} style={styles.miniLabel}>
            Tonic (Hz)
          </label>
          <input
            id={`tonic-${index}`}
            type="number"
            value={tonic}
            onChange={e => onTonicChange(index, e.target.value)}
            style={styles.miniInput}
            min={1}
            step="any"
            placeholder="e.g. 261.63"
            aria-label={`Tonic input for pitch graph ${index + 1}`}
          />
        </div>
      </div>

      <div style={styles.chartWrapper}>
        {graphType === 'victory' ? (
          filteredData.length > 0 ? (
            <VictoryChart
              theme={VictoryTheme.material}
              domain={{
                x: [Number(startTime), Number(endTime)],
                y: [
                  Math.min(...filteredData.map(d => d.y)),
                  Math.max(...filteredData.map(d => d.y))
                ]
              }}
              containerComponent={
                <VictoryVoronoiContainer
                  labels={({ datum }) => `Time: ${datum.x.toFixed(2)} s\nCents: ${datum.y.toFixed(2)}`}
                  labelComponent={<VictoryTooltip cornerRadius={4} flyoutStyle={{ fill: "white" }}/> }
                />
              }
              height={280}
              width={380}
              padding={{ top: 30, bottom: 60, left: 80, right: 20 }}
            >
              <VictoryAxis
                label="Time (s)"
                tickFormat={(tick) => `${tick.toFixed(2)}`}
                style={{ axisLabel: { padding: 40, fontWeight: 'bold' } }}
              />
              <VictoryAxis
                dependentAxis
                label={yAxisType === 'swaras' ? 'Swaras' : 'Cents'}
                tickValues={(() => {
                  const minY = Math.min(...filteredData.map(d => d.y));
                  const maxY = Math.max(...filteredData.map(d => d.y));
                  if (yAxisType === 'swaras') {
                    // Use filtered swara ticks for enough spacing
                    return getSwaraTicks(minY, maxY, 40, 220).map(t => t.value);
                  } else {
                    return getYTicks(minY, maxY, 5);
                  }
                })()}
                tickFormat={(y) => {
                  if (yAxisType === 'swaras') {
                    const ticks = getSwaraTicks(y, y, 40, 220);
                    const tick = ticks.find(t => t.value === y);
                    return tick ? tick.label : '';
                  } else {
                    return y.toFixed(1);
                  }
                }}
                style={{
                  axisLabel: { padding: 60, fontWeight: 'bold', textAnchor: 'end' },
                  tickLabels: { fontWeight: 600, fill: '#1e40af', textAnchor: 'end', dx: -18 },
                  grid: { stroke: "#a3a3a3", strokeDasharray: "4,4" }
                }}
                gridComponent={
                  <line
                    style={{
                      stroke: "#a3a3a3",
                      strokeDasharray: "4,4"
                    }}
                  />
                }
              />
              <VictoryLine
                data={filteredData}
                style={{
                  data: { stroke: "#4f46e5", strokeWidth: 3 },
                  parent: { border: "1px solid #ccc"}
                }}
                interpolation="monotoneX"
              />
            </VictoryChart>
          ) : (
            <p style={{ textAlign: 'center', color: '#6b7280', marginTop: 100 }}>
              Please upload a file and enter valid start/end times and tonic.
            </p>
          )
        ) : (
          <canvas ref={canvasRef} style={{ width: '100%', height: '280px' }} />
        )}
      </div>
      <div style={{ marginTop: 16, display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button style={styles.exportBtn} onClick={handleExportImage}>Export as Image</button>
        <button style={styles.exportBtn} onClick={handleExportPDF}>Export as PDF</button>
      </div>
    </section>
  );
};

const PitchGraphMulti = () => {
  const [numCards, setNumCards] = useState('');
  const [useSameFile, setUseSameFile] = useState(false);
  const [graphsData, setGraphsData] = useState([]);
  const [graphType, setGraphType] = useState('victory');
  const [yAxisType, setYAxisType] = useState('swaras');
  const [sharedFileData, setSharedFileData] = useState({ pitchData: [], fileName: '' });
  const pageRef = useRef(null);

  useEffect(() => {
    if (numCards && Number(numCards) > 0) {
      setGraphsData(
        Array(Number(numCards)).fill(null).map(() => ({
          pitchData: [],
          startTime: '',
          endTime: '',
          tonic: '',
          fileName: '',
        }))
      );
    } else {
      setGraphsData([]);
    }
  }, [numCards]);

  const onFileChange = (index, event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.name.match(/\.(txt|csv)$/i)) {
      alert('Unsupported file format. Please upload .txt or .csv files only.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = parsePitchData(e.target.result);
      if (data.length === 0) {
        alert('No valid pitch data found in the file.');
        return;
      }
      setGraphsData((prev) => {
        const updated = [...prev];
        updated[index] = {
          ...updated[index],
          pitchData: data,
          fileName: file.name,
        };
        return updated;
      });
      event.target.value = null;
    };
    reader.readAsText(file);
  };

  // For shared file
  const onSharedFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.name.match(/\.(txt|csv)$/i)) {
      alert('Unsupported file format. Please upload .txt or .csv files only.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = parsePitchData(e.target.result);
      if (data.length === 0) {
        alert('No valid pitch data found in the file.');
        return;
      }
      setSharedFileData({
        pitchData: data,
        fileName: file.name,
      });
      setGraphsData((prev) =>
        prev.map((g) => ({
          ...g,
          pitchData: data,
          fileName: file.name,
        }))
      );
      event.target.value = null;
    };
    reader.readAsText(file);
  };

  const onStartTimeChange = (index, value) => {
    setGraphsData((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], startTime: value };
      return updated;
    });
  };

  const onEndTimeChange = (index, value) => {
    setGraphsData((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], endTime: value };
      return updated;
    });
  };

  const onTonicChange = (index, value) => {
    setGraphsData((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], tonic: value };
      return updated;
    });
  };

  // Export the whole page as image
  const handleExportPageImage = async () => {
    if (pageRef.current) {
      const canvas = await html2canvas(pageRef.current, { backgroundColor: null });
      const link = document.createElement('a');
      link.download = `pitch-graphs-page.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  };

  // Export the whole page as PDF
  const handleExportPagePDF = async () => {
    if (pageRef.current) {
      const canvas = await html2canvas(pageRef.current, { backgroundColor: '#fff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`pitch-graphs-page.pdf`);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap');
        body, html {
          margin: 0; padding: 0;
          background: linear-gradient(135deg, #f0e5ff 0%, #e0f7fa 100%);
          font-family: 'Poppins', sans-serif;
          color: #374151;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          min-height: 100vh;
        }
        * { box-sizing: border-box; }
      `}</style>
      <main ref={pageRef} role="main" aria-label="Pitch graphs grid" style={styles.container}>
        <h1 style={styles.title}>Pitch Graph Viewer</h1>

        <div style={styles.centeredPrompt}>
          <label htmlFor="numCards" style={styles.selectLabel}>
            How many pitch cards do you need?
          </label>
          <input
            id="numCards"
            type="number"
            min={1}
            max={20}
            style={styles.miniInput}
            value={numCards}
            onChange={e => {
              // Allow empty string for clearing/backspace
              const val = e.target.value;
              if (val === '' || (Number(val) > 0 && Number(val) <= 20)) setNumCards(val);
            }}
            placeholder="Enter a number"
          />
          <label style={{ ...styles.selectLabel, marginLeft: 24 }}>
            Use the same file for all pitch cards?
          </label>
          <input
            type="checkbox"
            checked={useSameFile}
            onChange={e => setUseSameFile(e.target.checked)}
            style={{ width: 18, height: 18, verticalAlign: 'middle', marginLeft: 8 }}
          />
        </div>

        {useSameFile && (
          <div style={styles.centeredPrompt}>
            <label htmlFor="shared-file-input" style={styles.fileLabel}>
              Select Pitch File (.txt or .csv) for all cards
            </label>
            <input
              type="file"
              accept=".txt,.csv"
              id="shared-file-input"
              onChange={onSharedFileChange}
              style={{ marginLeft: 10 }}
            />
            {sharedFileData.fileName && (
              <div style={styles.fileName}>Loaded File: {sharedFileData.fileName}</div>
            )}
          </div>
        )}

        <div style={styles.centeredPrompt}>
          <label htmlFor="graphType" style={styles.selectLabel}>Select Graph Type: </label>
          <select
            id="graphType"
            value={graphType}
            onChange={e => setGraphType(e.target.value)}
            style={styles.select}
          >
            <option value="victory">Victory Chart</option>
            <option value="canvas">Canvas</option>
          </select>
          <label htmlFor="yAxisType" style={{ ...styles.selectLabel, marginLeft: 24 }}>
            Y Axis:
          </label>
          <select
            id="yAxisType"
            value={yAxisType}
            onChange={e => setYAxisType(e.target.value)}
            style={styles.select}
          >
            <option value="swaras">Swaras</option>
            <option value="cents">Cents</option>
          </select>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <button style={styles.exportBtn} onClick={handleExportPageImage}>Export Page as Image</button>
          <button style={styles.exportBtn} onClick={handleExportPagePDF}>Export Page as PDF</button>
        </div>

        <div style={styles.grid}>
          {graphsData.map(({ pitchData, startTime, endTime, tonic, fileName }, i) => (
            <PitchGraphCard
              key={i}
              index={i}
              pitchData={useSameFile ? sharedFileData.pitchData : pitchData}
              startTime={startTime}
              endTime={endTime}
              tonic={tonic}
              onFileChange={onFileChange}
              onStartTimeChange={onStartTimeChange}
              onEndTimeChange={onEndTimeChange}
              onTonicChange={onTonicChange}
              fileName={useSameFile ? sharedFileData.fileName : fileName}
              graphType={graphType}
              useSameFile={useSameFile}
              yAxisType={yAxisType}
            />
          ))}
        </div>
      </main>
    </>
  );
};

const styles = {
  container: {
    maxWidth: 1200,
    margin: '0 auto',
    padding: '3rem 1rem 4rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  title: {
    fontSize: 56,
    fontWeight: 800,
    color: '#1e40af',
    marginBottom: 48,
    userSelect: 'none',
    textAlign: 'center',
    textShadow: '0 2px 6px rgba(56, 58, 83, 0.15)',
  },
  centeredPrompt: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 12,
    margin: '24px 0',
    textAlign: 'center',
    width: '100%',
  },
  selectContainer: {
    textAlign: 'center',
    marginBottom: 30,
  },
  selectLabel: {
    fontSize: 18,
    marginRight: 10,
    fontWeight: '600',
  },
  select: {
    fontSize: 16,
    padding: '6px 12px',
    borderRadius: 8,
    border: '1.5px solid rgba(37, 99, 235, 0.7)',
    outlineOffset: 2,
    color: '#1e40af',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gridAutoRows: 'auto',
    gap: 36,
    justifyContent: 'center',
    width: '100%',
  },
  card: {
    backgroundColor: '#ffffffcc',
    borderRadius: 20,
    boxShadow: '0 12px 36px rgba(29, 78, 216, 0.18)',
    padding: '2.5rem 2rem 2rem',
    display: 'flex',
    flexDirection: 'column',
    userSelect: 'none',
    backdropFilter: 'blur(12px)',
    alignItems: 'center',
  },
  cardTitle: {
    fontWeight: 700,
    fontSize: 24,
    color: '#1e40af',
    marginBottom: 24,
    userSelect: 'text',
    letterSpacing: '0.04em',
    textShadow: '0 1px 2px rgba(29, 78, 216, 0.8)',
    textAlign: 'center',
    width: '100%',
  },
  fileLabel: {
    fontWeight: 600,
    fontSize: 15,
    color: '#2563eb',
    cursor: 'pointer',
    userSelect: 'none',
    marginRight: 12,
    display: 'inline-block',
  },
  controlsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
  },
  miniInputGroup: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  miniLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: '#1e3a8a',
    marginBottom: 4,
    userSelect: 'none',
    textAlign: 'center',
  },
  miniInput: {
    fontSize: 14,
    padding: '6px 10px',
    borderRadius: 8,
    border: '1.5px solid rgba(37, 99, 235, 0.7)',
    outlineOffset: 2,
    color: '#1e40af',
    width: 110,
    textAlign: 'center',
  },
  fileName: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#2563eb',
    marginTop: 4,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    textAlign: 'center',
    width: '100%',
  },
  chartWrapper: {
    flexGrow: 1,
    borderRadius: 30,
    overflow: 'hidden',
    height: 280,
    border: '1.5px solid #3b82f6',
    backgroundColor: '#eef4ffcc',
    boxShadow: '0 6px 20px rgba(59, 130, 246, 0.4)',
    width: 380,
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportBtn: {
    background: '#4f46e5',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 18px',
    fontWeight: 600,
    fontSize: 15,
    cursor: 'pointer',
    marginRight: 6,
    marginBottom: 4,
    boxShadow: '0 2px 8px rgba(79, 70, 229, 0.12)'
  }
};

export default PitchGraphMulti;