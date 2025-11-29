// Configuración inicial
let currentTemperatura = '25';
let currentMedio = 'limitado';
let currentModelo = 'lineal';
let currentModeloFase1 = 'exponencial';
let currentModeloFase2 = 'lineal';
let chartInstance = null;
let combinedChartInstance = null;
let datos = [];

const modelos = {
  lineal: { name: "Lineal", color: "#000000ff" },
  cuadratico: { name: "Polinomica de 2° orden", color: "#000000ff" },
  exponencial: { name: "Exponencial", color: "#080600ff" },
  potencial: { name: "Potencial", color: "#000202ff" }
};

// Funciones de ajuste
function sum(arr) { return arr.reduce((a, b) => a + b, 0); }
function mean(arr) { return sum(arr) / arr.length; }

function linearFit(xs, ys) {
  const n = xs.length;
  const Sx = sum(xs), Sy = sum(ys);
  const Sxx = sum(xs.map(x => x*x));
  const Sxy = sum(xs.map((x,i)=>x*ys[i]));
  const b = (n*Sxy - Sx*Sy) / (n*Sxx - Sx*Sx);
  const a = (Sy - b*Sx) / n;
  const yhat = xs.map(x => a + b*x);
  const ybar = mean(ys);
  const SSE = sum(ys.map((y,i)=> (y - yhat[i])**2));
  const SST = sum(ys.map(y=> (y - ybar)**2));
  const R2 = 1 - SSE/SST;
  const R2adj = 1 - (SSE/(n-2)) / (SST/(n-1));
  const error = Math.sqrt(SSE/(n-2));
  
  return { 
    a, b, R2, R2adj, error,
    predict: x => a + b*x,
    ecuacion: `y = ${a.toFixed(4)} + ${b.toFixed(4)}x`
  };
}

function quadFit(xs, ys) {
  const n = xs.length;
  const X = xs.map(x => [1, x, x*x]);
  const Y = ys;
  
  let XtX = [[0,0,0],[0,0,0],[0,0,0]];
  let XtY = [0,0,0];
  
  for (let i = 0; i < n; i++) {
    const xi = X[i];
    for (let j = 0; j < 3; j++) {
      for (let k = 0; k < 3; k++) {
        XtX[j][k] += xi[j] * xi[k];
      }
      XtY[j] += xi[j] * Y[i];
    }
  }
  
  // Resolver sistema
  const det = XtX[0][0]*(XtX[1][1]*XtX[2][2]-XtX[1][2]*XtX[2][1]) -
             XtX[0][1]*(XtX[1][0]*XtX[2][2]-XtX[1][2]*XtX[2][0]) +
             XtX[0][2]*(XtX[1][0]*XtX[2][1]-XtX[1][1]*XtX[2][0]);
  
  if (Math.abs(det) < 1e-10) return null;
  
  const a = (XtY[0]*(XtX[1][1]*XtX[2][2]-XtX[2][1]*XtX[1][2]) -
            XtX[0][1]*(XtY[1]*XtX[2][2]-XtX[2][1]*XtY[2]) +
            XtX[0][2]*(XtY[1]*XtX[2][1]-XtX[1][1]*XtY[2])) / det;
            
  const b = (XtX[0][0]*(XtY[1]*XtX[2][2]-XtY[2]*XtX[1][2]) -
            XtY[0]*(XtX[1][0]*XtX[2][2]-XtX[2][0]*XtX[1][2]) +
            XtX[0][2]*(XtX[1][0]*XtY[2]-XtY[1]*XtX[2][0])) / det;
            
  const c = (XtX[0][0]*(XtX[1][1]*XtY[2]-XtY[1]*XtX[2][1]) -
            XtX[0][1]*(XtX[1][0]*XtY[2]-XtY[1]*XtX[2][0]) +
            XtY[0]*(XtX[1][0]*XtX[2][1]-XtX[1][1]*XtX[2][0])) / det;
  
  const yhat = xs.map(x => a + b*x + c*x*x);
  const ybar = mean(ys);
  const SSE = sum(ys.map((y,i)=> (y - yhat[i])**2));
  const SST = sum(ys.map(y=> (y - ybar)**2));
  const R2 = 1 - SSE/SST;
  const R2adj = 1 - (SSE/(n-3)) / (SST/(n-1));
  const error = Math.sqrt(SSE/(n-3));
  
  return { 
    a, b, c, R2, R2adj, error,
    predict: x => a + b*x + c*x*x,
    ecuacion: `y = ${a.toFixed(4)} + ${b.toFixed(4)}x + ${c.toFixed(4)}x²`
  };
}

