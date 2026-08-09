export type OlsFit = {
  coefficients: number[];
  residuals: number[];
  fittedValues: number[];
};

function multiplyTransposeBySelf(x: number[][]): number[][] {
  const cols = x[0]?.length ?? 0;
  const result: number[][] = Array.from({ length: cols }, () => new Array(cols).fill(0));

  for (let i = 0; i < cols; i += 1) {
    for (let j = 0; j < cols; j += 1) {
      let sum = 0;
      for (let row = 0; row < x.length; row += 1) {
        sum += x[row][i] * x[row][j];
      }
      result[i][j] = sum;
    }
  }

  return result;
}

function multiplyTransposeByVector(x: number[][], y: number[]): number[] {
  const cols = x[0]?.length ?? 0;
  const result = new Array(cols).fill(0);

  for (let i = 0; i < cols; i += 1) {
    let sum = 0;
    for (let row = 0; row < x.length; row += 1) {
      sum += x[row][i] * y[row];
    }
    result[i] = sum;
  }

  return result;
}

function solveLinearSystem(matrix: number[][], vector: number[]): number[] {
  const n = matrix.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);

  for (let pivot = 0; pivot < n; pivot += 1) {
    let maxRow = pivot;
    for (let row = pivot + 1; row < n; row += 1) {
      if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[maxRow][pivot])) {
        maxRow = row;
      }
    }
    [augmented[pivot], augmented[maxRow]] = [augmented[maxRow], augmented[pivot]];

    const pivotValue = augmented[pivot][pivot];
    if (Math.abs(pivotValue) < 1e-10) {
      throw new Error("Matrix is singular and cannot be solved.");
    }

    for (let row = pivot + 1; row < n; row += 1) {
      const factor = augmented[row][pivot] / pivotValue;
      for (let col = pivot; col <= n; col += 1) {
        augmented[row][col] -= factor * augmented[pivot][col];
      }
    }
  }

  const solution = new Array(n).fill(0);
  for (let row = n - 1; row >= 0; row -= 1) {
    let sum = augmented[row][n];
    for (let col = row + 1; col < n; col += 1) {
      sum -= augmented[row][col] * solution[col];
    }
    solution[row] = sum / augmented[row][row];
  }

  return solution;
}

export function fitOls(designMatrix: number[][], target: number[]): OlsFit {
  if (designMatrix.length !== target.length) {
    throw new Error("Design matrix row count must match target length.");
  }
  if (designMatrix.length === 0) {
    throw new Error("Cannot fit a model with zero observations.");
  }

  const xtx = multiplyTransposeBySelf(designMatrix);
  const xty = multiplyTransposeByVector(designMatrix, target);
  const coefficients = solveLinearSystem(xtx, xty);

  const fittedValues = designMatrix.map((row) =>
    row.reduce((sum, value, index) => sum + value * coefficients[index], 0)
  );
  const residuals = target.map((value, index) => value - fittedValues[index]);

  return { coefficients, residuals, fittedValues };
}

export function predictOls(coefficients: number[], row: number[]): number {
  return row.reduce((sum, value, index) => sum + value * coefficients[index], 0);
}

export function calculateRSquared(target: number[], fittedValues: number[]): number {
  const mean = target.reduce((sum, value) => sum + value, 0) / target.length;
  const totalSumOfSquares = target.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  const residualSumOfSquares = target.reduce(
    (sum, value, index) => sum + (value - fittedValues[index]) ** 2,
    0
  );

  if (totalSumOfSquares === 0) {
    return residualSumOfSquares === 0 ? 1 : 0;
  }

  return 1 - residualSumOfSquares / totalSumOfSquares;
}

export function calculateRmse(actual: number[], predicted: number[]): number {
  const sumSquaredError = actual.reduce(
    (sum, value, index) => sum + (value - predicted[index]) ** 2,
    0
  );
  return Math.sqrt(sumSquaredError / actual.length);
}

export function calculateMae(actual: number[], predicted: number[]): number {
  const sumAbsoluteError = actual.reduce(
    (sum, value, index) => sum + Math.abs(value - predicted[index]),
    0
  );
  return sumAbsoluteError / actual.length;
}

export function calculateDurbinWatson(residuals: number[]): number {
  if (residuals.length < 2) {
    return NaN;
  }

  let numerator = 0;
  for (let i = 1; i < residuals.length; i += 1) {
    numerator += (residuals[i] - residuals[i - 1]) ** 2;
  }

  const denominator = residuals.reduce((sum, value) => sum + value ** 2, 0);

  if (denominator === 0) {
    return NaN;
  }

  return numerator / denominator;
}
