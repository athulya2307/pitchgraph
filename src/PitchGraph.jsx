import React, { useState } from "react";
import Papa from "papaparse";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";

const PitchGraph = () => {
  const [pitchData, setPitchData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (event) => {
      const fileContent = event.target.result;

      // Parse the text as CSV using PapaParse
      const result = Papa.parse(fileContent, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
      });

      const data = result.data.filter(
        (row) => row.time != null && row.pitch != null
      );
      setPitchData(data);
    };

    reader.readAsText(file);
  };

  const handleFilter = () => {
    const start = parseFloat(startTime);
    const end = parseFloat(endTime);
    if (!isNaN(start) && !isNaN(end)) {
      const filtered = pitchData.filter(
        (d) => d.time >= start && d.time <= end
      );
      setFilteredData(filtered);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <input type="file" accept=".txt" onChange={handleFileChange} />
        <input
          type="number"
          placeholder="Start Time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
        />
        <input
          type="number"
          placeholder="End Time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
        />
        <button onClick={handleFilter}>Show Graph</button>
      </div>

      {filteredData.length > 0 ? (
        <LineChart
          width={800}
          height={400}
          data={filteredData}
          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
        >
          <XAxis dataKey="time" label={{ value: "Time (s)", position: "insideBottomRight", offset: -5 }} />
          <YAxis label={{ value: "Pitch", angle: -90, position: "insideLeft" }} />
          <Tooltip />
          <CartesianGrid strokeDasharray="3 3" />
          <Line type="monotone" dataKey="pitch" stroke="#8884d8" dot={false} />
        </LineChart>
      ) : (
        <p>No data to display. Upload a pitch file and select time range.</p>
      )}
    </div>
  );
};

export default PitchGraph;
