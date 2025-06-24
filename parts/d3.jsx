import React, { useState, useRef, useEffect } from 'react';
import * as d3 from 'd3';

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
    data.push({ time: t * 1000, pitch: p }); // convert seconds to ms
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
  const svgRef = useRef(null);
  const width = 400;
  const height = 280;
  const margin = { top: 35, right: 20, bottom: 45, left: 50 };

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous drawings

    if (!pitchData?.length) {
      svg.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .style('fill', '#6b7280')
        .style('font-size', '16px')
        .text('No pitch data loaded');
      return;
    }
    if (
      startTime === '' || endTime === '' ||
      isNaN(startTime) || isNaN(endTime) ||
      Number(startTime) >= Number(endTime)
    ) {
      svg.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .style('fill', '#9b2c2c')
        .style('font-size', '16px')
        .text('Enter valid start/end time range');
      return;
    }

    const start = Number(startTime);
    const end = Number(endTime);

    let filtered = pitchData.filter(p => p.time >= start && p.time <= end);
    if (filtered.length === 0) {
      // Round to nearest available data
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
    }

    const pitches = filtered.map(p => p.pitch).filter(p => p > 0);
    if (pitches.length === 0) {
      svg.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .style('fill', '#555')
        .style('font-size', '16px')
        .text('No valid pitch data');
      return;
    }

    const pitchMin = d3.min(pitches);
    const pitchMax = d3.max(pitches);

    // Scales
    const x = d3.scaleLinear()
      .domain([start, end])
      .range([margin.left, width - margin.right]);
    const y = d3.scaleLinear()
      .domain([pitchMin, pitchMax])
      .range([height - margin.bottom, margin.top]);

    // X and Y axes
    const xAxis = g => g
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(d => `${Math.round(d)} ms`))
      .call(g => g.append('text')
        .attr('x', width / 2)
        .attr('y', 40)
        .attr('fill', '#374151')
        .attr('text-anchor', 'middle')
        .attr('font-weight', 'bold')
        .text('Time (ms)'));

    const yAxis = g => g
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(6))
      .call(g => g.append('text')
        .attr('x', -margin.left)
        .attr('y', margin.top - 15)
        .attr('fill', '#374151')
        .attr('text-anchor', 'start')
        .attr('font-weight', 'bold')
        .text('Pitch (Hz)'));

    svg.append('g').call(xAxis);
    svg.append('g').call(yAxis);

    // Grid lines
    svg.append('g')
      .attr('stroke', '#cbd5e1')
      .attr('stroke-opacity', 0.3)
      .call(d3.axisLeft(y)
        .ticks(5)
        .tickSize(-width + margin.left + margin.right)
        .tickFormat(''));
    svg.append('g')
      .attr('stroke', '#cbd5e1')
      .attr('stroke-opacity', 0.3)
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x)
        .ticks(8)
        .tickSize(-height + margin.top + margin.bottom)
        .tickFormat(''));

    // Line generator
    const line = d3.line()
      .x(d => x(d.time))
      .y(d => y(d.pitch))
      .curve(d3.curveMonotoneX);

    // Draw line
    svg.append('path')
      .datum(filtered)
      .attr('fill', 'none')
      .attr('stroke', '#4f46e5')
      .attr('stroke-width', 3)
      .attr('d', line);

    // Draw points
    svg.selectAll('circle')
      .data(filtered)
      .join('circle')
      .attr('cx', d => x(d.time))
      .attr('cy', d => y(d.pitch))
      .attr('r', 5)
      .attr('fill', '#4f46e5')
      .style('filter', 'drop-shadow(0 0 4px rgba(79, 70, 229, 0.6)'); // Removed the semicolon here

  }, [pitchData, startTime, endTime]);

  const handleStartChange = (e) => onStartTimeChange(index, e.target.value);
  const handleEndChange = (e) => onEndTimeChange(index, e.target.value);
  const handleFileChangeLocal = (e) => onFileChange(index, e);

  return (
    <section style={styles.card} aria-label={`Pitch Graph section ${index + 1}`}>
      <h2 style={styles.cardTitle}>Pitch Graph {index + 1}</h2>

      <label htmlFor={`file-input-${index}`} style={styles.fileLabel}>
        Select Pitch File (.txt or .csv)
      </label>
      <input
        type="file"
        accept=".txt,.csv"
        id={`file-input-${index}`}
        onChange={handleFileChangeLocal}
        style={styles.fileInput}
        aria-label={`File upload input for pitch graph ${index + 1}`}
      />

      <div style={styles.controlsRow}>
        <div style={styles.miniInputGroup}>
          <label htmlFor={`startTime-${index}`} style={styles.miniLabel}>
            Start Time (ms)
          </label>
          <input
            id={`startTime-${index}`}
            type="number"
            value={startTime}
            onChange={handleStartChange}
            style={styles.miniInput}
            min={0}
            step="any"
            placeholder="0"
            aria-label={`Start time input for pitch graph ${index + 1}`}
          />
        </div>

        <div style={styles.miniInputGroup}>
          <label htmlFor={`endTime-${index}`} style={styles.miniLabel}>
            End Time (ms)
          </label>
          <input
            id={`endTime-${index}`}
            type="number"
            value={endTime}
            onChange={handleEndChange}
            style={styles.miniInput}
            min={0}
            step="any"
            placeholder="10000"
            aria-label={`End time input for pitch graph ${index + 1}`}
          />
        </div>
      </div>

      <svg ref={svgRef} width={width} height={height} style={styles.canvas}></svg>
    </section>
  );
};

const PitchGraphMulti = () => {
  const [graphsData, setGraphsData] = React.useState(
    Array(6).fill(null).map(() => ({
      pitchData: [],
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
          startTime: '',
          endTime: '',
          fileName: file.name,
        };
        return updated;
      });
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
    marginRight: 12,
  },
  controlsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  miniInputGroup: {
    display: 'flex',
    flexDirection: 'column',
  },
  miniLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: '#1e3a8a',
    marginBottom: 4,
    userSelect: 'none',
  },
  miniInput: {
    fontSize: 14,
    padding: '6px 10px',
    borderRadius: 8,
    border: '1.5px solid rgba(37, 99, 235, 0.7)',
    outlineOffset: 2,
    color: '#1e40af',
    width: 110,
  },
  fileName: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#2563eb',
    marginTop: 4,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  canvasWrapper: {
    flexGrow: 1,
    borderRadius: 30,
    overflow: 'hidden',
    height: 300,
    border: '1.5px solid #3b82f6',
    backgroundColor: '#eef4ffcc',
    boxShadow: '0 6px 20px rgba(59, 130, 246, 0.4)',
  },
  canvas: {
    width: '100%',
    height: '100%',
    display: 'block',
  },
};

export default PitchGraphMulti;
