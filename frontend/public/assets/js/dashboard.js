/*user dashboard*/
/* ===========================
   SYNC CARD - DASHBOARD JS
=========================== */

document.addEventListener('DOMContentLoaded', function () {

  // ---- ANALYTICS CHART ----
  const ctx = document.getElementById('analyticsChart');
  if (ctx) {
    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 200);
    gradient.addColorStop(0, 'rgba(230, 57, 70, 0.35)');
    gradient.addColorStop(1, 'rgba(230, 57, 70, 0.0)');

    const labels = ['May 10','May 16','May 22','May 28','Jun 3','Jun 9'];
    const data = [600, 900, 750, 1200, 1000, 1600, 1300, 1800, 1500, 2100, 1900, 2184];
    const fullLabels = ['May 10','May 12','May 14','May 16','May 18','May 20','May 22','May 24','May 26','May 28','Jun 3','Jun 9'];

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: fullLabels,
        datasets: [{
          label: 'Views',
          data: data,
          borderColor: '#e63946',
          borderWidth: 2.5,
          backgroundColor: gradient,
          pointBackgroundColor: '#e63946',
          pointBorderColor: '#0d0d0d',
          pointBorderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 5,
          tension: 0.4,
          fill: true,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1a1a1a',
            borderColor: 'rgba(230,57,70,0.3)',
            borderWidth: 1,
            titleColor: '#a0a0a0',
            bodyColor: '#ffffff',
            padding: 10,
            callbacks: {
              title: (items) => items[0].label,
              label: (item) => ` Views   ${item.raw.toLocaleString()}`,
              labelColor: () => ({ backgroundColor: '#e63946', borderColor: '#e63946' })
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
            ticks: {
              color: '#5a5a5a',
              font: { size: 10, family: 'Inter' },
              maxTicksLimit: 6,
            },
            border: { display: false }
          },
          y: {
            grid: { color: 'rgba(255,255,255,0.04)', drawBorder: false },
            ticks: {
              color: '#5a5a5a',
              font: { size: 10, family: 'Inter' },
              callback: v => v >= 1000 ? (v/1000).toFixed(1)+'K' : v,
              maxTicksLimit: 5,
            },
            border: { display: false },
            min: 0
          }
        }
      }
    });
  }

  // ---- SPARKLINE CHARTS ----
  function drawSparkline(canvasId, dataPoints, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx2 = canvas.getContext('2d');
    const w = canvas.width; const h = canvas.height;
    const max = Math.max(...dataPoints);
    const min = Math.min(...dataPoints);
    const range = max - min || 1;

    const grad = ctx2.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, color + '55');
    grad.addColorStop(1, color + '00');

    const pts = dataPoints.map((v, i) => ({
      x: (i / (dataPoints.length - 1)) * w,
      y: h - ((v - min) / range) * (h - 4) - 2
    }));

    // Fill
    ctx2.beginPath();
    ctx2.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const cp = { x: (pts[i-1].x + pts[i].x) / 2, y: pts[i-1].y };
      const cp2 = { x: (pts[i-1].x + pts[i].x) / 2, y: pts[i].y };
      ctx2.bezierCurveTo(cp.x, cp.y, cp2.x, cp2.y, pts[i].x, pts[i].y);
    }
    ctx2.lineTo(w, h); ctx2.lineTo(0, h); ctx2.closePath();
    ctx2.fillStyle = grad; ctx2.fill();

    // Line
    ctx2.beginPath();
    ctx2.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const cp = { x: (pts[i-1].x + pts[i].x) / 2, y: pts[i-1].y };
      const cp2 = { x: (pts[i-1].x + pts[i].x) / 2, y: pts[i].y };
      ctx2.bezierCurveTo(cp.x, cp.y, cp2.x, cp2.y, pts[i].x, pts[i].y);
    }
    ctx2.strokeStyle = color;
    ctx2.lineWidth = 2;
    ctx2.stroke();
  }

  const red = '#e63946';
  drawSparkline('spark1', [40,55,45,70,60,80,75,95,85,110,90,120], red);
  drawSparkline('spark2', [30,50,40,60,55,75,65,90,80,100,95,115], red);
  drawSparkline('spark3', [50,45,60,55,70,65,80,75,90,85,100,95], red);
  drawSparkline('spark4', [35,55,45,65,60,75,70,90,85,105,100,120], red);

});