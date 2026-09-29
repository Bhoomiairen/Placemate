import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Tooltip);
ChartJS.defaults.font.family = 'Inter, ui-sans-serif, system-ui, sans-serif';
ChartJS.defaults.color = '#64748b'; // slate-500 for axis text

const BRAND = '#0d9488';
const GRID = '#f1f5f9';
const tooltip = { backgroundColor: '#0f172a', padding: 10, cornerRadius: 6, displayColors: false };

/** Horizontal bars: how many eligible drives ask for each skill your resume doesn't show. */
export function SkillGapChart({ gaps, total }) {
  const data = {
    labels: gaps.map((g) => g.skill),
    datasets: [{ data: gaps.map((g) => g.count), backgroundColor: BRAND, borderRadius: 4, borderSkipped: 'start', barThickness: 14 }],
  };
  const options = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { ...tooltip, callbacks: { label: (c) => `Asked by ${c.raw} of ${total} drives (${Math.round((c.raw / total) * 100)}%)` } },
    },
    scales: {
      x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: GRID }, border: { display: false }, title: { display: true, text: 'Drives asking for it' } },
      y: { grid: { display: false }, border: { display: false }, ticks: { color: '#334155' } },
    },
  };
  return (
    <div style={{ height: Math.max(160, gaps.length * 30 + 50) }}>
      <Bar data={data} options={options} aria-label="Missing skills by number of drives" role="img" />
    </div>
  );
}

/** ATS score after each resume upload. */
export function AtsHistoryChart({ history }) {
  const data = {
    labels: history.map((h) => new Date(h.uploadedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })),
    datasets: [{ data: history.map((h) => h.atsScore), borderColor: BRAND, backgroundColor: BRAND, borderWidth: 2, pointRadius: 4, pointHoverRadius: 6, tension: 0 }],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { display: false }, tooltip: { ...tooltip, callbacks: { label: (c) => `ATS score: ${c.raw}` } } },
    scales: {
      y: { min: 0, max: 100, ticks: { stepSize: 25 }, grid: { color: GRID }, border: { display: false } },
      x: { grid: { display: false }, border: { display: false } },
    },
  };
  return (
    <div className="h-48">
      <Line data={data} options={options} aria-label="ATS score history" role="img" />
    </div>
  );
}