function expFit(xs, ys) {
  const valid = ys.map((y,i)=> y>0 ? [xs[i], Math.log(y)] : null).filter(Boolean);
  if (valid.length < 2) return null;
  
  const X = valid.map(v=>v[0]), Y = valid.map(v=>v[1]);
  const lin = linearFit(X, Y);
  if (!lin) return null;
  
  const a = Math.exp(lin.a), b = lin.b;
  const yhat = xs.map(x => a*Math.exp(b*x));
  const ybar = mean(ys);
  const SSE = sum(ys.map((y,i)=> (y - yhat[i])**2));
  const SST = sum(ys.map(y=> (y - ybar)**2));
  const R2 = 1 - SSE/SST;
  const R2adj = 1 - (SSE/(ys.length-2)) / (SST/(ys.length-1));
  const error = Math.sqrt(SSE/(ys.length-2));
  
  return { 
    a, b, R2, R2adj, error,
    predict: x => a*Math.exp(b*x),
    ecuacion: `y = ${a.toFixed(4)}e^(${b.toFixed(4)}x)`
  };
}

function potFit(xs, ys) {
  const valid = xs.map((x,i)=> x>0 && ys[i]>0 ? [Math.log(x), Math.log(ys[i])] : null).filter(Boolean);
  if (valid.length < 2) return null;
  
  const X = valid.map(v=>v[0]), Y = valid.map(v=>v[1]);
  const lin = linearFit(X, Y);
  if (!lin) return null;
  
  const a = Math.exp(lin.a), b = lin.b;
  const yhat = xs.map(x => a*Math.pow(x, b));
  const ybar = mean(ys);
  const SSE = sum(ys.map((y,i)=> (y - yhat[i])**2));
  const SST = sum(ys.map(y=> (y - ybar)**2));
  const R2 = 1 - SSE/SST;
  const R2adj = 1 - (SSE/(ys.length-2)) / (SST/(ys.length-1));
  const error = Math.sqrt(SSE/(ys.length-2));
  
  return { 
    a, b, R2, R2adj, error,
    predict: x => a*Math.pow(x, b),
    ecuacion: `y = ${a.toFixed(4)}x^${b.toFixed(4)}`
  };
}

// Determinar t_corte: último punto donde exponencial mantiene R² >= 0.90
function computeTcorte(xs, ys) {
  const n = xs.length;
  if (n < 3) return xs[n - 1];
  // Requiere un mínimo de puntos para estabilidad
  const minK = Math.max(5, Math.floor(n * 0.15));
  let tCorte = xs[minK - 1];
  for (let k = minK; k <= n; k++) {
    const subXs = xs.slice(0, k);
    const subYs = ys.slice(0, k);
    const exp = expFit(subXs, subYs);
    // Umbral más estricto y pendiente positiva (crecimiento)
    if (exp && exp.R2 >= 0.95 && exp.b > 0) {
      tCorte = subXs[k - 1];
    }
  }
  // Si nunca se cumple el criterio, usar un corte intermedio para evitar que quede demasiado temprano
  if (!isFinite(tCorte)) {
    tCorte = xs[Math.floor(n / 2)];
  }
  return tCorte;
}

