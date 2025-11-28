// Configuración inicial
let currentTemperatura = '25';
let currentMedio = 'limitado';
let currentModelo = 'lineal';
let chartInstance = null;
let combinedChartInstance = null;

const slider = document.getElementById("tiempo");
const sliderValor = document.getElementById("tiempoValor");

// Actualizar el valor del span cuando el slider se mueva
slider.addEventListener("input", function() {
  sliderValor.textContent = this.value;
});

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

// Función para renderizar el gráfico con animaciones 
function renderCluster(temperatura, medio) {
  const puntos = datos.filter(d => d.temperatura === temperatura && d.medio === medio);
  const xs = puntos.map(p => p.tiempo_h);
  const ys = puntos.map(p => p['Crecimiento normalizado']);
  
  if (xs.length < 2) {
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
  
  updateUI(condicionId, resultados);
  createAnimatedChart(condicionId, puntos, resultados);
  
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
    // Se mantiene la función getBarrioColor, pero debería ser reemplazada por una 
    // función que devuelva un color basado en la Temperatura/Medio (e.g., getCondicionColor)
    backgroundColor: getBarrioColor(temperatura), // Usando 'temperatura' temporalmente como clave de color
    pointRadius: 6,
    pointHoverRadius: 10,
    animation: {
      duration: 50,
      easing: 'easeOutQuart',
      delay: (ctx) => ctx.dataIndex * 5
    }
  });
  
  // Dataset para la curva del modelo actual
  // Asumimos que los 'puntos' ya contienen los datos mapeados (tiempo_h en .x y Crecimiento en .y)
  const minX = Math.min(...puntos.map(p => p.horas_t));
  const maxX = Math.max(...puntos.map(p => p['Crecimiento normalizado']));
  const rango = Array.from({length: 100}, (_, i) => minX + i * (maxX - minX) / 99);
  
  const modeloData = resultados[currentModelo];
  if (modeloData) {
    const curva = rango.map(x => ({x, y: modeloData.predict(x)}));
    datasets.push({
      label: `${modelos[currentModelo].name}`,
      data: curva,
      type: 'line',
      borderColor: modelos[currentModelo].color,
      borderWidth: 3,
      fill: false,
      pointRadius: 0,
      tension: 0.4,
      animation: {
        duration: 2000,
        easing: 'easeOutQuart'
      }
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
          grid: { color: 'rgba(0,0,0,0.1)' }
        },
        y: { 
          title: { 
            display: true, 
            // Título del eje Y actualizado a 'Crecimiento Bacteriano'
            text: 'Crecimiento Bacteriano (Normalizado)',
            font: { size: 14, weight: 'bold' }
          },
          min: 0,     // mínimo del eje Y
          max: 1.1,  // Ajuste a un máximo razonable para datos normalizados
          grid: { color: 'rgba(0,0,0,0.1)' }
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
      const puntos = datos.filter(d => d.temperatura === temperatura && d.medio === medio);
      const resultados = renderCluster(currentTemperatura, currentMedio);
      showCurrentModel(resultados[currentModelo]);
    });
  });
  
  // Renderizar inicialmente
  renderBarrio(currentTemperatura, currentMedio);
  
  
});