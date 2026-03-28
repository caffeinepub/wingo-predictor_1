import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface PeriodResult {
    number: bigint;
    timestamp: Time;
    periodId: string;
}
export type Time = bigint;
export interface Prediction {
    suggestion: string;
    confidence: bigint;
}
export interface backendInterface {
    getNextPrediction(): Promise<Prediction>;
    getRecentResults(n: bigint): Promise<Array<PeriodResult>>;
    submitPeriodResult(periodId: string, number: bigint): Promise<void>;
}