// Función para renderizar el gráfico con animaciones 
function renderCluster(temperatura, medio) {
  if (!Array.isArray(datos) || datos.length === 0) {
    return null;
  }
  const horaMaxEl = document.getElementById('tiempo');
  const horaMax = horaMaxEl ? Number(horaMaxEl.value) : Infinity;
  const rawPuntos = datos
    .filter(d => String(d.temperaturaC) === String(temperatura) && String(d.medio) === String(medio))
    .filter(d => Number(d.tiempo_h) <= horaMax);
  
  const puntos = rawPuntos.map(p => ({ 
    x: p.tiempo_h, 
    y: p['Crecimiento normalizado'] 
  }));

  const xs = puntos.map(p => p.x); 
  const ys = puntos.map(p => p.y);

  if (xs.length < 2) {
    showCurrentModel(null);
    // Limpiar gráfico si existía
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    return null;
  }

  // Identificador de la condición para la UI (simula el antiguo 'barrio')
  const condicionId = `${temperatura}°C en ${medio}`;

  // Calcular todos los modelos
  const resultados = {};
  resultados.lineal = linearFit(xs, ys);
  resultados.cuadratico = quadFit(xs, ys);
  resultados.exponencial = expFit(xs, ys);
  resultados.potencial = potFit(xs, ys);
  
  updateUI(resultados);
  createAnimatedGrowthChart(temperatura,medio, puntos, resultados);
  
  return resultados;
}

function updateUI( resultados) {
  
  // Actualizar tabla comparativa
  updateComparisonTable(resultados);
  
  // Mostrar el modelo actual
  showCurrentModel(resultados[currentModelo]);
  
}


function updateComparisonTable(resultados) {
  const tbody = document.querySelector('#tabla-modelos tbody');
  if (!tbody) return; // La tabla es opcional en el HTML actual
  tbody.innerHTML = '';
  
  Object.entries(resultados).forEach(([key, result]) => {
    if (result) {
      const tr = document.createElement('tr');
      tr.dataset.modelo = key;
      if (key === currentModelo) {
        tr.classList.add('modelo-activo');
      }
      
      tr.innerHTML = `
        <td>${modelos[key].name}</td>
        <td>${result.R2.toFixed(4)}</td>
        <td>${result.R2adj.toFixed(4)}</td>
      `;
      
      tbody.appendChild(tr);
    }
  });
}

function showCurrentModel(modeloData) {
  if (!modeloData) {
    document.getElementById('modelo-titulo').textContent = 'Modelo no disponible';
    document.getElementById('ecuacion-modelo').textContent = 'No se puede calcular';
    document.getElementById('r2-valor').textContent = '-';
    document.getElementById('r2adj-valor').textContent = '-';
    document.getElementById('error-valor').textContent = '-';
    return;
  }
  
  document.getElementById('modelo-titulo').textContent = modelos[currentModelo].name;
  document.getElementById('ecuacion-modelo').textContent = modeloData.ecuacion;
  document.getElementById('r2-valor').textContent = modeloData.R2.toFixed(4);
  document.getElementById('r2adj-valor').textContent = modeloData.R2adj.toFixed(4);
  document.getElementById('error-valor').textContent = modeloData.error.toFixed(4);
}

// Color por condición Temperatura/Medio
function getCondicionColor(temperatura, medio) {
  const key = `${temperatura}-${medio}`;
  const mapa = {
    '25-limitado': '#1f77b4',
    '25-rico': '#2ca02c',
    '30-limitado': '#ff7f0e',
    '30-rico': '#d62728',
    '37-limitado': '#9467bd',
    '37-rico': '#8c564b'
  };
  return mapa[key] || '#333333';
}

// Convierte un color hex a rgba con alpha
function withAlpha(hex, alpha) {
  if (!hex) return `rgba(0,0,0,${alpha ?? 1})`;
  if (hex.startsWith('rgb')) {
    // si ya es rgb/rgba, intenta reemplazar alpha
    const m = hex.match(/rgba?\((\d+),(\d+),(\d+)(?:,(\d+(?:\.\d+)?))?\)/);
    if (m) {
      const r = Number(m[1]), g = Number(m[2]), b = Number(m[3]);
      return `rgba(${r},${g},${b},${alpha ?? (m[4] ? Number(m[4]) : 1)})`;
    }
  }
  // hex #rrggbb
  const clean = hex.replace('#','');
  const r = parseInt(clean.substring(0,2), 16);
  const g = parseInt(clean.substring(2,4), 16);
  const b = parseInt(clean.substring(4,6), 16);
  return `rgba(${r},${g},${b},${alpha ?? 1})`;
}

