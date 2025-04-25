export class KalmanFilterService {
    // State variables
    private x: number[]; // State vector [lat, lon, lat_velocity, lon_velocity]
    private P: number[][]; // State covariance matrix
    private Q: number[][]; // Process noise covariance
    private R: number[][]; // Measurement noise covariance
    private initialized: boolean;

    constructor() {
        this.initialized = false;
        this.x = [0, 0, 0, 0];
        this.P = [
            [100, 0, 0, 0],
            [0, 100, 0, 0],
            [0, 0, 100, 0],
            [0, 0, 0, 100]
        ];
        this.Q = [
            [0.1, 0, 0.1, 0],
            [0, 0.1, 0, 0.1],
            [0.1, 0, 0.1, 0],
            [0, 0.1, 0, 0.1]
        ];
        this.R = [
            [1, 0],
            [0, 1]
        ];
    }

    predict(dt: number): { latitude: number; longitude: number } {
        if (!this.initialized) {
            throw new Error('Kalman filter not initialized');
        }

        // State transition matrix
        const F = [
            [1, 0, dt, 0],
            [0, 1, 0, dt],
            [0, 0, 1, 0],
            [0, 0, 0, 1]
        ];

        // Predict state
        const predictedState = this.matrixVectorMultiply(F, this.x);
        this.x = predictedState;

        // Predict covariance
        const FP = this.matrixMultiply(F, this.P);
        const FPFt = this.matrixMultiply(FP, this.transpose(F));
        this.P = this.matrixAdd(FPFt, this.Q);

        return {
            latitude: this.x[0],
            longitude: this.x[1]
        };
    }

    update(measurement: { latitude: number; longitude: number; accuracy: number }): { latitude: number; longitude: number } {
        const z = [measurement.latitude, measurement.longitude];

        if (!this.initialized) {
            this.x[0] = z[0];
            this.x[1] = z[1];
            this.initialized = true;
            return { latitude: z[0], longitude: z[1] };
        }

        // Update measurement noise based on accuracy
        this.R = [
            [measurement.accuracy * 0.1, 0],
            [0, measurement.accuracy * 0.1]
        ];

        // Measurement matrix
        const H = [
            [1, 0, 0, 0],
            [0, 1, 0, 0]
        ];

        // Innovation
        const Hx = this.matrixVectorMultiply(H, this.x);
        const y = this.vectorSubtract(z, Hx);

        // Innovation covariance
        const HP = this.matrixMultiply(H, this.P);
        const HPHt = this.matrixMultiply(HP, this.transpose(H));
        const S = this.matrixAdd(HPHt, this.R);

        // Kalman gain
        const PHt = this.matrixMultiply(this.P, this.transpose(H));
        const K = this.matrixMultiply(PHt, this.inverse2x2(S));

        // Update state
        const Ky = this.matrixVectorMultiply(K, y);
        this.x = this.vectorAdd(this.x, Ky);

        // Update covariance
        const I = [
            [1, 0, 0, 0],
            [0, 1, 0, 0],
            [0, 0, 1, 0],
            [0, 0, 0, 1]
        ];
        const KH = this.matrixMultiply(K, H);
        const IKH = this.matrixSubtract(I, KH);
        this.P = this.matrixMultiply(IKH, this.P);

        return {
            latitude: this.x[0],
            longitude: this.x[1]
        };
    }

    // Matrix operations
    private matrixMultiply(a: number[][], b: number[][]): number[][] {
        const result = Array(a.length).fill(0).map(() => Array(b[0].length).fill(0));
        for (let i = 0; i < a.length; i++) {
            for (let j = 0; j < b[0].length; j++) {
                for (let k = 0; k < a[0].length; k++) {
                    result[i][j] += a[i][k] * b[k][j];
                }
            }
        }
        return result;
    }

    private matrixVectorMultiply(matrix: number[][], vector: number[]): number[] {
        const result = new Array(matrix.length).fill(0);
        for (let i = 0; i < matrix.length; i++) {
            for (let j = 0; j < vector.length; j++) {
                result[i] += matrix[i][j] * vector[j];
            }
        }
        return result;
    }

    private transpose(matrix: number[][]): number[][] {
        return matrix[0].map((_, i) => matrix.map(row => row[i]));
    }

    private matrixAdd(a: number[][], b: number[][]): number[][] {
        return a.map((row, i) => row.map((val, j) => val + b[i][j]));
    }

    private matrixSubtract(a: number[][], b: number[][]): number[][] {
        return a.map((row, i) => row.map((val, j) => val - b[i][j]));
    }

    private vectorAdd(a: number[], b: number[]): number[] {
        return a.map((val, i) => val + b[i]);
    }

    private vectorSubtract(a: number[], b: number[]): number[] {
        return a.map((val, i) => val - b[i]);
    }

    private inverse2x2(matrix: number[][]): number[][] {
        const det = matrix[0][0] * matrix[1][1] - matrix[0][1] * matrix[1][0];
        return [
            [matrix[1][1] / det, -matrix[0][1] / det],
            [-matrix[1][0] / det, matrix[0][0] / det]
        ];
    }

    reset(): void {
        this.initialized = false;
        this.x = [0, 0, 0, 0];
        this.P = [
            [100, 0, 0, 0],
            [0, 100, 0, 0],
            [0, 0, 100, 0],
            [0, 0, 0, 100]
        ];
    }
} 