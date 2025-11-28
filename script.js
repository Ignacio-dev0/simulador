// Configuración inicial
let currentTemperatura = '25';
let currentMedio = 'limitado';
let currentModelo = 'lineal';
let chartInstance = null;
let combinedChartInstance = null;

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