// Actualiza métricas de Fase 1 y Fase 2 en UI
function updatePhaseMetrics(fase1, fase2, tCorte) {
  const eqF1 = document.getElementById('ecuacion-fase1');
  const r2F1 = document.getElementById('r2-fase1');
  const r2adjF1 = document.getElementById('r2adj-fase1');
  const errF1 = document.getElementById('error-fase1');
  const eqF2 = document.getElementById('ecuacion-fase2');
  const r2F2 = document.getElementById('r2-fase2');
  const r2adjF2 = document.getElementById('r2adj-fase2');
  const errF2 = document.getElementById('error-fase2');
  const tcInfo = document.getElementById('tcorte-info');

  if (tcInfo) {
    tcInfo.hidden = false;
    tcInfo.textContent = `t_corte = ${tCorte.toFixed(2)} h (R² exp ≥ 0.95)`;
  }

  if (eqF1) eqF1.textContent = fase1?.ecuacion ?? '—';
  if (r2F1) r2F1.textContent = fase1?.R2?.toFixed?.(4) ?? '—';
  if (r2adjF1) r2adjF1.textContent = fase1?.R2adj?.toFixed?.(4) ?? '—';
  if (errF1) errF1.textContent = fase1?.error?.toFixed?.(4) ?? '—';

  if (eqF2) eqF2.textContent = fase2?.ecuacion ?? '—';
  if (r2F2) r2F2.textContent = fase2?.R2?.toFixed?.(4) ?? '—';
  if (r2adjF2) r2adjF2.textContent = fase2?.R2adj?.toFixed?.(4) ?? '—';
  if (errF2) errF2.textContent = fase2?.error?.toFixed?.(4) ?? '—';
}


