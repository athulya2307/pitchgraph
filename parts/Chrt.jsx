import React, { useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  TimeScale,
} from 'chart.js';
import 'chartjs-adapter-date-fns';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  TimeScale
);

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
  // Filter pitchData based on start and end times
  const filteredData = (() => {
    if (!startTime || !endTime) return [];
    const s = Number(startTime);
    const e = Number(endTime);
    if (isNaN(s) || isNaN(e) || s >= e) return [];
    return pitchData.filter((p) => p.time >= s && p.time <= e);
  })();

  // Chart.js data and options
  const data = {
    datasets: [
      {
        label: 'Pitch (Hz)',
        data: filteredData.map((p) => ({ x: p.time, y: p.pitch })),
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        pointRadius: 5,
        pointHoverRadius: 7,
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const options = {
    responsive: true,
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'second',
          tooltipFormat: 'MMM d, HH:mm:ss.SSS',
          displayFormats: {
            second: 's.SSS',
          },
        },
        title: {
          display: true,
          text: 'Time (ms)',
          font: { size: 14, weight: 'bold' },
        },
        ticks: {
          maxRotation: 0,
          autoSkipPadding: 20,
        },
      },
      y: {
        beginAtZero: false,
        title: {
          display: true,
          text: 'Pitch (Hz)',
          font: { size: 14, weight: 'bold' },
        },
      },
    },
    plugins: {
      tooltip: {
        intersect: false,
        mode: 'nearest',
        callbacks: {
          label: (context) => `Pitch: ${context.parsed.y.toFixed(2)} Hz`,
          title: (context) => `Time: ${context[0].parsed.x.toFixed(0)} ms`,
        },
      },
      legend: {
        display: false,
      },
    },
  };

  return (
    <section style={styles.card} aria-label={`Pitch Graph ${index + 1}`}>
      <h2 style={styles.cardTitle}>Pitch Graph {index + 1}</h2>

      <label htmlFor={`file-input-${index}`} style={styles.fileLabel}>
        Select Pitch File (.txt or .csv)
      </label>
      <input
        type="file"
        accept=".txt,.csv"
        id={`file-input-${index}`}
        onChange={(e) => onFileChange(index, e)}
        style={{ display: 'none' }}
        aria-label={`File upload input for pitch graph ${index + 1}`}
      />
      {fileName && <div style={styles.fileName}>Loaded File: {fileName}</div>}

      <div style={styles.inputsColumn}>
        <label htmlFor={`startTime-${index}`} style={styles.label}>
          Start Time (ms)
        </label>
        <input
          id={`startTime-${index}`}
          type="number"
          value={startTime}
          onChange={(e) => onStartTimeChange(index, e.target.value)}
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
          onChange={(e) => onEndTimeChange(index, e.target.value)}
          style={styles.numberInput}
          min={0}
          step="any"
          placeholder="10000"
          aria-label={`End time input for pitch graph ${index + 1}`}
        />
      </div>

      <div style={styles.chartWrapper}>
        {filteredData.length > 0 ? (
          <Line data={data} options={options} />
        ) : (
          <p style={{ textAlign: 'center', color: '#6b7280', marginTop: 100 }}>
            Please enter valid start and end times to see the graph.
          </p>
        )}
      </div>
    </section>
  );
};

const PitchGraphMulti = () => {
  const [graphsData, setGraphsData] = useState(
    Array(6).fill(null).map(() => ({
      pitchData: null,
      startTime: '',
      endTime: '',
      fileName: '',
    })),
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
      const data = parsePitchData(e.target.result);
      if (data.length === 0) {
        alert('No valid pitch data found in the file.');
        return;
      }
      setGraphsData((prev) => {
        const updated = [...prev];
        updated[index] = {
          pitchData: data,
          startTime: String(Math.floor(data[0].time)),
          endTime: String(Math.ceil(data[data.length - 1].time)),
          fileName: file.name,
        };
        return updated;
      });
      event.target.value = null; // Reset file input
    };
    reader.readAsText(file);
  };

  const onStartTimeChange = (index, value) => {
    setGraphsData((prev) => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = { ...updated[index], startTime: value };
      }
      return updated;
    });
  };

  const onEndTimeChange = (index, value) => {
    setGraphsData((prev) => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = { ...updated[index], endTime: value };
      }
      return updated;
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
      `}</style>
      <main style={styles.container} role="main" aria-label="Pitch graphs 2 by 3 grid">
        <h1 style={styles.title}>Pitch Graph Viewer</h1>
        <div style={styles.grid}>
          {graphsData.map(({ pitchData, startTime, endTime, fileName }, i) => (
            <PitchGraphCard
              key={i}
              index={i}
              pitchData={pitchData}
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
    color: '#1e40af',
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
    color: '#2563eb',
    cursor: 'pointer',
    userSelect: 'none',
    marginBottom: 11,
  },
  numberInput: {
    fontSize: 16,
    padding: '10px 16px',
    borderRadius: 14,
    border: '1.5px solid rgba(37, 99, 235, 0.7)',
    outlineOffset: 3,
    color: '#1e40af',
    transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
    boxShadow: 'inset 0 1px 4px rgba(37, 99, 235, 0.25)',
    maxWidth: '120px',
  },
  inputsColumn: {
    display: 'flex',
    gap: 12,
    marginBottom: 24,
    alignItems: 'flex-end',
  },
  label: {
    fontSize: 15,
    fontWeight: 600,
    color: '#1e3a8a',
    display: 'block',
    marginBottom: 4,
    userSelect: 'none',
  },
  chartWrapper: {
    flexGrow: 1,
    borderRadius: 30,
    overflow: 'hidden',
    height: 300,
    border: '1.5px solid #3b82f6',
    backgroundColor: '#eef4ffcc',
    boxShadow: '0 6px 20px rgba(59, 130, 246, 0.4)',
    transition: 'box-shadow 0.2s ease',
  },
  fileName: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#2563eb',
    marginTop: '0.25rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
};

export default PitchGraphMulti;
