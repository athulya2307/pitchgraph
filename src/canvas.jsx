import React, { useState, useRef, useEffect } from 'react';

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
    data.push({ time: t * 1000, pitch: p }); // seconds to ms
  }
  data.sort((a, b) => a.time - b.time);
  return data;
};

const PitchGraphCard = ({
  index,
  pitchData,
  startTime,
  endTime,
  onFileChange,
  onStartTimeChange,
  onEndTimeChange,
  fileName,
}) => {
  const canvasRef = useRef(null);

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

    if (!pitchData?.length) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '16px "Poppins", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No pitch data loaded', w / 2, h / 2);
      return;
    }
    if (
      startTime === '' || endTime === '' ||
      isNaN(startTime) || isNaN(endTime) ||
      Number(startTime) >= Number(endTime)
    ) {
      ctx.fillStyle = '#9b2c2c';
      ctx.font = '16px "Poppins", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Enter valid start/end time range', w / 2, h / 2);
      return;
    }
    const start = Number(startTime);
    const end = Number(endTime);

    // Filter or round to nearest if no data in range
    let filtered = pitchData.filter(p => p.time >= start && p.time <= end);
    let rounded = false;
    if (filtered.length === 0) {
      const times = pitchData.map(p => p.time);
      const nearestStartIndex = times.reduce((prev, curr, idx) =>
        Math.abs(curr - start) < Math.abs(times[prev] - start) ? idx : prev,
        0);
      const nearestEndIndex = times.reduce((prev, curr, idx) =>
        Math.abs(curr - end) < Math.abs(times[prev] - end) ? idx : prev,
        0);
      const lowIndex = Math.min(nearestStartIndex, nearestEndIndex);
      const highIndex = Math.max(nearestStartIndex, nearestEndIndex);
      filtered = pitchData.slice(lowIndex, highIndex + 1);
      rounded = true;
    }

    const pitches = filtered.map(p => p.pitch).filter(p => p > 0);
    if (pitches.length === 0) {
      ctx.fillStyle = '#555';
      ctx.font = '16px "Poppins", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No valid pitch data', w / 2, h / 2);
      return;
    }
    const pitchMin = Math.min(...pitches);
    const pitchMax = Math.max(...pitches);

    const marginLeft = 50;
    const marginRight = 20;
    const marginTop = 35;
    const marginBottom = 45;
    const drawWidth = w - marginLeft - marginRight;
    const drawHeight = h - marginTop - marginBottom;

    // Background (glassmorphism subtle)
    ctx.fillStyle = 'rgba(255 255 255 / 0.8)';
    ctx.fillRect(marginLeft, marginTop, drawWidth, drawHeight);

    // Axis lines - subtle and modern
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(marginLeft, marginTop);
    ctx.lineTo(marginLeft, marginTop + drawHeight);
    ctx.lineTo(marginLeft + drawWidth, marginTop + drawHeight);
    ctx.stroke();

    // Y axis ticks & guides
    ctx.fillStyle = '#4b5563'; // subtle dark gray
    ctx.font = '11px "Poppins", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const yVal = pitchMin + ((pitchMax - pitchMin) * i) / yTicks;
      const yPos = marginTop + drawHeight - (drawHeight * i) / yTicks;
      ctx.fillText(yVal.toFixed(1), marginLeft - 10, yPos);
      ctx.strokeStyle = 'rgba(156,163,175,0.15)';
      ctx.beginPath();
      ctx.moveTo(marginLeft, yPos);
      ctx.lineTo(marginLeft + drawWidth, yPos);
      ctx.stroke();
    }

    // X axis ticks & guides
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const xTicks = 6;
    for (let i = 0; i <= xTicks; i++) {
      const xVal = start + ((end - start) * i) / xTicks;
      const xPos = marginLeft + (drawWidth * i) / xTicks;
      ctx.fillStyle = '#4b5563';
      ctx.fillText(Math.round(xVal), xPos, marginTop + drawHeight + 10);
      ctx.strokeStyle = 'rgba(156,163,175,0.15)';
      ctx.beginPath();
      ctx.moveTo(xPos, marginTop);
      ctx.lineTo(xPos, marginTop + drawHeight);
      ctx.stroke();
    }

    // Gradient pitch line
    const gradient = ctx.createLinearGradient(marginLeft, marginTop, marginLeft, marginTop + drawHeight);
    gradient.addColorStop(0, '#3b82f6');
    gradient.addColorStop(1, '#2563eb');
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath(); 
    filtered.forEach((pt, i) => {
      const x = marginLeft + ((pt.time - start) / (end - start)) * drawWidth;
      const y = marginTop + drawHeight - ((pt.pitch - pitchMin) / (pitchMax - pitchMin)) * drawHeight;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Axis labels with subtle shadow
    ctx.fillStyle = '#374151';
    ctx.font = '14px "Poppins", monospace';
    ctx.textAlign = 'left';
    ctx.shadowColor = 'rgba(0,0,0,0.05)';
    ctx.shadowBlur = 2;
    ctx.fillText('Pitch vs Time', marginLeft, marginTop - 12);

    ctx.fillText('Time (ms)', marginLeft + drawWidth / 2, marginTop + drawHeight + 38);

    ctx.save();
    ctx.translate(marginLeft - 45, marginTop + drawHeight / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Pitch (Hz)', 0, 0);
    ctx.restore();

    if (rounded) {
      ctx.font = '12px "Poppins", monospace';
      ctx.fillStyle = '#2563eb';
      ctx.textAlign = 'right';
      ctx.fillText('Rounded to nearest points', w - 15, h - 15);
    }
  };

  useEffect(() => {
    drawGraph();
  }, [pitchData, startTime, endTime]);

  const handleStartChange = (e) => onStartTimeChange(index, e.target.value);
  const handleEndChange = (e) => onEndTimeChange(index, e.target.value);
  const handleFileChangeLocal = (e) => onFileChange(index, e);

  return (
    <section aria-label={`Pitch Graph section ${index + 1}`} style={styles.card}>
      <h2 style={styles.cardTitle}>Pitch Graph {index + 1}</h2>

      <label htmlFor={`file-${index}`} style={styles.fileLabel}>
        Select Pitch File (.txt or .csv)
      </label>
      <input
        type="file"
        accept=".txt,.csv"
        id={`file-${index}`}
        onChange={handleFileChangeLocal}
        style={styles.fileInput}
        aria-label={`File upload input for pitch graph ${index + 1}`}
      />

      <div style={styles.inputsColumn}>
        <label htmlFor={`startTime-${index}`} style={styles.label}>
          Start Time (ms)
        </label>
        <input
          id={`startTime-${index}`}
          type="number"
          value={startTime}
          onChange={handleStartChange}
          style={styles.numberInput}
          min={0}
          step="any"
          placeholder="0"
          aria-label={`Start time input for pitch graph ${index + 1}`}
        />

        <label htmlFor={`endTime-${index}`} style={{ ...styles.label, marginTop: 20 }}>
          End Time (ms)
        </label>
        <input
          id={`endTime-${index}`}
          type="number"
          value={endTime}
          onChange={handleEndChange}
          style={styles.numberInput}
          min={0}
          step="any"
          placeholder="10000"
          aria-label={`End time input for pitch graph ${index + 1}`}
        />
      </div>

      {fileName && (
        <div style={styles.fileName} title={fileName}>
          Loaded File: {fileName}
        </div>
      )}

      <div style={styles.canvasWrapper}>
        <canvas
          ref={canvasRef}
          style={styles.canvas}
          aria-label={`Pitch graph canvas for section ${index + 1}`}
        />
      </div>
    </section>
  );
};

const PitchGraphMulti = () => {
  const [graphsData, setGraphsData] = useState(
    Array(6).fill(null).map(() => ({ data: null, startTime: '', endTime: '', fileName: '' }))
  );

  const onFileChange = (index, event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.name.match(/\.(txt|csv)$/i)) {
      alert('Unsupported file format. Please upload .txt or .csv files only.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const pitchData = parsePitchData(e.target.result);
      if (pitchData.length === 0) {
        alert('No valid pitch data found in the file.');
        return;
      }
      setGraphsData(prev => {
        const newGraphs = [...prev];
        newGraphs[index] = {
          data: pitchData,
          startTime: String(Math.floor(pitchData[0].time)),
          endTime: String(Math.ceil(pitchData[pitchData.length - 1].time)),
          fileName: file.name,
        };
        return newGraphs;
      });
      event.target.value = null;
    };
    reader.readAsText(file);
  };

  const onStartTimeChange = (index, value) => {
    setGraphsData(prev => {
      const newGraphs = [...prev];
      if (newGraphs[index]) {
        newGraphs[index] = { ...newGraphs[index], startTime: value };
      }
      return newGraphs;
    });
  };

  const onEndTimeChange = (index, value) => {
    setGraphsData(prev => {
      const newGraphs = [...prev];
      if (newGraphs[index]) {
        newGraphs[index] = { ...newGraphs[index], endTime: value };
      }
      return newGraphs;
    });
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap');
        body, html {
          margin: 0; padding: 0;
          background: linear-gradient(135deg, #e0f2fe 0%, #fef9c3 100%);
          font-family: 'Poppins', sans-serif;
          color: #374151;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          min-height: 100vh;
        }
        * {
          box-sizing: border-box;
        }
        ::-webkit-scrollbar {
          width: 10px;
        }
        ::-webkit-scrollbar-thumb {
          background-color: rgba(37, 99, 235, 0.4);
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background-color: rgba(37, 99, 235, 0.7);
        }
      `}</style>
      <main style={styles.container} role="main" aria-label="Pitch graphs 2 by 3 grid">
        <h1 style={styles.title}>Pitch Graph Viewer</h1>
        <div style={styles.grid}>
          {graphsData.map(({ data, startTime, endTime, fileName }, i) => (
            <PitchGraphCard
              key={i}
              index={i}
              pitchData={data}
              startTime={startTime}
              endTime={endTime}
              onFileChange={onFileChange}
              onStartTimeChange={onStartTimeChange}
              onEndTimeChange={onEndTimeChange}
              fileName={fileName}
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
  },
  title: {
    fontSize: 56,
    fontWeight: 800,
    color: '#1e40af', // Indigo-800
    marginBottom: 48,
    userSelect: 'none',
    textAlign: 'center',
    textShadow: '0 2px 6px rgba(56, 58, 83, 0.15)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gridAutoRows: 'auto',
    gap: 36,
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
  },
  cardTitle: {
    fontWeight: 700,
    fontSize: 24,
    color: '#1e40af',
    marginBottom: 24,
    userSelect: 'text',
    letterSpacing: '0.04em',
    textShadow: '0 1px 2px rgba(29, 78, 216, 0.8)',
  },
  fileLabel: {
    fontWeight: 600,
    fontSize: 15,
    color: '#2563eb', // Indigo-600
    cursor: 'pointer',
    userSelect: 'none',
    marginBottom: 11,
  },
  fileInput: {
    marginBottom: 20,
    cursor: 'pointer',
  },
  inputsColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: 600,
    color: '#1e3a8a', // Indigo-900
    display: 'block',
    userSelect: 'none',
  },
  numberInput: {
    fontSize: 16,
    padding: '10px 16px',
    borderRadius: 14,
    border: '1.5px solid rgba(37, 99, 235, 0.7)',
    outlineOffset: 3,
    color: '#1e40af', // Indigo-800
    transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
    boxShadow: 'inset 0 1px 4px rgba(37, 99, 235, 0.25)',
  },
  fileName: {
    fontSize: 13,
    color: '#2563eb',
    fontStyle: 'italic',
    marginBottom: 14,
    userSelect: 'text',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  canvasWrapper: {
    flexGrow: 1,
    borderRadius: 20,
    overflow: 'hidden',
    height: 300,
    border: '1.5px solid #3b82f6', /* Indigo-500 */
    backgroundColor: '#eef4ffcc',
    boxShadow: '0 6px 20px rgba(59, 130, 246, 0.4)',
    transition: 'box-shadow 0.2s ease',
  },
  canvas: {
    width: '100%',
    height: '100%',
    display: 'block',
  },
};

export default PitchGraphMulti;