// Función modificada para renderizar el gráfico de crecimiento bacteriano con animaciones
function createAnimatedGrowthChart(temperatura, medio, puntos, resultados) {
  // Crear un identificador único para el título y la leyenda
  const condicionId = `T: ${temperatura}°C, Medio: ${medio}`;
  
  // Obtener el contexto del canvas
  const ctx = document.getElementById('grafico').getContext('2d');
  
  // Destruir gráfico anterior si existe
  if (chartInstance) {
    chartInstance.destroy();
  }
  
  // Crear datasets para el gráfico
  const datasets = [];
  
  // Dataset para los puntos (con animación)
  datasets.push({
    // La etiqueta ahora usa la nueva condición
    label: `Datos de ${condicionId}`,
    data: puntos,
    backgroundColor: withAlpha(getCondicionColor(temperatura, medio), 0.35),
    borderColor: withAlpha(getCondicionColor(temperatura, medio), 0.6),
    borderWidth: 0,
    pointRadius: 6,
    pointHoverRadius: 10,
    order: -999,
    animation: {
      duration: 50,
      easing: 'easeOutQuart',
      delay: (ctx) => ctx.dataIndex * 5
    }
  });
  
  // Dataset para la curva del modelo actual o por tramos
  // Extender la(s) curva(s) desde 0 hasta la Hora seleccionada en el slider
  const horaMaxEl = document.getElementById('tiempo');
  let horaMax = horaMaxEl ? Number(horaMaxEl.value) : 24;
  if (!isFinite(horaMax) || horaMax <= 0) horaMax = 1;
  const rango = Array.from({length: 200}, (_, i) => 0 + i * (horaMax - 0) / 199);
  const xMax = Math.min(24, horaMax);
  
  // Si hay modelos por tramos, dibujar dos curvas
  const xs = puntos.map(p => p.x);
  const ys = puntos.map(p => p.y);
  let tCorte = computeTcorte(xs, ys);
  // Mostrar info de t_corte
  const tcInfo = document.getElementById('tcorte-info');
  if (tcInfo) {
    tcInfo.hidden = false;
    tcInfo.textContent = `t_corte = ${tCorte.toFixed(2)} h (R² exp ≥ 0.90)`;
  }

  const rango1 = rango.filter(x => x <= tCorte);
  const rango2 = rango.filter(x => x >= tCorte);

  const mapModelo = {
    lineal: linearFit,
    cuadratico: quadFit,
    exponencial: expFit,
    potencial: potFit
  };

  // Ajustes por tramo usando datos correspondientes
  // Construir pares (x,y) por tramo para evitar desalineación
  const pares = xs.map((x,i)=>({x, y: ys[i]}));
  const tramo1 = pares.filter(p => p.x <= tCorte);
  const tramo2 = pares.filter(p => p.x >= tCorte);
  const xs1 = tramo1.map(p=>p.x);
  const ys1 = tramo1.map(p=>p.y);
  const xs2 = tramo2.map(p=>p.x);
  const ys2 = tramo2.map(p=>p.y);

  const fit1 = mapModelo[currentModeloFase1](xs1, ys1);
  const fit2 = mapModelo[currentModeloFase2](xs2, ys2);

  // Mostrar métricas por fase
  updatePhaseMetrics(fit1, fit2, tCorte);

  // Curva suavizada combinando ambos modelos para evitar salto
  if (fit1 && fit2) {
    // Usar una transición suave alrededor de tCorte con ancho delta
    const delta = Math.max(0.5, (horaMax - 0) * 0.05); // 5% del rango o 0.5h mínimo
    const blend = (x) => {
      // Función tipo sigmoide centrada en tCorte
      const z = (x - tCorte) / delta;
      return 1 / (1 + Math.exp(-z)); // 0 en tramo1, 1 en tramo2 suavemente
    };
    const curvaSuave = rango.map(x => {
      const y1 = fit1.predict(x);
      const y2 = fit2.predict(x);
      const w = blend(x);
      const y = (1 - w) * y1 + w * y2;
      return { x, y };
    });
    datasets.push({
      label: `Curva suavizada (t_corte)`,
      data: curvaSuave,
      type: 'line',
      borderColor: '#000000',
      borderWidth: 4,
      fill: false,
      pointRadius: 0,
      tension: 0.2,
      order: 999
    });
  } else if (fit1) {
    const curva1 = rango.map(x => ({ x, y: fit1.predict(x) }));
    datasets.push({
      label: `Fase 1 - ${modelos[currentModeloFase1].name}`,
      data: curva1,
      type: 'line',
      borderColor: '#000000',
      borderWidth: 4,
      fill: false,
      pointRadius: 0,
      tension: 0.2,
      order: 999
    });
  } else if (fit2) {
    const curva2 = rango.map(x => ({ x, y: fit2.predict(x) }));
    datasets.push({
      label: `Fase 2 - ${modelos[currentModeloFase2].name}`,
      data: curva2,
      type: 'line',
      borderColor: '#000000',
      borderWidth: 4,
      fill: false,
      pointRadius: 0,
      tension: 0.2,
      order: 999
    });
  }
  
  // Crear nuevo gráfico
  chartInstance = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 2000,
        easing: 'easeOutQuart'
      },
      scales: {
        x: { 
          title: { 
            display: true, 
            // Título del eje X actualizado a 'Hora'
            text: 'Tiempo (Horas)',
            font: { size: 14, weight: 'bold' }
          },
          min: 0,
          max: xMax,
          grid: { color: 'rgba(0,0,0,0.1)' },
          ticks: { padding: 8 }
        },
        y: { 
          title: { 
            display: true, 
            // Título del eje Y actualizado a 'Crecimiento Bacteriano'
            text: 'Crecimiento Bacteriano (Normalizado)',
            font: { size: 14, weight: 'bold' }
          },
          min: 0,
          max: 1.5,
          grid: { color: 'rgba(0,0,0,0.1)' },
          ticks: { padding: 8 },
          grace: '5%'
        }
      },
      plugins: {
        legend: { 
          display: true,
          position: 'top'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (context.parsed.y !== null) {
                label += `: (H: ${context.parsed.x.toFixed(2)}, Crec: ${context.parsed.y.toFixed(4)})`;
              }
              return label;
            }
          }
        }
      }
    }
  });
}



// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', function() {
  // Configurar slider y su visualización
  const slider = document.getElementById('tiempo');
  const sliderValor = document.getElementById('tiempoValor');
  if (slider && sliderValor) {
    sliderValor.textContent = slider.value;
    slider.addEventListener('input', function() {
      sliderValor.textContent = this.value;
      // Re-renderizar cuando cambia la hora máxima
      renderCluster(currentTemperatura, currentMedio);
    });
  }

  // Mostrar estado inicial
  const estado = document.getElementById('estado');
  if (estado) {
    estado.hidden = false;
    estado.textContent = 'Cargando datos…';
  }

  // Cargar datos desde datos.json (permitiendo comentarios)
  fetch('datos.json')
    .then(r => r.text())
    .then(texto => {
      // Eliminar comentarios tipo /* ... */ y // ...
      const sinBloques = texto.replace(/\/\*[\s\S]*?\*\//g, '');
      const sinLineas = sinBloques.replace(/(^|\n)\s*\/\/.*(?=\n|$)/g, '$1');
      let json;
      try {
        json = JSON.parse(sinLineas);
      } catch (e) {
        console.error('Error parseando datos.json', e);
        if (estado) {
          estado.hidden = false;
          estado.textContent = 'Error al leer datos.json';
        }
        return;
      }
      datos = Array.isArray(json) ? json : [];
      if (estado) {
        if (!datos.length) {
          estado.hidden = false;
          estado.textContent = 'No hay datos para mostrar.';
        } else {
          estado.hidden = true;
          estado.textContent = '';
        }
      }
      // Renderizar inicialmente una vez que los datos están cargados
      renderCluster(currentTemperatura, currentMedio);
    })
    .catch(err => {
      console.error('Error cargando datos.json', err);
      if (estado) {
        estado.hidden = false;
        estado.textContent = 'Error cargando datos.json';
      }
    });
  // Configurar selector de barrio
  const temperaturaSelect = document.getElementById('temperaturaSelect');
  const medioSelect = document.getElementById('medioSelect');
  temperaturaSelect.value = currentTemperatura;
  medioSelect.value = currentMedio;
  temperaturaSelect.addEventListener('change', function() {
    currentTemperatura = this.value;

    renderCluster(currentTemperatura, currentMedio);
  });

  medioSelect.addEventListener('change', function() {
    currentMedio = this.value;
    renderCluster(currentTemperatura, currentMedio);
  });
  
  // Configurar botones de modelo
  document.querySelectorAll('.model-btn').forEach(button => {
    button.addEventListener('click', function() {
      // Actualizar botones activos
      document.querySelectorAll('.model-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      this.classList.add('active');
      
      // Cambiar modelo
      currentModelo = this.dataset.modelo;
      
      // Actualizar tabla
      document.querySelectorAll('#tabla-modelos tbody tr').forEach(tr => {
        tr.classList.remove('modelo-activo');
        if (tr.dataset.modelo === currentModelo) {
          tr.classList.add('modelo-activo');
        }
      });
      
      // Re-renderizar gráfico
      const resultados = renderCluster(currentTemperatura, currentMedio);
    });
  });

  // Selects de modelos por fase
  const selF1 = document.getElementById('modeloFase1');
  const selF2 = document.getElementById('modeloFase2');
  if (selF1) selF1.value = currentModeloFase1;
  if (selF2) selF2.value = currentModeloFase2;
  if (selF1) selF1.addEventListener('change', function() {
    currentModeloFase1 = this.value;
    renderCluster(currentTemperatura, currentMedio);
  });
  if (selF2) selF2.addEventListener('change', function() {
    currentModeloFase2 = this.value;
    renderCluster(currentTemperatura, currentMedio);
  });
  
  // La renderización inicial ahora ocurre después de cargar los datos
  
  
});